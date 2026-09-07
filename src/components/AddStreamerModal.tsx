import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Users, Check } from 'lucide-react';

interface AddStreamerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (username: string, displayName?: string) => void;
  existingUsernames: string[];
}

const POPULAR_SUGGESTIONS = [
  { username: 'tarik', name: 'tarik', game: 'VALORANT' },
  { username: 'shroud', name: 'shroud', game: 'Counter-Strike 2' },
  { username: 'xqcow', name: 'xQc', game: 'Just Chatting' },
  { username: 'caedrel', name: 'Caedrel', game: 'League of Legends' },
  { username: 'kaicenat', name: 'Kai Cenat', game: 'Just Chatting' },
  { username: 'hasanabi', name: 'HasanAbi', game: 'Just Chatting' },
  { username: 'pokimane', name: 'pokimane', game: 'Variety' },
  { username: 'ibai', name: 'ibai', game: 'Special Events' },
  { username: 'fps_shaka', name: 'fps_shaka', game: 'Apex Legends' },
  { username: 'summit1g', name: 'summit1g', game: 'DayZ' }
];

export const AddStreamerModal: React.FC<AddStreamerModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingUsernames
}) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setError(t('addModal.errorRequired'));
      return;
    }
    if (existingUsernames.includes(clean)) {
      setError(t('addModal.errorExists'));
      return;
    }

    onAdd(clean, displayName.trim() || undefined);
    setUsername('');
    setDisplayName('');
    setError('');
    onClose();
  };

  const handleQuickAdd = (s: typeof POPULAR_SUGGESTIONS[0]) => {
    if (existingUsernames.includes(s.username.toLowerCase())) return;
    onAdd(s.username, s.name);
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
              {t('addModal.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:text-[#ADADB8] dark:hover:text-[#EFEFF1] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
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
              {t('addModal.usernameLabel')}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-zinc-400 dark:text-[#71717A] font-mono">
                twitch.tv/
              </span>
              <input
                type="text"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder="streamer_name"
                autoFocus
                className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] pl-22 pr-3 py-1.5 text-xs text-zinc-900 dark:text-[#EFEFF1] font-mono focus:outline-hidden focus:border-[#9146FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#EFEFF1] mb-1">
              {t('addModal.displayLabel')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Tarik"
              className="w-full bg-zinc-50 dark:bg-[#0E0E10] border border-zinc-300 dark:border-[#26262C] px-3 py-1.5 text-xs text-zinc-900 dark:text-[#EFEFF1] focus:outline-hidden focus:border-[#9146FF]"
            />
          </div>

          {/* Quick Suggestions */}
          <div>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-[#ADADB8] uppercase tracking-wider block mb-2 font-mono">
              {t('addModal.popularTitle')}
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {POPULAR_SUGGESTIONS.map(s => {
                const isAdded = existingUsernames.includes(s.username.toLowerCase());
                return (
                  <button
                    key={s.username}
                    type="button"
                    onClick={() => handleQuickAdd(s)}
                    disabled={isAdded}
                    className={`px-2 py-1 text-xs transition flex items-center gap-1 cursor-pointer ${
                      isAdded
                        ? 'bg-zinc-100 dark:bg-[#0E0E10] text-zinc-400 dark:text-[#71717A] border border-zinc-200 dark:border-[#26262C]/50 cursor-not-allowed'
                        : 'bg-zinc-100 hover:bg-[#9146FF]/15 text-zinc-700 dark:bg-[#141416] dark:hover:bg-[#9146FF]/20 dark:text-[#ADADB8] dark:hover:text-[#c299ff] border border-zinc-200 dark:border-[#26262C] hover:border-[#9146FF]/50'
                    }`}
                  >
                    {isAdded ? <Check className="w-3 h-3 text-[#00F593]" /> : <Plus className="w-3 h-3" />}
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-[#26262C]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-[#ADADB8] dark:hover:text-[#EFEFF1] transition cursor-pointer"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold bg-[#9146FF] hover:bg-[#772CE8] text-white transition cursor-pointer"
            >
              {t('addModal.addButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
