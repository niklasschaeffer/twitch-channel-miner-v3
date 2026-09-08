import { Streamer, StatisticalRecord, User, MinerSettings, LogEntry, AnalyticsData } from '../types';

/**
 * Frontend Prisma Client implementation
 * Emulates the Prisma ORM Client API on the frontend, routing queries and mutations
 * to the backend SQLite database powered by Prisma.
 */
export const prisma = {
  streamer: {
    findMany: async (): Promise<Streamer[]> => {
      const res = await fetch('/api/streamers');
      if (!res.ok) throw new Error('Failed to fetch streamers from Prisma database');
      return res.json();
    },
    findUnique: async ({ where }: { where: { username: string } }): Promise<Streamer | null> => {
      const res = await fetch('/api/streamers');
      if (!res.ok) return null;
      const streamers: Streamer[] = await res.json();
      return streamers.find(s => s.username.toLowerCase() === where.username.toLowerCase()) || null;
    },
    create: async ({ data }: { data: { username: string; displayName?: string } }): Promise<Streamer> => {
      const res = await fetch('/api/streamers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create streamer in SQLite database');
      }
      return res.json();
    },
    update: async ({ where, data }: { where: { username: string }; data: Partial<Streamer> }): Promise<Streamer> => {
      const res = await fetch(`/api/streamers/${encodeURIComponent(where.username)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update streamer via Prisma');
      return res.json();
    },
    delete: async ({ where }: { where: { username: string } }): Promise<{ success: boolean }> => {
      const res = await fetch(`/api/streamers/${encodeURIComponent(where.username)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete streamer via Prisma');
      return res.json();
    }
  },

  statisticalRecord: {
    findMany: async (): Promise<StatisticalRecord[]> => {
      const res = await fetch('/api/statistics');
      if (!res.ok) throw new Error('Failed to query statistical records from SQLite');
      return res.json();
    },
    create: async ({ data }: { data: Partial<StatisticalRecord> }): Promise<StatisticalRecord> => {
      const res = await fetch('/api/statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to record statistical telemetry in Prisma');
      return res.json();
    },
    getAnalytics: async (): Promise<AnalyticsData> => {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error('Failed to load analytics from Prisma SQLite');
      return res.json();
    }
  },

  user: {
    getCurrent: async (): Promise<User | null> => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return null;
      return res.json();
    },
    register: async (data: { email: string; username: string; password?: string }): Promise<User> => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Registration failed');
      }
      return res.json();
    },
    login: async (data: { email: string; password?: string }): Promise<User> => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Login failed');
      }
      return res.json();
    }
  },

  minerSetting: {
    findUnique: async (): Promise<MinerSettings> => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch miner settings from Prisma');
      return res.json();
    },
    update: async ({ data }: { data: Partial<MinerSettings> }): Promise<MinerSettings> => {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update miner settings in Prisma');
      return res.json();
    }
  },

  logRecord: {
    findMany: async (args?: { limit?: number; level?: string; search?: string }): Promise<LogEntry[]> => {
      const params = new URLSearchParams();
      if (args?.limit) params.set('limit', args.limit.toString());
      if (args?.level) params.set('level', args.level);
      if (args?.search) params.set('search', args.search);
      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to query logs from Prisma');
      return res.json();
    },
    clear: async (): Promise<{ success: boolean }> => {
      const res = await fetch('/api/logs/clear', { method: 'POST' });
      return res.json();
    }
  }
};

export default prisma;
