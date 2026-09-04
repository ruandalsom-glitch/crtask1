'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const EFFORT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'Baixo': { bg: 'bg-[#579bfc]', text: 'text-white', label: '⚡ Baixo' },
  'Médio': { bg: 'bg-[#fdab3d]', text: 'text-white', label: '⚖️ Médio' },
  'Alto': { bg: 'bg-[#e2445c]', text: 'text-white', label: '🔥 Alto' },
  'Muito Alto': { bg: 'bg-[#784bd1]', text: 'text-white', label: '🚀 Muito Alto' },
  'Vazio': { bg: 'bg-[#c4c4c4]', text: 'text-white', label: '-' },
};

export function EffortCell({ task }: { task: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const currentEffort = task.effort || 'Vazio';
  const effortConfig = EFFORT_COLORS[currentEffort] || EFFORT_COLORS['Vazio'];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', () => setIsOpen(false));
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', () => setIsOpen(false));
    };
  }, []);

  const updateEffort = useMutation({
    mutationFn: async (newEffort: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ effort: newEffort })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsOpen(false);
    }
  });

  const handleOpen = (e: React.MouseEvent) => {
    if (buttonRef.current) {
      setRect(buttonRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={`w-full h-full min-h-[36px] flex items-center justify-center font-medium text-[13px] shadow-sm hover:opacity-90 transition-opacity ${effortConfig.bg} ${effortConfig.text}`}
        style={{ textShadow: '0px 1px 1px rgba(0,0,0,0.1)' }}
      >
        <span className="truncate px-2">{currentEffort === 'Vazio' ? '' : effortConfig.label}</span>
        {updateEffort.isPending && (
          <span className="absolute right-1 w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        )}
      </button>

      {isOpen && rect && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] w-48 bg-white rounded-lg shadow-xl border border-slate-100 p-2 animate-in fade-in"
          style={{ top: rect.bottom + 4, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' }}
        >
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Complexidade / Esforço</div>
          {Object.keys(EFFORT_COLORS).map((effort) => {
            const config = EFFORT_COLORS[effort];
            return (
              <button
                key={effort}
                onClick={() => updateEffort.mutate(effort === 'Vazio' ? '' : effort)}
                className={`w-full text-left px-3 py-2 mb-1 rounded text-white font-medium text-[13px] transition-transform hover:scale-[1.02] active:scale-95 flex items-center justify-between ${config.bg}`}
              >
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
