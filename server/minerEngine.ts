import {
  Streamer,
  MinerSettings,
  MinerStatus,
  LogEntry,
  LogLevel,
  StatisticalRecord,
  AnalyticsData,
  ChatMessage
} from '../src/types.js';
import { prisma } from './db.js';
import { MinerWorker } from './minerWorker.js';

export function extractTwitchUsername(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim().toLowerCase();
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?(m\.)?twitch\.tv\//i, '');
  cleaned = cleaned.replace(/^[@/]+/, '');
  cleaned = cleaned.split('?')[0].split('#')[0].replace(/\/+$/, '');
  const match = cleaned.match(/^[a-z0-9_]{1,35}/i);
  return match ? match[0].toLowerCase() : cleaned;
}

interface SSEClient {
  id: number;
  userId?: string;
  send: (data: string) => void;
}

export class MinerEngine {
  private workers = new Map<string, MinerWorker>();
  private sseClients: SSEClient[] = [];
  private nextClientId = 1;

  ensureWorker(userId: string): MinerWorker {
    const existing = this.workers.get(userId);
    if (existing) return existing;
    const worker = new MinerWorker(userId, {
      broadcast: (event, payload) => this.deliverSSE(userId, event, payload)
    });
    this.workers.set(userId, worker);
    return worker;
  }

  disposeWorker(userId: string): void {
    const worker = this.workers.get(userId);
    if (!worker) return;
    this.workers.delete(userId);
    worker.dispose();
  }

  async spawnWorkersFromDb(): Promise<void> {
    await this.adoptLegacyRows();
    const rows = await prisma.minerSetting.findMany({ where: { authToken: { not: '' } } });
    for (const row of rows) {
      if (!row.userId) continue;
      this.ensureWorker(row.userId);
    }
  }

  private async adoptLegacyRows(): Promise<void> {
    const orphanCounts = await Promise.all([
      prisma.minerSetting.count({ where: { userId: null } }),
      prisma.streamer.count({ where: { userId: null } }),
      prisma.logRecord.count({ where: { userId: null } }),
      prisma.statisticalRecord.count({ where: { userId: null } })
    ]);
    if (orphanCounts.every(c => c === 0)) return;
    const oldestUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!oldestUser) return;
    const adopted: string[] = [];
    try {
      const ownedSettings = await prisma.minerSetting.findUnique({ where: { userId: oldestUser.id } });
      if (!ownedSettings) {
        await prisma.minerSetting.updateMany({ where: { userId: null }, data: { userId: oldestUser.id } });
        if (orphanCounts[0] > 0) adopted.push('settings');
      }
    } catch (err) {
      console.warn('Legacy settings adoption skipped:', err);
    }
    try {
      await prisma.logRecord.updateMany({ where: { userId: null }, data: { userId: oldestUser.id } });
      if (orphanCounts[2] > 0) adopted.push('logs');
    } catch (err) {
      console.warn('Legacy log adoption skipped:', err);
    }
    try {
      await prisma.statisticalRecord.updateMany({ where: { userId: null }, data: { userId: oldestUser.id } });
      if (orphanCounts[3] > 0) adopted.push('statistics');
    } catch (err) {
      console.warn('Legacy statistics adoption skipped:', err);
    }
    try {
      await prisma.streamer.updateMany({ where: { userId: null }, data: { userId: oldestUser.id } });
      if (orphanCounts[1] > 0) adopted.push('streamers');
    } catch (err) {
      console.warn('Legacy streamer adoption skipped:', err);
    }
    if (adopted.length > 0) {
      console.warn(`Adopted legacy rows (${adopted.join(', ')}) without owner into ${oldestUser.email}.`);
    }
  }

  subscribeSSE(send: (data: string) => void, userId?: string): () => void {
    const client: SSEClient = { id: this.nextClientId++, userId, send };
    this.sseClients.push(client);
    send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));

    return () => {
      this.sseClients = this.sseClients.filter(c => c.id !== client.id);
    };
  }

  private deliverSSE(workerUserId: string, event: string, payload: unknown) {
    const forClient = (client: SSEClient): string => {
      if (event === 'streamers' && Array.isArray(payload)) {
        const visible = (payload as Array<{ userId?: string }>).filter(s => !client.userId || !s.userId || s.userId === client.userId);
        return `event: ${event}\ndata: ${JSON.stringify(visible)}\n\n`;
      }
      return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    };
    for (const client of this.sseClients) {
      if (client.userId !== workerUserId) continue;
      try {
        client.send(forClient(client));
      } catch {
        void 0;
      }
    }
  }

  getStatus(userId?: string): MinerStatus {
    const isDev = process.env.NODE_ENV === 'development';
    const zeroed: MinerStatus = {
      state: 'running',
      uptimeSeconds: 0,
      totalPointsMined: 0,
      pointsToday: 0,
      pointsThisHour: 0,
      activeSlots: [],
      activeSlotsLimit: 2,
      totalClaims: 0,
      totalRaids: 0,
      totalPredictionsPlaced: 0,
      totalPredictionsWon: 0,
      netPredictionPoints: 0,
      totalDropsClaimed: 0,
      lastActionTimestamp: new Date().toISOString(),
      isSimulation: isDev
    };
    if (!userId) return zeroed;
    const worker = this.workers.get(userId);
    if (!worker) return zeroed;
    return worker.getStatus();
  }

  getSettings(userId: string): MinerSettings & { hasAuthToken: boolean } {
    const worker = this.workers.get(userId);
    if (!worker) {
      const isDev = process.env.NODE_ENV === 'development';
      return {
        authToken: '',
        clientId: 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        isSimulationMode: isDev,
        maxConcurrentStreams: 2,
        priorityMode: 'points_asc',
        autoClaimBonus: true,
        claimDelaySeconds: 4,
        followRaids: true,
        autoClaimDrops: true,
        autoBetPredictions: true,
        predictionStrategy: 'smart_ratio',
        maxBetPoints: 100,
        checkIntervalSeconds: 3,
        hasAuthToken: false
      };
    }
    return worker.getSettings();
  }

  async updateSettings(patch: Partial<MinerSettings>, userId: string): Promise<MinerSettings & { hasAuthToken: boolean }> {
    const worker = this.ensureWorker(userId);
    const updated = await worker.updateSettings(patch);
    if (patch.authToken === '') {
      this.disposeWorker(userId);
    }
    return updated;
  }

  async validateStoredAuthToken(userId: string): Promise<{ login: string; userId: string } | null> {
    return this.ensureWorker(userId).validateStoredAuthToken();
  }

  addLog(level: LogLevel, channel: string | undefined, message: string, userId: string): void {
    this.ensureWorker(userId).addLog(level, channel, message);
  }

  getActiveConnections(userId: string): Record<string, unknown> {
    const worker = this.workers.get(userId);
    if (!worker) return {};
    return worker.getActiveConnections();
  }

  startMiner(userId: string): void {
    this.ensureWorker(userId).startMiner();
  }

  pauseMiner(userId: string): void {
    this.ensureWorker(userId).pauseMiner();
  }

  stopMiner(userId: string): void {
    this.ensureWorker(userId).stopMiner();
  }

  async triggerTestClaim(channelName: string | undefined, userId: string): Promise<unknown> {
    return this.ensureWorker(userId).triggerTestClaim(channelName);
  }

  getStreamers(userId: string): Streamer[] {
    const worker = this.workers.get(userId);
    if (!worker) return [];
    return worker.getStreamers();
  }

  async addStreamer(username: string, displayName: string, userId: string): Promise<Streamer> {
    return this.ensureWorker(userId).addStreamer(username, displayName, userId);
  }

  async removeStreamer(username: string, userId: string): Promise<boolean> {
    return this.ensureWorker(userId).removeStreamer(username);
  }

  async updateStreamer(username: string, patch: unknown, userId: string): Promise<Streamer | null> {
    return this.ensureWorker(userId).updateStreamer(username, patch);
  }

  async getLiveStats(username: string, userId: string): Promise<unknown> {
    return this.ensureWorker(userId).getLiveStats(username);
  }

  async toggleStreamerLive(username: string, forceLive: boolean | undefined, userId: string): Promise<Streamer | null> {
    return this.ensureWorker(userId).toggleStreamerLive(username, forceLive);
  }

  getStreamerChat(username: string, userId: string): ChatMessage[] {
    const worker = this.workers.get(userId);
    if (!worker) return [];
    return worker.getStreamerChat(username);
  }

  handleUserChatMessage(channel: string, text: string, senderName: string, userId: string): ChatMessage {
    return this.ensureWorker(userId).handleUserChatMessage(channel, text, senderName);
  }

  async refreshAllLiveStats(userId: string): Promise<Streamer[]> {
    return this.ensureWorker(userId).refreshAllLiveStats();
  }

  getLogs(limit: number, level: string | undefined, search: string | undefined, userId: string): LogEntry[] {
    const worker = this.workers.get(userId);
    if (!worker) return [];
    return worker.getLogs(limit, level, search);
  }

  async clearLogs(userId: string): Promise<void> {
    await this.ensureWorker(userId).clearLogs();
  }

  async getStatisticalRecords(userId: string): Promise<StatisticalRecord[]> {
    return this.ensureWorker(userId).getStatisticalRecords();
  }

  async recordStatisticalData(data: unknown, userId: string): Promise<void> {
    await this.ensureWorker(userId).recordStatisticalData(data);
  }

  async getAnalytics(userId: string): Promise<AnalyticsData> {
    return this.ensureWorker(userId).getAnalytics();
  }

  destroy(): void {
    for (const userId of [...this.workers.keys()]) {
      this.disposeWorker(userId);
    }
  }
}

export const minerEngine = new MinerEngine();