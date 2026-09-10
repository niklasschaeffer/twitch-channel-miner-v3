import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Users, Check } from "lucide-react";
import { extractTwitchUsername } from "../lib/twitch";
import type { YourChannelSuggestion } from "../types";

interface AddStreamerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (username: string, displayName?: string) => void;
  existingUsernames: string[];
}

const isYourChannelSuggestion = (value: unknown): value is YourChannelSuggestion => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.username !== "string") return false;
  if (typeof record.displayName !== "string") return false;
  if (record.reason !== "sub" && record.reason !== "follow" && record.reason !== "game")
    return false;
  if (record.tier !== undefined && typeof record.tier !== "string") return false;
  if (record.game !== undefined && typeof record.game !== "string") return false;
  if (record.viewersCount !== undefined && typeof record.viewersCount !== "number") return false;
  return true;
};

export const AddStreamerModal: React.FC<AddStreamerModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingUsernames,
}) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<YourChannelSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadSuggestions = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/twitch/your-channels");
        const data: unknown = await response.json();
        if (cancelled) return;
        if (Array.isArray(data)) {
          setSuggestions(data.filter(isYourChannelSuggestion));
        } else {
          setSuggestions([]);
        }
      } catch {
        if (cancelled) return;
        setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = extractTwitchUsername(username);
    if (!clean) {
      setError(t("addModal.errorRequired"));
      return;
    }
    const cleanExisting = existingUsernames.map((u) => extractTwitchUsername(u));
    if (cleanExisting.includes(clean)) {
      setError(t("addModal.errorExists"));
      return;
    }

    onAdd(clean, displayName.trim() || undefined);

    setUsername("");
    setDisplayName("");
    setError("");
    onClose();
  };

  const renderReasonBadge = (s: YourChannelSuggestion): string => {
    if (s.reason === "sub") return t("addModal.subBadge", { tier: s.tier ?? "" });
    if (s.reason === "follow") return t("addModal.followedBadge");
    return s.game ?? "";
  };

  const handleQuickAdd = (s: YourChannelSuggestion) => {
    const clean = extractTwitchUsername(s.username);
    const cleanExisting = existingUsernames.map((u) => extractTwitchUsername(u));
    if (cleanExisting.includes(clean)) return;
    onAdd(clean, s.displayName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-[#26262C] bg-zinc-50 dark:bg-[#141416]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-[#9146FF]/15 text-[#9146FF] border border-[#9146FF]/30">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#EFEFF1]">
              {t("addModal.title")}
            </h2>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#EFEFF1] mb-1">
              {t("addModal.usernameLabel")}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-zinc-400 dark:text-[#71717A] font-mono">
                twitch.tv/
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes("twitch.tv/") || val.includes("http") || val.startsWith("@")) {
                    setUsername(extractTwitchUsername(val));
                  } else {
                    setUsername(val);
                  }
                  setError("");
                }}
                placeholder="streamer_name or twitch URL"
                autoFocus
                className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] pl-22 pr-3 py-1.5 text-xs text-zinc-900 dark:text-[#EFEFF1] font-mono focus:outline-hidden focus:border-[#9146FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#EFEFF1] mb-1">
              {t("addModal.displayLabel")}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Tarik"
              className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] px-3 py-1.5 text-xs text-zinc-900 dark:text-[#EFEFF1] focus:outline-hidden focus:border-[#9146FF]"
            />
          </div>

          <div>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-[#ADADB8] uppercase tracking-wider block mb-2 font-mono">
              {t("addModal.yourChannelsTitle")}
            </span>
            {loading ? (
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-zinc-100 dark:bg-[#0E0E10] border border-zinc-200 dark:border-[#26262C]/50 animate-pulse w-24 h-6"
                  />
                ))}
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-[#71717A]">
                {t("addModal.yourChannelsEmpty")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {suggestions.map((s) => {
                  const isAdded = existingUsernames.includes(s.username.toLowerCase());
                  return (
                    <button
                      key={s.username}
                      type="button"
                      onClick={() => handleQuickAdd(s)}
                      disabled={isAdded}
                      className={`px-2 py-1 text-xs transition flex items-center gap-1 cursor-pointer ${
                        isAdded
                          ? "bg-zinc-100 dark:bg-[#0E0E10] text-zinc-400 dark:text-[#71717A] border border-zinc-200 dark:border-[#26262C]/50 cursor-not-allowed"
                          : "bg-zinc-100 hover:bg-[#9146FF]/15 text-zinc-700 dark:bg-[#141416] dark:hover:bg-[#9146FF]/20 dark:text-[#ADADB8] dark:hover:text-[#c299ff] border border-zinc-200 dark:border-[#26262C] hover:border-[#9146FF]/50"
                      }`}
                    >
                      {isAdded ? (
                        <Check className="w-3 h-3 text-[#00F593]" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      <span>{s.displayName}</span>
                      <span className="text-[10px] font-medium text-zinc-500 dark:text-[#71717A] border border-zinc-200 dark:border-[#26262C] px-1 rounded-sm">
                        {renderReasonBadge(s)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-[#26262C]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-[#ADADB8] dark:hover:text-[#EFEFF1] transition cursor-pointer"
            >
              {t("actions.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold bg-[#9146FF] hover:bg-[#772CE8] text-white transition cursor-pointer"
            >
              {t("addModal.addButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
