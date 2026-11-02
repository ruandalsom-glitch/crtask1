'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, Search, Filter, 
  Trash2, Edit, User, MapPin, Clock, CheckCircle2, AlertCircle, 
  HelpCircle, UserCheck, LayoutGrid, List, BarChart2, X, PlusCircle, Check,
  Settings, MessageSquare, Send, Layers, Sparkles, CalendarDays, RefreshCw,
  CalendarRange, CheckSquare, Square, AlertTriangle, Tag, FileSpreadsheet,
  Copy, Sun, Sunset, Moon, Mail, Download
} from 'lucide-react';

const SHIFTS_DEFAULT = [
  { id: 'm', name: 'MANHÃ', time: '08:00 - 12:00', color: 'sky' },
  { id: 't', name: 'TARDE', time: '12:00 - 18:00', color: 'amber' },
  { id: 'n', name: 'NOITE', time: '18:00 - 23:00', color: 'indigo' },
];

const REGIONS_DEFAULT = ['Sumarezinho', 'Recreio', 'Aldeota', 'Matriz'];
const TYPES_DEFAULT = ['Dedicado', 'Apoio', 'Nuvem'];
const STATUSES_DEFAULT = ['Confirmado', 'Pendente', 'Vaga'];

function renderShiftIcon(name: string) {
  const norm = (name || '').toLowerCase();
  if (norm.includes('manh')) return <Sun className="w-4 h-4 text-amber-500 shrink-0" />;
  if (norm.includes('tard') || norm.includes('inter')) return <Sunset className="w-4 h-4 text-orange-500 shrink-0" />;
  if (norm.includes('noit')) return <Moon className="w-4 h-4 text-indigo-500 shrink-0" />;
  return <Clock className="w-4 h-4 text-blue-500 shrink-0" />;
}

function getStatusBadgeClass(status: string) {
  if (status === 'Confirmado') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Pendente') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'Vaga') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function isSameCollaborator(nameA?: string | null, nameB?: string | null) {
  if (!nameA || !nameB) return false;
  const a = nameA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const b = nameB.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const partA = a.split(/[@._\s]+/)[0];
  const partB = b.split(/[@._\s]+/)[0];
  return partA === partB;
}

export function BoardShiftView({ 
  boardId, 
  isReadOnly,
  onSwitchToTurnos
}: { 
  boardId: string; 
  isReadOnly?: boolean;
  onSwitchToTurnos?: () => void;
}) {
  const queryClient = useQueryClient();

  // Data Selecionada (Padrão: Hoje)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Modo de Visão: Quadro (Cards), Lista (Tabela), Timeline (Linha do tempo), Calendário Mensal
  const [viewTab, setViewTab] = useState<'quadro' | 'lista' | 'timeline' | 'calendario'>('quadro');

  // Mês exibido na Visão Calendário
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date(`${selectedDate}T00:00:00`));

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterShift, setFilterShift] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [onlyVacancies, setOnlyVacancies] = useState(false);

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [selectedShiftDetails, setSelectedShiftDetails] = useState<any | null>(null);

  // Seleção múltipla para exclusão na visão de Lista (Tabela)
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Campos do Modal de Exclusão em Lote
  const [bulkDeleteMode, setBulkDeleteMode] = useState<'single_day' | 'date_range'>('single_day');
  const [bulkStartDate, setBulkStartDate] = useState(selectedDate);
  const [bulkEndDate, setBulkEndDate] = useState(selectedDate);
  const [bulkFilterOperator, setBulkFilterOperator] = useState('all');
  const [bulkFilterRegion, setBulkFilterRegion] = useState('all');

  // Comentários do Modal de Detalhes
  const [newCommentText, setNewCommentText] = useState('');

  // Envio e Compartilhamento de Escala com Colaborador
  const [isSendingShift, setIsSendingShift] = useState(false);
  const [sendFeedbackMsg, setSendFeedbackMsg] = useState<string | null>(null);
  const [notifyOnSave, setNotifyOnSave] = useState(true);

  // 1. Busca Perfis (compartilhado no cache global 'all_profiles')
  const { data: allProfiles } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, email, avatar_url, role, receive_emails').order('email');
      return data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // 1.5. Busca dados do Usuário Atual (0ms via sessão local)
  const { data: authUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  const currentUser = useMemo(() => {
    if (!authUser) return null;
    const profile = (allProfiles || []).find((p: any) => p.id === authUser.id || p.email === authUser.email) || null;
    return { ...authUser, profile };
  }, [authUser, allProfiles]);

  // 2. Busca o workspace_id do quadro (já semeado pelo BoardPage)
  const { data: boardData } = useQuery({
    queryKey: ['board_workspace_shift', boardId],
    queryFn: async () => {
      const { data } = await supabase.from('boards').select('workspace_id, name').eq('id', boardId).single();
      return data;
    },
    staleTime: 10 * 60 * 1000
  });

  // 3. Busca Perfis e Filtra por Integrantes do Setor (Workspace)
  const { data: teamMembers } = useQuery({
    queryKey: ['sector_members_for_shift', boardData?.workspace_id, allProfiles?.length],
    queryFn: async () => {
      const profiles = allProfiles || [];
      if (profiles.length === 0) return [];
      if (!boardData?.workspace_id) return profiles;

      const { data: members } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', boardData.workspace_id);
      const memberUserIds = new Set((members || []).map((m: any) => m.user_id));

      return profiles.filter((p: any) => p.role === 'admin' || memberUserIds.has(p.id));
    },
    enabled: !!allProfiles && boardData !== undefined,
    staleTime: 5 * 60 * 1000
  });

  // 4. Configurações da Escala do Quadro/Setor (Turnos, Regiões, Tipos e Status Fixos/Customizáveis)
  const { data: shiftSettings } = useQuery({
    queryKey: ['operational_shift_settings', boardId, boardData?.workspace_id],
    queryFn: async () => {
      let query = supabase.from('operational_shift_settings').select('*');
      if (boardData?.workspace_id) {
        query = query.or(`workspace_id.eq.${boardData.workspace_id},board_id.eq.${boardId}`);
      } else {
        query = query.eq('board_id', boardId);
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (error || !data) {
        return {
          shifts: SHIFTS_DEFAULT,
          regions: REGIONS_DEFAULT,
          operator_types: TYPES_DEFAULT,
          statuses: STATUSES_DEFAULT
        };
      }

      return {
        shifts: data.shifts || SHIFTS_DEFAULT,
        regions: data.regions || REGIONS_DEFAULT,
        operator_types: data.operator_types || TYPES_DEFAULT,
        statuses: data.statuses || STATUSES_DEFAULT
      };
    },
    enabled: boardData !== undefined
  });

  const availableShifts = shiftSettings?.shifts || SHIFTS_DEFAULT;
  const availableRegions = shiftSettings?.regions || REGIONS_DEFAULT;
  const availableTypes = shiftSettings?.operator_types || TYPES_DEFAULT;
  const availableStatuses = shiftSettings?.statuses || STATUSES_DEFAULT;

  // Estados do Formulário de Escala em Lote (Múltiplas Datas, Pessoas, Regiões e Tipos)
  const [formShiftName, setFormShiftName] = useState(availableShifts[0]?.name || 'MANHÃ');
  const [formShiftTime, setFormShiftTime] = useState(availableShifts[0]?.time || '08:00 - 12:00');
  const [formSelectedRegions, setFormSelectedRegions] = useState<string[]>([availableRegions[0] || 'Matriz']);
  const [formSelectedTypes, setFormSelectedTypes] = useState<string[]>([availableTypes[0] || 'Dedicado']);
  const [formStatus, setFormStatus] = useState(availableStatuses[0] || 'Confirmado');
  const [formNotes, setFormNotes] = useState('');
  
  // Múltiplas Datas Selecionadas no Modal
  const [formDates, setFormDates] = useState<string[]>([selectedDate]);

  // Múltiplas Pessoas Selecionadas no Modal
  const [formSelectedPeople, setFormSelectedPeople] = useState<string[]>([]);
  const [customOperatorName, setCustomOperatorName] = useState('');

  // Estados locais para edição de Configurações do Setor
  const [settingsShifts, setSettingsShifts] = useState(availableShifts);
  const [settingsRegions, setSettingsRegions] = useState(availableRegions);
  const [settingsTypes, setSettingsTypes] = useState(availableTypes);
  const [settingsStatuses, setSettingsStatuses] = useState(availableStatuses);

  const [newRegionText, setNewRegionText] = useState('');
  const [newTypeText, setNewTypeText] = useState('');
  const [newStatusText, setNewStatusText] = useState('');
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftTime, setNewShiftTime] = useState('');

  // Permissão de Gerenciamento: Apenas LÍDER de setor e ADMINISTRADOR podem alterar configurações e escalas.
  const canManageShifts = useMemo(() => {
    let pRole = (currentUser?.profile?.role || '').toLowerCase().trim();

    if (!pRole && currentUser && teamMembers) {
      const found = teamMembers.find(
        (m: any) => m.id === currentUser.id || (currentUser.email && m.email?.toLowerCase() === currentUser.email.toLowerCase())
      );
      if (found?.role) {
        pRole = (found.role || '').toLowerCase().trim();
      }
    }

    const isLeaderOrAdmin = 
      pRole === 'admin' || 
      pRole === 'administrador' || 
      pRole === 'leader' || 
      pRole === 'lider' || 
      pRole === 'líder';

    return isLeaderOrAdmin;
  }, [currentUser, teamMembers]);

  // Abrir Modal de Configurações
  const handleOpenSettings = () => {
    if (!canManageShifts) return;
    setSettingsShifts(availableShifts);
    setSettingsRegions(availableRegions);
    setSettingsTypes(availableTypes);
    setSettingsStatuses(availableStatuses);
    setIsSettingsOpen(true);
  };

  // Mutation para Salvar Configurações
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!canManageShifts) throw new Error("Apenas Líderes de Setor e Administradores podem gerenciar as configurações da escala.");
      
      const payload: any = {
        board_id: boardId,
        shifts: settingsShifts,
        regions: settingsRegions,
        operator_types: settingsTypes,
        statuses: settingsStatuses,
        updated_at: new Date().toISOString()
      };

      if (boardData?.workspace_id) {
        payload.workspace_id = boardData.workspace_id;
      }

      let { error } = await supabase
        .from('operational_shift_settings')
        .upsert(payload);

      if (error && (error.message?.includes('workspace_id') || error.details?.includes('workspace_id'))) {
        delete payload.workspace_id;
        const retry = await supabase
          .from('operational_shift_settings')
          .upsert(payload);
        if (retry.error) throw retry.error;
      } else if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shift_settings'] });
      setIsSettingsOpen(false);
    },
    onError: (err: any) => {
      alert("Erro ao salvar configurações da escala: " + err.message);
    }
  });

  // 5. Busca as Escalas do Banco de Dados
  const monthRangeLimits = useMemo(() => {
    const calDate = new Date(calendarMonth);
    const start = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1).toISOString().split('T')[0];
    const end = new Date(calDate.getFullYear(), calDate.getMonth() + 2, 0).toISOString().split('T')[0];
    return { start, end };
  }, [calendarMonth]);

  const { data: rawShifts, isLoading: isLoadingShifts } = useQuery({
    queryKey: ['operational_shifts', boardId, boardData?.workspace_id, monthRangeLimits.start, monthRangeLimits.end],
    queryFn: async () => {
      let query = supabase.from('operational_shifts').select('*');

      if (boardData?.workspace_id) {
        query = query.or(`workspace_id.eq.${boardData.workspace_id},board_id.eq.${boardId}`);
      } else {
        query = query.eq('board_id', boardId);
      }

      query = query.gte('shift_date', monthRangeLimits.start).lte('shift_date', monthRangeLimits.end);

      const { data, error } = await query
        .order('shift_date')
        .order('shift_name')
        .order('region_name');

      if (error) {
        console.warn("Tabela operational_shifts erro:", error);
        return [];
      }
      return data || [];
    }
  });

  // Map de Escalas por Data
  const shiftsByDateMap = useMemo(() => {
    const map = new Map<string, any[]>();
    (rawShifts || []).forEach((shift: any) => {
      const d = shift.shift_date;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(shift);
    });
    return map;
  }, [rawShifts]);

  // 6. Busca os Comentários da Escala Selecionada
  const { data: shiftComments, refetch: refetchComments } = useQuery({
    queryKey: ['operational_shift_comments', selectedShiftDetails?.id],
    queryFn: async () => {
      if (!selectedShiftDetails?.id) return [];
      const { data, error } = await supabase
        .from('operational_shift_comments')
        .select('*')
        .eq('shift_id', selectedShiftDetails.id)
        .order('created_at', { ascending: true });

      if (error) return [];
      return data || [];
    },
    enabled: !!selectedShiftDetails?.id
  });

  // Mutation para Adicionar Comentário
  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedShiftDetails?.id || !newCommentText.trim()) return;
      const userName = currentUser?.profile?.email?.split('@')[0] || currentUser?.email?.split('@')[0] || 'Usuário';
      const userAvatar = currentUser?.profile?.avatar_url || null;

      const { error } = await supabase
        .from('operational_shift_comments')
        .insert([{
          shift_id: selectedShiftDetails.id,
          user_id: currentUser?.id,
          user_name: userName,
          user_avatar: userAvatar,
          content: newCommentText.trim()
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      setNewCommentText('');
      refetchComments();
    }
  });

  // Navegação de Datas no Header
  const changeDate = (days: number) => {
    const current = new Date(`${selectedDate}T00:00:00`);
    current.setDate(current.getDate() + days);
    const newDateStr = current.toISOString().split('T')[0];
    setSelectedDate(newDateStr);
    setCalendarMonth(new Date(`${newDateStr}T00:00:00`));
  };

  const formattedSelectedDateText = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [selectedDate]);

  // Map de Perfis por ID para rápido acesso ao avatar_url e email
  const memberProfileMap = useMemo(() => {
    const map = new Map<string, any>();
    (teamMembers || []).forEach((p: any) => {
      map.set(p.id, p);
    });
    return map;
  }, [teamMembers]);

  // Helper para obter Avatar do Usuário
  const getUserAvatar = (userId: string | null, userName: string) => {
    if (userId && memberProfileMap.has(userId)) {
      const p = memberProfileMap.get(userId);
      if (p.avatar_url) return p.avatar_url;
    }
    return null;
  };

  const getInitials = (name: string) => {
    if (!name) return 'OP';
    const parts = name.trim().split(/[\s@_.]+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Filtra as escalas conforme os critérios da tela para o dia selecionado (Suporta múltiplas tags combinadas por vírgula)
  const shiftsForSelectedDate = useMemo(() => {
    return (rawShifts || []).filter((shift: any) => {
      if (shift.shift_date !== selectedDate) return false;
      if (filterShift !== 'all' && shift.shift_name !== filterShift) return false;
      if (filterRegion !== 'all' && !shift.region_name?.toLowerCase().includes(filterRegion.toLowerCase())) return false;
      if (filterType !== 'all' && !shift.operator_type?.toLowerCase().includes(filterType.toLowerCase())) return false;
      if (filterStatus !== 'all' && shift.status !== filterStatus) return false;
      if (onlyVacancies && shift.status !== 'Vaga') return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = shift.operator_name?.toLowerCase().includes(query);
        const matchRegion = shift.region_name?.toLowerCase().includes(query);
        const matchShift = shift.shift_name?.toLowerCase().includes(query);
        if (!matchName && !matchRegion && !matchShift) return false;
      }
      return true;
    });
  }, [rawShifts, selectedDate, filterShift, filterRegion, filterType, filterStatus, onlyVacancies, searchQuery]);

  // Funções de Atalho Rápido de Datas
  const setDatesSegSex = () => {
    const base = new Date(`${selectedDate}T00:00:00`);
    const dayOfWeek = base.getDay();
    const monday = new Date(base);
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + diffToMonday);

    const dates: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    setFormDates(dates);
  };

  const setDates7Dias = () => {
    const base = new Date(`${selectedDate}T00:00:00`);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    setFormDates(dates);
  };

  const setDatesMesInteiro = () => {
    const base = new Date(`${selectedDate}T00:00:00`);
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dates: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      dates.push(d.toISOString().split('T')[0]);
    }
    setFormDates(dates);
  };

  // Salvar / Criar Escalas em Lote (Junta Múltiplas Regiões e Funções em 1 único card limpo por operador)
  const createBulkShifts = useMutation({
    mutationFn: async () => {
      if (!canManageShifts) throw new Error("Apenas Líderes de Setor e Administradores podem escalar operadores.");
      if (formDates.length === 0) throw new Error("Selecione pelo menos uma data.");
      if (formSelectedRegions.length === 0) throw new Error("Selecione pelo menos uma região/base.");
      if (formSelectedTypes.length === 0) throw new Error("Selecione pelo menos um tipo de operador/função.");

      let peopleToInsert: Array<{ name: string; userId: string | null }> = [];

      if (formStatus === 'Vaga') {
        peopleToInsert = [{ name: 'VAGA / Nenhum operador', userId: null }];
      } else if (formSelectedPeople.length > 0) {
        peopleToInsert = formSelectedPeople.map(pId => {
          const profile = memberProfileMap.get(pId);
          const name = profile ? (profile.email.split('@')[0].toUpperCase()) : 'Operador';
          return { name, userId: pId };
        });
      } else if (customOperatorName.trim()) {
        peopleToInsert = [{ name: customOperatorName.trim().toUpperCase(), userId: null }];
      } else {
        throw new Error("Selecione pelo menos uma pessoa do setor ou digite um nome.");
      }

      // Combina as múltiplas regiões e tipos em uma string de tags limpas por vírgula
      const combinedRegionName = formSelectedRegions.join(', ');
      const combinedOperatorType = formSelectedTypes.join(', ');

      const rowsToInsert = [];
      for (const d of formDates) {
        for (const p of peopleToInsert) {
          rowsToInsert.push({
            board_id: boardId,
            workspace_id: boardData?.workspace_id || null,
            shift_date: d,
            shift_name: formShiftName,
            shift_time: formShiftTime,
            region_name: combinedRegionName,
            operator_user_id: p.userId,
            operator_name: p.name,
            operator_type: combinedOperatorType,
            status: formStatus,
            notes: formNotes,
            created_by: currentUser?.id || null
          });
        }
      }

      const { error } = await supabase.from('operational_shifts').insert(rowsToInsert);
      if (error) throw error;

      // Dispara notificações aos operadores caso notifyOnSave esteja ativo
      if (notifyOnSave && peopleToInsert.length > 0 && formStatus !== 'Vaga') {
        const notifs: any[] = [];
        const authorEmail = currentUser?.email || 'lider@masterdeliveryexpress.com.br';

        for (const p of peopleToInsert) {
          let email: string | null = null;
          if (p.userId) {
            const prof = memberProfileMap.get(p.userId);
            if (prof?.email) email = prof.email;
          }
          if (!email && p.name) {
            const prof = allProfiles?.find((u: any) =>
              u.email?.toLowerCase().includes(p.name.toLowerCase()) ||
              p.name.toLowerCase().includes(u.email?.split('@')[0].toLowerCase())
            );
            if (prof?.email) email = prof.email;
          }

          if (email) {
            const datesText = formDates.length === 1 ? formDates[0] : `${formDates.length} dias`;
            notifs.push({
              user_email: email,
              message: `${authorEmail}||Nova escala operacional (${formShiftName} • ${formShiftTime}) lançada para você em ${datesText}! Base: ${combinedRegionName}.`,
              read: false
            });
          }
        }

        if (notifs.length > 0) {
          await supabase.from('notifications').insert(notifs);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts'] });
      setIsModalOpen(false);
      resetForm();
      setSendFeedbackMsg(notifyOnSave ? 'Escalas lançadas e notificações enviadas aos operadores com sucesso!' : 'Escalas salvas com sucesso!');
      setTimeout(() => setSendFeedbackMsg(null), 4500);
    },
    onError: (err: any) => {
      alert("Erro ao lançar escala: " + err.message);
    }
  });

  // Mandar escala individual para o colaborador
  const handleSendShiftToCollaborator = async (shift: any) => {
    if (!shift) return;
    setIsSendingShift(true);

    try {
      let targetEmail: string | null = null;
      const targetName = shift.operator_name || 'Colaborador';

      if (shift.operator_user_id) {
        const p = memberProfileMap.get(shift.operator_user_id);
        if (p?.email) targetEmail = p.email;
      }

      if (!targetEmail) {
        const p = allProfiles?.find((u: any) => 
          u.email?.toLowerCase().includes(targetName.toLowerCase()) ||
          targetName.toLowerCase().includes(u.email?.split('@')[0].toLowerCase())
        );
        if (p?.email) targetEmail = p.email;
      }

      const authorEmail = currentUser?.email || 'lider@masterdeliveryexpress.com.br';
      const dateFormatted = new Date(`${shift.shift_date}T00:00:00`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      if (targetEmail) {
        // 1. Notificação no sino
        await supabase.from('notifications').insert([{
          user_email: targetEmail,
          message: `${authorEmail}||Sua escala operacional (${shift.shift_name} • ${shift.shift_time}) para ${dateFormatted} foi confirmada! Base: ${shift.region_name || 'Geral'}.`,
          read: false
        }]);

        // 2. Dispara e-mail com visual corporativo CR Task
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: targetEmail,
            subject: `Sua Escala Operacional - ${shift.shift_name} (${shift.shift_date}) - CR Task`,
            html: `
              <div style="font-family: 'Segoe UI', Inter, sans-serif; background: #0b2238; color: #f8fafc; padding: 32px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #1e3a56;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <span style="background: #00ffa3; color: #0b2238; font-size: 11px; font-weight: 800; padding: 4px 14px; border-radius: 999px; letter-spacing: 1.5px; text-transform: uppercase;">CR Task • Gestão Operacional</span>
                </div>
                <h2 style="color: #ffffff; text-align: center; margin-bottom: 6px; font-size: 24px; font-weight: 800;">${targetName.toUpperCase()}</h2>
                <p style="text-align: center; color: #94a3b8; font-size: 13px; margin-top: 0;">Sua escala operacional foi confirmada pela liderança.</p>
                
                <div style="background: #051322; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #1e3a56;">
                  <div style="margin-bottom: 12px; border-bottom: 1px solid #1e3a56; padding-bottom: 8px;">
                    <span style="color: #94a3b8; font-size: 12px; font-weight: 600;">Data: </span>
                    <span style="color: #ffffff; font-size: 13px; font-weight: 700;">${dateFormatted}</span>
                  </div>
                  <div style="margin-bottom: 12px; border-bottom: 1px solid #1e3a56; padding-bottom: 8px;">
                    <span style="color: #94a3b8; font-size: 12px; font-weight: 600;">Turno / Horário: </span>
                    <span style="color: #00ffa3; font-size: 13px; font-weight: 700;">${shift.shift_name} (${shift.shift_time})</span>
                  </div>
                  <div style="margin-bottom: 12px; border-bottom: 1px solid #1e3a56; padding-bottom: 8px;">
                    <span style="color: #94a3b8; font-size: 12px; font-weight: 600;">Regiões / Bases: </span>
                    <span style="color: #38bdf8; font-size: 13px; font-weight: 700;">${shift.region_name || 'Matriz'}</span>
                  </div>
                  <div style="margin-bottom: 12px; border-bottom: 1px solid #1e3a56; padding-bottom: 8px;">
                    <span style="color: #94a3b8; font-size: 12px; font-weight: 600;">Função / Tipo: </span>
                    <span style="color: #ffffff; font-size: 13px; font-weight: 700;">${shift.operator_type || 'Operador'}</span>
                  </div>
                  <div>
                    <span style="color: #94a3b8; font-size: 12px; font-weight: 600;">Status: </span>
                    <span style="color: #34d399; font-size: 13px; font-weight: 700;">${shift.status || 'Confirmado'}</span>
                  </div>
                  ${shift.notes ? `
                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #1e3a56;">
                      <span style="color: #94a3b8; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Instruções:</span>
                      <span style="color: #e2e8f0; font-size: 12px;">${shift.notes}</span>
                    </div>
                  ` : ''}
                </div>
                <p style="text-align: center; color: #64748b; font-size: 11px;">Enviado via CR Task • Notificação Operacional</p>
              </div>
            `
          })
        }).catch(() => {});

        setSendFeedbackMsg(`Escala enviada com sucesso para ${targetName} (${targetEmail})!`);
      } else {
        setSendFeedbackMsg(`Escala registrada para ${targetName}! (Sem e-mail cadastrado)`);
      }

      setTimeout(() => setSendFeedbackMsg(null), 4500);
    } catch (err: any) {
      alert("Erro ao enviar escala: " + err.message);
    } finally {
      setIsSendingShift(false);
    }
  };

  // Mandar escala de todas as pessoas do dia selecionado
  const handleSendAllDayShifts = async () => {
    if (shiftsForSelectedDate.length === 0) {
      alert("Nenhuma escala encontrada nesta data para envio.");
      return;
    }

    const ok = confirm(`Deseja enviar a escala operacional de ${formattedSelectedDateText} para os ${shiftsForSelectedDate.length} operadores escalados?`);
    if (!ok) return;

    setIsSendingShift(true);
    try {
      const authorEmail = currentUser?.email || 'lider@masterdeliveryexpress.com.br';
      const notifs: any[] = [];

      shiftsForSelectedDate.forEach((shift: any) => {
        let email: string | null = null;
        if (shift.operator_user_id) {
          const p = memberProfileMap.get(shift.operator_user_id);
          if (p?.email) email = p.email;
        }
        if (!email && shift.operator_name) {
          const p = allProfiles?.find((u: any) => 
            u.email?.toLowerCase().includes(shift.operator_name.toLowerCase()) ||
            shift.operator_name.toLowerCase().includes(u.email?.split('@')[0].toLowerCase())
          );
          if (p?.email) email = p.email;
        }

        if (email) {
          notifs.push({
            user_email: email,
            message: `${authorEmail}||Sua escala operacional (${shift.shift_name} • ${shift.shift_time}) de ${formattedSelectedDateText} foi confirmada!`,
            read: false
          });
        }
      });

      if (notifs.length > 0) {
        await supabase.from('notifications').insert(notifs);
      }

      setSendFeedbackMsg(`Escalas do dia enviadas para ${notifs.length} colaboradores!`);
      setTimeout(() => setSendFeedbackMsg(null), 4500);
    } catch (err: any) {
      alert("Erro ao enviar escalas: " + err.message);
    } finally {
      setIsSendingShift(false);
    }
  };

  // Copiar resumo formatado para colar no WhatsApp
  const handleCopyWhatsAppShift = (shift: any) => {
    if (!shift) return;
    const text = `CR TASK • ESCALA OPERACIONAL\n\n` +
      `Colaborador: ${shift.operator_name}\n` +
      `Data: ${shift.shift_date}\n` +
      `Turno: ${shift.shift_name} (${shift.shift_time})\n` +
      `Base/Região: ${shift.region_name || 'Matriz'}\n` +
      `Função: ${shift.operator_type || 'Operador'}\n` +
      `Status: ${shift.status}\n` +
      (shift.notes ? `Instruções: ${shift.notes}\n` : '') +
      `\nEnviado via CR Task Operacional`;

    navigator.clipboard.writeText(text);
    setSendFeedbackMsg(`Texto formatado copiado! Cole para o colaborador.`);
    setTimeout(() => setSendFeedbackMsg(null), 4000);
  };

  // Excluir Escala Única
  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      if (!canManageShifts) throw new Error("Apenas Líderes de Setor e Administradores podem excluir escalas.");
      const { error } = await supabase.from('operational_shifts').delete().eq('id', shiftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts'] });
      setSelectedShiftDetails(null);
    }
  });

  // Excluir Várias Escalas Selecionadas na Tabela (Lista)
  const deleteSelectedRowsMutation = useMutation({
    mutationFn: async (shiftIds: string[]) => {
      if (!canManageShifts) throw new Error("Apenas Líderes de Setor e Administradores podem excluir escalas.");
      if (shiftIds.length === 0) return;
      const { error } = await supabase.from('operational_shifts').delete().in('id', shiftIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts'] });
      setSelectedRowIds([]);
    },
    onError: (err: any) => {
      alert("Erro ao excluir escalas selecionadas: " + err.message);
    }
  });

  // Excluir em Lote por Período/Filtros
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      if (!canManageShifts) throw new Error("Apenas Líderes de Setor e Administradores podem excluir escalas.");

      let query = supabase.from('operational_shifts').delete();

      if (boardData?.workspace_id) {
        query = query.eq('workspace_id', boardData.workspace_id);
      } else {
        query = query.eq('board_id', boardId);
      }

      if (bulkDeleteMode === 'single_day') {
        query = query.eq('shift_date', bulkStartDate);
      } else {
        query = query.gte('shift_date', bulkStartDate).lte('shift_date', bulkEndDate);
      }

      if (bulkFilterOperator !== 'all') {
        query = query.eq('operator_user_id', bulkFilterOperator);
      }

      if (bulkFilterRegion !== 'all') {
        query = query.ilike('region_name', `%${bulkFilterRegion}%`);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts'] });
      setIsBulkDeleteOpen(false);
    },
    onError: (err: any) => {
      alert("Erro ao executar limpeza em lote: " + err.message);
    }
  });

  const resetForm = () => {
    setFormShiftName(availableShifts[0]?.name || 'MANHÃ');
    setFormShiftTime(availableShifts[0]?.time || '08:00 - 12:00');
    setFormSelectedRegions([availableRegions[0] || 'Matriz']);
    setFormSelectedTypes([availableTypes[0] || 'Dedicado']);
    setFormStatus(availableStatuses[0] || 'Confirmado');
    setFormNotes('');
    setFormDates([selectedDate]);
    setFormSelectedPeople([]);
    setCustomOperatorName('');
  };

  const toggleFormDate = (dStr: string) => {
    if (formDates.includes(dStr)) {
      if (formDates.length > 1) setFormDates(formDates.filter(d => d !== dStr));
    } else {
      setFormDates([...formDates, dStr].sort());
    }
  };

  const toggleFormPerson = (pId: string) => {
    if (formSelectedPeople.includes(pId)) {
      setFormSelectedPeople(formSelectedPeople.filter(id => id !== pId));
    } else {
      setFormSelectedPeople([...formSelectedPeople, pId]);
    }
  };

  const toggleFormRegion = (rStr: string) => {
    if (formSelectedRegions.includes(rStr)) {
      if (formSelectedRegions.length > 1) setFormSelectedRegions(formSelectedRegions.filter(r => r !== rStr));
    } else {
      setFormSelectedRegions([...formSelectedRegions, rStr]);
    }
  };

  const toggleFormType = (tStr: string) => {
    if (formSelectedTypes.includes(tStr)) {
      if (formSelectedTypes.length > 1) setFormSelectedTypes(formSelectedTypes.filter(t => t !== tStr));
    } else {
      setFormSelectedTypes([...formSelectedTypes, tStr]);
    }
  };

  // Gerador de Dias do Calendário Mensal
  const calendarDaysMatrix = useMemo(() => {
    const calDate = new Date(calendarMonth);
    const year = calDate.getFullYear();
    const month = calDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const matrix: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      matrix.push({
        dateStr: d.toISOString().split('T')[0],
        dayNum: prevMonthDays - i,
        isCurrentMonth: false
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      matrix.push({
        dateStr: d.toISOString().split('T')[0],
        dayNum: day,
        isCurrentMonth: true
      });
    }

    const totalSoFar = matrix.length;
    const remaining = (7 - (totalSoFar % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      matrix.push({
        dateStr: d.toISOString().split('T')[0],
        dayNum: day,
        isCurrentMonth: false
      });
    }

    return matrix;
  }, [calendarMonth]);

  const monthYearLabel = useMemo(() => {
    const d = new Date(calendarMonth);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [calendarMonth]);

  // Gera o Canvas oficial da Escala Operacional (1200 x 680) para download e cópia de imagem
  const generateShiftScheduleCanvas = async (shift: any, memberName: string, dateFormatted: string): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    const width = 1200;
    const height = 680;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 1. Fundo Gradiente Dark Oficial (#0f172a -> #111827 -> #0b1120)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#111827');
    bgGrad.addColorStop(1, '#0b1120');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // 2. Logo oficial (/logo.png)
    const logoImg = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/logo.png';
    });

    const logoBoxX = 56;
    const logoBoxY = 48;
    const logoBoxSize = 88;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 20);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#334155';
    ctx.stroke();
    ctx.clip();

    if (logoImg) {
      ctx.drawImage(logoImg, logoBoxX + 6, logoBoxY + 6, logoBoxSize - 12, logoBoxSize - 12);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 32px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CR', logoBoxX + logoBoxSize / 2, logoBoxY + logoBoxSize / 2);
    }
    ctx.restore();

    // 3. Cabeçalho Textos
    ctx.fillStyle = '#00ffa3';
    ctx.font = '800 13px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CR TASK • ESCALA OPERACIONAL', 164, 76);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px Inter, Arial, sans-serif';
    ctx.fillText((memberName || 'COLABORADOR').toUpperCase(), 164, 116);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 16px Inter, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(dateFormatted, width - 56, 92);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(56, 160);
    ctx.lineTo(width - 56, 160);
    ctx.stroke();

    // 4. Cartão Central com os Dados do Turno
    const cardX = 56;
    const cardY = 190;
    const cardW = width - 112;
    const cardH = 380;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 20);
    ctx.fillStyle = '#081220';
    ctx.fill();
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Linha 1: Turno e Horário
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 13px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TURNO / HORÁRIO', cardX + 36, cardY + 54);

    ctx.fillStyle = '#00ffa3';
    ctx.font = '900 28px Inter, Arial, sans-serif';
    const shiftTitle = `${shift.shift_name}${shift.shift_time ? ` (${shift.shift_time})` : ''}`;
    ctx.fillText(shiftTitle, cardX + 36, cardY + 92);

    // Linha 2: Base e Função
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 13px Inter, Arial, sans-serif';
    ctx.fillText('BASE / REGIÃO', cardX + 36, cardY + 154);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 24px Inter, Arial, sans-serif';
    ctx.fillText(shift.region_name || 'Matriz / Geral', cardX + 36, cardY + 188);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 13px Inter, Arial, sans-serif';
    ctx.fillText('FUNÇÃO / TIPO', cardX + 460, cardY + 154);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 24px Inter, Arial, sans-serif';
    ctx.fillText(shift.operator_type || 'Operador', cardX + 460, cardY + 188);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 13px Inter, Arial, sans-serif';
    ctx.fillText('STATUS', cardX + 800, cardY + 154);

    ctx.fillStyle = '#34d399';
    ctx.font = '800 24px Inter, Arial, sans-serif';
    ctx.fillText(shift.status || 'Confirmado', cardX + 800, cardY + 188);

    // Linha 3: Instruções se houver
    if (shift.notes) {
      ctx.strokeStyle = '#1e3a5f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 36, cardY + 230);
      ctx.lineTo(cardX + cardW - 36, cardY + 230);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 12px Inter, Arial, sans-serif';
      ctx.fillText('INSTRUÇÕES DA GESTÃO:', cardX + 36, cardY + 264);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 16px Inter, Arial, sans-serif';
      ctx.fillText(shift.notes.slice(0, 95), cardX + 36, cardY + 296);
    }

    // 5. Rodapé
    ctx.fillStyle = '#64748b';
    ctx.font = '600 12px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✓ Escala operacional confirmada e enviada via CR Task', width / 2, height - 36);

    return canvas;
  };

  const handleCopyShiftPng = async (shift: any, memberName: string) => {
    try {
      const canvas = await generateShiftScheduleCanvas(shift, memberName, formattedSelectedDateText);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setSendFeedbackMsg('📋 Imagem da escala operacional copiada! Pode colar no WhatsApp ou Teams.');
        setTimeout(() => setSendFeedbackMsg(null), 4500);
      }, 'image/png');
    } catch (err: any) {
      alert("Não foi possível copiar a imagem automaticamente: " + err.message);
    }
  };

  const handleDownloadShiftPng = async (shift: any, memberName: string) => {
    try {
      const canvas = await generateShiftScheduleCanvas(shift, memberName, formattedSelectedDateText);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `escala_operacional_${memberName.toLowerCase().replace(/\s+/g, '_')}_${selectedDate}.png`;
      link.href = dataUrl;
      link.click();
      setSendFeedbackMsg('📥 Imagem da escala operacional baixada com sucesso!');
      setTimeout(() => setSendFeedbackMsg(null), 4500);
    } catch (err: any) {
      alert("Erro ao baixar imagem: " + err.message);
    }
  };

  // SE FOR COLABORADOR COMUM (!canManageShifts):
  // Exibe exclusivamente a visão de card/imagem gerada da escala do colaborador para o dia selecionado.
  // Segue exatamente o fluxo do Quadro de Turnos: caso não tenha nada, mostra que "Ainda não foi postado".
  if (!canManageShifts) {
    const activeMemberForUser = (() => {
      const userEmail = (currentUser?.email || '').toLowerCase().trim();
      const userPrefix = userEmail.split('@')[0] || '';
      const boardTitle = (boardData?.name || '').trim();

      if (userEmail) {
        const found = (rawShifts || []).find((s: any) => 
          (s.operator_user_id && currentUser?.id && s.operator_user_id === currentUser.id) ||
          isSameCollaborator(s.operator_name, userPrefix) ||
          isSameCollaborator(s.operator_name, boardTitle)
        );
        if (found?.operator_name) return found.operator_name;
      }

      if (boardTitle && !boardTitle.toLowerCase().includes('panorama')) {
        return boardTitle;
      }

      return userPrefix ? userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1) : 'Colaborador';
    })();

    const collaboratorShift = (shiftsForSelectedDate || []).find((s: any) => {
      if (s.operator_user_id && currentUser?.id && s.operator_user_id === currentUser.id) return true;
      const opName = s.operator_name || '';
      return isSameCollaborator(opName, activeMemberForUser) ||
             (currentUser?.email && isSameCollaborator(opName, currentUser.email.split('@')[0]));
    }) || null;

    const isPosted = Boolean(collaboratorShift);

    return (
      <div className="flex flex-col h-full w-full bg-slate-50 overflow-y-auto">
        {/* Barra Superior Limpa para o Colaborador */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Minha Escala Operacional
                <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-full">
                  {activeMemberForUser}
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Consulte o seu turno, horário de entrada, base e status confirmado pela liderança
              </p>
            </div>
          </div>

          {/* Navegação de Data */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => changeDate(-1)}
                className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-all cursor-pointer"
                title="Dia Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3 text-xs sm:text-sm font-bold text-slate-800 capitalize flex items-center gap-1.5 min-w-[150px] justify-center">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{formattedSelectedDateText}</span>
              </div>

              <button
                onClick={() => changeDate(1)}
                className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-all cursor-pointer"
                title="Próximo Dia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setSelectedDate(todayStr);
                  setCalendarMonth(new Date(`${todayStr}T00:00:00`));
                }}
                className="ml-1 px-2.5 py-1 text-xs font-semibold bg-white text-blue-700 hover:bg-blue-50 rounded-lg border border-slate-200/80 cursor-pointer"
              >
                Hoje
              </button>
            </div>

            {/* Ações de Imagem (Apenas quando houver escala postada) */}
            {isPosted && collaboratorShift && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyShiftPng(collaboratorShift, activeMemberForUser)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border border-slate-200"
                  title="Copiar imagem oficial da escala para colar no WhatsApp"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Imagem</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadShiftPng(collaboratorShift, activeMemberForUser)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  title="Baixar escala oficial em imagem PNG"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Escala (PNG)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {sendFeedbackMsg && (
          <div className="mx-6 mt-4 bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>{sendFeedbackMsg}</span>
            <button onClick={() => setSendFeedbackMsg(null)} className="text-emerald-700 hover:text-emerald-950 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Card Visual Oficial da Escala Operacional (Formato Dark com Logo CR Task) */}
        <div className="flex-1 p-6 flex flex-col items-center justify-start">
          <div className="w-full max-w-[820px] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1120] rounded-2xl border border-slate-700/80 shadow-2xl p-6 sm:p-8 text-white select-none relative overflow-hidden">
            
            {/* Topo: Logo + Título + Colaborador + Data */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800/90 w-full">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 bg-black rounded-2xl border border-slate-700/80 shadow-xl p-1.5 flex items-center justify-center shrink-0">
                  <img src="/logo.png" alt="CR Task" className="w-full h-full object-contain rounded-xl" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold text-[#00ffa3] tracking-widest uppercase block">
                    CR TASK • GESTÃO OPERACIONAL
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
                    {activeMemberForUser.toUpperCase()}
                  </h2>
                </div>
              </div>

              <div className="text-right">
                <span className="px-3 py-1 bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg">
                  {formattedSelectedDateText}
                </span>
              </div>
            </div>

            {/* Conteúdo Central: Se Postado mostra os detalhes, se Não Postado mostra o alerta */}
            {isPosted && collaboratorShift ? (
              <div className="py-6 space-y-6">
                {/* Linha de Destaque: Turno e Horário */}
                <div className="bg-[#051322] border border-[#1e3a56] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Turno Alocado
                    </span>
                    <span className="text-2xl font-black text-[#00ffa3] tracking-tight">
                      {collaboratorShift.shift_name}
                    </span>
                  </div>

                  {collaboratorShift.shift_time && (
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Horário de Trabalho
                      </span>
                      <span className="px-3 py-1.5 bg-blue-500/20 border border-blue-400/40 text-blue-200 text-sm font-black rounded-lg">
                        {collaboratorShift.shift_time}
                      </span>
                    </div>
                  )}
                </div>

                {/* Grid com Base, Função e Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#051322] border border-[#1e3a56] rounded-xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sky-400" /> Base / Região
                    </span>
                    <span className="text-base font-bold text-sky-400">
                      {collaboratorShift.region_name || 'Matriz / Geral'}
                    </span>
                  </div>

                  <div className="bg-[#051322] border border-[#1e3a56] rounded-xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-300" /> Função / Tipo
                    </span>
                    <span className="text-base font-bold text-white">
                      {collaboratorShift.operator_type || 'Operador'}
                    </span>
                  </div>

                  <div className="bg-[#051322] border border-[#1e3a56] rounded-xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Status
                    </span>
                    <span className="text-base font-bold text-emerald-400">
                      {collaboratorShift.status || 'Confirmado'}
                    </span>
                  </div>
                </div>

                {/* Instruções se houver */}
                {collaboratorShift.notes && (
                  <div className="bg-[#051322] border border-[#1e3a56] rounded-xl p-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      📋 Instruções da Gestão:
                    </span>
                    <p className="text-sm text-slate-200 font-medium">
                      {collaboratorShift.notes}
                    </p>
                  </div>
                )}

                {/* Rodapé interno com confirmação */}
                <div className="pt-4 border-t border-slate-800/90 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Check className="w-4 h-4" /> Escala confirmada e enviada pela gestão
                  </span>
                  <span>Enviado via CR Task</span>
                </div>
              </div>
            ) : (
              /* AVISO DE "AINDA NÃO FOI POSTADO" (SEGUINDO O FLUXO DO QUADRO DE TURNOS) */
              <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mb-2">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>
                <span className="px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-widest">
                  ⏳ Escala Operacional
                </span>
                <h3 className="text-2xl font-black text-white uppercase tracking-wider mt-1">
                  Ainda não foi postado
                </h3>
                <p className="text-sm text-slate-400 font-medium max-w-md">
                  A escala operacional para esta data ainda não foi publicada pelo líder do setor.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    setSelectedDate(todayStr);
                    setCalendarMonth(new Date(`${todayStr}T00:00:00`));
                  }}
                  className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Verificar data de Hoje
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800">
      
      {/* TOOLBAR SUPERIOR DA ESCALA */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm z-10">
        
        {/* Título & Seleção de Data */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm tracking-wider border border-blue-500/30 shrink-0">
              CR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Escala Operacional</h2>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
                  {shiftsForSelectedDate.length} {shiftsForSelectedDate.length === 1 ? 'Escala' : 'Escalas'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Planejamento, alocação e envio de escalas para a equipe em tempo real.
              </p>
            </div>
          </div>

          {/* Navegador de Data */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-1 text-xs">
            <button onClick={() => changeDate(-1)} className="p-1.5 hover:bg-white rounded transition-colors text-slate-600">
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1.5 px-3 font-semibold text-slate-700 capitalize">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>{formattedSelectedDateText}</span>
            </div>

            <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-white rounded transition-colors text-slate-600">
              <ChevronRight className="w-4 h-4" />
            </button>

            <button 
              onClick={() => {
                const todayStr = new Date().toISOString().split('T')[0];
                setSelectedDate(todayStr);
                setCalendarMonth(new Date(`${todayStr}T00:00:00`));
              }} 
              className="ml-1 px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 font-medium rounded text-[11px] shadow-xs border border-slate-200 transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>

        {/* Botões de Ação e Alternância de Visão */}
        <div className="flex items-center gap-3">
          
          {/* Botão Mandar Escala do Dia para os Colaboradores */}
          {canManageShifts && (
            <button
              onClick={handleSendAllDayShifts}
              disabled={isSendingShift || shiftsForSelectedDate.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Disparar aviso e e-mail com a escala do dia para todos os colaboradores alocados"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingShift ? 'Enviando...' : `Mandar Escala (${shiftsForSelectedDate.length})`}</span>
            </button>
          )}

          {/* Botão Configurações da Escala (Para Líderes / Admins) */}
          {canManageShifts && (
            <>
              <button
                onClick={handleOpenSettings}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
                title="Configurar Turnos, Bases e Status do Setor"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>Opções de Escala</span>
              </button>

              <button
                onClick={() => {
                  setBulkStartDate(selectedDate);
                  setBulkEndDate(selectedDate);
                  setIsBulkDeleteOpen(true);
                }}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-rose-200 transition-colors cursor-pointer"
                title="Excluir escalas em lote por período ou dia"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Limpar em Lote</span>
              </button>
            </>
          )}

          {/* Selector de Modo de Visualização */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewTab('quadro')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewTab === 'quadro' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Quadro</span>
            </button>

            <button
              onClick={() => setViewTab('lista')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewTab === 'lista' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>

            <button
              onClick={() => setViewTab('timeline')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewTab === 'timeline' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>

            <button
              onClick={() => setViewTab('calendario')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewTab === 'calendario' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Calendário</span>
            </button>

            {onSwitchToTurnos && (
              <button
                onClick={onSwitchToTurnos}
                className="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-2xs ml-1"
                title="Abrir o Quadro de Turnos Mensal do Setor"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Quadro de Turnos Mensal</span>
              </button>
            )}
          </div>

          {/* Botão de Lançar Escala */}
          {canManageShifts && (
            <button
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Escalar Operadores</span>
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS SECUNDÁRIA */}
      <div className="bg-white border-b border-slate-200 px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[240px] max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por colaborador, região ou turno..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro Turno */}
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todos os Turnos</option>
            {availableShifts.map((s: any) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>

          {/* Filtro Região */}
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todas as regiões</option>
            {availableRegions.map((r: string) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Filtro Tipo */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todos os tipos</option>
            {availableTypes.map((t: string) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Filtro Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todos os status</option>
            {availableStatuses.map((st: string) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          {/* Toggle Vagas */}
          <button
            onClick={() => setOnlyVacancies(!onlyVacancies)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              onlyVacancies 
                ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold' 
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Mostrar apenas vagas
          </button>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 overflow-auto p-8">
        
        {/* VISÃO 1: QUADRO (CARDS MATRICIAIS POR TURNO COM TAGS MÚLTIPLAS CLEAN) */}
        {viewTab === 'quadro' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {availableShifts.map((shiftDef: any) => {
              const shiftItems = shiftsForSelectedDate.filter((s: any) => s.shift_name === shiftDef.name);

              return (
                <div key={shiftDef.name} className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  
                  {/* Cabeçalho do Turno */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs shrink-0">
                        {renderShiftIcon(shiftDef.name)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm tracking-wide">{shiftDef.name}</h3>
                        <p className="text-[11px] text-slate-500 font-medium">{shiftDef.time}</p>
                      </div>
                    </div>
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                      {shiftItems.length}
                    </span>
                  </div>

                  {/* Lista de Escalas do Turno */}
                  <div className="p-4 flex flex-col gap-3 min-h-[300px]">
                    {shiftItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center my-auto py-12 text-slate-400 border border-dashed border-slate-200 rounded-lg">
                        <User className="w-8 h-8 mb-2 stroke-1 opacity-50" />
                        <span className="text-xs">Nenhuma escala neste turno.</span>
                      </div>
                    ) : (
                      shiftItems.map((item: any) => {
                        const avatarUrl = getUserAvatar(item.operator_user_id, item.operator_name);
                        const regionTags = (item.region_name || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                        const typeTags = (item.operator_type || '').split(',').map((s: string) => s.trim()).filter(Boolean);

                        return (
                          <div 
                            key={item.id}
                            onClick={() => setSelectedShiftDetails(item)}
                            className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-300 rounded-lg transition-all cursor-pointer group shadow-2xs flex flex-col gap-2.5"
                          >
                            {/* Tags de Regiões/Bases e Tipos/Funções Unificadas */}
                            <div className="flex flex-col gap-1.5">
                              {/* Regiões / Bases */}
                              <div className="flex items-center gap-1 flex-wrap text-xs text-slate-600 font-semibold">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {regionTags.map((reg: string, rIdx: number) => (
                                  <span key={rIdx} className="px-1.5 py-0.5 bg-slate-200/70 text-slate-800 font-bold rounded text-[10px] border border-slate-300/50">
                                    {reg}
                                  </span>
                                ))}
                              </div>

                              {/* Tipos / Funções */}
                              {typeTags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap pl-5">
                                  {typeTags.map((tp: string, tIdx: number) => (
                                    <span key={tIdx} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                      {tp}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Informações do Operador e Status */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                              <div className="flex items-center gap-2.5">
                                {avatarUrl ? (
                                  <img 
                                    src={avatarUrl} 
                                    alt={item.operator_name} 
                                    className="w-8 h-8 rounded-full object-cover border border-slate-300 shadow-xs" 
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                    {getInitials(item.operator_name)}
                                  </div>
                                )}
                                <div>
                                  <span className="font-bold text-slate-800 text-xs block group-hover:text-blue-600 transition-colors">
                                    {item.operator_name}
                                  </span>
                                  {item.notes && (
                                    <span className="text-[11px] text-slate-500 line-clamp-1 flex items-center gap-1 mt-0.5">
                                      <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                                      {item.notes}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendShiftToCollaborator(item);
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Mandar Escala para o Colaborador (E-mail e Notificação)"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyWhatsAppShift(item);
                                  }}
                                  className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                  title="Copiar para WhatsApp"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusBadgeClass(item.status)}`}>
                                  {item.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* VISÃO 2: LISTA (TABELA CLEAN COM MULTI-SELEÇÃO E TAGS MÚLTIPLAS) */}
        {viewTab === 'lista' && (
          <div className="flex flex-col gap-3">
            {/* Barra de Ações em Lote para Seleções da Tabela */}
            {canManageShifts && selectedRowIds.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 px-4 py-2.5 rounded-lg flex items-center justify-between text-xs font-semibold text-rose-900 shadow-xs">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-rose-600" />
                  <span>{selectedRowIds.length} escala(s) selecionada(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedRowIds([])}
                    className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 rounded text-[11px] font-medium transition-colors"
                  >
                    Desmarcar Tudo
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja excluir as ${selectedRowIds.length} escalas selecionadas?`)) {
                        deleteSelectedRowsMutation.mutate(selectedRowIds);
                      }
                    }}
                    disabled={deleteSelectedRowsMutation.isPending}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Selecionadas</span>
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                    {canManageShifts && (
                      <th className="py-3 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={shiftsForSelectedDate.length > 0 && selectedRowIds.length === shiftsForSelectedDate.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRowIds(shiftsForSelectedDate.map((s: any) => s.id));
                            } else {
                              setSelectedRowIds([]);
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="py-3 px-4">Operador</th>
                    <th className="py-3 px-4">Turno</th>
                    <th className="py-3 px-4">Horário</th>
                    <th className="py-3 px-4">Regiões / Bases</th>
                    <th className="py-3 px-4">Funções / Tipos</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Observações / Tarefas</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shiftsForSelectedDate.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Nenhuma escala encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    shiftsForSelectedDate.map((item: any) => {
                      const avatarUrl = getUserAvatar(item.operator_user_id, item.operator_name);
                      const isRowSelected = selectedRowIds.includes(item.id);
                      const regionTags = (item.region_name || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                      const typeTags = (item.operator_type || '').split(',').map((s: string) => s.trim()).filter(Boolean);

                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => setSelectedShiftDetails(item)}
                          className={`transition-colors cursor-pointer ${isRowSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                        >
                          {canManageShifts && (
                            <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isRowSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRowIds([...selectedRowIds, item.id]);
                                  } else {
                                    setSelectedRowIds(selectedRowIds.filter(id => id !== item.id));
                                  }
                                }}
                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="py-3 px-4 font-bold text-slate-800">
                            <div className="flex items-center gap-2.5">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={item.operator_name} className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
                                  {getInitials(item.operator_name)}
                                </div>
                              )}
                              <span>{item.operator_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{item.shift_name}</td>
                          <td className="py-3 px-4 text-slate-500">{item.shift_time || '-'}</td>
                          <td className="py-3 px-4 font-medium text-slate-700">
                            <div className="flex items-center gap-1 flex-wrap">
                              {regionTags.map((reg: string, rIdx: number) => (
                                <span key={rIdx} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px] border border-slate-200">
                                  {reg}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 flex-wrap">
                              {typeTags.map((tp: string, tIdx: number) => (
                                <span key={tIdx} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold text-[10px] border border-blue-200">
                                  {tp}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              item.status === 'Confirmado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              item.status === 'Pendente' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-100 text-slate-700 border-slate-300'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                            {item.notes || '-'}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleSendShiftToCollaborator(item)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Mandar Escala para o Colaborador (E-mail e Notificação)"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyWhatsAppShift(item)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                title="Copiar para WhatsApp"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {canManageShifts && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("Deseja remover esta escala?")) {
                                      deleteShiftMutation.mutate(item.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                  title="Excluir Escala"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISÃO 3: TIMELINE (LINHA DO TEMPO CLEAN) */}
        {viewTab === 'timeline' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <span>Distribuição de Operadores por Turno ({formattedSelectedDateText})</span>
            </h3>

            <div className="flex flex-col gap-6">
              {availableShifts.map((shiftDef: any) => {
                const shiftItems = shiftsForSelectedDate.filter((s: any) => s.shift_name === shiftDef.name);

                return (
                  <div key={shiftDef.name} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>{shiftDef.name} ({shiftDef.time})</span>
                      <span className="text-slate-500 font-normal">{shiftItems.length} Operadores Alocados</span>
                    </div>

                    <div className="w-full bg-slate-100 h-12 rounded-lg border border-slate-200 p-1.5 flex items-center gap-2 overflow-x-auto">
                      {shiftItems.length === 0 ? (
                        <span className="text-xs text-slate-400 italic px-3">Nenhum operador alocado</span>
                      ) : (
                        shiftItems.map((item: any) => {
                          const avatarUrl = getUserAvatar(item.operator_user_id, item.operator_name);
                          
                          return (
                            <div 
                              key={item.id}
                              onClick={() => setSelectedShiftDetails(item)}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer hover:bg-blue-700 transition-colors shadow-xs"
                            >
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={item.operator_name} className="w-5 h-5 rounded-full object-cover border border-white/40" />
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-white/20 text-white font-bold text-[10px] flex items-center justify-center">
                                  {getInitials(item.operator_name)}
                                </span>
                              )}
                              <span>{item.operator_name}</span>
                              <span className="opacity-80 text-[10px] font-normal">({item.region_name})</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VISÃO 4: CALENDÁRIO MENSAL COMPLETO (Dias com Escalas no Geral) */}
        {viewTab === 'calendario' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            
            {/* Header de Navegação do Mês */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarRange className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-base capitalize">{monthYearLabel}</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const d = new Date(calendarMonth);
                    d.setMonth(d.getMonth() - 1);
                    setCalendarMonth(d);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Mês Anterior
                </button>

                <button
                  onClick={() => setCalendarMonth(new Date(`${new Date().toISOString().split('T')[0]}T00:00:00`))}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                >
                  Mês Atual
                </button>

                <button
                  onClick={() => {
                    const d = new Date(calendarMonth);
                    d.setMonth(d.getMonth() + 1);
                    setCalendarMonth(d);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Próximo Mês
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cabeçalho dos Dias da Semana */}
            <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200 text-center font-bold text-slate-600 text-[11px] uppercase tracking-wider py-2">
              <div>Dom</div>
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
            </div>

            {/* Grade de Dias do Mês */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-slate-100 min-h-[500px]">
              {calendarDaysMatrix.map((cell, idx) => {
                const dayShifts = shiftsByDateMap.get(cell.dateStr) || [];
                const isSelected = selectedDate === cell.dateStr;
                const isToday = new Date().toISOString().split('T')[0] === cell.dateStr;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDate(cell.dateStr);
                      setViewTab('quadro');
                    }}
                    className={`p-2 flex flex-col transition-all cursor-pointer min-h-[90px] relative group ${
                      cell.isCurrentMonth ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/60 text-slate-400'
                    } ${isSelected ? 'ring-2 ring-blue-600 z-10' : ''}`}
                  >
                    {/* Número do Dia */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                        isToday ? 'bg-blue-600 text-white shadow-xs' : (cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400')
                      }`}>
                        {cell.dayNum}
                      </span>

                      {/* Contador total de escalas no dia */}
                      {dayShifts.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-extrabold text-[10px] rounded-full border border-blue-200">
                          {dayShifts.length} {dayShifts.length === 1 ? 'escala' : 'escalas'}
                        </span>
                      )}
                    </div>

                    {/* Resumo de Operadores do Dia */}
                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                      {dayShifts.length > 0 ? (
                        <div className="flex flex-col gap-0.5 max-h-[70px] overflow-hidden">
                          {dayShifts.slice(0, 3).map((s: any) => (
                            <div 
                              key={s.id} 
                              className="text-[10px] bg-slate-100 group-hover:bg-white text-slate-700 px-1.5 py-0.5 rounded font-medium truncate flex items-center justify-between border border-slate-200/60"
                            >
                              <span className="truncate font-bold">{s.operator_name}</span>
                              <span className="text-[9px] text-slate-400 shrink-0">({s.shift_name})</span>
                            </div>
                          ))}
                          {dayShifts.length > 3 && (
                            <span className="text-[9px] text-blue-600 font-bold px-1 mt-0.5">
                              + {dayShifts.length - 3} mais...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 italic my-auto text-center hidden group-hover:block">
                          Sem escalas
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>

      {/* MODAL 1: LANÇAR ESCALA EM LOTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-6 shadow-xl flex flex-col gap-5 my-8">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-base">Escalar Operadores do Setor</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              
              {/* SEÇÃO 1: DATAS COM ATALHOS RÁPIDOS */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700">
                    1. Datas da Escala <span className="text-slate-400 font-normal">({formDates.length} dia(s) selecionado(s))</span>
                  </label>
                  {/* Atalhos Rápidos */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={setDatesSegSex}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded text-[10px] font-bold border border-slate-200 transition-colors cursor-pointer"
                      title="Selecionar Segunda a Sexta da semana atual"
                    >
                      Seg-Sex
                    </button>
                    <button
                      onClick={setDates7Dias}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded text-[10px] font-bold border border-slate-200 transition-colors cursor-pointer"
                      title="Selecionar os próximos 7 dias"
                    >
                      7 Dias
                    </button>
                    <button
                      onClick={setDatesMesInteiro}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded text-[10px] font-bold border border-slate-200 transition-colors cursor-pointer"
                      title="Selecionar todos os dias do mês"
                    >
                      Mês Inteiro
                    </button>
                    <button
                      onClick={() => setFormDates([selectedDate])}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 transition-colors cursor-pointer"
                      title="Limpar seleção"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !formDates.includes(val)) {
                        setFormDates([...formDates, val].sort());
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto">
                    {formDates.map(d => (
                      <span key={d} className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-full border border-blue-200 flex items-center gap-1 text-[11px]">
                        {d.split('-').reverse().slice(0,2).join('/')}
                        {formDates.length > 1 && (
                          <button onClick={() => toggleFormDate(d)} className="hover:text-rose-600">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: TURNO */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Turno</label>
                <select
                  value={formShiftName}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    setFormShiftName(selectedName);
                    const found = availableShifts.find((s: any) => s.name === selectedName);
                    if (found?.time) setFormShiftTime(found.time);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  {availableShifts.map((s: any) => (
                    <option key={s.name} value={s.name}>{s.name} ({s.time})</option>
                  ))}
                </select>
              </div>

              {/* SEÇÃO 3: SELEÇÃO MÚLTIPLA DE REGIÃO / BASE (COMBINADAS EM TAGS UNIFICADAS) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Região / Base <span className="text-slate-400 font-normal">(Selecione uma ou mais bases para atribuir)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-md">
                  {availableRegions.map((r: string) => {
                    const isSelected = formSelectedRegions.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleFormRegion(r)}
                        className={`px-3 py-1 rounded-full font-bold text-xs border transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{r}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SEÇÃO 4: COLABORADORES DO SETOR */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  2. Colaboradores do Setor <span className="text-slate-400 font-normal">(Marque as pessoas para lançar)</span>
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 bg-slate-50 rounded-md p-2 flex flex-col gap-1">
                  {(teamMembers || []).length === 0 ? (
                    <span className="text-xs text-slate-400 p-2 text-center">Nenhum colaborador encontrado no setor.</span>
                  ) : (
                    (teamMembers || []).map((p: any) => {
                      const isChecked = formSelectedPeople.includes(p.id);
                      const name = p.email.split('@')[0].toUpperCase();

                      return (
                        <label 
                          key={p.id}
                          className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                            isChecked ? 'bg-blue-50 border border-blue-200 text-blue-900 font-bold' : 'hover:bg-white text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt={name} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                                {getInitials(name)}
                              </div>
                            )}
                            <span>{name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({p.email})</span>
                          </div>

                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleFormPerson(p.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Ou Digitar Nome Manual */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ou Digite Nome Manual / Terceiro</label>
                <input
                  type="text"
                  placeholder="Nome do operador (caso não esteja no setor)..."
                  value={customOperatorName}
                  onChange={(e) => setCustomOperatorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* SEÇÃO 5: SELEÇÃO MÚLTIPLA DE TIPO DE OPERADOR */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Tipo de Operador / Função <span className="text-slate-400 font-normal">(Selecione uma ou mais funções para atribuir)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-md">
                  {availableTypes.map((t: string) => {
                    const isSelected = formSelectedTypes.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleFormType(t)}
                        className={`px-3 py-1 rounded-full font-bold text-xs border transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{t}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SEÇÃO 6: STATUS */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status da Escala</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {availableStatuses.map((st: string) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Observações e Tarefas */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Detalhamento de Tarefas / Instruções do Turno</label>
                <textarea
                  rows={2}
                  placeholder="Descreva as tarefas ou avisos importantes para este turno..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Notificar Operadores Automaticamente */}
              <label className="flex items-center gap-2.5 p-3 bg-blue-50/70 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                <input
                  type="checkbox"
                  checked={notifyOnSave}
                  onChange={(e) => setNotifyOnSave(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-blue-900">
                    Notificar colaboradores automaticamente no sistema
                  </span>
                  <span className="text-[11px] text-blue-700/80">
                    Dispara alerta para os operadores selecionados com os dados do turno e região.
                  </span>
                </div>
              </label>

            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => createBulkShifts.mutate()}
                disabled={createBulkShifts.isPending}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {createBulkShifts.isPending ? 'Gravando...' : 'Confirmar Lançamento'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: DETALHES DA ESCALA & COMENTÁRIOS / TAREFAS DO TURNO */}
      {selectedShiftDetails && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl flex flex-col gap-5 my-8">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                {getUserAvatar(selectedShiftDetails.operator_user_id, selectedShiftDetails.operator_name) ? (
                  <img 
                    src={getUserAvatar(selectedShiftDetails.operator_user_id, selectedShiftDetails.operator_name)!} 
                    alt={selectedShiftDetails.operator_name} 
                    className="w-10 h-10 rounded-full object-cover border border-slate-300 shadow-xs" 
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                    {getInitials(selectedShiftDetails.operator_name)}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-800 text-base">{selectedShiftDetails.operator_name}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedShiftDetails.shift_name} ({selectedShiftDetails.shift_time})
                  </p>
                </div>
              </div>

              <button onClick={() => setSelectedShiftDetails(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Detalhes Técnicos do Turno */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Regiões / Bases</span>
                <div className="flex flex-wrap gap-1">
                  {(selectedShiftDetails.region_name || '').split(',').map((r: string, idx: number) => (
                    <span key={idx} className="px-1.5 py-0.5 bg-slate-200 text-slate-800 font-bold text-[10px] rounded border border-slate-300">
                      {r.trim()}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Funções / Tipos</span>
                <div className="flex flex-wrap gap-1">
                  {(selectedShiftDetails.operator_type || '').split(',').map((t: string, idx: number) => (
                    <span key={idx} className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold text-[10px] rounded-full border border-blue-200">
                      {t.trim()}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Status / Data</span>
                <span className="font-bold text-blue-700 block mt-0.5">{selectedShiftDetails.status}</span>
                <span className="text-[11px] text-slate-600 font-medium block">{selectedShiftDetails.shift_date}</span>
              </div>
            </div>

            {/* Instruções / Tarefas */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Tarefas e Instruções do Turno
              </span>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
                {selectedShiftDetails.notes || 'Nenhuma instrução específica informada.'}
              </div>
            </div>

            {/* SEÇÃO DE COMENTÁRIOS DA ESCALA */}
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                Comentários e Atualizações ({shiftComments?.length || 0})
              </span>

              {/* Lista de Comentários */}
              <div className="max-h-48 overflow-y-auto flex flex-col gap-2.5 p-1">
                {(shiftComments || []).length === 0 ? (
                  <span className="text-xs text-slate-400 italic text-center py-4">Nenhum comentário cadastrado ainda.</span>
                ) : (
                  shiftComments?.map((c: any) => (
                    <div key={c.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {c.user_avatar ? (
                            <img src={c.user_avatar} alt={c.user_name} className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                              {getInitials(c.user_name)}
                            </div>
                          )}
                          <span className="font-bold text-slate-800">{c.user_name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-700 pl-6">{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Campo de Enviar Novo Comentário */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Escreva um comentário ou atualização sobre a tarefa..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      addCommentMutation.mutate();
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => addCommentMutation.mutate()}
                  disabled={addCommentMutation.isPending || !newCommentText.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {canManageShifts && (
                  <button
                    onClick={() => {
                      if (confirm("Remover esta escala do dia?")) {
                        deleteShiftMutation.mutate(selectedShiftDetails.id);
                      }
                    }}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyWhatsAppShift(selectedShiftDetails)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Copiar texto da escala formatado para o WhatsApp"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendShiftToCollaborator(selectedShiftDetails)}
                  disabled={isSendingShift}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="Enviar escala por e-mail e notificação no CR Task para este colaborador"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingShift ? 'Enviando...' : 'Mandar p/ Colaborador'}</span>
                </button>

                <button
                  onClick={() => setSelectedShiftDetails(null)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer ml-1 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: CONFIGURAR OPÇÕES DE ESCALA DO SETOR */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl flex flex-col gap-5 my-8">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-base">Configurações de Escala do Setor</h3>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-5 text-xs max-h-[70vh] overflow-y-auto pr-1">
              
              {/* Turnos Fixos */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Turnos do Setor</label>
                <div className="flex flex-col gap-2 mb-2">
                  {settingsShifts.map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-md">
                      <div className="font-bold text-slate-800">{s.name} <span className="font-normal text-slate-500">({s.time})</span></div>
                      <button
                        onClick={() => setSettingsShifts(settingsShifts.filter((_: any, i: number) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome (Ex: MANHÃ)"
                    value={newShiftName}
                    onChange={(e) => setNewShiftName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="Horário (Ex: 08:00 - 12:00)"
                    value={newShiftTime}
                    onChange={(e) => setNewShiftTime(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                  />
                  <button
                    onClick={() => {
                      if (newShiftName.trim()) {
                        setSettingsShifts([...settingsShifts, { name: newShiftName.trim().toUpperCase(), time: newShiftTime.trim() || '08:00 - 18:00' }]);
                        setNewShiftName('');
                        setNewShiftTime('');
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Regiões / Bases Fixas */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Bases / Regiões Operacionais</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {settingsRegions.map((r: string, idx: number) => (
                    <span key={idx} className="px-2.5 py-1 bg-slate-100 border border-slate-200 font-bold rounded-full text-slate-700 flex items-center gap-1">
                      {r}
                      <button onClick={() => setSettingsRegions(settingsRegions.filter((_: string, i: number) => i !== idx))} className="hover:text-rose-600 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nova Base/Região (Ex: Matriz, SÃO PAULO)..."
                    value={newRegionText}
                    onChange={(e) => setNewRegionText(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                  />
                  <button
                    onClick={() => {
                      if (newRegionText.trim() && !settingsRegions.includes(newRegionText.trim())) {
                        setSettingsRegions([...settingsRegions, newRegionText.trim()]);
                        setNewRegionText('');
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Tipos de Operador */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Tipos de Operador / Funções</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {settingsTypes.map((t: string, idx: number) => (
                    <span key={idx} className="px-2.5 py-1 bg-slate-100 border border-slate-200 font-bold rounded-full text-slate-700 flex items-center gap-1">
                      {t}
                      <button onClick={() => setSettingsTypes(settingsTypes.filter((_: string, i: number) => i !== idx))} className="hover:text-rose-600 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Novo tipo (Ex: LOGAR, Dedicado)..."
                    value={newTypeText}
                    onChange={(e) => setNewTypeText(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                  />
                  <button
                    onClick={() => {
                      if (newTypeText.trim() && !settingsTypes.includes(newTypeText.trim())) {
                        setSettingsTypes([...settingsTypes, newTypeText.trim()]);
                        setNewTypeText('');
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Status Personalizados da Escala */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Status da Escala</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {settingsStatuses.map((st: string, idx: number) => (
                    <span key={idx} className="px-2.5 py-1 bg-blue-50 border border-blue-200 font-bold rounded-full text-blue-800 flex items-center gap-1">
                      {st}
                      <button onClick={() => setSettingsStatuses(settingsStatuses.filter((_: string, i: number) => i !== idx))} className="hover:text-rose-600 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Novo status (Ex: Confirmado, Aguardando)..."
                    value={newStatusText}
                    onChange={(e) => setNewStatusText(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                  />
                  <button
                    onClick={() => {
                      if (newStatusText.trim() && !settingsStatuses.includes(newStatusText.trim())) {
                        setSettingsStatuses([...settingsStatuses, newStatusText.trim()]);
                        setNewStatusText('');
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => saveSettingsMutation.mutate()}
                disabled={saveSettingsMutation.isPending}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer"
              >
                {saveSettingsMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: LIMPEZA / REMOÇÃO EM LOTE */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl border border-rose-200 max-w-lg w-full p-6 shadow-xl flex flex-col gap-5 my-8">
            
            <div className="flex justify-between items-center border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-800 text-base">Limpar / Excluir Escalas em Lote</h3>
              </div>
              <button onClick={() => setIsBulkDeleteOpen(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              <p className="text-slate-600">
                Selecione o critério para remover escalas cadastradas no setor de uma só vez:
              </p>

              {/* Modo de Exclusão */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Escopo de Exclusão</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkDeleteMode('single_day')}
                    className={`p-2.5 rounded-lg border text-left font-bold transition-all cursor-pointer ${
                      bulkDeleteMode === 'single_day'
                        ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>Dia Único</span>
                    <span className="block font-normal text-[11px] text-slate-500 mt-0.5">Excluir escalas do dia {bulkStartDate.split('-').reverse().join('/')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBulkDeleteMode('date_range')}
                    className={`p-2.5 rounded-lg border text-left font-bold transition-all cursor-pointer ${
                      bulkDeleteMode === 'date_range'
                        ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>Período de Datas</span>
                    <span className="block font-normal text-[11px] text-slate-500 mt-0.5">Excluir de uma data inicial a final</span>
                  </button>
                </div>
              </div>

              {/* Intervalo de Datas */}
              {bulkDeleteMode === 'single_day' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data a Limpar</label>
                  <input
                    type="date"
                    value={bulkStartDate}
                    onChange={(e) => {
                      setBulkStartDate(e.target.value);
                      setBulkEndDate(e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Data Inicial</label>
                    <input
                      type="date"
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Data Final</label>
                    <input
                      type="date"
                      value={bulkEndDate}
                      onChange={(e) => setBulkEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Filtros Opcionais */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Colaborador Especifico (Opcional)</label>
                  <select
                    value={bulkFilterOperator}
                    onChange={(e) => setBulkFilterOperator(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                  >
                    <option value="all">Todos os colaboradores</option>
                    {(teamMembers || []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.email.split('@')[0].toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Região / Base Específica (Opcional)</label>
                  <select
                    value={bulkFilterRegion}
                    onChange={(e) => setBulkFilterRegion(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                  >
                    <option value="all">Todas as regiões</option>
                    {availableRegions.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>Atenção:</strong> Esta ação removerá permanentemente as escalas que se enquadrem no período e filtros selecionados.</span>
              </div>

            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsBulkDeleteOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (confirm("Confirma a exclusão em lote das escalas selecionadas?")) {
                    bulkDeleteMutation.mutate();
                  }
                }}
                disabled={bulkDeleteMutation.isPending}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{bulkDeleteMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Toast Feedback de Notificação / Envio de Escala */}
      {sendFeedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{sendFeedbackMsg}</span>
          <button onClick={() => setSendFeedbackMsg(null)} className="ml-2 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
}
