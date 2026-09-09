'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const PRIORITY_COLORS: Record<string, string> = {
  'Alta': 'bg-[#401694]',
  'Média': 'bg-[#5559df]',
  'Baixa': 'bg-[#579bfc]',
  'Vazio': 'bg-[#c4c4c4]',
};

export function PriorityCell({ task }: { task: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const currentPriority = task.priority || 'Vazio';
  const colorClass = PRIORITY_COLORS[currentPriority] || PRIORITY_COLORS['Vazio'];

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      if (buttonRef.current) {
        setRect(buttonRef.current.getBoundingClientRect());
      }
    };

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  const updatePriority = useMutation({
    mutationFn: async (newPriority: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ priority: newPriority })
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
        className={`w-full h-full min-h-[36px] flex items-center justify-center text-white font-medium text-[13px] shadow-sm hover:opacity-90 transition-opacity ${colorClass}`}
        style={{ textShadow: '0px 1px 1px rgba(0,0,0,0.1)' }}
      >
        <span className="truncate px-2">{currentPriority === 'Vazio' ? '' : currentPriority}</span>
        {updatePriority.isPending && (
          <span className="absolute right-1 w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        )}
      </button>

      {isOpen && rect && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] w-48 bg-white rounded-lg shadow-xl border border-slate-100 p-2 animate-in fade-in"
          style={{ top: rect.bottom + 4, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' }}
        >
          {Object.keys(PRIORITY_COLORS).map((priority) => (
            <button
              key={priority}
              onClick={() => updatePriority.mutate(priority === 'Vazio' ? '' : priority)}
              className={`w-full text-left px-3 py-2 mb-1 rounded text-white font-medium text-[13px] transition-transform hover:scale-[1.02] active:scale-95 ${PRIORITY_COLORS[priority]}`}
            >
              {priority}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
