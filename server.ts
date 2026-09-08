import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
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

  app.get('/api/miner/connections', (req, res) => {
    res.json(minerEngine.getActiveConnections());
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
    const cleanUsername = extractTwitchUsername(username);
    if (!cleanUsername) {
      res.status(400).json({ error: 'Valid channel username or Twitch URL is required' });
      return;
    }
    try {
      const streamer = await minerEngine.addStreamer(cleanUsername, displayName);
      res.json(streamer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/streamers/:username', async (req, res) => {
    try {
      const cleanUsername = extractTwitchUsername(req.params.username);
      const success = await minerEngine.removeStreamer(cleanUsername);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/streamers/:username', async (req, res) => {
    try {
      const cleanUsername = extractTwitchUsername(req.params.username);
      const updated = await minerEngine.updateStreamer(cleanUsername, req.body);
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
      const stats = await minerEngine.getLiveStats(cleanUsername);
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
      const updated = await minerEngine.toggleStreamerLive(cleanUsername, forceLive);
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
      const messages = minerEngine.getStreamerChat(cleanUsername);
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
      const sent = minerEngine.handleUserChatMessage(cleanUsername, message, senderName || 'You');
      res.json(sent);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Refresh all streamers from live Twitch telemetry
  app.post('/api/streamers/refresh-live', async (req, res) => {
    try {
      const streamers = await minerEngine.refreshAllLiveStats();
      res.json({ success: true, count: streamers.length, streamers });
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
    });

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
