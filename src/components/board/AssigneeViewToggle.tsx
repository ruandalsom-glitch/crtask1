'use client';

import { useState, useEffect } from 'react';
import { Image, User, Mail, Crown, ChevronDown } from 'lucide-react';

export type AssigneeViewMode = 'icons' | 'names' | 'emails';

export function AssigneeViewToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewModeState] = useState<AssigneeViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('crtask_assignee_view_mode') as AssigneeViewMode) || 'icons';
    }
    return 'icons';
  });

  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem('crtask_assignee_view_mode') as AssigneeViewMode;
      if (saved) setViewModeState(saved);
    };
    window.addEventListener('assignee_view_mode_change', handleSync);
    return () => window.removeEventListener('assignee_view_mode_change', handleSync);
  }, []);

  const setViewMode = (mode: AssigneeViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('crtask_assignee_view_mode', mode);
      window.dispatchEvent(new Event('assignee_view_mode_change'));
    }
    setIsOpen(false);
  };

  const labels = {
    icons: { text: 'Ícones (Imagens)', icon: Image },
    names: { text: 'Nomes Agrupados', icon: User },
    emails: { text: 'E-mails Agrupados', icon: Mail },
  };

  const CurrentIcon = labels[viewMode].icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 text-xs font-semibold transition-all shadow-sm cursor-pointer"
        title="Alternar modo de exibição dos responsáveis"
      >
        <Crown className="w-3.5 h-3.5 text-purple-600" />
        <CurrentIcon className="w-3.5 h-3.5 text-purple-700" />
        <span>Exibição: {labels[viewMode].text}</span>
        <ChevronDown className="w-3.5 h-3.5 text-purple-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-purple-200 rounded-xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95">
          <div className="px-2 py-1.5 border-b border-purple-100 mb-1 flex items-center gap-1.5 text-xs font-bold text-purple-900">
            <Crown className="w-3.5 h-3.5 text-purple-600" /> Painel de Exibição
          </div>
          <div className="text-[11px] text-slate-500 px-2 mb-2">Escolha como deseja visualizar os responsáveis:</div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setViewMode('icons')}
              className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${viewMode === 'icons' ? 'bg-purple-600 text-white font-bold' : 'hover:bg-purple-50 text-slate-700'}`}
            >
              <Image className="w-4 h-4" />
              <span>Ícones (Imagens)</span>
              {viewMode === 'icons' && <span className="ml-auto font-bold">✓</span>}
            </button>
            <button
              onClick={() => setViewMode('names')}
              className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${viewMode === 'names' ? 'bg-purple-600 text-white font-bold' : 'hover:bg-purple-50 text-slate-700'}`}
            >
              <User className="w-4 h-4" />
              <span>Nomes Agrupados</span>
              {viewMode === 'names' && <span className="ml-auto font-bold">✓</span>}
            </button>
            <button
              onClick={() => setViewMode('emails')}
              className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${viewMode === 'emails' ? 'bg-purple-600 text-white font-bold' : 'hover:bg-purple-50 text-slate-700'}`}
            >
              <Mail className="w-4 h-4" />
              <span>E-mails Agrupados</span>
              {viewMode === 'emails' && <span className="ml-auto font-bold">✓</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
