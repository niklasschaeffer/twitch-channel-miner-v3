import React from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Trophy, ArrowUpRight, Zap, Target, Swords } from 'lucide-react';
import { MinerStatus, AnalyticsData } from '../types';

interface MetricsOverviewProps {
  status: MinerStatus | null;
  analytics: AnalyticsData | null;
}
export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ status, analytics }) => {
  const { t } = useTranslation();
  if (!status) return null;

  const uptimeHours = (status.uptimeSeconds / 3600).toFixed(1);
  const estimatedPerHour = status.uptimeSeconds > 60
    ? Math.round((status.totalPointsMined / status.uptimeSeconds) * 3600)
    : 450;

  const cards = [
    {
      id: 'metric-total-mined',
      label: t('stats.totalMined'),
      value: status.totalPointsMined.toLocaleString(),
      subtext: `+${status.pointsToday.toLocaleString()} ${t('stats.today').toLowerCase()}`,
      icon: Coins,
      accent: 'text-[#9146FF]',
      bgAccent: 'bg-[#9146FF]/10 border-[#9146FF]/30'
    },
    {
      id: 'metric-rate',
      label: t('stats.hourlyRate'),
      value: `~${estimatedPerHour.toLocaleString()}`,
      unit: 'pts / hr',
      subtext: `Uptime: ${uptimeHours}h`,
      icon: Zap,
      accent: 'text-[#00a865] dark:text-[#00F593]',
      bgAccent: 'bg-[#00a865]/10 dark:bg-[#00F593]/15 border-[#00a865]/20 dark:border-[#00F593]/30'
    },
    {
      id: 'metric-claims',
      label: t('stats.claimsCount'),
      value: status.totalClaims.toString(),
      subtext: t('stats.claimsDesc', { points: (analytics?.summary?.totalBonusChestPoints ?? 0).toLocaleString() }),
      icon: Trophy,
      accent: 'text-amber-500 dark:text-amber-300',
      bgAccent: 'bg-amber-500/10 border-amber-500/30'
    },
    {
      id: 'metric-predictions',
      label: t('stats.predictionsNet'),
      value: `${status.netPredictionPoints >= 0 ? '+' : ''}${status.netPredictionPoints.toLocaleString()}`,
      unit: 'pts',
      subtext: `${status.totalPredictionsWon}/${status.totalPredictionsPlaced}`,
      icon: Target,
      accent: 'text-sky-600 dark:text-sky-300',
      bgAccent: 'bg-sky-500/10 border-sky-500/30'
    },
    {
      id: 'metric-raids',
      label: t('stats.raidsCount'),
      value: (analytics?.summary?.totalRaidPoints ?? 0).toLocaleString(),
      unit: 'pts',
      subtext: t('analytics.raidsDesc', { count: status.totalRaids }),
      icon: Swords,
      accent: 'text-rose-600 dark:text-rose-300',
      bgAccent: 'bg-rose-500/10 border-rose-500/30'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div
            id={card.id}
            key={card.id}
            className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] hover:border-zinc-300 dark:hover:border-[#363640] p-4.5 shadow-xs transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-[#ADADB8] uppercase tracking-wider font-mono">
                {card.label}
              </span>
              <div className={`p-2 border ${card.bgAccent} ${card.accent}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-zinc-900 dark:text-[#EFEFF1] font-mono tracking-tight">
                {card.value}
              </span>
              {card.unit && (
                <span className="text-xs text-zinc-500 dark:text-[#ADADB8] font-normal">
                  {card.unit}
                </span>
              )}
            </div>
            <div className="mt-2 text-xs text-zinc-500 dark:text-[#ADADB8] flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-[#00a865] dark:text-[#00F593] shrink-0" />
              <span className="truncate">{card.subtext}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
