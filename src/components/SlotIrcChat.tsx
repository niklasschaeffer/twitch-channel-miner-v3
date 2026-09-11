import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Send,
  Terminal,
  ExternalLink,
  Trash2,
  Gift,
  Eye,
  Shield,
  Sparkles,
  X,
  Flame,
} from "lucide-react";
import { Streamer, ChatMessage } from "../types";
import { formatSubTier } from "../lib/badges";
import { supportsChannelPoints } from "../lib/twitch";

interface SlotIrcChatProps {
  streamer: Streamer | null;
  allStreamers: Streamer[];
  onSelectStreamer: (streamerId: string) => void;
  onClaimChest?: (streamer: Streamer) => void;
  onFilterConsole?: (channel: string) => void;
  incomingChatMessage?: ChatMessage | null;
  onClose?: () => void;
  theme?: "light" | "dark";
}

const PRESET_EMOTES = ["PogChamp", "KEKW", "LUL", "GG", "monkaS", "EZ"];

const renderMessageWithEmotes = (msg: ChatMessage): React.ReactNode[] => {
  if (!msg.emotes || msg.emotes.length === 0) return [msg.message];
  const codePoints = Array.from(msg.message);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const emote of msg.emotes) {
    if (emote.start < cursor) continue;
    if (emote.start > cursor) nodes.push(codePoints.slice(cursor, emote.start).join(""));
    nodes.push(
      <img
        key={`${emote.id}-${emote.start}`}
        src={`/api/emotes/emote/${emote.id}`}
        alt={codePoints.slice(emote.start, emote.end + 1).join("")}
        className="inline-block h-5 align-text-bottom mx-0.5"
      />,
    );
    cursor = emote.end + 1;
  }
  if (cursor < codePoints.length) nodes.push(codePoints.slice(cursor).join(""));
  return nodes;
};

export const SlotIrcChat: React.FC<SlotIrcChatProps> = ({
  streamer,
  allStreamers,
  onSelectStreamer,
  onClaimChest,
  onFilterConsole,
  incomingChatMessage,
  onClose,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [filter, setFilter] = useState<"all" | "highlights">("all");
  const [viewMode, setViewMode] = useState<"irc" | "embed">("irc");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [badgeMap, setBadgeMap] = useState<Record<string, string>>({});
  const [failedBadges, setFailedBadges] = useState<Record<string, true>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Load chat history whenever selected streamer changes
  useEffect(() => {
    if (!streamer?.username) return;

    let isMounted = true;
    fetch(`/api/streamers/${streamer.username.toLowerCase()}/chat`)
      .then((res) => res.json())
      .then((data: ChatMessage[]) => {
        if (isMounted && Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [streamer?.username]);

  // Append real-time incoming messages from SSE
  useEffect(() => {
    if (!incomingChatMessage || !streamer?.username) return;
    if (incomingChatMessage.channel.toLowerCase() === streamer.username.toLowerCase()) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingChatMessage.id)) return prev;
        const next = [...prev, incomingChatMessage];
        if (next.length > 250) next.shift();
        return next;
      });
    }
  }, [incomingChatMessage, streamer?.username]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/emotes/badge-map")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("badge-map unavailable"))))
      .then((data: { sets: Record<string, string[]> }) => {
        if (!isMounted || !data || typeof data.sets !== "object") return;
        const map: Record<string, string> = {};
        for (const name of Object.keys(data.sets)) {
          map[name] = `/api/emotes/badge/${encodeURIComponent(`${name}/1`)}`;
        }
        setBadgeMap(map);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputText).trim();
    if (!text || !streamer?.username || isSending) return;

    setIsSending(true);
    setInputText("");

    try {
      const res = await fetch(`/api/streamers/${streamer.username.toLowerCase()}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          senderName: "You",
        }),
      });
      if (res.ok) {
        const sent: ChatMessage = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [...prev, sent];
        });
      }
    } catch (err) {
      console.error("Failed to send chat message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (filter === "highlights") {
      return (
        !msg.isBot &&
        (msg.isHighlighted ||
          msg.badges?.includes("moderator") ||
          msg.badges?.includes("vip") ||
          (streamer && msg.message.toLowerCase().includes(streamer.username.toLowerCase())))
      );
    }
    return true;
  });

  const parentDomain = typeof window !== "undefined" ? window.location.hostname : "localhost";

  if (!streamer) {
    return (
      <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] p-6 text-center shadow-xs">
        <MessageSquare className="w-8 h-8 text-[#9146FF] mx-auto mb-2 opacity-60" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1]">
          {t("chat.noChannelSelected", "No Channel Selected")}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-[#ADADB8] mt-1 max-w-md mx-auto">
          {t(
            "chat.selectChannelNotice",
            "Select any streamer from monitored channels below to inspect real-time IRC chat and test bot commands.",
          )}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {allStreamers.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelectStreamer(s.id)}
              className="px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-[#26262C] hover:border-[#9146FF] bg-zinc-50 dark:bg-[#0E0E10] text-zinc-800 dark:text-[#EFEFF1] transition flex items-center gap-1.5 cursor-pointer"
            >
              <span className={`w-2 h-2 rounded-full ${s.isLive ? "bg-red-500" : "bg-zinc-400"}`} />
              <span>{s.displayName}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] shadow-xs overflow-hidden min-w-0">
      {/* 1. Channel Selector Tab Bar (Direct Bridge to Monitored Channels) */}
      <div className="flex items-center gap-1 px-3 py-2 bg-zinc-100/70 dark:bg-[#121214] border-b border-zinc-200 dark:border-[#26262C] overflow-x-auto min-w-0">
        <span className="text-[11px] font-mono text-zinc-400 dark:text-[#71717A] shrink-0 mr-2 flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5 text-[#9146FF]" />
          <span>{t("chat.channelSelector", "Channels")}:</span>
        </span>
        {allStreamers.map((s) => {
          const isSelected = s.id === streamer.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelectStreamer(s.id)}
              className={`px-2.5 py-1 text-xs font-mono shrink-0 transition flex items-center gap-1.5 cursor-pointer border ${
                isSelected
                  ? "bg-white dark:bg-[#1E1E22] text-[#9146FF] border-[#9146FF] font-semibold shadow-xs"
                  : "bg-transparent text-zinc-600 dark:text-[#ADADB8] border-transparent hover:border-zinc-300 dark:hover:border-[#26262C] hover:bg-zinc-200/50 dark:hover:bg-[#18181B]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  s.isMining
                    ? "bg-[#00a865] dark:bg-[#00F593] animate-pulse"
                    : s.isLive
                      ? "bg-red-500"
                      : "bg-zinc-400"
                }`}
              />
              <span>{s.displayName}</span>
              {s.isFollowing && (
                <span
                  title={t("streamersList.badgeFollow")}
                  className="text-[9px] leading-none px-1 bg-[#9146FF]/15 text-[#9146FF] dark:text-[#c299ff] font-bold shrink-0"
                >
                  {t("streamersList.badgeFollow")}
                </span>
              )}
              {typeof s.subscriptionTier === "string" && s.subscriptionTier.length > 0 && (
                <span
                  title={t("streamersList.badgeSubTier", {
                    tier: formatSubTier(s.subscriptionTier),
                  })}
                  className="text-[9px] leading-none px-1 bg-[#00a865]/15 dark:bg-[#00F593]/20 text-[#00a865] dark:text-[#00F593] font-bold shrink-0"
                >
                  {t("streamersList.badgeSubTier", { tier: formatSubTier(s.subscriptionTier) })}
                </span>
              )}
              {s.isMining && (
                <span className="text-[9px] px-1 bg-[#00a865]/15 dark:bg-[#00F593]/20 text-[#00a865] dark:text-[#00F593] font-bold">
                  {t("status.activeMining")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Streamer Header & Live Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-zinc-200 dark:border-[#26262C] bg-zinc-50/50 dark:bg-[#141416]/70">
        {/* Streamer Avatar & Meta */}
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src={streamer.avatar}
              alt={streamer.displayName}
              referrerPolicy="no-referrer"
              className="w-11 h-11 object-cover border border-zinc-300 dark:border-[#26262C]"
            />
            {streamer.isLive ? (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-[#141416]" />
              </span>
            ) : (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-zinc-400 rounded-full border-2 border-white dark:border-[#141416]" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-zinc-900 dark:text-[#EFEFF1]">
                #{streamer.displayName}
              </span>
              {streamer.isFollowing && (
                <span
                  title={t("streamersList.badgeFollow")}
                  className="text-[9px] leading-none px-1 py-0.5 bg-[#9146FF]/15 text-[#9146FF] dark:text-[#c299ff] font-bold shrink-0"
                >
                  {t("streamersList.badgeFollow")}
                </span>
              )}
              {typeof streamer.subscriptionTier === "string" &&
                streamer.subscriptionTier.length > 0 && (
                  <span
                    title={t("streamersList.badgeSubTier", {
                      tier: formatSubTier(streamer.subscriptionTier),
                    })}
                    className="text-[9px] leading-none px-1 py-0.5 bg-[#00a865]/15 dark:bg-[#00F593]/20 text-[#00a865] dark:text-[#00F593] font-bold shrink-0"
                  >
                    {t("streamersList.badgeSubTier", {
                      tier: formatSubTier(streamer.subscriptionTier),
                    })}
                  </span>
                )}

              {/* Live / Offline status badge with 1-click toggle */}
              <span
                className={`px-2 py-0.5 text-[10px] font-mono font-semibold border flex items-center gap-1 ${
                  streamer.isLive
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                    : "bg-zinc-200 dark:bg-[#26262C] text-zinc-600 dark:text-[#ADADB8] border-zinc-300 dark:border-[#363640]"
                }`}
              >
                {streamer.isLive ? t("status.live") : t("status.offline")}
              </span>

              {/* Active Watch Slot status */}
              {streamer.isMining ? (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#00a865]/15 dark:bg-[#00F593]/20 text-[#00a865] dark:text-[#00F593] border border-[#00a865]/30 dark:border-[#00F593]/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00a865] dark:bg-[#00F593] animate-pulse" />
                  {t("status.activeMining")}
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-mono text-zinc-500 dark:text-[#71717A] border border-zinc-200 dark:border-[#26262C]">
                  {t("status.standby")}
                </span>
              )}

              {streamer.watchStreak > 0 && (
                <span className="text-[11px] font-mono text-amber-600 dark:text-amber-300 flex items-center gap-0.5">
                  <Flame className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {t("streamersList.watchStreak", { days: streamer.watchStreak })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-[#ADADB8] mt-1 flex-wrap">
              <span className="text-zinc-800 dark:text-[#EFEFF1] font-medium">{streamer.game}</span>
              <span className="text-zinc-300 dark:text-[#363640]">•</span>
              <span className="font-mono text-[#9146FF] font-semibold">
                {streamer.points.toLocaleString()} pts
              </span>
              {streamer.isLive && (
                <>
                  <span className="text-zinc-300 dark:text-[#363640]">•</span>
                  <span className="font-mono flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {streamer.viewerCount.toLocaleString()} {t("streamersList.viewers")}
                  </span>
                </>
              )}
              <span className="text-zinc-300 dark:text-[#363640]">•</span>
              <span className="font-mono text-zinc-400 dark:text-[#71717A]">
                {supportsChannelPoints(streamer)
                  ? t("chat.nextChestEta", { seconds: streamer.nextChestEstimateSeconds })
                  : t("streamersList.noChestFeature")}
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Claim Chest Button */}
          {!supportsChannelPoints(streamer) ? null : streamer.chestAvailable ? (
            <button
              onClick={() => onClaimChest?.(streamer)}
              className="px-3 py-1.5 text-xs font-semibold bg-[#00a865] hover:bg-[#008f56] text-white transition flex items-center gap-1.5 cursor-pointer animate-pulse"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>{t("chest.claim")}</span>
            </button>
          ) : (
            <button
              onClick={() => onClaimChest?.(streamer)}
              className="px-2.5 py-1 text-xs font-medium border border-zinc-200 dark:border-[#26262C] hover:border-[#9146FF] text-zinc-700 dark:text-[#ADADB8] hover:text-[#9146FF] transition flex items-center gap-1 cursor-pointer"
            >
              <Gift className="w-3 h-3 text-[#9146FF]" />
              <span>{t("chest.testClaim")}</span>
            </button>
          )}

          {/* Filter Console to this channel */}
          {onFilterConsole && (
            <button
              onClick={() => onFilterConsole(streamer.username)}
              title={t("chat.filterConsole", "Filter Console to this channel")}
              className="px-2.5 py-1 text-xs font-medium border border-zinc-200 dark:border-[#26262C] hover:border-[#9146FF] text-zinc-700 dark:text-[#ADADB8] hover:text-[#9146FF] transition flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal className="w-3 h-3" />
              <span className="hidden sm:inline">{t("chat.focusConsole")}</span>
            </button>
          )}

          {/* View mode toggle (IRC Terminal vs Official Twitch Embed) */}
          <div className="flex border border-zinc-200 dark:border-[#26262C] p-0.5 bg-zinc-100 dark:bg-[#0E0E10]">
            <button
              onClick={() => setViewMode("irc")}
              className={`px-2 py-0.5 text-xs font-mono transition cursor-pointer ${
                viewMode === "irc"
                  ? "bg-white dark:bg-[#18181B] text-[#9146FF] font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-[#EFEFF1]"
              }`}
            >
              {t("chat.ircFeedTab")}
            </button>
            <button
              onClick={() => setViewMode("embed")}
              className={`px-2 py-0.5 text-xs font-mono transition cursor-pointer ${
                viewMode === "embed"
                  ? "bg-white dark:bg-[#18181B] text-[#9146FF] font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-[#EFEFF1]"
              }`}
            >
              {t("chat.twitchEmbedTab")}
            </button>
          </div>

          <a
            href={`https://twitch.tv/${streamer.username}`}
            target="_blank"
            rel="noopener noreferrer"
            title={t("streamersList.openTwitch")}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:text-[#71717A] dark:hover:text-[#EFEFF1] border border-zinc-200 dark:border-[#26262C] bg-white dark:bg-[#0E0E10] transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {onClose && (
            <button
              onClick={onClose}
              title={t("chat.closeChat")}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:text-[#71717A] dark:hover:text-[#EFEFF1] border border-zinc-200 dark:border-[#26262C] bg-white dark:bg-[#0E0E10] transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Chat Viewport */}
      {viewMode === "irc" ? (
        <div className="flex flex-col">
          {/* Sub-toolbar: Filter tabs + Auto-scroll status */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-zinc-200 dark:border-[#26262C] bg-zinc-100/40 dark:bg-[#101012] text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter("all")}
                className={`px-2.5 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                  filter === "all"
                    ? "bg-[#9146FF] text-white"
                    : "text-zinc-600 dark:text-[#ADADB8] hover:bg-zinc-200 dark:hover:bg-[#1E1E22]"
                }`}
              >
                {t("chat.filterAll")} ({messages.length})
              </button>
              <button
                onClick={() => setFilter("highlights")}
                className={`px-2.5 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                  filter === "highlights"
                    ? "bg-[#9146FF] text-white"
                    : "text-zinc-600 dark:text-[#ADADB8] hover:bg-zinc-200 dark:hover:bg-[#1E1E22]"
                }`}
              >
                {t("chat.filterHighlights")}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <button
                onClick={() => setMessages([])}
                title={t("chat.clearChat")}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:text-[#71717A] dark:hover:text-[#EFEFF1] transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setAutoScroll((prev) => !prev)}
                className={`px-2 py-0.5 border text-[10px] font-mono cursor-pointer transition ${
                  autoScroll
                    ? "border-[#00a865]/40 text-[#00a865] dark:text-[#00F593] bg-[#00a865]/10"
                    : "border-zinc-300 dark:border-[#26262C] text-zinc-400"
                }`}
              >
                {autoScroll ? t("chat.autoScroll") : t("chat.pauseScroll")}
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
                {t("logs.empty")}
              </div>
            ) : (
              filteredMessages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="py-1 px-2.5 bg-zinc-100 dark:bg-[#18181B] border-l-2 border-[#9146FF] text-[11px] text-zinc-500 dark:text-[#ADADB8]"
                    >
                      <span className="font-semibold text-[#9146FF] mr-2">
                        {t("chat.systemLabel")}
                      </span>
                      <span>{msg.message}</span>
                    </div>
                  );
                }

                const isClaim = msg.message.includes("[BONUS CLAIMED]");
                const isWatch = msg.message.includes("[WATCH CREDIT]");
                const isRaid =
                  msg.message.includes("[RAID CAUGHT]") || msg.message.includes("Twitch Raid");

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 py-1 px-2 leading-relaxed transition ${
                      isClaim
                        ? "bg-[#00a865]/10 dark:bg-[#00F593]/10 border-l-2 border-[#00a865] dark:border-[#00F593]"
                        : isWatch
                          ? "bg-[#9146FF]/10 dark:bg-[#9146FF]/15 border-l-2 border-[#9146FF]"
                          : isRaid
                            ? "bg-amber-500/10 border-l-2 border-amber-500"
                            : msg.isHighlighted
                              ? "bg-[#9146FF]/5 border-l-2 border-[#9146FF]/60"
                              : "hover:bg-zinc-50 dark:hover:bg-[#141416]"
                    }`}
                  >
                    <span className="text-[10px] text-zinc-400 dark:text-[#52525B] shrink-0 select-none pt-0.5">
                      {msg.timestamp}
                    </span>

                    {/* Badges */}
                    {msg.badges.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        {msg.badges.map((b) => {
                          const icon = badgeMap[b];
                          if (icon && !failedBadges[b]) {
                            return (
                              <img
                                key={b}
                                src={icon}
                                title={b}
                                className="w-4 h-4"
                                onError={() => setFailedBadges((prev) => ({ ...prev, [b]: true }))}
                              />
                            );
                          }
                          if (b === "moderator" || b === "mod") {
                            return (
                              <span
                                key={b}
                                title={t("chat.badgeModerator")}
                                className="px-1 py-0.2 bg-[#00a865] text-white text-[9px] font-bold rounded-xs flex items-center"
                              >
                                <Shield className="w-2.5 h-2.5" />
                              </span>
                            );
                          }
                          if (b === "bot") {
                            return (
                              <span
                                key={b}
                                className="px-1 py-0.2 bg-[#9146FF] text-white text-[9px] font-bold rounded-xs uppercase"
                              >
                                BOT
                              </span>
                            );
                          }
                          if (b === "vip") {
                            return (
                              <span
                                key={b}
                                className="px-1 py-0.2 bg-[#FF3385] text-white text-[9px] font-bold rounded-xs"
                              >
                                VIP
                              </span>
                            );
                          }
                          if (b === "subscriber" || b === "sub") {
                            return (
                              <span
                                key={b}
                                className="px-1 py-0.2 bg-[#9146FF] text-white text-[9px] font-bold rounded-xs flex items-center"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                              </span>
                            );
                          }
                          return (
                            <span
                              key={b}
                              className="px-1 py-0.2 bg-zinc-600 text-white text-[9px] font-bold rounded-xs uppercase"
                            >
                              {b}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <span
                      style={{ color: msg.color || "#9146FF" }}
                      className="font-semibold shrink-0 cursor-pointer hover:underline"
                    >
                      {msg.displayName}:
                    </span>

                    <span className="text-zinc-800 dark:text-[#EFEFF1] break-words flex-1">
                      {renderMessageWithEmotes(msg)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Emote Chips */}
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-t border-zinc-200 dark:border-[#26262C] bg-zinc-50 dark:bg-[#141416]">
            <span className="text-[10px] font-mono text-zinc-400 dark:text-[#71717A] uppercase mr-1">
              {t("chat.emotesLabel")}
            </span>
            {PRESET_EMOTES.map((emote) => (
              <button
                key={emote}
                type="button"
                onClick={() => handleSendMessage(emote)}
                className="px-2 py-0.5 text-xs font-mono bg-white dark:bg-[#18181B] hover:bg-zinc-200 dark:hover:bg-[#26262C] text-zinc-600 dark:text-[#71717A] border border-zinc-200 dark:border-[#26262C] transition cursor-pointer"
              >
                {emote}
              </button>
            ))}
          </div>

          {/* Interactive Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 p-3 border-t border-zinc-200 dark:border-[#26262C] bg-white dark:bg-[#18181B]"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t("chat.sendPlaceholderChannel", { channel: streamer.displayName })}
              className="flex-1 bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] px-3 py-1.5 text-xs text-zinc-900 dark:text-[#EFEFF1] font-mono focus:outline-hidden focus:border-[#9146FF]"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="px-4 py-1.5 text-xs font-semibold bg-[#9146FF] hover:bg-[#772CE8] disabled:opacity-40 disabled:cursor-not-allowed text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t("chat.sendBtn")}</span>
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
              {t("chat.embedFallbackNotice", { domain: parentDomain })}{" "}
              <button
                onClick={() => setViewMode("irc")}
                className="text-[#9146FF] underline cursor-pointer"
              >
                {t("chat.ircFeedTab")}
              </button>
              .
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
