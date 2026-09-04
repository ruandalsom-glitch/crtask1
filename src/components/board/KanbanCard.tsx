'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, MessageCirclePlus, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

const STATUS_COLORS: any = {
  'Feito': 'bg-[#00c875]',
  'Trabalhando': 'bg-[#fdab3d]',
  'Travado': 'bg-[#e2445c]',
  'Pendente': 'bg-[#c4c4c4]',
};

const PRIORITY_COLORS: any = {
  'Alta': 'bg-[#401694]',
  'Média': 'bg-[#5559df]',
  'Baixa': 'bg-[#579bfc]',
  'Vazio': 'bg-[#c4c4c4]',
};

export function KanbanCard({ task, isOverlay, onOpenTask }: { task: any, isOverlay?: boolean, onOpenTask?: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const { data: workspaceUsers } = useQuery({
    queryKey: ['workspace_users'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('email, avatar_url');
      return profiles || [];
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0 : 1, // Torna o original invisível para não haver duplicidade
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', day: 'numeric' }).format(date).replace('.', '');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg shadow-sm border border-slate-200 p-4 cursor-grab active:cursor-grabbing hover:border-slate-300 ${!isDragging && !isOverlay ? 'transition-all' : ''} ${
        isOverlay ? 'scale-105 shadow-xl rotate-2 opacity-90 cursor-grabbing !transition-none' : ''
      }`}
    >
      <h4 className="font-semibold text-[#323338] text-[14px] leading-tight mb-3">
        {task.title}
      </h4>
      
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* Status Badge */}
        <div className="relative group/tooltip">
          <div className="flex items-center bg-slate-100 rounded text-xs font-medium text-slate-700 overflow-hidden pr-2">
            <div className={`w-1 h-5 ${STATUS_COLORS[task.status] || STATUS_COLORS['Pendente']} mr-1.5`}></div>
            {task.status || 'Pendente'}
          </div>
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#323338] text-white text-[11px] font-bold px-2 py-1 rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Status
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#323338]"></div>
          </div>
        </div>

        {/* Prazo Badge */}
        {task.due_date && (
          <div className="relative group/tooltip">
            <div className="flex items-center bg-slate-100 rounded px-2 py-0.5 text-xs font-medium text-slate-600 gap-1.5 h-5">
              <Calendar className="w-3 h-3 text-slate-400" />
              {formatDate(task.due_date)}
            </div>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#323338] text-white text-[11px] font-bold px-2 py-1 rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Prazo
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#323338]"></div>
            </div>
          </div>
        )}

        {/* Prioridade Badge */}
        {task.priority && (
          <div className="relative group/tooltip">
            <div className="flex items-center bg-slate-100 rounded text-xs font-medium text-slate-700 overflow-hidden pr-2">
              <div className={`w-1 h-5 ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS['Vazio']} mr-1.5`}></div>
              {task.priority}
            </div>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#323338] text-white text-[11px] font-bold px-2 py-1 rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Prioridade
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#323338]"></div>
            </div>
          </div>
        )}

        {/* Esforço / Complexidade Badge */}
        {task.effort && (
          <div className="relative group/tooltip">
            <div className="flex items-center bg-slate-100 rounded px-2 py-0.5 text-xs font-medium text-slate-700 gap-1.5 h-5 border border-slate-200">
              <span>{task.effort === 'Baixo' ? '⚡' : task.effort === 'Médio' ? '⚖️' : task.effort === 'Alto' ? '🔥' : '🚀'}</span>
              {task.effort}
            </div>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#323338] text-white text-[11px] font-bold px-2 py-1 rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Esforço
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#323338]"></div>
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 mb-4 mt-1 font-medium truncate">
        {task.group_name || 'Este mês'}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex -space-x-2">
          {task.assignee_email ? (
            task.assignee_email.split(',').map((email: string, i: number) => {
              const e = email.trim();
              if (!e) return null;
              const profile = workspaceUsers?.find((u: any) => u.email === e);
              const avatarSrc = profile?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${e}`;
              return (
                <div key={i} title={e} className="w-6 h-6 rounded-full bg-slate-200 border border-white overflow-hidden flex items-center justify-center relative group">
                  <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                </div>
              );
            })
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-100 border border-white overflow-hidden flex items-center justify-center" title="Sem responsável">
              <User className="w-3.5 h-3.5 text-slate-400" />
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onOpenTask?.(); }}
            className="flex items-center gap-1 hover:bg-slate-50 p-1 rounded transition-colors text-slate-400 hover:text-blue-500 relative"
            title="Ver arquivos"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          </button>
          <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onOpenTask?.(); }}
            className="flex items-center gap-1 hover:bg-slate-50 p-1 rounded transition-colors text-slate-400 hover:text-blue-500 relative group"
            title="Atualizações"
          >
            <MessageCirclePlus className="w-4 h-4 stroke-[1.5]" />
            {task.task_updates?.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white border border-white">
                {task.task_updates.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
