import React from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import type { TooltipValueType } from "recharts";
import { TrendingUp, PieChart, Award, Zap, Trophy, Flame, Sparkles, Gift } from "lucide-react";
import {
  AnalyticsData,
  ClaimedDropReward,
  DropCampaignProgress,
  DropProgress,
  MinerStatus,
} from "../types";

interface AnalyticsViewProps {
  analytics: AnalyticsData | null;
  status: MinerStatus | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics, status }) => {
  const { t } = useTranslation();

  if (!analytics) {
    return (
      <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-8 text-center text-zinc-500 dark:text-[#ADADB8]">
        {t("analytics.noData")}
      </div>
    );
  }

  const { hourlyHistory, channelDistribution, categoryBreakdown, summary } = analytics;
  const totalEarned =
    summary.totalBonusChestPoints +
    summary.totalWatchTimePoints +
    summary.totalRaidPoints +
    summary.totalPredictionPoints;

  const isDarkMode =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <div className="space-y-6">
      {/* Top Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-4.5 shadow-xs">
          <div className="flex items-center space-x-2 text-[11px] font-semibold font-mono text-zinc-500 dark:text-[#ADADB8] mb-1">
            <Trophy className="w-4 h-4 text-[#9146FF]" />
            <span>{t("analytics.primarySource")}</span>
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-[#EFEFF1] mt-1">
            {t("analytics.chestsTitle")}
          </p>
          <p className="text-xs text-zinc-500 dark:text-[#ADADB8] mt-1">
            {t("analytics.chestsDesc", {
              points: summary.totalBonusChestPoints.toLocaleString(),
              pct: Math.round((summary.totalBonusChestPoints / (totalEarned || 1)) * 100),
            })}
          </p>
        </div>

        <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-4.5 shadow-xs">
          <div className="flex items-center space-x-2 text-[11px] font-semibold font-mono text-zinc-500 dark:text-[#ADADB8] mb-1">
            <Flame className="w-4 h-4 text-amber-500 dark:text-amber-300" />
            <span>{t("analytics.raidEfficiency")}</span>
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-[#EFEFF1] mt-1">
            {t("analytics.raidsCaught", { points: summary.totalRaidPoints.toLocaleString() })}
          </p>
          <p className="text-xs text-zinc-500 dark:text-[#ADADB8] mt-1">
            {t("analytics.raidsDesc", { count: status?.totalRaids || 0 })}
          </p>
        </div>

        <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-4.5 shadow-xs">
          <div className="flex items-center space-x-2 text-[11px] font-semibold font-mono text-zinc-500 dark:text-[#ADADB8] mb-1">
            <Zap className="w-4 h-4 text-[#00a865] dark:text-[#00F593]" />
            <span>{t("analytics.estimatedYield")}</span>
          </div>
          <p className="text-xl font-bold text-[#00a865] dark:text-[#00F593] font-mono mt-1">
            ~10,800 pts / day
          </p>
          <p className="text-xs text-zinc-500 dark:text-[#ADADB8] mt-1">
            {t("analytics.dailyRateDesc")}
          </p>
        </div>
      </div>

      {/* Hourly History Timeline Chart */}
      <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#9146FF]" />
              {t("analytics.hourlyChartTitle")}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-[#ADADB8] mt-0.5">
              {t("analytics.hourlyChartSubtitle")}
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyHistory} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9146FF" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#9146FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDarkMode ? "#26262C" : "#E4E4E7"}
                vertical={false}
              />
              <XAxis dataKey="time" stroke="#71717A" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717A" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDarkMode ? "#18181B" : "#FFFFFF",
                  borderColor: isDarkMode ? "#26262C" : "#E4E4E7",
                  borderRadius: "0.25rem",
                  fontSize: "12px",
                }}
                labelStyle={{ color: isDarkMode ? "#EFEFF1" : "#18181B", fontWeight: 600 }}
                itemStyle={{ color: "#9146FF" }}
                formatter={(value: TooltipValueType | undefined) => [
                  `${value ?? "–"} pts`,
                  "Points",
                ]}
              />
              <Area
                type="monotone"
                dataKey="points"
                stroke="#9146FF"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#purpleGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Earnings Breakdown & Channel Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown by Category */}
        <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1] flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-[#9146FF]" />
            {t("analytics.sourceBreakdown")}
          </h3>

          <div className="space-y-3.5">
            {categoryBreakdown.map((item) => {
              const pct = Math.round((item.points / (totalEarned || 1)) * 100);
              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-800 dark:text-[#EFEFF1] font-medium">
                      {item.name}
                    </span>
                    <span className="font-mono text-zinc-500 dark:text-[#ADADB8]">
                      {item.points.toLocaleString()} pts ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 dark:bg-[#0E0E10] overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Per-Channel Distribution */}
        <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1] flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-[#9146FF]" />
            {t("analytics.channelDist")}
          </h3>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={channelDistribution}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDarkMode ? "#26262C" : "#E4E4E7"}
                  horizontal={false}
                />
                <XAxis type="number" stroke="#71717A" fontSize={11} tickLine={false} />
                <YAxis
                  dataKey="channel"
                  type="category"
                  stroke="#71717A"
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? "#18181B" : "#FFFFFF",
                    borderColor: isDarkMode ? "#26262C" : "#E4E4E7",
                    borderRadius: "0.25rem",
                    fontSize: "12px",
                  }}
                  formatter={(value: TooltipValueType | undefined) => [
                    `${value ?? "–"} pts`,
                    "Balance",
                  ]}
                />
                <Bar dataKey="points" fill="#9146FF" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-500 dark:text-pink-300" />
              {t("analytics.dropsTitle")}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-[#ADADB8] mt-0.5">
              {t("analytics.dropsSubtitle", { count: status?.totalDropsClaimed ?? 0 })}
            </p>
          </div>
          {status?.lastDropSyncAt && (
            <span className="text-[11px] font-mono text-zinc-500 dark:text-[#ADADB8]">
              {t("analytics.dropsLastSync", {
                time: new Date(status.lastDropSyncAt).toLocaleTimeString(),
              })}
            </span>
          )}
        </div>

        {!status?.lastDropSyncAt ? (
          <p className="text-xs text-zinc-500 dark:text-[#ADADB8]">{t("analytics.dropsPending")}</p>
        ) : status.activeDropCampaigns.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-[#ADADB8]">{t("analytics.dropsNone")}</p>
        ) : (
          <div className="space-y-5">
            {status.activeDropCampaigns.map((campaign: DropCampaignProgress) => (
              <div key={campaign.campaignId} className="flex gap-3">
                {campaign.gameBoxArtUrl && (
                  <img
                    src={campaign.gameBoxArtUrl}
                    alt={campaign.game}
                    className="w-10 h-[53px] object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0 space-y-2.5">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-[#EFEFF1] truncate">
                      {campaign.name}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-[#ADADB8]">
                      {campaign.game}
                      {campaign.endsAt &&
                        ` · ${t("analytics.dropsEnds", {
                          time: new Date(campaign.endsAt).toLocaleString(),
                        })}`}
                    </p>
                  </div>
                  {campaign.drops.map((drop: DropProgress) => {
                    const pct =
                      drop.requiredMinutes > 0
                        ? Math.min(
                            100,
                            Math.round((drop.currentMinutes / drop.requiredMinutes) * 100),
                          )
                        : 100;
                    const ready = !drop.isClaimed && drop.currentMinutes >= drop.requiredMinutes;
                    return (
                      <div key={drop.dropId} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-zinc-800 dark:text-[#EFEFF1] font-medium truncate">
                            {drop.name}
                          </span>
                          <span className="font-mono text-zinc-500 dark:text-[#ADADB8] shrink-0">
                            {drop.isClaimed
                              ? t("analytics.dropsClaimed")
                              : ready
                                ? t("analytics.dropsReady")
                                : t("analytics.dropsMinutes", {
                                    current: drop.currentMinutes,
                                    required: drop.requiredMinutes,
                                  })}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 dark:bg-[#0E0E10] overflow-hidden">
                          <div
                            className="h-full bg-pink-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-5 shadow-xs">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1] flex items-center gap-2">
            <Gift className="w-4 h-4 text-pink-500 dark:text-pink-300" />
            {t("analytics.claimedDropsTitle")}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-[#ADADB8] mt-0.5">
            {t("analytics.claimedDropsSubtitle", {
              count: status?.claimedDropRewards.length ?? 0,
            })}
          </p>
        </div>

        {!status?.lastDropSyncAt ? (
          <p className="text-xs text-zinc-500 dark:text-[#ADADB8]">{t("analytics.dropsPending")}</p>
        ) : status.claimedDropRewards.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-[#ADADB8]">
            {t("analytics.claimedDropsNone")}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {status.claimedDropRewards.map((reward: ClaimedDropReward) => (
              <div
                key={reward.id}
                className="flex items-center gap-3 border border-zinc-200 dark:border-[#26262C] p-2.5"
              >
                {reward.imageUrl ? (
                  <img
                    src={reward.imageUrl}
                    alt={reward.name}
                    className="w-12 h-12 object-contain shrink-0 bg-zinc-100 dark:bg-[#0E0E10]"
                  />
                ) : (
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-zinc-100 dark:bg-[#0E0E10]">
                    <Gift className="w-5 h-5 text-zinc-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-900 dark:text-[#EFEFF1] truncate">
                    {reward.name}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-500 dark:text-[#ADADB8]">
                    {new Date(reward.lastAwardedAt).toLocaleDateString()}
                  </p>
                </div>
                {reward.totalCount > 1 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-pink-500/15 text-pink-600 dark:text-pink-300 border border-pink-500/40 shrink-0">
                    {t("analytics.claimedDropsTimes", { count: reward.totalCount })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
