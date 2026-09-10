import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Key, Sliders, Zap, Gift, Target, HelpCircle, CheckCircle2 } from "lucide-react";
import { MinerSettings, PriorityMode } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MinerSettings | null;
  onSaveSettings: (settings: Partial<MinerSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<MinerSettings>(
    () =>
      settings || {
        id: "default",
        authToken: "",
        clientId: "kimne78kx3ncx6brgo4mv6wki5h1ko",
        isSimulationMode: true,
        maxConcurrentStreams: 2,
        priorityMode: "points_asc",
        autoClaimBonus: true,
        claimDelaySeconds: 4,
        followRaids: true,
        autoClaimDrops: true,
        autoBetPredictions: true,
        predictionStrategy: "smart_ratio",
        maxBetPoints: 100,
        checkIntervalSeconds: 3,
      },
  );
  const [showTokenHelp, setShowTokenHelp] = useState(false);
  const [savedAlert, setSavedAlert] = useState(false);

  React.useEffect(() => {
    if (settings) {
      setForm({ ...settings });
    }
  }, [settings]);

  if (!isOpen || !settings) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setSavedAlert(true);
    setTimeout(() => {
      setSavedAlert(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-[#26262C] bg-zinc-50 dark:bg-[#141416]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#9146FF]/15 text-[#9146FF] border border-[#9146FF]/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-[#EFEFF1]">
                {t("settings.title")}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-[#ADADB8]">{t("settings.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:text-[#ADADB8] dark:hover:text-[#EFEFF1] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {savedAlert && (
            <div className="p-3 bg-[#00F593]/10 border border-[#00F593]/30 text-[#00a865] dark:text-[#00F593] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t("settings.savedSuccess")}</span>
            </div>
          )}

          {/* Section: Priority & Concurrency */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-[#ADADB8] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-[#9146FF]" />
              {t("settings.queueSection")}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-[#EFEFF1] mb-1.5">
                  {t("settings.priorityLabel")}
                </label>
                <select
                  value={form.priorityMode}
                  onChange={(e) =>
                    setForm({ ...form, priorityMode: e.target.value as PriorityMode })
                  }
                  className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] px-3 py-2 text-xs text-zinc-900 dark:text-[#EFEFF1] focus:outline-hidden focus:border-[#9146FF]"
                >
                  <option
                    value="points_asc"
                    className="bg-white text-zinc-900 dark:bg-[#0E0E10] dark:text-[#EFEFF1]"
                  >
                    {t("settings.priorityAsc")}
                  </option>
                  <option
                    value="points_desc"
                    className="bg-white text-zinc-900 dark:bg-[#0E0E10] dark:text-[#EFEFF1]"
                  >
                    {t("settings.priorityDesc")}
                  </option>
                  <option
                    value="streak"
                    className="bg-white text-zinc-900 dark:bg-[#0E0E10] dark:text-[#EFEFF1]"
                  >
                    {t("settings.priorityStreak")}
                  </option>
                  <option
                    value="manual"
                    className="bg-white text-zinc-900 dark:bg-[#0E0E10] dark:text-[#EFEFF1]"
                  >
                    {t("settings.priorityManual")}
                  </option>
                </select>
                <p className="text-[11px] text-zinc-500 dark:text-[#71717A] mt-1">
                  {t("settings.priorityHint")}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-[#EFEFF1] mb-1.5">
                  {t("settings.concurrencyLabel")}
                </label>
                <select
                  value={form.maxConcurrentStreams}
                  onChange={(e) =>
                    setForm({ ...form, maxConcurrentStreams: parseInt(e.target.value) })
                  }
                  className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] px-3 py-2 text-xs text-zinc-900 dark:text-[#EFEFF1] focus:outline-hidden focus:border-[#9146FF]"
                >
                  <option
                    value={1}
                    className="bg-white text-zinc-900 dark:bg-[#0E0E10] dark:text-[#EFEFF1]"
                  >
                    {t("settings.concurrency1")}
                  </option>
                  <option
                    value={2}
                    className="bg-white text-zinc-900 dark:bg-[#0E0E10] dark:text-[#EFEFF1]"
                  >
                    {t("settings.concurrency2")}
                  </option>
                </select>
                <p className="text-[11px] text-zinc-500 dark:text-[#71717A] mt-1">
                  {t("settings.concurrencyHint")}
                </p>
              </div>
            </div>
          </div>

          {/* Section: Automated Claiming & Delays */}
          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-[#26262C]">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-[#ADADB8] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Gift className="w-3.5 h-3.5 text-[#00F593]" />
              {t("settings.bonusSection")}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoClaimBonus}
                    onChange={(e) => setForm({ ...form, autoClaimBonus: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-[#9146FF] focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-[#EFEFF1] block">
                      {t("settings.autoBonus")}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-[#ADADB8] block">
                      {t("settings.autoBonusDesc")}
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.followRaids}
                    onChange={(e) => setForm({ ...form, followRaids: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-[#9146FF] focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-[#EFEFF1] block">
                      {t("settings.followRaids")}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-[#ADADB8] block">
                      {t("settings.followRaidsDesc")}
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoClaimDrops}
                    onChange={(e) => setForm({ ...form, autoClaimDrops: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-[#9146FF] focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-[#EFEFF1] block">
                      {t("settings.autoDrops")}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-[#ADADB8] block">
                      {t("settings.autoDropsDesc")}
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-[#EFEFF1] mb-1.5">
                  {t("settings.delayLabel")}:{" "}
                  <span className="text-[#00a865] dark:text-[#00F593] font-mono">
                    {form.claimDelaySeconds}s
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={form.claimDelaySeconds}
                  onChange={(e) =>
                    setForm({ ...form, claimDelaySeconds: parseInt(e.target.value) })
                  }
                  className="w-full accent-[#9146FF] cursor-pointer"
                />
                <p className="text-[11px] text-zinc-500 dark:text-[#71717A] mt-1">
                  {t("settings.delayHint")}
                </p>
              </div>
            </div>
          </div>

          {/* Section: Predictions Auto-Betting */}
          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-[#26262C]">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-[#ADADB8] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Target className="w-3.5 h-3.5 text-sky-500" />
              {t("settings.predSection")}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoBetPredictions}
                  onChange={(e) => setForm({ ...form, autoBetPredictions: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-[#9146FF] focus:ring-0"
                />
                <div>
                  <span className="text-xs font-medium text-zinc-900 dark:text-[#EFEFF1] block">
                    {t("settings.autoBet")}
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-[#ADADB8] block">
                    {t("settings.autoBetDesc")}
                  </span>
                </div>
              </label>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-[#EFEFF1] mb-1.5">
                  {t("settings.predStrategy")}
                </label>
                <select
                  value={form.predictionStrategy}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      predictionStrategy: e.target.value as MinerSettings["predictionStrategy"],
                    })
                  }
                  className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] px-3 py-2 text-xs text-zinc-900 dark:text-[#EFEFF1] focus:outline-hidden focus:border-[#9146FF]"
                >
                  <option
                    value="smart_ratio"
                    className="bg-white text-zinc-900 dark:bg-[#0E0E10] dark:text-[#EFEFF1]"
                  >
                    {t("settings.stratSmart")}
                  </option>
                  <option
                    value="lowest_odds"
                    className="bg-white text-zinc-900 dark:bg-[#0E0E10] dark:text-[#EFEFF1]"
                  >
                    {t("settings.stratLowest")}
                  </option>
                  <option
                    value="conservative"
                    className="bg-white text-zinc-900 dark:bg-[#0E0E10] dark:text-[#EFEFF1]"
                  >
                    {t("settings.stratCons")}
                  </option>
                  <option
                    value="highest_odds"
                    className="bg-white text-zinc-900 dark:bg-[#0E0E10] dark:text-[#EFEFF1]"
                  >
                    {t("settings.stratHighest")}
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-[#EFEFF1] mb-1.5">
                  {t("settings.maxBetLabel")}
                </label>
                <input
                  type="number"
                  min={10}
                  max={5000}
                  value={form.maxBetPoints}
                  onChange={(e) =>
                    setForm({ ...form, maxBetPoints: parseInt(e.target.value) || 100 })
                  }
                  className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] px-3 py-2 text-xs text-zinc-900 dark:text-[#EFEFF1] focus:outline-hidden focus:border-[#9146FF]"
                />
              </div>
            </div>
          </div>

          {/* Section: Twitch Account & Auth */}
          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-[#26262C]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-[#ADADB8] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                {t("settings.authSection")}
              </h3>
              <button
                type="button"
                onClick={() => setShowTokenHelp(!showTokenHelp)}
                className="text-[11px] text-[#9146FF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{t("settings.howToToken")}</span>
              </button>
            </div>

            {/* Simulation mode toggle */}
            <div className="p-3.5 bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-[#26262C] flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-[#EFEFF1]">
                    {t("settings.sandboxLabel")}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 font-mono">
                    {t("settings.sandboxRecommended")}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-[#ADADB8] max-w-md">
                  {t("settings.sandboxDesc")}
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.isSimulationMode}
                onChange={(e) => setForm({ ...form, isSimulationMode: e.target.checked })}
                className="w-4 h-4 text-[#9146FF] focus:ring-0 cursor-pointer"
              />
            </div>

            {showTokenHelp && (
              <div className="p-3 bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-200 dark:border-[#26262C] text-xs text-zinc-600 dark:text-[#ADADB8] space-y-1.5">
                <p className="font-semibold text-zinc-900 dark:text-[#EFEFF1]">
                  {t("settings.helpTitle")}
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>{t("settings.step1")}</li>
                  <li>{t("settings.step2")}</li>
                  <li>{t("settings.step3")}</li>
                  <li>{t("settings.step4")}</li>
                  <li>{t("settings.step5")}</li>
                </ol>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-[#EFEFF1] mb-1.5">
                  {t("settings.tokenLabel")}
                </label>
                <input
                  type="password"
                  value={form.authToken}
                  onChange={(e) => setForm({ ...form, authToken: e.target.value })}
                  placeholder="oauth:xxxxxxxxxxxx or cookie auth-token"
                  className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] px-3 py-2 text-xs text-zinc-900 dark:text-[#EFEFF1] font-mono focus:outline-hidden focus:border-[#9146FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-[#EFEFF1] mb-1.5">
                  {t("settings.clientIdLabel")}
                </label>
                <input
                  type="text"
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] px-3 py-2 text-xs text-zinc-500 dark:text-[#ADADB8] font-mono focus:outline-hidden focus:border-[#9146FF]"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-[#26262C] bg-zinc-50 dark:bg-[#141416]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-[#ADADB8] dark:hover:text-[#EFEFF1] transition cursor-pointer"
          >
            {t("actions.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-xs font-semibold bg-[#9146FF] hover:bg-[#772CE8] text-white transition cursor-pointer"
          >
            {t("actions.save")}
          </button>
        </div>
      </div>
    </div>
  );
};
