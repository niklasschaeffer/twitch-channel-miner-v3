import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  ArrowUpDown,
  Search,
  Trash2,
  Flame,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Terminal,
  Power,
  ExternalLink,
  Gift,
  RefreshCw
} from 'lucide-react';
import { Streamer, PriorityMode } from '../types';
import { formatSubTier } from '../lib/badges';

interface StreamerListProps {
  streamers: Streamer[];
  priorityMode: PriorityMode;
  onChangePriorityMode: (mode: PriorityMode) => void;
  onToggleEnabled: (username: string, enabled: boolean) => void;
  onDeleteStreamer: (username: string) => void;
  onAddStreamerClick: () => void;
  onRefreshLive?: () => void;
  isRefreshingLive?: boolean;
  onMovePriority: (username: string, direction: 'up' | 'down') => void;
  selectedStreamerId?: string | null;
  onSelectStreamer?: (streamerId: string) => void;
  onToggleLive?: (username: string) => void;
  onFilterConsole?: (channel: string) => void;
}

export const StreamerList: React.FC<StreamerListProps> = ({
  streamers,
  priorityMode,
  onChangePriorityMode,
  onToggleEnabled,
  onDeleteStreamer,
  onAddStreamerClick,
  onRefreshLive,
  isRefreshingLive,
  onMovePriority,
  selectedStreamerId,
  onSelectStreamer,
  onToggleLive,
  onFilterConsole
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filteredStreamers = streamers.filter(s =>
    s.displayName.toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase()) ||
    s.game.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-5 shadow-xs flex flex-col h-[600px]">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-[#26262C]">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-[#26262C] text-[#9146FF]">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1] truncate">
                {t('streamersList.title')}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-[#ADADB8] truncate">
                {t('streamersList.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onRefreshLive && (
            <button
              onClick={onRefreshLive}
              disabled={isRefreshingLive}
              title={t('actions.refreshLive')}
              className="p-1.5 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-[#26262C] dark:hover:bg-[#363640] text-zinc-700 dark:text-[#EFEFF1] transition flex items-center gap-1 cursor-pointer border border-zinc-200 dark:border-[#363640] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingLive ? 'animate-spin text-[#9146FF]' : ''}`} />
            </button>
          )}

          <button
            onClick={onAddStreamerClick}
            className="px-3 py-1.5 text-xs font-semibold bg-[#9146FF] hover:bg-[#772CE8] text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('actions.addChannel')}</span>
          </button>
        </div>
      </div>

      {/* Filter & Strategy Toolbar */}
      <div className="py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-b border-zinc-200 dark:border-[#26262C]">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-[#71717A] absolute left-2.5 top-2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('streamersList.filterPlaceholder', 'Filter monitored channels...')}
            className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-200 dark:border-[#26262C] pl-8 pr-2.5 py-1 text-xs text-zinc-900 dark:text-[#EFEFF1] placeholder-zinc-400 dark:placeholder-[#71717A] focus:outline-hidden focus:border-[#9146FF] transition"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#0E0E10] px-2.5 py-1 border border-zinc-200 dark:border-[#26262C] text-xs shrink-0">
          <ArrowUpDown className="w-3 h-3 text-zinc-500 dark:text-[#ADADB8]" />
          <span className="text-zinc-500 dark:text-[#ADADB8] text-[11px]">
            {t('streamersList.strategy', 'Strategy')}:
          </span>
          <select
            value={priorityMode}
            onChange={e => onChangePriorityMode(e.target.value as PriorityMode)}
            className="bg-transparent text-zinc-900 dark:text-[#EFEFF1] font-medium text-xs focus:outline-hidden cursor-pointer"
          >
            <option value="points_asc">{t('settings.priorityAsc')}</option>
            <option value="points_desc">{t('settings.priorityDesc')}</option>
            <option value="streak">{t('settings.priorityStreak')}</option>
            <option value="manual">{t('settings.priorityManual')}</option>
          </select>
        </div>
      </div>

      {/* Streamers Scrollable List */}
      <div className="flex-1 overflow-y-auto my-2 space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-[#26262C]">
        {filteredStreamers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-12 text-center text-xs text-zinc-400 dark:text-[#71717A] bg-zinc-50/50 dark:bg-[#0E0E10]/30 border border-dashed border-zinc-200 dark:border-[#26262C] p-4">
            <Users className="w-8 h-8 text-zinc-300 dark:text-[#363640] mb-2" />
            <p className="font-semibold text-zinc-700 dark:text-[#ADADB8]">{t('streamersList.emptyTitle')}</p>
            <p className="mt-1 max-w-xs">{t('streamersList.emptyDesc')}</p>
          </div>
        ) : (
          filteredStreamers.map((streamer, index) => {
            const isSelected = selectedStreamerId === streamer.id;
            return (
              <div
                key={streamer.id}
                onClick={() => onSelectStreamer?.(streamer.id)}
                className={`p-3 border transition flex flex-col gap-2.5 cursor-pointer relative ${
                  isSelected
                    ? 'ring-2 ring-[#9146FF] bg-purple-50/25 dark:bg-[#9146FF]/10 border-[#9146FF]/60'
                    : streamer.isMining
                    ? 'bg-[#00a865]/5 dark:bg-[#00F593]/5 border-[#00a865]/35 dark:border-[#00F593]/35 hover:border-[#00a865]/60'
                    : streamer.enabled
                    ? 'bg-zinc-50 dark:bg-[#141416] border-zinc-200 dark:border-[#26262C] hover:border-zinc-300 dark:hover:border-[#363640]'
                    : 'bg-zinc-100/60 dark:bg-[#0E0E10]/50 border-zinc-200/60 dark:border-[#26262C]/60 opacity-60'
                }`}
              >
                {/* Row 1: Profile identity & action toolbar */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    {/* Manual reordering handles */}
                    {priorityMode === 'manual' && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="flex flex-col gap-0.5 text-zinc-400 dark:text-[#71717A] shrink-0"
                      >
                        <button
                          onClick={() => onMovePriority(streamer.username, 'up')}
                          disabled={index === 0}
                          className="hover:text-zinc-900 dark:hover:text-[#EFEFF1] disabled:opacity-20 cursor-pointer p-0.5"
                          title="Move up in priority"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onMovePriority(streamer.username, 'down')}
                          disabled={index === filteredStreamers.length - 1}
                          className="hover:text-zinc-900 dark:hover:text-[#EFEFF1] disabled:opacity-20 cursor-pointer p-0.5"
                          title="Move down in priority"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Avatar with Live pulse */}
                    <div className="relative shrink-0">
                      <img
                        src={streamer.avatar}
                        alt={streamer.displayName}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 object-cover border border-zinc-300 dark:border-[#26262C]"
                      />
                      {streamer.isLive ? (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                        </span>
                      ) : (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-zinc-400 rounded-full" />
                      )}
                    </div>

                    {/* Name & Handle */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-zinc-900 dark:text-[#EFEFF1] truncate">
                          {streamer.displayName}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-[#71717A] font-mono truncate hidden sm:inline">
                          @{streamer.username}
                        </span>
                        {streamer.isFollowing && (
                          <span
                            title={t('streamersList.badgeFollow')}
                            className="text-[9px] leading-none px-1 py-0.5 bg-[#9146FF]/15 text-[#9146FF] dark:text-[#c299ff] font-bold shrink-0"
                          >
                            {t('streamersList.badgeFollow')}
                          </span>
                        )}
                        {typeof streamer.subscriptionTier === 'string' && streamer.subscriptionTier.length > 0 && (
                          <span
                            title={t('streamersList.badgeSubTier', { tier: formatSubTier(streamer.subscriptionTier) })}
                            className="text-[9px] leading-none px-1 py-0.5 bg-[#00a865]/15 dark:bg-[#00F593]/20 text-[#00a865] dark:text-[#00F593] font-bold shrink-0"
                          >
                            {t('streamersList.badgeSubTier', { tier: formatSubTier(streamer.subscriptionTier) })}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-[#ADADB8] truncate">
                        {streamer.game || 'Variety'}
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div
                    onClick={e => e.stopPropagation()}
                    className="flex items-center space-x-1 shrink-0"
                  >
                    {/* Chat button */}
                    <button
                      onClick={() => onSelectStreamer?.(streamer.id)}
                      title={t('ircChat.openChat', 'Open IRC Chat')}
                      className={`px-2 py-1 text-[11px] font-mono border transition cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-[#9146FF] text-white border-[#9146FF]'
                          : 'bg-white dark:bg-[#18181B] text-zinc-700 dark:text-[#ADADB8] border-zinc-200 dark:border-[#26262C] hover:border-[#9146FF] hover:text-[#9146FF]'
                      }`}
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Chat</span>
                    </button>

                    {/* Filter Console */}
                    {onFilterConsole && (
                      <button
                        onClick={() => onFilterConsole(streamer.username)}
                        title={t('ircChat.filterConsole', 'Filter console')}
                        className="p-1.5 text-zinc-500 hover:text-[#9146FF] border border-zinc-200 dark:border-[#26262C] bg-white dark:bg-[#18181B] hover:border-[#9146FF] transition cursor-pointer"
                      >
                        <Terminal className="w-3 h-3" />
                      </button>
                    )}

                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => onToggleEnabled(streamer.username, !streamer.enabled)}
                      className={`text-[10px] px-2 py-1 border transition cursor-pointer font-medium ${
                        streamer.enabled
                          ? 'bg-white dark:bg-[#18181B] text-zinc-800 dark:text-[#EFEFF1] border-zinc-300 dark:border-[#26262C] hover:bg-zinc-50 dark:hover:bg-[#1F1F23]'
                          : 'bg-zinc-100 dark:bg-[#0E0E10] text-zinc-400 dark:text-[#71717A] border-zinc-200 dark:border-[#26262C] hover:text-zinc-600'
                      }`}
                      title={streamer.enabled ? t('streamersList.active') : t('streamersList.disabled')}
                    >
                      {streamer.enabled ? t('streamersList.active') : t('streamersList.disabled')}
                    </button>

                    {/* External Twitch link */}
                    <a
                      href={`https://twitch.tv/${streamer.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('streamersList.openTwitch')}
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:text-[#71717A] dark:hover:text-[#EFEFF1] border border-zinc-200 dark:border-[#26262C] bg-white dark:bg-[#18181B] transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    {/* Delete button */}
                    <button
                      onClick={() => onDeleteStreamer(streamer.username)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition cursor-pointer"
                      title="Remove channel"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Status Chips & Priority */}
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                  {/* Priority rank */}
                  <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-[#1E1E22] text-zinc-600 dark:text-[#ADADB8] border border-zinc-200 dark:border-[#26262C] font-semibold">
                    #{index + 1}
                  </span>

                  {/* Live / Offline status toggle button */}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onToggleLive?.(streamer.username);
                    }}
                    title={t('ircChat.toggleLive', 'Click to toggle online/offline')}
                    className={`px-1.5 py-0.5 border transition cursor-pointer flex items-center gap-1 font-semibold ${
                      streamer.isLive
                        ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/25'
                        : 'bg-zinc-100 dark:bg-[#1E1E22] text-zinc-500 dark:text-[#71717A] border-zinc-300 dark:border-[#26262C] hover:bg-zinc-200'
                    }`}
                  >
                    <Power className="w-2.5 h-2.5" />
                    <span>{streamer.isLive ? t('streamersList.live') : t('streamersList.offline')}</span>
                  </button>

                  {/* Mining Status */}
                  {streamer.isMining ? (
                    <span className="px-1.5 py-0.5 bg-[#00a865]/15 dark:bg-[#00F593]/20 text-[#00a865] dark:text-[#00F593] border border-[#00a865]/30 dark:border-[#00F593]/40 flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00a865] dark:bg-[#00F593] animate-pulse" />
                      MINING (SLOT ACTIVE)
                    </span>
                  ) : streamer.isLive ? (
                    <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      STANDBY QUEUE
                    </span>
                  ) : null}

                  {/* Watch Streak */}
                  {streamer.watchStreak > 0 && (
                    <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Flame className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      {streamer.watchStreak}d streak
                    </span>
                  )}

                  {/* Selected Badge */}
                  {isSelected && (
                    <span className="px-1.5 py-0.5 bg-[#9146FF]/15 text-[#9146FF] dark:text-[#c299ff] border border-[#9146FF]/30 font-semibold">
                      INSPECTOR ACTIVE
                    </span>
                  )}
                </div>

                {/* Row 3: Metrics & Chest Status Bar */}
                <div className="pt-2 border-t border-zinc-200/70 dark:border-[#26262C]/70 flex items-center justify-between text-[11px] gap-2 flex-wrap">
                  {/* Left: Viewers if live, or Points balance */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#9146FF] font-bold">
                      {streamer.points.toLocaleString()} pts
                    </span>
                    {streamer.isLive && (
                      <span className="text-zinc-500 dark:text-[#ADADB8] font-mono text-[10px]">
                        • {streamer.viewerCount.toLocaleString()} {t('streamersList.viewers')}
                      </span>
                    )}
                  </div>

                  {/* Right: Chest timer or bonus claim */}
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    {streamer.chestAvailable ? (
                      <span className="px-1.5 py-0.5 bg-[#00a865]/15 dark:bg-[#00F593]/20 text-[#00a865] dark:text-[#00F593] border border-[#00a865]/40 font-bold flex items-center gap-1 animate-pulse">
                        <Gift className="w-3 h-3" />
                        Chest Ready (+50)
                      </span>
                    ) : (
                      <span className="text-zinc-500 dark:text-[#ADADB8]">
                        Chest: ~{streamer.nextChestEstimateSeconds}s
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Summary */}
      <div className="pt-3 border-t border-zinc-200 dark:border-[#26262C] flex items-center justify-between text-[11px] text-zinc-500 dark:text-[#ADADB8]">
        <span>
          Showing {filteredStreamers.length} channels • {filteredStreamers.filter(s => s.isLive).length} online • {filteredStreamers.filter(s => s.isMining).length} mining
        </span>
        <span className="font-mono font-medium text-zinc-600 dark:text-[#ADADB8]">
          Slots: {streamers.filter(s => s.isMining).length}/2
        </span>
      </div>
    </div>
  );
};
