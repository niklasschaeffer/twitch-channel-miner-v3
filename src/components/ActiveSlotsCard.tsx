import React from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Radio, Eye, Flame, MessageSquare } from 'lucide-react';
import { Streamer } from '../types';

interface ActiveSlotsCardProps {
  streamers: Streamer[];
  onClaim: (streamer: Streamer) => void;
  maxSlots: number;
  selectedStreamerId?: string | null;
  onSelectSlot?: (streamer: Streamer) => void;
}

export const ActiveSlotsCard: React.FC<ActiveSlotsCardProps> = ({
  streamers,
  onClaim,
  maxSlots = 2,
  selectedStreamerId,
  onSelectSlot
}) => {
  const { t } = useTranslation();
  const activeStreamers = streamers.filter(s => s.isMining && s.isLive);
  const slots = Array.from({ length: maxSlots });

  return (
    <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-[#9146FF]/15 text-[#9146FF] border border-[#9146FF]/30">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1]">
              {t('stats.activeSlots')}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-[#ADADB8]">
              {t('settings.concurrencyHint')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] text-zinc-400 dark:text-[#71717A] font-mono">
            {t('chat.clickForChat')}
          </span>
          <span className="text-xs font-mono text-zinc-600 dark:text-[#ADADB8] bg-zinc-50 dark:bg-[#0E0E10] px-2.5 py-1 border border-zinc-200 dark:border-[#26262C]">
            {activeStreamers.length} / {maxSlots}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {slots.map((_, index) => {
          const streamer = activeStreamers[index];

          if (!streamer) {
            return (
              <div
                key={`empty-slot-${index}`}
                className="border border-dashed border-zinc-300 dark:border-[#26262C] p-5 flex flex-col items-center justify-center text-center bg-zinc-50/50 dark:bg-[#0E0E10]/50 min-h-[160px]"
              >
                <div className="w-9 h-9 bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-[#26262C] flex items-center justify-center text-zinc-400 dark:text-[#71717A] mb-2">
                  <Radio className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-zinc-600 dark:text-[#ADADB8]">
                  Slot #{index + 1} Available
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-[#71717A] mt-1 max-w-xs">
                  {t('streamersList.subtitle')}
                </p>
              </div>
            );
          }

          const isSelected = selectedStreamerId === streamer.id;
          const secondsRemaining = streamer.nextChestEstimateSeconds;
          const totalCycle = 900;
          const progressPercent = Math.min(100, Math.max(0, Math.round(((totalCycle - secondsRemaining) / totalCycle) * 100)));
          const minutes = Math.floor(secondsRemaining / 60);
          const seconds = secondsRemaining % 60;
          const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

          return (
            <div
              key={streamer.id}
              onClick={() => onSelectSlot?.(streamer)}
              className={`relative overflow-hidden p-4.5 transition group cursor-pointer border ${
                isSelected
                  ? 'bg-[#9146FF]/5 dark:bg-[#9146FF]/10 border-[#9146FF] ring-2 ring-[#9146FF]/40 shadow-sm'
                  : 'bg-zinc-50 dark:bg-[#141416] border-zinc-200 dark:border-[#26262C] hover:border-[#9146FF]/60 hover:shadow-xs'
              }`}
            >
              {/* Slot pill & Chat Indicator */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 bg-[#00a865]/10 dark:bg-[#00F593]/15 text-[#00a865] dark:text-[#00F593] border border-[#00a865]/20 dark:border-[#00F593]/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00a865] dark:bg-[#00F593] animate-ping" />
                    Slot #{index + 1}
                  </span>
                  <span className="text-[11px] text-zinc-600 dark:text-[#ADADB8] bg-white dark:bg-[#18181B] px-2 py-0.5 border border-zinc-200 dark:border-[#26262C]">
                    {streamer.game}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {streamer.watchStreak > 0 && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 border border-amber-500/30 flex items-center gap-1 font-medium font-mono">
                      <Flame className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {t('streamersList.watchStreak', { days: streamer.watchStreak })}
                    </span>
                  )}
                  {isSelected ? (
                    <span className="text-[11px] font-mono font-semibold text-[#9146FF] bg-[#9146FF]/15 px-2 py-0.5 border border-[#9146FF]/30 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {t('chat.chatActive')}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-[#71717A] group-hover:text-[#9146FF] transition flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {t('chat.clickForChat')}
                    </span>
                  )}
                </div>
              </div>

              {/* Streamer details */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="relative">
                  <img
                    src={streamer.avatar}
                    alt={streamer.displayName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 object-cover border border-zinc-300 dark:border-[#26262C]"
                  />
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#00a865] dark:bg-[#00F593] border-2 border-white dark:border-[#141416]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1] truncate">
                      {streamer.displayName}
                    </h3>
                    <span className="text-xs text-zinc-400 dark:text-[#71717A] font-mono">@{streamer.username}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 dark:text-[#ADADB8]">
                    <span className="flex items-center gap-1 font-mono">
                      <Eye className="w-3 h-3 text-zinc-400 dark:text-[#71717A]" />
                      {streamer.viewerCount.toLocaleString()} {t('streamersList.viewers')}
                    </span>
                    <span className="text-zinc-300 dark:text-[#363640]">•</span>
                    <span className="font-mono text-[#9146FF] font-semibold">
                      {streamer.points.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              </div>

              {/* Bonus Chest Progress or Claim Action */}
              <div className="bg-white dark:bg-[#0E0E10] p-3 border border-zinc-200 dark:border-[#26262C]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-zinc-600 dark:text-[#ADADB8] flex items-center gap-1.5">
                    <Gift className={`w-3.5 h-3.5 ${streamer.chestAvailable ? 'text-[#00a865] dark:text-[#00F593] animate-bounce' : 'text-zinc-400 dark:text-[#71717A]'}`} />
                    {streamer.chestAvailable ? (
                      <span className="text-[#00a865] dark:text-[#00F593] font-semibold">Chest Ready (+50 pts)</span>
                    ) : (
                      <span>{t('streamersList.tableChest')}</span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-zinc-900 dark:text-[#EFEFF1]">
                    {streamer.chestAvailable ? 'Available Now' : timeFormatted}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-zinc-200 dark:bg-[#1F1F23] overflow-hidden mb-2">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      streamer.chestAvailable ? 'bg-[#00a865] dark:bg-[#00F593]' : 'bg-[#9146FF]'
                    }`}
                    style={{ width: `${streamer.chestAvailable ? 100 : progressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 dark:text-[#71717A]">
                    {t('stats.totalMined')}: <span className="text-zinc-900 dark:text-[#EFEFF1] font-mono">+{streamer.totalPointsMined.toLocaleString()}</span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClaim(streamer);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                      streamer.chestAvailable
                        ? 'bg-[#9146FF] hover:bg-[#772CE8] text-white font-semibold'
                        : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-[#18181B] dark:hover:bg-[#1F1F23] text-zinc-700 dark:text-[#ADADB8] border border-zinc-200 dark:border-[#26262C]'
                    }`}
                  >
                    <Gift className="w-3 h-3" />
                    <span>{streamer.chestAvailable ? 'Claim +50' : 'Force Claim'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

