import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { ActiveSlotsCard } from './components/ActiveSlotsCard';
import { StreamerList } from './components/StreamerList';
import { LiveConsole } from './components/LiveConsole';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsModal } from './components/SettingsModal';
import { AddStreamerModal } from './components/AddStreamerModal';
import { AuthModal } from './components/AuthModal';
import { SlotIrcChat } from './components/SlotIrcChat';
import {
  Streamer,
  MinerStatus,
  MinerSettings,
  LogEntry,
  AnalyticsData,
  PriorityMode,
  User
} from './types';

export default function App() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<MinerStatus | null>(null);
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<MinerSettings | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'settings'>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddStreamerOpen, setIsAddStreamerOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedSlotStreamerId, setSelectedSlotStreamerId] = useState<string | null>(null);

  const selectedStreamer = selectedSlotStreamerId
    ? streamers.find(s => s.id === selectedSlotStreamerId) || null
    : null;

  const handleSelectSlot = (streamer: Streamer) => {
    setSelectedSlotStreamerId(prev => (prev === streamer.id ? null : streamer.id));
  };

  // Theme support: Bright and Dark
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('twitch_miner_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('twitch_miner_theme', theme);
    } catch (e) {
      // Ignored
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // User session initialization
  useEffect(() => {
    try {
      const stored = localStorage.getItem('twitch_miner_user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to parse cached user', e);
    }

    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data && data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('twitch_miner_user', JSON.stringify(data.user));
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Initial fetch for all miner data
  const fetchData = useCallback(async () => {
    try {
      const [resStatus, resStreamers, resSettings, resLogs, resAnalytics] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/streamers').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/logs?limit=150').then(r => r.json()),
        fetch('/api/analytics').then(r => r.json())
      ]);

      setStatus(resStatus);
      setStreamers(resStreamers);
      setSettings(resSettings);
      setLogs(resLogs);
      setAnalytics(resAnalytics);
    } catch (err) {
      console.error('Failed to fetch miner telemetry', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time Server-Sent Events (SSE) connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource('/api/logs/stream');

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.addEventListener('log', (e: MessageEvent) => {
        try {
          const newLog: LogEntry = JSON.parse(e.data);
          setLogs(prev => [newLog, ...prev.slice(0, 499)]);
        } catch (err) {
          console.error('Failed to parse log event', err);
        }
      });

      eventSource.addEventListener('status', (e: MessageEvent) => {
        try {
          const newStatus: MinerStatus = JSON.parse(e.data);
          setStatus(newStatus);
        } catch (err) {
          console.error('Failed to parse status event', err);
        }
      });

      eventSource.addEventListener('streamers', (e: MessageEvent) => {
        try {
          const newStreamers: Streamer[] = JSON.parse(e.data);
          setStreamers(newStreamers);
        } catch (err) {
          console.error('Failed to parse streamers event', err);
        }
      });

      eventSource.addEventListener('settings', (e: MessageEvent) => {
        try {
          const newSettings: MinerSettings = JSON.parse(e.data);
          setSettings(newSettings);
        } catch (err) {
          console.error('Failed to parse settings event', err);
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
      };
    } catch (err) {
      console.warn('SSE not supported or failed, falling back to interval polling');
    }

    // Polling fallback every 3.5 seconds
    pollInterval = setInterval(() => {
      fetch('/api/status')
        .then(r => r.json())
        .then(data => setStatus(data))
        .catch(() => {});

      fetch('/api/streamers')
        .then(r => r.json())
        .then(data => setStreamers(data))
        .catch(() => {});

      fetch('/api/analytics')
        .then(r => r.json())
        .then(data => setAnalytics(data))
        .catch(() => {});
    }, 3500);

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Control handlers
  const handleTogglePlay = async () => {
    if (!status) return;
    const endpoint = status.state === 'running' ? '/api/miner/pause' : '/api/miner/start';
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (data.status) {
        setStatus(data.status);
        showToast(
          status.state === 'running'
            ? 'Miner paused. Active tasks suspended.'
            : 'Miner started! Prioritizing streams...'
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerTestClaim = async () => {
    setIsClaiming(true);
    try {
      const res = await fetch('/api/miner/test-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Claimed +50 Community Points on ${data.channel}!`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClaimSpecificStreamer = async (streamer: Streamer) => {
    try {
      const res = await fetch('/api/miner/test-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: streamer.username })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Claimed +50 Community Points on ${streamer.displayName}!`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (newSettings: Partial<MinerSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const data = await res.json();
      setSettings(data);
      showToast('Miner configuration updated.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangePriorityMode = async (mode: PriorityMode) => {
    await handleSaveSettings({ priorityMode: mode });
  };

  const handleToggleEnabled = async (username: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/streamers/${username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        setStreamers(prev =>
          prev.map(s => (s.username === username ? { ...s, enabled } : s))
        );
        showToast(`Streamer @${username} ${enabled ? 'enabled' : 'disabled'}.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStreamer = async (username: string) => {
    try {
      const res = await fetch(`/api/streamers/${username}`, { method: 'DELETE' });
      if (res.ok) {
        setStreamers(prev => prev.filter(s => s.username !== username));
        showToast(`Removed @${username} from watchlist.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddStreamer = async (username: string, displayName?: string) => {
    try {
      const res = await fetch('/api/streamers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName })
      });
      const newStreamer = await res.json();
      if (newStreamer && newStreamer.username) {
        setStreamers(prev => {
          if (prev.some(s => s.username === newStreamer.username)) return prev;
          return [...prev, newStreamer];
        });
        showToast(`Added @${newStreamer.displayName} to monitoring list.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMovePriority = (username: string, direction: 'up' | 'down') => {
    const idx = streamers.findIndex(s => s.username === username);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= streamers.length) return;

    const copy = [...streamers];
    const temp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = temp;

    copy.forEach((s, i) => {
      s.priority = i + 1;
    });
    setStreamers(copy);
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      setLogs([]);
      showToast('Console logs cleared.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUserAuth = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('twitch_miner_user', JSON.stringify(user));
    } catch (e) {
      // Ignored
    }
    showToast(`Welcome, ${user.username}!`);
  };

  const handleUserLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignored
    }
    setCurrentUser(null);
    try {
      localStorage.removeItem('twitch_miner_user');
    } catch (e) {
      // Ignored
    }
    showToast('Logged out successfully.');
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0E0E10] text-zinc-900 dark:text-[#EFEFF1] flex flex-col font-sans selection:bg-[#9146FF] selection:text-white transition-colors duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-white dark:bg-[#18181B] border border-zinc-300 dark:border-[#26262C] text-zinc-900 dark:text-[#EFEFF1] px-4 py-2.5 shadow-xl text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00a865] dark:bg-[#00F593]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Navigation */}
      <Header
        status={status}
        settings={settings}
        currentUser={currentUser}
        onTogglePlay={handleTogglePlay}
        onTriggerTestClaim={handleTriggerTestClaim}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isClaiming={isClaiming}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top KPI Metrics Bar */}
        <MetricsOverview status={status} />

        {/* Dynamic Views */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Active Mining Slots Cards */}
            <ActiveSlotsCard
              streamers={streamers}
              onClaim={handleClaimSpecificStreamer}
              maxSlots={settings?.maxConcurrentStreams || 2}
              selectedStreamerId={selectedSlotStreamerId}
              onSelectSlot={handleSelectSlot}
            />

            {/* IRC Chat of the Currently Actively Selected Watchslot Down Below */}
            {selectedStreamer && (
              <SlotIrcChat
                streamer={selectedStreamer}
                onClose={() => setSelectedSlotStreamerId(null)}
                onClaimChest={handleClaimSpecificStreamer}
                theme={theme}
              />
            )}

            {/* Split Grid: Streamer Queue on Left, Real-Time Console on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-6">
                <StreamerList
                  streamers={streamers}
                  priorityMode={settings?.priorityMode || 'points_asc'}
                  onChangePriorityMode={handleChangePriorityMode}
                  onToggleEnabled={handleToggleEnabled}
                  onDeleteStreamer={handleDeleteStreamer}
                  onAddStreamerClick={() => setIsAddStreamerOpen(true)}
                  onMovePriority={handleMovePriority}
                />
              </div>

              <div className="lg:col-span-7">
                <LiveConsole
                  logs={logs}
                  onClearLogs={handleClearLogs}
                  isConnected={isConnected}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView analytics={analytics} status={status} />
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-6 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-[#EFEFF1]">
              {t('settings.title')}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-[#ADADB8]">
              {t('settings.subtitle')}
            </p>
            {settings && (
              <div className="pt-2">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="px-4 py-2 text-xs font-semibold bg-[#9146FF] hover:bg-[#772CE8] text-white cursor-pointer transition"
                >
                  {t('actions.settings')}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      <AddStreamerModal
        isOpen={isAddStreamerOpen}
        onClose={() => setIsAddStreamerOpen(false)}
        onAdd={handleAddStreamer}
        existingUsernames={streamers.map(s => s.username.toLowerCase())}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={handleUserAuth}
        onLogout={handleUserLogout}
      />
    </div>
  );
}
