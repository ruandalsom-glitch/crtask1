'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, Search, Filter, 
  Trash2, Edit, User, MapPin, Clock, CheckCircle2, AlertCircle, 
  HelpCircle, UserCheck, LayoutGrid, List, BarChart2, X, PlusCircle, Check,
  Settings, MessageSquare, Send, Layers, Sparkles, CalendarDays, RefreshCw
} from 'lucide-react';

const SHIFTS_DEFAULT = [
  { id: 'm', name: 'MANHÃ', time: '08:00 - 12:00', icon: '☀️', color: 'sky' },
  { id: 't', name: 'TARDE', time: '12:00 - 18:00', icon: '🌤️', color: 'amber' },
  { id: 'n', name: 'NOITE', time: '18:00 - 23:00', icon: '🌙', color: 'indigo' },
];

const REGIONS_DEFAULT = ['Matriz', 'Aldeota', 'Barra', 'Campo'];
const TYPES_DEFAULT = ['Dedicado', 'Apoio', 'Nuvem'];
const STATUSES_DEFAULT = ['Confirmado', 'Pendente', 'Vaga'];

export function BoardShiftView({ boardId, isReadOnly }: { boardId: string; isReadOnly?: boolean }) {
  const queryClient = useQueryClient();

  // Data Selecionada (Padrão: Hoje)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Modo de Visão: Quadro (Cards), Lista (Tabela), Timeline (Linha do tempo)
  const [viewTab, setViewTab] = useState<'quadro' | 'lista' | 'timeline'>('quadro');

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
  const [selectedShiftDetails, setSelectedShiftDetails] = useState<any | null>(null);
  const [editingShift, setEditingShift] = useState<any | null>(null);

  // Comentários do Modal de Detalhes
  const [newCommentText, setNewCommentText] = useState('');

  // 1. Busca dados do Usuário Atual
  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return { ...user, profile };
    }
  });

  // 2. Busca o workspace_id do quadro
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
    queryKey: ['sector_members_for_shift', boardData?.workspace_id],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, email, avatar_url, role').order('email');
      if (!profiles) return [];
      if (!boardData?.workspace_id) return profiles;

      const { data: members } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', boardData.workspace_id);
      const memberUserIds = new Set((members || []).map((m: any) => m.user_id));

      // Retorna administradores e membros pertencentes ao setor
      return profiles.filter(p => p.role === 'admin' || memberUserIds.has(p.id));
    },
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
    }
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

  // Permissão de Gerenciamento: Apenas LÍDER de setor (role === 'leader') e ADMINISTRADOR (role === 'admin') podem alterar configurações e escalas.
  const canManageShifts = useMemo(() => {
    const role = currentUser?.profile?.role;
    const isLeaderOrAdmin = role === 'admin' || role === 'leader';
    return isLeaderOrAdmin && !isReadOnly;
  }, [currentUser, isReadOnly]);

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
      const { error } = await supabase
        .from('operational_shift_settings')
        .upsert({
          board_id: boardId,
          workspace_id: boardData?.workspace_id || null,
          shifts: settingsShifts,
          regions: settingsRegions,
          operator_types: settingsTypes,
          statuses: settingsStatuses,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shift_settings'] });
      setIsSettingsOpen(false);
    },
    onError: (err: any) => {
      alert("Erro ao salvar configurações da escala: " + err.message);
    }
  });

  // 5. Busca as Escalas do Banco de Dados (Busca por Workspace ou por Board para compartilhar com o setor)
  const { data: rawShifts, isLoading: isLoadingShifts } = useQuery({
    queryKey: ['operational_shifts', boardId, boardData?.workspace_id, selectedDate],
    queryFn: async () => {
      let query = supabase.from('operational_shifts').select('*');

      if (boardData?.workspace_id) {
        query = query.or(`workspace_id.eq.${boardData.workspace_id},board_id.eq.${boardId}`);
      } else {
        query = query.eq('board_id', boardId);
      }

      const { data, error } = await query
        .order('shift_name')
        .order('region_name');

      if (error) {
        console.warn("Tabela operational_shifts pode não existir ainda:", error);
        return [];
      }
      return data || [];
    }
  });

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

  // Navegação de Datas
  const changeDate = (days: number) => {
    const current = new Date(`${selectedDate}T00:00:00`);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
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

  // Filtra as escalas conforme os critérios da tela
  const shiftsForSelectedDate = useMemo(() => {
    return (rawShifts || []).filter((shift: any) => {
      if (shift.shift_date !== selectedDate) return false;
      if (filterShift !== 'all' && shift.shift_name !== filterShift) return false;
      if (filterRegion !== 'all' && shift.region_name !== filterRegion) return false;
      if (filterType !== 'all' && shift.operator_type !== filterType) return false;
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
    const dayOfWeek = base.getDay(); // 0: Dom, 1: Seg, ..., 6: Sáb
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

  // Salvar / Criar Escalas em Lote (Suporta Múltiplas Datas, Pessoas, Regiões e Tipos)
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

      const rowsToInsert = [];
      for (const d of formDates) {
        for (const reg of formSelectedRegions) {
          for (const tp of formSelectedTypes) {
            for (const p of peopleToInsert) {
              rowsToInsert.push({
                board_id: boardId,
                workspace_id: boardData?.workspace_id || null,
                shift_date: d,
                shift_name: formShiftName,
                shift_time: formShiftTime,
                region_name: reg,
                operator_user_id: p.userId,
                operator_name: p.name,
                operator_type: tp,
                status: formStatus,
                notes: formNotes,
                created_by: currentUser?.id || null
              });
            }
          }
        }
      }

      const { error } = await supabase.from('operational_shifts').insert(rowsToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert("Erro ao lançar escala: " + err.message);
    }
  });

  // Excluir Escala
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

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800">
      
      {/* TOOLBAR SUPERIOR DA ESCALA (Design Claro Clean) */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm z-10">
        
        {/* Título & Seleção de Data */}
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Escala Operacional</h2>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                {shiftsForSelectedDate.length} Escalas
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Planejamento e alocação de equipes por turno e região em tempo real.
            </p>
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
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} 
              className="ml-1 px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 font-medium rounded text-[11px] shadow-xs border border-slate-200 transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>

        {/* Botões de Ação e Alternância de Visão */}
        <div className="flex items-center gap-3">
          
          {/* Botão Configurações da Escala (Para Líderes / Admins) */}
          {canManageShifts && (
            <button
              onClick={handleOpenSettings}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
              title="Configurar Turnos, Bases e Status do Setor"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Opções de Escala</span>
            </button>
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
        
        {/* VISÃO 1: QUADRO (CARDS MATRICIAIS POR TURNO) */}
        {viewTab === 'quadro' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {availableShifts.map((shiftDef: any) => {
              const shiftItems = shiftsForSelectedDate.filter((s: any) => s.shift_name === shiftDef.name);

              return (
                <div key={shiftDef.name} className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  
                  {/* Cabeçalho do Turno */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-xl">{shiftDef.icon || '⏱️'}</div>
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
                        
                        return (
                          <div 
                            key={item.id}
                            onClick={() => setSelectedShiftDetails(item)}
                            className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-300 rounded-lg transition-all cursor-pointer group shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{item.region_name}</span>
                              </div>
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                {item.operator_type}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                {/* Foto de Perfil ou Iniciais */}
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

                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                item.status === 'Confirmado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                item.status === 'Pendente' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-slate-100 text-slate-700 border-slate-300'
                              }`}>
                                {item.status}
                              </span>
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

        {/* VISÃO 2: LISTA (TABELA CLEAN) */}
        {viewTab === 'lista' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Operador</th>
                  <th className="py-3 px-4">Turno</th>
                  <th className="py-3 px-4">Horário</th>
                  <th className="py-3 px-4">Região / Base</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Observações / Tarefas</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shiftsForSelectedDate.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Nenhuma escala encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  shiftsForSelectedDate.map((item: any) => {
                    const avatarUrl = getUserAvatar(item.operator_user_id, item.operator_name);

                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => setSelectedShiftDetails(item)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
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
                        <td className="py-3 px-4 font-medium text-slate-700">{item.region_name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                            {item.operator_type}
                          </span>
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
                        <td className="py-3 px-4 text-right">
                          {canManageShifts && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Deseja remover esta escala?")) {
                                  deleteShiftMutation.mutate(item.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Excluir Escala"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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

      </div>

      {/* MODAL 1: LANÇAR ESCALA EM LOTE (Múltiplas Datas, Pessoas, Regiões e Tipos) */}
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

              {/* SEÇÃO 3: SELEÇÃO MÚLTIPLA DE REGIÃO / BASE */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Região / Base <span className="text-slate-400 font-normal">(Selecione uma ou mais bases)</span>
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
                  Tipo de Operador / Função <span className="text-slate-400 font-normal">(Selecione uma ou mais funções)</span>
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
                    {selectedShiftDetails.shift_name} ({selectedShiftDetails.shift_time}) - {selectedShiftDetails.region_name}
                  </p>
                </div>
              </div>

              <button onClick={() => setSelectedShiftDetails(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Detalhes Técnicos do Turno */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tipo</span>
                <span className="font-semibold text-slate-800">{selectedShiftDetails.operator_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                <span className="font-bold text-blue-700">{selectedShiftDetails.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Data</span>
                <span className="font-semibold text-slate-800">{selectedShiftDetails.shift_date}</span>
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

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              {canManageShifts ? (
                <button
                  onClick={() => {
                    if (confirm("Remover esta escala do dia?")) {
                      deleteShiftMutation.mutate(selectedShiftDetails.id);
                    }
                  }}
                  className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Escala
                </button>
              ) : <div />}

              <button
                onClick={() => setSelectedShiftDetails(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: CONFIGURAR OPÇÕES DE ESCALA DO SETOR (Turnos, Bases e Status Fixos) */}
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

    </div>
  );
}
