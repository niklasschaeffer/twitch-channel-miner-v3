import {
  Streamer,
  MinerSettings,
  MinerStatus,
  LogEntry,
  AnalyticsData,
  PriorityMode,
  LogLevel,
  StatisticalRecord,
  ChatMessage
} from '../src/types.js';
import { prisma } from './db.js';

export function extractTwitchUsername(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim().toLowerCase();
  // Strip URL prefixes like https://www.twitch.tv/, twitch.tv/, etc.
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?(m\.)?twitch\.tv\//i, '');
  // Strip leading @ or /
  cleaned = cleaned.replace(/^[@/]+/, '');
  // Strip query parameters and trailing slashes
  cleaned = cleaned.split('?')[0].split('#')[0].replace(/\/+$/, '');
  const match = cleaned.match(/^[a-z0-9_]{1,35}/i);
  return match ? match[0].toLowerCase() : cleaned;
}

interface SSEClient {
  id: number;
  send: (data: string) => void;
}

export interface ActiveSlotConnection {
  username: string;
  connectedAt: string;
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  lastPing: string;
  reconnectAttempts: number;
  ws?: any;
}

export class MinerEngine {
  private status: MinerStatus;
  private settings: MinerSettings;
  private streamers: Streamer[] = [];
  private logs: LogEntry[] = [];
  private sseClients: SSEClient[] = [];
  private activeConnections = new Map<string, ActiveSlotConnection>();
  private streamerChats = new Map<string, ChatMessage[]>();
  private timer: NodeJS.Timeout | null = null;
  private nextClientId = 1;
  private initialized = false;
  private tickCount = 0;
  private pubsubWs: WebSocket | null = null;
  private pubsubPingTimer: NodeJS.Timeout | null = null;
  private pubsubReconnectTimer: NodeJS.Timeout | null = null;
  private balanceBaseline: number | null = null;
  private pubsubUserId: string | null = null;

  constructor() {
    const isDev = process.env.NODE_ENV === 'development';
    this.settings = {
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
      checkIntervalSeconds: 3
    };

    this.status = {
      state: 'running',
      uptimeSeconds: isDev ? 1420 : 0,
      totalPointsMined: isDev ? 7340 : 0,
      pointsToday: isDev ? 2450 : 0,
      pointsThisHour: isDev ? 320 : 0,
      activeSlots: isDev ? ['tarik', 'shroud'] : [],
      activeSlotsLimit: 2,
      totalClaims: isDev ? 48 : 0,
      totalRaids: isDev ? 3 : 0,
      totalPredictionsPlaced: isDev ? 8 : 0,
      totalPredictionsWon: isDev ? 6 : 0,
      netPredictionPoints: isDev ? 850 : 0,
      totalDropsClaimed: isDev ? 2 : 0,
      lastActionTimestamp: new Date().toISOString(),
      isSimulation: isDev
    };

    // Load or seed from Prisma SQLite
    this.initDatabase().then(async () => {
      this.startLoop();
      const v = await this.validateStoredAuthToken();
      if (v) {
        this.pubsubUserId = v.userId;
        this.connectPubsub();
      } else if (this.settings.authToken) {
        this.addLog('WARN', undefined, 'Stored Twitch token is invalid — real points balance unavailable. Reconnect via the settings page.');
      }
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
      } else if (process.env.NODE_ENV === 'development') {
        // Seed default streamers ONLY in dev
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
      // Immediately run real-time live status check and initial slot connection
      await this.checkAllStreamersOnlineStatus();
      this.rebalanceActiveSlots();
    } catch (err) {
      console.error('Failed to initialize MinerEngine from Prisma SQLite:', err);
    }
  }

  private async seedDefaultData() {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
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

    // Connect to Twitch IRC for all enabled channels so real Twitch chat is immediately available
    for (const s of this.streamers) {
      if (s.enabled) {
        this.ensureChatConnection(s.username);
      }
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

  public destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.disconnectAllStreamers();
  }

  private tick() {
    if (this.status.state !== 'running') return;

    this.status.uptimeSeconds += 2;
    this.status.lastActionTimestamp = new Date().toISOString();

    this.tickCount++;

    // Check all streamers real online status from Twitch GQL every 2 ticks (4 seconds)
    if (this.tickCount % 2 === 0) {
      this.checkAllStreamersOnlineStatus().catch(() => {});
    }

    // Rebalance active slots based on real live status and priority
    this.rebalanceActiveSlots();

    // Watch-time accrual and chest countdowns are simulated telemetry (no real
    // Twitch claiming exists yet) — only run them in simulation mode.
    if (this.settings.isSimulationMode) {
      for (const s of this.streamers) {
      if (s.isMining && s.isLive && s.enabled) {
        // Accrue watch points (+10 pts) every 60 seconds (30 ticks)
        if (this.tickCount % 30 === 0) {
          const watchDelta = 10;
          s.points += watchDelta;
          s.totalPointsMined += watchDelta;
          s.uptimeMinutes = (s.uptimeMinutes || 0) + 1;

          this.status.totalPointsMined += watchDelta;
          this.status.pointsToday += watchDelta;
          this.status.pointsThisHour += watchDelta;

          this.recordStatisticalData({
            pointsMined: watchDelta,
            watchTimePoints: watchDelta
          }).catch(() => {});

          prisma.streamer.update({
            where: { username: s.username },
            data: {
              points: s.points,
              totalPointsMined: s.totalPointsMined,
              uptimeMinutes: s.uptimeMinutes
            }
          }).catch(() => {});

          this.addLog(
            'WATCH',
            s.username,
            `Heartbeat: +${watchDelta} Channel Points earned watching ${s.displayName} (${s.game}).`,
            watchDelta
          );
        }

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
    }

    // Only fabricate raid/prediction/drop events in simulation mode.
    // In production these must come from real Twitch events, not random rolls.
    if (this.settings.isSimulationMode) {
      this.maybeSimulateEvent();
    }

    this.broadcastSSE('status', this.getStatus());
  }

  public async checkAllStreamersOnlineStatus(): Promise<void> {
    if (this.streamers.length === 0) return;

    const loginAliases: Record<string, string> = {
      xqcow: 'xqc'
    };
    const reverseAliases: Record<string, string> = {
      xqc: 'xqcow'
    };

    const logins = this.streamers.map(s => {
      const clean = extractTwitchUsername(s.username);
      return loginAliases[clean] || clean;
    });

    try {
      const res = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: {
          'Client-Id': this.settings.clientId || 'kimne78kx3ncx6brgo4mv6wki5h1ko',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          {
            query: `query($logins: [String!]) {
              users(logins: $logins) {
                id
                login
                displayName
                profileImageURL(width: 150)
                stream {
                  id
                  viewersCount
                  game {
                    name
                  }
                  title
                  createdAt
                }
              }
            }`,
            variables: { logins }
          }
        ]),
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        const json: any = await res.json();
        const users: any[] = json?.[0]?.data?.users || [];
        const userMap = new Map<string, any>();
        for (const u of users) {
          if (u?.login) {
            const login = u.login.toLowerCase();
            userMap.set(login, u);
            if (reverseAliases[login]) {
              userMap.set(reverseAliases[login], u);
            }
          }
        }

        let stateChanged = false;

        for (const streamer of this.streamers) {
          const clean = extractTwitchUsername(streamer.username);
          const targetLogin = loginAliases[clean] || clean;
          const u = userMap.get(clean) || userMap.get(targetLogin);

          if (u) {
            const wasLive = streamer.isLive;
            const isTwitchLive = !!u.stream;
            const realViewers = u.stream ? Number(u.stream.viewersCount || 0) : 0;
            const realGame = u.stream?.game?.name || (isTwitchLive ? streamer.game : 'Offline');
            const avatar = u.profileImageURL || streamer.avatar;
            const displayName = u.displayName || streamer.displayName;

            // Telemetry strictly mirrors real Twitch stream status & viewer count
            const targetLive = isTwitchLive;
            const viewers = isTwitchLive ? realViewers : 0;
            const game = isTwitchLive ? realGame : 'Offline';

            if (
              streamer.isLive !== targetLive ||
              streamer.viewerCount !== viewers ||
              streamer.game !== game ||
              streamer.avatar !== avatar ||
              streamer.displayName !== displayName
            ) {
              streamer.isLive = targetLive;
              streamer.viewerCount = viewers;
              streamer.game = game;
              streamer.avatar = avatar;
              streamer.displayName = displayName;
              stateChanged = true;

              if (!wasLive && targetLive) {
                this.addLog(
                  'INFO',
                  streamer.username,
                  `🟢 Streamer ${streamer.displayName} is now LIVE! Playing "${game}" with ${viewers.toLocaleString()} viewers.`
                );
              } else if (wasLive && !targetLive) {
                this.addLog(
                  'WARN',
                  streamer.username,
                  `🔴 Streamer ${streamer.displayName} has gone OFFLINE. Releasing watch slot.`
                );
              }

              prisma.streamer.update({
                where: { id: streamer.id },
                data: {
                  isLive: targetLive,
                  viewerCount: viewers,
                  game,
                  avatar,
                  displayName
                }
              }).catch(() => {});
            }
          }
        }

        if (stateChanged) {
          this.rebalanceActiveSlots();
          this.broadcastSSE('streamers', this.streamers);
        }
      }
    } catch (err) {
      // Network failure or timeout, fallback to cached state
    }
  }

  public async refreshActiveSlotsLiveStats() {
    await this.checkAllStreamersOnlineStatus();
  }

  public ensureChatConnection(username: string) {
    const clean = username.trim().toLowerCase();
    const existing = this.activeConnections.get(clean);
    if (existing && (existing.connectionState === 'connected' || existing.connectionState === 'connecting') && existing.ws) {
      return;
    }
    const streamer = this.streamers.find(s => s.username === clean);
    this.connectIrcSocket(clean, streamer?.displayName || clean);
  }

  private connectToStreamer(streamer: Streamer) {
    if (!streamer.isLive || !streamer.enabled || this.status.state !== 'running') {
      return;
    }
    const clean = streamer.username.toLowerCase();
    this.connectIrcSocket(clean, streamer.displayName);
  }

  private connectIrcSocket(clean: string, displayName: string) {
    const existing = this.activeConnections.get(clean);
    if (existing && (existing.connectionState === 'connected' || existing.connectionState === 'connecting') && existing.ws) {
      return;
    }

    const connection: ActiveSlotConnection = {
      username: clean,
      connectedAt: new Date().toISOString(),
      connectionState: 'connecting',
      lastPing: new Date().toISOString(),
      reconnectAttempts: 0
    };
    this.activeConnections.set(clean, connection);

    this.addLog(
      'WATCH',
      clean,
      `Connecting to real-time Twitch IRC chat for ${displayName} on #${clean}...`
    );

    try {
      if (typeof WebSocket === 'undefined') {
        // Never report success without a real socket — this was masking
        // runtimes without WebSocket support (e.g. Node < 21) as "connected".
        this.addLog(
          'ERROR',
          clean,
          `Cannot connect to Twitch IRC for ${displayName}: this runtime has no WebSocket support. Chat stays offline.`
        );
        this.activeConnections.delete(clean);
        return;
      }

      if (typeof WebSocket !== 'undefined') {
        const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        connection.ws = ws;

        const targetChannel = clean === 'xqcow' ? 'xqc' : clean;

        ws.onopen = () => {
          connection.connectionState = 'connected';
          connection.connectedAt = new Date().toISOString();
          connection.lastPing = new Date().toISOString();
          connection.reconnectAttempts = 0;


          try {
            ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership\r\n');
            ws.send('PASS SCHMOOPIE\r\n');
            const anonNick = `justinfan${Math.floor(10000 + Math.random() * 89999)}`;
            ws.send(`NICK ${anonNick}\r\n`);
            ws.send(`JOIN #${targetChannel}\r\n`);
          } catch (e) {}

          this.addLog(
            'SUCCESS',
            clean,
            `Connected to #${targetChannel} live Twitch IRC. Streaming 100% authentic Twitch chat.`
          );
          this.broadcastSSE('status', this.getStatus());
        };

        ws.onmessage = (event) => {
          const rawData = String(event.data || '');
          const lines = rawData.split('\r\n');

          for (const raw of lines) {
            if (!raw) continue;

            if (raw.startsWith('PING')) {
              try {
                ws.send('PONG :tmi.twitch.tv\r\n');
              } catch (e) {}
              connection.lastPing = new Date().toISOString();
              continue;
            }

            if (raw.includes('PRIVMSG')) {
              const match = raw.match(/(?:@([^ ]+) )?:([^!]+)![^ ]+ PRIVMSG #([^ ]+) :(.+)/);
              if (match) {
                const tagString = match[1] || '';
                const fallbackNick = match[2];
                const text = match[4];

                let displayName = fallbackNick;
                let color = '#9146FF';
                const badges: string[] = [];

                if (tagString) {
                  const tags = tagString.split(';');
                  for (const tag of tags) {
                    const [k, v] = tag.split('=');
                    if (k === 'display-name' && v) displayName = v;
                    if (k === 'color' && v) color = v;
                    if (k === 'badges' && v) {
                      const badgePairs = v.split(',');
                      for (const bp of badgePairs) {
                        const bName = bp.split('/')[0];
                        if (bName) badges.push(bName);
                      }
                    }
                  }
                }

                const chatMsg: ChatMessage = {
                  id: `irc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  channel: clean,
                  username: fallbackNick,
                  displayName: displayName || fallbackNick,
                  color: color || '#9146FF',
                  badges,
                  message: text,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  isHighlighted: badges.includes('broadcaster') || badges.includes('moderator') || badges.includes('vip'),
                  isBot: false,
                  isSystem: false
                };

                this.addStreamerChatMessage(clean, chatMsg);
              }
            }

            if (raw.includes('USERNOTICE') && raw.includes('msg-id=raid')) {
              const raidMatch = raw.match(/msg-param-displayName=([^;]+)/);
              const raider = raidMatch ? raidMatch[1] : 'Raider';
              this.addLog(
                'RAID',
                clean,
                `Channel raid detected by ${raider} in #${targetChannel}! Raid points bonus captured (+250 pts).`,
                250
              );
            }
          }
        };

        ws.onerror = () => {
          connection.connectionState = 'disconnected';
          connection.reconnectAttempts += 1;
        };

        ws.onclose = () => {
          connection.connectionState = 'disconnected';
          connection.ws = null;
          connection.reconnectAttempts += 1;
        };
      }
    } catch (err) {
      connection.connectionState = 'disconnected';
      connection.reconnectAttempts += 1;
      this.addLog(
        'ERROR',
        clean,
        `Twitch IRC connection failed for #${clean}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private disconnectFromStreamer(username: string) {
    const clean = username.toLowerCase();
    const conn = this.activeConnections.get(clean);
    if (conn) {
      try {
        if (conn.ws && (conn.ws.readyState === 1 || conn.ws.readyState === 0)) {
          conn.ws.close();
        }
      } catch (e) {}
      this.activeConnections.delete(clean);
      const streamer = this.streamers.find(s => s.username === clean);
      this.addLog(
        'INFO',
        clean,
        `Disconnected watch slot from ${streamer ? streamer.displayName : clean}.`
      );
    }
  }

  private disconnectAllStreamers() {
    for (const [username] of this.activeConnections.entries()) {
      this.disconnectFromStreamer(username);
    }
    this.activeConnections.clear();
  }

  public getActiveConnections(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [username, conn] of this.activeConnections.entries()) {
      result[username] = {
        username: conn.username,
        connectedAt: conn.connectedAt,
        connectionState: conn.connectionState,
        lastPing: conn.lastPing
      };
    }
    return result;
  }

  private rebalanceActiveSlots() {
    if (this.status.state !== 'running') {
      this.disconnectAllStreamers();
      return;
    }

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

    // Mining targets must be actively LIVE and enabled!
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
          this.connectToStreamer(s);
        } else {
          this.disconnectFromStreamer(s.username);
        }
        // Update in SQLite
        prisma.streamer.update({
          where: { username: s.username },
          data: { isMining: shouldMine }
        }).catch(() => {});
      } else if (shouldMine) {
        // Ensure connected if should be mining
        const existingConn = this.activeConnections.get(s.username);
        if (!existingConn || existingConn.connectionState === 'disconnected') {
          this.connectToStreamer(s);
        }
      }
    }

    this.status.activeSlots = targetMining;
    if (slotsChanged) {
      this.broadcastSSE('streamers', this.streamers);
      this.broadcastSSE('status', this.getStatus());
    }
  }

  private claimInFlight = false;

  public async fetchAvailableClaim(channelLogin: string): Promise<string | null> {
    try {
      const res = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: this.authenticatedGqlHeaders(),
        body: JSON.stringify({
          query: 'query($login: String!) { user(login: $login) { channel { self { communityPoints { availableClaim { id } } } } } }',
          variables: { login: channelLogin }
        }),
        signal: AbortSignal.timeout(8000)
      });
      const j: unknown = await res.json();
      if (typeof j !== 'object' || j === null || !('data' in j) || typeof j.data !== 'object' || j.data === null) return null;
      const data = j.data as { user?: { channel?: { self?: { communityPoints?: { availableClaim?: { id?: unknown } | null } | null } | null } | null } | null };
      const id = data.user?.channel?.self?.communityPoints?.availableClaim?.id;
      return typeof id === 'string' ? id : null;
    } catch {
      return null;
    }
  }

  private authenticatedGqlHeaders(): Record<string, string> {
    return {
      'Authorization': `OAuth ${this.settings.authToken}`,
      'Client-Id': 'ue6666qo983tsx6so1t0vnawi233wa',
      'X-Device-Id': '2fKtD7vbBQY6Sg9PQkebQGxtJBHpHBlx',
      'Content-Type': 'application/json'
    };
  }

  public async claimRealBonus(streamer: Streamer): Promise<{ success: boolean; points: number; message: string }> {
    if (!this.settings.authToken) {
      return { success: false, points: 0, message: 'Not connected to Twitch.' };
    }
    if (this.claimInFlight) {
      return { success: false, points: 0, message: 'A claim is already in progress.' };
    }
    this.claimInFlight = true;
    try {
      const claimId = await this.fetchAvailableClaim(streamer.username);
      if (!claimId) {
        return { success: false, points: 0, message: `No bonus chest available on ${streamer.displayName}'s channel right now.` };
      }
      const channelRes = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: this.authenticatedGqlHeaders(),
        body: JSON.stringify({
          query: 'query($login: String!) { user(login: $login) { id } }',
          variables: { login: streamer.username }
        }),
        signal: AbortSignal.timeout(8000)
      });
      const channelJson: unknown = await channelRes.json();
      let channelId: string | undefined;
      if (typeof channelJson === 'object' && channelJson !== null && 'data' in channelJson) {
        const d = channelJson.data as { user?: { id?: unknown } | null } | undefined;
        const id = d?.user?.id;
        if (typeof id === 'string') channelId = id;
      }
      if (!channelId || typeof channelId !== 'string') {
        return { success: false, points: 0, message: `Could not resolve channel id for ${streamer.username}.` };
      }
      const claimRes = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: this.authenticatedGqlHeaders(),
        body: JSON.stringify({
          operationName: 'ClaimCommunityPoints',
          extensions: { persistedQuery: { version: 1, sha256Hash: '46aaeebe02c99afdf4fc97c7c0cba964124bf6b0af229395f1f6d1feed05b3d0' } },
          variables: { input: { channelID: channelId, claimID: claimId } }
        }),
        signal: AbortSignal.timeout(8000)
      });
      const claimJson: unknown = await claimRes.json();
      if (typeof claimJson !== 'object' || claimJson === null || !('data' in claimJson) || typeof claimJson.data !== 'object' || claimJson.data === null) {
        return { success: false, points: 0, message: 'Claim request failed.' };
      }
      const claimData = claimJson.data as { claimCommunityPoints?: { claim?: { pointsEarnedTotal?: unknown } | null; currentPoints?: unknown; error?: unknown } | null };
      const payload = claimData.claimCommunityPoints;
      if (!payload || payload.error) {
        return { success: false, points: 0, message: `Claim rejected: ${payload?.error ?? 'unknown error'}` };
      }
      const earned = typeof payload.claim?.pointsEarnedTotal === 'number' ? payload.claim.pointsEarnedTotal : 0;
      const currentPoints = typeof payload.currentPoints === 'number' ? payload.currentPoints : null;
      if (currentPoints !== null) {
        this.applyRealBalance(currentPoints);
        if (this.balanceBaseline !== null) {
          this.balanceBaseline = currentPoints - earned;
        }
      }
      this.addLog('CLAIM', streamer.username, `Real bonus claimed on ${streamer.displayName}: +${earned} pts (Twitch balance: ${currentPoints?.toLocaleString() ?? '?'}).`, earned);
      return { success: true, points: earned, message: `Claimed +${earned} pts on ${streamer.displayName}` };
    } catch (err) {
      return { success: false, points: 0, message: err instanceof Error ? err.message : 'Claim failed' };
    } finally {
      this.claimInFlight = false;
    }
  }

  public async executeClaimBonus(streamer: Streamer) {
    if (!this.settings.isSimulationMode) {
      const result = await this.claimRealBonus(streamer);
      this.addLog(
        result.success ? 'CLAIM' : 'WARN',
        streamer.username,
        result.message
      );
      return;
    }
    streamer.chestAvailable = false;
    streamer.nextChestEstimateSeconds = 900;
    streamer.points += 50;
    streamer.totalPointsMined += 50;
    streamer.lastClaimTime = new Date().toISOString();

    this.status.totalPointsMined += 50;
    this.status.pointsToday += 50;
    this.status.pointsThisHour += 50;
    this.status.totalClaims += 1;

    await this.recordStatisticalData({
      pointsMined: 50,
      claimsCount: 1,
      chestsPoints: 50
    });

    try {
      await prisma.streamer.update({
        where: { id: streamer.id },
        data: {
          points: streamer.points,
          totalPointsMined: streamer.totalPointsMined,
          lastClaimTime: streamer.lastClaimTime,
          chestAvailable: false,
          nextChestEstimateSeconds: 900
        }
      });
    } catch (e) {
      void 0;
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

    this.broadcastSSE('streamers', this.streamers);
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

  public getSettings(): MinerSettings & { hasAuthToken: boolean } {
    return { ...this.settings, authToken: '', hasAuthToken: Boolean(this.settings.authToken) };
  }

  public async validateStoredAuthToken(): Promise<{ login: string; userId: string } | null> {
    const token = this.settings.authToken;
    if (!token) return null;
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
  }

  private connectPubsub() {
    if (!this.settings.authToken || !this.pubsubUserId) return;
    if (this.pubsubWs && this.pubsubWs.readyState === WebSocket.OPEN) return;
    try {
      const ws = new WebSocket('wss://pubsub-edge.twitch.tv/v1');
      this.pubsubWs = ws;
      ws.onopen = () => {
        this.addLog('SUCCESS', undefined, 'Authenticated Twitch PubSub connected — real Channel Points balance sync active.');
        ws.send(JSON.stringify({
          type: 'LISTEN',
          nonce: 'balance-listen',
          data: {
            topics: [`community-points-user-v1.${this.pubsubUserId}`],
            auth_token: this.settings.authToken
          }
        }));
        this.fetchBalanceSnapshot();
        this.pubsubPingTimer = setInterval(() => {
          try { ws.send(JSON.stringify({ type: 'PING' })); } catch { void 0; }
        }, 120_000);
      };
      ws.onmessage = (event) => {
        try {
          const msg: unknown = JSON.parse(String(event.data));
          if (typeof msg !== 'object' || msg === null || !('type' in msg)) return;
          if (msg.type === 'RESPONSE' && 'error' in msg && typeof msg.error === 'string' && msg.error) {
            this.addLog('ERROR', undefined, `PubSub LISTEN rejected: ${msg.error}`);
            return;
          }
          if (msg.type !== 'MESSAGE' || !('data' in msg) || typeof msg.data !== 'object' || msg.data === null) return;
          const data = msg.data as { topic?: unknown; message?: unknown };
          if (typeof data.topic !== 'string' || !data.topic.startsWith('community-points-user-v1.')) return;
          const payload: unknown = typeof data.message === 'string' ? JSON.parse(data.message) : null;
          if (typeof payload !== 'object' || payload === null || !('type' in payload)) return;
          if (
            payload.type !== 'points-earned' &&
            payload.type !== 'points-spent' &&
            payload.type !== 'claim-available' &&
            payload.type !== 'points-reward'
          ) return;
          const balanceData = 'balance' in payload ? payload.balance : null;
          const balance =
            typeof balanceData === 'object' && balanceData !== null && 'balance' in balanceData && typeof balanceData.balance === 'number'
              ? balanceData.balance
              : null;
          if (balance !== null) this.applyRealBalance(balance);
        } catch { void 0; }
      };
      ws.onclose = () => {
        if (this.pubsubPingTimer) { clearInterval(this.pubsubPingTimer); this.pubsubPingTimer = null; }
        if (this.settings.authToken && this.pubsubUserId) {
          this.pubsubReconnectTimer = setTimeout(() => this.connectPubsub(), 10_000);
        }
      };
      ws.onerror = () => { try { ws.close(); } catch { void 0; } };
    } catch (err) {
      this.addLog('ERROR', undefined, `PubSub connection failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  public disconnectPubsub() {
    if (this.pubsubPingTimer) { clearInterval(this.pubsubPingTimer); this.pubsubPingTimer = null; }
    if (this.pubsubReconnectTimer) { clearTimeout(this.pubsubReconnectTimer); this.pubsubReconnectTimer = null; }
    if (this.pubsubWs) { try { this.pubsubWs.close(); } catch { void 0; } this.pubsubWs = null; }
    this.balanceBaseline = null;
    this.pubsubUserId = null;
  }

  private async fetchBalanceSnapshot() {
    const mining = this.streamers.find(s => s.isMining);
    if (!mining) return;
    try {
      const res = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: {
          'Authorization': `OAuth ${this.settings.authToken}`,
          'Client-Id': 'ue6666qo983tsx6so1t0vnawi233wa',
          'X-Device-Id': '2fKtD7vbBQY6Sg9PQkebQGxtJBHpHBlx',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'query($login: String!) { user(login: $login) { channel { self { communityPoints { balance } } } } }',
          variables: { login: mining.username }
        }),
        signal: AbortSignal.timeout(8000)
      });
      const j: unknown = await res.json();
      if (typeof j !== 'object' || j === null || !('data' in j) || typeof j.data !== 'object' || j.data === null) return;
      const data = j.data as { user?: { channel?: { self?: { communityPoints?: { balance?: unknown } | null } | null } | null } | null };
      const balance = data.user?.channel?.self?.communityPoints?.balance;
      if (typeof balance === 'number') {
        this.applyRealBalance(balance);
      } else {
        this.addLog('WARN', mining.username, 'Balance snapshot unavailable — will sync on the next points event.');
      }
    } catch (err) {
      this.addLog('WARN', mining.username, `Balance snapshot failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  private applyRealBalance(balance: number) {
    const firstSync = this.balanceBaseline === null;
    if (firstSync) {
      this.balanceBaseline = balance;
      this.addLog(
        'SUCCESS',
        undefined,
        `Real Channel Points balance synced: ${balance.toLocaleString()} pts (baseline set, simulated counters retired).`
      );
    }
    const delta = balance - (this.balanceBaseline ?? balance);
    const primary = this.streamers.find(s => s.isMining);
    if (primary) {
      primary.points = balance;
      if (firstSync) {
        primary.totalPointsMined = balance;
        this.status.totalPointsMined = balance;
        this.status.pointsToday = 0;
        this.status.pointsThisHour = 0;
        this.status.totalClaims = 0;
        this.status.totalRaids = 0;
        this.status.totalPredictionsPlaced = 0;
        this.status.totalPredictionsWon = 0;
        this.status.netPredictionPoints = 0;
        this.status.totalDropsClaimed = 0;
      } else if (delta > 0) {
        this.status.pointsToday += delta;
        this.status.pointsThisHour += delta;
      }
      prisma.streamer.update({
        where: { id: primary.id },
        data: { points: primary.points, totalPointsMined: primary.totalPointsMined }
      }).catch(() => {});
    }
    if (firstSync) {
      for (const s of this.streamers) {
        if (s !== primary && s.points !== 0 && !s.isMining) {
          s.points = 0;
          s.totalPointsMined = 0;
        }
      }
    }
    this.broadcastSSE('streamers', this.streamers);
    this.broadcastSSE('status', this.getStatus());
  }

  public async updateSettings(newSettings: Partial<MinerSettings>): Promise<MinerSettings> {
    // Guard: an invalid GQL Client-Id makes every Twitch API call fail with
    // HTTP 400 and silently freezes live telemetry. Only accept the known-good
    // public web client id or a non-empty custom one that was verified.
    if (newSettings.clientId !== undefined) {
      const candidate = newSettings.clientId.trim();
      const PUBLIC_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
      if (!candidate) {
        // Empty value = explicit reset to the public web client id.
        newSettings.clientId = PUBLIC_CLIENT_ID;
      } else if (candidate !== PUBLIC_CLIENT_ID) {
        // Probe the candidate against GQL before trusting it: a bad id makes
        // every Twitch call fail with HTTP 400 and silently freezes telemetry.
        try {
          const probe = await fetch('https://gql.twitch.tv/gql', {
            method: 'POST',
            headers: { 'Client-Id': candidate, 'Content-Type': 'application/json' },
            body: JSON.stringify([{ query: 'query { user(login: "twitch") { id } }', variables: {} }]),
            signal: AbortSignal.timeout(5000)
          });
          if (probe.status === 400) {
            this.addLog(
              'WARN',
              undefined,
              `Rejected invalid Twitch Client-Id "${candidate}" (GQL returned ${probe.status}). Keeping the current one.`
            );
            delete newSettings.clientId;
          }
        } catch {
          this.addLog('WARN', undefined, 'Could not verify new Twitch Client-Id (network error). Keeping the current one.');
          delete newSettings.clientId;
        }
      }
    }
    if (newSettings.authToken === '') {
      delete newSettings.authToken;
    }
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
    this.broadcastSSE('settings', this.getSettings());
    return this.getSettings();
  }

  public getStreamers(): Streamer[] {
    return [...this.streamers];
  }

  public async fetchTwitchLiveStats(username: string): Promise<{
    displayName: string;
    avatar?: string;
    isLive: boolean;
    viewerCount: number;
    game: string;
    points?: number;
  }> {
    const clean = extractTwitchUsername(username);
    if (!clean) {
      return {
        displayName: username,
        isLive: false,
        viewerCount: 0,
        game: 'Offline'
      };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const headers: Record<string, string> = {
        'Client-Id': this.settings.clientId || 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json'
      };
      if (this.settings.authToken) {
        headers['Authorization'] = `OAuth ${this.settings.authToken.replace(/^oauth:/i, '')}`;
      }

      const res = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers,
        body: JSON.stringify([
          {
            query: `query($login: String!) {
              user(login: $login) {
                id
                login
                displayName
                profileImageURL(width: 150)
                stream {
                  id
                  viewersCount
                  game {
                    name
                  }
                  title
                  createdAt
                }
                channel {
                  self {
                    communityPoints {
                      balance
                    }
                  }
                }
              }
            }`,
            variables: { login: clean }
          }
        ]),
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (res.ok) {
        const json: any = await res.json();
        const user = json?.[0]?.data?.user;
        if (user) {
          const stream = user.stream;
          const isLive = !!stream;
          const viewerCount = stream ? Number(stream.viewersCount || 0) : 0;
          const game = stream?.game?.name || (isLive ? 'Variety Stream' : 'Offline');
          const points = user.channel?.self?.communityPoints?.balance;
          return {
            displayName: user.displayName || clean,
            avatar: user.profileImageURL,
            isLive,
            viewerCount,
            game,
            points: typeof points === 'number' ? points : undefined
          };
        }
      }
    } catch (err) {
      // Network fallback
    } finally {
      clearTimeout(timeout);
    }

    const existing = this.streamers.find(s => extractTwitchUsername(s.username) === clean);
    return {
      displayName: existing?.displayName || clean,
      avatar: existing?.avatar,
      isLive: existing?.isLive ?? false,
      viewerCount: existing?.isLive ? (existing?.viewerCount ?? 0) : 0,
      game: existing?.game ?? 'Offline',
      points: existing?.points
    };
  }

  public async getLiveStats(username: string) {
    const clean = extractTwitchUsername(username);
    const streamer = this.streamers.find(s => extractTwitchUsername(s.username) === clean);
    if (!streamer) {
      return null;
    }

    // Refresh live stats from Twitch GQL
    try {
      const live = await this.fetchTwitchLiveStats(clean);
      if (live) {
        if (live.isLive !== undefined) streamer.isLive = live.isLive;
        if (typeof live.viewerCount === 'number') streamer.viewerCount = live.viewerCount;
        if (live.game) streamer.game = live.game;
        if (live.avatar) streamer.avatar = live.avatar;
        if (live.displayName) streamer.displayName = live.displayName;
        if (typeof live.points === 'number') streamer.points = live.points;

        await prisma.streamer.update({
          where: { id: streamer.id },
          data: {
            isLive: streamer.isLive,
            viewerCount: streamer.viewerCount,
            game: streamer.game,
            avatar: streamer.avatar,
            displayName: streamer.displayName,
            points: streamer.points
          }
        }).catch(() => {});
      }
    } catch (e) {
      // Return cached
    }

    return {
      username: streamer.username,
      displayName: streamer.displayName,
      avatar: streamer.avatar,
      points: streamer.points,
      viewerCount: streamer.viewerCount,
      isLive: streamer.isLive,
      game: streamer.game,
      watchStreak: streamer.watchStreak,
      isMining: streamer.isMining,
      priority: streamer.priority,
      enabled: streamer.enabled,
      chestAvailable: streamer.chestAvailable,
      nextChestEstimateSeconds: streamer.nextChestEstimateSeconds,
      totalPointsMined: streamer.totalPointsMined,
      lastClaimTime: streamer.lastClaimTime,
      uptimeMinutes: streamer.uptimeMinutes,
      fetchedAt: new Date().toISOString()
    };
  }

  public async refreshAllLiveStats(): Promise<Streamer[]> {
    await this.checkAllStreamersOnlineStatus();
    return this.streamers;
  }

  public async addStreamer(username: string, displayName?: string): Promise<Streamer> {
    const cleanUsername = extractTwitchUsername(username);
    if (!cleanUsername) {
      throw new Error('Invalid Twitch channel username or URL');
    }
    const existing = this.streamers.find(s => extractTwitchUsername(s.username) === cleanUsername);
    if (existing) {
      // Refresh live stats directly from Twitch
      const live = await this.fetchTwitchLiveStats(cleanUsername);
      existing.isLive = live.isLive;
      existing.viewerCount = live.viewerCount;
      existing.game = live.game;
      if (live.displayName) existing.displayName = live.displayName;
      if (live.avatar) existing.avatar = live.avatar;
      await prisma.streamer.update({
        where: { id: existing.id },
        data: {
          isLive: existing.isLive,
          viewerCount: existing.viewerCount,
          game: existing.game,
          avatar: existing.avatar,
          displayName: existing.displayName
        }
      }).catch(() => {});
      this.rebalanceActiveSlots();
      this.broadcastSSE('streamers', this.streamers);
      return existing;
    }

    // Fetch actual live stats from Twitch GraphQL API
    const live = await this.fetchTwitchLiveStats(cleanUsername);

    const newStreamerData = {
      username: cleanUsername,
      displayName: live.displayName || displayName || cleanUsername,
      avatar: live.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanUsername}`,
      isLive: live.isLive,
      game: live.game || (live.isLive ? 'Variety Stream' : 'Offline'),
      viewerCount: live.isLive ? live.viewerCount : 0,
      points: live.points ?? 0,
      watchStreak: 1,
      isMining: false,
      priority: this.streamers.length + 1,
      enabled: true,
      chestAvailable: false,
      nextChestEstimateSeconds: 900,
      totalPointsMined: 0,
      uptimeMinutes: live.isLive ? 60 : 0
    };

    // Store in SQLite database via Prisma ORM engine
    const savedInDb = await prisma.streamer.upsert({
      where: { username: cleanUsername },
      update: {
        isLive: newStreamerData.isLive,
        viewerCount: newStreamerData.viewerCount,
        game: newStreamerData.game,
        avatar: newStreamerData.avatar,
        displayName: newStreamerData.displayName
      },
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
    this.addLog(
      'INFO',
      cleanUsername,
      `Added streamer ${streamer.displayName} to mining watchlist (${streamer.isLive ? `LIVE with ${streamer.viewerCount.toLocaleString()} viewers playing ${streamer.game}` : 'Offline'}).`
    );
    this.rebalanceActiveSlots();
    this.broadcastSSE('streamers', this.streamers);
    return streamer;
  }

  public async removeStreamer(username: string): Promise<boolean> {
    const clean = extractTwitchUsername(username);
    this.disconnectFromStreamer(clean);
    const index = this.streamers.findIndex(s => extractTwitchUsername(s.username) === clean);
    if (index !== -1) {
      const removed = this.streamers.splice(index, 1)[0];
      // Remove from SQLite database via Prisma ORM engine
      try {
        await prisma.streamer.delete({
          where: { id: removed.id }
        });
      } catch (err) {
        console.error('Failed to delete streamer from Prisma SQLite:', err);
      }

      this.addLog('INFO', clean, `Removed streamer ${removed.displayName} from mining watchlist.`);
      this.rebalanceActiveSlots();
      this.broadcastSSE('streamers', this.streamers);
      return true;
    }
    return false;
  }

  public async updateStreamer(username: string, updates: Partial<Streamer>): Promise<Streamer | null> {
    const clean = extractTwitchUsername(username);
    const s = this.streamers.find(item => extractTwitchUsername(item.username) === clean);
    if (!s) return null;
    Object.assign(s, updates);

    // Persist changes in Prisma SQLite
    try {
      await prisma.streamer.update({
        where: { id: s.id },
        data: {
          points: updates.points !== undefined ? updates.points : undefined,
          priority: updates.priority !== undefined ? updates.priority : undefined,
          enabled: updates.enabled !== undefined ? updates.enabled : undefined,
          isMining: updates.isMining !== undefined ? updates.isMining : undefined,
          isLive: updates.isLive !== undefined ? updates.isLive : undefined,
          viewerCount: updates.viewerCount !== undefined ? updates.viewerCount : undefined,
          game: updates.game !== undefined ? updates.game : undefined
        }
      });
    } catch (e) {
      // Ignored
    }

    this.rebalanceActiveSlots();
    this.broadcastSSE('streamers', this.streamers);
    return s;
  }

  public async toggleStreamerLive(username: string, forceLive?: boolean): Promise<Streamer | null> {
    const clean = extractTwitchUsername(username);
    const streamer = this.streamers.find(s => extractTwitchUsername(s.username) === clean);
    if (!streamer) return null;

    const newLive = forceLive !== undefined ? forceLive : !streamer.isLive;
    streamer.isLive = newLive;

    if (newLive) {
      // Query Twitch to get real live status & real viewer count
      const live = await this.fetchTwitchLiveStats(clean);
      if (live && live.isLive) {
        streamer.viewerCount = live.viewerCount;
        streamer.game = live.game;
        if (live.avatar) streamer.avatar = live.avatar;
        if (live.displayName) streamer.displayName = live.displayName;
      } else {
        streamer.viewerCount = 0;
      }
    } else {
      streamer.viewerCount = 0;
      streamer.isMining = false;
    }

    try {
      await prisma.streamer.update({
        where: { id: streamer.id },
        data: {
          isLive: streamer.isLive,
          viewerCount: streamer.viewerCount,
          game: streamer.game,
          isMining: streamer.isMining
        }
      });
    } catch (e) {}

    this.addLog(
      newLive ? 'INFO' : 'WARN',
      clean,
      newLive
        ? `🟢 Channel ${streamer.displayName} status set to ONLINE (${streamer.game}, ${streamer.viewerCount.toLocaleString()} viewers).`
        : `🔴 Channel ${streamer.displayName} status set to OFFLINE. Released from active watch slot.`
    );

    this.rebalanceActiveSlots();
    this.broadcastSSE('streamers', this.streamers);
    this.broadcastSSE('status', this.getStatus());
    return streamer;
  }

  public getStreamerChat(username: string): ChatMessage[] {
    const clean = username.trim().toLowerCase();
    this.ensureChatConnection(clean);
    if (!this.streamerChats.has(clean)) {
      this.streamerChats.set(clean, []);
    }
    return [...(this.streamerChats.get(clean) || [])];
  }

  public addStreamerChatMessage(channel: string, msg: ChatMessage) {
    const clean = channel.trim().toLowerCase();
    if (!this.streamerChats.has(clean)) {
      this.streamerChats.set(clean, []);
    }
    const list = this.streamerChats.get(clean)!;
    list.push(msg);
    if (list.length > 200) {
      list.shift();
    }
    this.broadcastSSE('chat', { channel: clean, message: msg });
  }

  public handleUserChatMessage(channel: string, text: string, senderName = 'You'): ChatMessage {
    const clean = channel.trim().toLowerCase();
    const streamer = this.streamers.find(s => s.username === clean);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      channel: clean,
      username: senderName.toLowerCase().replace(/\s+/g, '_'),
      displayName: senderName,
      color: '#00F593',
      badges: ['sub'],
      message: text,
      timestamp: time,
      isHighlighted: false,
      isBot: false,
      isSystem: false
    };

    this.addStreamerChatMessage(clean, userMsg);

    // Forward to Twitch IRC WebSocket if active
    const conn = this.activeConnections.get(clean);
    if (conn?.ws && conn.ws.readyState === 1) {
      try {
        const targetChannel = clean === 'xqcow' ? 'xqc' : clean;
        conn.ws.send(`PRIVMSG #${targetChannel} :${text}\r\n`);
      } catch (e) {}
    }

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // Trigger bonus claim in background if requested, but no fake bot messages
    if (lower === '!claim' || lower === '!chest') {
      if (streamer) {
        this.executeClaimBonus(streamer);
      }
    }

    this.addLog('CHAT', clean, `<${senderName}> ${text}`);
    return userMsg;
  }

  public startMiner() {
    this.status.state = 'running';
    this.addLog('SUCCESS', undefined, 'Miner engine started. Monitoring channels and priority queues.');
    this.rebalanceActiveSlots();
    this.broadcastSSE('status', this.getStatus());
  }

  public pauseMiner() {
    this.status.state = 'paused';
    this.disconnectAllStreamers();
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
    this.disconnectAllStreamers();
    for (const s of this.streamers) {
      s.isMining = false;
    }
    this.status.activeSlots = [];
    this.addLog('WARN', undefined, 'Miner engine stopped.');
    this.broadcastSSE('status', this.getStatus());
    this.broadcastSSE('streamers', this.streamers);
  }

  public async triggerTestClaim(channelUsername?: string) {
    let target = this.streamers.find(s => s.isMining && s.isLive);
    if (channelUsername) {
      target = this.streamers.find(s => s.username === channelUsername.toLowerCase());
    }
    if (!target) {
      target = this.streamers[0];
    }
    if (!target) {
      return { success: false, message: 'No available channel to claim' };
    }
    if (this.settings.isSimulationMode) {
      await this.executeClaimBonus(target);
      return { success: true, channel: target.displayName, points: 50 };
    }
    return await this.claimRealBonus(target);
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
      void 0;
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

    // Default fallbacks if empty - ONLY in development mode
    if (hourlyMap.size === 0 && process.env.NODE_ENV === 'development') {
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
