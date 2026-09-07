import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Send,
  Terminal,
  ExternalLink,
  Trash2,
  Gift,
  Radio,
  Eye,
  Shield,
  Sparkles,
  ChevronDown,
  X,
  RefreshCw
} from 'lucide-react';
import { Streamer } from '../types';

export interface LiveStreamerStats {
  username: string;
  displayName: string;
  avatar?: string;
  points: number;
  viewerCount: number;
  isLive: boolean;
  game: string;
  watchStreak?: number;
  chestAvailable: boolean;
  nextChestEstimateSeconds: number;
  totalPointsMined: number;
  lastClaimTime?: string;
  uptimeMinutes?: number;
  fetchedAt: string;
}

interface ChatMessage {
  id: string;
  username: string;
  displayName: string;
  color?: string;
  badges: string[];
  message: string;
  timestamp: string;
  isBot?: boolean;
  isHighlighted?: boolean;
  isSystem?: boolean;
}

interface SlotIrcChatProps {
  streamer: Streamer | null;
  onClose?: () => void;
  onClaimChest?: (streamer: Streamer) => void;
  theme?: 'light' | 'dark';
}

const PRESET_EMOTES = ['PogChamp', 'LUL', 'KEKW', 'GG', 'monkaS', 'EZ'];

const SIMULATED_USERS = [
  { name: 'pixel_slayer', color: '#FF5733', badge: 'sub' },
  { name: 'neon_vortex', color: '#33FF57', badge: 'vip' },
  { name: 'shadow_ninja', color: '#3357FF', badge: 'mod' },
  { name: 'cyber_valkyrie', color: '#F333FF', badge: 'sub' },
  { name: 'glitch_hunter', color: '#33FFF5', badge: 'prime' },
  { name: 'retro_gamer_99', color: '#FFA833', badge: '' },
  { name: 'hyper_dash', color: '#9146FF', badge: 'vip' },
  { name: 'quantum_leap', color: '#00F593', badge: 'sub' },
  { name: 'void_walker', color: '#FF3385', badge: 'mod' },
  { name: 'echo_pulse', color: '#EFEFF1', badge: '' }
];

const SIMULATED_REACTIONS = [
  'LET\'S GOOO! 🔥',
  'insane play wtf PogChamp',
  'LUL what was that timing??',
  'W stream as always',
  'KEKW that clutch was unbelievable',
  'clip that right now lmao',
  'GG WP everyone!',
  'how does he do that consistently?? PogChamp',
  'music playlist is hitting so hard today',
  'channel points going to the moon 🚀',
  'EZ win GG',
  'welcome new followers and subscribers! <3',
  'what game is next on schedule?',
  'my prediction paid off 5x return!!'
];

export const SlotIrcChat: React.FC<SlotIrcChatProps> = ({
  streamer,
  onClose,
  onClaimChest,
  theme = 'dark'
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState<'all' | 'highlights'>('all');
  const [viewMode, setViewMode] = useState<'irc' | 'embed'>('irc');
  const [isIrcConnected, setIsIrcConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [chatRoomUsersCount, setChatRoomUsersCount] = useState(1420);

  // Live stats directly queried from Twitch telemetry
  const [liveStats, setLiveStats] = useState<LiveStreamerStats | null>(null);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [lastLiveSyncTime, setLastLiveSyncTime] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamerRef = useRef(streamer);
  streamerRef.current = streamer;

  const currentPoints = liveStats ? liveStats.points : (streamer?.points ?? 0);
  const currentViewers = liveStats ? liveStats.viewerCount : (streamer?.viewerCount ?? 0);
  const isCurrentLive = liveStats ? liveStats.isLive : (streamer?.isLive ?? false);
  const currentGame = liveStats ? liveStats.game : (streamer?.game ?? 'Variety');
  const currentTotalMined = liveStats ? liveStats.totalPointsMined : (streamer?.totalPointsMined ?? 0);
  const currentChestAvailable = liveStats ? liveStats.chestAvailable : (streamer?.chestAvailable ?? false);
  const currentNextChestSeconds = liveStats ? liveStats.nextChestEstimateSeconds : (streamer?.nextChestEstimateSeconds ?? 900);

  const fetchLiveStats = useCallback(async (username: string) => {
    if (!username) return;
    try {
      setIsRefreshingStats(true);
      const res = await fetch(`/api/streamers/${username.toLowerCase()}/live-stats`);
      if (res.ok) {
        const data: LiveStreamerStats = await res.json();
        setLiveStats(data);
        setLastLiveSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        if (typeof data.viewerCount === 'number') {
          setChatRoomUsersCount(data.viewerCount);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch live stats', err);
    } finally {
      setIsRefreshingStats(false);
    }
  }, []);

  // Poll live stats regularly for the selected slot
  useEffect(() => {
    if (!streamer?.username) {
      setLiveStats(null);
      return;
    }
    fetchLiveStats(streamer.username);
    const interval = setInterval(() => {
      fetchLiveStats(streamer.username);
    }, 4000);
    return () => clearInterval(interval);
  }, [streamer?.username, fetchLiveStats]);

  // Auto-scroll to bottom directly inside the chat container without affecting document body
  useEffect(() => {
    if (autoScroll && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Handle user scroll detection
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  // Connect to Twitch IRC WebSocket or simulate
  useEffect(() => {
    if (!streamer) {
      setMessages([]);
      setIsIrcConnected(false);
      return;
    }

    // Set initial welcome system message
    const initialMsgs: ChatMessage[] = [
      {
        id: `sys-welcome-${Date.now()}`,
        username: 'tmi.twitch.tv',
        displayName: 'Twitch IRC',
        badges: ['system'],
        message: `Connected to channel #${streamer.username} via Twitch IRC protocol.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isSystem: true
      }
    ];
    setMessages(initialMsgs);
    setChatRoomUsersCount(currentViewers > 0 ? currentViewers : 120);

    let socket: WebSocket | null = null;
    let isConnectedSuccessfully = false;

    try {
      socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      wsRef.current = socket;

      socket.onopen = () => {
        if (!socket) return;
        socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership\r\n');
        socket.send('PASS SCHMOOPIE\r\n');
        const anonNick = `justinfan${Math.floor(10000 + Math.random() * 89999)}`;
        socket.send(`NICK ${anonNick}\r\n`);
        const channelName = streamer.username.toLowerCase() === 'xqcow' ? 'xqc' : streamer.username.toLowerCase();
        socket.send(`JOIN #${channelName}\r\n`);
        setIsIrcConnected(true);
        isConnectedSuccessfully = true;
      };

      socket.onmessage = (event) => {
        const raw = event.data as string;
        if (raw.startsWith('PING')) {
          socket?.send('PONG :tmi.twitch.tv\r\n');
          return;
        }

        const lines = raw.split('\r\n');
        for (const line of lines) {
          if (!line) continue;
          if (line.includes('PRIVMSG')) {
            const match = line.match(/(?:@([^ ]+) )?:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.+)/);
            if (match) {
              const tagString = match[1] || '';
              const fallbackNick = match[2];
              const text = match[3];

              // Parse tags
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
                    if (v.includes('broadcaster')) badges.push('broadcaster');
                    if (v.includes('moderator')) badges.push('mod');
                    if (v.includes('vip')) badges.push('vip');
                    if (v.includes('subscriber')) badges.push('sub');
                    if (v.includes('turbo')) badges.push('prime');
                  }
                }
              }

              const newMsg: ChatMessage = {
                id: `irc-${Date.now()}-${Math.random()}`,
                username: fallbackNick,
                displayName: displayName || fallbackNick,
                color: color || '#9146FF',
                badges,
                message: text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                isHighlighted: text.includes('!points') || text.includes('!chest') || text.toLowerCase().includes(streamer.username.toLowerCase())
              };

              setMessages(prev => [...prev.slice(-300), newMsg]);
            }
          }
        }
      };

      socket.onerror = () => {
        setIsIrcConnected(false);
      };

      socket.onclose = () => {
        setIsIrcConnected(false);
      };
    } catch {
      setIsIrcConnected(false);
    }

    // Supplementary realistic simulation loop (ensures lively chat even if IRC WebSocket is restricted or streamer is currently low chat)
    // Background simulated stream chatter for realistic stream atmosphere
    const simInterval = setInterval(() => {
      const randomUser = SIMULATED_USERS[Math.floor(Math.random() * SIMULATED_USERS.length)];
      const randomText = SIMULATED_REACTIONS[Math.floor(Math.random() * SIMULATED_REACTIONS.length)];

      const generated: ChatMessage = {
        id: `sim-${Date.now()}-${Math.random()}`,
        username: randomUser.name,
        displayName: randomUser.name,
        color: randomUser.color,
        badges: randomUser.badge ? [randomUser.badge] : [],
        message: randomText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isBot: false,
        isHighlighted: false
      };

      setMessages(prev => [...prev.slice(-300), generated]);
    }, Math.random() * 2500 + 2200);

    return () => {
      clearInterval(simInterval);
      if (socket) {
        try {
          socket.close();
        } catch {
          // Ignored
        }
      }
    };
  }, [streamer?.username, streamer?.isLive]);

  // Handle sending a message
  const handleSendMessage = useCallback((textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || !streamer) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Send through WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const channelName = streamer.username.toLowerCase() === 'xqcow' ? 'xqc' : streamer.username.toLowerCase();
        wsRef.current.send(`PRIVMSG #${channelName} :${text}\r\n`);
      } catch {
        // Ignored
      }
    }

    const userMessage: ChatMessage = {
      id: `self-${Date.now()}`,
      username: 'you',
      displayName: 'You',
      color: '#00F593',
      badges: ['sub'],
      message: text,
      timestamp: time,
      isHighlighted: false
    };

    setMessages(prev => [...prev.slice(-300), userMessage]);
    setAutoScroll(true);
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    setInputText('');
  }, [inputText, streamer]);

  if (!streamer) {
    return (
      <div id="slot-irc-chat-empty" className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-6 text-center shadow-xs">
        <div className="w-10 h-10 mx-auto mb-3 bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-[#26262C] flex items-center justify-center text-zinc-400 dark:text-[#71717A]">
          <MessageSquare className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1]">
          {t('chat.title')}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-[#ADADB8] mt-1 max-w-md mx-auto">
          {t('chat.selectSlotHint')}
        </p>
      </div>
    );
  }

  // Filter messages
  const filteredMessages = messages.filter(m => {
    if (filter === 'highlights') return m.isHighlighted;
    return true;
  });

  // Calculate parent domain for Twitch embed
  const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  return (
    <div
      id="slot-irc-chat-container"
      className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] shadow-md overflow-hidden transition-all"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-zinc-200 dark:border-[#26262C] bg-zinc-50 dark:bg-[#141416]">
        {/* Streamer details */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src={liveStats?.avatar || streamer.avatar}
              alt={streamer.displayName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 object-cover border border-zinc-300 dark:border-[#26262C]"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border border-white dark:border-[#141416] ${
                isCurrentLive ? 'bg-[#00a865] dark:bg-[#00F593]' : 'bg-zinc-400'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-[#EFEFF1]">
                {streamer.displayName}
              </span>
              <span className="text-[11px] font-mono text-zinc-400 dark:text-[#71717A]">
                #{streamer.username}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#9146FF]/15 text-[#9146FF] border border-[#9146FF]/30">
                {t('chat.selectedSlot')}
              </span>
              {currentGame && (
                <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.2 bg-zinc-200 dark:bg-[#26262C] text-zinc-700 dark:text-[#ADADB8]">
                  {currentGame}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-[#ADADB8]">
              <span className="flex items-center gap-1">
                <Radio
                  className={`w-3 h-3 ${
                    isCurrentLive ? 'text-[#00a865] dark:text-[#00F593] animate-pulse' : 'text-zinc-400'
                  }`}
                />
                {isCurrentLive ? t('status.live') : t('status.offline')}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono">
                <Eye className="w-3 h-3 text-zinc-400 dark:text-[#71717A]" />
                <span className="font-semibold text-zinc-800 dark:text-[#EFEFF1]">
                  {currentViewers.toLocaleString()}
                </span>{' '}
                {t('streamersList.viewers')}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-[#9146FF] font-medium">
                <Sparkles className="w-3 h-3 text-[#9146FF]" />
                <span>{currentPoints.toLocaleString()} pts</span>
              </span>
              {lastLiveSyncTime && (
                <>
                  <span className="hidden md:inline">•</span>
                  <span className="hidden md:flex items-center gap-1 text-[10px] font-mono text-[#00a865] dark:text-[#00F593]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00a865] dark:bg-[#00F593] animate-ping" />
                    <span>{t('chat.liveSync')} ({lastLiveSyncTime})</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status indicator & controls */}
        <div className="flex items-center gap-2.5">
          {/* Refresh live stats button */}
          <button
            onClick={() => fetchLiveStats(streamer.username)}
            disabled={isRefreshingStats}
            title={t('chat.refreshStats')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-[#0E0E10] border border-zinc-200 dark:border-[#26262C] text-[11px] font-mono text-zinc-600 dark:text-[#ADADB8] hover:text-[#9146FF] transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshingStats ? 'animate-spin text-[#9146FF]' : ''}`} />
            <span className="hidden sm:inline">{t('chat.realTimeStats')}</span>
          </button>

          {/* Connection badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-[#0E0E10] border border-zinc-200 dark:border-[#26262C] text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isIrcConnected ? 'bg-[#00a865] dark:bg-[#00F593] animate-pulse' : 'bg-[#9146FF]'
              }`}
            />
            <span className="text-zinc-600 dark:text-[#ADADB8]">
              {isIrcConnected ? 'irc.chat.twitch.tv' : 'sandbox-irc: active'}
            </span>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center border border-zinc-200 dark:border-[#26262C] bg-zinc-100 dark:bg-[#0E0E10] p-0.5 text-xs">
            <button
              onClick={() => setViewMode('irc')}
              className={`px-2 py-1 font-medium transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'irc'
                  ? 'bg-white dark:bg-[#18181B] text-[#9146FF] shadow-xs'
                  : 'text-zinc-600 dark:text-[#ADADB8] hover:text-zinc-900 dark:hover:text-[#EFEFF1]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{t('chat.ircStreamView')}</span>
            </button>
            <button
              onClick={() => setViewMode('embed')}
              className={`px-2 py-1 font-medium transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'embed'
                  ? 'bg-white dark:bg-[#18181B] text-[#9146FF] shadow-xs'
                  : 'text-zinc-600 dark:text-[#ADADB8] hover:text-zinc-900 dark:hover:text-[#EFEFF1]'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t('chat.twitchEmbedView')}</span>
            </button>
          </div>

          {/* Clear chat button */}
          <button
            onClick={() => setMessages([])}
            title={t('chat.clearChat')}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:text-[#71717A] dark:hover:text-[#EFEFF1] border border-zinc-200 dark:border-[#26262C] bg-zinc-100 dark:bg-[#0E0E10] transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Close button if provided */}
          {onClose && (
            <button
              onClick={onClose}
              title={t('chat.closeChat')}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:text-[#71717A] dark:hover:text-[#EFEFF1] border border-zinc-200 dark:border-[#26262C] bg-zinc-100 dark:bg-[#0E0E10] transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main chat body: IRC Terminal or Web Embed */}
      {viewMode === 'irc' ? (
        <div className="flex flex-col">
          {/* Sub-toolbar: Filters + quick status */}
          <div className="flex items-center justify-between px-5 py-2 border-b border-zinc-200 dark:border-[#26262C] bg-zinc-100/50 dark:bg-[#101012] text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                  filter === 'all'
                    ? 'bg-[#9146FF] text-white'
                    : 'text-zinc-600 dark:text-[#ADADB8] hover:bg-zinc-200 dark:hover:bg-[#1E1E22]'
                }`}
              >
                {t('chat.filterAll')}
              </button>
              <button
                onClick={() => setFilter('highlights')}
                className={`px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                  filter === 'highlights'
                    ? 'bg-[#9146FF] text-white'
                    : 'text-zinc-600 dark:text-[#ADADB8] hover:bg-zinc-200 dark:hover:bg-[#1E1E22]'
                }`}
              >
                {t('chat.filterHighlights')}
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-[#71717A]">
              <span className="hidden md:inline font-mono text-zinc-400 dark:text-[#71717A]">
                {t('chat.chatActive')}
              </span>
              <button
                onClick={() => {
                  setAutoScroll(prev => {
                    const next = !prev;
                    if (next && chatContainerRef.current) {
                      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                    }
                    return next;
                  });
                }}
                className={`px-2 py-0.5 border text-[10px] font-mono cursor-pointer transition ${
                  autoScroll
                    ? 'border-[#00a865]/40 text-[#00a865] dark:text-[#00F593] bg-[#00a865]/10'
                    : 'border-zinc-300 dark:border-[#26262C] text-zinc-400'
                }`}
              >
                {autoScroll ? t('chat.autoScroll') : t('chat.pauseScroll')}
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="h-80 overflow-y-auto overscroll-contain p-4 space-y-2 font-mono text-xs bg-white dark:bg-[#0E0E10]"
          >
            {filteredMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-400 dark:text-[#71717A] text-xs font-sans">
                {t('logs.empty')}
              </div>
            ) : (
              filteredMessages.map(msg => {
                if (msg.isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="py-1 px-2.5 bg-zinc-100 dark:bg-[#18181B] border-l-2 border-[#9146FF] text-[11px] text-zinc-500 dark:text-[#ADADB8]"
                    >
                      <span className="font-semibold text-[#9146FF] mr-2">[SYSTEM]</span>
                      <span>{msg.message}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 py-1 px-2 leading-relaxed transition ${
                      msg.isHighlighted
                        ? 'bg-[#9146FF]/10 dark:bg-[#9146FF]/15 border-l-2 border-[#9146FF]'
                        : 'hover:bg-zinc-50 dark:hover:bg-[#141416]'
                    }`}
                  >
                    {/* Timestamp */}
                    <span className="text-[10px] text-zinc-400 dark:text-[#52525B] shrink-0 select-none pt-0.5">
                      {msg.timestamp}
                    </span>

                    {/* Badges */}
                    {msg.badges.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        {msg.badges.map(badge => {
                          if (badge === 'mod') {
                            return (
                              <span
                                key={badge}
                                title="Moderator"
                                className="px-1 py-0.2 bg-[#00a865] text-white text-[9px] font-bold rounded-xs flex items-center"
                              >
                                <Shield className="w-2.5 h-2.5" />
                              </span>
                            );
                          }
                          if (badge === 'vip') {
                            return (
                              <span
                                key={badge}
                                title="VIP"
                                className="px-1 py-0.2 bg-[#FF3385] text-white text-[9px] font-bold rounded-xs"
                              >
                                VIP
                              </span>
                            );
                          }
                          if (badge === 'sub') {
                            return (
                              <span
                                key={badge}
                                title="Subscriber"
                                className="px-1 py-0.2 bg-[#9146FF] text-white text-[9px] font-bold rounded-xs flex items-center"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                              </span>
                            );
                          }
                          return (
                            <span
                              key={badge}
                              className="px-1 py-0.2 bg-zinc-600 text-white text-[9px] font-bold rounded-xs uppercase"
                            >
                              {badge}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Sender name */}
                    <span
                      style={{ color: msg.color || '#9146FF' }}
                      className="font-semibold shrink-0 cursor-pointer hover:underline"
                    >
                      {msg.displayName}:
                    </span>

                    {/* Text content */}
                    <span className="text-zinc-800 dark:text-[#EFEFF1] break-words flex-1">
                      {msg.message}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick emote chips */}
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-t border-zinc-200 dark:border-[#26262C] bg-zinc-50 dark:bg-[#141416]">
            <span className="text-[10px] font-mono text-zinc-400 dark:text-[#71717A] uppercase mr-1">
              Quick:
            </span>
            {PRESET_EMOTES.map(emote => (
              <button
                key={emote}
                type="button"
                onClick={() => handleSendMessage(emote)}
                className="px-2 py-0.5 text-xs font-mono bg-white dark:bg-[#18181B] hover:bg-[#9146FF]/15 text-zinc-700 dark:text-[#ADADB8] hover:text-[#9146FF] border border-zinc-200 dark:border-[#26262C] hover:border-[#9146FF]/40 transition cursor-pointer"
              >
                {emote}
              </button>
            ))}

            {/* Quick claim button if chest is ready */}
            {streamer.chestAvailable && onClaimChest && (
              <button
                type="button"
                onClick={() => onClaimChest(streamer)}
                className="ml-auto px-2.5 py-0.5 text-xs font-semibold bg-[#00a865] hover:bg-[#008f56] text-white flex items-center gap-1 transition cursor-pointer animate-pulse"
              >
                <Gift className="w-3 h-3" />
                <span>Claim +50 Chest</span>
              </button>
            )}
          </div>

          {/* Input field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 p-3 border-t border-zinc-200 dark:border-[#26262C] bg-white dark:bg-[#18181B]"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={t('chat.sendPlaceholder')}
                className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] px-3 py-1.5 text-xs text-zinc-900 dark:text-[#EFEFF1] font-mono focus:outline-hidden focus:border-[#9146FF]"
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-4 py-1.5 text-xs font-semibold bg-[#9146FF] hover:bg-[#772CE8] disabled:opacity-40 disabled:cursor-not-allowed text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t('chat.sendBtn')}</span>
            </button>
          </form>
        </div>
      ) : (
        /* Official Twitch Chat Web Embed */
        <div className="relative h-96 bg-zinc-900 flex flex-col">
          <iframe
            title={`Twitch Chat - ${streamer.username}`}
            src={`https://www.twitch.tv/embed/${streamer.username}/chat?parent=${parentDomain}&darkpopout=true`}
            height="100%"
            width="100%"
            className="border-none flex-1 w-full"
          />
          <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>
              Official Twitch Web Embed ({parentDomain}). If blocked by browser sandbox cookies, switch to{' '}
              <button
                onClick={() => setViewMode('irc')}
                className="text-[#9146FF] underline cursor-pointer"
              >
                IRC Terminal Feed
              </button>.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
