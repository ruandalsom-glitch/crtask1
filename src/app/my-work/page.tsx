'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { CheckSquare, Calendar, LayoutTemplate } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: any = {
  'Feito': 'bg-[#00c875]',
  'Trabalhando': 'bg-[#fdab3d]',
  'Travado': 'bg-[#e2445c]',
  'Pendente': 'bg-[#c4c4c4] dark:bg-slate-600',
};

const PRIORITY_COLORS: any = {
  'Alta': 'bg-[#e2445c] dark:bg-rose-600',
  'Média': 'bg-[#5559df] dark:bg-indigo-600',
  'Baixa': 'bg-[#579bfc] dark:bg-blue-600',
  'Vazio': 'bg-[#c4c4c4] dark:bg-slate-600',
};

export default function MyWorkPage() {
  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });
  const userEmail = currentUser?.email || null;

  const { data: myTasks, isLoading } = useQuery({
    queryKey: ['my_work_clean', userEmail],
    queryFn: async () => {
      if (!userEmail) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          boards:board_id (id, name, workspace_id)
        `)
        .ilike('assignee_email', `%${userEmail}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtra estritamente tarefas de trabalho reais (excluindo rotinas geradas e lembretes de calendário)
      const cleanTasks = (data || []).filter((t: any) => {
        if (t.is_routine) return false;
        if (t.task_type === 'Lembrete' || t.task_type === 'Rotina') return false;
        return true;
      });

      const activeWorkspace = typeof window !== 'undefined' ? localStorage.getItem('monday_active_workspace') : null;
      if (activeWorkspace) {
        return cleanTasks.filter((t: any) => t.boards?.workspace_id === activeWorkspace);
      }
      return cleanTasks;
    },
    enabled: !!userEmail
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', day: 'numeric' }).format(date).replace('.', '');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-50 dark:bg-[#0b0e17]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 dark:border-indigo-500/30 dark:border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Agrupar tarefas por Quadro
  const tasksByBoard = (myTasks || []).reduce((acc: any, task: any) => {
    const boardName = task.boards?.name || 'Quadro Desconhecido';
    if (!acc[boardName]) acc[boardName] = [];
    acc[boardName].push(task);
    return acc;
  }, {});

  const boardNames = Object.keys(tasksByBoard);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0b0e17] overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0e1322] shrink-0">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-indigo-600/20 text-blue-600 dark:text-indigo-400 border border-blue-100 dark:border-indigo-500/30 flex items-center justify-center">
            <CheckSquare className="w-5 h-5" />
          </div>
          <span>Minhas Tarefas</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Apenas atividades operacionais atribuídas a você nos quadros do setor (excluindo rotinas e calendário).
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-[#0b0e17]">
        <div className="max-w-5xl mx-auto space-y-6">
          {boardNames.length === 0 ? (
            <div className="text-center p-12 bg-white dark:bg-[#131929] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
              <CheckSquare className="w-14 h-14 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Tudo em dia!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Você não possui tarefas pendentes atribuídas a você no momento.
              </p>
            </div>
          ) : (
            boardNames.map(boardName => {
              const tasks = tasksByBoard[boardName];
              const boardId = tasks[0]?.board_id;

              return (
                <div key={boardName} className="bg-white dark:bg-[#131929] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-sm overflow-hidden">
                  <div className="bg-slate-50 dark:bg-white/[0.02] px-6 py-3.5 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <LayoutTemplate className="w-4 h-4 text-blue-600 dark:text-indigo-400" />
                      <span>{boardName}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                        {tasks.length}
                      </span>
                    </h2>
                    <Link href={`/boards/${boardId}`} className="text-xs font-bold text-blue-600 dark:text-indigo-400 hover:underline transition-colors">
                      Abrir quadro →
                    </Link>
                  </div>
                  
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/[0.04] bg-white dark:bg-[#131929] text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">
                        <th className="font-semibold px-6 py-2.5 w-1/2">Tarefa</th>
                        <th className="font-semibold px-4 py-2.5 w-32 text-center">Status</th>
                        <th className="font-semibold px-4 py-2.5 w-32 text-center">Prazo</th>
                        <th className="font-semibold px-4 py-2.5 w-32 text-center">Prioridade</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {tasks.map((task: any) => (
                        <tr key={task.id} className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 py-3">
                            <Link href={`/boards/${boardId}`} className="font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-indigo-400 truncate block">
                              {task.title}
                            </Link>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">{task.group_name || 'Geral'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2.5 py-1 text-[11px] font-bold text-white rounded-md shadow-2xs ${STATUS_COLORS[task.status] || STATUS_COLORS['Pendente']}`}>
                              {task.status || 'Pendente'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium text-xs">
                              {task.due_date && <Calendar className="w-3 h-3 text-slate-400"/>}
                              <span>{formatDate(task.due_date)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2.5 py-1 text-[11px] font-bold text-white rounded-md shadow-2xs ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS['Vazio']}`}>
                              {task.priority || 'Média'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
