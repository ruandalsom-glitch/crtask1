'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragOverEvent, 
  DragEndEvent 
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, useEffect } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { Reactions } from './Reactions';
import { UpdateContent } from './UpdateContent';
import { Eye, EyeOff } from 'lucide-react';
import { AssigneeViewToggle } from './AssigneeViewToggle';

const STATUSES = ['Pendente', 'Trabalhando', 'Travado', 'Feito'];

export function BoardKanbanView({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Buscar tarefas
  const { data: rawTasks, isLoading } = useQuery({
    queryKey: ['tasks', boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_updates(id)')
        .eq('board_id', boardId)
        .order('position');
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000
  });

  // Estado local para otimizar o drag & drop
  const [tasks, setTasks] = useState<any[]>([]);

  // Estados para a Gaveta
  const [taskDetailsOpen, setTaskDetailsOpen] = useState<any | null>(null);
  const [newUpdateText, setNewUpdateText] = useState('');

  const { data: taskUpdates, refetch: refetchUpdates } = useQuery({
    queryKey: ['task_updates', taskDetailsOpen?.id],
    queryFn: async () => {
      if (!taskDetailsOpen?.id) return [];
      const { data, error } = await supabase
        .from('task_updates')
        .select('*')
        .eq('task_id', taskDetailsOpen.id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!taskDetailsOpen?.id
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

  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  const postUpdate = async () => {
    if (!newUpdateText.trim() || !taskDetailsOpen) return;
    const { error } = await supabase.from('task_updates').insert([
      { task_id: taskDetailsOpen.id, content: newUpdateText, author_email: userProfile?.email || 'Usuário' }
    ]);
    if (!error) {
      setNewUpdateText('');
      refetchUpdates();

      const assigneeEmails = new Set<string>();
      if (taskDetailsOpen.assignee_email) {
        taskDetailsOpen.assignee_email.split(',').forEach((e: string) => {
          if (e.trim()) assigneeEmails.add(e.trim());
        });
      }

      const mentionEmails = new Set<string>();
      const mentions = newUpdateText.match(/@([a-zA-Z0-9_.-]+)/g) || [];
      if (mentions.length > 0 && workspaceUsers) {
        mentions.forEach((mention: string) => {
          const username = mention.substring(1).toLowerCase();
          const matchedUser = workspaceUsers.find((u: any) => u.email.toLowerCase().startsWith(username));
          if (matchedUser) {
            mentionEmails.add(matchedUser.email);
          }
        });
      }

      const notifications: any[] = [];
      const currentUserName = userProfile?.email?.split('@')[0] || 'Usuário';

      mentionEmails.forEach(email => assigneeEmails.delete(email));

      mentionEmails.forEach(email => {
        notifications.push({
          user_email: email,
          message: `${currentUserName} mencionou você na tarefa "${taskDetailsOpen.title}"`,
          task_id: taskDetailsOpen.id
        });
      });

      assigneeEmails.forEach(email => {
        notifications.push({
          user_email: email,
          message: `Nova atualização na tarefa: ${taskDetailsOpen.title}`,
          task_id: taskDetailsOpen.id
        });
      });

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    }
  };

  useEffect(() => {
    if (rawTasks && !activeId) setTasks(rawTasks);
  }, [rawTasks, activeId]);

  useEffect(() => {
    if (rawTasks && !taskDetailsOpen) {
      const urlParams = new URLSearchParams(window.location.search);
      const taskIdUrl = urlParams.get('taskId');
      if (taskIdUrl) {
        const t = rawTasks.find((task: any) => task.id === taskIdUrl);
        if (t) {
          setTaskDetailsOpen(t);
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [rawTasks]);

  const currentUserProfile = workspaceUsers?.find((u: any) => u.email === userProfile?.email);
  const isLeaderOrAdmin = currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'leader';
  
  const { data: boardInfo } = useQuery({
    queryKey: ['board_info', boardId],
    queryFn: async () => {
      const { data } = await supabase.from('boards').select('name').eq('id', boardId).single();
      return data;
    }
  });

  const boardName = boardInfo?.name || '';
  const isGeneralBoard = boardName.toLowerCase().includes('projeto') || boardName.toLowerCase().includes('panorama') || boardName.toLowerCase().includes('geral');
  const isBoardOwner = userProfile?.email?.toLowerCase().includes(boardName.toLowerCase().trim());
  const canEditBoard = isLeaderOrAdmin || isGeneralBoard || isBoardOwner || !boardName;

  const canDeleteTask = (task: any) => {
    if (isLeaderOrAdmin) return true;
    if (canEditBoard && task.assignee_email === userProfile?.email) return true;
    if (isBoardOwner) return true;
    return false;
  };

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const taskToUpdate = rawTasks?.find((t: any) => t.id === id);
      if (taskToUpdate && !canDeleteTask(taskToUpdate)) {
        alert("Você não tem permissão para alterar o status desta tarefa.");
        throw new Error("Unauthorized");
      }
      
      const updates: any = { status };
      if (status === 'Feito') {
        updates.group_name = 'Concluído';
      } else if (taskToUpdate?.group_name === 'Concluído' || !taskToUpdate?.group_name) {
        updates.group_name = 'Tarefas pendentes';
      }

      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', boardId] })
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (isLoading) {
    return (
      <div className="p-8 h-full flex overflow-x-auto gap-6 flex-1 bg-[#f8fafc] animate-skeleton">
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className="w-72 shrink-0 bg-slate-100 rounded-xl p-4 flex flex-col gap-4 border border-slate-200">
            <div className="h-6 w-32 bg-slate-200 rounded-md"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((card) => (
                <div key={card} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 space-y-3">
                  <div className="h-4 w-full bg-slate-200 rounded"></div>
                  <div className="h-4 w-2/3 bg-slate-200 rounded"></div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
                    <div className="h-6 w-6 bg-slate-200 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Organizar tarefas por coluna
  const columnsData = STATUSES.map(status => ({
    id: status,
    title: status,
    tasks: tasks.filter(t => {
      if (t.is_private && !isLeaderOrAdmin && t.assignee_email !== userProfile?.email) return false;
      return !t.is_routine && t.task_type !== 'Lembrete' && (t.status || 'Pendente') === status;
    })
  }));

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEditBoard) {
      alert("Você não tem permissão para alterar tarefas neste quadro.");
      return;
    }
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    // Encontrar tarefa arrastada
    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Encontrar o status de destino (pode ser o ID da coluna ou o ID de outra tarefa)
    const overTask = tasks.find(t => t.id === overId);
    const destinationStatus = overTask ? overTask.status : overId;

    if (activeTask.status !== destinationStatus) {
      setTasks((prev) => {
        return prev.map(t => 
          t.id === activeId ? { ...t, status: destinationStatus } : t
        );
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    
    if (over) {
      const activeTask = tasks.find(t => t.id === active.id);
      const overTask = tasks.find(t => t.id === over.id);
      const newStatus = overTask ? overTask.status : over.id;
      
      // Atualiza banco de dados se mudou de coluna
      if (activeTask && rawTasks?.find(t => t.id === active.id)?.status !== newStatus) {
        updateTaskStatus.mutate({ id: activeTask.id, status: newStatus as string });
      }
    }
  };

  const activeTask = tasks.find(t => t.id === activeId);

  return (
    <div className="h-full flex flex-col bg-[#f5f6f8]">
      {isLeaderOrAdmin && (
        <div className="px-8 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Painel Kanban</span>
          <AssigneeViewToggle />
        </div>
      )}
      <div className="p-8 h-full flex overflow-x-auto gap-6 flex-1">
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {columnsData.map((col) => (
          <KanbanColumn key={col.id} column={col}>
            <SortableContext items={col.tasks.map(t => t.id)}>
              <div className="flex flex-col gap-3 min-h-[100px]">
                {col.tasks.map(task => (
                  <KanbanCard key={task.id} task={task} onOpenTask={() => setTaskDetailsOpen(task)} />
                ))}
              </div>
            </SortableContext>
          </KanbanColumn>
        ))}

        <DragOverlay dropAnimation={null}>
          {activeTask ? <KanbanCard task={activeTask} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Task Drawer (Gaveta Lateral de Atualizações) no Kanban */}
      {taskDetailsOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/20 z-40" onClick={() => setTaskDetailsOpen(null)}></div>
          <div className="fixed top-0 right-0 h-screen w-[600px] bg-white shadow-2xl z-50 border-l border-slate-200 flex flex-col animate-in slide-in-from-right-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {taskDetailsOpen.is_private && <span title="Privada"><EyeOff className="w-5 h-5 text-red-500" /></span>}
                {taskDetailsOpen.title}
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                {isLeaderOrAdmin && (
                  <button 
                    onClick={() => {
                      updateTask.mutate({ id: taskDetailsOpen.id, updates: { is_private: !taskDetailsOpen.is_private } })
                    }}
                    className={`p-2 rounded-md transition-colors ${taskDetailsOpen.is_private ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'hover:bg-slate-100 text-slate-400'}`}
                    title={taskDetailsOpen.is_private ? "Privada (Apenas Admins/Líderes)" : "Pública"}
                  >
                    {taskDetailsOpen.is_private ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                )}
                <button onClick={() => setTaskDetailsOpen(null)} className="p-2 hover:bg-slate-100 rounded-md text-slate-500 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-8">
                <div className="relative">
                  {(() => {
                    const lastWord = newUpdateText.split(/[\s\n]+/).pop() || '';
                    if (lastWord.startsWith('@')) {
                      const search = lastWord.substring(1).toLowerCase();
                      const filtered = workspaceUsers?.filter((u: any) => u.email.toLowerCase().startsWith(search));
                      if (filtered && filtered.length > 0) {
                        return (
                          <div className="absolute left-0 bottom-full mb-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-50">
                            <div className="bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 border-b border-slate-200">
                              Membros
                            </div>
                            {filtered.map((u: any) => (
                              <button
                                key={u.id}
                                onClick={() => {
                                  const newText = newUpdateText.substring(0, newUpdateText.length - lastWord.length) + `@${u.email.split('@')[0]} `;
                                  setNewUpdateText(newText);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 last:border-0 transition-colors"
                              >
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                  {u.email.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm text-slate-700 truncate">{u.email.split('@')[0]}</span>
                              </button>
                            ))}
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                  <textarea 
                    value={newUpdateText}
                    onChange={(e) => setNewUpdateText(e.target.value)}
                    placeholder="Escreva uma atualização..." 
                    className="w-full min-h-[100px] resize-none outline-none text-slate-700 text-sm"
                  ></textarea>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex gap-2">
                    <button onClick={() => setNewUpdateText(prev => prev + '@')} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"><span className="text-xs font-bold">@</span></button>
                  </div>
                  <button 
                    onClick={postUpdate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
                  >
                    Atualizar
                  </button>
                </div>
              </div>

              {taskUpdates && taskUpdates.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {taskUpdates.map((update: any) => (
                    <div key={update.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <UpdateContent content={update.content} taskTitle={taskDetailsOpen.title} />
                      <Reactions 
                        updateId={update.id} 
                        reactions={update.reactions} 
                        updateAuthorEmail={update.author_email} 
                        taskId={taskDetailsOpen.id} 
                        taskTitle={taskDetailsOpen.title} 
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center mt-12 text-slate-400">
                  <p className="text-sm max-w-xs">Nenhuma atualização ainda.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  </div>
  );
}
