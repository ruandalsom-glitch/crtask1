'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { AssigneeCell } from './AssigneeCell';
import { Search, PlusCircle, Trash2, CheckCircle2, RotateCcw, X, Clock, History } from 'lucide-react';

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
    queryKey: ['workspace_users'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('email, avatar_url, role');
      return data || [];
    }
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
    
    // Verifica se o dia é ativo para esta rotina
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
    if (!confirm('Deseja finalizar esta semana? Isso limpará a tabela e salvará o resultado no Histórico de Atividades de cada rotina.')) return;
    
    if (tasks) {
      for (const task of tasks) {
        if (!task.is_routine) continue;
        const r = task.routine_status || {};
        
        // Verifica se teve algum preenchimento
        const hasData = daysOfWeek.some(d => r[d.key]);
        
        if (hasData) {
          // Salva histórico
          const historyText = daysOfWeek.map(d => {
            if (r[d.key] === 'Feito') return `${d.label} (✅)`;
            if (r[d.key] === 'Pendente') return `${d.label} (❌)`;
            return `${d.label} (-)`;
          }).join(', ');

          const currentWeek = getWeekNumber(new Date());
          await supabase.from('activity_logs').insert([{
            task_id: task.id,
            user_email: 'Sistema (Fechamento)',
            action: `[${task.title}] Semana ${currentWeek} concluída. Resultado: ${historyText}`
          }]);

          // Limpa os dias mas mantém as configurações
          const newRoutine = { ...r };
          daysOfWeek.forEach(d => delete newRoutine[d.key]);
          await supabase.from('tasks').update({ routine_status: newRoutine }).eq('id', task.id);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      alert('Semana finalizada! O histórico foi salvo nas Atividades de cada tarefa.');
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
    // Ordem fixa: posição -> data de criação -> ID
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-[14px] font-medium transition-colors shadow-sm"
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
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded hover:bg-blue-50 transition-colors text-sm font-medium border border-slate-200 hover:border-blue-200"
          title="Salvar histórico nas atividades e limpar a semana"
        >
          <RotateCcw className="w-4 h-4" /> Finalizar Semana
        </button>
        )}
      </div>

      {/* Modal de Histórico */}
      {historyTaskId && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-blue-600"/> Histórico da Rotina</h2>
              <button onClick={() => setHistoryTaskId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
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
                      <p className="text-sm text-slate-600">{log.action}</p>
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

      <div className="flex-1 overflow-y-auto pb-24 pt-6 px-8">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[#676879] text-[14px]">
                <th className="font-medium px-6 py-3 border-r border-slate-200 w-1/3">Tarefa da Rotina</th>
                <th className="font-medium px-4 py-3 border-r border-slate-200 w-40 text-center">Horário</th>
                <th className="font-medium px-4 py-3 border-r border-slate-200 w-32 text-center">Responsável</th>
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
                            title="Ver histórico"
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
                  <td colSpan={8} className="text-center py-8 text-slate-400 text-sm">
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
