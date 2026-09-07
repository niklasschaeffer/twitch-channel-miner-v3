import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { minerEngine } from './server/minerEngine.js';
import { prisma } from './server/db.js';
import { md5 } from './src/lib/gravatar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'sqlite-prisma', time: new Date().toISOString() });
  });

  // Auth endpoints (Multiuser support)
  app.get('/api/auth/me', async (req, res) => {
    try {
      const user = await prisma.user.findFirst({
        orderBy: { createdAt: 'asc' }
      });
      if (!user) {
        res.status(404).json({ error: 'No user found' });
        return;
      }
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        provider: user.provider
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    const { email, username, password } = req.body;
    if (!email || !username) {
      res.status(400).json({ error: 'Email and username are required' });
      return;
    }
    try {
      const cleanEmail = email.trim().toLowerCase();
      const gravatarHash = md5(cleanEmail);
      const avatarUrl = `https://www.gravatar.com/avatar/${gravatarHash}?s=100&d=identicon`;

      const user = await prisma.user.upsert({
        where: { email: cleanEmail },
        update: {
          username: username.trim(),
          avatarUrl
        },
        create: {
          email: cleanEmail,
          username: username.trim(),
          password: password || 'default_pass',
          avatarUrl,
          provider: 'local'
        }
      });

      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
    try {
      const cleanEmail = email.trim().toLowerCase();
      let user = await prisma.user.findUnique({
        where: { email: cleanEmail }
      });

      if (!user) {
        // Auto-provision if not found
        const gravatarHash = md5(cleanEmail);
        const avatarUrl = `https://www.gravatar.com/avatar/${gravatarHash}?s=100&d=identicon`;
        const autoName = cleanEmail.split('@')[0];

        user = await prisma.user.create({
          data: {
            email: cleanEmail,
            username: autoName.charAt(0).toUpperCase() + autoName.slice(1),
            avatarUrl,
            provider: 'local'
          }
        });
      }

      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/oauth', async (req, res) => {
    const { provider, email } = req.body;
    const targetProvider = provider === 'github' ? 'github' : 'google';
    const cleanEmail = (email || (targetProvider === 'github' ? 'dev@github.com' : 'user@google.com')).trim().toLowerCase();
    const gravatarHash = md5(cleanEmail);
    const avatarUrl = `https://www.gravatar.com/avatar/${gravatarHash}?s=100&d=identicon`;
    const username = targetProvider === 'github' ? 'GitHub Explorer' : 'Google User';

    try {
      const user = await prisma.user.upsert({
        where: { email: cleanEmail },
        update: {
          provider: targetProvider,
          avatarUrl
        },
        create: {
          email: cleanEmail,
          username,
          avatarUrl,
          provider: targetProvider
        }
      });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Miner Control & Status
  app.get('/api/status', (req, res) => {
    res.json(minerEngine.getStatus());
  });

  app.post('/api/miner/start', (req, res) => {
    minerEngine.startMiner();
    res.json({ success: true, status: minerEngine.getStatus() });
  });

  app.post('/api/miner/pause', (req, res) => {
    minerEngine.pauseMiner();
    res.json({ success: true, status: minerEngine.getStatus() });
  });

  app.post('/api/miner/stop', (req, res) => {
    minerEngine.stopMiner();
    res.json({ success: true, status: minerEngine.getStatus() });
  });

  app.post('/api/miner/test-claim', (req, res) => {
    const { channel } = req.body || {};
    const result = minerEngine.triggerTestClaim(channel);
    res.json(result);
  });

  // Streamers (Stored in SQLite via Prisma)
  app.get('/api/streamers', (req, res) => {
    res.json(minerEngine.getStreamers());
  });

  app.post('/api/streamers', async (req, res) => {
    const { username, displayName } = req.body;
    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }
    try {
      const streamer = await minerEngine.addStreamer(username, displayName);
      res.json(streamer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/streamers/:username', async (req, res) => {
    try {
      const success = await minerEngine.removeStreamer(req.params.username);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/streamers/:username', async (req, res) => {
    try {
      const updated = await minerEngine.updateStreamer(req.params.username, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Streamer not found' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Miner Settings (Stored in SQLite via Prisma)
  app.get('/api/settings', (req, res) => {
    res.json(minerEngine.getSettings());
  });

  app.post('/api/settings', async (req, res) => {
    try {
      const updated = await minerEngine.updateSettings(req.body);
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
    res.json(minerEngine.getLogs(limit, level, search));
  });

  app.post('/api/logs/clear', async (req, res) => {
    await minerEngine.clearLogs();
    res.json({ success: true });
  });

  // Statistical Records (Stored in SQLite via Prisma ORM)
  app.get('/api/statistics', async (req, res) => {
    try {
      const records = await minerEngine.getStatisticalRecords();
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/statistics', async (req, res) => {
    try {
      await minerEngine.recordStatisticalData(req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Analytics Aggregation (Calculated from SQLite Statistical Records)
  app.get('/api/analytics', async (req, res) => {
    try {
      const analytics = await minerEngine.getAnalytics();
      res.json(analytics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Server-Sent Events (SSE) for real-time updates
  app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const unsubscribe = minerEngine.subscribeSSE(data => {
      res.write(data);
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Twitch Channel Points Miner running on http://0.0.0.0:${PORT} (Prisma SQLite enabled)`);
  });
}

startServer();
