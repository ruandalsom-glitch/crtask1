'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { AssigneeCell } from './AssigneeCell';
import { Search, PlusCircle, Trash2, CheckCircle2, RotateCcw, X, Clock, History, MessageSquare, Send } from 'lucide-react';

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil(( ( (date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
}

export function BoardRoutineView({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [isPostingComment, setIsPostingComment] = useState<boolean>(false);

  const [newRoutine, setNewRoutine] = useState({
    title: '',
    assignee_email: '',
    time: '',
    timeEnd: '',
    activeDays: ['mon', 'tue', 'wed', 'thu', 'fri']
  });

  const daysOfWeek = [
    { key: 'mon', label: 'Segunda' },
    { key: 'tue', label: 'Terça' },
    { key: 'wed', label: 'Quarta' },
    { key: 'thu', label: 'Quinta' },
    { key: 'fri', label: 'Sexta' }
  ];

  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  const { data: workspaceUsers } = useQuery({
    queryKey: ['workspace_users', boardId],
    queryFn: async () => {
      const { data: board } = await supabase.from('boards').select('workspace_id').eq('id', boardId).single();
      const { data: profiles } = await supabase.from('profiles').select('id, email, avatar_url, role');
      
      if (!board?.workspace_id) return profiles || [];

      const { data: members } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', board.workspace_id);
      const memberUserIds = new Set(members?.map(m => m.user_id) || []);

      return (profiles || []).filter(p => p.role === 'admin' || memberUserIds.has(p.id));
    },
    staleTime: 5 * 60 * 1000
  });

  const currentUserProfile = workspaceUsers?.find((u: any) => u.email === userProfile?.email);
  const isLeaderOrAdmin = currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'leader';
  
  const { data: boardInfo } = useQuery({
    queryKey: ['board_info', boardId],
    queryFn: async () => {
      const { data } = await supabase.from('boards').select('name').eq('id', boardId).single();
      return data;
    }
  });

  const canEditBoard = true;

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_updates(id)')
        .eq('board_id', boardId)
        .order('position')
        .order('created_at');
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000
  });

  const [commentDayFilter, setCommentDayFilter] = useState<string>('all');
  const [selectedCommentDay, setSelectedCommentDay] = useState<string>(() => {
    const day = new Date().getDay();
    const map: Record<number, string> = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta' };
    return map[day] || 'Geral';
  });

  const availableDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Geral'];

  const parseComment = (content: string) => {
    const match = content?.match(/^\[(Segunda|Terça|Quarta|Quinta|Sexta|Geral)\]\s*([\s\S]*)$/);
    if (match) {
      return { day: match[1], text: match[2] };
    }
    return { day: 'Geral', text: content || '' };
  };

  const activeCommentTask = tasks?.find((t: any) => t.id === commentTaskId);

  // Buscar comentários para a rotina selecionada
  const { data: routineComments, refetch: refetchRoutineComments } = useQuery({
    queryKey: ['task_updates', commentTaskId],
    queryFn: async () => {
      if (!commentTaskId) return [];
      const { data, error } = await supabase
        .from('task_updates')
        .select('*')
        .eq('task_id', commentTaskId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!commentTaskId
  });

  const { data: activityLogs } = useQuery({
    queryKey: ['routine_history', historyTaskId],
    queryFn: async () => {
      if (!historyTaskId) return [];
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('task_id', historyTaskId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!historyTaskId
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', boardId] })
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', boardId] })
  });

  const toggleDayStatus = (task: any, dayKey: string) => {
    if (!canEditBoard) {
      alert("Você não tem permissão para alterar rotinas neste quadro.");
      return;
    }
    const currentRoutine = task.routine_status || {};
    
    const activeDays = currentRoutine.config_days || ['mon', 'tue', 'wed', 'thu', 'fri'];
    if (!activeDays.includes(dayKey)) return;

    let nextStatus = 'Feito';
    if (currentRoutine[dayKey] === 'Feito') nextStatus = 'Pendente';
    else if (currentRoutine[dayKey] === 'Pendente') nextStatus = 'null';

    const newRoutine = { ...currentRoutine };
    if (nextStatus === 'null') {
      delete newRoutine[dayKey];
    } else {
      newRoutine[dayKey] = nextStatus;
    }

    updateTask.mutate({ id: task.id, updates: { routine_status: newRoutine } });
  };

  const resetAllRoutines = async () => {
    if (!canEditBoard) {
      alert("Você não tem permissão para finalizar a semana neste quadro.");
      return;
    }
    if (!confirm('Deseja finalizar esta semana? Isso limpará a tabela de rotinas, salvará os resultados e os comentários por dia no Histórico de Atividades, e reiniciará os comentários para a nova semana.')) return;
    
    if (tasks) {
      for (const task of tasks) {
        if (!task.is_routine) continue;
        const r = task.routine_status || {};
        
        const hasData = daysOfWeek.some(d => r[d.key]);

        // Buscar comentários cadastrados para esta rotina
        const { data: comments } = await supabase
          .from('task_updates')
          .select('id, content, author_email')
          .eq('task_id', task.id)
          .order('created_at', { ascending: true });

        let commentsSummary = '';
        if (comments && comments.length > 0) {
          // Group comments by day
          const grouped: Record<string, string[]> = {};
          comments.forEach(c => {
            const parsed = parseComment(c.content);
            const author = c.author_email ? c.author_email.split('@')[0] : 'Usuário';
            if (!grouped[parsed.day]) grouped[parsed.day] = [];
            grouped[parsed.day].push(`"${parsed.text}" (${author})`);
          });

          const daySummaries = Object.entries(grouped)
            .map(([day, list]) => `  • ${day}: ${list.join('; ')}`)
            .join('\n');

          commentsSummary = `\n\n💬 Comentários da Semana (por dia):\n${daySummaries}`;
        }
        
        if (hasData || (comments && comments.length > 0)) {
          const historyText = daysOfWeek.map(d => {
            if (r[d.key] === 'Feito') return `${d.label} (✅)`;
            if (r[d.key] === 'Pendente') return `${d.label} (❌)`;
            return `${d.label} (-)`;
          }).join(', ');

          const currentWeek = getWeekNumber(new Date());
          await supabase.from('activity_logs').insert([{
            task_id: task.id,
            user_email: userProfile?.email || 'Sistema (Fechamento)',
            action: `[${task.title}] Semana ${currentWeek} concluída. Resultado: ${historyText}${commentsSummary}`
          }]);

          const newRoutine = { ...r };
          daysOfWeek.forEach(d => delete newRoutine[d.key]);
          await supabase.from('tasks').update({ routine_status: newRoutine }).eq('id', task.id);

          // Clear routine week comments after archiving
          if (comments && comments.length > 0) {
            await supabase.from('task_updates').delete().eq('task_id', task.id);
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      alert('Semana finalizada! O resultado e os comentários organizados por dia foram salvos no Histórico de Atividades.');
    }
  };

  const handleCreateRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditBoard) {
      alert("Você não tem permissão para criar rotinas neste quadro.");
      return;
    }
    if (!newRoutine.title) return;

    const routineConfig = {
      config_time: newRoutine.time,
      config_time_end: newRoutine.timeEnd,
      config_days: newRoutine.activeDays
    };

    const { error } = await supabase.from('tasks').insert([
      { 
        title: newRoutine.title, 
        board_id: boardId, 
        is_routine: true, 
        assignee_email: newRoutine.assignee_email || null,
        routine_status: routineConfig,
        position: (tasks?.length || 0) + 1 
      }
    ]);

    if (error) {
      alert('Erro ao criar rotina: ' + error.message);
    } else {
      setIsModalOpen(false);
      setNewRoutine({ title: '', assignee_email: '', time: '', timeEnd: '', activeDays: ['mon', 'tue', 'wed', 'thu', 'fri'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentTaskId || !newCommentText.trim()) return;
    setIsPostingComment(true);

    const formattedContent = `[${selectedCommentDay}] ${newCommentText.trim()}`;

    try {
      const { error } = await supabase.from('task_updates').insert([
        { 
          task_id: commentTaskId, 
          content: formattedContent,
          author_email: userProfile?.email || 'Usuário'
        }
      ]);
      if (error) throw error;

      setNewCommentText('');
      refetchRoutineComments();
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
    } catch (err: any) {
      alert('Erro ao enviar comentário: ' + err.message);
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Excluir este comentário?')) return;
    await supabase.from('task_updates').delete().eq('id', commentId);
    refetchRoutineComments();
    queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
  };

  const toggleNewRoutineDay = (dayKey: string) => {
    setNewRoutine(prev => {
      const active = prev.activeDays.includes(dayKey);
      return {
        ...prev,
        activeDays: active ? prev.activeDays.filter(d => d !== dayKey) : [...prev.activeDays, dayKey]
      };
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredTasks = tasks?.filter((task: any) => {
    if (!task.is_routine) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a: any, b: any) => {
    if (a.position !== b.position) return (a.position || 0) - (b.position || 0);
    if (a.created_at !== b.created_at) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return a.id.localeCompare(b.id);
  });

  const getStatusColor = (status: string, isActive: boolean) => {
    if (!isActive) return 'bg-slate-50 text-slate-300 cursor-not-allowed';
    if (status === 'Feito') return 'bg-[#00c875] text-white';
    if (status === 'Pendente') return 'bg-[#e2445c] text-white';
    return 'bg-slate-100 hover:bg-slate-200 text-transparent hover:text-slate-400';
  };

  const filteredRoutineComments = routineComments?.filter((comment: any) => {
    if (commentDayFilter === 'all') return true;
    const parsed = parseComment(comment.content);
    return parsed.day === commentDayFilter;
  });

  return (
    <div className="w-full h-full relative flex flex-col bg-white">
      {/* Modal de Nova Rotina */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Criar Nova Rotina</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCreateRoutine} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da rotina</label>
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={newRoutine.title}
                  onChange={e => setNewRoutine({...newRoutine, title: e.target.value})}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Backup do banco de dados"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Início</label>
                  <input 
                    type="time" 
                    value={newRoutine.time}
                    onChange={e => setNewRoutine({...newRoutine, time: e.target.value})}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fim</label>
                  <input 
                    type="time" 
                    value={newRoutine.timeEnd}
                    onChange={e => setNewRoutine({...newRoutine, timeEnd: e.target.value})}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
                  <select 
                    value={newRoutine.assignee_email}
                    onChange={e => setNewRoutine({...newRoutine, assignee_email: e.target.value})}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="" className="text-slate-800">Nenhum</option>
                    {workspaceUsers?.map((u: any) => (
                      <option key={u.email} value={u.email} className="text-slate-800">{u.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dias contabilizados</label>
                <div className="flex gap-2">
                  {daysOfWeek.map(day => {
                    const isActive = newRoutine.activeDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleNewRoutineDay(day.key)}
                        className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${isActive ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                      >
                        {day.label.substring(0,3)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded">Criar Rotina</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          {canEditBoard && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-[14px] font-medium transition-colors shadow-sm cursor-pointer"
          >
            Nova Rotina
          </button>
          )}
          
          <div className="w-px h-6 bg-slate-200 mx-1"></div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar rotina..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-full border border-slate-200 bg-white text-[14px] focus:outline-none focus:border-blue-400 transition-colors w-64 shadow-sm"
            />
          </div>
        </div>

        {canEditBoard && (
        <button 
          onClick={resetAllRoutines}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded hover:bg-blue-50 transition-colors text-sm font-medium border border-slate-200 hover:border-blue-200 cursor-pointer"
          title="Salvar histórico e comentários nas atividades e limpar a semana"
        >
          <RotateCcw className="w-4 h-4" /> Finalizar Semana
        </button>
        )}
      </div>

      {/* Modal de Histórico de Atividades */}
      {historyTaskId && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-blue-600"/> Histórico da Rotina</h2>
              <button onClick={() => setHistoryTaskId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {activityLogs && activityLogs.length > 0 ? (
                <div className="space-y-4">
                  {activityLogs.map((log: any) => (
                    <div key={log.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <History className="w-3 h-3" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{log.user_email}</span>
                        <span className="text-xs text-slate-400 ml-auto">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{log.action}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Nenhum histórico encontrado para esta rotina.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Comentários da Rotina */}
      {commentTaskId && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600"/> 
                Comentários: <span className="text-blue-600">{activeCommentTask?.title}</span>
              </h2>
              <button onClick={() => setCommentTaskId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {/* Abas de filtro por dia */}
            <div className="px-6 py-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
              <span className="text-slate-500 font-medium mr-1">Filtrar:</span>
              <button
                onClick={() => setCommentDayFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  commentDayFilter === 'all' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Todos ({routineComments?.length || 0})
              </button>
              {availableDays.map(day => {
                const count = routineComments?.filter((c: any) => parseComment(c.content).day === day).length || 0;
                return (
                  <button
                    key={day}
                    onClick={() => setCommentDayFilter(day)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      commentDayFilter === day ? 'bg-blue-600 text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {day} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4">
              {filteredRoutineComments && filteredRoutineComments.length > 0 ? (
                filteredRoutineComments.map((comment: any) => {
                  const parsed = parseComment(comment.content);
                  return (
                    <div key={comment.id} className="bg-white p-4 rounded-xl shadow-2xs border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">{comment.author_email}</span>
                          <span className="bg-blue-50 text-blue-600 text-[11px] px-2 py-0.5 rounded-full font-semibold border border-blue-100">
                            {parsed.day}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">
                            {new Date(comment.created_at).toLocaleString('pt-BR')}
                          </span>
                          {(userProfile?.email === comment.author_email || isLeaderOrAdmin) && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-slate-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                              title="Excluir comentário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{parsed.text}</p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  {commentDayFilter === 'all' 
                    ? 'Nenhum comentário cadastrado para esta rotina ainda.'
                    : `Nenhum comentário encontrado para ${commentDayFilter}.`}
                </div>
              )}
            </div>

            <form onSubmit={handlePostComment} className="p-4 border-t border-slate-200 bg-white flex flex-col gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span>Comentar para o dia:</span>
                <select
                  value={selectedCommentDay}
                  onChange={(e) => setSelectedCommentDay(e.target.value)}
                  className="px-2.5 py-1 border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
                >
                  {availableDays.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder={`Escreva um comentário para ${selectedCommentDay}...`}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 outline-none focus:border-blue-500 bg-white"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim() || isPostingComment}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {isPostingComment ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabela de Rotinas */}
      <div className="flex-1 overflow-y-auto pb-24 pt-6 px-8">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[#676879] text-[14px]">
                <th className="font-medium px-6 py-3 border-r border-slate-200 w-1/3">Tarefa da Rotina</th>
                <th className="font-medium px-4 py-3 border-r border-slate-200 w-36 text-center">Horário</th>
                <th className="font-medium px-4 py-3 border-r border-slate-200 w-32 text-center">Responsável</th>
                <th className="font-medium px-4 py-3 border-r border-slate-200 w-28 text-center">Comentários</th>
                {daysOfWeek.map(day => (
                  <th key={day.key} className="font-medium px-2 py-3 border-r border-slate-200 text-center w-24">
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[15px]">
              {filteredTasks && filteredTasks.length > 0 ? (
                filteredTasks.map((task) => {
                  const rConf = task.routine_status || {};
                  const activeDays = rConf.config_days || ['mon', 'tue', 'wed', 'thu', 'fri'];

                  return (
                    <tr key={task.id} className="group/row border-b border-slate-200 hover:bg-[#f5f6f8] transition-colors h-[50px]">
                      <td className="px-6 py-0 border-r border-slate-200 relative truncate group/title">
                        <div className="flex items-center justify-between w-full h-full">
                          <input 
                            type="text" 
                            defaultValue={task.title} 
                            onBlur={(e) => {
                              if (e.target.value !== task.title) {
                                updateTask.mutate({ id: task.id, updates: { title: e.target.value } });
                              }
                            }}
                            className="text-[#323338] hover:text-blue-600 font-medium bg-transparent outline-none w-full cursor-text truncate"
                          />
                          <button 
                            onClick={() => setHistoryTaskId(task.id)}
                            className="opacity-0 group-hover/title:opacity-100 p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-100 rounded transition-colors absolute right-8"
                            title="Ver histórico de semanas"
                          >
                            <History className="w-[18px] h-[18px]" />
                          </button>
                          <button 
                            onClick={() => { if(confirm('Excluir esta rotina?')) deleteTask.mutate(task.id); }}
                            className="opacity-0 group-hover/title:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded transition-colors absolute right-2"
                            title="Excluir"
                          >
                            <Trash2 className="w-[18px] h-[18px]" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-0 border-r border-slate-200 text-center relative text-sm text-slate-600 font-medium">
                        {rConf.config_time || rConf.config_time_end ? (
                          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0"/> 
                            <span>{rConf.config_time || '--:--'} {rConf.config_time_end ? `às ${rConf.config_time_end}` : ''}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-0 border-r border-slate-200 text-center relative">
                        <AssigneeCell task={task} />
                      </td>
                      <td className="px-4 py-0 border-r border-slate-200 text-center relative">
                        <button
                          onClick={() => setCommentTaskId(task.id)}
                          className="relative p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-blue-600 cursor-pointer inline-flex items-center justify-center"
                          title="Comentários da rotina"
                        >
                          <MessageSquare className="w-4 h-4 text-slate-500 hover:text-blue-600 transition-colors" />
                          {task.task_updates?.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-xs">
                              {task.task_updates.length}
                            </span>
                          )}
                        </button>
                      </td>
                      {daysOfWeek.map(day => {
                        const status = rConf[day.key];
                        const isActiveDay = activeDays.includes(day.key);
                        
                        return (
                          <td key={day.key} className="p-1 border-r border-slate-200 text-center h-[50px]">
                            <button
                              disabled={!isActiveDay}
                              onClick={() => toggleDayStatus(task, day.key)}
                              className={`w-full h-full flex items-center justify-center transition-all ${getStatusColor(status, isActiveDay)}`}
                            >
                              {!isActiveDay ? (
                                <span className="opacity-50">-</span>
                              ) : (
                                <>
                                  {status === 'Feito' && <CheckCircle2 className="w-5 h-5" />}
                                  {status === 'Pendente' && <X className="w-5 h-5" />}
                                  {!status && <span className="opacity-0 group-hover/row:opacity-100 text-xs font-medium text-slate-400">Marcar</span>}
                                </>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 text-sm">
                    Nenhuma rotina cadastrada neste quadro. Comece adicionando uma nova rotina!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
