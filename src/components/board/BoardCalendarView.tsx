'use client';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { ChevronLeft, ChevronRight, Search, User, Filter, Calendar as CalendarIcon, MessageCirclePlus, AlignLeft, Flag, FileText, DollarSign, Clock, Users, Circle, CheckCircle2, ChevronDown, Type, MessageSquare, MoreHorizontal, X, Paperclip, Activity, Trash2, Bell, Eye, EyeOff, AlertCircle, Headset, ShieldCheck } from 'lucide-react';

import { DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { StatusCell } from './StatusCell';
import { PriorityCell } from './PriorityCell';
import { AssigneeCell } from './AssigneeCell';
import { Reactions } from './Reactions';
import { UpdateContent } from './UpdateContent';
import { SlaManagementModal } from './SlaManagementModal';

const STATUS_COLORS: any = {
  'Feito': 'bg-[#00c875]',
  'Trabalhando': 'bg-[#fdab3d]',
  'Travado': 'bg-[#e2445c]',
  'Pendente': 'bg-[#c4c4c4]',
  'Não iniciado': 'bg-[#c4c4c4]'
};

const PRIORITIES = ['Alta', 'Média', 'Baixa', 'Vazio'];
const STATUSES = ['Feito', 'Trabalhando', 'Travado', 'Pendente', 'Não iniciado'];

function extractSafeDueTime(str?: string | null): string | null {
  if (!str) return null;
  const trimmed = str.trim();
  const match = trimmed.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  if (match) {
    const [h, m] = match[0].split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  return trimmed.slice(0, 5) || null;
}

function TaskChip({ task, onClick, isOverlay = false, currentUserEmail }: any) {
  if (task.isGoogleCalendar) {
    return (
      <div 
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        className="flex items-center gap-1.5 text-[11px] px-2 py-1 cursor-pointer truncate rounded-md font-medium shadow-sm transition-all bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100"
        title={`Google Agenda: ${task.title}${task.due_time ? ` - ${task.due_time}` : ''}`}
      >
        <span className="text-xs shrink-0">📅</span>
        {task.due_time && (
          <span className="font-bold text-blue-700 shrink-0 bg-blue-100 px-1 rounded-sm">{task.due_time}</span>
        )}
        <span className="truncate font-semibold">{task.title}</span>
      </div>
    );
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task }
  });

  const isSla = task.priority === 'SLA' || task.task_type === 'SLA' || task.title?.toUpperCase().includes('SLA');
  const isMySla = isSla && currentUserEmail && task.assignee_email === currentUserEmail;
  const isLembrete = task.task_type === 'Lembrete';
  const bgColor = isLembrete ? 'bg-amber-400 text-amber-950' : (STATUS_COLORS[task.status] || STATUS_COLORS['Pendente']);
  
  if (isDragging && !isOverlay) {
    return (
      <div 
        ref={setNodeRef}
        className="opacity-0 text-[11px] px-2 py-1"
      >
        {task.title}
      </div>
    );
  }

  // Visual Especial para Lembretes / Escalas de SLA - ATENDIMENTO (Ícone de Call Center / Headset)
  if (isSla) {
    const assigneeShort = task.assignee_email 
      ? task.assignee_email.split('@')[0].split('.')[0].toUpperCase()
      : null;

    return (
      <div 
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 cursor-grab active:cursor-grabbing truncate rounded-lg font-semibold shadow-2xs transition-all ${
          isMySla 
            ? 'bg-indigo-100/90 text-indigo-950 border border-indigo-400 ring-2 ring-indigo-400/40' 
            : 'bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-900 border border-indigo-200 hover:border-indigo-300'
        } ${isOverlay ? 'shadow-xl scale-105 rotate-1 opacity-90 cursor-grabbing !transition-none' : ''}`}
        title={`Plantão SLA - Atendimento: ${task.title}${task.assignee_email ? ` (${task.assignee_email})` : ''}${task.due_time ? ` - ${task.due_time}` : ''}`}
      >
        <Headset className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        {task.due_time && (
          <span className="font-bold text-indigo-700 shrink-0 bg-indigo-200/60 px-1 rounded text-[10px]">{task.due_time}</span>
        )}
        <span className="truncate">{task.title}</span>
        {assigneeShort && (
          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-200/80 text-indigo-800 shrink-0 uppercase tracking-tight">
            {assigneeShort}
          </span>
        )}
      </div>
    );
  }

  if (isLembrete) {
    const iconEmoji = (task.priority && !PRIORITIES.includes(task.priority)) ? task.priority : '🔔';
    return (
      <div 
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        className={`flex items-center gap-1.5 text-[11px] px-2 py-1 cursor-grab active:cursor-grabbing truncate rounded-md font-medium shadow-sm transition-all bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 ${isOverlay ? 'shadow-xl scale-105 rotate-1 opacity-90 cursor-grabbing !transition-none' : ''}`}
        title={`${task.title}${task.due_time ? ` - ${task.due_time}` : ''}`}
      >
        <span className="text-sm leading-none shrink-0">{iconEmoji}</span>
        {task.due_time && (
          <span className="font-bold text-amber-700 shrink-0 bg-amber-100 px-1 rounded-sm">{task.due_time}</span>
        )}
        <span className="truncate">{task.title}</span>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
         e.stopPropagation();
         onClick?.();
      }}
      className={`flex items-center gap-1.5 text-[11px] px-2 py-1 cursor-grab active:cursor-grabbing truncate text-white rounded-sm font-medium hover:brightness-95 shadow-sm ${!isDragging && !isOverlay ? 'transition-all' : ''} ${bgColor} ${isOverlay ? 'shadow-xl scale-105 rotate-1 opacity-90 cursor-grabbing !transition-none' : ''}`}
      title={task.title}
    >
      <span className="truncate">{task.title}</span>
    </div>
  );
}

function DayCell({ dayObj, tasks, isToday, onTaskClick, onAddClick, currentUserEmail }: any) {
  const dateString = dayObj.date.toISOString().split('T')[0];
  const { setNodeRef, isOver } = useDroppable({
    id: dateString,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`border-r border-b border-slate-100 last:border-r-0 flex flex-col p-1 group relative transition-colors ${isOver ? 'bg-slate-300/50 border-slate-300' : (dayObj.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50')}`}
    >
      <div className="flex justify-end mb-1">
        <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${isToday ? 'bg-blue-600 text-white shadow-sm' : (dayObj.isCurrentMonth ? 'text-slate-700 group-hover:bg-slate-100' : 'text-slate-400')}`}>
          {dayObj.day}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-wrap gap-1 content-start relative z-10 pb-6 px-1">
        {tasks.map((task: any) => {
          const isSla = task.priority === 'SLA' || task.task_type === 'SLA' || task.title?.toUpperCase().includes('SLA');
          return (
            <div key={task.id} className={task.task_type === 'Lembrete' && !isSla ? 'w-auto' : 'w-full'}>
              <TaskChip task={task} onClick={() => onTaskClick(task)} currentUserEmail={currentUserEmail} />
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 z-20">
         <button 
          onClick={onAddClick} 
          className="w-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 py-1 rounded transition-colors"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

export function BoardCalendarView({ boardId, isReadOnly }: { boardId: string; isReadOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [taskDetailsOpen, setTaskDetailsOpen] = useState<any | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingTaskDate, setCreatingTaskDate] = useState<Date | null>(null);
  const [newTaskData, setNewTaskData] = useState<any>({
    title: '',
    group_name: 'Tarefas pendentes',
    assignee_email: '',
    status: 'Não iniciado',
    priority: '',
    notes: '',
    budget: '',
    task_type: 'Tarefa',
    selected_dates: [],
    due_time: ''
  });
  
  const [viewType, setViewType] = useState<'Mês' | 'Semana'>('Mês');
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterPersonEmail, setFilterPersonEmail] = useState<string | null>(null);
  const [filterPersonDropdownOpen, setFilterPersonDropdownOpen] = useState(false);

  // Estados da Integração Google Agenda
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState<string>('');
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleSyncLoading, setGoogleSyncLoading] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [googleSyncError, setGoogleSyncError] = useState('');

  const syncGoogleCalendar = async (urlToSync: string) => {
    if (!urlToSync) {
      setGoogleEvents([]);
      return;
    }
    setGoogleSyncLoading(true);
    setGoogleSyncError('');
    try {
      const res = await fetch('/api/sync-google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToSync })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setGoogleSyncError(data.error || 'Erro ao sincronizar Google Agenda.');
      } else {
        setGoogleEvents(data.events || []);
      }
    } catch (err: any) {
      setGoogleSyncError(err?.message || 'Erro de conexão com o servidor.');
    } finally {
      setGoogleSyncLoading(false);
    }
  };

  // Busca a URL do Google Agenda salva no Banco de Dados (Supabase) do Quadro
  const { data: dbBoardGoogleUrl } = useQuery({
    queryKey: ['board_google_calendar_url', boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boards')
        .select('google_calendar_url')
        .eq('id', boardId)
        .maybeSingle();

      if (error) return null;
      return data?.google_calendar_url || null;
    },
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    const savedLocalUrl = localStorage.getItem(`gcal_url_${boardId}`) || localStorage.getItem('gcal_url_global') || '';
    const effectiveUrl = dbBoardGoogleUrl || savedLocalUrl;

    if (effectiveUrl) {
      setGoogleCalendarUrl(effectiveUrl);
      if (dbBoardGoogleUrl && !savedLocalUrl) {
        localStorage.setItem(`gcal_url_${boardId}`, dbBoardGoogleUrl);
      }
      const timer = setTimeout(() => {
        syncGoogleCalendar(effectiveUrl);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [boardId, dbBoardGoogleUrl]);

  const handleSaveGoogleUrl = async (url: string) => {
    const clean = url.trim();
    setGoogleCalendarUrl(clean);
    if (clean) {
      localStorage.setItem(`gcal_url_${boardId}`, clean);
      try {
        await supabase.from('boards').update({ google_calendar_url: clean }).eq('id', boardId);
      } catch (err) {
        console.warn("Não foi possível persistir no banco:", err);
      }
      syncGoogleCalendar(clean);
    } else {
      localStorage.removeItem(`gcal_url_${boardId}`);
      try {
        await supabase.from('boards').update({ google_calendar_url: null }).eq('id', boardId);
      } catch (err) {
        console.warn("Não foi possível remover do banco:", err);
      }
      setGoogleEvents([]);
    }
  };

  // Busca de Tarefas
  const { data: rawTasks } = useQuery({
    queryKey: ['tasks', boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_updates(id)')
        .eq('board_id', boardId)
        .or('is_routine.eq.false,is_routine.is.null')
        .order('position');
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false
  });

  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  const defaultCreatorEmail = userProfile?.email === 'ruan.dalsom@crexpresstransportessp.com.br'
    ? 'ruan.dalsom@masterdeliveryexpress.com.br'
    : (userProfile?.email || '');

  useEffect(() => {
    if (creatingTaskDate) {
      const d = new Date(creatingTaskDate.getTime());
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      const dateStr = d.toISOString().split('T')[0];
      setNewTaskData((prev: any) => ({
        ...prev,
        assignee_email: prev.assignee_email || defaultCreatorEmail,
        selected_dates: prev.selected_dates?.length ? prev.selected_dates : [dateStr]
      }));
    }
  }, [creatingTaskDate, defaultCreatorEmail]);

  const { data: boardInfo } = useQuery({
    queryKey: ['board_info', boardId],
    queryFn: async () => {
      const { data } = await supabase.from('boards').select('name, workspace_id').eq('id', boardId).single();
      return data;
    },
    staleTime: 10 * 60 * 1000
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, email, avatar_url, role, receive_emails').order('email');
      return data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  const { data: workspaceUsers } = useQuery({
    queryKey: ['workspace_users', boardId, boardInfo?.workspace_id],
    queryFn: async () => {
      const profiles = allProfiles || [];
      const targetWorkspaceId = boardInfo?.workspace_id || (typeof window !== 'undefined' ? localStorage.getItem('monday_active_workspace') : null);
      if (!targetWorkspaceId) {
        return profiles.filter((p: any) => p.email !== 'ruan.dalsom@crexpresstransportessp.com.br');
      }

      const { data: members } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', targetWorkspaceId);
      const memberUserIds = new Set(members?.map(m => m.user_id) || []);

      return profiles.filter((p: any) =>
        memberUserIds.has(p.id) &&
        p.email !== 'ruan.dalsom@crexpresstransportessp.com.br'
      );
    },
    enabled: !!allProfiles,
    staleTime: 5 * 60 * 1000
  });

  const { data: workspaceInfo } = useQuery({
    queryKey: ['workspace_info_for_board', boardInfo?.workspace_id],
    queryFn: async () => {
      if (!boardInfo?.workspace_id) return null;
      const { data } = await supabase.from('workspaces').select('id, name').eq('id', boardInfo.workspace_id).single();
      return data;
    },
    enabled: !!boardInfo?.workspace_id,
    staleTime: 10 * 60 * 1000
  });

  const { data: myProfileDirect } = useQuery({
    queryKey: ['my_profile_direct_role', userProfile?.id],
    queryFn: async () => {
      if (!userProfile?.id) return null;
      const { data } = await supabase.from('profiles').select('id, email, role').eq('id', userProfile.id).single();
      return data;
    },
    enabled: !!userProfile?.id,
    staleTime: 5 * 60 * 1000
  });

  const currentUserProfile = (allProfiles || [])?.find((u: any) => u.email === userProfile?.email) || myProfileDirect;
  const currentRole = (currentUserProfile?.role || '').toLowerCase();
  const isLeaderOrAdmin = ['admin', 'administrador', 'leader', 'lider', 'líder'].includes(currentRole);

  // Identifica se o quadro atual pertence ao Setor de Análise
  const isAnaliseSector = useMemo(() => {
    const bName = (boardInfo?.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const wName = (workspaceInfo?.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hasSlaTasks = rawTasks?.some((t: any) => t.priority === 'SLA' || t.title?.toUpperCase().includes('SLA'));
    return bName.includes('analis') || wName.includes('analis') || Boolean(hasSlaTasks);
  }, [boardInfo?.name, workspaceInfo?.name, rawTasks]);

  // Estados da Escala / Lembrete de SLA - ATENDIMENTO (Setor de Análise)
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);
  const [isSlaManagementOpen, setIsSlaManagementOpen] = useState(false);
  const [slaCollaboratorEmail, setSlaCollaboratorEmail] = useState('');

  const slaPlantaoCount = useMemo(() => {
    return rawTasks?.filter(
      (t: any) =>
        t.priority === 'SLA' ||
        t.title?.toUpperCase().includes('SLA') ||
        t.group_name === 'SLA Atendimento'
    )?.length || 0;
  }, [rawTasks]);
  const [slaTitle, setSlaTitle] = useState('SLA - ATENDIMENTO');
  const [slaSelectedDates, setSlaSelectedDates] = useState<string[]>([]);
  const [slaRangeStart, setSlaRangeStart] = useState('');
  const [slaRangeEnd, setSlaRangeEnd] = useState('');
  const [slaSelectionMode, setSlaSelectionMode] = useState<'individual' | 'range'>('individual');
  const [slaTime, setSlaTime] = useState('08:00 - 17:00');
  const [slaNotes, setSlaNotes] = useState('');
  const [slaNotifyCollaborator, setSlaNotifyCollaborator] = useState(true);
  const [isSubmittingSla, setIsSubmittingSla] = useState(false);
  const [slaFeedbackMsg, setSlaFeedbackMsg] = useState<string | null>(null);

  // Função para salvar a escala de SLA no banco (tasks + notifications)
  const handleSaveSlaAssignment = async () => {
    if (!isLeaderOrAdmin) {
      alert("Apenas o Líder de Setor e Administradores podem escalar colaboradores para o SLA.");
      return;
    }
    if (!slaCollaboratorEmail) {
      alert("Selecione o colaborador para a escala de SLA.");
      return;
    }

    const effectiveDates: string[] = [];
    if (slaSelectionMode === 'range') {
      if (!slaRangeStart || !slaRangeEnd) {
        alert("Preencha as datas inicial e final do período.");
        return;
      }
      const cur = new Date(`${slaRangeStart}T00:00:00`);
      const end = new Date(`${slaRangeEnd}T00:00:00`);
      if (cur > end) {
        alert("A data inicial deve ser anterior ou igual à data final.");
        return;
      }
      while (cur <= end) {
        effectiveDates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      effectiveDates.push(...slaSelectedDates);
    }

    if (effectiveDates.length === 0) {
      alert("Selecione ao menos um dia para a escala de SLA.");
      return;
    }

    setIsSubmittingSla(true);
    try {
      const authorEmail = userProfile?.email || 'lider@crtransportes.com.br';
      const collaboratorName = slaCollaboratorEmail.split('@')[0].split('.').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
      const safeTime = extractSafeDueTime(slaTime);

      const inserts = effectiveDates.map((d: string, index: number) => ({
        board_id: boardId,
        title: slaTitle.trim() || 'SLA - ATENDIMENTO',
        group_name: 'SLA Atendimento',
        status: 'Pendente',
        due_date: d,
        due_time: safeTime,
        start_date: d,
        task_type: 'Lembrete',
        priority: 'SLA',
        assignee_email: slaCollaboratorEmail,
        position: (rawTasks?.length || 0) + 1 + index
      }));

      const { data: createdTasks, error: taskError } = await supabase
        .from('tasks')
        .insert(inserts)
        .select();

      if (taskError) throw taskError;

      if (createdTasks && (slaNotes.trim() || slaTime.trim())) {
        const noteParts: string[] = [];
        if (slaTime.trim()) noteParts.push(`⏰ Horário do Plantão: ${slaTime.trim()}`);
        if (slaNotes.trim()) noteParts.push(`📋 Instruções do SLA: ${slaNotes.trim()}`);
        const updateInserts = createdTasks.map((t: any) => ({
          task_id: t.id,
          content: noteParts.join('\n\n'),
          author_email: authorEmail
        }));
        await supabase.from('task_updates').insert(updateInserts);
      }

      if (slaNotifyCollaborator) {
        const datesSummary = effectiveDates.length === 1 
          ? new Date(effectiveDates[0] + 'T12:00:00').toLocaleDateString('pt-BR')
          : `${effectiveDates.length} dias (${new Date(effectiveDates[0] + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(effectiveDates[effectiveDates.length - 1] + 'T12:00:00').toLocaleDateString('pt-BR')})`;

        await supabase.from('notifications').insert([{
          user_email: slaCollaboratorEmail,
          task_id: createdTasks[0]?.id || null,
          message: `${authorEmail}||🎧 Você foi escalado para o SLA - ATENDIMENTO (${slaTitle}) em ${datesSummary}! Horário: ${slaTime || 'Integral'}.`,
          read: false
        }]);
      }

      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      setIsSlaModalOpen(false);
      setSlaSelectedDates([]);
      setSlaRangeStart('');
      setSlaRangeEnd('');
      setSlaNotes('');
      setSlaFeedbackMsg(`Escala de SLA criada com sucesso para ${collaboratorName} (${effectiveDates.length} dias)!`);
      setTimeout(() => setSlaFeedbackMsg(null), 4500);
    } catch (err: any) {
      alert("Erro ao salvar escala de SLA: " + err.message);
    } finally {
      setIsSubmittingSla(false);
    }
  };

  const canEditBoard = !isReadOnly;

  const canDeleteTask = (task: any) => {
    return !isReadOnly;
  };

  const [drawerTab, setDrawerTab] = useState<'updates'|'files'|'activity'>('updates');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Lê taskId da URL se houver para abrir a gaveta (igual ao Kanban/Tabela)
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

  const createTask = useMutation({
    mutationFn: async (dataToSave: any) => {
      if (!canEditBoard) {
        alert("Você não tem permissão para criar tarefas neste quadro.");
        throw new Error("Unauthorized");
      }
      let dateStr = dataToSave.due_date;
      if (!dateStr && creatingTaskDate) {
        const d = new Date(creatingTaskDate.getTime());
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        dateStr = d.toISOString().split('T')[0];
      }

      if (dataToSave.task_type === 'Lembrete' && dataToSave.selected_dates && dataToSave.selected_dates.length > 0) {
        const inserts = dataToSave.selected_dates.map((d: string, index: number) => ({
          board_id: boardId,
          title: dataToSave.title || 'Novo Lembrete',
          group_name: dataToSave.group_name || 'Tarefas pendentes',
          status: 'Pendente',
          due_date: d,
          due_time: extractSafeDueTime(dataToSave.due_time),
          start_date: d,
          task_type: 'Lembrete',
          assignee_email: null,
          priority: dataToSave.priority || '🔴',
          position: (rawTasks?.length || 0) + 1 + index
        }));
        
        const { data: taskData, error: taskError } = await supabase.from('tasks').insert(inserts).select();
        if (taskError) throw taskError;

        if (taskData && dataToSave.notes?.trim()) {
           const updateInserts = taskData.map((t: any) => ({
             task_id: t.id,
             content: dataToSave.notes.trim(),
             author_email: 'Sistema / Nota Inicial'
           }));
           await supabase.from('task_updates').insert(updateInserts);
        }
        return taskData;
      }

      if (dataToSave.task_type === 'SLA') {
        const targetDates = (dataToSave.selected_dates && dataToSave.selected_dates.length > 0)
          ? dataToSave.selected_dates
          : (dateStr ? [dateStr] : []);

        const safeTime = extractSafeDueTime(dataToSave.due_time || '08:00');

        const inserts = targetDates.map((d: string, index: number) => ({
          board_id: boardId,
          title: dataToSave.title || 'SLA - ATENDIMENTO',
          group_name: 'SLA Atendimento',
          status: 'Pendente',
          due_date: d,
          due_time: safeTime,
          start_date: d,
          task_type: 'Lembrete',
          priority: 'SLA',
          assignee_email: dataToSave.assignee_email || defaultCreatorEmail || null,
          position: (rawTasks?.length || 0) + 1 + index
        }));

        const { data: taskData, error: taskError } = await supabase.from('tasks').insert(inserts).select();
        if (taskError) throw taskError;

        if (taskData && (dataToSave.notes?.trim() || dataToSave.due_time?.trim())) {
          const noteParts: string[] = [];
          if (dataToSave.due_time?.trim()) noteParts.push(`⏰ Horário do Plantão: ${dataToSave.due_time.trim()}`);
          if (dataToSave.notes?.trim()) noteParts.push(`📋 Instruções do SLA: ${dataToSave.notes.trim()}`);
          const updateInserts = taskData.map((t: any) => ({
            task_id: t.id,
            content: noteParts.join('\n\n'),
            author_email: userProfile?.email || 'Sistema'
          }));
          await supabase.from('task_updates').insert(updateInserts);
        }

        if (dataToSave.assignee_email) {
          const authorEmail = userProfile?.email || 'lider@crtransportes.com.br';
          await supabase.from('notifications').insert([{
            user_email: dataToSave.assignee_email,
            task_id: taskData[0]?.id || null,
            message: `${authorEmail}||🎧 Você foi escalado para o SLA - ATENDIMENTO (${dataToSave.title || 'SLA'}) em ${targetDates.join(', ')}! Horário: ${dataToSave.due_time || '08:00 - 17:00'}.`,
            read: false
          }]);
        }
        return taskData;
      }

      // 1. Cria a tarefa normal
      const { data: taskData, error: taskError } = await supabase.from('tasks').insert([
        { 
          board_id: boardId,
          title: dataToSave.title || 'Nova Tarefa',
          group_name: dataToSave.group_name || 'Este mês',
          status: dataToSave.status || 'Pendente',
          due_date: dateStr,
          priority: dataToSave.priority || null,
          assignee_email: dataToSave.assignee_email || defaultCreatorEmail || null,
          position: (rawTasks?.length || 0) + 1,
          task_type: dataToSave.task_type || 'Tarefa'
        }
      ]).select();
      
      if (taskError) throw taskError;
      
      const newTask = taskData?.[0];

      // 2. Se houver notas, insere como comentário em task_updates
      if (newTask && dataToSave.notes?.trim()) {
        const { error: updateError } = await supabase.from('task_updates').insert([
          {
            task_id: newTask.id,
            content: dataToSave.notes.trim(),
            // Se houver um usuário logado disponível, poderia ser o email dele. Aqui usaremos 'Usuário' como default se não tivermos
            author_email: 'Sistema / Nota Inicial'
          }
        ]);
        if (updateError) {
          console.error("Erro ao inserir nota inicial como atualização:", updateError);
        }
      }

      return taskData;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      if (variables.closeOnSuccess) {
        setNewTaskData({
          title: '',
          group_name: 'Tarefas pendentes',
          assignee_email: '',
          status: 'Não iniciado',
          priority: '',
          notes: '',
          budget: '',
          task_type: 'Tarefa',
          selected_dates: []
        });
        setCreatingTaskDate(null);
      }
    }
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      setTaskDetailsOpen(null);
    }
  });

  const filteredGoogleEvents = googleEvents.filter((evt: any) => {
    if (searchQuery && !evt.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredTasks = [
    ...(rawTasks?.filter((task: any) => {
      if (task.is_private && !isLeaderOrAdmin && task.assignee_email !== userProfile?.email) return false;
      if (task.is_routine) return false;
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterStatus && task.status !== filterStatus) return false;
      if (filterPersonEmail && task.assignee_email !== filterPersonEmail) return false;

      // Escala / Lembrete de SLA - ATENDIMENTO:
      // Não exibe no calendário geral! Exibe APENAS para o colaborador específico designado (ou quando filtrado por ele)
      const isSlaTask = task.priority === 'SLA' || task.task_type === 'SLA' || task.title?.toUpperCase().includes('SLA');
      if (isSlaTask) {
        if (filterPersonEmail) {
          return task.assignee_email === filterPersonEmail;
        }
        return Boolean(userProfile?.email && task.assignee_email === userProfile.email);
      }

      return true;
    }) || []),
    ...filteredGoogleEvents
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startingDay = (firstDay.getDay() + 6) % 7; // Domingo(0) vira 6, Segunda(1) vira 0
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];
  
  for (let i = 0; i < startingDay; i++) {
    calendarDays.unshift({ 
      day: daysInPrevMonth - i, 
      isCurrentMonth: false, 
      date: new Date(year, month - 1, daysInPrevMonth - i) 
    });
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ 
      day: i, 
      isCurrentMonth: true, 
      date: new Date(year, month, i) 
    });
  }

  const remainingDays = 42 - calendarDays.length;
  for (let i = 1; i <= remainingDays; i++) {
    calendarDays.push({ 
      day: i, 
      isCurrentMonth: false, 
      date: new Date(year, month + 1, i) 
    });
  }

  const nextTime = () => {
    if (viewType === 'Semana') {
      setCurrentDate(new Date(year, month, currentDate.getDate() + 7));
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };
  
  const prevTime = () => {
    if (viewType === 'Semana') {
      setCurrentDate(new Date(year, month, currentDate.getDate() - 7));
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };
  const goToToday = () => setCurrentDate(new Date());

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  let daysToRender = calendarDays;
  if (viewType === 'Semana') {
     const index = calendarDays.findIndex(d => d.date.getDate() === currentDate.getDate() && d.date.getMonth() === currentDate.getMonth());
     if (index !== -1) {
       const weekStart = Math.floor(index / 7) * 7;
       daysToRender = calendarDays.slice(weekStart, Math.min(weekStart + 7, calendarDays.length));
     } else {
       daysToRender = calendarDays.slice(0, 7);
     }
  }

  // Lógica da Gaveta Simplificada (somente exibição, como o usuário não pediu para recriar toda a tabela)
  // Mas como a gente combinou que a gaveta ia ser a mesma, vamos renderizar pelo menos os comentários
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
    enabled: !!taskDetailsOpen?.id,
    refetchInterval: 30000
  });

  const [newUpdateText, setNewUpdateText] = useState('');
  
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
          alert("Erro no upload do anexo");
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
    }
    
    setIsUploading(false);
  };

  const deleteUpdate = async (updateId: string, content: string) => {
    if (!confirm('Tem certeza que deseja excluir esta atualização?')) return;
    
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
    
    const isAttachment = urlMatch !== null;
    await supabase.from('activity_logs').insert([{
      task_id: taskDetailsOpen.id,
      user_email: userProfile?.email || 'Usuário',
      action: isAttachment ? 'excluiu um anexo' : 'excluiu um comentário'
    }]);

    if (!error) {
      refetchUpdates();
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', taskDetailsOpen.id] });
    }
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() && 
           d.getMonth() === today.getMonth() && 
           d.getFullYear() === today.getFullYear();
  };

  const updateTaskDate = useMutation({
    mutationFn: async ({ id, date }: { id: string, date: string }) => {
      const taskToUpdate = rawTasks?.find((t: any) => t.id === id);
      if (taskToUpdate && !canDeleteTask(taskToUpdate)) {
        alert("Você não tem permissão para alterar o prazo desta tarefa.");
        throw new Error("Unauthorized");
      }
      const { error } = await supabase.from('tasks').update({ due_date: date }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', boardId] })
  });

  const [activeDragTask, setActiveDragTask] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEditBoard) {
      alert("Você não tem permissão para alterar datas neste quadro.");
      return;
    }
    const { active } = event;
    const task = rawTasks?.find((t: any) => t.id === active.id);
    if (task) {
      setActiveDragTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragTask(null);
    const { active, over } = event;
    if (over) {
      const taskId = active.id as string;
      const newDate = over.id as string;
      const task = rawTasks?.find((t: any) => t.id === taskId);
      if (task && !task.due_date?.startsWith(newDate)) {
        updateTaskDate.mutate({ id: taskId, date: newDate });
      }
    }
  };

  const handleDragCancel = () => {
    setActiveDragTask(null);
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Toolbar do Calendário */}
      <div className="flex items-center gap-4 p-6 border-b border-slate-200">
        {canEditBoard && (
        <div className="flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors overflow-hidden h-9 shadow-xs shrink-0">
           <button 
             onClick={() => setCreatingTaskDate(new Date())} 
             className="px-4 font-semibold text-xs whitespace-nowrap h-full flex items-center cursor-pointer"
           >
             Criar tarefa
           </button>
           <button 
             onClick={() => setCreatingTaskDate(new Date())} 
             className="px-2.5 border-l border-blue-700/60 h-full flex items-center justify-center hover:bg-blue-800 transition-colors cursor-pointer"
             title="Opções de criação"
           >
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M6 9l6 6 6-6"/></svg>
           </button>
        </div>
        )}
        
        <div className="h-8 flex items-center border border-slate-200 rounded px-3 w-48 focus-within:border-blue-500 transition-colors group bg-white">
          <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500" />
          <input 
            type="text" 
            placeholder="Pesquisar..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-full outline-none px-2 text-sm text-slate-700" 
          />
        </div>
        <div className="relative">
          <button 
            onClick={() => setFilterPersonDropdownOpen(!filterPersonDropdownOpen)} 
            className={`h-8 px-3 rounded flex items-center gap-2 text-sm transition-colors cursor-pointer ${
              filterPersonEmail 
                ? 'bg-indigo-100 text-indigo-700 font-medium' 
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="max-w-[120px] truncate">
              {filterPersonEmail 
                ? filterPersonEmail.split('@')[0].split('.').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ')
                : 'Pessoa'}
            </span>
          </button>
          {filterPersonDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[60] max-h-60 overflow-y-auto">
              <button 
                onClick={() => { setFilterPersonEmail(null); setFilterPersonDropdownOpen(false); }} 
                className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 font-medium cursor-pointer"
              >
                Todos (Geral)
              </button>
              {userProfile?.email && (
                <button 
                  onClick={() => { setFilterPersonEmail(userProfile?.email || null); setFilterPersonDropdownOpen(false); }} 
                  className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm text-indigo-700 font-semibold flex items-center justify-between border-b border-slate-100 cursor-pointer"
                >
                  <span>Minhas Tarefas / SLA</span>
                  <span className="text-[10px] bg-indigo-100 px-1.5 py-0.5 rounded text-indigo-800">Eu</span>
                </button>
              )}
              {((workspaceUsers && workspaceUsers.length > 0 ? workspaceUsers : allProfiles) || []).map((u: any) => {
                const name = u.email.split('@')[0].split('.').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
                return (
                  <button 
                    key={u.email} 
                    onClick={() => { setFilterPersonEmail(u.email); setFilterPersonDropdownOpen(false); }} 
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs text-slate-700 font-medium truncate cursor-pointer flex items-center gap-2"
                  >
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {name.charAt(0)}
                    </div>
                    <span className="truncate">{name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setFilterDropdownOpen(!filterDropdownOpen)} className={`h-8 px-3 rounded flex items-center gap-2 text-sm transition-colors ${filterStatus ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-slate-100 text-slate-600'}`}>
            <Filter className="w-4 h-4" /> {filterStatus || 'Filtro'}
          </button>
          {filterDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[60]">
              <button onClick={() => { setFilterStatus(null); setFilterDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 font-medium">Todos</button>
              {Object.keys(STATUS_COLORS).map(status => (
                <button key={status} onClick={() => { setFilterStatus(status); setFilterDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 font-medium flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status]}`}></div>
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>

        <button 
          onClick={() => setGoogleModalOpen(true)} 
          className={`h-8 px-3 rounded-full flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer border shadow-sm ${
            googleCalendarUrl ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
          title="Sincronizar eventos com a Google Agenda"
        >
          <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
          <span>Google Agenda</span>
          {googleEvents.length > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {googleEvents.length}
            </span>
          )}
        </button>

        {isAnaliseSector && isLeaderOrAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            {/* Botão de Acesso ao Painel Administrativo de Escalas SLA */}
            <button 
              type="button"
              onClick={() => setIsSlaManagementOpen(true)} 
              className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer border border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 shadow-xs"
              title="Painel Administrativo: Verificar colaboradores escalados, alterar e retirar plantões SLA"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Painel Escala SLA</span>
              {slaPlantaoCount > 0 && (
                <span className="bg-purple-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {slaPlantaoCount}
                </span>
              )}
            </button>

            {/* Botão de Criação Rápida de Plantão SLA */}
            <button 
              type="button"
              onClick={() => setIsSlaModalOpen(true)} 
              className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-indigo-700 shadow-xs"
              title="Escalar colaborador para SLA - Atendimento"
            >
              <Headset className="w-3.5 h-3.5 text-indigo-600" />
              <span>+ Escalar SLA</span>
            </button>
          </div>
        )}

        <div className="flex-1"></div>

        <button onClick={goToToday} className="h-8 px-3 border border-slate-200 hover:bg-slate-50 rounded text-slate-700 text-sm font-medium transition-colors">
          Hoje
        </button>
        <div className="flex items-center gap-1">
          <button onClick={prevTime} className="h-8 w-8 hover:bg-slate-100 rounded flex items-center justify-center text-slate-600 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={nextTime} className="h-8 w-8 hover:bg-slate-100 rounded flex items-center justify-center text-slate-600 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative">
          <div 
            onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
            className="h-8 flex items-center gap-2 px-3 border border-slate-200 hover:bg-slate-50 rounded cursor-pointer transition-colors"
          >
            <span className="text-slate-800 text-[14px] font-medium">{viewType}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-500"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          {viewDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
              <button onClick={() => { setViewType('Mês'); setViewDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-slate-700 font-medium">Mês</button>
              <button onClick={() => { setViewType('Semana'); setViewDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-slate-700 font-medium">Semana</button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-800 text-[15px] font-medium">{monthNames[month]} {year}</span>
        </div>
      </div>

      {/* Grade do Calendário */}
      <DndContext 
        sensors={sensors}
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd} 
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          {/* Cabeçalho dos Dias */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-white z-10 shrink-0">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="py-2 text-center text-[13px] font-medium text-slate-700 border-r border-slate-100 last:border-0">
                {day}
              </div>
            ))}
          </div>
          
          {/* Dias do Mês/Semana */}
          <div className={`flex-1 grid grid-cols-7 ${viewType === 'Mês' ? 'grid-rows-6' : 'grid-rows-1'}`}>
            {daysToRender.map((dayObj, i) => {
              const dateString = dayObj.date.toISOString().split('T')[0];
              const tasksOnThisDay = filteredTasks?.filter((t: any) => {
                if (t.task_type === 'Lembrete' && t.start_date && t.due_date) {
                  return dateString >= t.start_date && dateString <= t.due_date;
                }
                return t.due_date && t.due_date.startsWith(dateString);
              }) || [];

              return (
                <DayCell 
                  key={i}
                  dayObj={dayObj}
                  tasks={tasksOnThisDay}
                  isToday={isToday(dayObj.date)}
                  onTaskClick={setTaskDetailsOpen}
                  currentUserEmail={userProfile?.email}
                  onAddClick={() => {
                    if (canEditBoard) setCreatingTaskDate(dayObj.date);
                    else alert('Você não tem permissão para criar tarefas/lembretes neste quadro.');
                  }}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragTask ? <TaskChip task={activeDragTask} isOverlay={true} currentUserEmail={userProfile?.email} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Gaveta de Tarefa (Reaproveitada para o Calendário) */}
      {taskDetailsOpen && (() => {
        const activeTask = rawTasks?.find((t: any) => t.id === taskDetailsOpen.id) || taskDetailsOpen;
        return (
        <>
          <div className="fixed inset-0 bg-slate-900/20 z-40" onClick={() => setTaskDetailsOpen(null)}></div>
          <div className="fixed top-0 right-0 h-screen w-[600px] bg-white shadow-2xl z-50 border-l border-slate-200 flex flex-col animate-in slide-in-from-right-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2 group/title w-full mr-4 relative">
                {activeTask.is_private && <span title="Privada"><EyeOff className="w-5 h-5 text-red-500 shrink-0" /></span>}
                <input 
                  type="text" 
                  defaultValue={activeTask.title} 
                  onBlur={async (e) => {
                    if (e.target.value !== activeTask.title) {
                      if (!canDeleteTask(activeTask)) {
                        alert("Você não tem permissão para alterar esta tarefa.");
                        e.target.value = activeTask.title;
                        return;
                      }
                      const { error } = await supabase.from('tasks').update({ title: e.target.value }).eq('id', activeTask.id);
                      if (!error) queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
                    }
                  }}
                  className="text-2xl font-bold text-slate-800 bg-transparent outline-none w-full hover:bg-slate-50 px-2 py-1 rounded transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isLeaderOrAdmin && (
                  <button 
                    onClick={async () => {
                      const { error } = await supabase.from('tasks').update({ is_private: !activeTask.is_private }).eq('id', activeTask.id);
                      if (!error) queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
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
                      if (confirm('Tem certeza que deseja excluir?')) {
                        deleteTask.mutate(activeTask.id);
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
              {activeTask.task_type !== 'Lembrete' && (
                <>
                  <div className="flex flex-col gap-2 w-32 relative z-20">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                    <div className="w-full h-8"><StatusCell task={activeTask} /></div>
                  </div>
                  <div className="flex flex-col gap-2 w-32 relative z-10">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Prioridade</span>
                    <div className="w-full h-8"><PriorityCell task={activeTask} /></div>
                  </div>
                </>
              )}
              {activeTask.task_type === 'Lembrete' ? (
                <>
                  <div className="flex flex-col gap-2 w-32 relative z-10">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Data do Lembrete</span>
                    <div className="w-full h-8 flex items-center justify-center border border-slate-200 rounded-full bg-white text-xs font-medium relative date-hack overflow-hidden cursor-pointer hover:border-blue-400 transition-colors">
                      <span className={activeTask.due_date ? 'text-slate-700' : 'text-slate-400'}>
                        {activeTask.due_date ? new Date(activeTask.due_date).toLocaleDateString('pt-BR') : '-'}
                      </span>
                      <input 
                        type="date" 
                        defaultValue={activeTask.due_date || ''}
                        onChange={async (e) => {
                          if (!canDeleteTask(activeTask)) {
                            alert("Você não tem permissão para alterar esta tarefa.");
                            return;
                          }
                          const { error } = await supabase.from('tasks').update({ due_date: e.target.value, start_date: e.target.value }).eq('id', activeTask.id);
                          if (!error) queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 w-32 relative z-10">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Horário</span>
                    <div className="w-full h-8 flex items-center justify-center border border-slate-200 rounded-full bg-white text-xs font-medium relative date-hack overflow-hidden cursor-pointer hover:border-blue-400 transition-colors">
                      <span className={activeTask.due_time ? 'text-slate-700' : 'text-slate-400'}>
                        {activeTask.due_time || '--:--'}
                      </span>
                      <input 
                        type="time" 
                        defaultValue={activeTask.due_time || ''}
                        onChange={async (e) => {
                          if (!canDeleteTask(activeTask)) {
                            alert("Você não tem permissão para alterar esta tarefa.");
                            return;
                          }
                          const { error } = await supabase.from('tasks').update({ due_time: e.target.value }).eq('id', activeTask.id);
                          if (!error) queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 w-32 relative z-10">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Prazo</span>
                  <div className="w-full h-8 flex items-center justify-center border border-slate-200 rounded-full bg-white text-xs font-medium relative date-hack overflow-hidden cursor-pointer hover:border-blue-400 transition-colors">
                    <span className={activeTask.due_date ? 'text-slate-700' : 'text-slate-400'}>
                      {activeTask.due_date ? new Date(activeTask.due_date).toLocaleDateString('pt-BR') : '-'}
                    </span>
                    <input 
                      type="date" 
                      defaultValue={activeTask.due_date || ''}
                      onChange={async (e) => {
                        if (!canDeleteTask(activeTask)) {
                          alert("Você não tem permissão para alterar esta tarefa.");
                          return;
                        }
                        const { error } = await supabase.from('tasks').update({ due_date: e.target.value }).eq('id', activeTask.id);
                        if (!error) {
                          queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}
              {activeTask.task_type !== 'Lembrete' && (
                <div className="flex flex-col gap-2 w-16 items-center relative z-20">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pessoa</span>
                  <div className="w-8 h-8"><AssigneeCell task={activeTask} /></div>
                </div>
              )}
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
            </div>
          </div>
        </>
        );
      })()}
      {/* Modal de Criar Tarefa no Dia */}
      {creatingTaskDate && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 z-[60]" onClick={() => setCreatingTaskDate(null)}></div>
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-[70] w-full max-w-2xl overflow-visible animate-in fade-in zoom-in-95 border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-6 pb-4 border-b border-slate-100 relative">
              <h3 className="text-3xl font-bold text-slate-800">Criar Tarefa</h3>
              <button onClick={() => setCreatingTaskDate(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors absolute top-6 right-6 bg-white p-1.5 rounded-full border border-slate-200 shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-5 bg-slate-50/50">
              
              <div className="flex items-center">
                <div className="w-40 flex items-center gap-3 text-slate-600">
                  <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center"><Bell className="w-4 h-4 text-white" /></div>
                  <span className="font-medium text-[15px]">Tipo de Registro</span>
                </div>
                <div className="flex-1 flex gap-3 flex-wrap">
                  <label className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors text-sm ${newTaskData.task_type === 'Tarefa' ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <input type="radio" name="task_type" value="Tarefa" checked={newTaskData.task_type === 'Tarefa'} onChange={(e) => setNewTaskData({...newTaskData, task_type: e.target.value})} className="hidden" />
                    Tarefa
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors text-sm ${newTaskData.task_type === 'Lembrete' ? 'bg-amber-50 border-amber-200 text-amber-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <input type="radio" name="task_type" value="Lembrete" checked={newTaskData.task_type === 'Lembrete'} onChange={(e) => setNewTaskData({...newTaskData, task_type: e.target.value})} className="hidden" />
                    <Bell className="w-4 h-4" /> Lembrete
                  </label>
                  {isAnaliseSector && isLeaderOrAdmin && (
                    <label className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors text-sm ${newTaskData.task_type === 'SLA' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input 
                        type="radio" 
                        name="task_type" 
                        value="SLA" 
                        checked={newTaskData.task_type === 'SLA'} 
                        onChange={(e) => {
                          const initialDate = creatingTaskDate ? [creatingTaskDate.toISOString().split('T')[0]] : [];
                          setNewTaskData({
                            ...newTaskData, 
                            task_type: 'SLA',
                            title: 'SLA - ATENDIMENTO',
                            priority: 'SLA',
                            due_time: '08:00 - 17:00',
                            selected_dates: newTaskData.selected_dates?.length ? newTaskData.selected_dates : initialDate
                          });
                        }} 
                        className="hidden" 
                      />
                      <Headset className="w-4 h-4 text-indigo-600" /> SLA - Atendimento
                    </label>
                  )}
                </div>
              </div>

              <div className="flex items-center">
                <div className="w-40 flex items-center gap-3 text-slate-600">
                  <div className="w-6 h-6 rounded bg-slate-400 flex items-center justify-center"><Type className="w-3 h-3 text-white" /></div>
                  <span className="font-medium text-[15px]">{newTaskData.task_type === 'Lembrete' ? 'Nome do Lembrete' : (newTaskData.task_type === 'SLA' ? 'Título do SLA' : 'Nome da Tarefa')}</span>
                </div>
                <div className="flex-1">
                  <input 
                    type="text" 
                    autoFocus
                    value={newTaskData.title}
                    onChange={(e) => setNewTaskData({...newTaskData, title: e.target.value})}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-md px-4 py-2.5 w-full outline-none text-[15px] text-slate-800 font-medium focus:ring-1 focus:ring-blue-500 shadow-sm"
                    placeholder={newTaskData.task_type === 'Lembrete' ? 'Nome do Lembrete...' : (newTaskData.task_type === 'SLA' ? 'Ex: SLA - ATENDIMENTO' : 'Nome da Tarefa...')}
                  />
                </div>
              </div>

              {newTaskData.task_type === 'SLA' && (
                <div className="flex items-center">
                  <div className="w-40 flex items-center gap-3 text-slate-600">
                    <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><Headset className="w-4 h-4 text-white" /></div>
                    <span className="font-medium text-[15px]">Colaborador *</span>
                  </div>
                  <div className="flex-1">
                    <select 
                      value={newTaskData.assignee_email || ''}
                      onChange={(e) => setNewTaskData({...newTaskData, assignee_email: e.target.value})}
                      className="bg-white border border-slate-200 hover:border-slate-300 rounded-md px-4 py-2.5 w-full outline-none text-[15px] font-medium text-slate-800 shadow-sm"
                    >
                      <option value="">- Selecione o Colaborador do SLA -</option>
                      {(workspaceUsers || []).map((u: any) => {
                        const cleanName = u.email.split('@')[0].split('.').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
                        return (
                          <option key={u.email} value={u.email}>{cleanName} ({u.email})</option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}
              
              {newTaskData.task_type !== 'Lembrete' && newTaskData.task_type !== 'SLA' && (
                <>
                  <div className="flex items-center">
                    <div className="w-40 flex items-center gap-3 text-slate-600">
                      <div className="w-6 h-6 rounded bg-yellow-500 flex items-center justify-center"><Circle className="w-3 h-3 text-white fill-white" /></div>
                      <span className="font-medium text-[15px]">Grupo</span>
                    </div>
                    <div className="flex-1">
                      <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-md px-4 py-2.5 flex items-center gap-3 cursor-text transition-colors w-full text-[15px] shadow-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></div>
                        <input 
                          type="text" 
                          value={newTaskData.group_name}
                          onChange={(e) => setNewTaskData({...newTaskData, group_name: e.target.value})}
                          className="bg-transparent outline-none w-full text-slate-800"
                          placeholder="Nome do grupo..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="w-40 flex items-center gap-3 text-slate-600">
                      <div className="w-6 h-6 rounded bg-[#579bfc] flex items-center justify-center"><User className="w-4 h-4 text-white" /></div>
                      <span className="font-medium text-[15px]">Responsável</span>
                    </div>
                    <div className="flex-1">
                      <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-md px-4 py-2.5 flex items-center justify-center cursor-pointer transition-colors w-full relative shadow-sm">
                        <select 
                          value={newTaskData.assignee_email || ''}
                          onChange={(e) => setNewTaskData({...newTaskData, assignee_email: e.target.value})}
                          className="bg-transparent w-full appearance-none outline-none cursor-pointer text-[15px] font-medium text-slate-800 empty:text-slate-400"
                        >
                          <option value="">- Sem responsável -</option>
                          {workspaceUsers?.map((user: any) => (
                            <option key={user.email} value={user.email}>{user.email.split('@')[0]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="w-40 flex items-center gap-3 text-slate-600">
                      <div className="w-6 h-6 rounded bg-[#00c875] flex items-center justify-center"><AlignLeft className="w-4 h-4 text-white" /></div>
                      <span className="font-medium text-[15px]">Status</span>
                    </div>
                    <div className="flex-1 relative">
                      <select 
                        value={newTaskData.status}
                        onChange={(e) => setNewTaskData({...newTaskData, status: e.target.value})}
                        className="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 rounded-md px-4 py-2.5 w-full appearance-none outline-none cursor-pointer text-[15px] text-center font-medium shadow-sm"
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {(newTaskData.task_type === 'Lembrete' || newTaskData.task_type === 'SLA') && (
                <>
                  <div className="flex items-start">
                    <div className="w-40 flex items-center gap-3 text-slate-600 mt-2">
                      <div className="w-6 h-6 rounded bg-[#a25ddc] flex items-center justify-center"><CalendarIcon className="w-4 h-4 text-white" /></div>
                      <span className="font-medium text-[15px]">Datas Escolhidas</span>
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <input 
                          type="date"
                          onChange={(e) => {
                            if (e.target.value && !newTaskData.selected_dates?.includes(e.target.value)) {
                              setNewTaskData({...newTaskData, selected_dates: [...(newTaskData.selected_dates || []), e.target.value]});
                            }
                            e.target.value = '';
                          }}
                          className="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 rounded-md px-4 py-2 w-48 outline-none text-[15px] font-medium focus:ring-1 focus:ring-blue-500 shadow-sm cursor-pointer"
                        />
                        <span className="text-slate-400 text-sm italic">← Adicione mais dias</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {(newTaskData.selected_dates || []).map((dateStr: string) => (
                          <div key={dateStr} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-md text-sm font-medium border border-indigo-200">
                            <span>{new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                            <button 
                              type="button"
                              onClick={() => setNewTaskData({...newTaskData, selected_dates: newTaskData.selected_dates.filter((d: string) => d !== dateStr)})}
                              className="hover:bg-indigo-100 text-indigo-600 rounded-full p-0.5 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center mt-2">
                    <div className="w-40 flex items-center gap-3 text-slate-600">
                      <div className="w-6 h-6 rounded bg-indigo-400 flex items-center justify-center"><Clock className="w-4 h-4 text-white" /></div>
                      <span className="font-medium text-[15px]">Horário</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <input 
                        type={newTaskData.task_type === 'SLA' ? 'text' : 'time'}
                        value={newTaskData.due_time || ''}
                        onChange={(e) => setNewTaskData({...newTaskData, due_time: e.target.value})}
                        placeholder={newTaskData.task_type === 'SLA' ? 'Ex: 08:00 - 17:00' : ''}
                        className="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 rounded-md px-4 py-2 outline-none text-[15px] font-medium focus:ring-1 focus:ring-blue-500 shadow-sm cursor-pointer"
                      />
                      <span className="text-slate-400 text-sm italic">{newTaskData.task_type === 'SLA' ? 'Horário do plantão SLA' : 'Opcional: notificação no horário'}</span>
                    </div>
                  </div>

                  {newTaskData.task_type === 'Lembrete' && (
                    <div className="flex items-center mt-2">
                      <div className="w-40 flex items-center gap-3 text-slate-600">
                        <div className="w-6 h-6 rounded bg-[#ffcc00] flex items-center justify-center"><Bell className="w-4 h-4 text-amber-900" /></div>
                        <span className="font-medium text-[15px]">Ícone</span>
                      </div>
                      <div className="flex-1 flex gap-2">
                        {['🔴', '🔵', '🟢', '🟡', '🟣', '⭐', '🔥', '🎉', '🔔', '✅'].map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setNewTaskData({...newTaskData, priority: emoji})}
                            className={`w-9 h-9 flex items-center justify-center rounded-full text-xl transition-all hover:scale-110 hover:-translate-y-1 ${newTaskData.priority === emoji || (!newTaskData.priority && emoji === '🔴') ? 'bg-amber-100 ring-2 ring-amber-400 scale-110' : 'bg-slate-50 hover:bg-slate-100'}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {newTaskData.task_type !== 'Lembrete' && newTaskData.task_type !== 'SLA' && (
                <div className="flex items-center">
                  <div className="w-40 flex items-center gap-3 text-slate-600">
                    <div className="w-6 h-6 rounded bg-[#a25ddc] flex items-center justify-center"><CalendarIcon className="w-4 h-4 text-white" /></div>
                    <span className="font-medium text-[15px]">Prazo</span>
                  </div>
                  <div className="flex-1">
                    <input 
                      type="date"
                      value={newTaskData.due_date || (creatingTaskDate ? creatingTaskDate.toISOString().split('T')[0] : '')}
                      onChange={(e) => setNewTaskData({...newTaskData, due_date: e.target.value})}
                      className="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 rounded-md px-4 py-2.5 w-full outline-none text-[15px] font-medium focus:ring-1 focus:ring-blue-500 shadow-sm"
                    />
                  </div>
                </div>
              )}

              {newTaskData.task_type !== 'Lembrete' && newTaskData.task_type !== 'SLA' && (
                <div className="flex items-center">
                  <div className="w-40 flex items-center gap-3 text-slate-600">
                    <div className="w-6 h-6 rounded bg-[#00c875] flex items-center justify-center"><AlignLeft className="w-4 h-4 text-white rotate-90" /></div>
                    <span className="font-medium text-[15px]">Prioridade</span>
                  </div>
                  <div className="flex-1">
                    <select 
                      value={newTaskData.priority}
                      onChange={(e) => setNewTaskData({...newTaskData, priority: e.target.value})}
                      className="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 rounded-md px-4 py-2.5 w-full appearance-none outline-none cursor-pointer text-[15px] text-center font-medium empty:text-slate-400 shadow-sm"
                    >
                      <option value="" disabled className="text-slate-400">- Selecione -</option>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center">
                <div className="w-40 flex items-center gap-3 text-slate-600">
                  <div className="w-6 h-6 rounded bg-[#fdab3d] flex items-center justify-center"><FileText className="w-4 h-4 text-white" /></div>
                  <span className="font-medium text-[15px]">Notas</span>
                </div>
                <div className="flex-1">
                  <input 
                    type="text" 
                    value={newTaskData.notes}
                    onChange={(e) => setNewTaskData({...newTaskData, notes: e.target.value})}
                    className="bg-white border border-slate-200 rounded-md px-4 py-2.5 w-full outline-none text-slate-800 text-[15px] focus:border-blue-400 shadow-sm transition-colors"
                  />
                </div>
              </div>

            </div>
            
            <div className="p-5 border-t border-slate-200 flex justify-end gap-3 bg-white rounded-b-xl">
              <button 
                onClick={() => {
                  createTask.mutate({ ...newTaskData, closeOnSuccess: false });
                }}
                className="px-5 py-2.5 rounded border border-slate-200 font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors text-[15px] shadow-sm"
              >
                Salvar e criar outro
              </button>
              <button 
                disabled={createTask.isPending}
                onClick={() => {
                  createTask.mutate({ ...newTaskData, closeOnSuccess: true });
                }} 
                className="px-6 py-2.5 rounded font-medium bg-[#0073ea] hover:bg-blue-600 text-white disabled:opacity-50 transition-colors text-[15px] shadow-sm"
              >
                {createTask.isPending ? 'Criando...' : (newTaskData.task_type === 'SLA' ? 'Criar Plantão SLA' : (newTaskData.task_type === 'Lembrete' ? 'Criar Lembrete' : 'Criar Tarefa'))}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal de Configuração do Google Agenda */}
      {googleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
                  📅
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Sincronizar Google Agenda</h3>
                  <p className="text-xs text-slate-500 font-medium">Exiba seus compromissos no calendário do sistema</p>
                </div>
              </div>
              <button 
                onClick={() => setGoogleModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Passo a passo */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-xs text-blue-900 space-y-2">
                <p className="font-bold text-blue-950 flex items-center gap-1.5">
                  <span>💡</span> Como pegar seu link no Google Agenda (em 3 cliques):
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 font-medium pl-1">
                  <li>Acesse o <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">Google Agenda</a> no seu navegador.</li>
                  <li>Na barra lateral esquerda, clique em <strong className="text-slate-900">⋮ (Opções)</strong> ao lado da sua agenda &gt; <strong className="text-slate-900">Configurações e Compartilhamento</strong>.</li>
                  <li>Role até a seção <strong className="text-slate-900">"Integrar agenda"</strong> e copie o <strong className="text-blue-700 font-semibold">Endereço secreto em formato iCal</strong>.</li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Link iCal da Google Agenda (.ics):
                </label>
                <input 
                  type="url"
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  value={googleCalendarUrl}
                  onChange={(e) => setGoogleCalendarUrl(e.target.value)}
                  className="w-full text-xs px-3.5 py-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-slate-800 bg-white"
                />
              </div>

              {googleSyncError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{googleSyncError}</span>
                </div>
              )}

              {googleEvents.length > 0 && !googleSyncError && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-xl border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{googleEvents.length} compromisso(s) sincronizado(s) com sucesso!</span>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              {googleCalendarUrl && (
                <button
                  type="button"
                  onClick={() => handleSaveGoogleUrl('')}
                  className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                >
                  Desconectar Agenda
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button 
                  type="button"
                  onClick={() => setGoogleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                <button 
                  type="button"
                  disabled={googleSyncLoading}
                  onClick={() => handleSaveGoogleUrl(googleCalendarUrl)}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {googleSyncLoading ? 'Sincronizando...' : 'Salvar e Sincronizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Evento do Google Agenda */}
      {taskDetailsOpen?.isGoogleCalendar && (() => {
        const rawNotes = taskDetailsOpen.notes || '';
        const meetMatch = rawNotes.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
        const meetUrl = meetMatch ? meetMatch[0] : null;

        let cleanHtml = rawNotes
          .replace(/Join with Google Meet:[\s\S]*?(?=Learn more about Meet|$)/gi, '')
          .replace(/Learn more about Meet at:[\s\S]*/gi, '')
          .replace(/<b\s*><\/b>/gi, '')
          .replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')
          .trim();

        cleanHtml = cleanHtml.replace(/<a\s+([^>]*href="[^"]+"[^>]*)>/gi, (match: string, p1: string) => {
          if (p1.includes('target=')) return match;
          return `<a ${p1} target="_blank" rel="noopener noreferrer" class="text-blue-600 font-semibold underline hover:text-blue-800">`;
        });

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-blue-50/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📅</span>
                  <div>
                    <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Compromisso Google Agenda</span>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">{taskDetailsOpen.title}</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setTaskDetailsOpen(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs text-slate-700 overflow-y-auto">
                {meetUrl && (
                  <a 
                    href={meetUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-xl shadow-md transition-all font-bold text-sm cursor-pointer"
                  >
                    <span className="text-xl">📹</span>
                    <div className="flex flex-col">
                      <span>Entrar com o Google Meet</span>
                      <span className="text-[11px] font-normal text-emerald-100">{meetUrl}</span>
                    </div>
                    <span className="ml-auto text-xs bg-white/20 px-2.5 py-1 rounded-lg shrink-0">Acessar</span>
                  </a>
                )}

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">Data e Horário</div>
                    <div className="text-slate-600">
                      {taskDetailsOpen.due_date ? taskDetailsOpen.due_date.split('-').reverse().join('/') : 'Data não informada'}
                      {taskDetailsOpen.due_time && ` às ${taskDetailsOpen.due_time}`}
                      {taskDetailsOpen.end_time && ` - ${taskDetailsOpen.end_time}`}
                    </div>
                  </div>
                </div>

                {taskDetailsOpen.location && (
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-sm shrink-0">📍</span>
                    <div>
                      <div className="font-bold text-slate-900">Localização</div>
                      <div className="text-slate-600">{taskDetailsOpen.location}</div>
                    </div>
                  </div>
                )}

                {cleanHtml && (
                  <div className="space-y-1.5">
                    <div className="font-bold text-slate-900">Descrição / Notas:</div>
                    <div 
                      className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 text-xs leading-relaxed space-y-2 [&_ol]:list-decimal [&_ol]:list-inside [&_ul]:list-disc [&_ul]:list-inside [&_li]:my-1 [&_p]:my-1"
                      dangerouslySetInnerHTML={{ __html: cleanHtml }}
                    />
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <a 
                  href="https://calendar.google.com" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                  Abrir no Google Agenda &rarr;
                </a>
                <button 
                  type="button"
                  onClick={() => setTaskDetailsOpen(null)}
                  className="px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Dedicado de Escala SLA - ATENDIMENTO (Setor de Análise) */}
      {isSlaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[70] p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                  <Headset className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-100 px-2 py-0.5 rounded-full">
                      Setor de Análise
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">Líder / Admin</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">Escalar SLA - ATENDIMENTO</h3>
                </div>
              </div>
              <button 
                onClick={() => setIsSlaModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs text-slate-700">
              {/* Colaborador */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Colaborador Responsável pelo SLA *
                </label>
                <select 
                  value={slaCollaboratorEmail}
                  onChange={(e) => setSlaCollaboratorEmail(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white font-medium text-slate-800 cursor-pointer"
                >
                  <option value="">Selecione o colaborador...</option>
                  {(workspaceUsers || []).map((u: any) => {
                    const cleanName = u.email.split('@')[0].split('.').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
                    return (
                      <option key={u.email} value={u.email}>
                        {cleanName} ({u.email})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Título do Lembrete */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Título do Lembrete
                </label>
                <input 
                  type="text"
                  value={slaTitle}
                  onChange={(e) => setSlaTitle(e.target.value)}
                  placeholder="Ex: SLA - ATENDIMENTO"
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white font-semibold text-slate-800"
                />
              </div>

              {/* Horário */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Horário do Plantão
                </label>
                <input 
                  type="text"
                  value={slaTime}
                  onChange={(e) => setSlaTime(e.target.value)}
                  placeholder="Ex: 08:00 - 17:00 ou 09:00"
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800"
                />
                <p className="text-[11px] text-slate-400 mt-1">Ex: 09:00 - 17:00 (o horário inicial agenda o lembrete e o turno completo fica gravado nas instruções e notificações)</p>
              </div>

              {/* Modo de Seleção de Datas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Dias no SLA *
                </label>
                <div className="flex items-center gap-2 mb-3">
                  <button 
                    type="button"
                    onClick={() => setSlaSelectionMode('individual')}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                      slaSelectionMode === 'individual' 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Dias Individuais
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSlaSelectionMode('range')}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                      slaSelectionMode === 'range' 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Período Contínuo (Intervalo)
                  </button>
                </div>

                {slaSelectionMode === 'individual' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <input 
                        type="date"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && !slaSelectedDates.includes(val)) {
                            setSlaSelectedDates(prev => [...prev, val].sort());
                          }
                          e.target.value = '';
                        }}
                        className="text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 bg-white cursor-pointer font-medium"
                      />
                      <span className="text-[11px] text-slate-500">Selecione datas para adicionar à escala</span>
                    </div>

                    {slaSelectedDates.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
                        {slaSelectedDates.map(dateStr => {
                          const [y, m, d] = dateStr.split('-');
                          const formattedDate = `${d}/${m}/${y}`;
                          return (
                            <span 
                              key={dateStr}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-900 rounded-lg text-xs font-semibold shadow-2xs"
                            >
                              <Headset className="w-3 h-3 text-indigo-600" />
                              <span>{formattedDate}</span>
                              <button 
                                type="button"
                                onClick={() => setSlaSelectedDates(prev => prev.filter(d => d !== dateStr))}
                                className="text-slate-400 hover:text-red-500 transition-colors ml-0.5 cursor-pointer text-sm font-bold"
                                title="Remover data"
                              >
                                &times;
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Nenhum dia selecionado ainda.</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-600 mb-1">Data Início:</span>
                      <input 
                        type="date"
                        value={slaRangeStart}
                        onChange={(e) => setSlaRangeStart(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 bg-white cursor-pointer"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-slate-600 mb-1">Data Fim:</span>
                      <input 
                        type="date"
                        value={slaRangeEnd}
                        onChange={(e) => setSlaRangeEnd(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 bg-white cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Instruções / Notas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Instruções / Diretrizes (Opcional)
                </label>
                <textarea 
                  rows={2}
                  value={slaNotes}
                  onChange={(e) => setSlaNotes(e.target.value)}
                  placeholder="Ex: Acompanhar fila de chamados prioritários, verificar tickets sem resposta..."
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white resize-none text-slate-800"
                />
              </div>

              {/* Checkbox Notificar */}
              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" 
                  id="sla_notify"
                  checked={slaNotifyCollaborator}
                  onChange={(e) => setSlaNotifyCollaborator(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="sla_notify" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  Enviar notificação no sistema CR Task para o colaborador
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button 
                type="button"
                onClick={() => setIsSlaModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                disabled={isSubmittingSla}
                onClick={handleSaveSlaAssignment}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-200 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <Headset className="w-4 h-4" />
                <span>{isSubmittingSla ? 'Salvando Escala...' : 'Salvar Escala no Calendário'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLA Feedback Toast */}
      {slaFeedbackMsg && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 right-6 z-[999999] bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 pointer-events-auto">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">{slaFeedbackMsg}</span>
        </div>,
        document.body
      )}

      {/* Painel Administrativo de Gestão da Escala SLA */}
      <SlaManagementModal
        isOpen={isSlaManagementOpen}
        onClose={() => setIsSlaManagementOpen(false)}
        boardId={boardId}
        workspaceId={boardInfo?.workspace_id || workspaceInfo?.id}
        onOpenCreateSla={() => setIsSlaModalOpen(true)}
      />
    </div>
  );
}
