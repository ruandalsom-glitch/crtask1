'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, Search, Filter, 
  Trash2, Edit, User, Clock, Check, CheckCircle2, X, Layers, 
  CalendarDays, RefreshCw, Download, Sparkles, Settings, Users, 
  BarChart2, LayoutGrid, List, CalendarRange, AlertCircle, Eye, 
  Share2, Copy, UserPlus, FileSpreadsheet, TrendingUp, Sun, Moon, 
  Coffee, Briefcase, Zap, Info, ShieldAlert, Award, FileText
} from 'lucide-react';

// Definição dos tipos de status com cores idênticas à planilha de referência
export interface StatusDefinition {
  code: string;
  label: string;
  shortLabel: string;
  bgClass: string;
  textClass: string;
  borderClass?: string;
  isCustomTime?: boolean;
  category: 'work' | 'off' | 'vacation' | 'medical' | 'remote' | 'special' | 'inactive';
}

export const ROSTER_STATUSES: Record<string, StatusDefinition> = {
  PRESENCA: {
    code: 'PRESENCA',
    label: 'Presença / Trabalhando',
    shortLabel: '✓',
    bgClass: 'bg-[#c6efce]',
    textClass: 'text-[#006100]',
    borderClass: 'border-[#a8e4b3]',
    category: 'work'
  },
  FG: {
    code: 'FG',
    label: 'Folga da Escala',
    shortLabel: 'FG',
    bgClass: 'bg-[#2d7d32]',
    textClass: 'text-white',
    category: 'off'
  },
  DOM: {
    code: 'DOM',
    label: 'Folga Domingo / Plantão',
    shortLabel: 'DOM',
    bgClass: 'bg-[#7b1fa2]',
    textClass: 'text-white',
    category: 'off'
  },
  FERIAS: {
    code: 'FERIAS',
    label: 'Férias',
    shortLabel: 'FÉRIAS',
    bgClass: 'bg-[#f57c00]',
    textClass: 'text-white',
    category: 'vacation'
  },
  DOFF: {
    code: 'DOFF',
    label: 'Day Off (Folga Especial)',
    shortLabel: 'DOFF',
    bgClass: 'bg-[#d81b60]',
    textClass: 'text-white',
    category: 'off'
  },
  FJ: {
    code: 'FJ',
    label: 'Folga Justificada',
    shortLabel: 'FJ',
    bgClass: 'bg-[#00838f]',
    textClass: 'text-white',
    category: 'off'
  },
  AT: {
    code: 'AT',
    label: 'Atestado Médico',
    shortLabel: 'AT',
    bgClass: 'bg-[#0288d1]',
    textClass: 'text-white',
    category: 'medical'
  },
  HOME: {
    code: 'HOME',
    label: 'Home Office / Teletrabalho',
    shortLabel: 'HOME',
    bgClass: 'bg-[#f8bbd0]',
    textClass: 'text-[#880e4f]',
    borderClass: 'border-[#f48fb1]',
    category: 'remote'
  },
  HORARIO: {
    code: 'HORARIO',
    label: 'Horário / Atraso / Extra',
    shortLabel: '00:00',
    bgClass: 'bg-[#d32f2f]',
    textClass: 'text-white',
    isCustomTime: true,
    category: 'special'
  },
  FALTA: {
    code: 'FALTA',
    label: 'Falta Injustificada',
    shortLabel: 'F',
    bgClass: 'bg-[#c62828]',
    textClass: 'text-white',
    category: 'special'
  },
  INATIVO: {
    code: 'INATIVO',
    label: 'Fora da Escala / Inativo',
    shortLabel: 'x',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-200',
    category: 'inactive'
  }
};

export interface TurnoGroup {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  members: string[];
}

// Turnos e Colaboradores Padrão (Baseados na planilha real enviada)
const DEFAULT_TURNO_GROUPS: TurnoGroup[] = [
  {
    id: 'admin',
    name: 'Administração',
    color: 'emerald',
    icon: 'Briefcase',
    members: [
      'Kelly Bezerra',
      'Fabiano de Jesus',
      'Raquel Nunes',
      'Aris Iorondi',
      'Ruan Dalsom',
      'Samuel Damazio',
      'Vitor Enrique'
    ]
  },
  {
    id: 'manha',
    name: 'Manhã',
    color: 'sky',
    icon: 'Sun',
    members: [
      'Davis Marques',
      'Athalya Ferreira',
      'Igor Silva',
      'Thaisa Camila'
    ]
  },
  {
    id: 'intermedio',
    name: 'Intermédio',
    color: 'amber',
    icon: 'Coffee',
    members: [
      'Fernanda Ribeiro',
      'Felipe Santana',
      'Juan Ferreira'
    ]
  },
  {
    id: 'tarde',
    name: 'Tarde',
    color: 'orange',
    icon: 'Sun',
    members: [
      'Pedro Luiz Souza',
      'Ronald Santos Silva',
      'Jéssica Alves Batista'
    ]
  },
  {
    id: 'madrugada',
    name: 'Madrugada',
    color: 'indigo',
    icon: 'Moon',
    members: [
      'Waldinei Macário',
      'Arieli do Carmo da Silva Cruz'
    ]
  }
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez'
];

const DOW_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function BoardMonthlyRosterView({ boardId, isReadOnly }: { boardId: string; isReadOnly?: boolean }) {
  const queryClient = useQueryClient();

  // Mês e Ano Selecionado (Padrão: Hoje)
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => new Date());
  
  // Abas de Visualização: Matriz (Planilha), Calendário Tradicional, Cards da Equipe, Métricas/Dashboard
  const [activeViewMode, setActiveViewMode] = useState<'matriz' | 'calendario' | 'cards' | 'dashboard'>('matriz');

  // Filtros
  const [searchMember, setSearchMember] = useState('');
  const [filterTurno, setFilterTurno] = useState('all');
  const [filterStatusCode, setFilterStatusCode] = useState('all');

  // Modais e Popovers
  const [isBulkPeriodOpen, setIsBulkPeriodOpen] = useState(false);
  const [isManageTeamsOpen, setIsManageTeamsOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  // Popover de Edição de Célula Ativa
  const [activeCellPopover, setActiveCellPopover] = useState<{
    dateStr: string;
    operatorName: string;
    shiftName: string;
    anchorRect: DOMRect | null;
    currentCode: string;
    currentTimeText: string;
  } | null>(null);

  // Estados para Lançamento em Lote (ex: Férias de 15 dias)
  const [bulkMember, setBulkMember] = useState('');
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [bulkStatusCode, setBulkStatusCode] = useState('FERIAS');
  const [bulkCustomTime, setBulkCustomTime] = useState('');
  const [bulkTargetTurno, setBulkTargetTurno] = useState('all');

  // Estados para Gestão de Colaboradores e Turnos
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberTurno, setNewMemberTurno] = useState('Administração');
  const [newTurnoName, setNewTurnoName] = useState('');

  // Ano e Mês Calculados
  const currentYear = selectedMonthDate.getFullYear();
  const currentMonthIndex = selectedMonthDate.getMonth(); // 0 a 11
  const daysInCurrentMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();

  // Limites do Mês para Consulta SQL
  const startOfMonthStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-01`;
  const endOfMonthStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(daysInCurrentMonth).padStart(2, '0')}`;

  // 1. Busca Usuário Atual e Perfil para Permissões
  const { data: currentUser } = useQuery({
    queryKey: ['current_user_roster'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase.from('profiles').select('id, email, role').eq('id', user.id).maybeSingle();
      return { ...user, profile };
    },
    staleTime: 5 * 60 * 1000
  });

  // 2. Busca Workspace do Quadro
  const { data: boardData } = useQuery({
    queryKey: ['board_workspace_roster', boardId],
    queryFn: async () => {
      const { data } = await supabase.from('boards').select('workspace_id, name').eq('id', boardId).single();
      return data;
    },
    staleTime: 10 * 60 * 1000
  });

  // 3. Busca Membros do Workspace / Setor
  const { data: sectorProfiles } = useQuery({
    queryKey: ['sector_profiles_roster', boardData?.workspace_id],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, email, role').order('email');
      return profiles || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // Permissão de Gerenciamento (Líderes e Administradores)
  const canManageRoster = useMemo(() => {
    if (isReadOnly) return false;
    const role = (currentUser?.profile?.role || '').toLowerCase().trim();
    return role === 'admin' || role === 'administrador' || role === 'leader' || role === 'lider' || role === 'líder';
  }, [currentUser, isReadOnly]);

  // 4. Configurações dos Turnos e Colaboradores Salvas no Banco
  const { data: rosterSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['operational_shift_settings_roster', boardId, boardData?.workspace_id],
    queryFn: async () => {
      let query = supabase.from('operational_shift_settings').select('*');
      if (boardData?.workspace_id) {
        query = query.or(`workspace_id.eq.${boardData.workspace_id},board_id.eq.${boardId}`);
      } else {
        query = query.eq('board_id', boardId);
      }
      const { data } = await query.limit(1).maybeSingle();
      return data;
    }
  });

  // Grupos de Turnos estruturados
  const turnoGroups: TurnoGroup[] = useMemo((): TurnoGroup[] => {
    if (rosterSettings?.shifts && Array.isArray(rosterSettings.shifts) && rosterSettings.shifts.length > 0) {
      // Se houver membros salvos na estrutura de shifts
      const hasConfiguredMembers = rosterSettings.shifts.some((s: any) => Array.isArray(s.members) && s.members.length > 0);
      if (hasConfiguredMembers) {
        return rosterSettings.shifts.map((s: any): TurnoGroup => ({
          id: s.id || s.name.toLowerCase().replace(/\s+/g, '_'),
          name: s.name,
          color: s.color || 'blue',
          members: Array.isArray(s.members) ? s.members : []
        }));
      }
    }
    return DEFAULT_TURNO_GROUPS;
  }, [rosterSettings]);

  // 5. Busca Todas as Escalas do Mês Atual
  const { data: rawShiftsData, isLoading: isLoadingShifts, refetch: refetchShifts } = useQuery({
    queryKey: ['operational_shifts_roster', boardId, boardData?.workspace_id, startOfMonthStr, endOfMonthStr],
    queryFn: async () => {
      let query = supabase.from('operational_shifts').select('*');
      if (boardData?.workspace_id) {
        query = query.or(`workspace_id.eq.${boardData.workspace_id},board_id.eq.${boardId}`);
      } else {
        query = query.eq('board_id', boardId);
      }
      query = query.gte('shift_date', startOfMonthStr).lte('shift_date', endOfMonthStr);
      const { data, error } = await query;
      if (error) {
        console.warn("Erro ao buscar shifts:", error);
        return [];
      }
      return data || [];
    }
  });

  // Mapeamento em O(1): chave `${operatorName.toLowerCase().trim()}_${shiftDate}` -> { id, status, notes, ... }
  const cellShiftMap = useMemo(() => {
    const map = new Map<string, any>();
    (rawShiftsData || []).forEach((row: any) => {
      if (row.operator_name && row.shift_date) {
        const key = `${row.operator_name.toLowerCase().trim()}_${row.shift_date}`;
        map.set(key, row);
      }
    });
    return map;
  }, [rawShiftsData]);

  // Salvar / Alterar Configuração dos Turnos e Membros
  const saveTurnoGroupsMutation = useMutation({
    mutationFn: async (updatedGroups: typeof turnoGroups) => {
      if (!canManageRoster) throw new Error("Apenas Administradores e Líderes podem editar o quadro de turnos.");
      
      const payload: any = {
        board_id: boardId,
        shifts: updatedGroups,
        updated_at: new Date().toISOString()
      };
      if (boardData?.workspace_id) payload.workspace_id = boardData.workspace_id;

      let { error } = await supabase.from('operational_shift_settings').upsert(payload);
      if (error && error.message?.includes('workspace_id')) {
        delete payload.workspace_id;
        const retry = await supabase.from('operational_shift_settings').upsert(payload);
        if (retry.error) throw retry.error;
      } else if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shift_settings_roster'] });
    },
    onError: (err: any) => {
      alert("Erro ao salvar colaboradores do turno: " + err.message);
    }
  });

  // Salvar / Alterar Célula Individual
  const updateCellMutation = useMutation({
    mutationFn: async ({
      operatorName,
      shiftName,
      shiftDate,
      statusCode,
      customTimeText
    }: {
      operatorName: string;
      shiftName: string;
      shiftDate: string;
      statusCode: string;
      customTimeText?: string;
    }) => {
      if (!canManageRoster) throw new Error("Apenas Líderes e Administradores podem editar a escala.");

      const key = `${operatorName.toLowerCase().trim()}_${shiftDate}`;
      const existing = cellShiftMap.get(key);

      // Se for vazio ou limpar: remove a linha existente
      if (!statusCode || statusCode === 'CLEAR') {
        if (existing?.id) {
          const { error } = await supabase.from('operational_shifts').delete().eq('id', existing.id);
          if (error) throw error;
        }
        return;
      }

      // Preparar campos
      let dbStatus = statusCode;
      let notes = customTimeText || '';

      if (statusCode === 'PRESENCA') {
        dbStatus = 'Confirmado';
      } else if (statusCode === 'HORARIO' && customTimeText) {
        dbStatus = customTimeText; // ex: "06:17" ou "14:43"
      }

      if (existing?.id) {
        const { error } = await supabase
          .from('operational_shifts')
          .update({
            status: dbStatus,
            notes: notes,
            shift_name: shiftName || existing.shift_name || 'Geral'
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const payload: any = {
          board_id: boardId,
          shift_date: shiftDate,
          shift_name: shiftName || 'Geral',
          shift_time: customTimeText || '08:00 - 18:00',
          region_name: 'Geral',
          operator_name: operatorName,
          operator_type: 'Turno Mensal',
          status: dbStatus,
          notes: notes
        };
        if (boardData?.workspace_id) payload.workspace_id = boardData.workspace_id;

        const { error } = await supabase.from('operational_shifts').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts_roster'] });
      setActiveCellPopover(null);
    },
    onError: (err: any) => {
      alert("Erro ao atualizar escala: " + err.message);
    }
  });

  // Salvar em Lote (ex: Férias em intervalo de datas)
  const bulkApplyPeriodMutation = useMutation({
    mutationFn: async () => {
      if (!canManageRoster) throw new Error("Sem permissão.");
      if (!bulkStartDate || !bulkEndDate) throw new Error("Selecione data de início e fim.");

      const start = new Date(`${bulkStartDate}T00:00:00`);
      const end = new Date(`${bulkEndDate}T00:00:00`);
      if (start > end) throw new Error("A data de início deve ser anterior ou igual à data de fim.");

      // Determinar lista de colaboradores afetados
      let targetMembers: { name: string; turno: string }[] = [];
      if (bulkMember && bulkMember !== 'all') {
        const found = turnoGroups.find(g => g.members.includes(bulkMember));
        targetMembers = [{ name: bulkMember, turno: found?.name || 'Geral' }];
      } else if (bulkTargetTurno && bulkTargetTurno !== 'all') {
        const group = turnoGroups.find(g => g.name === bulkTargetTurno);
        if (group) {
          targetMembers = group.members.map(m => ({ name: m, turno: group.name }));
        }
      } else {
        targetMembers = turnoGroups.flatMap(g => g.members.map(m => ({ name: m, turno: g.name })));
      }

      if (targetMembers.length === 0) throw new Error("Nenhum colaborador selecionado.");

      const datesToProcess: string[] = [];
      let curr = new Date(start);
      while (curr <= end) {
        datesToProcess.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }

      const rowsToUpsert: any[] = [];
      datesToProcess.forEach(dStr => {
        targetMembers.forEach(tm => {
          let dbStatus = bulkStatusCode;
          if (bulkStatusCode === 'PRESENCA') dbStatus = 'Confirmado';
          if (bulkStatusCode === 'HORARIO' && bulkCustomTime) dbStatus = bulkCustomTime;

          rowsToUpsert.push({
            board_id: boardId,
            workspace_id: boardData?.workspace_id || null,
            shift_date: dStr,
            shift_name: tm.turno,
            region_name: 'Geral',
            operator_name: tm.name,
            operator_type: 'Turno Mensal',
            status: dbStatus,
            notes: bulkCustomTime || ''
          });
        });
      });

      // Deleta registros existentes para estes colaboradores e datas
      for (const tm of targetMembers) {
        await supabase
          .from('operational_shifts')
          .delete()
          .eq('board_id', boardId)
          .eq('operator_name', tm.name)
          .in('shift_date', datesToProcess);
      }

      // Se não for status CLEAR, insere os novos
      if (bulkStatusCode !== 'CLEAR' && rowsToUpsert.length > 0) {
        const { error } = await supabase.from('operational_shifts').insert(rowsToUpsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts_roster'] });
      setIsBulkPeriodOpen(false);
      alert("Escala em lote aplicada com sucesso!");
    },
    onError: (err: any) => {
      alert("Erro ao aplicar em lote: " + err.message);
    }
  });

  // Função auxiliar para interpretar o status da célula
  const resolveCellStatus = (operatorName: string, dateStr: string): { 
    def: StatusDefinition | null; 
    customText: string; 
    rawStatus: string 
  } => {
    const key = `${operatorName.toLowerCase().trim()}_${dateStr}`;
    const row = cellShiftMap.get(key);
    if (!row) return { def: null, customText: '', rawStatus: '' };

    const raw = (row.status || '').trim();
    const upper = raw.toUpperCase();

    // Casos diretos
    if (upper === '✓' || upper === 'CONFIRMADO' || upper === 'PRESENCA' || upper === 'PRESENÇA' || upper === 'TRABALHO') {
      return { def: ROSTER_STATUSES.PRESENCA, customText: '✓', rawStatus: raw };
    }
    if (upper === 'FG' || upper === 'FOLGA') {
      return { def: ROSTER_STATUSES.FG, customText: 'FG', rawStatus: raw };
    }
    if (upper === 'DOM' || upper === 'DOMINGO') {
      return { def: ROSTER_STATUSES.DOM, customText: 'DOM', rawStatus: raw };
    }
    if (upper === 'FÉRIAS' || upper === 'FERIAS') {
      return { def: ROSTER_STATUSES.FERIAS, customText: 'FÉRIAS', rawStatus: raw };
    }
    if (upper === 'DOFF' || upper === 'DAY OFF') {
      return { def: ROSTER_STATUSES.DOFF, customText: 'DOFF', rawStatus: raw };
    }
    if (upper === 'FJ') {
      return { def: ROSTER_STATUSES.FJ, customText: 'FJ', rawStatus: raw };
    }
    if (upper === 'AT' || upper === 'ATESTADO') {
      return { def: ROSTER_STATUSES.AT, customText: 'AT', rawStatus: raw };
    }
    if (upper === 'HOME' || upper === 'HOME-OFFICE' || upper === 'HOME OFFICE') {
      return { def: ROSTER_STATUSES.HOME, customText: 'HOME', rawStatus: raw };
    }
    if (upper === 'F' || upper === 'FALTA') {
      return { def: ROSTER_STATUSES.FALTA, customText: 'F', rawStatus: raw };
    }
    if (upper === 'X' || upper === 'INATIVO') {
      return { def: ROSTER_STATUSES.INATIVO, customText: 'x', rawStatus: raw };
    }

    // Se for um horário específico (ex: 06:17, 14:43, 09:08)
    if (/^\d{1,2}:\d{2}$/.test(raw) || /^\d{1,2}H\d{0,2}$/i.test(raw)) {
      return { def: ROSTER_STATUSES.HORARIO, customText: raw, rawStatus: raw };
    }

    // Se houver anotação com horário
    if (row.notes && /^\d{1,2}:\d{2}$/.test(row.notes.trim())) {
      return { def: ROSTER_STATUSES.HORARIO, customText: row.notes.trim(), rawStatus: raw };
    }

    // Padrão de trabalho com texto customizado
    return { def: ROSTER_STATUSES.PRESENCA, customText: raw, rawStatus: raw };
  };

  // Calcular estatísticas por colaborador no mês
  const memberMonthlyStats = useMemo(() => {
    const stats = new Map<string, {
      totalWork: number;
      totalOff: number;
      totalVacation: number;
      totalMedical: number;
      totalRemote: number;
      totalDelayOrAbsence: number;
    }>();

    turnoGroups.forEach(g => {
      g.members.forEach(member => {
        let work = 0;
        let off = 0;
        let vac = 0;
        let med = 0;
        let rem = 0;
        let delay = 0;

        for (let d = 1; d <= daysInCurrentMonth; d++) {
          const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const res = resolveCellStatus(member, dateStr);
          if (res.def) {
            if (res.def.category === 'work') work++;
            else if (res.def.category === 'off') off++;
            else if (res.def.category === 'vacation') vac++;
            else if (res.def.category === 'medical') med++;
            else if (res.def.category === 'remote') rem++;
            else if (res.def.category === 'special') delay++;
          }
        }

        stats.set(member, {
          totalWork: work,
          totalOff: off,
          totalVacation: vac,
          totalMedical: med,
          totalRemote: rem,
          totalDelayOrAbsence: delay
        });
      });
    });

    return stats;
  }, [turnoGroups, cellShiftMap, currentYear, currentMonthIndex, daysInCurrentMonth]);

  // Lista dos dias do mês com metadados
  const monthDaysList = useMemo(() => {
    const list = [];
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateObj = new Date(currentYear, currentMonthIndex, d);
      const dayOfWeek = dateObj.getDay(); // 0 = dom, 6 = sab
      const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;

      list.push({
        dayNumber: d,
        dateStr,
        dayOfWeek,
        dayNameShort: DOW_SHORT[dayOfWeek],
        monthShort: MONTH_SHORT[currentMonthIndex],
        isWeekend,
        isSunday,
        label: `${d}-${MONTH_SHORT[currentMonthIndex]}`
      });
    }
    return list;
  }, [currentYear, currentMonthIndex, daysInCurrentMonth]);

  // Filtro de Turno e Colaborador
  const filteredGroups = useMemo(() => {
    return turnoGroups
      .filter(g => filterTurno === 'all' || g.name === filterTurno)
      .map(g => {
        const filteredMembers = g.members.filter(m => {
          const matchesSearch = !searchMember || m.toLowerCase().includes(searchMember.toLowerCase());
          
          if (!matchesSearch) return false;
          if (filterStatusCode === 'all') return true;

          // Se tiver filtro por status, checa se colaborador tem esse status em algum dia do mês
          for (let d = 1; d <= daysInCurrentMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const res = resolveCellStatus(m, dateStr);
            if (res.def && res.def.code === filterStatusCode) return true;
          }
          return false;
        });

        return {
          ...g,
          members: filteredMembers
        };
      })
      .filter(g => g.members.length > 0 || !searchMember);
  }, [turnoGroups, filterTurno, searchMember, filterStatusCode, daysInCurrentMonth, currentYear, currentMonthIndex, cellShiftMap]);

  // Navegação de Mês
  const handlePrevMonth = () => {
    const prev = new Date(selectedMonthDate);
    prev.setMonth(prev.getMonth() - 1);
    setSelectedMonthDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(selectedMonthDate);
    next.setMonth(next.getMonth() + 1);
    setSelectedMonthDate(next);
  };

  const handleCurrentMonth = () => {
    setSelectedMonthDate(new Date());
  };

  // Exportar para CSV
  const handleExportCSV = () => {
    const headers = ['Turno', 'Colaborador', ...monthDaysList.map(d => `${d.label} (${d.dayNameShort})`), 'Trabalho', 'Folgas', 'Férias', 'Atestados', 'Home Office', 'Atrasos'];
    const rows: string[][] = [];

    turnoGroups.forEach(g => {
      g.members.forEach(m => {
        const s = memberMonthlyStats.get(m);
        const dayValues = monthDaysList.map(d => {
          const res = resolveCellStatus(m, d.dateStr);
          return res.customText || '-';
        });

        rows.push([
          g.name,
          m,
          ...dayValues,
          String(s?.totalWork || 0),
          String(s?.totalOff || 0),
          String(s?.totalVacation || 0),
          String(s?.totalMedical || 0),
          String(s?.totalRemote || 0),
          String(s?.totalDelayOrAbsence || 0)
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `escala_mensal_${MONTH_SHORT[currentMonthIndex]}_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Preencher Domingos com DOM automaticamente
  const handleAutoFillSundays = async () => {
    if (!canManageRoster) return;
    if (!confirm(`Deseja marcar automaticamente todos os DOMINGOS do mês com "DOM" (Folga de Domingo) para os colaboradores do setor?`)) return;

    const sundays = monthDaysList.filter(d => d.isSunday).map(d => d.dateStr);
    const allMembers = turnoGroups.flatMap(g => g.members.map(m => ({ name: m, turno: g.name })));

    const rowsToInsert: any[] = [];
    sundays.forEach(dStr => {
      allMembers.forEach(tm => {
        rowsToInsert.push({
          board_id: boardId,
          workspace_id: boardData?.workspace_id || null,
          shift_date: dStr,
          shift_name: tm.turno,
          region_name: 'Geral',
          operator_name: tm.name,
          operator_type: 'Turno Mensal',
          status: 'DOM',
          notes: ''
        });
      });
    });

    // Deleta os domingos atuais destes membros e insere DOM
    for (const tm of allMembers) {
      await supabase
        .from('operational_shifts')
        .delete()
        .eq('board_id', boardId)
        .eq('operator_name', tm.name)
        .in('shift_date', sundays);
    }

    await supabase.from('operational_shifts').insert(rowsToInsert);
    queryClient.invalidateQueries({ queryKey: ['operational_shifts_roster'] });
    alert("Domingos preenchidos com sucesso!");
  };

  // Adicionar Colaborador a um Turno
  const handleAddMemberToTurno = (name: string, turnoName: string) => {
    if (!name.trim()) return;
    const updated = turnoGroups.map(g => {
      if (g.name === turnoName) {
        if (!g.members.includes(name.trim())) {
          return { ...g, members: [...g.members, name.trim()] };
        }
      }
      return g;
    });
    saveTurnoGroupsMutation.mutate(updated);
    setNewMemberName('');
    setIsAddMemberModalOpen(false);
  };

  // Remover Colaborador do Turno
  const handleRemoveMemberFromTurno = (name: string, turnoName: string) => {
    if (!confirm(`Remover "${name}" do turno "${turnoName}"?`)) return;
    const updated = turnoGroups.map(g => {
      if (g.name === turnoName) {
        return { ...g, members: g.members.filter(m => m !== name) };
      }
      return g;
    });
    saveTurnoGroupsMutation.mutate(updated);
  };

  // Mover Colaborador de Turno
  const handleMoveMemberTurno = (name: string, currentTurno: string, newTurno: string) => {
    if (currentTurno === newTurno) return;
    const updated = turnoGroups.map(g => {
      if (g.name === currentTurno) {
        return { ...g, members: g.members.filter(m => m !== name) };
      }
      if (g.name === newTurno) {
        return { ...g, members: [...g.members, name] };
      }
      return g;
    });
    saveTurnoGroupsMutation.mutate(updated);
  };

  // Criar Novo Turno
  const handleCreateNewTurno = () => {
    if (!newTurnoName.trim()) return;
    if (turnoGroups.some(g => g.name.toLowerCase() === newTurnoName.trim().toLowerCase())) {
      alert("Este turno já existe!");
      return;
    }
    const updated = [
      ...turnoGroups,
      {
        id: newTurnoName.toLowerCase().replace(/\s+/g, '_'),
        name: newTurnoName.trim(),
        color: 'sky',
        members: []
      }
    ];
    saveTurnoGroupsMutation.mutate(updated);
    setNewTurnoName('');
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden">
      
      {/* 1. TOPO: TÍTULO, SELETOR DE MÊS, ABAS DE VISÃO E AÇÕES */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4 shrink-0 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Título e Seletor do Mês */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  Quadro de Turnos
                  <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded-full border border-emerald-200">
                    Escala Mensal
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Acompanhamento de vindas, folgas, férias e atestados da equipe
                </p>
              </div>
            </div>

            {/* Controle de Navegação do Mês */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs ml-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-all cursor-pointer hover:shadow-2xs"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3 text-sm font-bold text-slate-800 capitalize flex items-center gap-1.5 select-none min-w-[140px] justify-center">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{MONTH_NAMES[currentMonthIndex]} {currentYear}</span>
              </div>

              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-all cursor-pointer hover:shadow-2xs"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleCurrentMonth}
                className="ml-1 px-2.5 py-1 text-xs font-semibold bg-white text-blue-700 hover:bg-blue-50 rounded-lg border border-slate-200/80 transition-all cursor-pointer"
              >
                Hoje
              </button>
            </div>
          </div>

          {/* Seletor de Visões e Botões de Ação */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Abas de Modo de Visualização */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                onClick={() => setActiveViewMode('matriz')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeViewMode === 'matriz' 
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60 font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Matriz Mensal</span>
              </button>

              <button
                onClick={() => setActiveViewMode('calendario')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeViewMode === 'calendario' 
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60 font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Calendário</span>
              </button>

              <button
                onClick={() => setActiveViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeViewMode === 'cards' 
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60 font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards da Equipe</span>
              </button>

              <button
                onClick={() => setActiveViewMode('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeViewMode === 'dashboard' 
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60 font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Métricas</span>
              </button>
            </div>

            {/* Botões de Ação para Gestão */}
            {canManageRoster && (
              <>
                <button
                  onClick={() => {
                    setBulkStartDate(startOfMonthStr);
                    setBulkEndDate(endOfMonthStr);
                    setIsBulkPeriodOpen(true);
                  }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Lançar Período</span>
                </button>

                <button
                  onClick={handleAutoFillSundays}
                  className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Marcar DOM em todos os domingos do mês"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Fixar Domingos</span>
                </button>

                <button
                  onClick={() => setIsManageTeamsOpen(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Equipe & Turnos</span>
                </button>
              </>
            )}

            {/* Exportar CSV */}
            <button
              onClick={handleExportCSV}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer"
              title="Exportar Planilha Excel/CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. BARRA DE FILTROS E BUSCA */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Input de Busca */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar colaborador..."
                value={searchMember}
                onChange={e => setSearchMember(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              {searchMember && (
                <button 
                  onClick={() => setSearchMember('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro por Turno */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Turno:</span>
              <select
                value={filterTurno}
                onChange={e => setFilterTurno(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Todos os Turnos ({turnoGroups.length})</option>
                {turnoGroups.map(g => (
                  <option key={g.id} value={g.name}>{g.name} ({g.members.length})</option>
                ))}
              </select>
            </div>

            {/* Filtro por Status */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Status:</span>
              <select
                value={filterStatusCode}
                onChange={e => setFilterStatusCode(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="PRESENCA">✓ Presença / Normal</option>
                <option value="FG">FG (Folga)</option>
                <option value="DOM">DOM (Domingo)</option>
                <option value="FERIAS">FÉRIAS</option>
                <option value="DOFF">DOFF (Day Off)</option>
                <option value="FJ">FJ (Folga Justificada)</option>
                <option value="AT">AT (Atestado)</option>
                <option value="HOME">HOME (Home Office)</option>
                <option value="HORARIO">Horário Especial / Falta</option>
              </select>
            </div>
          </div>

          {/* LEGENDA RÁPIDA DE CORES */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            <span className="text-slate-400 font-semibold mr-1 text-[10px] uppercase tracking-wider">Legenda:</span>
            
            <span className="px-2 py-0.5 rounded bg-[#c6efce] text-[#006100] border border-[#a8e4b3] shadow-2xs" title="Presença Normal">
              ✓ Normal
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#2d7d32] text-white shadow-2xs" title="Folga da Escala">
              FG
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#7b1fa2] text-white shadow-2xs" title="Domingo / Plantão">
              DOM
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#f57c00] text-white shadow-2xs" title="Férias">
              FÉRIAS
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#d81b60] text-white shadow-2xs" title="Day Off">
              DOFF
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#00838f] text-white shadow-2xs" title="Folga Justificada">
              FJ
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#0288d1] text-white shadow-2xs" title="Atestado Médico">
              AT
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#f8bbd0] text-[#880e4f] border border-[#f48fb1] shadow-2xs" title="Home Office">
              HOME
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#d32f2f] text-white shadow-2xs" title="Horário / Atraso / Falta">
              00:00 / F
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200" title="Fora da Escala">
              x
            </span>
          </div>
        </div>

        {/* Banner de Modo de Leitura caso não seja admin/líder */}
        {!canManageRoster && (
          <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg flex items-center justify-between text-xs font-semibold text-amber-800">
            <div className="flex items-center gap-2">
              <span>👁️</span>
              <span><strong>Modo de Leitura:</strong> Visualização da escala do mês. Edições são liberadas para Líderes de Setor e Administradores.</span>
            </div>
            <span className="text-[10px] uppercase font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              Apenas Consulta
            </span>
          </div>
        )}
      </div>

      {/* 3. CONTEÚDO PRINCIPAL RENDERIZADO POR ABA */}
      <div className="flex-1 overflow-auto relative">
        
        {/* ============================================================== */}
        {/* VISÃO 1: MATRIZ MENSAL (PLANILHA DE REFERÊNCIA) */}
        {/* ============================================================== */}
        {activeViewMode === 'matriz' && (
          <div className="h-full w-full overflow-auto bg-white p-4">
            <div className="inline-block min-w-full align-middle border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="min-w-full border-collapse text-xs select-none">
                
                {/* CABEÇALHO COM OS DIAS DO MÊS */}
                <thead>
                  <tr className="bg-black text-white divide-x divide-slate-800 sticky top-0 z-30 shadow-xs">
                    
                    {/* Coluna Fixa do Colaborador */}
                    <th className="sticky left-0 z-40 bg-black text-white px-4 py-2.5 text-left font-bold text-xs uppercase tracking-wider w-[220px] min-w-[200px] border-r border-slate-800">
                      <div className="flex items-center justify-between">
                        <span>Colaborador</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {MONTH_SHORT[currentMonthIndex]}/{currentYear}
                        </span>
                      </div>
                    </th>

                    {/* Colunas dos Dias 1..31 */}
                    {monthDaysList.map(d => (
                      <th 
                        key={d.dateStr} 
                        className={`px-1.5 py-1 text-center font-bold min-w-[42px] max-w-[46px] transition-colors ${
                          d.isSunday 
                            ? 'bg-slate-900 text-purple-300' 
                            : d.isWeekend 
                              ? 'bg-slate-900/90 text-amber-200' 
                              : 'bg-black text-slate-100'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[11px] font-extrabold tracking-tight">{d.label}</span>
                          <span className={`text-[10px] font-semibold uppercase ${
                            d.isSunday ? 'text-purple-400' : d.isWeekend ? 'text-amber-400' : 'text-slate-400'
                          }`}>
                            {d.dayNameShort}
                          </span>
                        </div>
                      </th>
                    ))}

                    {/* Colunas de Resumo de Totais */}
                    <th className="bg-slate-900 text-emerald-300 px-2 py-2 text-center font-bold text-[10px] min-w-[45px]" title="Dias Trabalhados">
                      ✓
                    </th>
                    <th className="bg-slate-900 text-green-300 px-2 py-2 text-center font-bold text-[10px] min-w-[45px]" title="Total Folgas (FG/DOM/DOFF/FJ)">
                      FG
                    </th>
                    <th className="bg-slate-900 text-amber-300 px-2 py-2 text-center font-bold text-[10px] min-w-[45px]" title="Férias">
                      FÉR
                    </th>
                    <th className="bg-slate-900 text-sky-300 px-2 py-2 text-center font-bold text-[10px] min-w-[45px]" title="Atestados">
                      AT
                    </th>
                    <th className="bg-slate-900 text-pink-300 px-2 py-2 text-center font-bold text-[10px] min-w-[45px]" title="Home Office">
                      HM
                    </th>
                    <th className="bg-slate-900 text-red-300 px-2 py-2 text-center font-bold text-[10px] min-w-[45px]" title="Atrasos / Faltas">
                      ATR
                    </th>
                  </tr>
                </thead>

                {/* CORPO DA TABELA: AGRUPADO POR TURNO / SETOR */}
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={monthDaysList.length + 7} className="p-8 text-center text-slate-400">
                        Nenhum colaborador encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map(group => (
                      <tbody key={group.id} className="divide-y divide-slate-100">
                        
                        {/* LINHA DE TÍTULO DO TURNO / GRUPO (FAIXA PRETA/ESCURA ELEGANTE) */}
                        <tr className="bg-slate-900 text-white font-bold sticky z-20">
                          <td 
                            colSpan={monthDaysList.length + 7}
                            className="sticky left-0 z-30 px-4 py-2 bg-slate-900 text-slate-100 font-extrabold uppercase tracking-wide text-xs border-y border-slate-800"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                <span>{group.name}</span>
                                <span className="text-[11px] font-normal text-slate-400 lowercase">
                                  ({group.members.length} colaboradores)
                                </span>
                              </div>
                              {canManageRoster && (
                                <button
                                  onClick={() => {
                                    setNewMemberTurno(group.name);
                                    setIsAddMemberModalOpen(true);
                                  }}
                                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                                >
                                  <UserPlus className="w-3 h-3" />
                                  <span>Adicionar no Turno</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* LINHAS DE CADA COLABORADOR DO TURNO */}
                        {group.members.map((member, memberIdx) => {
                          const stats = memberMonthlyStats.get(member);

                          return (
                            <tr 
                              key={`${group.id}_${member}`}
                              className="hover:bg-slate-50/80 transition-colors divide-x divide-slate-100 group/row"
                            >
                              
                              {/* COLUNA FIXA: NOME DO COLABORADOR */}
                              <td className="sticky left-0 z-10 bg-white group-hover/row:bg-slate-50 px-3 py-2 font-medium text-slate-800 truncate border-r border-slate-200 shadow-2xs">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-2 truncate">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-300">
                                      {member.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate text-xs font-semibold text-slate-800" title={member}>
                                      {member}
                                    </span>
                                  </div>

                                  {canManageRoster && (
                                    <button
                                      onClick={() => handleRemoveMemberFromTurno(member, group.name)}
                                      className="opacity-0 group-hover/row:opacity-100 text-slate-400 hover:text-red-600 p-1 rounded transition-opacity cursor-pointer shrink-0"
                                      title="Remover da Escala"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* CÉLULAS DOS DIAS DO MÊS (1..31) */}
                              {monthDaysList.map(d => {
                                const { def, customText } = resolveCellStatus(member, d.dateStr);

                                return (
                                  <td
                                    key={d.dateStr}
                                    onClick={(e) => {
                                      if (!canManageRoster) return;
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setActiveCellPopover({
                                        dateStr: d.dateStr,
                                        operatorName: member,
                                        shiftName: group.name,
                                        anchorRect: rect,
                                        currentCode: def?.code || '',
                                        currentTimeText: def?.isCustomTime ? customText : ''
                                      });
                                    }}
                                    className={`p-0.5 text-center transition-all relative ${
                                      d.isSunday 
                                        ? 'bg-purple-50/20' 
                                        : d.isWeekend 
                                          ? 'bg-slate-50/60' 
                                          : 'bg-white'
                                    } ${canManageRoster ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 hover:z-20' : ''}`}
                                  >
                                    <div className="h-7 w-full flex items-center justify-center">
                                      {def ? (
                                        <div 
                                          className={`w-full h-full rounded-[3px] flex items-center justify-center font-bold text-[11px] select-none transition-transform active:scale-95 shadow-2xs ${def.bgClass} ${def.textClass} ${def.borderClass ? `border ${def.borderClass}` : ''}`}
                                          title={`${member} - ${d.label}: ${def.label} (${customText})`}
                                        >
                                          {customText}
                                        </div>
                                      ) : (
                                        <div className="w-full h-full rounded-[2px] flex items-center justify-center text-slate-200 group-hover/cell:bg-slate-100 text-[10px]">
                                          {/* Vazio / Sem escala */}
                                          {canManageRoster && <span className="opacity-0 hover:opacity-100 text-slate-400">+</span>}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}

                              {/* COLUNAS DE RESUMO DE TOTAIS */}
                              <td className="px-1.5 py-1 text-center font-bold text-emerald-700 bg-emerald-50/40">
                                {stats?.totalWork || 0}
                              </td>
                              <td className="px-1.5 py-1 text-center font-bold text-green-800 bg-green-50/40">
                                {stats?.totalOff || 0}
                              </td>
                              <td className="px-1.5 py-1 text-center font-bold text-amber-700 bg-amber-50/40">
                                {stats?.totalVacation || 0}
                              </td>
                              <td className="px-1.5 py-1 text-center font-bold text-sky-700 bg-sky-50/40">
                                {stats?.totalMedical || 0}
                              </td>
                              <td className="px-1.5 py-1 text-center font-bold text-pink-700 bg-pink-50/40">
                                {stats?.totalRemote || 0}
                              </td>
                              <td className="px-1.5 py-1 text-center font-bold text-red-700 bg-red-50/40">
                                {stats?.totalDelayOrAbsence || 0}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VISÃO 2: CALENDÁRIO MENSAL TRADICIONAL */}
        {/* ============================================================== */}
        {activeViewMode === 'calendario' && (
          <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="grid grid-cols-7 gap-2 text-center font-bold text-xs text-slate-600 mb-3 uppercase tracking-wider">
                <div className="text-purple-600">Domingo</div>
                <div>Segunda</div>
                <div>Terça</div>
                <div>Quarta</div>
                <div>Quinta</div>
                <div>Sexta</div>
                <div className="text-amber-600">Sábado</div>
              </div>

              {/* Grid dos dias do mês */}
              <div className="grid grid-cols-7 gap-2">
                {/* Espaços vazios antes do dia 1 */}
                {Array.from({ length: new Date(currentYear, currentMonthIndex, 1).getDay() }).map((_, i) => (
                  <div key={`empty_${i}`} className="min-h-[110px] bg-slate-50/60 rounded-xl border border-dashed border-slate-200/60 p-2"></div>
                ))}

                {/* Dias do mês */}
                {monthDaysList.map(d => {
                  // Contadores do dia
                  let workCount = 0;
                  let offCount = 0;
                  let vacCount = 0;
                  let atCount = 0;
                  let delayCount = 0;

                  turnoGroups.forEach(g => {
                    g.members.forEach(m => {
                      const res = resolveCellStatus(m, d.dateStr);
                      if (res.def) {
                        if (res.def.category === 'work') workCount++;
                        else if (res.def.category === 'off') offCount++;
                        else if (res.def.category === 'vacation') vacCount++;
                        else if (res.def.category === 'medical') atCount++;
                        else if (res.def.category === 'special') delayCount++;
                      }
                    });
                  });

                  return (
                    <div 
                      key={d.dateStr}
                      className={`min-h-[110px] rounded-xl border p-2 flex flex-col justify-between transition-all ${
                        d.isSunday 
                          ? 'bg-purple-50/30 border-purple-200/60' 
                          : d.isWeekend 
                            ? 'bg-amber-50/30 border-amber-200/60' 
                            : 'bg-white border-slate-200 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-black ${d.isSunday ? 'text-purple-700' : 'text-slate-800'}`}>
                          {d.dayNumber}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {d.dayNameShort}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 mt-1 text-[11px] font-bold">
                        {workCount > 0 && (
                          <div className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-between">
                            <span>Trabalhando:</span>
                            <span>{workCount}</span>
                          </div>
                        )}
                        {offCount > 0 && (
                          <div className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 flex items-center justify-between">
                            <span>Folga:</span>
                            <span>{offCount}</span>
                          </div>
                        )}
                        {vacCount > 0 && (
                          <div className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center justify-between">
                            <span>Férias:</span>
                            <span>{vacCount}</span>
                          </div>
                        )}
                        {atCount > 0 && (
                          <div className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 flex items-center justify-between">
                            <span>Atestado:</span>
                            <span>{atCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VISÃO 3: CARDS DETALHADOS DA EQUIPE */}
        {/* ============================================================== */}
        {activeViewMode === 'cards' && (
          <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
            {turnoGroups.map(group => (
              <div key={group.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                  <h3 className="font-bold text-slate-800 text-base">{group.name}</h3>
                  <span className="text-xs text-slate-500 font-medium">({group.members.length} colaboradores)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.members.map(member => {
                    const stats = memberMonthlyStats.get(member);
                    const totalDays = daysInCurrentMonth;
                    const workPct = Math.round(((stats?.totalWork || 0) / totalDays) * 100);

                    return (
                      <div key={member} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-4 hover:shadow-md transition-shadow">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm border border-blue-200">
                              {member.charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <h4 className="font-bold text-slate-900 text-sm truncate" title={member}>{member}</h4>
                              <p className="text-xs text-slate-500">{group.name}</p>
                            </div>
                          </div>

                          {/* Barra de Distribuição de Presença */}
                          <div className="mt-4">
                            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                              <span>Presença no Mês</span>
                              <span className="text-emerald-700 font-bold">{workPct}% ({stats?.totalWork} dias)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                              <div style={{ width: `${workPct}%` }} className="bg-emerald-500 h-full"></div>
                              <div style={{ width: `${Math.round(((stats?.totalOff || 0) / totalDays) * 100)}%` }} className="bg-slate-400 h-full"></div>
                              <div style={{ width: `${Math.round(((stats?.totalVacation || 0) / totalDays) * 100)}%` }} className="bg-amber-500 h-full"></div>
                            </div>
                          </div>

                          {/* Resumo com Badges */}
                          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                              <span className="text-[10px] text-emerald-600 font-bold block">Folgas</span>
                              <span className="text-sm font-extrabold text-emerald-800">{stats?.totalOff || 0}</span>
                            </div>
                            <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
                              <span className="text-[10px] text-amber-600 font-bold block">Férias</span>
                              <span className="text-sm font-extrabold text-amber-800">{stats?.totalVacation || 0}</span>
                            </div>
                            <div className="bg-sky-50 p-2 rounded-lg border border-sky-100">
                              <span className="text-[10px] text-sky-600 font-bold block">Atestados</span>
                              <span className="text-sm font-extrabold text-sky-800">{stats?.totalMedical || 0}</span>
                            </div>
                          </div>
                        </div>

                        {canManageRoster && (
                          <button
                            onClick={() => {
                              setBulkMember(member);
                              setBulkStartDate(startOfMonthStr);
                              setBulkEndDate(endOfMonthStr);
                              setIsBulkPeriodOpen(true);
                            }}
                            className="w-full py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors text-center"
                          >
                            Lançar Férias / Folga
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============================================================== */}
        {/* VISÃO 4: MÉTRICAS & DASHBOARD DE COBERTURA */}
        {/* ============================================================== */}
        {activeViewMode === 'dashboard' && (
          <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
            
            {/* Cards de Métricas Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Total Colaboradores</span>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1">
                    {turnoGroups.reduce((acc, g) => acc + g.members.length, 0)}
                  </h3>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Média Dias Trabalhados</span>
                  <h3 className="text-2xl font-bold text-emerald-700 mt-1">
                    {Math.round(
                      Array.from(memberMonthlyStats.values()).reduce((a, b) => a + b.totalWork, 0) / 
                      (memberMonthlyStats.size || 1)
                    )} dias
                  </h3>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Em Férias no Mês</span>
                  <h3 className="text-2xl font-bold text-amber-700 mt-1">
                    {Array.from(memberMonthlyStats.values()).filter(s => s.totalVacation > 0).length} pessoas
                  </h3>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <Sun className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Atestados Médicos</span>
                  <h3 className="text-2xl font-bold text-sky-700 mt-1">
                    {Array.from(memberMonthlyStats.values()).reduce((a, b) => a + b.totalMedical, 0)} dias
                  </h3>
                </div>
                <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                  <AlertCircle className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Gráfico de Cobertura Diária */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-800 mb-1">
                Efetivo Operacional Diário (Presença por Dia do Mês)
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Quantos colaboradores estão escalados e trabalhando em cada dia para garantir que não haja defasagem no setor.
              </p>

              <div className="flex items-end gap-1.5 h-48 pt-4 pb-2 border-b border-slate-200 overflow-x-auto">
                {monthDaysList.map(d => {
                  let workingCount = 0;
                  turnoGroups.forEach(g => {
                    g.members.forEach(m => {
                      const res = resolveCellStatus(m, d.dateStr);
                      if (res.def?.category === 'work') workingCount++;
                    });
                  });

                  const totalMembers = turnoGroups.reduce((acc, g) => acc + g.members.length, 0) || 1;
                  const heightPct = Math.max(10, Math.round((workingCount / totalMembers) * 100));

                  return (
                    <div key={d.dateStr} className="flex-1 min-w-[28px] flex flex-col items-center gap-1.5 h-full justify-end group">
                      <span className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {workingCount}
                      </span>
                      <div 
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-md transition-all ${
                          d.isSunday 
                            ? 'bg-purple-400 group-hover:bg-purple-500' 
                            : d.isWeekend 
                              ? 'bg-amber-400 group-hover:bg-amber-500' 
                              : 'bg-emerald-500 group-hover:bg-emerald-600'
                        }`}
                      ></div>
                      <span className="text-[10px] font-bold text-slate-500">
                        {d.dayNumber}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ============================================================== */}
      {/* POPOVER FLUTUANTE DE EDIÇÃO RÁPIDA DE CÉLULA */}
      {/* ============================================================== */}
      {activeCellPopover && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-2xs"
          onClick={() => setActiveCellPopover(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 max-w-sm w-full animate-in fade-in zoom-in-95 duration-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  {activeCellPopover.operatorName}
                </h4>
                <p className="text-xs text-slate-500">
                  Data: <span className="font-bold text-blue-600">{activeCellPopover.dateStr}</span> ({activeCellPopover.shiftName})
                </p>
              </div>
              <button 
                onClick={() => setActiveCellPopover(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Selecione o Status:
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'PRESENCA'
                })}
                className="p-2.5 rounded-xl bg-[#c6efce] hover:bg-[#b5e7bd] text-[#006100] font-bold text-xs flex items-center gap-2 border border-[#a8e4b3] transition-all cursor-pointer shadow-2xs"
              >
                <span className="text-base">✓</span>
                <span>Presença Normal</span>
              </button>

              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'FG'
                })}
                className="p-2.5 rounded-xl bg-[#2d7d32] hover:bg-[#256c2a] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">FG</span>
                <span>Folga</span>
              </button>

              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'DOM'
                })}
                className="p-2.5 rounded-xl bg-[#7b1fa2] hover:bg-[#681989] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">DOM</span>
                <span>Domingo</span>
              </button>

              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'FERIAS'
                })}
                className="p-2.5 rounded-xl bg-[#f57c00] hover:bg-[#e07000] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">FÉR</span>
                <span>Férias</span>
              </button>

              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'DOFF'
                })}
                className="p-2.5 rounded-xl bg-[#d81b60] hover:bg-[#c2185b] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">DOFF</span>
                <span>Day Off</span>
              </button>

              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'FJ'
                })}
                className="p-2.5 rounded-xl bg-[#00838f] hover:bg-[#006e78] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">FJ</span>
                <span>Folga Just.</span>
              </button>

              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'AT'
                })}
                className="p-2.5 rounded-xl bg-[#0288d1] hover:bg-[#0275b3] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">AT</span>
                <span>Atestado</span>
              </button>

              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'HOME'
                })}
                className="p-2.5 rounded-xl bg-[#f8bbd0] hover:bg-[#f4a1bd] text-[#880e4f] font-bold text-xs flex items-center gap-2 border border-[#f48fb1] transition-all cursor-pointer shadow-2xs"
              >
                <span className="px-1.5 py-0.5 bg-white/40 rounded text-[10px]">HM</span>
                <span>Home Office</span>
              </button>

              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'FALTA'
                })}
                className="p-2.5 rounded-xl bg-[#c62828] hover:bg-[#b02222] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">F</span>
                <span>Falta</span>
              </button>

              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'INATIVO'
                })}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 border border-slate-200 transition-all cursor-pointer shadow-2xs"
              >
                <span className="px-1.5 py-0.5 bg-white rounded text-[10px]">x</span>
                <span>Fora Escala</span>
              </button>
            </div>

            {/* Inserir Horário Específico (Entrada / Atraso / Extra) */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-red-600" />
                <span>Horário Específico / Entrada (Vermelho):</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: 06:17, 14:43, 09:08"
                  defaultValue={activeCellPopover.currentTimeText || ''}
                  id="custom_time_input"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-bold"
                />
                <button
                  onClick={() => {
                    const el = document.getElementById('custom_time_input') as HTMLInputElement;
                    const val = el?.value?.trim();
                    if (!val) return;
                    updateCellMutation.mutate({
                      operatorName: activeCellPopover.operatorName,
                      shiftName: activeCellPopover.shiftName,
                      shiftDate: activeCellPopover.dateStr,
                      statusCode: 'HORARIO',
                      customTimeText: val
                    });
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </div>

            {/* Botão de Limpar Célula */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
              <button
                onClick={() => updateCellMutation.mutate({
                  operatorName: activeCellPopover.operatorName,
                  shiftName: activeCellPopover.shiftName,
                  shiftDate: activeCellPopover.dateStr,
                  statusCode: 'CLEAR'
                })}
                className="text-xs font-semibold text-slate-400 hover:text-red-600 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Célula</span>
              </button>

              <button
                onClick={() => setActiveCellPopover(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: LANÇAR PERÍODO EM LOTE (EX: FÉRIAS DE 15 DIAS) */}
      {/* ============================================================== */}
      {isBulkPeriodOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Lançar Período em Lote</h3>
                  <p className="text-xs text-slate-500">Aplique férias, folgas ou atestados para vários dias</p>
                </div>
              </div>
              <button onClick={() => setIsBulkPeriodOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4">
              
              {/* Seleção do Colaborador */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Colaborador:</label>
                <select
                  value={bulkMember}
                  onChange={e => setBulkMember(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">-- Todos os Colaboradores do Turno --</option>
                  {turnoGroups.flatMap(g => g.members).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Se for para o turno inteiro */}
              {bulkMember === 'all' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Turno Afetado:</label>
                  <select
                    value={bulkTargetTurno}
                    onChange={e => setBulkTargetTurno(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todos os Turnos</option>
                    {turnoGroups.map(g => (
                      <option key={g.id} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Datas de Início e Fim */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Data Inicial:</label>
                  <input
                    type="date"
                    value={bulkStartDate}
                    onChange={e => setBulkStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Data Final:</label>
                  <input
                    type="date"
                    value={bulkEndDate}
                    onChange={e => setBulkEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Status a Aplicar */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Status a Aplicar:</label>
                <select
                  value={bulkStatusCode}
                  onChange={e => setBulkStatusCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                >
                  <option value="FERIAS">FÉRIAS (Férias Regulamentares)</option>
                  <option value="FG">FG (Folga da Escala)</option>
                  <option value="DOM">DOM (Folga de Domingo)</option>
                  <option value="DOFF">DOFF (Day Off)</option>
                  <option value="FJ">FJ (Folga Justificada)</option>
                  <option value="AT">AT (Atestado Médico)</option>
                  <option value="HOME">HOME (Home Office)</option>
                  <option value="PRESENCA">✓ Presença (Trabalho Normal)</option>
                  <option value="CLEAR">Limpar Período (Remover Escala)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setIsBulkPeriodOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => bulkApplyPeriodMutation.mutate()}
                  disabled={bulkApplyPeriodMutation.isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {bulkApplyPeriodMutation.isPending ? 'Aplicando...' : 'Aplicar Período'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: GESTÃO DE EQUIPE E TURNOS */}
      {/* ============================================================== */}
      {isManageTeamsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Gerenciar Equipe e Turnos</h3>
                  <p className="text-xs text-slate-500">Organize os colaboradores nos grupos da escala</p>
                </div>
              </div>
              <button onClick={() => setIsManageTeamsOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-6 pr-1">
              
              {/* Criar Novo Turno */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700">Criar Novo Turno / Departamento:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome do turno (ex: Suporte Noite, Plantão 12x36)..."
                    value={newTurnoName}
                    onChange={e => setNewTurnoName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  />
                  <button
                    onClick={handleCreateNewTurno}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                  >
                    Adicionar Turno
                  </button>
                </div>
              </div>

              {/* Lista dos Turnos e seus Integrantes */}
              <div className="flex flex-col gap-4">
                {turnoGroups.map(group => (
                  <div key={group.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                      <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <span>{group.name}</span>
                        <span className="text-[11px] font-normal text-slate-500">({group.members.length} membros)</span>
                      </div>
                      <button
                        onClick={() => {
                          setNewMemberTurno(group.name);
                          setIsAddMemberModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Adicionar Membro</span>
                      </button>
                    </div>

                    <div className="p-3 divide-y divide-slate-100">
                      {group.members.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2 text-center">Nenhum colaborador neste turno.</p>
                      ) : (
                        group.members.map(member => (
                          <div key={member} className="py-2 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 font-medium text-slate-800">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{member}</span>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Mover para outro turno */}
                              <select
                                value={group.name}
                                onChange={e => handleMoveMemberTurno(member, group.name, e.target.value)}
                                className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-slate-600"
                              >
                                {turnoGroups.map(g => (
                                  <option key={g.id} value={g.name}>Mover para {g.name}</option>
                                ))}
                              </select>

                              <button
                                onClick={() => handleRemoveMemberFromTurno(member, group.name)}
                                className="text-slate-400 hover:text-red-600 p-1"
                                title="Remover"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setIsManageTeamsOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ADICIONAR NOVO COLABORADOR AO TURNO */}
      {/* ============================================================== */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-base mb-1">Adicionar à Escala</h3>
            <p className="text-xs text-slate-500 mb-4">
              Turno destino: <span className="font-bold text-blue-600">{newMemberTurno}</span>
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Nome do Colaborador:</label>
                <input
                  type="text"
                  placeholder="Digite o nome completo..."
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Sugestões de Membros do Workspace / Setor */}
              {sectorProfiles && sectorProfiles.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Ou selecione do setor:
                  </span>
                  <div className="max-h-32 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50 p-1">
                    {sectorProfiles.map(p => {
                      const name = p.email?.split('@')[0] || p.email;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setNewMemberName(name)}
                          className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded transition-colors font-medium flex items-center justify-between"
                        >
                          <span>{p.email}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{p.role}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleAddMemberToTurno(newMemberName, newMemberTurno)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
