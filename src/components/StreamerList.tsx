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
  ChevronDown
} from 'lucide-react';
import { Streamer, PriorityMode } from '../types';

interface StreamerListProps {
  streamers: Streamer[];
  priorityMode: PriorityMode;
  onChangePriorityMode: (mode: PriorityMode) => void;
  onToggleEnabled: (username: string, enabled: boolean) => void;
  onDeleteStreamer: (username: string) => void;
  onAddStreamerClick: () => void;
  onMovePriority: (username: string, direction: 'up' | 'down') => void;
}

export const StreamerList: React.FC<StreamerListProps> = ({
  streamers,
  priorityMode,
  onChangePriorityMode,
  onToggleEnabled,
  onDeleteStreamer,
  onAddStreamerClick,
  onMovePriority
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filteredStreamers = streamers.filter(s =>
    s.displayName.toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase()) ||
    s.game.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-5 shadow-xs">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-[#9146FF]" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1]">
              {t('streamersList.title')}
            </h2>
          </div>
          <p className="text-xs text-zinc-500 dark:text-[#ADADB8] mt-0.5">
            {t('streamersList.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Priority Strategy dropdown */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#0E0E10] px-2.5 py-1.5 border border-zinc-200 dark:border-[#26262C] text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 dark:text-[#ADADB8]" />
            <span className="text-zinc-500 dark:text-[#ADADB8]">
              {t('streamersList.strategy')}:
            </span>
            <select
              value={priorityMode}
              onChange={e => onChangePriorityMode(e.target.value as PriorityMode)}
              className="bg-transparent text-zinc-900 dark:text-[#EFEFF1] font-medium focus:outline-hidden cursor-pointer"
            >
              <option value="points_asc">{t('settings.priorityAsc')}</option>
              <option value="points_desc">{t('settings.priorityDesc')}</option>
              <option value="streak">{t('settings.priorityStreak')}</option>
              <option value="manual">{t('settings.priorityManual')}</option>
            </select>
          </div>

          <button
            onClick={onAddStreamerClick}
            className="px-3 py-1.5 text-xs font-semibold bg-[#9146FF] hover:bg-[#772CE8] text-white transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('actions.addChannel')}</span>
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-zinc-400 dark:text-[#71717A] absolute left-3 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('streamersList.filterPlaceholder')}
          className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-200 dark:border-[#26262C] pl-9 pr-4 py-2 text-xs text-zinc-900 dark:text-[#EFEFF1] placeholder-zinc-400 dark:placeholder-[#71717A] focus:outline-hidden focus:border-[#9146FF] transition"
        />
      </div>

      {/* Streamers List */}
      <div className="space-y-2">
        {filteredStreamers.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400 dark:text-[#71717A] bg-zinc-50 dark:bg-[#0E0E10]/50 border border-dashed border-zinc-200 dark:border-[#26262C]">
            {t('streamersList.noChannels')}
          </div>
        ) : (
          filteredStreamers.map((streamer, index) => (
            <div
              key={streamer.id}
              className={`flex items-center justify-between p-3 border transition ${
                streamer.isMining
                  ? 'bg-[#00a865]/5 dark:bg-[#00F593]/5 border-[#00a865]/30 dark:border-[#00F593]/30'
                  : streamer.enabled
                  ? 'bg-zinc-50 dark:bg-[#141416] border-zinc-200 dark:border-[#26262C] hover:border-zinc-300 dark:hover:border-[#363640]'
                  : 'bg-zinc-100/50 dark:bg-[#0E0E10]/40 border-zinc-200 dark:border-[#26262C]/40 opacity-50'
              }`}
            >
              {/* Left Info */}
              <div className="flex items-center space-x-3 min-w-0">
                {/* Priority order controls if in manual mode */}
                {priorityMode === 'manual' && (
                  <div className="flex flex-col gap-0.5 text-zinc-400 dark:text-[#71717A]">
                    <button
                      onClick={() => onMovePriority(streamer.username, 'up')}
                      disabled={index === 0}
                      className="hover:text-zinc-900 dark:hover:text-[#EFEFF1] disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onMovePriority(streamer.username, 'down')}
                      disabled={index === filteredStreamers.length - 1}
                      className="hover:text-zinc-900 dark:hover:text-[#EFEFF1] disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="relative shrink-0">
                  <img
                    src={streamer.avatar}
                    alt={streamer.displayName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 object-cover border border-zinc-300 dark:border-[#26262C]"
                  />
                  {streamer.isLive && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-[#141416]" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-[#EFEFF1] truncate">
                      {streamer.displayName}
                    </span>
                    {streamer.isMining ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#00a865]/10 dark:bg-[#00F593]/15 text-[#00a865] dark:text-[#00F593] border border-[#00a865]/20 dark:border-[#00F593]/30 flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00a865] dark:bg-[#00F593] animate-pulse" />
                        Mining
                      </span>
                    ) : streamer.isLive ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 font-medium">
                        {t('streamersList.live')}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 dark:text-[#71717A] font-mono">
                        {t('streamersList.offline')}
                      </span>
                    )}

                    {streamer.watchStreak > 0 && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-300 flex items-center gap-0.5 font-mono">
                        <Flame className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        {streamer.watchStreak}d
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-[#ADADB8] mt-0.5">
                    <span className="truncate max-w-[140px]">{streamer.game}</span>
                    <span className="text-zinc-300 dark:text-[#363640]">•</span>
                    <span className="font-mono text-[#9146FF] font-semibold">
                      {streamer.points.toLocaleString()} pts
                    </span>
                    {streamer.isLive && (
                      <>
                        <span className="text-zinc-300 dark:text-[#363640]">•</span>
                        <span className="font-mono">
                          {streamer.viewerCount.toLocaleString()} {t('streamersList.viewers')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Actions */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => onToggleEnabled(streamer.username, !streamer.enabled)}
                  className={`text-xs px-2.5 py-1 border transition cursor-pointer font-medium ${
                    streamer.enabled
                      ? 'bg-white dark:bg-[#18181B] text-zinc-800 dark:text-[#EFEFF1] border-zinc-300 dark:border-[#26262C] hover:bg-zinc-50 dark:hover:bg-[#1F1F23]'
                      : 'bg-zinc-100 dark:bg-[#0E0E10] text-zinc-400 dark:text-[#71717A] border-zinc-200 dark:border-[#26262C] hover:text-zinc-600'
                  }`}
                  title={streamer.enabled ? t('streamersList.active') : t('streamersList.disabled')}
                >
                  {streamer.enabled ? t('streamersList.active') : t('streamersList.disabled')}
                </button>

                <button
                  onClick={() => onDeleteStreamer(streamer.username)}
                  className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition cursor-pointer"
                  title="Remove from monitoring"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
