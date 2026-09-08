import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Mail, Lock, User as UserIcon, LogIn, UserPlus } from 'lucide-react';
import { User } from '../types';
import { prisma } from '../lib/prismaClient';
import { getGravatarUrl } from '../lib/gravatar';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLoginSuccess: (user: User) => void;
  onLogout: () => void | Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!email || !username) {
          setError('Email and username are required');
          setLoading(false);
          return;
        }
        const user = await prisma.user.register({ email, username, password });
        // Cache gravatar locally
        if (user.email) {
          getGravatarUrl(user.email);
        }
        onLoginSuccess(user);
        onClose();
      } else {
        if (!email) {
          setError('Email is required');
          setLoading(false);
          return;
        }
        const user = await prisma.user.login({ email, password });
        if (user.email) {
          getGravatarUrl(user.email);
        }
        onLoginSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'github' | 'google') => {
    setError(null);
    setLoading(true);
    try {
      if (provider === 'google') {
        window.location.href = '/api/auth/google/start';
        return;
      }
      setError('GitHub login is not available — use email or Google.');
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Social login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#26262C] shadow-2xl p-6 text-zinc-900 dark:text-[#EFEFF1]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-[#26262C]">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-[#EFEFF1]">
              {t('auth.title')}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-[#ADADB8] mt-0.5">
              {t('auth.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-[#EFEFF1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Info */}
        {currentUser && (
          <div className="mt-4 p-3 bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-200 dark:border-[#26262C] flex items-center gap-3">
            <img
              src={currentUser.avatarUrl || getGravatarUrl(currentUser.email)}
              alt={currentUser.username}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full border border-zinc-300 dark:border-[#9146FF] object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-500 dark:text-[#ADADB8]">
                {t('auth.loggedInAs')}
              </div>
              <div className="text-sm font-semibold truncate text-zinc-900 dark:text-[#EFEFF1]">
                {currentUser.username} ({currentUser.email})
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 uppercase bg-zinc-200 dark:bg-[#26262C] text-zinc-700 dark:text-[#ADADB8]">
              {currentUser.provider}
            </span>
          </div>
        )}

        {/* Tabs for Login / Register */}
        <div className="flex border-b border-zinc-200 dark:border-[#26262C] mt-4">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
              mode === 'login'
                ? 'border-[#9146FF] text-[#9146FF]'
                : 'border-transparent text-zinc-500 dark:text-[#ADADB8] hover:text-zinc-900 dark:hover:text-[#EFEFF1]'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <LogIn className="w-3.5 h-3.5" />
              {t('actions.login')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
              mode === 'register'
                ? 'border-[#9146FF] text-[#9146FF]'
                : 'border-transparent text-zinc-500 dark:text-[#ADADB8] hover:text-zinc-900 dark:hover:text-[#EFEFF1]'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              {t('actions.register')}
            </span>
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 text-xs bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#ADADB8] mb-1">
              {t('auth.emailLabel')}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 dark:text-[#ADADB8]" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] focus:outline-hidden focus:border-[#9146FF] text-zinc-900 dark:text-[#EFEFF1]"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-[#ADADB8] mb-1">
                {t('auth.usernameLabel')}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 dark:text-[#ADADB8]" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="StreamMinerUser"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] focus:outline-hidden focus:border-[#9146FF] text-zinc-900 dark:text-[#EFEFF1]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#ADADB8] mb-1">
              {t('auth.passwordLabel')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 dark:text-[#ADADB8]" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] focus:outline-hidden focus:border-[#9146FF] text-zinc-900 dark:text-[#EFEFF1]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2 px-4 bg-[#9146FF] hover:bg-[#772CE8] text-white font-medium text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? '...' : mode === 'login' ? t('auth.signInBtn') : t('auth.registerBtn')}
          </button>
        </form>

        {/* Social Logins */}
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-[#26262C]">
          <div className="text-[11px] text-center text-zinc-500 dark:text-[#ADADB8] mb-3">
            {t('auth.orSocial')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-[#26262C] dark:hover:bg-[#32323a] text-zinc-800 dark:text-[#EFEFF1] border border-zinc-300 dark:border-transparent transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-[#26262C] dark:hover:bg-[#32323a] text-zinc-800 dark:text-[#EFEFF1] border border-zinc-300 dark:border-transparent transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Google
            </button>
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-[#ADADB8] mt-3 text-center">
            {t('auth.gravatarNote')}
          </p>
        </div>
      </div>
    </div>
  );
};
