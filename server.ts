import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { minerEngine, extractTwitchUsername } from './server/minerEngine.js';
import { prisma } from './server/db.js';
import { md5 } from './src/lib/gravatar.js';

// Safe path resolution for both ESM (tsx dev) and CJS (dist/server.cjs bundle)
const getDirname = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return process.cwd();
};
const __dirname = typeof globalThis.__dirname !== 'undefined' ? globalThis.__dirname : getDirname();

const PORT = 3000;

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; username: string; avatarUrl?: string | null; provider: string };
    }
  }
}

async function startServer() {
  const app = express();

  const parseCookies = (req: express.Request): Record<string, string> => {
    const header = req.headers.cookie;
    const out: Record<string, string> = {};
    if (!header) return out;
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
    return out;
  };

  app.use(async (req, res, next) => {
    const sid = parseCookies(req).miner_session;
    if (sid) {
      const session = await prisma.session.findUnique({
        where: { id: sid },
        include: { user: true }
      }).catch(() => null);
      if (session && session.expiresAt > new Date()) {
        req.user = { id: session.user.id, email: session.user.email, username: session.user.username, avatarUrl: session.user.avatarUrl, provider: session.user.provider };
      }
    }
    next();
  });

  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    next();
  };

  const setSessionCookie = async (res: express.Response, userId: string) => {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await prisma.session.create({ data: { id: sessionId, userId, expiresAt } });
    res.setHeader('Set-Cookie', `miner_session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);
  };

  const hashPassword = (password: string) => scryptSync(password, randomBytes(16).toString('hex'), 64).toString('hex');
  const verifyPassword = (password: string, stored: string) => {
    const [salt, key] = [stored.slice(0, 32), stored.slice(32)];
    const candidate = scryptSync(password, salt, 64);
    return timingSafeEqual(Buffer.from(key, 'hex'), candidate);
  };

  app.use(express.json());

  app.use((req, res, next) => {
    const path = req.path;
    const isPublic = path === '/api/health'
      || path.startsWith('/api/auth/')
      || path.startsWith('/api/twitch/device/')
      || path === '/api/twitch/status'
      || path === '/api/status'
      || !path.startsWith('/api/');
    if (isPublic) {
      next();
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    next();
  });

  app.post('/api/auth/logout', (req, res) => {
    const sid = parseCookies(req).miner_session;
    if (sid) {
      prisma.session.delete({ where: { id: sid } }).catch(() => {});
    }
    res.setHeader('Set-Cookie', 'miner_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
    res.json({ success: true });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'sqlite-prisma', time: new Date().toISOString() });
  });

  // --- Twitch OAuth Device Flow (username/password-free login) ---
  // Credential roles: the TV client id (ue6666...) works for BOTH the device
  // flow AND authenticated GQL viewer context (balance binding — verified
  // 2026-09-08). Anonymous GQL telemetry uses the public web client id
  // (constant in the engine). Do not swap them.
  const TWITCH_APP_CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'ue6666qo983tsx6so1t0vnawi233wa';
  const TWITCH_SCOPES = 'user_read chat:read channel_read';
  const twitchLoginSessions = new Map<string, {
    deviceCode: string; userCode: string; verificationUri: string;
    interval: number; expiresAt: number; state: 'pending' | 'granted' | 'denied' | 'error';
    token?: string; login?: string; userId?: string; error?: string; ownerUserId?: string;
  }>();

  interface TwitchTokenValidation {
    login: string;
    userId: string;
  }

  const validateTwitchToken = async (token: string): Promise<TwitchTokenValidation | null> => {
    const res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { 'Authorization': `OAuth ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const v: unknown = await res.json();
    if (typeof v !== 'object' || v === null || !('login' in v) || !('user_id' in v)) return null;
    const login = v.login;
    const userId = v.user_id;
    if (typeof login !== 'string' || typeof userId !== 'string') return null;
    return { login, userId };
  };

  // Step 1: start a device login — returns a code the user enters at twitch.tv/activate
  app.post('/api/twitch/device/start', async (req, res) => {
    try {
      const r = await fetch('https://id.twitch.tv/oauth2/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: TWITCH_APP_CLIENT_ID,
          scopes: TWITCH_SCOPES
        }),
        signal: AbortSignal.timeout(8000)
      });
      const j: unknown = await r.json();
      if (
        !r.ok || typeof j !== 'object' || j === null ||
        !('device_code' in j) || !('user_code' in j) || !('verification_uri' in j)
      ) {
        res.status(502).json({ error: 'Device flow start failed' });
        return;
      }
      const deviceCode = j.device_code;
      const userCode = j.user_code;
      const verificationUri = j.verification_uri;
      const intervalIn = 'interval' in j && typeof j.interval === 'number' ? j.interval : 5;
      const expiresIn = 'expires_in' in j && typeof j.expires_in === 'number' ? j.expires_in : 1800;
      if (typeof deviceCode !== 'string' || typeof userCode !== 'string' || typeof verificationUri !== 'string') {
        res.status(502).json({ error: 'Device flow start failed' });
        return;
      }
      const sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      twitchLoginSessions.set(sessionId, {
        deviceCode,
        userCode,
        verificationUri,
        interval: intervalIn,
        expiresAt: Date.now() + expiresIn * 1000,
        state: 'pending',
        ownerUserId: req.user?.id
      });
      res.json({
        sessionId,
        userCode,
        verificationUri,
        interval: intervalIn,
        expiresInSeconds: expiresIn
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Device flow start failed' });
    }
  });

  // Step 2: frontend polls this while the user activates the code.
  // NOTE: the access token is intentionally NOT returned here — it is stored
  // server-side only. The frontend learns login name via this response and
  // token presence via GET /api/twitch/status.
  app.post('/api/twitch/device/poll', async (req, res) => {
    const { sessionId } = (req.body || {}) as { sessionId?: unknown };
    const session = typeof sessionId === 'string' ? twitchLoginSessions.get(sessionId) : undefined;
    if (!session) {
      res.status(404).json({ error: 'Unknown or expired login session' });
      return;
    }
    if (session.state === 'granted') {
      res.json({ state: 'granted', login: session.login, userId: session.userId });
      return;
    }
    if (session.state !== 'pending') {
      res.json({ state: session.state, error: session.error });
      return;
    }
    if (Date.now() > session.expiresAt) {
      if (typeof sessionId === 'string') {
        twitchLoginSessions.delete(sessionId);
      }
      res.json({ state: 'error', error: 'Login code expired — start again.' });
      return;
    }
    try {
      const r = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: TWITCH_APP_CLIENT_ID,
          device_code: session.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (r.status === 200) {
        const j: unknown = await r.json();
        if (typeof j !== 'object' || j === null || !('access_token' in j) || typeof j.access_token !== 'string') {
          res.json({ state: 'error', error: 'Token response missing access_token.' });
          return;
        }
        const token = j.access_token;
        const v = await validateTwitchToken(token);
        if (!v) {
          res.json({ state: 'error', error: 'Token received but failed validation.' });
          return;
        }
        if (!session.ownerUserId) {
          if (typeof sessionId === 'string') {
            twitchLoginSessions.delete(sessionId);
          }
          res.json({ state: 'error', error: 'Login required — your dashboard session expired. Log in and try again.' });
          return;
        }
        session.state = 'granted';
        session.token = token;
        session.login = v.login;
        session.userId = v.userId;
        await minerEngine.updateSettings({ authToken: token }, session.ownerUserId);
        minerEngine.addLog('SUCCESS', undefined, `Twitch account connected: ${v.login}. Real Channel Points balance is now live.`, session.ownerUserId);
        res.json({ state: 'granted', login: v.login, userId: v.userId });
      }
      // 400 = authorization_pending / slow_down — still waiting for the user.
      // The frontend drives polling cadence using `interval` from /start.
      const j: unknown = await r.json().catch(() => null);
      if (typeof j === 'object' && j !== null && 'error' in j && j.error === 'slow_down') {
        session.interval += 5;
      }
      res.json({ state: 'pending' });
    } catch (err) {
      res.json({ state: 'pending', transientError: err instanceof Error ? err.message : 'network error' });
    }
  });
  app.get('/api/twitch/status', async (req, res) => {
    const uid = req.user?.id;
    if (!uid) {
      res.json({ connected: false });
      return;
    }
    try {
      const v = await minerEngine.validateStoredAuthToken(uid);
      if (!v) {
        res.json({ connected: false, stale: Boolean(minerEngine.getSettings(uid).hasAuthToken) });
        return;
      }
      res.json({ connected: true, login: v.login, userId: v.userId });
    } catch {
      res.json({ connected: false, unknown: true });
    }
  });

  app.post('/api/twitch/disconnect', async (req, res) => {
    await minerEngine.updateSettings({ authToken: '' }, req.user!.id);
    minerEngine.addLog('INFO', undefined, 'Twitch account disconnected.', req.user!.id);
    res.json({ connected: false });
  });


  // Auth endpoints (Multiuser support)

  // --- Real Google OAuth (authorization code flow) ---
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
  const googleRedirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;
  const googleOauthStates = new Map<string, number>();

  app.get('/api/auth/google/start', (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(500).json({ error: 'Google OAuth not configured (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env)' });
      return;
    }
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    googleOauthStates.set(state, Date.now());
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', googleRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    res.redirect(url.toString());
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const issuedAt = state ? googleOauthStates.get(state) : undefined;
    googleOauthStates.delete(state);
    if (!code || !issuedAt || Date.now() - issuedAt > 600_000) {
      res.status(400).send('Google OAuth failed: invalid state or missing code.');
      return;
    }
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: googleRedirectUri,
          grant_type: 'authorization_code'
        }),
        signal: AbortSignal.timeout(10000)
      });
      const tokenData: unknown = await tokenRes.json();
      if (!tokenRes.ok || typeof tokenData !== 'object' || tokenData === null || !('access_token' in tokenData) || typeof tokenData.access_token !== 'string') {
        res.status(502).send('Google token exchange failed.');
        return;
      }
      const uiRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: AbortSignal.timeout(8000)
      });
      const ui: unknown = await uiRes.json();
      if (!uiRes.ok || typeof ui !== 'object' || ui === null || !('email' in ui) || typeof ui.email !== 'string') {
        res.status(502).send('Google userinfo fetch failed.');
        return;
      }
      const email = ui.email.toLowerCase();
      const name = 'name' in ui && typeof ui.name === 'string' ? ui.name : email.split('@')[0];
      const picture = 'picture' in ui && typeof ui.picture === 'string' ? ui.picture : undefined;
      const gravatarHash = md5(email);
      const avatarUrl = picture ?? `https://www.gravatar.com/avatar/${gravatarHash}?s=100&d=identicon`;
      const user = await prisma.user.upsert({
        where: { email },
        update: { provider: 'google', avatarUrl },
        create: { email, username: name, avatarUrl, provider: 'google' }
      });
      await setSessionCookie(res, user.id);
      res.redirect(`/`);
    } catch (err) {
      res.status(502).send(`Google OAuth error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.json(req.user);
  });

  app.post('/api/auth/register', async (req, res) => {
    const { email, username, password } = req.body;
    if (!email || !username || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Email, username and a password of at least 8 characters are required' });
      return;
    }
    try {
      const cleanEmail = email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing) {
        res.status(409).json({ error: 'An account with this email already exists' });
        return;
      }
      const gravatarHash = md5(cleanEmail);
      const avatarUrl = `https://www.gravatar.com/avatar/${gravatarHash}?s=100&d=identicon`;

      const passwordHash = hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email: cleanEmail,
          username: username.trim(),
          password: passwordHash,
          avatarUrl,
          provider: 'local'
        }
      });
      await setSessionCookie(res, user.id);

      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    try {
      const cleanEmail = email.trim().toLowerCase();
      const user = await prisma.user.findUnique({
        where: { email: cleanEmail }
      });

      if (!user || !user.password) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      let valid = false;
      try {
        valid = verifyPassword(password, user.password);
      } catch {
        valid = false;
      }
      if (!valid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      await setSessionCookie(res, user.id);
      res.json({ id: user.id, email: user.email, username: user.username, avatarUrl: user.avatarUrl, provider: user.provider });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Miner Control & Status
  app.get('/api/status', (req, res) => {
    res.json(minerEngine.getStatus(req.user?.id));
  });

  app.get('/api/miner/connections', (req, res) => {
    res.json(minerEngine.getActiveConnections(req.user!.id));
  });

  app.post('/api/miner/start', (req, res) => {
    minerEngine.startMiner(req.user!.id);
    res.json({ success: true, status: minerEngine.getStatus(req.user!.id) });
  });

  app.post('/api/miner/pause', (req, res) => {
    minerEngine.pauseMiner(req.user!.id);
    res.json({ success: true, status: minerEngine.getStatus(req.user!.id) });
  });

  app.post('/api/miner/stop', (req, res) => {
    minerEngine.stopMiner(req.user!.id);
    res.json({ success: true, status: minerEngine.getStatus(req.user!.id) });
  });

  app.post('/api/miner/test-claim', async (req, res) => {
    const { channel } = (req.body || {}) as { channel?: unknown };
    const channelName = typeof channel === 'string' ? channel : undefined;
    const result = await minerEngine.triggerTestClaim(channelName, req.user!.id);
    res.json(result);
  });

  app.get('/api/streamers', requireAuth, (req, res) => {
    const all = minerEngine.getStreamers(req.user!.id);
    res.json(all.filter(s => s.userId === req.user!.id));
  });

  app.post('/api/streamers', requireAuth, async (req, res) => {
    const { username, displayName } = req.body;
    const cleanUsername = extractTwitchUsername(username);
    if (!cleanUsername) {
      res.status(400).json({ error: 'Valid channel username or Twitch URL is required' });
      return;
    }
    try {
      const streamer = await minerEngine.addStreamer(cleanUsername, displayName, req.user!.id);
      res.json(streamer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/streamers/:username', requireAuth, async (req, res) => {
    try {
      const cleanUsername = extractTwitchUsername(req.params.username);
      const owned = minerEngine.getStreamers(req.user!.id).find(s => extractTwitchUsername(s.username) === cleanUsername && s.userId === req.user!.id);
      if (!owned) {
        res.status(404).json({ error: 'Streamer not found' });
        return;
      }
      const success = await minerEngine.removeStreamer(cleanUsername, req.user!.id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/streamers/:username', requireAuth, async (req, res) => {
    try {
      const cleanUsername = extractTwitchUsername(req.params.username);
      const owned = minerEngine.getStreamers(req.user!.id).find(s => extractTwitchUsername(s.username) === cleanUsername && s.userId === req.user!.id);
      if (!owned) {
        res.status(404).json({ error: 'Streamer not found' });
        return;
      }
      const updated = await minerEngine.updateStreamer(cleanUsername, req.body, req.user!.id);
      if (!updated) {
        res.status(404).json({ error: 'Streamer not found' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fetch real-time live stats (viewers, points, live status) for a specific streamer
  app.get('/api/streamers/:username/live-stats', async (req, res) => {
    try {
      const cleanUsername = extractTwitchUsername(req.params.username);
      const stats = await minerEngine.getLiveStats(cleanUsername, req.user!.id);
      if (!stats) {
        res.status(404).json({ error: 'Streamer not found' });
        return;
      }
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Toggle streamer live status manually (online/offline)
  app.post('/api/streamers/:username/toggle-live', async (req, res) => {
    try {
      const cleanUsername = extractTwitchUsername(req.params.username);
      const { forceLive } = req.body || {};
      const updated = await minerEngine.toggleStreamerLive(cleanUsername, forceLive, req.user!.id);
      if (!updated) {
        res.status(404).json({ error: 'Streamer not found' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get streamer IRC chat history
  app.get('/api/streamers/:username/chat', (req, res) => {
    try {
      const cleanUsername = extractTwitchUsername(req.params.username);
      const messages = minerEngine.getStreamerChat(cleanUsername, req.user!.id);
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send IRC chat message or miner command
  app.post('/api/streamers/:username/chat', (req, res) => {
    try {
      const cleanUsername = extractTwitchUsername(req.params.username);
      const { message, senderName } = req.body || {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }
      const sent = minerEngine.handleUserChatMessage(cleanUsername, message, senderName || 'You', req.user!.id);
      res.json(sent);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Refresh all streamers from live Twitch telemetry
  app.post('/api/streamers/refresh-live', async (req, res) => {
    try {
      const streamers = await minerEngine.refreshAllLiveStats(req.user!.id);
      res.json({ success: true, count: streamers.length, streamers });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Miner Settings (Stored in SQLite via Prisma)
  app.get('/api/settings', (req, res) => {
    res.json(minerEngine.getSettings(req.user!.id));
  });

  app.post('/api/settings', async (req, res) => {
    try {
      const updated = await minerEngine.updateSettings(req.body, req.user!.id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Logs (Stored in SQLite via Prisma)
  app.get('/api/logs', (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const level = req.query.level as string | undefined;
    const search = req.query.search as string | undefined;
    res.json(minerEngine.getLogs(limit, level, search, req.user!.id));
  });

  app.post('/api/logs/clear', async (req, res) => {
    await minerEngine.clearLogs(req.user!.id);
    res.json({ success: true });
  });

  // Statistical Records (Stored in SQLite via Prisma ORM)
  app.get('/api/statistics', async (req, res) => {
    try {
      const records = await minerEngine.getStatisticalRecords(req.user!.id);
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/statistics', async (req, res) => {
    try {
      await minerEngine.recordStatisticalData(req.body, req.user!.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Analytics Aggregation (Calculated from SQLite Statistical Records)
  app.get('/api/analytics', async (req, res) => {
    try {
      const analytics = await minerEngine.getAnalytics(req.user!.id);
      res.json(analytics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Server-Sent Events (SSE) for real-time updates
  const sseResponses = new Set<express.Response>();
  app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseResponses.add(res);

    const unsubscribe = minerEngine.subscribeSSE(data => {
      try {
        res.write(data);
      } catch {}
    }, req.user?.id);

    req.on('close', () => {
      unsubscribe();
      sseResponses.delete(res);
    });
  });

  // Vite middleware for development or static serving for production
  let viteServer: any = null;
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    viteServer = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(viteServer.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await minerEngine.spawnWorkersFromDb();

  function listenWithRetry(retries = 5) {
    const sockets = new Set<any>();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Twitch Channel Points Miner running on http://0.0.0.0:${PORT} (Prisma SQLite enabled)`);
    });

    server.on('connection', (socket: any) => {
      sockets.add(socket);
      socket.once('close', () => {
        sockets.delete(socket);
      });
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        if (retries > 0) {
          console.warn(`Port ${PORT} is busy, retrying in 1 second (${retries} retries remaining)...`);
          setTimeout(() => {
            listenWithRetry(retries - 1);
          }, 1000);
        } else {
          console.error(`Port ${PORT} is still in use after retries. Exiting to allow orchestrator restart:`, err);
          process.exit(1);
        }
      } else {
        console.error('Server encountered an error:', err);
        process.exit(1);
      }
    });

    let isExiting = false;
    const cleanupAndExit = async () => {
      if (isExiting) return;
      isExiting = true;

      // Force immediate process exit if graceful teardown exceeds 600ms
      const fallbackTimer = setTimeout(() => {
        process.exit(0);
      }, 600);
      fallbackTimer.unref();

      try {
        minerEngine.destroy();
      } catch {}

      for (const res of sseResponses) {
        try {
          res.end();
        } catch {}
      }
      sseResponses.clear();

      if (viteServer) {
        try {
          await viteServer.close();
        } catch {}
      }

      for (const socket of sockets) {
        try {
          socket.destroy();
        } catch {}
      }
      sockets.clear();

      try {
        server.close(() => {
          process.exit(0);
        });
      } catch {
        process.exit(0);
      }
    };

    process.once('SIGTERM', cleanupAndExit);
    process.once('SIGINT', cleanupAndExit);
  }

  listenWithRetry();
}

startServer();
