import React from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Gift, Settings, Database, Sun, Moon, Globe, User as UserIcon } from 'lucide-react';
import { MinerStatus, MinerSettings, User } from '../types';
import { getGravatarUrl } from '../lib/gravatar';

interface HeaderProps {
  status: MinerStatus | null;
  settings: MinerSettings | null;
  currentUser: User | null;
  onTogglePlay: () => void;
  onTriggerTestClaim: () => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  activeTab: 'dashboard' | 'analytics' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'analytics' | 'settings') => void;
  isClaiming: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  settings,
  currentUser,
  onTogglePlay,
  onTriggerTestClaim,
  onOpenSettings,
  onOpenAuth,
  activeTab,
  setActiveTab,
  isClaiming,
  theme,
  onToggleTheme
}) => {
  const { t, i18n } = useTranslation();
  const isRunning = status?.state === 'running';
  const activeSlotsCount = status?.activeSlots.length || 0;
  const maxSlots = status?.activeSlotsLimit || 2;

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('de') ? 'en' : 'de';
    i18n.changeLanguage(nextLang);
    try {
      localStorage.setItem('i18nextLng', nextLang);
    } catch (e) {
      // Ignored
    }
  };

  const avatarSrc = currentUser?.avatarUrl || (currentUser?.email ? getGravatarUrl(currentUser.email) : null);

  return (
    <header className="bg-white dark:bg-[#18181B] border-b border-zinc-200 dark:border-[#26262C] sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Identity */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#9146FF] flex items-center justify-center text-white font-bold shadow-xs">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-[#EFEFF1] tracking-tight">
                  Twitch Miner <span className="text-xs text-[#9146FF] font-mono font-semibold px-1 py-0.5 bg-[#9146FF]/10 border border-[#9146FF]/30">v2</span>
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono text-zinc-600 dark:text-[#ADADB8] bg-zinc-100 dark:bg-[#0E0E10] px-1.5 py-0.5 border border-zinc-200 dark:border-[#26262C]">
                  <Database className="w-3 h-3 text-[#00a865] dark:text-[#00F593]" />
                  {t('sqliteBadge')}
                </span>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-3 text-xs text-zinc-500 dark:text-[#ADADB8]">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRunning ? 'bg-[#00a865] dark:bg-[#00F593] animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <span className={isRunning ? 'text-[#00a865] dark:text-[#00F593] font-mono font-medium' : 'text-amber-600 dark:text-amber-300 font-mono font-medium'}>
                    {isRunning ? t('status.running') : status?.state === 'paused' ? t('status.paused') : t('status.stopped')}
                  </span>
                </span>
                <span className="text-zinc-300 dark:text-[#363640]">•</span>
                <span className="font-mono text-zinc-700 dark:text-[#EFEFF1]">
                  {activeSlotsCount}/{maxSlots} {t('stats.activeSlots')}
                </span>
                {settings?.isSimulationMode && (
                  <>
                    <span className="text-zinc-300 dark:text-[#363640] hidden sm:inline">•</span>
                    <span className="hidden sm:inline text-[10px] font-mono text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 border border-indigo-200 dark:border-indigo-500/20">
                      {t('status.simulationActive')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center space-x-1 bg-zinc-100 dark:bg-[#0E0E10] p-1 border border-zinc-200 dark:border-[#26262C]">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#9146FF] text-white'
                  : 'text-zinc-600 dark:text-[#ADADB8] hover:text-zinc-900 dark:hover:text-[#EFEFF1]'
              }`}
            >
              {t('nav.streamers')}
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-[#9146FF] text-white'
                  : 'text-zinc-600 dark:text-[#ADADB8] hover:text-zinc-900 dark:hover:text-[#EFEFF1]'
              }`}
            >
              {t('nav.analytics')}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#9146FF] text-white'
                  : 'text-zinc-600 dark:text-[#ADADB8] hover:text-zinc-900 dark:hover:text-[#EFEFF1]'
              }`}
            >
              {t('actions.settings')}
            </button>
          </nav>

          {/* Action Buttons & Utilities */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              title={t('actions.switchLang')}
              className="px-2 py-1.5 text-xs font-mono font-medium text-zinc-600 dark:text-[#ADADB8] hover:text-zinc-900 dark:hover:text-[#EFEFF1] bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141416] dark:hover:bg-[#1F1F23] border border-zinc-200 dark:border-[#26262C] transition cursor-pointer flex items-center gap-1"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{i18n.language.startsWith('de') ? 'DE' : 'EN'}</span>
            </button>

            {/* Bright / Dark Mode Toggle */}
            <button
              onClick={onToggleTheme}
              title={t('actions.toggleTheme')}
              className="p-1.5 text-zinc-600 dark:text-[#ADADB8] hover:text-zinc-900 dark:hover:text-[#EFEFF1] bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141416] dark:hover:bg-[#1F1F23] border border-zinc-200 dark:border-[#26262C] transition cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            {/* Test Claim Button */}
            <button
              onClick={onTriggerTestClaim}
              disabled={isClaiming || !isRunning}
              title="Test claim (+50 pts)"
              className="hidden sm:flex px-2.5 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141416] dark:hover:bg-[#1F1F23] text-zinc-800 dark:text-[#EFEFF1] border border-zinc-200 dark:border-[#26262C] transition items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Gift className="w-3.5 h-3.5 text-[#00a865] dark:text-[#00F593]" />
              <span className="hidden md:inline">{t('actions.testClaim')}</span>
              <span className="md:hidden">+50</span>
            </button>

            {/* Play/Pause Engine */}
            <button
              onClick={onTogglePlay}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                isRunning
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                  : 'bg-[#00a865] hover:bg-[#008f56] dark:bg-[#00F593] dark:hover:bg-[#00D680] text-white dark:text-[#0E0E10] font-bold'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('actions.pause')}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">{t('actions.start')}</span>
                </>
              )}
            </button>

            {/* User Profile / Auth Button */}
            <button
              onClick={onOpenAuth}
              title={t('actions.profile')}
              className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141416] dark:hover:bg-[#1F1F23] text-zinc-800 dark:text-[#EFEFF1] border border-zinc-200 dark:border-[#26262C] transition cursor-pointer"
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={currentUser?.username || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full border border-[#9146FF] object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-zinc-600 dark:text-[#ADADB8]" />
              )}
              <span className="text-xs font-medium hidden sm:inline max-w-24 truncate">
                {currentUser?.username || t('actions.login')}
              </span>
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="p-1.5 text-zinc-600 hover:text-zinc-900 dark:text-[#ADADB8] dark:hover:text-[#EFEFF1] bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141416] dark:hover:bg-[#1F1F23] border border-zinc-200 dark:border-[#26262C] transition cursor-pointer"
              title={t('actions.settings')}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
