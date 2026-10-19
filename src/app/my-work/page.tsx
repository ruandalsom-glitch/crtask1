'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { CheckSquare, Calendar, LayoutTemplate } from 'lucide-react';
import Link from 'next/link';

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

export default function MyWorkPage() {
  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });
  const userEmail = currentUser?.email || null;

  const { data: myTasks, isLoading } = useQuery({
    queryKey: ['my_work', userEmail],
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

      // Pegar apenas tarefas do workspace ativo (opcional, ou podemos mostrar todas)
      const activeWorkspace = localStorage.getItem('monday_active_workspace');
      if (activeWorkspace) {
        return data.filter((t: any) => t.boards?.workspace_id === activeWorkspace);
      }
      return data;
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
      <div className="flex items-center justify-center h-full w-full bg-[#f5f6f8]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
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
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 shrink-0">
        <h1 className="text-[28px] font-medium text-[#323338] tracking-tight flex items-center gap-3">
          <CheckSquare className="w-8 h-8 text-blue-600" />
          Minhas Tarefas
        </h1>
        <p className="text-slate-500 mt-1">Todas as tarefas atribuídas a você em todos os quadros.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-[#f5f6f8]">
        <div className="max-w-5xl mx-auto space-y-8">
          {boardNames.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm">
              <CheckSquare className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-700">Tudo limpo!</h3>
              <p className="text-slate-500 mt-2">Você não tem nenhuma tarefa atribuída a você no momento.</p>
            </div>
          ) : (
            boardNames.map(boardName => {
              const tasks = tasksByBoard[boardName];
              const boardId = tasks[0]?.board_id;

              return (
                <div key={boardName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <LayoutTemplate className="w-5 h-5 text-blue-500" />
                      {boardName}
                    </h2>
                    <Link href={`/boards/${boardId}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                      Ir para o quadro →
                    </Link>
                  </div>
                  
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-white text-[#676879] text-xs uppercase tracking-wider">
                        <th className="font-medium px-6 py-3 w-1/2">Tarefa</th>
                        <th className="font-medium px-4 py-3 w-32 text-center">Status</th>
                        <th className="font-medium px-4 py-3 w-32 text-center">Prazo</th>
                        <th className="font-medium px-4 py-3 w-32 text-center">Prioridade</th>
                      </tr>
                    </thead>
                    <tbody className="text-[14px]">
                      {tasks.map((task: any) => (
                        <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-3">
                            <Link href={`/boards/${boardId}`} className="font-medium text-[#323338] hover:text-blue-600 truncate block">
                              {task.title}
                            </Link>
                            <span className="text-xs text-slate-400 mt-1 block">{task.group_name || 'Sem grupo'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className={`inline-block w-full py-1 text-xs font-bold text-white rounded shadow-sm ${STATUS_COLORS[task.status] || STATUS_COLORS['Pendente']}`}>
                              {task.status || 'Pendente'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-slate-600 font-medium">
                              {task.due_date && <Calendar className="w-3.5 h-3.5 text-slate-400"/>}
                              {formatDate(task.due_date)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className={`inline-block w-full py-1 text-xs font-bold text-white rounded shadow-sm ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS['Vazio']}`}>
                              {task.priority || 'Vazio'}
                            </div>
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
