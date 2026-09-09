export type PriorityMode = 'points_asc' | 'points_desc' | 'streak' | 'manual';

export type MinerState = 'running' | 'paused' | 'stopped';

export type LogLevel = 'INFO' | 'SUCCESS' | 'CLAIM' | 'WATCH' | 'RAID' | 'PREDICTION' | 'DROP' | 'WARN' | 'ERROR' | 'CHAT' | 'CMD';

export interface Streamer {
  id: string;
  userId?: string;
  username: string;
  displayName: string;
  avatar: string;
  isLive: boolean;
  game: string;
  viewerCount: number;
  points: number;
  watchStreak: number; // consecutive UTC days with an accepted watch heartbeat
  lastWatchDay?: string; // last UTC day (YYYY-MM-DD) a heartbeat was accepted
  isMining: boolean; // currently occupying one of the active slots (max 2)
  lurkEnabled?: boolean; // post the lurk command in chat when the channel goes live
  lurkMessage?: string;
  lastLurkDay?: string; // last UTC day (YYYY-MM-DD) the lurk message was posted
  priority: number; // order rank
  enabled: boolean;
  chestAvailable: boolean;
  nextChestEstimateSeconds: number;
  watchedMinutesSinceChest?: number; // watch minutes accrued toward the next bonus chest (real-claim mode)
  totalPointsMined: number;
  lastClaimTime?: string;
  uptimeMinutes?: number;
  isFollowing: boolean;
  subscriptionTier?: string | null;
}

export interface MinerSettings {
  authToken: string;
  clientId: string;
  isSimulationMode: boolean;
  enforceRealTwitchLive?: boolean;
  maxConcurrentStreams: number; // Twitch hard limit is 2
  priorityMode: PriorityMode;
  autoClaimBonus: boolean;
  claimDelaySeconds: number; // Human-like delay (e.g., 3-10 seconds)
  followRaids: boolean;
  autoClaimDrops: boolean;
  autoBetPredictions: boolean;
  predictionStrategy: 'lowest_odds' | 'highest_odds' | 'smart_ratio' | 'conservative';
  maxBetPoints: number;
  checkIntervalSeconds: number;
}

export interface MinerStatus {
  state: MinerState;
  uptimeSeconds: number;
  totalPointsMined: number;
  pointsToday: number;
  pointsThisHour: number;
  activeSlots: string[]; // streamer usernames currently being watched
  activeSlotsLimit: number;
  totalClaims: number;
  totalRaids: number;
  totalPredictionsPlaced: number;
  totalPredictionsWon: number;
  netPredictionPoints: number;
  totalDropsClaimed: number;
  lastActionTimestamp: string;
  isSimulation: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  channel?: string;
  message: string;
  pointsDelta?: number;
}

export interface HourlyPointRecord {
  time: string;
  points: number;
  claims: number;
}

export interface ChannelPointsDistribution {
  channel: string;
  points: number;
  percentage: number;
  color: string;
}

export interface CategoryBreakdown {
  name: string;
  value: number;
  points: number;
  color: string;
}

export interface AnalyticsData {
  hourlyHistory: HourlyPointRecord[];
  channelDistribution: ChannelPointsDistribution[];
  categoryBreakdown: CategoryBreakdown[];
  summary: {
    totalBonusChestPoints: number;
    totalWatchTimePoints: number;
    totalRaidPoints: number;
    totalPredictionPoints: number;
    totalDropPoints: number;
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  provider: string;
}

export interface StatisticalRecord {
  id: string;
  userId?: string | null;
  hourKey: string;
  pointsMined: number;
  claimsCount: number;
  raidsCount: number;
  predictionsWon: number;
  predictionsLost: number;
  netPredictionPoints: number;
  dropsCount: number;
  chestsPoints: number;
  watchTimePoints: number;
  recordedAt: string;
}

export interface ChatMessage {
  id: string;
  channel: string;
  username: string;
  displayName: string;
  color?: string;
  badges: string[];
  message: string;
  timestamp: string;
  isBot?: boolean;
  isSystem?: boolean;
  isHighlighted?: boolean;
}

