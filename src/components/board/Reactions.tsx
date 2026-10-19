'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { SmilePlus } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

const EMOJIS = ['👍', '👎', '❤️', '😂', '🎉', '👀', '🚀', '✅', '🔥', '🤔'];

export function Reactions({ 
  updateId, 
  reactions,
  updateAuthorEmail,
  taskTitle,
  taskId
}: { 
  updateId: string, 
  reactions: any,
  updateAuthorEmail?: string,
  taskTitle?: string,
  taskId?: string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });
  const userEmail = currentUser?.email || null;

  const safeReactions = typeof reactions === 'object' && reactions !== null ? reactions : {};

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

  const toggleReaction = useMutation({
    mutationFn: async (emoji: string) => {
      if (!userEmail) return;
      
      const currentReacts = { ...safeReactions };
      if (!currentReacts[emoji]) {
        currentReacts[emoji] = [];
      }

      const userIndex = currentReacts[emoji].indexOf(userEmail);
      let isAdding = false;

      if (userIndex > -1) {
        currentReacts[emoji].splice(userIndex, 1);
        if (currentReacts[emoji].length === 0) {
          delete currentReacts[emoji];
        }
      } else {
        currentReacts[emoji].push(userEmail);
        isAdding = true;
      }

      const { error } = await supabase
        .from('task_updates')
        .update({ reactions: currentReacts })
        .eq('id', updateId);

      if (error) {
        console.error("Erro ao salvar reação (A coluna 'reactions' JSONB foi criada?):", error);
        throw error;
      }

      if (isAdding && updateAuthorEmail && updateAuthorEmail !== userEmail && taskId && taskTitle) {
        const userName = userEmail.split('@')[0];
        await supabase.from('notifications').insert([{
          user_email: updateAuthorEmail,
          message: `${userName} reagiu com ${emoji} à sua atualização em "${taskTitle}"`,
          task_id: taskId
        }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_updates'] });
      setIsOpen(false);
    }
  });

  return (
    <div className="mt-4 flex items-center gap-2 flex-wrap relative">
      {Object.keys(safeReactions).map(emoji => (
        <button
          key={emoji}
          onClick={() => toggleReaction.mutate(emoji)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-medium border transition-colors ${
            safeReactions[emoji].includes(userEmail) 
              ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 shadow-sm'
          }`}
          title={safeReactions[emoji].join(', ')}
        >
          <span>{emoji}</span>
          <span className="text-xs font-bold">{safeReactions[emoji].length}</span>
        </button>
      ))}

      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors border border-transparent hover:border-slate-200 shadow-sm bg-slate-50"
          title="Adicionar reação"
        >
          <SmilePlus className="w-[18px] h-[18px]" />
        </button>

        {isOpen && (
          <div 
            ref={dropdownRef}
            className="absolute bottom-full left-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50 flex gap-1 animate-in fade-in zoom-in-95"
            style={{ width: 'max-content' }}
          >
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => toggleReaction.mutate(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-xl transition-transform hover:scale-110"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
