import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, Link2Off, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

interface TwitchStatus {
  connected: boolean;
  login?: string;
  stale?: boolean;
  unknown?: boolean;
}

interface DeviceStartResponse {
  sessionId: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresInSeconds: number;
}

type LoginState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'waiting'; session: DeviceStartResponse }
  | { phase: 'granted'; login: string }
  | { phase: 'error'; message: string };

export const TwitchConnect: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TwitchStatus | null>(null);
  const [loginState, setLoginState] = useState<LoginState>({ phase: 'idle' });
  const pollTimer = useRef<number | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/twitch/status');
      setStatus(await res.json());
    } catch {
      setStatus({ connected: false, unknown: true });
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, [refreshStatus]);

  const startLogin = async () => {
    setLoginState({ phase: 'starting' });
    try {
      const res = await fetch('/api/twitch/device/start', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setLoginState({ phase: 'error', message: body?.error ?? 'Could not start login' });
        return;
      }
      const session: DeviceStartResponse = await res.json();
      setLoginState({ phase: 'waiting', session });
      window.open(session.verificationUri, '_blank', 'noopener');
      let elapsed = 0;
      const intervalMs = Math.max(2000, session.interval * 1000);
      pollTimer.current = window.setInterval(async () => {
        elapsed += intervalMs;
        if (elapsed > session.expiresInSeconds * 1000) {
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          setLoginState({ phase: 'error', message: 'Login window expired — try again.' });
          return;
        }
        try {
          const poll = await fetch('/api/twitch/device/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: session.sessionId })
          });
          const p = await poll.json();
          if (p.state === 'granted') {
            if (pollTimer.current) window.clearInterval(pollTimer.current);
            setLoginState({ phase: 'granted', login: p.login });
            refreshStatus();
          } else if (p.state === 'error') {
            if (pollTimer.current) window.clearInterval(pollTimer.current);
            setLoginState({ phase: 'error', message: p.error ?? 'Login failed' });
          }
        } catch {
          void 0;
        }
      }, intervalMs);
    } catch (err) {
      setLoginState({ phase: 'error', message: err instanceof Error ? err.message : 'Login failed' });
    }
  };

  const disconnect = async () => {
    await fetch('/api/twitch/disconnect', { method: 'POST' });
    setLoginState({ phase: 'idle' });
    refreshStatus();
  };

  const connected = status?.connected === true;
  const indicator = (() => {
    if (loginState.phase === 'waiting' || loginState.phase === 'starting') {
      return { icon: <Loader2 size={12} className="animate-spin" />, label: t('twitch.connecting'), cls: 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' };
    }
    if (connected) {
      return { icon: <CheckCircle2 size={12} />, label: status?.login ?? 'connected', cls: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' };
    }
    if (status?.stale) {
      return { icon: <XCircle size={12} />, label: t('twitch.tokenStale'), cls: 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' };
    }
    return { icon: <Link2Off size={12} />, label: t('twitch.notConnected'), cls: 'text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-500/10 border-zinc-200 dark:border-zinc-500/20' };
  })();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-1.5 py-0.5 border ${indicator.cls}`}>
          {indicator.icon}
          <span>{indicator.label}</span>
        </span>
        {connected && (
          <button
            onClick={disconnect}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-300 transition cursor-pointer"
          >
            <Link2Off size={11} />
            {t('twitch.disconnect')}
          </button>
        )}
      </div>

      {!connected && loginState.phase !== 'waiting' && (
        <button
          onClick={startLogin}
          disabled={loginState.phase === 'starting'}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#9146FF] hover:bg-[#772CE8] disabled:opacity-60 text-white transition cursor-pointer"
        >
          <Link2 size={13} />
          {loginState.phase === 'starting' ? t('twitch.starting') : t('twitch.connectTwitch')}
        </button>
      )}

      {loginState.phase === 'waiting' && (
        <div className="border border-[#9146FF]/30 bg-[#9146FF]/5 p-3 space-y-2">
          <p className="text-xs text-zinc-700 dark:text-[#EFEFF1]">
            {t('twitch.enterCodePrefix')}{' '}
            <a
              href={loginState.session.verificationUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[#9146FF] hover:underline font-medium"
            >
              twitch.tv/activate <ExternalLink size={10} />
            </a>
          </p>
          <div className="flex items-center justify-center py-2">
            <span className="font-mono text-2xl font-bold tracking-[0.3em] text-[#9146FF] select-all">
              {loginState.session.userCode}
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center">
            {t('twitch.expiresIn')} {Math.round(loginState.session.expiresInSeconds / 60)} {t('twitch.minutes')}
          </p>
        </div>
      )}

      {loginState.phase === 'granted' && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 size={13} />
          {t('twitch.connectedAs')} <strong>{loginState.login}</strong>
        </div>
      )}

      {loginState.phase === 'error' && (
        <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-300">
          <XCircle size={13} className="shrink-0 mt-0.5" />
          <span>{loginState.message}</span>
        </div>
      )}
    </div>
  );
};