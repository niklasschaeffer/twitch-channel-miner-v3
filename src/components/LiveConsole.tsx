import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Terminal,
  Trash2,
  Download,
  Search,
  ArrowDown,
  Gift,
  Radio,
  Target,
  Sparkles,
  AlertTriangle,
  Flame,
  MessageSquare,
  X,
} from "lucide-react";
import { LogEntry, LogLevel } from "../types";

interface LiveConsoleProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  isConnected: boolean;
  selectedChannel?: string | null;
  onSelectChannel?: (channel: string | null) => void;
  availableChannels?: string[];
}

export const LiveConsole: React.FC<LiveConsoleProps> = ({
  logs,
  onClearLogs,
  isConnected,
  selectedChannel,
  onSelectChannel,
  availableChannels = [],
}) => {
  const { t } = useTranslation();
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== "ALL" && log.level !== filterLevel) {
      return false;
    }
    if (selectedChannel && log.channel) {
      if (log.channel.toLowerCase() !== selectedChannel.toLowerCase()) {
        return false;
      }
    } else if (selectedChannel && !log.channel) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchMessage = log.message.toLowerCase().includes(q);
      const matchChannel = log.channel ? log.channel.toLowerCase().includes(q) : false;
      return matchMessage || matchChannel;
    }
    return true;
  });

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case "CLAIM":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#9146FF]/15 text-[#9146FF] dark:text-[#c299ff] border border-[#9146FF]/40 flex items-center gap-1">
            <Gift className="w-2.5 h-2.5" />
            CLAIM
          </span>
        );
      case "WATCH":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#00a865]/15 dark:bg-[#00F593]/20 text-[#00a865] dark:text-[#00F593] border border-[#00a865]/30 dark:border-[#00F593]/40 flex items-center gap-1">
            <Radio className="w-2.5 h-2.5" />
            WATCH
          </span>
        );
      case "RAID":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <Flame className="w-2.5 h-2.5" />
            RAID
          </span>
        );
      case "CHAT":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#9146FF]/15 text-[#9146FF] dark:text-[#c299ff] border border-[#9146FF]/40 flex items-center gap-1">
            <MessageSquare className="w-2.5 h-2.5" />
            CHAT
          </span>
        );
      case "CMD":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
            <Terminal className="w-2.5 h-2.5" />
            CMD
          </span>
        );
      case "PREDICTION":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/40 flex items-center gap-1">
            <Target className="w-2.5 h-2.5" />
            PREDICT
          </span>
        );
      case "DROP":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-pink-500/15 text-pink-600 dark:text-pink-300 border border-pink-500/40 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            DROP
          </span>
        );
      case "WARN":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border border-yellow-500/40 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            WARN
          </span>
        );
      case "ERROR":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/40">
            ERROR
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-zinc-100 dark:bg-[#141416] text-zinc-600 dark:text-[#ADADB8] border border-zinc-200 dark:border-[#26262C]">
            INFO
          </span>
        );
    }
  };

  const handleExport = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.level}] ${l.channel ? `[${l.channel}] ` : ""}${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twitch-miner-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-5 shadow-xs flex flex-col h-[600px]">
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-[#26262C]">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-[#26262C] text-zinc-900 dark:text-[#EFEFF1]">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1]">
                {t("console.title")}
              </h2>
              <span className="flex items-center gap-1 text-[10px] font-mono text-[#00a865] dark:text-[#00F593] bg-[#00a865]/10 dark:bg-[#00F593]/15 px-1.5 py-0.5 border border-[#00a865]/20 dark:border-[#00F593]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a865] dark:bg-[#00F593] animate-pulse" />
                {isConnected ? t("console.sseConnected") : t("console.polling")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 text-[11px] border transition flex items-center gap-1 cursor-pointer font-medium ${
              autoScroll
                ? "bg-zinc-100 dark:bg-[#141416] text-zinc-900 dark:text-[#EFEFF1] border-zinc-300 dark:border-[#26262C]"
                : "bg-zinc-50 dark:bg-[#0E0E10] text-zinc-400 dark:text-[#71717A] border-zinc-200 dark:border-[#26262C] hover:text-zinc-600"
            }`}
            title={t("console.autoScrollTooltip")}
          >
            <ArrowDown
              className={`w-3 h-3 ${autoScroll ? "text-[#00a865] dark:text-[#00F593]" : ""}`}
            />
            <span>{t("console.autoScroll")}</span>
          </button>

          <button
            onClick={handleExport}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-[#ADADB8] dark:hover:text-[#EFEFF1] bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-[#26262C] transition cursor-pointer"
            title={t("console.downloadTooltip")}
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClearLogs}
            className="p-1.5 text-zinc-500 hover:text-red-500 dark:text-[#ADADB8] dark:hover:text-red-400 bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-[#26262C] transition cursor-pointer"
            title={t("console.clear")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Channel Bridge Selector Bar (Direct link to Monitored Channels) */}
      <div className="py-2 flex items-center gap-1.5 overflow-x-auto text-xs border-b border-zinc-200 dark:border-[#26262C] bg-zinc-50/50 dark:bg-[#121214] px-1">
        <span className="text-[11px] font-mono text-zinc-400 dark:text-[#71717A] shrink-0 mr-1">
          {t("logs.filterByChannel", "Channel")}:
        </span>
        <button
          onClick={() => onSelectChannel?.(null)}
          className={`px-2 py-0.5 text-[11px] font-mono shrink-0 transition cursor-pointer border ${
            !selectedChannel
              ? "bg-[#9146FF] text-white border-[#9146FF]"
              : "bg-white dark:bg-[#18181B] text-zinc-600 dark:text-[#ADADB8] border-zinc-200 dark:border-[#26262C] hover:border-[#9146FF]"
          }`}
        >
          {t("logs.allChannels", "All Channels")} ({logs.length})
        </button>

        {availableChannels.map((ch) => {
          const isSelected = selectedChannel?.toLowerCase() === ch.toLowerCase();
          const count = logs.filter((l) => l.channel?.toLowerCase() === ch.toLowerCase()).length;
          return (
            <button
              key={ch}
              onClick={() => onSelectChannel?.(isSelected ? null : ch)}
              className={`px-2 py-0.5 text-[11px] font-mono shrink-0 transition cursor-pointer border flex items-center gap-1 ${
                isSelected
                  ? "bg-[#9146FF] text-white border-[#9146FF] font-semibold"
                  : "bg-white dark:bg-[#18181B] text-zinc-600 dark:text-[#ADADB8] border-zinc-200 dark:border-[#26262C] hover:border-[#9146FF]"
              }`}
            >
              <span>#{ch}</span>
              <span
                className={`text-[9px] px-1 rounded-xs ${isSelected ? "bg-white/20 text-white" : "bg-zinc-100 dark:bg-[#26262C] text-zinc-400"}`}
              >
                {count}
              </span>
              {isSelected && <X className="w-2.5 h-2.5 ml-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Filter Tabs & Search */}
      <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-[#26262C]">
        <div className="flex items-center gap-1 overflow-x-auto text-[11px] no-scrollbar">
          {[
            { id: "ALL", label: t("console.filterAll") },
            { id: "CLAIM", label: t("console.filterClaims") },
            { id: "WATCH", label: t("console.filterWatch") },
            { id: "CHAT", label: t("console.filterChat") },
            { id: "CMD", label: t("console.filterBotCmds") },
            { id: "RAID", label: t("console.filterRaids") },
            { id: "PREDICTION", label: t("console.filterPreds") },
            { id: "DROP", label: t("console.filterDrops") },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterLevel(tab.id)}
              className={`px-2.5 py-1 font-medium whitespace-nowrap transition cursor-pointer ${
                filterLevel === tab.id
                  ? "bg-[#9146FF] text-white"
                  : "text-zinc-600 dark:text-[#ADADB8] hover:text-zinc-900 dark:hover:text-[#EFEFF1] hover:bg-zinc-100 dark:hover:bg-[#141416]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[180px]">
          <Search className="w-3 h-3 text-zinc-400 dark:text-[#71717A] absolute left-2.5 top-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("console.searchPlaceholder")}
            className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-200 dark:border-[#26262C] pl-7 pr-2 py-1 text-[11px] text-zinc-900 dark:text-[#EFEFF1] placeholder-zinc-400 dark:placeholder-[#71717A] focus:outline-hidden focus:border-[#9146FF]"
          />
        </div>
      </div>

      {/* Log Entries Container */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto mt-2 space-y-1.5 font-mono text-xs pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-[#26262C]"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400 dark:text-[#71717A] text-xs font-sans">
            {t("console.empty")}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            return (
              <div
                key={log.id}
                className="flex items-start gap-2 py-1 px-2 bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-200 dark:border-[#26262C] hover:border-zinc-300 dark:hover:border-[#363640] transition group"
              >
                {/* Timestamp */}
                <span className="text-[11px] text-zinc-400 dark:text-[#71717A] shrink-0 select-none pt-0.5">
                  [{timeStr}]
                </span>

                {/* Level Tag */}
                <span className="shrink-0">{getLevelBadge(log.level)}</span>

                {/* Channel Tag: clicking filters console to this channel */}
                {log.channel && (
                  <button
                    onClick={() => onSelectChannel?.(log.channel || null)}
                    title={t("console.channelFilterTooltip")}
                    className="text-[11px] text-[#9146FF] font-semibold shrink-0 bg-[#9146FF]/10 hover:bg-[#9146FF]/20 px-1 border border-[#9146FF]/30 cursor-pointer transition"
                  >
                    #{log.channel}
                  </button>
                )}

                {/* Message */}
                <span className="text-zinc-800 dark:text-[#EFEFF1] flex-1 break-words leading-relaxed text-[11px]">
                  {log.message}
                </span>

                {/* Points Delta Badge */}
                {log.pointsDelta && (
                  <span
                    className={`shrink-0 font-bold text-[11px] px-1.5 py-0.5 font-mono ${
                      log.pointsDelta > 0
                        ? "text-[#00a865] dark:text-[#00F593] bg-[#00a865]/10 dark:bg-[#00F593]/15 border border-[#00a865]/20 dark:border-[#00F593]/30"
                        : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30"
                    }`}
                  >
                    {log.pointsDelta > 0 ? `+${log.pointsDelta}` : log.pointsDelta} pts
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Terminal Footer Info */}
      <div className="pt-2 border-t border-zinc-200 dark:border-[#26262C] flex items-center justify-between text-[11px] text-zinc-400 dark:text-[#71717A]">
        <span>
          {t("console.showingEvents", { shown: filteredLogs.length, total: logs.length })}
          {selectedChannel && t("console.filteredToChannel", { channel: selectedChannel })}
        </span>
        <span className="font-mono text-zinc-500 dark:text-[#ADADB8]">
          {t("console.bufferMax", { max: 500 })}
        </span>
      </div>
    </div>
  );
};
