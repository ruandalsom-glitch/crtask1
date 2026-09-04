'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { StatusCell } from './StatusCell';
import { PriorityCell } from './PriorityCell';
import { AssigneeCell } from './AssigneeCell';
import { Reactions } from './Reactions';
import { UpdateContent } from './UpdateContent';
import { PlusCircle, Trash2, MessageSquare, X, Paperclip, Activity, Copy, Download, Archive, MoreHorizontal, MessageCirclePlus, AlertCircle, CheckCircle2, Search, UserPlus, Sparkles, FileText, Calendar, Eye, EyeOff } from 'lucide-react';

const TimelineBar = ({ progress, color }: { progress: number, color: string }) => (
  <div className="flex items-center w-full">
    <div className="flex-1 h-5 rounded-full overflow-hidden bg-slate-200 flex">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${progress}%` }}></div>
      <div className="h-full bg-slate-300 transition-all duration-500" style={{ width: `${100 - progress}%` }}></div>
    </div>
  </div>
);

const PriorityStars = ({ rating, onChange }: { rating: number, onChange: (newRating: number) => void }) => (
  <div className="flex items-center justify-center gap-0.5 group/stars cursor-pointer">
    {[1, 2, 3, 4, 5].map((star) => (
      <svg 
        key={star} 
        onClick={() => onChange(star)}
        className={`w-4 h-4 transition-colors hover:scale-110 ${star <= rating ? 'text-[#ffcc00]' : 'text-slate-200 hover:text-yellow-200'}`} 
        fill="currentColor" 
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

export function BoardTableView({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState<any | null>(null);
  const [newUpdateText, setNewUpdateText] = useState('');
  const [drawerTab, setDrawerTab] = useState<'updates' | 'files' | 'activity'>('updates');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [priorityFilterOpen, setPriorityFilterOpen] = useState(false);
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Para resolver fuso horário
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', day: 'numeric' }).format(date).replace('.', '');
  };

  const getDueStatus = (dateString: string, status: string) => {
    if (!dateString) return null;
    if (status === 'Feito') return 'done';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateString);
    dueDate.setMinutes(dueDate.getMinutes() + dueDate.getTimezoneOffset());
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) return 'overdue';
    if (dueDate.getTime() === today.getTime()) return 'today';
    return 'pending';
  };

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

  const { data: activityLogs } = useQuery({
    queryKey: ['activity_logs', taskDetailsOpen?.id],
    queryFn: async () => {
      if (!taskDetailsOpen?.id) return [];
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('task_id', taskDetailsOpen.id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!taskDetailsOpen?.id,
    refetchInterval: 30000
  });

  const { data: workspaceUsers } = useQuery({
    queryKey: ['workspace_users'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('email, avatar_url, role');
      return data || [];
    }
  });

  const { data: currentUserProfile } = useQuery({
    queryKey: ['current_user_profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return data || { email: user.email, role: 'user' };
    }
  });

  const isLeaderOrAdmin = currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'leader';
  const userProfile = { email: currentUserProfile?.email };

  const canEditBoard = true;

  const canDeleteTask = (task: any) => {
    if (isLeaderOrAdmin) return true;
    if (canEditBoard && task.assignee_email === userProfile?.email) return true;
    return false;
  };

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const postUpdate = async () => {
    if (!newUpdateText.trim() && !pendingFile) return;
    if (!taskDetailsOpen) return;

    let finalContent = newUpdateText;

    if (pendingFile) {
      setIsUploading(true);
      try {
        const fileExt = pendingFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${taskDetailsOpen.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, pendingFile);

        if (uploadError) {
          alert("Erro no upload: Você criou o bucket 'attachments' e deu permissão pública no Supabase? (Veja o SQL)");
          console.error(uploadError);
          setIsUploading(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath);

        const isImage = pendingFile.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(pendingFile.name);
        const isVideo = pendingFile.type.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(pendingFile.name);
        const markdownContent = (isImage || isVideo) ? `![${pendingFile.name}](${publicUrl})` : `📁 **Arquivo anexado:** [${pendingFile.name}](${publicUrl})`;
        
        finalContent = finalContent ? `${finalContent}\n\n${markdownContent}` : markdownContent;
      } catch (err) {
        console.error(err);
        setIsUploading(false);
        return;
      }
    }

    const { error } = await supabase.from('task_updates').insert([
      { 
        task_id: taskDetailsOpen.id, 
        content: finalContent,
        author_email: userProfile?.email || 'Usuário'
      }
    ]);

    if (!error) {
      setNewUpdateText('');
      setPendingFile(null);
      refetchUpdates();
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });

      // Enviar notificação para responsáveis e pessoas mencionadas
      const assigneeEmails = new Set<string>();
      if (taskDetailsOpen.assignee_email) {
        taskDetailsOpen.assignee_email.split(',').forEach((e: string) => {
          if (e.trim()) assigneeEmails.add(e.trim());
        });
      }

      const mentionEmails = new Set<string>();
      const mentions = finalContent.match(/@([a-zA-Z0-9_.-]+)/g) || [];
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

      // Se a pessoa foi marcada, ela recebe a notificação específica de menção.
      // Removemos dos responsáveis para ela não receber duplicado.
      mentionEmails.forEach(email => assigneeEmails.delete(email));

      mentionEmails.forEach(email => {
        notifications.push({
          user_email: email,
          message: `${userProfile?.email}||${currentUserName} mencionou você na tarefa "${taskDetailsOpen.title}"`,
          task_id: taskDetailsOpen.id
        });
      });

      assigneeEmails.forEach(email => {
        notifications.push({
          user_email: email,
          message: `${userProfile?.email}||${currentUserName} atualizou a tarefa "${taskDetailsOpen.title}"`,
          task_id: taskDetailsOpen.id
        });
      });

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    } else {
      alert("A tabela 'task_updates' ainda não foi criada no Supabase! Rode o SQL.");
    }
    
    setIsUploading(false);
  };

  const deleteUpdate = async (updateId: string, content: string) => {
    if (!confirm('Tem certeza que deseja excluir esta atualização?')) return;
    
    // Tenta apagar o arquivo do Storage caso seja um anexo
    const urlMatch = content.match(/\]\((https:\/\/[^)]+)\)/);
    if (urlMatch) {
      const fullUrl = urlMatch[1];
      const urlParts = fullUrl.split('/attachments/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('attachments').remove([filePath]);
      }
    }

    const { error } = await supabase.from('task_updates').delete().eq('id', updateId);
    
    // Registra a exclusão no Log de Atividades
    const isAttachment = urlMatch !== null;
    const { error: actError } = await supabase.from('activity_logs').insert([{
      task_id: taskDetailsOpen.id,
      user_email: userProfile?.email || 'Usuário',
      action: isAttachment ? 'excluiu um anexo' : 'excluiu um comentário'
    }]);

    if (actError) {
      console.error("Erro ao inserir no activity_logs:", actError);
    }

    if (error) {
      alert("Erro ao excluir: " + error.message);
      console.error("Erro na exclusão:", error);
    } else {
      refetchUpdates();
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      // Invalida também a aba de atividades se for criada uma query própria
      queryClient.invalidateQueries({ queryKey: ['activity_logs', taskDetailsOpen.id] });
    }
  };

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_updates(id)')
        .eq('board_id', boardId)
        .order('position');
      if (error) throw error;
      return data || [];
    }
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      setSelectedTasks([]); // Limpa seleção após excluir
    }
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const taskToUpdate = tasks?.find((t: any) => t.id === id);
      if (taskToUpdate && !canDeleteTask(taskToUpdate)) {
        alert("Você não tem permissão para alterar esta tarefa.");
        throw new Error("Unauthorized");
      }
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', boardId] })
  });

  const toggleSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  useEffect(() => {
    if (tasks && !taskDetailsOpen) {
      const urlParams = new URLSearchParams(window.location.search);
      const taskIdUrl = urlParams.get('taskId');
      if (taskIdUrl) {
        const t = tasks.find((task: any) => task.id === taskIdUrl);
        if (t) {
          setTaskDetailsOpen(t);
          // Remove o parâmetro da URL de forma silenciosa pra não ficar abrindo toda hora
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [tasks]);

  const handleBulkDelete = async () => {
    const deletableTasks = selectedTasks.filter(id => {
      const task = tasks?.find((t: any) => t.id === id);
      return task && canDeleteTask(task);
    });

    if (deletableTasks.length === 0) {
      alert("Você não tem permissão para excluir as tarefas selecionadas.");
      return;
    }

    if (confirm(`Tem certeza que deseja excluir ${deletableTasks.length} tarefa(s)${deletableTasks.length < selectedTasks.length ? ' (ignorando as sem permissão)' : ''}?`)) {
      for (const id of deletableTasks) {
        await supabase.from('tasks').delete().eq('id', id);
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      setSelectedTasks([]);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredTasks = tasks?.filter((task: any) => {
    if (task.is_private && !isLeaderOrAdmin && task.assignee_email !== userProfile?.email) return false;
    if (task.is_routine) return false; // Filtra as rotinas
    if (task.task_type === 'Lembrete') return false; // Lembretes ficam APENAS no Calendário
    if (filterStatus && task.status !== filterStatus) return false;
    if (filterPriority && task.priority !== filterPriority) return false;
    if (filterDate) {
      const dueStatus = getDueStatus(task.due_date, task.status);
      if (filterDate === 'Atrasado' && (dueStatus !== 'overdue' || task.status === 'Feito')) return false;
      if (filterDate === 'Hoje' && dueStatus !== 'today') return false;
      if (filterDate === 'Futuro' && dueStatus !== 'pending') return false;
    }
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const groupedTasks = filteredTasks?.reduce((acc: any, task: any) => {
    const groupName = task.group_name || 'Tarefas pendentes';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(task);
    return acc;
  }, {}) || {};

  const predefinedGroups = ['Tarefas pendentes', 'Concluído'];
  const allGroups = Array.from(new Set([...predefinedGroups, ...Object.keys(groupedTasks)]));
  const groupsToRender = allGroups;

  const getGroupColor = (groupName: string) => {
    if (groupName === 'Concluído') return { text: 'text-[#00c875]', bg: '#00c875' };
    if (groupName === 'Tarefas pendentes') return { text: 'text-[#579bfc]', bg: '#579bfc' };
    
    // Cores dinâmicas para grupos criados
    const colors = [
      { text: 'text-[#fdab3d]', bg: '#fdab3d' },
      { text: 'text-[#e2445c]', bg: '#e2445c' },
      { text: 'text-[#a25ddc]', bg: '#a25ddc' },
      { text: 'text-[#0086c0]', bg: '#0086c0' }
    ];
    return colors[groupName.length % colors.length];
  };

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => 
      prev.includes(groupName) ? prev.filter(name => name !== groupName) : [...prev, groupName]
    );
  };

  const handleCreateItem = async () => {
    if (!canEditBoard) return;
    const defaultGroup = 'Tarefas pendentes';
    const position = (groupedTasks[defaultGroup]?.length || 0) + 1;
    const { error } = await supabase.from('tasks').insert([
      { 
        title: 'Nova Tarefa', 
        board_id: boardId, 
        group_name: defaultGroup, 
        position: position 
      }
    ]);
    if (error) {
      alert('Erro ao criar tarefa: ' + error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      // Remove do colapso caso esteja fechado
      setCollapsedGroups(prev => prev.filter(name => name !== defaultGroup));
    }
  };

  const renderGroup = (title: string, groupTasks: any[]) => {
    const colors = getGroupColor(title);
    const isCollapsed = collapsedGroups.includes(title);
    
    return (
      <div key={title} className="mb-8 mt-2">
        <div 
          className="flex items-center gap-2 mb-1 px-8 cursor-pointer group w-max"
          onClick={() => toggleGroupCollapse(title)}
        >
          <button className={`hover:opacity-80 transition-transform ${isCollapsed ? '-rotate-90' : ''} ${colors.text}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          <h2 className={`text-[22px] font-medium ${colors.text}`}>{title}</h2>
          <span className="text-slate-400 text-sm ml-2">{groupTasks?.length || 0} Tarefas</span>
        </div>

        {!isCollapsed && (
        <div className="px-8 mb-2">
          <style dangerouslySetInnerHTML={{ __html: `
            .date-hack::-webkit-calendar-picker-indicator {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              width: 100%;
              height: 100%;
              opacity: 0;
              cursor: pointer;
            }
          `}} />
          <div className="bg-white relative">
            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b border-slate-200 text-[#676879] text-[14px]">
                  <th className="w-2 p-0"></th>
                  <th className="w-10 text-center p-0 border-r border-slate-200"></th>
                  <th className="font-normal px-4 py-2 border-r border-slate-200" style={{ width: '40%', minWidth: '350px' }}></th>
                  <th className="w-14 border-r border-slate-200"></th>
                  <th className="font-normal px-4 py-2 border-r border-slate-200 w-32 text-center">Responsável</th>
                  <th className="font-normal px-0 py-0 border-r border-slate-200 w-40 text-center">Status</th>
                  <th className="font-normal px-4 py-2 border-r border-slate-200 w-48 text-center">Timeline</th>
                  <th className="font-normal px-4 py-2 border-r border-slate-200 w-32 text-center">Prazo</th>
                  <th className="font-normal px-0 py-0 border-r border-slate-200 w-40 text-center">Prioridade</th>
                  <th className="font-normal px-4 py-2 border-r border-slate-200 w-32 text-center">Arquivos</th>
                  <th className="w-10 text-center p-0"></th>
                </tr>
              </thead>
              <tbody className="text-[15px]">
                {groupTasks && groupTasks.length > 0 ? (
                  groupTasks.map((task) => (
                    <tr key={task.id} className={`group/row border-b border-slate-200 transition-colors h-[42px] ${selectedTasks.includes(task.id) ? 'bg-blue-50/50' : 'hover:bg-[#f5f6f8]'}`}>
                      <td className="w-2 p-0" style={{ backgroundColor: colors.bg }}></td>
                      <td className="w-10 text-center p-0 border-r border-slate-200 relative bg-transparent">
                        <input 
                          type="checkbox" 
                          checked={selectedTasks.includes(task.id)}
                          onChange={() => toggleSelection(task.id)}
                          className="w-4 h-4 rounded border-slate-300 opacity-0 group-hover/row:opacity-100 transition-opacity absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer checked:opacity-100 accent-blue-600" 
                        />
                      </td>
                      <td className="px-4 py-0 border-r border-slate-200 relative truncate group/title">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            {task.is_external && (
                              <a href={`/boards/${task.external_board_id}`} className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 hover:bg-purple-200 transition-colors" title="Ir para o quadro">
                                Quadro: {task.external_board_name}
                              </a>
                            )}
                            <input 
                              type="text" 
                              defaultValue={task.title} 
                              title={task.title}
                              onBlur={(e) => {
                                if (e.target.value !== task.title) {
                                  updateTask.mutate({ id: task.id, updates: { title: e.target.value } });
                                }
                              }}
                              className="text-[#323338] hover:text-blue-600 bg-transparent outline-none w-full cursor-text truncate flex-1"
                            />
                          </div>
                          <div className="flex items-center gap-1 bg-transparent px-2 opacity-0 group-hover/title:opacity-100 transition-opacity absolute right-0 top-0 h-full">
                            {canDeleteTask(task) && (
                              <button 
                                onClick={() => { if(confirm('Excluir esta tarefa?')) deleteTask.mutate(task.id); }}
                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-[18px] h-[18px] stroke-[1.5]" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="border-r border-slate-200 text-center relative hover:bg-slate-50 transition-colors">
                        <div className="absolute inset-0 flex items-center justify-center cursor-pointer group/chat" onClick={() => setTaskDetailsOpen(task)}>
                          <div className="relative">
                            <MessageCirclePlus className="w-5 h-5 text-slate-300 group-hover/chat:text-blue-500 stroke-[1.5] transition-colors" />
                            {/* Simulação de notificação: Badge azul com count se existir updates_count na DB */}
                            {task.task_updates?.length > 0 && (
                              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                <span className="text-[10px] text-white font-bold leading-none">{task.task_updates.length}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-0 border-r border-slate-200 text-center relative group/assignee">
                        <AssigneeCell task={task} />
                      </td>
                      <td className="p-0 border-r border-slate-200 relative z-10">
                        <StatusCell task={task} />
                      </td>
                      <td className="px-4 py-0 border-r border-slate-200">
                        <TimelineBar 
                          progress={task.status === 'Feito' ? 100 : task.status === 'Trabalhando' ? 60 : 30} 
                          color={task.status === 'Feito' ? 'bg-[#00c875]' : task.status === 'Trabalhando' ? 'bg-[#fdab3d]' : 'bg-[#579bfc]'} 
                        />
                      </td>
                      <td className="p-0 border-r border-slate-200 text-center relative group/date h-full">
                        <div className="flex items-center justify-center gap-2 h-[42px] w-full group-hover/date:bg-slate-100 transition-colors relative cursor-pointer">
                           {getDueStatus(task.due_date, task.status) === 'overdue' && task.status !== 'Feito' && (
                             <AlertCircle className="w-4 h-4 text-red-500 fill-red-50 stroke-red-500" />
                           )}
                           {getDueStatus(task.due_date, task.status) === 'done' && (
                             <CheckCircle2 className="w-4 h-4 text-green-500" />
                           )}
                           <span className={`text-[13px] ${getDueStatus(task.due_date, task.status) === 'overdue' && task.status !== 'Feito' ? 'text-red-500 font-medium' : 'text-[#323338]'} ${task.status === 'Feito' ? 'line-through text-slate-400' : ''}`}>
                             {formatDate(task.due_date) || '-'}
                           </span>
                           <input 
                             type="date" 
                             defaultValue={task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''}
                             onChange={(e) => updateTask.mutate({ id: task.id, updates: { due_date: e.target.value } })}
                             className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 date-hack"
                           />
                        </div>
                      </td>
                      <td className="p-0 border-r border-slate-200 text-center">
                        <PriorityCell task={task} />
                      </td>
                      <td className="px-4 py-0 border-r border-slate-200 text-center hover:bg-slate-50 cursor-pointer group/file relative h-full">
                        <label className="flex items-center justify-center h-[42px] w-full cursor-pointer">
                          <div className="flex items-center gap-1 text-slate-400 group-hover/file:bg-slate-200 px-2 py-1 rounded transition-colors relative">
                            <span className="text-lg leading-none opacity-0 group-hover/file:opacity-100 absolute -left-2">+</span>
                            <FileText className="w-[18px] h-[18px] group-hover/file:text-slate-600" />
                          </div>
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setTaskDetailsOpen(task);
                              setDrawerTab('updates');
                              setPendingFile(file);
                            }}
                          />
                        </label>
                      </td>
                      <td className="w-10 text-center p-0"></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-slate-400 text-sm">
                      Nenhuma tarefa aqui ainda.
                    </td>
                  </tr>
                )}
                
                {/* Linha de Adicionar Item */}
                {canEditBoard && (
                <tr className="hover:bg-[#f5f6f8] transition-colors h-[42px]">
                  <td className="w-2 p-0 bg-transparent border-l-[3px] border-transparent group-hover:border-l-slate-300"></td>
                  <td className="w-10 border-r border-slate-200 bg-transparent"></td>
                  <td colSpan={9} className="px-4 py-0">
                    <input 
                      type="text" 
                      placeholder="+ Adicionar Item" 
                      className="w-full bg-transparent text-[#323338] placeholder-slate-400 outline-none text-[14px]"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim() !== '') {
                          const taskTitle = e.currentTarget.value.trim();
                          e.currentTarget.value = '';
                          const { error } = await supabase.from('tasks').insert([
                            { 
                              title: taskTitle, 
                              board_id: boardId, 
                              group_name: title, 
                              position: (groupTasks?.length || 0) + 1 
                            }
                          ]);
                          if (error) {
                            alert('Erro ao criar: ' + error.message);
                          } else {
                            queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
                          }
                        }
                      }}
                    />
                  </td>
                </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full relative flex flex-col">
      {/* Toolbar */}
      <div className="px-8 py-4 flex items-center gap-4 border-b border-slate-200 bg-white shrink-0">
        {canEditBoard && (
        <button 
          onClick={handleCreateItem}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-[14px] font-medium transition-colors shadow-sm"
        >
          Novo Item
        </button>
        )}
        
        <div className="w-px h-6 bg-slate-200 mx-1"></div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Pesquisar..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 rounded-full border border-slate-200 bg-white text-[14px] focus:outline-none focus:border-blue-400 transition-colors w-64 shadow-sm"
          />
        </div>

        <div className="relative">
          <button 
            onClick={() => { setStatusFilterOpen(!statusFilterOpen); setPriorityFilterOpen(false); setDateFilterOpen(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[14px] transition-colors shadow-sm ${filterStatus ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Status {filterStatus && `: ${filterStatus}`}
          </button>
          {statusFilterOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-50">
              <div className="text-xs font-bold text-slate-400 mb-2 px-2">Filtrar por Status</div>
              {[{name: 'Feito', color: 'bg-[#00c875]'}, {name: 'Trabalhando', color: 'bg-[#fdab3d]'}, {name: 'Travado', color: 'bg-[#e2445c]'}, {name: 'Pendente', color: 'bg-[#c4c4c4]'}].map(status => (
                <button 
                  key={status.name}
                  onClick={() => { setFilterStatus(filterStatus === status.name ? null : status.name); setStatusFilterOpen(false); }}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-sm ${status.color}`}></span>
                    {status.name}
                  </div>
                  {filterStatus === status.name && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button 
            onClick={() => { setPriorityFilterOpen(!priorityFilterOpen); setStatusFilterOpen(false); setDateFilterOpen(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[14px] transition-colors shadow-sm ${filterPriority ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Prioridade {filterPriority && `: ${filterPriority}`}
          </button>
          {priorityFilterOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-50">
              <div className="text-xs font-bold text-slate-400 mb-2 px-2">Filtrar por Prioridade</div>
              {[{name: 'Alta', color: 'bg-[#401694]'}, {name: 'Média', color: 'bg-[#5559df]'}, {name: 'Baixa', color: 'bg-[#579bfc]'}, {name: 'Vazio', color: 'bg-[#c4c4c4]'}].map(priority => (
                <button 
                  key={priority.name}
                  onClick={() => { setFilterPriority(filterPriority === priority.name ? null : priority.name); setPriorityFilterOpen(false); }}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-sm ${priority.color}`}></span>
                    {priority.name}
                  </div>
                  {filterPriority === priority.name && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button 
            onClick={() => { setDateFilterOpen(!dateFilterOpen); setStatusFilterOpen(false); setPriorityFilterOpen(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[14px] transition-colors shadow-sm ${filterDate ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Prazo {filterDate && `: ${filterDate}`}
          </button>
          {dateFilterOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-50">
              <div className="text-xs font-bold text-slate-400 mb-2 px-2">Filtrar por Prazo</div>
              {[{name: 'Atrasado', color: 'bg-red-500'}, {name: 'Hoje', color: 'bg-blue-500'}, {name: 'Futuro', color: 'bg-slate-300'}].map(dateOpt => (
                <button 
                  key={dateOpt.name}
                  onClick={() => { setFilterDate(filterDate === dateOpt.name ? null : dateOpt.name); setDateFilterOpen(false); }}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${dateOpt.color}`}></span>
                    {dateOpt.name}
                  </div>
                  {filterDate === dateOpt.name && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto pb-24 pt-6">
        <div className="min-w-[1300px] w-full">
          {groupsToRender.map(groupName => renderGroup(groupName, groupedTasks[groupName] || []))}
          
          <div className="px-8 mt-6">
            <button 
              onClick={async () => {
                const name = prompt('Nome do novo grupo:');
                if (name) {
                  const { error } = await supabase.from('tasks').insert([
                    { title: 'Nova Tarefa', board_id: boardId, group_name: name, position: 1 }
                  ]);
                  if (!error) queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-md transition-all font-medium text-sm bg-white shadow-sm"
            >
              <PlusCircle className="w-4 h-4" /> Adicionar novo grupo
            </button>
          </div>
        </div>
      </div>

      {/* Floating Action Bar (Múltiplas Seleções) */}
      {selectedTasks.length > 0 && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 px-6 py-3 flex items-center gap-6 z-50 animate-in slide-in-from-bottom-10 fade-in">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              {selectedTasks.length}
            </div>
            <span className="font-medium text-slate-700 text-sm">Tarefas Selecionadas</span>
          </div>
          
          <div className="w-px h-6 bg-slate-200"></div>

          <div className="flex items-center gap-1">
            <button className="flex flex-col items-center justify-center w-16 text-slate-500 hover:text-slate-800 transition-colors">
              <Copy className="w-4 h-4 mb-1" />
              <span className="text-[11px] font-medium">Duplicar</span>
            </button>
            <button className="flex flex-col items-center justify-center w-16 text-slate-500 hover:text-slate-800 transition-colors">
              <Download className="w-4 h-4 mb-1" />
              <span className="text-[11px] font-medium">Exportar</span>
            </button>
            <button className="flex flex-col items-center justify-center w-16 text-slate-500 hover:text-slate-800 transition-colors">
              <Archive className="w-4 h-4 mb-1" />
              <span className="text-[11px] font-medium">Arquivar</span>
            </button>
            <button 
              onClick={handleBulkDelete}
              className="flex flex-col items-center justify-center w-16 text-slate-500 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4 mb-1" />
              <span className="text-[11px] font-medium">Excluir</span>
            </button>
          </div>

          <button onClick={() => setSelectedTasks([])} className="ml-4 p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Task Drawer (Gaveta Lateral de Atualizações) */}
      {taskDetailsOpen && (() => {
        const activeTask = tasks?.find((t: any) => t.id === taskDetailsOpen.id) || taskDetailsOpen;
        return (
        <>
          {/* Overlay Escuro */}
          <div 
            className="fixed inset-0 bg-slate-900/20 z-40" 
            onClick={() => setTaskDetailsOpen(null)}
          ></div>

          {/* Gaveta */}
          <div className="fixed top-0 right-0 h-screen w-[600px] bg-white shadow-2xl z-50 border-l border-slate-200 flex flex-col animate-in slide-in-from-right-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {activeTask.is_private && <span title="Privada"><EyeOff className="w-5 h-5 text-red-500" /></span>}
                {activeTask.title}
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                {isLeaderOrAdmin && (
                  <button 
                    onClick={() => {
                      updateTask.mutate({ id: activeTask.id, updates: { is_private: !activeTask.is_private } })
                    }}
                    className={`p-2 rounded-md transition-colors ${activeTask.is_private ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'hover:bg-slate-100 text-slate-400'}`}
                    title={activeTask.is_private ? "Privada (Apenas Admins/Líderes)" : "Pública"}
                  >
                    {activeTask.is_private ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                )}
                {canDeleteTask(activeTask) && (
                  <button 
                    onClick={() => {
                      if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                        deleteTask.mutate(activeTask.id);
                        setTaskDetailsOpen(null);
                      }
                    }}
                    className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button className="p-2 hover:bg-slate-100 rounded-md text-slate-400 transition-colors"><MessageSquare className="w-5 h-5" /></button>
                <button className="p-2 hover:bg-slate-100 rounded-md text-slate-400 transition-colors"><MoreHorizontal className="w-5 h-5" /></button>
                <button onClick={() => setTaskDetailsOpen(null)} className="p-2 hover:bg-slate-100 rounded-md text-slate-500 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Edição Rápida de Campos */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex gap-6">
              <div className="flex flex-col gap-2 w-32 relative z-20">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                <div className="w-full h-8"><StatusCell task={activeTask} /></div>
              </div>
              <div className="flex flex-col gap-2 w-32 relative z-10">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Prioridade</span>
                <div className="w-full h-8"><PriorityCell task={activeTask} /></div>
              </div>
              <div className="flex flex-col gap-2 w-32 relative z-10">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Prazo</span>
                <div className="w-full h-8 flex items-center justify-center border border-slate-200 rounded-full bg-white text-xs font-medium relative date-hack overflow-hidden cursor-pointer hover:border-blue-400 transition-colors">
                  <span className={activeTask.due_date ? 'text-slate-700' : 'text-slate-400'}>
                    {formatDate(activeTask.due_date) || '-'}
                  </span>
                  <input 
                    type="date" 
                    defaultValue={activeTask.due_date || ''}
                    onChange={async (e) => {
                      const { error } = await supabase.from('tasks').update({ due_date: e.target.value }).eq('id', activeTask.id);
                      if (!error) {
                        queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 w-16 items-center relative z-20">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pessoa</span>
                <div className="w-8 h-8"><AssigneeCell task={activeTask} /></div>
              </div>
            </div>

            <div className="flex gap-6 px-6 border-b border-slate-100 text-sm font-medium text-slate-500 pt-4">
              <button 
                onClick={() => setDrawerTab('updates')}
                className={`pb-3 border-b-2 flex items-center gap-2 ${drawerTab === 'updates' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'}`}
              >
                <MessageSquare className="w-4 h-4" /> Atualizações
              </button>
              <button 
                onClick={() => setDrawerTab('files')}
                className={`pb-3 border-b-2 flex items-center gap-2 ${drawerTab === 'files' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'}`}
              >
                <Paperclip className="w-4 h-4" /> Arquivos
              </button>
              <button 
                onClick={() => setDrawerTab('activity')}
                className={`pb-3 border-b-2 flex items-center gap-2 ${drawerTab === 'activity' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'}`}
              >
                <Activity className="w-4 h-4" /> Log de atividade
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {drawerTab === 'updates' && (
                <>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-8">
                    <div className="flex items-center gap-4 text-slate-400 border-b border-slate-100 pb-3 mb-3 text-sm">
                  <button className="hover:text-slate-700 font-bold">B</button>
                  <button className="hover:text-slate-700 italic">I</button>
                  <button className="hover:text-slate-700 underline">U</button>
                  <div className="w-px h-4 bg-slate-200"></div>
                  <label className="hover:text-slate-700 cursor-pointer">
                    <Paperclip className="w-4 h-4" />
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setPendingFile(file);
                      }}
                    />
                  </label>
                </div>
                {pendingFile && (
                  <div className="flex items-center gap-2 mb-3 bg-blue-50 text-blue-700 px-3 py-2 rounded border border-blue-100 text-sm">
                    <Paperclip className="w-4 h-4" />
                    <span className="flex-1 truncate">{pendingFile.name}</span>
                    <button onClick={() => setPendingFile(null)} className="hover:text-blue-900"><X className="w-4 h-4" /></button>
                  </div>
                )}
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
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-slate-200">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${u.email.split('@')[0]}`} className="w-full h-full object-cover" />
                                  )}
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
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                          const file = items[i].getAsFile();
                          if (file) {
                            const newFile = new File([file], `colado_${Date.now()}.png`, { type: file.type });
                            setPendingFile(newFile);
                            e.preventDefault();
                            break;
                          }
                        }
                      }
                    }}
                    placeholder="Escreva uma atualização..." 
                    className="w-full min-h-[100px] resize-none outline-none text-slate-700 text-sm"
                    disabled={isUploading}
                  ></textarea>
                  {/* Spinner Overlay Removed - Using Toast Below */}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex gap-2">
                    <button onClick={() => setNewUpdateText(prev => prev + '@')} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"><span className="text-xs font-bold">@</span></button>
                    <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded text-xs transition-colors">GIF</button>
                  </div>
                  <button 
                    onClick={postUpdate}
                    disabled={isUploading}
                    className={`${isUploading ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2`}
                  >
                    {isUploading ? 'Aguarde...' : 'Atualizar'}
                  </button>
                </div>
              </div>

              {taskUpdates && taskUpdates.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {taskUpdates.map((update: any) => (
                    <div key={update.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative group/update">
                      <div className="absolute top-3 right-3 opacity-0 group-hover/update:opacity-100 transition-opacity flex gap-2">
                         <button 
                            onClick={() => deleteUpdate(update.id, update.content)} 
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors" 
                            title="Excluir"
                         >
                            <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        {(() => {
                          const authorEmail = update.author_email;
                          const profile = workspaceUsers?.find((p: any) => p.email === authorEmail);
                          const avatarSrc = profile?.avatar_url || (authorEmail ? `https://api.dicebear.com/7.x/notionists/svg?seed=${authorEmail}` : null);
                          
                          if (avatarSrc) {
                            return <img src={avatarSrc} className="w-8 h-8 rounded-full border border-slate-200 object-cover" />;
                          }
                          return (
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                              U
                            </div>
                          );
                        })()}
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{update.author_email ? update.author_email.split('@')[0] : 'Usuário'}</h4>
                          <span className="text-xs text-slate-400">{new Date(update.created_at).toLocaleString()}</span>
                        </div>
                      </div>
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
                  <div className="w-32 h-32 mb-4 opacity-50 relative">
                     <div className="absolute inset-0 bg-blue-100 rounded-2xl flex items-center justify-center">
                       <MessageSquare className="w-12 h-12 text-blue-300" />
                     </div>
                  </div>
                  <h3 className="text-slate-800 font-bold text-lg mb-1">Nenhuma atualização ainda</h3>
                  <p className="text-sm max-w-xs">Compartilhe o progresso, mencione um colega ou carregue um arquivo para dar andamento às coisas.</p>
                </div>
              )}
              </>
              )}

              {/* Upload Toast */}
              {isUploading && pendingFile && (
                <div className="absolute bottom-4 right-6 w-80 bg-white shadow-2xl rounded-lg border border-slate-200 z-[100] animate-in slide-in-from-bottom-5">
                  <div className="flex items-center justify-between p-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white"><CheckCircle2 className="w-3 h-3" /></div>
                      <span className="text-sm font-medium">1 arquivo sendo adicionado</span>
                    </div>
                    <button className="text-slate-400 hover:bg-slate-100 p-1 rounded transition-colors" onClick={() => setIsUploading(false)}><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-4 flex gap-3">
                    <div className="w-12 h-12 bg-blue-600 text-white flex items-center justify-center rounded shrink-0">
                      <Paperclip className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="text-sm font-bold text-slate-800 truncate">{pendingFile.name}</span>
                      <span className="text-xs text-slate-500 truncate">Workspace Principal &gt; {taskDetailsOpen.title}</span>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-slate-400">{(pendingFile.size / 1024 / 1024).toFixed(2)}MB</span>
                        <span className="text-xs text-slate-500 font-medium">Enviando...</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-b-lg overflow-hidden relative">
                     <div className="absolute inset-y-0 left-0 bg-green-500 animate-[pulse_1s_ease-in-out_infinite] w-full"></div>
                  </div>
                </div>
              )}

              {drawerTab === 'files' && (
                <div className="flex flex-col gap-6">
                  <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                    <Paperclip className="w-8 h-8 text-blue-400 mb-2" />
                    <span className="text-sm font-medium text-blue-700">Clique para anexar arquivo</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setPendingFile(file);
                        setDrawerTab('updates');
                      }}
                    />
                  </label>

                  {taskUpdates && taskUpdates.some((u: any) => u.content.includes('](')) ? (
                    <div className="grid grid-cols-2 gap-4">
                      {taskUpdates.filter((u: any) => u.content.includes('](')).map((update: any) => {
                        const urlMatch = update.content.match(/\]\(([^)]+)\)/);
                        const nameMatch = update.content.match(/\[([^\]]+)\]/);
                        const url = urlMatch ? urlMatch[1] : '#';
                        const name = nameMatch ? nameMatch[1] : 'Arquivo';
                        const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) != null;
                        const isVideo = url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) != null;

                        return (
                          <a key={'file-'+update.id} href={url} target="_blank" className="border border-slate-200 rounded-lg overflow-hidden hover:border-blue-400 transition-colors flex flex-col group bg-white shadow-sm">
                            <div className="h-24 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                              {isImage ? (
                                <img src={url} alt={name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                              ) : isVideo ? (
                                <video src={url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" muted preload="metadata" />
                              ) : (
                                <FileText className="w-8 h-8 text-slate-300" />
                              )}
                            </div>
                            <div className="p-2 text-xs font-medium text-slate-700 truncate" title={name}>
                              {name}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 py-8">Nenhum arquivo anexado ainda.</div>
                  )}
                </div>
              )}

              {drawerTab === 'activity' && (
                <div className="flex flex-col gap-0 relative">
                  <div className="absolute left-4 top-4 bottom-4 w-px bg-slate-200"></div>
                  
                  {(() => {
                    const combinedActivity = [
                      ...(taskUpdates || []).map((u: any) => ({ id: 'u-'+u.id, email: u.author_email, action: u.content.includes('![') ? 'anexou uma imagem' : 'adicionou um comentário', date: u.created_at, color: 'bg-blue-500' })),
                      ...(activityLogs || []).map((l: any) => ({ id: 'l-'+l.id, email: l.user_email, action: l.action, date: l.created_at, color: 'bg-red-500' }))
                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    if (combinedActivity.length === 0) {
                      return <div className="text-center mt-8 text-slate-400 text-sm">Nenhuma atividade recente.</div>;
                    }

                    return combinedActivity.map((item: any) => (
                      <div key={item.id} className="relative pl-12 py-4">
                        <div className={`absolute left-3 top-5 w-2.5 h-2.5 rounded-full ${item.color} border-2 border-white shadow-sm`}></div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-slate-800">{item.email ? item.email.split('@')[0] : 'Usuário'}</span>
                          <span className="text-sm text-slate-500">{item.action}</span>
                        </div>
                        <span className="text-xs text-slate-400">{new Date(item.date).toLocaleString()}</span>
                      </div>
                    ));
                  })()}
                  
                  <div className="relative pl-12 py-4">
                    <div className="absolute left-3 top-5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white shadow-sm"></div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-slate-800">Sistema</span>
                      <span className="text-sm text-slate-500">criou a tarefa</span>
                    </div>
                    <span className="text-xs text-slate-400">Há algum tempo</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
        );
      })()}

    </div>
  );
}
