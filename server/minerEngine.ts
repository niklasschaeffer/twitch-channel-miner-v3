import {
  Streamer,
  MinerSettings,
  MinerStatus,
  LogEntry,
  AnalyticsData,
  PriorityMode,
  LogLevel,
  StatisticalRecord
} from '../src/types.js';
import { prisma } from './db.js';

interface SSEClient {
  id: number;
  send: (data: string) => void;
}

export class MinerEngine {
  private status: MinerStatus;
  private settings: MinerSettings;
  private streamers: Streamer[] = [];
  private logs: LogEntry[] = [];
  private sseClients: SSEClient[] = [];
  private timer: NodeJS.Timeout | null = null;
  private nextClientId = 1;
  private initialized = false;

  constructor() {
    this.settings = {
      authToken: '',
      clientId: 'kimne78kx3ncx6brgo4mv6wki5h1ko',
      isSimulationMode: true,
      maxConcurrentStreams: 2,
      priorityMode: 'points_asc',
      autoClaimBonus: true,
      claimDelaySeconds: 4,
      followRaids: true,
      autoClaimDrops: true,
      autoBetPredictions: true,
      predictionStrategy: 'smart_ratio',
      maxBetPoints: 100,
      checkIntervalSeconds: 3
    };

    this.status = {
      state: 'running',
      uptimeSeconds: 1420,
      totalPointsMined: 7340,
      pointsToday: 2450,
      pointsThisHour: 320,
      activeSlots: ['tarik', 'shroud'],
      activeSlotsLimit: 2,
      totalClaims: 48,
      totalRaids: 3,
      totalPredictionsPlaced: 8,
      totalPredictionsWon: 6,
      netPredictionPoints: 850,
      totalDropsClaimed: 2,
      lastActionTimestamp: new Date().toISOString(),
      isSimulation: true
    };

    // Load or seed from Prisma SQLite
    this.initDatabase().then(() => {
      this.startLoop();
    });
  }

  private async initDatabase() {
    try {
      // 1. Load Settings from SQLite via Prisma
      const savedSettings = await prisma.minerSetting.findFirst();
      if (savedSettings) {
        this.settings = {
          authToken: savedSettings.authToken,
          clientId: savedSettings.clientId,
          isSimulationMode: savedSettings.isSimulationMode,
          maxConcurrentStreams: savedSettings.maxConcurrentStreams,
          priorityMode: (savedSettings.priorityMode as PriorityMode) || 'points_asc',
          autoClaimBonus: savedSettings.autoClaimBonus,
          claimDelaySeconds: savedSettings.claimDelaySeconds,
          followRaids: savedSettings.followRaids,
          autoClaimDrops: savedSettings.autoClaimDrops,
          autoBetPredictions: savedSettings.autoBetPredictions,
          predictionStrategy: savedSettings.predictionStrategy as any,
          maxBetPoints: savedSettings.maxBetPoints,
          checkIntervalSeconds: savedSettings.checkIntervalSeconds
        };
      }

      // 2. Load Streamers from SQLite via Prisma
      const dbStreamers = await prisma.streamer.findMany({
        orderBy: { priority: 'asc' }
      });

      if (dbStreamers.length > 0) {
        this.streamers = dbStreamers.map(s => ({
          id: s.id,
          username: s.username,
          displayName: s.displayName,
          avatar: s.avatar,
          isLive: s.isLive,
          game: s.game,
          viewerCount: s.viewerCount,
          points: s.points,
          watchStreak: s.watchStreak,
          isMining: s.isMining,
          priority: s.priority,
          enabled: s.enabled,
          chestAvailable: s.chestAvailable,
          nextChestEstimateSeconds: s.nextChestEstimateSeconds,
          totalPointsMined: s.totalPointsMined,
          lastClaimTime: s.lastClaimTime || undefined,
          uptimeMinutes: s.uptimeMinutes
        }));
      } else {
        // Seed default streamers in dev
        await this.seedDefaultData();
      }

      // 3. Load Logs from SQLite
      const dbLogs = await prisma.logRecord.findMany({
        take: 100,
        orderBy: { timestamp: 'desc' }
      });

      if (dbLogs.length > 0) {
        this.logs = dbLogs.map(l => ({
          id: l.id,
          timestamp: l.timestamp.toISOString(),
          level: l.level as LogLevel,
          channel: l.channel || undefined,
          message: l.message,
          pointsDelta: l.pointsDelta || undefined
        }));
      }

      // 4. Calculate total points mined from statistical records
      const statRecords = await prisma.statisticalRecord.findMany();
      if (statRecords.length > 0) {
        const totalMined = statRecords.reduce((sum, r) => sum + r.pointsMined, 0);
        const totalClaims = statRecords.reduce((sum, r) => sum + r.claimsCount, 0);
        const totalRaids = statRecords.reduce((sum, r) => sum + r.raidsCount, 0);
        const totalPreds = statRecords.reduce((sum, r) => sum + r.predictionsWon, 0);
        const netPreds = statRecords.reduce((sum, r) => sum + r.netPredictionPoints, 0);
        const drops = statRecords.reduce((sum, r) => sum + r.dropsCount, 0);

        this.status.totalPointsMined = Math.max(this.status.totalPointsMined, totalMined);
        this.status.totalClaims = Math.max(this.status.totalClaims, totalClaims);
        this.status.totalRaids = Math.max(this.status.totalRaids, totalRaids);
        this.status.totalPredictionsWon = Math.max(this.status.totalPredictionsWon, totalPreds);
        this.status.netPredictionPoints = Math.max(this.status.netPredictionPoints, netPreds);
        this.status.totalDropsClaimed = Math.max(this.status.totalDropsClaimed, drops);
      }

      this.initialized = true;
      console.log(`MinerEngine initialized with Prisma SQLite: ${this.streamers.length} streamers loaded.`);
    } catch (err) {
      console.error('Failed to initialize MinerEngine from Prisma SQLite:', err);
    }
  }

  private async seedDefaultData() {
    const defaults = [
      {
        username: 'tarik',
        displayName: 'tarik',
        avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
        isLive: true,
        game: 'VALORANT',
        viewerCount: 28410,
        points: 14850,
        watchStreak: 5,
        isMining: true,
        priority: 1,
        enabled: true,
        chestAvailable: false,
        nextChestEstimateSeconds: 42,
        totalPointsMined: 3200,
        lastClaimTime: new Date(Date.now() - 14 * 60000).toISOString(),
        uptimeMinutes: 340
      },
      {
        username: 'shroud',
        displayName: 'shroud',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        isLive: true,
        game: 'Counter-Strike 2',
        viewerCount: 19820,
        points: 11200,
        watchStreak: 3,
        isMining: true,
        priority: 2,
        enabled: true,
        chestAvailable: true,
        nextChestEstimateSeconds: 0,
        totalPointsMined: 2450,
        lastClaimTime: new Date(Date.now() - 15 * 60000).toISOString(),
        uptimeMinutes: 215
      },
      {
        username: 'xqcow',
        displayName: 'xQc',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
        isLive: true,
        game: 'Just Chatting',
        viewerCount: 42100,
        points: 24900,
        watchStreak: 12,
        isMining: false,
        priority: 3,
        enabled: true,
        chestAvailable: false,
        nextChestEstimateSeconds: 480,
        totalPointsMined: 950,
        lastClaimTime: new Date(Date.now() - 40 * 60000).toISOString(),
        uptimeMinutes: 520
      },
      {
        username: 'pokimane',
        displayName: 'pokimane',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        isLive: false,
        game: 'Just Chatting',
        viewerCount: 0,
        points: 8450,
        watchStreak: 1,
        isMining: false,
        priority: 4,
        enabled: true,
        chestAvailable: false,
        nextChestEstimateSeconds: 900,
        totalPointsMined: 400,
        uptimeMinutes: 0
      },
      {
        username: 'caedrel',
        displayName: 'Caedrel',
        avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&auto=format&fit=crop&q=80',
        isLive: true,
        game: 'League of Legends',
        viewerCount: 31250,
        points: 6200,
        watchStreak: 7,
        isMining: false,
        priority: 5,
        enabled: true,
        chestAvailable: false,
        nextChestEstimateSeconds: 310,
        totalPointsMined: 340,
        lastClaimTime: new Date(Date.now() - 65 * 60000).toISOString(),
        uptimeMinutes: 190
      },
      {
        username: 'fps_shaka',
        displayName: 'fps_shaka',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        isLive: false,
        game: 'Apex Legends',
        viewerCount: 0,
        points: 15300,
        watchStreak: 0,
        isMining: false,
        priority: 6,
        enabled: false,
        chestAvailable: false,
        nextChestEstimateSeconds: 900,
        totalPointsMined: 0,
        uptimeMinutes: 0
      }
    ];

    for (const d of defaults) {
      const created = await prisma.streamer.upsert({
        where: { username: d.username },
        update: {},
        create: d
      });
      this.streamers.push({
        id: created.id,
        username: created.username,
        displayName: created.displayName,
        avatar: created.avatar,
        isLive: created.isLive,
        game: created.game,
        viewerCount: created.viewerCount,
        points: created.points,
        watchStreak: created.watchStreak,
        isMining: created.isMining,
        priority: created.priority,
        enabled: created.enabled,
        chestAvailable: created.chestAvailable,
        nextChestEstimateSeconds: created.nextChestEstimateSeconds,
        totalPointsMined: created.totalPointsMined,
        lastClaimTime: created.lastClaimTime || undefined,
        uptimeMinutes: created.uptimeMinutes
      });
    }
  }

  public subscribeSSE(send: (data: string) => void): () => void {
    const client: SSEClient = { id: this.nextClientId++, send };
    this.sseClients.push(client);
    send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));

    return () => {
      this.sseClients = this.sseClients.filter(c => c.id !== client.id);
    };
  }

  private broadcastSSE(event: string, payload: any) {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.send(message);
      } catch (err) {
        // Ignored
      }
    }
  }

  public async addLog(level: LogLevel, channel: string | undefined, message: string, pointsDelta?: number) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      channel,
      message,
      pointsDelta
    };
    this.logs.unshift(entry);
    if (this.logs.length > 500) {
      this.logs.pop();
    }
    this.broadcastSSE('log', entry);

    // Persist to Prisma SQLite
    try {
      await prisma.logRecord.create({
        data: {
          level,
          channel,
          message,
          pointsDelta: pointsDelta ?? null
        }
      });
    } catch (e) {
      // Ignored non-fatal
    }
  }

  private startLoop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tick();
    }, 2000);
  }

  private tick() {
    if (this.status.state !== 'running') return;

    this.status.uptimeSeconds += 2;
    this.status.lastActionTimestamp = new Date().toISOString();

    // Rebalance active slots based on priority
    this.rebalanceActiveSlots();

    // Process chest countdowns for active mining channels
    for (const s of this.streamers) {
      if (s.isMining && s.isLive && s.enabled) {
        if (s.nextChestEstimateSeconds > 0) {
          s.nextChestEstimateSeconds = Math.max(0, s.nextChestEstimateSeconds - 2);
          if (s.nextChestEstimateSeconds === 0) {
            s.chestAvailable = true;
            this.addLog('INFO', s.username, `Bonus chest became ready (+50 pts) for ${s.displayName}.`);
          }
        }

        if (s.chestAvailable && this.settings.autoClaimBonus) {
          this.executeClaimBonus(s);
        }
      }
    }

    // Simulate events (heartbeats, raids, predictions, drops)
    this.maybeSimulateEvent();

    this.broadcastSSE('status', this.getStatus());
  }

  private rebalanceActiveSlots() {
    const sorted = [...this.streamers].filter(s => s.enabled);
    if (this.settings.priorityMode === 'points_asc') {
      sorted.sort((a, b) => a.points - b.points);
    } else if (this.settings.priorityMode === 'points_desc') {
      sorted.sort((a, b) => b.points - a.points);
    } else if (this.settings.priorityMode === 'streak') {
      sorted.sort((a, b) => b.watchStreak - a.watchStreak);
    } else {
      sorted.sort((a, b) => a.priority - b.priority);
    }

    const targetMining: string[] = [];
    for (const s of sorted) {
      if (s.isLive && targetMining.length < this.settings.maxConcurrentStreams) {
        targetMining.push(s.username);
      }
    }

    let slotsChanged = false;
    for (const s of this.streamers) {
      const shouldMine = targetMining.includes(s.username);
      if (s.isMining !== shouldMine) {
        s.isMining = shouldMine;
        slotsChanged = true;
        if (shouldMine) {
          this.addLog('WATCH', s.username, `Assigned watch slot to ${s.displayName} (${s.game}).`);
        } else if (s.isLive) {
          this.addLog('INFO', s.username, `Released watch slot for ${s.displayName} based on priority queue.`);
        }
        // Update in SQLite
        prisma.streamer.update({
          where: { username: s.username },
          data: { isMining: shouldMine }
        }).catch(() => {});
      }
    }

    this.status.activeSlots = targetMining;
    if (slotsChanged) {
      this.broadcastSSE('streamers', this.streamers);
    }
  }

  public async executeClaimBonus(streamer: Streamer) {
    streamer.chestAvailable = false;
    streamer.nextChestEstimateSeconds = 900;
    streamer.points += 50;
    streamer.totalPointsMined += 50;
    streamer.lastClaimTime = new Date().toISOString();

    this.status.totalPointsMined += 50;
    this.status.pointsToday += 50;
    this.status.pointsThisHour += 50;
    this.status.totalClaims += 1;

    // Record statistical record in Prisma SQLite
    await this.recordStatisticalData({
      pointsMined: 50,
      claimsCount: 1,
      chestsPoints: 50
    });

    // Update Streamer in Prisma SQLite
    try {
      await prisma.streamer.update({
        where: { username: streamer.username },
        data: {
          points: streamer.points,
          totalPointsMined: streamer.totalPointsMined,
          lastClaimTime: streamer.lastClaimTime,
          chestAvailable: false,
          nextChestEstimateSeconds: 900
        }
      });
    } catch (e) {
      // Ignored
    }

    this.addLog(
      'CLAIM',
      streamer.username,
      `Successfully claimed Community Points Bonus (+50 pts) for ${streamer.displayName}! Total balance: ${streamer.points.toLocaleString()} pts.`,
      50
    );

    this.broadcastSSE('streamers', this.streamers);
  }

  private maybeSimulateEvent() {
    // 1. Heartbeat watch time (+10 pts)
    if (Math.random() < 0.08) {
      const active = this.streamers.filter(s => s.isMining && s.isLive);
      if (active.length > 0) {
        const chosen = active[Math.floor(Math.random() * active.length)];
        const pts = 10;
        chosen.points += pts;
        chosen.totalPointsMined += pts;
        this.status.totalPointsMined += pts;
        this.status.pointsToday += pts;
        this.status.pointsThisHour += pts;

        this.recordStatisticalData({
          pointsMined: pts,
          watchTimePoints: pts
        });

        prisma.streamer.update({
          where: { username: chosen.username },
          data: {
            points: chosen.points,
            totalPointsMined: chosen.totalPointsMined
          }
        }).catch(() => {});

        this.addLog(
          'WATCH',
          chosen.username,
          `Heartbeat watch credit (+${pts} pts) received for ${chosen.displayName}.`,
          pts
        );
      }
    }

    // 2. Raid event (+250 pts)
    if (this.settings.followRaids && Math.random() < 0.015) {
      const active = this.streamers.filter(s => s.isMining && s.isLive);
      if (active.length > 0) {
        const chosen = active[Math.floor(Math.random() * active.length)];
        const raidBonus = 250;
        chosen.points += raidBonus;
        chosen.totalPointsMined += raidBonus;
        this.status.totalPointsMined += raidBonus;
        this.status.pointsToday += raidBonus;
        this.status.totalRaids += 1;

        this.recordStatisticalData({
          pointsMined: raidBonus,
          raidsCount: 1
        });

        prisma.streamer.update({
          where: { username: chosen.username },
          data: {
            points: chosen.points,
            totalPointsMined: chosen.totalPointsMined
          }
        }).catch(() => {});

        this.addLog(
          'RAID',
          chosen.username,
          `Raid detected on ${chosen.displayName}'s channel! Joined raid and claimed +${raidBonus} points.`,
          raidBonus
        );
      }
    }

    // 3. Predictions (+net)
    if (this.settings.autoBetPredictions && Math.random() < 0.012) {
      const active = this.streamers.filter(s => s.isMining && s.isLive);
      if (active.length > 0) {
        const chosen = active[Math.floor(Math.random() * active.length)];
        const betAmount = Math.min(this.settings.maxBetPoints, 100);
        const won = Math.random() > 0.35;
        this.status.totalPredictionsPlaced += 1;

        if (won) {
          const winPoints = Math.floor(betAmount * 1.8);
          const net = winPoints - betAmount;
          chosen.points += net;
          chosen.totalPointsMined += net;
          this.status.totalPointsMined += net;
          this.status.totalPredictionsWon += 1;
          this.status.netPredictionPoints += net;

          this.recordStatisticalData({
            pointsMined: net,
            predictionsWon: 1,
            netPredictionPoints: net
          });

          prisma.streamer.update({
            where: { username: chosen.username },
            data: {
              points: chosen.points,
              totalPointsMined: chosen.totalPointsMined
            }
          }).catch(() => {});

          this.addLog(
            'PREDICTION',
            chosen.username,
            `Prediction resolved WON on ${chosen.displayName}! Strategy [${this.settings.predictionStrategy}] returned +${winPoints} pts (+${net} net profit).`,
            net
          );
        } else {
          chosen.points = Math.max(0, chosen.points - betAmount);
          this.status.netPredictionPoints -= betAmount;

          this.recordStatisticalData({
            predictionsLost: 1,
            netPredictionPoints: -betAmount
          });

          this.addLog(
            'PREDICTION',
            chosen.username,
            `Prediction resolved lost on ${chosen.displayName}. Lost ${betAmount} pts. Strategy risk within limits.`,
            -betAmount
          );
        }
      }
    }

    // 4. Drops Claimed
    if (this.settings.autoClaimDrops && Math.random() < 0.008) {
      const active = this.streamers.filter(s => s.isMining && s.isLive);
      if (active.length > 0) {
        const chosen = active[Math.floor(Math.random() * active.length)];
        this.status.totalDropsClaimed += 1;

        this.recordStatisticalData({
          dropsCount: 1
        });

        this.addLog(
          'DROP',
          chosen.username,
          `Twitch Drop Campaign reward reached 100% for ${chosen.game}! Auto-claimed to Twitch Inventory.`
        );
      }
    }
  }

  public async recordStatisticalData(data: {
    pointsMined?: number;
    claimsCount?: number;
    raidsCount?: number;
    predictionsWon?: number;
    predictionsLost?: number;
    netPredictionPoints?: number;
    dropsCount?: number;
    chestsPoints?: number;
    watchTimePoints?: number;
  }) {
    const hourKey = new Date().getHours().toString().padStart(2, '0') + ':00';
    try {
      await prisma.statisticalRecord.create({
        data: {
          hourKey,
          pointsMined: data.pointsMined ?? 0,
          claimsCount: data.claimsCount ?? 0,
          raidsCount: data.raidsCount ?? 0,
          predictionsWon: data.predictionsWon ?? 0,
          predictionsLost: data.predictionsLost ?? 0,
          netPredictionPoints: data.netPredictionPoints ?? 0,
          dropsCount: data.dropsCount ?? 0,
          chestsPoints: data.chestsPoints ?? 0,
          watchTimePoints: data.watchTimePoints ?? 0
        }
      });
    } catch (err) {
      console.error('Failed to store statistical record in Prisma SQLite:', err);
    }
  }

  // API Methods
  public getStatus(): MinerStatus {
    return { ...this.status };
  }

  public getSettings(): MinerSettings {
    return { ...this.settings };
  }

  public async updateSettings(newSettings: Partial<MinerSettings>): Promise<MinerSettings> {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.priorityMode) {
      this.rebalanceActiveSlots();
    }
    this.addLog('INFO', undefined, 'Miner configuration settings updated.');

    // Save to Prisma SQLite
    try {
      const existing = await prisma.minerSetting.findFirst();
      if (existing) {
        await prisma.minerSetting.update({
          where: { id: existing.id },
          data: {
            authToken: this.settings.authToken,
            clientId: this.settings.clientId,
            isSimulationMode: this.settings.isSimulationMode,
            maxConcurrentStreams: this.settings.maxConcurrentStreams,
            priorityMode: this.settings.priorityMode,
            autoClaimBonus: this.settings.autoClaimBonus,
            claimDelaySeconds: this.settings.claimDelaySeconds,
            followRaids: this.settings.followRaids,
            autoClaimDrops: this.settings.autoClaimDrops,
            autoBetPredictions: this.settings.autoBetPredictions,
            predictionStrategy: this.settings.predictionStrategy,
            maxBetPoints: this.settings.maxBetPoints,
            checkIntervalSeconds: this.settings.checkIntervalSeconds
          }
        });
      } else {
        await prisma.minerSetting.create({
          data: {
            authToken: this.settings.authToken,
            clientId: this.settings.clientId,
            isSimulationMode: this.settings.isSimulationMode,
            maxConcurrentStreams: this.settings.maxConcurrentStreams,
            priorityMode: this.settings.priorityMode,
            autoClaimBonus: this.settings.autoClaimBonus,
            claimDelaySeconds: this.settings.claimDelaySeconds,
            followRaids: this.settings.followRaids,
            autoClaimDrops: this.settings.autoClaimDrops,
            autoBetPredictions: this.settings.autoBetPredictions,
            predictionStrategy: this.settings.predictionStrategy,
            maxBetPoints: this.settings.maxBetPoints,
            checkIntervalSeconds: this.settings.checkIntervalSeconds
          }
        });
      }
    } catch (err) {
      console.error('Failed to save miner settings to Prisma SQLite:', err);
    }

    this.broadcastSSE('settings', this.settings);
    return this.settings;
  }

  public getStreamers(): Streamer[] {
    return [...this.streamers];
  }

  public async addStreamer(username: string, displayName?: string): Promise<Streamer> {
    const cleanUsername = username.trim().toLowerCase();
    const existing = this.streamers.find(s => s.username === cleanUsername);
    if (existing) {
      return existing;
    }

    const newStreamerData = {
      username: cleanUsername,
      displayName: displayName || cleanUsername,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanUsername}`,
      isLive: true,
      game: 'Variety Stream',
      viewerCount: Math.floor(1200 + Math.random() * 8000),
      points: Math.floor(1000 + Math.random() * 9000),
      watchStreak: Math.floor(Math.random() * 4),
      isMining: false,
      priority: this.streamers.length + 1,
      enabled: true,
      chestAvailable: false,
      nextChestEstimateSeconds: 850,
      totalPointsMined: 0,
      uptimeMinutes: 45
    };

    // Store in SQLite database via Prisma ORM engine
    const savedInDb = await prisma.streamer.upsert({
      where: { username: cleanUsername },
      update: {},
      create: newStreamerData
    });

    const streamer: Streamer = {
      id: savedInDb.id,
      username: savedInDb.username,
      displayName: savedInDb.displayName,
      avatar: savedInDb.avatar,
      isLive: savedInDb.isLive,
      game: savedInDb.game,
      viewerCount: savedInDb.viewerCount,
      points: savedInDb.points,
      watchStreak: savedInDb.watchStreak,
      isMining: savedInDb.isMining,
      priority: savedInDb.priority,
      enabled: savedInDb.enabled,
      chestAvailable: savedInDb.chestAvailable,
      nextChestEstimateSeconds: savedInDb.nextChestEstimateSeconds,
      totalPointsMined: savedInDb.totalPointsMined,
      lastClaimTime: savedInDb.lastClaimTime || undefined,
      uptimeMinutes: savedInDb.uptimeMinutes
    };

    this.streamers.push(streamer);
    this.addLog('INFO', cleanUsername, `Added streamer ${streamer.displayName} to mining watchlist (stored in SQLite via Prisma).`);
    this.rebalanceActiveSlots();
    this.broadcastSSE('streamers', this.streamers);
    return streamer;
  }

  public async removeStreamer(username: string): Promise<boolean> {
    const clean = username.toLowerCase();
    const index = this.streamers.findIndex(s => s.username === clean);
    if (index !== -1) {
      const removed = this.streamers.splice(index, 1)[0];
      // Remove from SQLite database via Prisma ORM engine
      try {
        await prisma.streamer.delete({
          where: { username: clean }
        });
      } catch (err) {
        console.error('Failed to delete streamer from Prisma SQLite:', err);
      }

      this.addLog('INFO', username, `Removed streamer ${removed.displayName} from mining watchlist.`);
      this.rebalanceActiveSlots();
      this.broadcastSSE('streamers', this.streamers);
      return true;
    }
    return false;
  }

  public async updateStreamer(username: string, updates: Partial<Streamer>): Promise<Streamer | null> {
    const s = this.streamers.find(item => item.username === username.toLowerCase());
    if (!s) return null;
    Object.assign(s, updates);

    // Persist changes in Prisma SQLite
    try {
      await prisma.streamer.update({
        where: { username: s.username },
        data: {
          points: updates.points !== undefined ? updates.points : undefined,
          priority: updates.priority !== undefined ? updates.priority : undefined,
          enabled: updates.enabled !== undefined ? updates.enabled : undefined,
          isMining: updates.isMining !== undefined ? updates.isMining : undefined
        }
      });
    } catch (e) {
      // Ignored
    }

    this.rebalanceActiveSlots();
    this.broadcastSSE('streamers', this.streamers);
    return s;
  }

  public startMiner() {
    this.status.state = 'running';
    this.addLog('SUCCESS', undefined, 'Miner engine started. Monitoring channels and priority queues.');
    this.rebalanceActiveSlots();
    this.broadcastSSE('status', this.getStatus());
  }

  public pauseMiner() {
    this.status.state = 'paused';
    for (const s of this.streamers) {
      s.isMining = false;
    }
    this.status.activeSlots = [];
    this.addLog('WARN', undefined, 'Miner engine paused. Watch time and bonus claim tasks suspended.');
    this.broadcastSSE('status', this.getStatus());
    this.broadcastSSE('streamers', this.streamers);
  }

  public stopMiner() {
    this.status.state = 'stopped';
    for (const s of this.streamers) {
      s.isMining = false;
    }
    this.status.activeSlots = [];
    this.addLog('WARN', undefined, 'Miner engine stopped.');
    this.broadcastSSE('status', this.getStatus());
    this.broadcastSSE('streamers', this.streamers);
  }

  public triggerTestClaim(channelUsername?: string) {
    let target = this.streamers.find(s => s.isMining && s.isLive);
    if (channelUsername) {
      target = this.streamers.find(s => s.username === channelUsername.toLowerCase());
    }
    if (!target) {
      target = this.streamers[0];
    }
    if (target) {
      this.executeClaimBonus(target);
      return { success: true, channel: target.displayName, points: 50 };
    }
    return { success: false, message: 'No available channel to claim' };
  }

  public getLogs(limit = 100, level?: string, search?: string): LogEntry[] {
    let result = [...this.logs];
    if (level && level !== 'ALL') {
      result = result.filter(l => l.level === level);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        l => l.message.toLowerCase().includes(q) || (l.channel && l.channel.toLowerCase().includes(q))
      );
    }
    return result.slice(0, limit);
  }

  public async clearLogs() {
    this.logs = [];
    try {
      await prisma.logRecord.deleteMany();
    } catch (e) {
      // Ignored
    }
    this.addLog('INFO', undefined, 'Log history cleared by user.');
    return { success: true };
  }

  public async getStatisticalRecords(): Promise<StatisticalRecord[]> {
    const records = await prisma.statisticalRecord.findMany({
      orderBy: { recordedAt: 'asc' }
    });
    return records.map(r => ({
      id: r.id,
      userId: r.userId,
      hourKey: r.hourKey,
      pointsMined: r.pointsMined,
      claimsCount: r.claimsCount,
      raidsCount: r.raidsCount,
      predictionsWon: r.predictionsWon,
      predictionsLost: r.predictionsLost,
      netPredictionPoints: r.netPredictionPoints,
      dropsCount: r.dropsCount,
      chestsPoints: r.chestsPoints,
      watchTimePoints: r.watchTimePoints,
      recordedAt: r.recordedAt.toISOString()
    }));
  }

  public async getAnalytics(): Promise<AnalyticsData> {
    // Read actual statistical records from SQLite via Prisma
    const records = await prisma.statisticalRecord.findMany({
      orderBy: { recordedAt: 'asc' }
    });

    // Group by hourKey
    const hourlyMap = new Map<string, { points: number; claims: number }>();
    let totalChests = 0;
    let totalWatch = 0;
    let totalRaids = 0;
    let totalPreds = 0;
    let totalDrops = 0;

    for (const r of records) {
      const existing = hourlyMap.get(r.hourKey) || { points: 0, claims: 0 };
      existing.points += r.pointsMined;
      existing.claims += r.claimsCount;
      hourlyMap.set(r.hourKey, existing);

      totalChests += r.chestsPoints;
      totalWatch += r.watchTimePoints;
      totalRaids += r.raidsCount * 250;
      totalPreds += r.netPredictionPoints;
      totalDrops += r.dropsCount * 100;
    }

    // Default fallbacks if empty
    if (hourlyMap.size === 0) {
      const now = new Date();
      for (let i = 8; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 3600000);
        const hourStr = d.getHours().toString().padStart(2, '0') + ':00';
        hourlyMap.set(hourStr, { points: 200, claims: 4 });
      }
      totalChests = 3250;
      totalWatch = 1840;
      totalRaids = 750;
      totalPreds = 1200;
      totalDrops = 300;
    }

    const hourlyHistory = Array.from(hourlyMap.entries()).map(([time, data]) => ({
      time,
      points: data.points,
      claims: data.claims
    }));

    const colors = ['#9146FF', '#00F593', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6'];
    const totalPointsAll = Math.max(1, this.streamers.reduce((acc, s) => acc + s.points, 0));

    const channelDistribution = this.streamers.map((s, idx) => ({
      channel: s.displayName,
      points: s.points,
      percentage: Math.round((s.points / totalPointsAll) * 100),
      color: colors[idx % colors.length]
    }));

    const categoryBreakdown = [
      { name: 'Community Chests (+50)', value: totalChests, points: totalChests, color: '#9146FF' },
      { name: 'Watch Time Heartbeats', value: totalWatch, points: totalWatch, color: '#00F593' },
      { name: 'Raid Bonuses (+250)', value: totalRaids, points: totalRaids, color: '#F59E0B' },
      { name: 'Predictions & Betting', value: Math.max(0, totalPreds), points: totalPreds, color: '#3B82F6' },
      { name: 'Drops Claimed', value: totalDrops, points: totalDrops, color: '#EC4899' }
    ];

    return {
      hourlyHistory,
      channelDistribution,
      categoryBreakdown,
      summary: {
        totalBonusChestPoints: totalChests,
        totalWatchTimePoints: totalWatch,
        totalRaidPoints: totalRaids,
        totalPredictionPoints: totalPreds,
        totalDropPoints: totalDrops
      }
    };
  }
}

export const minerEngine = new MinerEngine();
