'use client';

import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, Search, Filter, 
  Trash2, Edit, User, Clock, Check, CheckCircle2, X, Layers, 
  CalendarDays, RefreshCw, Download, Sparkles, Settings, Users, 
  BarChart2, LayoutGrid, List, CalendarRange, AlertCircle, Eye, 
  Share2, Copy, UserPlus, FileSpreadsheet, TrendingUp, Sun, Moon, 
  Coffee, Briefcase, Zap, Info, ShieldAlert, Award, FileText,
  CheckSquare, Square, ArrowRight
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
  EXT: {
    code: 'EXT',
    label: 'Trabalho Externo',
    shortLabel: 'EXT',
    bgClass: 'bg-[#3949ab]',
    textClass: 'text-white',
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

// Turnos Padrão (Sem colaboradores pré-fixados para que o usuário monte sua própria equipe)
const DEFAULT_TURNO_GROUPS: TurnoGroup[] = [
  { id: 'admin', name: 'Administração', color: 'emerald', icon: 'Briefcase', members: [] },
  { id: 'manha', name: 'Manhã', color: 'sky', icon: 'Sun', members: [] },
  { id: 'intermedio', name: 'Intermédio', color: 'amber', icon: 'Coffee', members: [] },
  { id: 'tarde', name: 'Tarde', color: 'orange', icon: 'Sun', members: [] },
  { id: 'madrugada', name: 'Madrugada', color: 'indigo', icon: 'Moon', members: [] }
];

// Nomes de Exemplo da imagem caso o usuário deseje carregar para testes
const DEMO_EXAMPLE_GROUPS: TurnoGroup[] = [
  {
    id: 'admin',
    name: 'Administração',
    color: 'emerald',
    icon: 'Briefcase',
    members: ['Kelly Bezerra', 'Fabiano de Jesus', 'Raquel Nunes', 'Aris Iorondi', 'Ruan Dalsom', 'Samuel Damazio', 'Vitor Enrique']
  },
  {
    id: 'manha',
    name: 'Manhã',
    color: 'sky',
    icon: 'Sun',
    members: ['Davis Marques', 'Athalya Ferreira', 'Igor Silva', 'Thaisa Camila']
  },
  {
    id: 'intermedio',
    name: 'Intermédio',
    color: 'amber',
    icon: 'Coffee',
    members: ['Fernanda Ribeiro', 'Felipe Santana', 'Juan Ferreira']
  },
  {
    id: 'tarde',
    name: 'Tarde',
    color: 'orange',
    icon: 'Sun',
    members: ['Pedro Luiz Souza', 'Ronald Santos Silva', 'Jéssica Alves Batista']
  },
  {
    id: 'madrugada',
    name: 'Madrugada',
    color: 'indigo',
    icon: 'Moon',
    members: ['Waldinei Macário', 'Arieli do Carmo da Silva Cruz']
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
const DOW_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

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

  // Modais
  const [isScaleWizardOpen, setIsScaleWizardOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isManageTeamsOpen, setIsManageTeamsOpen] = useState(false);

  // Popover de Edição de Célula Ativa
  const [activeCellPopover, setActiveCellPopover] = useState<{
    dateStr: string;
    operatorName: string;
    shiftName: string;
    anchorRect: DOMRect | null;
    currentCode: string;
    currentTimeText: string;
  } | null>(null);

  // Estado do Modal de Adicionar Colaboradores (Individual vs Em Grupo)
  const [addModeTab, setAddModeTab] = useState<'group' | 'bulk_text' | 'single'>('group');
  const [targetTurnoForAdd, setTargetTurnoForAdd] = useState('Administração');
  const [selectedSectorUserIds, setSelectedSectorUserIds] = useState<string[]>([]);
  const [bulkNamesText, setBulkNamesText] = useState('');
  const [singleMemberName, setSingleMemberName] = useState('');

  // Estado do Gerador / Aplicador de Escalas e Folgas (Escala 5x2 Diferenciada, etc.)
  const [scaleTabMode, setScaleTabMode] = useState<'5x2' | 'manual_days' | 'period'>('5x2');
  const [scaleSelectedMembers, setScaleSelectedMembers] = useState<string[]>([]);
  const [scaleSelectAll, setScaleSelectAll] = useState(false);

  // Campos da Escala 5x2 Diferenciada:
  // Folga na semana: 1 = seg, 2 = ter, 3 = qua, 4 = qui, 5 = sex
  const [scaleWeekdayOff, setScaleWeekdayOff] = useState<number>(3); // padrão: Quarta-feira
  // Folga no final de semana: 'alternate' (1 semana sab, 1 semana dom), 'sat_fixed', 'sun_fixed'
  const [scaleWeekendOffMode, setScaleWeekendOffMode] = useState<'alternate' | 'sat_fixed' | 'sun_fixed'>('alternate');
  const [scaleRestFillMode, setScaleRestFillMode] = useState<'PRESENCA' | 'HOME' | 'EXT' | 'EMPTY'>('PRESENCA');

  // Campos da Escolha Manual de Folgas
  const [manualOffDates, setManualOffDates] = useState<string[]>([]);

  // Campos de Período Contínuo (ex: Férias 15 dias)
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [periodStatusCode, setPeriodStatusCode] = useState('FERIAS');

  // Gerenciamento de Turnos
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
  const { data: sectorMembersList } = useQuery({
    queryKey: ['sector_members_for_roster_v2', boardData?.workspace_id],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, email, avatar_url, role').order('email');
      if (!profiles) return [];
      if (!boardData?.workspace_id) return profiles;

      const { data: members } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', boardData.workspace_id);
      const memberUserIds = new Set((members || []).map((m: any) => m.user_id));

      return profiles.filter(p => p.role === 'admin' || memberUserIds.has(p.id));
    },
    staleTime: 5 * 60 * 1000
  });

  // 3.5. Busca Todos os Perfis do Sistema para Lookup de Foto e Cargo
  const { data: allProfiles } = useQuery({
    queryKey: ['all_profiles_lookup_roster'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, email, avatar_url, role').order('email');
      if (error) {
        console.warn('Erro ao carregar perfis para foto e cargo:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // Helper para buscar perfil de usuário por nome/email
  const getMemberProfile = (name: string) => {
    if (!name || !allProfiles || allProfiles.length === 0) return null;
    const clean = name.toLowerCase().trim();
    const cleanAlpha = clean.replace(/[^a-z0-9]/g, '');

    // 1. Match exato com email
    const exactEmail = allProfiles.find(p => p.email?.toLowerCase().trim() === clean);
    if (exactEmail) return exactEmail;

    // 2. Match com prefixo antes do @
    const prefixMatch = allProfiles.find(p => {
      const prefix = (p.email?.split('@')[0] || '').toLowerCase().trim();
      return prefix === clean;
    });
    if (prefixMatch) return prefixMatch;

    // 3. Match ignorando caracteres especiais (pontos, traços, espaços)
    const alphaMatch = allProfiles.find(p => {
      const prefix = (p.email?.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return prefix === cleanAlpha;
    });
    if (alphaMatch) return alphaMatch;

    // 4. Match pelo primeiro nome se for único
    const parts = clean.split(/[\s._-]+/).filter(Boolean);
    const firstName = parts[0];
    if (firstName && firstName.length >= 3) {
      const candidates = allProfiles.filter(p => {
        const prefixParts = (p.email?.split('@')[0] || '').toLowerCase().split(/[\s._-]+/).filter(Boolean);
        return prefixParts.includes(firstName);
      });
      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1 && parts.length > 1) {
        const matchSurname = candidates.find(c => {
          const cPrefix = (c.email?.split('@')[0] || '').toLowerCase();
          return parts.slice(1).some(pt => pt.length >= 3 && cPrefix.includes(pt));
        });
        if (matchSurname) return matchSurname;
      }
    }

    return null;
  };

  // Helper para formatar o badge de cargo
  const getRoleBadge = (role?: string) => {
    const r = (role || '').toLowerCase().trim();
    if (r === 'admin' || r === 'administrador') {
      return { label: 'Administrador', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (r === 'leader' || r === 'lider' || r === 'líder') {
      return { label: 'Líder', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
    if (r === 'user' || r === 'operador' || r === 'membro') {
      return { label: 'Operador', bg: 'bg-slate-50 text-slate-600 border-slate-200' };
    }
    return null;
  };

  // Permissão de Gerenciamento (Líderes e Administradores)
  const canManageRoster = useMemo(() => {
    if (isReadOnly) return false;
    const role = (currentUser?.profile?.role || '').toLowerCase().trim();
    return role === 'admin' || role === 'administrador' || role === 'leader' || role === 'lider' || role === 'líder';
  }, [currentUser, isReadOnly]);

  // 4. Configurações dos Turnos e Colaboradores Salvas no Banco
  const { data: rosterSettings } = useQuery({
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
      return rosterSettings.shifts.map((s: any): TurnoGroup => ({
        id: s.id || s.name.toLowerCase().replace(/\s+/g, '_'),
        name: s.name,
        color: s.color || 'blue',
        members: Array.isArray(s.members) ? s.members : []
      }));
    }
    return DEFAULT_TURNO_GROUPS;
  }, [rosterSettings]);

  // Total de Colaboradores Cadastrados
  const totalRosterMembersCount = useMemo(() => {
    return turnoGroups.reduce((acc, g) => acc + g.members.length, 0);
  }, [turnoGroups]);

  // 5. Busca Todas as Escalas do Mês Atual
  const { data: rawShiftsData } = useQuery({
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

  // Salvar Grupos de Turnos no Banco
  const saveTurnoGroupsMutation = useMutation({
    mutationFn: async (updatedGroups: TurnoGroup[]) => {
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

      let dbStatus = statusCode;
      let notes = customTimeText || '';

      if (statusCode === 'PRESENCA') {
        dbStatus = 'Confirmado';
      } else if (statusCode === 'HORARIO' && customTimeText) {
        dbStatus = customTimeText;
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

  // Mutação para Aplicação Inteligente de Escala (5x2 Diferenciada, Escolha Manual de Folgas, Período)
  const applySmartScaleMutation = useMutation({
    mutationFn: async () => {
      if (!canManageRoster) throw new Error("Apenas Líderes e Administradores podem lançar escalas.");
      if (scaleSelectedMembers.length === 0) throw new Error("Selecione pelo menos um colaborador.");

      const rowsToInsert: any[] = [];
      const datesToClear: string[] = [];

      // MODO 1: ESCALA 5x2 DIFERENCIADA (1 DIA DA SEMANA + 1 DIA DO FIM DE SEMANA)
      if (scaleTabMode === '5x2') {
        for (let d = 1; d <= daysInCurrentMonth; d++) {
          const dStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          datesToClear.push(dStr);

          const dateObj = new Date(currentYear, currentMonthIndex, d);
          const dow = dateObj.getDay(); // 0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sab

          // Determina a semana do mês (0, 1, 2, 3, 4)
          const weekIndex = Math.floor((d - 1) / 7);

          // Folga no final de semana alternada
          let isWeekendOff = false;
          let weekendStatus = 'FG';

          if (scaleWeekendOffMode === 'alternate') {
            if (weekIndex % 2 === 0) {
              // Semana par: folga no Sábado
              if (dow === 6) { isWeekendOff = true; weekendStatus = 'FG'; }
            } else {
              // Semana ímpar: folga no Domingo
              if (dow === 0) { isWeekendOff = true; weekendStatus = 'DOM'; }
            }
          } else if (scaleWeekendOffMode === 'sat_fixed') {
            if (dow === 6) { isWeekendOff = true; weekendStatus = 'FG'; }
          } else if (scaleWeekendOffMode === 'sun_fixed') {
            if (dow === 0) { isWeekendOff = true; weekendStatus = 'DOM'; }
          }

          // Folga no dia da semana escolhido
          const isWeekdayOff = (dow === scaleWeekdayOff);

          scaleSelectedMembers.forEach(memberName => {
            const group = turnoGroups.find(g => g.members.includes(memberName));
            const shiftName = group?.name || 'Geral';

            let finalStatus = '';
            if (isWeekdayOff) {
              finalStatus = 'FG';
            } else if (isWeekendOff) {
              finalStatus = weekendStatus;
            } else {
              // Demais dias: conforme opção escolhida
              if (scaleRestFillMode === 'PRESENCA') finalStatus = 'Confirmado';
              else if (scaleRestFillMode === 'EXT') finalStatus = 'EXT';
              else if (scaleRestFillMode === 'HOME') finalStatus = 'HOME';
            }

            if (finalStatus) {
              rowsToInsert.push({
                board_id: boardId,
                workspace_id: boardData?.workspace_id || null,
                shift_date: dStr,
                shift_name: shiftName,
                region_name: 'Geral',
                operator_name: memberName,
                operator_type: 'Turno Mensal',
                status: finalStatus,
                notes: ''
              });
            }
          });
        }
      } 
      // MODO 2: ESCOLHA MANUAL DE FOLGAS NO MÊS
      else if (scaleTabMode === 'manual_days') {
        if (manualOffDates.length === 0) throw new Error("Selecione os dias de folga no calendário.");

        for (let d = 1; d <= daysInCurrentMonth; d++) {
          const dStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          datesToClear.push(dStr);

          const dateObj = new Date(currentYear, currentMonthIndex, d);
          const dow = dateObj.getDay();
          const isMarkedOff = manualOffDates.includes(dStr);

          scaleSelectedMembers.forEach(memberName => {
            const group = turnoGroups.find(g => g.members.includes(memberName));
            const shiftName = group?.name || 'Geral';

            let finalStatus = '';
            if (isMarkedOff) {
              finalStatus = (dow === 0) ? 'DOM' : 'FG';
            } else {
              if (scaleRestFillMode === 'PRESENCA') finalStatus = 'Confirmado';
              else if (scaleRestFillMode === 'EXT') finalStatus = 'EXT';
              else if (scaleRestFillMode === 'HOME') finalStatus = 'HOME';
            }

            if (finalStatus) {
              rowsToInsert.push({
                board_id: boardId,
                workspace_id: boardData?.workspace_id || null,
                shift_date: dStr,
                shift_name: shiftName,
                region_name: 'Geral',
                operator_name: memberName,
                operator_type: 'Turno Mensal',
                status: finalStatus,
                notes: ''
              });
            }
          });
        }
      }
      // MODO 3: PERÍODO CONTÍNUO (FÉRIAS / ATESTADO)
      else if (scaleTabMode === 'period') {
        if (!periodStartDate || !periodEndDate) throw new Error("Informe a data de início e fim.");
        const start = new Date(`${periodStartDate}T00:00:00`);
        const end = new Date(`${periodEndDate}T00:00:00`);
        if (start > end) throw new Error("A data inicial deve ser anterior à final.");

        let curr = new Date(start);
        while (curr <= end) {
          const dStr = curr.toISOString().split('T')[0];
          datesToClear.push(dStr);

          scaleSelectedMembers.forEach(memberName => {
            const group = turnoGroups.find(g => g.members.includes(memberName));
            const shiftName = group?.name || 'Geral';

            rowsToInsert.push({
              board_id: boardId,
              workspace_id: boardData?.workspace_id || null,
              shift_date: dStr,
              shift_name: shiftName,
              region_name: 'Geral',
              operator_name: memberName,
              operator_type: 'Turno Mensal',
              status: periodStatusCode,
              notes: ''
            });
          });

          curr.setDate(curr.getDate() + 1);
        }
      }

      // Deleta dados existentes para estes membros e datas
      for (const m of scaleSelectedMembers) {
        await supabase
          .from('operational_shifts')
          .delete()
          .eq('board_id', boardId)
          .eq('operator_name', m)
          .in('shift_date', datesToClear);
      }

      // Insere as novas células
      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from('operational_shifts').insert(rowsToInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_shifts_roster'] });
      setIsScaleWizardOpen(false);
      alert("Escala lançada com sucesso!");
    },
    onError: (err: any) => {
      alert("Erro ao lançar escala: " + err.message);
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
    if (upper === 'EXT' || upper === 'EXTERNO' || upper === 'TRABALHO EXTERNO') {
      return { def: ROSTER_STATUSES.EXT, customText: 'EXT', rawStatus: raw };
    }
    if (upper === 'F' || upper === 'FALTA') {
      return { def: ROSTER_STATUSES.FALTA, customText: 'F', rawStatus: raw };
    }
    if (upper === 'X' || upper === 'INATIVO') {
      return { def: ROSTER_STATUSES.INATIVO, customText: 'x', rawStatus: raw };
    }

    if (/^\d{1,2}:\d{2}$/.test(raw) || /^\d{1,2}H\d{0,2}$/i.test(raw)) {
      return { def: ROSTER_STATUSES.HORARIO, customText: raw, rawStatus: raw };
    }

    if (row.notes && /^\d{1,2}:\d{2}$/.test(row.notes.trim())) {
      return { def: ROSTER_STATUSES.HORARIO, customText: row.notes.trim(), rawStatus: raw };
    }

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
      const dayOfWeek = dateObj.getDay();
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

  // Lista unificada de colaboradores na ordem dos turnos para exibição limpa na tabela
  const flattenedMembers = useMemo(() => {
    const list: { member: string; turnoName: string; turnoId: string; turnoColor?: string }[] = [];
    filteredGroups.forEach(g => {
      g.members.forEach(m => {
        list.push({
          member: m,
          turnoName: g.name,
          turnoId: g.id,
          turnoColor: g.color
        });
      });
    });
    return list;
  }, [filteredGroups]);

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

  // Adicionar Colaboradores em Massa ou Individual
  const handleConfirmAddMembers = () => {
    let namesToAdd: string[] = [];

    if (addModeTab === 'group') {
      const selectedProfiles = (sectorMembersList || []).filter(p => selectedSectorUserIds.includes(p.id));
      namesToAdd = selectedProfiles.map(p => {
        const emailName = p.email?.split('@')[0] || '';
        return emailName.charAt(0).toUpperCase() + emailName.slice(1);
      });
    } else if (addModeTab === 'bulk_text') {
      namesToAdd = bulkNamesText
        .split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);
    } else if (addModeTab === 'single') {
      if (singleMemberName.trim()) {
        namesToAdd = [singleMemberName.trim()];
      }
    }

    if (namesToAdd.length === 0) {
      alert("Selecione ou digite ao menos um colaborador.");
      return;
    }

    const updated = turnoGroups.map(g => {
      if (g.name === targetTurnoForAdd) {
        const existingSet = new Set(g.members);
        const merged = [...g.members];
        namesToAdd.forEach(n => {
          if (!existingSet.has(n)) {
            existingSet.add(n);
            merged.push(n);
          }
        });
        return { ...g, members: merged };
      }
      return g;
    });

    saveTurnoGroupsMutation.mutate(updated);
    setSelectedSectorUserIds([]);
    setBulkNamesText('');
    setSingleMemberName('');
    setIsAddMemberModalOpen(false);
  };

  // Limpar Nomes de Exemplo
  const handleClearDemoMembers = () => {
    if (!confirm("Deseja limpar todos os colaboradores e começar do zero com sua própria equipe?")) return;
    const cleanGroups = turnoGroups.map(g => ({ ...g, members: [] }));
    saveTurnoGroupsMutation.mutate(cleanGroups);
  };

  // Carregar Exemplo de Demonstração
  const handleLoadDemoExample = () => {
    if (!confirm("Deseja carregar a lista de exemplo da imagem de demonstração?")) return;
    saveTurnoGroupsMutation.mutate(DEMO_EXAMPLE_GROUPS);
  };

  // Remover Colaborador Individual
  const handleRemoveMember = (name: string, turnoName: string) => {
    if (!confirm(`Remover "${name}" da escala?`)) return;
    const updated = turnoGroups.map(g => {
      if (g.name === turnoName) {
        return { ...g, members: g.members.filter(m => m !== name) };
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
      
      {/* 1. BARRA SUPERIOR: TÍTULO, SELETOR DE MÊS, VISÕES E AÇÕES */}
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
                  Controle de vindas, folgas 5x2, férias e atestados da equipe
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

          {/* Seletor de Visões e Botões de Gestão */}
          <div className="flex flex-wrap items-center gap-2.5">
            
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

            {/* BOTÕES DE GESTÃO PARA LÍDER / ADMIN */}
            {canManageRoster && (
              <>
                {/* 1. Lançar Escala & Folgas (5x2 Diferenciada ou Manual) */}
                <button
                  onClick={() => {
                    const allM = turnoGroups.flatMap(g => g.members);
                    setScaleSelectedMembers(allM);
                    setScaleSelectAll(true);
                    setManualOffDates([]);
                    setPeriodStartDate(startOfMonthStr);
                    setPeriodEndDate(endOfMonthStr);
                    setIsScaleWizardOpen(true);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Gerar escala 5x2 ou escolher dias de folga preenchendo as presenças"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Lançar Escala & Folgas</span>
                </button>

                {/* 2. Adicionar Colaboradores (Individual ou em Grupo) */}
                <button
                  onClick={() => setIsAddMemberModalOpen(true)}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Adicionar Colaborador</span>
                </button>

                {/* 3. Gerenciar Equipe & Turnos */}
                <button
                  onClick={() => setIsManageTeamsOpen(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Equipe & Turnos</span>
                </button>
              </>
            )}

            {/* Exportar Planilha */}
            <button
              onClick={handleExportCSV}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer"
              title="Exportar Planilha Excel/CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. BARRA DE FILTROS E LEGENDA */}
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
                <option value="EXT">EXT (Trabalho Externo)</option>
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
            <span className="px-1.5 py-0.5 rounded bg-[#3949ab] text-white shadow-2xs" title="EXT = Trabalho Externo">
              EXT
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

        {/* Banner Informativo se o Quadro estiver vazio */}
        {totalRosterMembersCount === 0 && canManageRoster && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-3">
              <span className="text-xl">👋</span>
              <div>
                <p className="font-bold text-sm text-blue-950">Seu quadro de turnos está pronto para começar!</p>
                <p className="text-blue-700">Adicione os colaboradores da sua equipe (individualmente ou em grupo) para montar a escala mensal.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddMemberModalOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Adicionar Colaboradores</span>
              </button>
              <button
                onClick={handleLoadDemoExample}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold rounded-lg cursor-pointer text-xs"
              >
                Carregar Exemplo de Demonstração
              </button>
            </div>
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
              
              {/* TABELA COM LARGURAS FIXAS E CABEÇALHO PERFEITAMENTE ALINHADO */}
              <table className="border-collapse text-xs select-none table-fixed">
                
                {/* COLGROUP COM LARGURAS RÍGIDAS PARA ALINHAMENTO PIXEL-PERFECT */}
                <colgroup>
                  <col style={{ width: '260px', minWidth: '260px' }} />
                  {monthDaysList.map(d => (
                    <col key={d.dateStr} style={{ width: '38px', minWidth: '38px' }} />
                  ))}
                  <col style={{ width: '42px', minWidth: '42px' }} />
                  <col style={{ width: '42px', minWidth: '42px' }} />
                  <col style={{ width: '42px', minWidth: '42px' }} />
                  <col style={{ width: '42px', minWidth: '42px' }} />
                  <col style={{ width: '42px', minWidth: '42px' }} />
                  <col style={{ width: '42px', minWidth: '42px' }} />
                </colgroup>

                {/* CABEÇALHO COM OS DIAS DO MÊS DIRETAMENTE EM CIMA DAS CÉLULAS */}
                <thead>
                  <tr className="bg-slate-100 text-slate-700 divide-x divide-slate-200 border-b border-slate-200 sticky top-0 z-30 shadow-2xs h-12">
                    
                    {/* Coluna Fixa do Colaborador */}
                    <th className="sticky left-0 z-40 bg-slate-100 text-slate-800 px-3 py-2 text-left font-bold text-xs uppercase tracking-wider border-r border-slate-200">
                      <div className="flex items-center justify-between">
                        <span>Colaborador</span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {MONTH_SHORT[currentMonthIndex]}/{currentYear}
                        </span>
                      </div>
                    </th>

                    {/* Colunas dos Dias 1..31 (Diretamente alinhadas com as células abaixo) */}
                    {monthDaysList.map(d => (
                      <th 
                        key={d.dateStr} 
                        className={`p-0 text-center font-bold transition-colors border-r ${
                          d.isSunday 
                            ? 'bg-purple-50 text-purple-900 border-purple-200/80' 
                            : d.isWeekend 
                              ? 'bg-amber-50 text-amber-900 border-amber-200/80' 
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center leading-tight py-1">
                          <span className="text-[11px] font-extrabold tracking-tight">{d.label}</span>
                          <span className={`text-[9px] font-bold uppercase ${
                            d.isSunday ? 'text-purple-600' : d.isWeekend ? 'text-amber-600' : 'text-slate-400'
                          }`}>
                            {d.dayNameShort}
                          </span>
                        </div>
                      </th>
                    ))}

                    {/* Colunas de Resumo de Totais */}
                    <th className="bg-emerald-50 text-emerald-800 px-1 py-1 text-center font-bold text-[10px] border-r border-slate-200" title="Dias Trabalhados">
                      ✓
                    </th>
                    <th className="bg-green-50 text-green-800 px-1 py-1 text-center font-bold text-[10px] border-r border-slate-200" title="Total Folgas (FG/DOM/DOFF/FJ)">
                      FG
                    </th>
                    <th className="bg-amber-50 text-amber-800 px-1 py-1 text-center font-bold text-[10px] border-r border-slate-200" title="Férias">
                      FÉR
                    </th>
                    <th className="bg-sky-50 text-sky-800 px-1 py-1 text-center font-bold text-[10px] border-r border-slate-200" title="Atestados">
                      AT
                    </th>
                    <th className="bg-pink-50 text-pink-800 px-1 py-1 text-center font-bold text-[10px] border-r border-slate-200" title="Home Office">
                      HM
                    </th>
                    <th className="bg-red-50 text-red-800 px-1 py-1 text-center font-bold text-[10px] border-r border-slate-200" title="Atrasos / Faltas">
                      ATR
                    </th>
                  </tr>
                </thead>

                {/* CORPO DA TABELA (ÚNICO TBODY VÁLIDO) */}
                <tbody className="divide-y divide-slate-200 bg-white">
                  {flattenedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={monthDaysList.length + 7} className="p-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Users className="w-8 h-8 text-slate-300" />
                          <p className="font-semibold text-sm">Nenhum colaborador na escala deste setor.</p>
                          {canManageRoster && (
                            <button
                              onClick={() => setIsAddMemberModalOpen(true)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer"
                            >
                              + Adicionar Colaboradores da Equipe
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    flattenedMembers.map(item => {
                      const member = item.member;
                      const stats = memberMonthlyStats.get(member);
                      const profile = getMemberProfile(member);
                      const roleBadge = getRoleBadge(profile?.role);

                      return (
                        <tr 
                          key={`${item.turnoId}_${member}`}
                          className="hover:bg-slate-50/80 transition-colors divide-x divide-slate-100 group/row"
                        >
                          
                          {/* COLUNA FIXA: NOME DO COLABORADOR, TURNO E CARGO */}
                          <td className="sticky left-0 z-10 bg-white group-hover/row:bg-slate-50 px-3 py-2 border-r border-slate-200 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                
                                {/* Foto de Avatar Real ou Letra Inicial Fallback */}
                                {profile?.avatar_url ? (
                                  <img 
                                    src={profile.avatar_url} 
                                    alt={member} 
                                    className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0" 
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-300 shadow-2xs">
                                    {member.charAt(0).toUpperCase()}
                                  </div>
                                )}

                                <div className="flex flex-col min-w-0 leading-snug">
                                  <span className="truncate text-xs font-bold text-slate-900" title={member}>
                                    {member}
                                  </span>
                                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                    {/* Turno */}
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200/60 truncate max-w-[110px]" title={`Turno: ${item.turnoName}`}>
                                      {item.turnoName}
                                    </span>
                                    {/* Cargo */}
                                    {roleBadge ? (
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border truncate max-w-[110px] ${roleBadge.bg}`} title={`Cargo: ${roleBadge.label}`}>
                                        {roleBadge.label}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-medium px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200" title="Colaborador / Add-on">
                                        Operador
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {canManageRoster && (
                                <button
                                  onClick={() => handleRemoveMember(member, item.turnoName)}
                                  className="opacity-0 group-hover/row:opacity-100 text-slate-400 hover:text-red-600 p-1 rounded transition-opacity cursor-pointer shrink-0"
                                  title="Remover da Escala"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
                                    shiftName: item.turnoName,
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
                    })
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

              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: new Date(currentYear, currentMonthIndex, 1).getDay() }).map((_, i) => (
                  <div key={`empty_${i}`} className="min-h-[110px] bg-slate-50/60 rounded-xl border border-dashed border-slate-200/60 p-2"></div>
                ))}

                {monthDaysList.map(d => {
                  let workCount = 0;
                  let offCount = 0;
                  let vacCount = 0;
                  let atCount = 0;

                  turnoGroups.forEach(g => {
                    g.members.forEach(m => {
                      const res = resolveCellStatus(m, d.dateStr);
                      if (res.def) {
                        if (res.def.category === 'work') workCount++;
                        else if (res.def.category === 'off') offCount++;
                        else if (res.def.category === 'vacation') vacCount++;
                        else if (res.def.category === 'medical') atCount++;
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
        {/* VISÃO 3: CARDS DA EQUIPE */}
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

                    const profile = getMemberProfile(member);
                    const roleBadge = getRoleBadge(profile?.role);

                    return (
                      <div key={member} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-4 hover:shadow-md transition-shadow">
                        <div>
                          <div className="flex items-center gap-3">
                            {profile?.avatar_url ? (
                              <img 
                                src={profile.avatar_url} 
                                alt={member} 
                                className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0" 
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm border border-blue-200 shrink-0">
                                {member.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="truncate">
                              <h4 className="font-bold text-slate-900 text-sm truncate" title={member}>{member}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-slate-500 font-medium">{group.name}</span>
                                {roleBadge && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${roleBadge.bg}`}>
                                    {roleBadge.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

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
                              setScaleSelectedMembers([member]);
                              setScaleSelectAll(false);
                              setIsScaleWizardOpen(true);
                            }}
                            className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition-colors text-center cursor-pointer"
                          >
                            Lançar Escala / Folgas
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
        {/* VISÃO 4: MÉTRICAS & DASHBOARD */}
        {/* ============================================================== */}
        {activeViewMode === 'dashboard' && (
          <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Total Colaboradores</span>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1">
                    {totalRosterMembersCount}
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

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-800 mb-1">
                Efetivo Operacional Diário (Presença por Dia do Mês)
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Quantos colaboradores estão trabalhando em cada dia para garantir que não haja defasagem no setor.
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

                  const totalMembers = totalRosterMembersCount || 1;
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
      {/* MODAL PRINCIPAL: LANÇAR ESCALA & FOLGAS (5x2 DIFERENCIADA, MANUAL, ETC) */}
      {/* ============================================================== */}
      {isScaleWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Lançar Escala & Folgas no Mês</h3>
                  <p className="text-xs text-slate-500">
                    Defina as folgas e preencha automaticamente as presenças da equipe
                  </p>
                </div>
              </div>
              <button onClick={() => setIsScaleWizardOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5">
              
              {/* 1. SELEÇÃO DE COLABORADORES */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800">
                    Colaboradores que receberão esta escala:
                  </label>
                  <button
                    onClick={() => {
                      const all = turnoGroups.flatMap(g => g.members);
                      if (scaleSelectedMembers.length === all.length) {
                        setScaleSelectedMembers([]);
                        setScaleSelectAll(false);
                      } else {
                        setScaleSelectedMembers(all);
                        setScaleSelectAll(true);
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    {scaleSelectedMembers.length === turnoGroups.flatMap(g => g.members).length 
                      ? 'Desmarcar Todos' 
                      : 'Selecionar Todos da Equipe'}
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-1.5">
                  {turnoGroups.flatMap(g => g.members).map(member => {
                    const isChecked = scaleSelectedMembers.includes(member);
                    const profile = getMemberProfile(member);
                    const roleBadge = getRoleBadge(profile?.role);

                    return (
                      <label 
                        key={member}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked 
                            ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-bold' 
                            : 'bg-white border-slate-200 text-slate-700 font-medium hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setScaleSelectedMembers(prev => prev.filter(m => m !== member));
                            } else {
                              setScaleSelectedMembers(prev => [...prev, member]);
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt={member} className="w-5 h-5 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px] shrink-0">
                            {member.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{member}</span>
                        {roleBadge && (
                          <span className={`text-[9px] px-1 py-0.2 rounded border ml-auto shrink-0 ${roleBadge.bg}`}>
                            {roleBadge.label}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 2. ABAS DO TIPO DE LANÇAMENTO */}
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setScaleTabMode('5x2')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    scaleTabMode === '5x2'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ⚡ Escala 5x2 Diferenciada (Alternada)
                </button>

                <button
                  onClick={() => setScaleTabMode('manual_days')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    scaleTabMode === 'manual_days'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📅 Marcar Folgas no Mês (Manual)
                </button>

                <button
                  onClick={() => setScaleTabMode('period')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    scaleTabMode === 'period'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🏖️ Férias / Atestado (Período)
                </button>
              </div>

              {/* CONTEÚDO DA ABA 1: ESCALA 5x2 DIFERENCIADA */}
              {scaleTabMode === '5x2' && (
                <div className="flex flex-col gap-4 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
                  <div className="text-xs text-blue-900 leading-relaxed font-medium">
                    Nesta escala operacional 5x2, o colaborador tem <strong>2 folgas por semana</strong>: 1 em um dia fixo na semana e 1 no final de semana alternando entre sábado e domingo.
                  </div>

                  {/* Dia de Folga na Semana */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      1. Dia de Folga na Semana:
                    </label>
                    <select
                      value={scaleWeekdayOff}
                      onChange={e => setScaleWeekdayOff(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value={1}>Segunda-feira (FG)</option>
                      <option value={2}>Terça-feira (FG)</option>
                      <option value={3}>Quarta-feira (FG)</option>
                      <option value={4}>Quinta-feira (FG)</option>
                      <option value={5}>Sexta-feira (FG)</option>
                    </select>
                  </div>

                  {/* Folga no Final de Semana */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      2. Folga no Final de Semana:
                    </label>
                    <select
                      value={scaleWeekendOffMode}
                      onChange={e => setScaleWeekendOffMode(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="alternate">
                        🔄 Alternar: 1 semana Sábado (FG) e 1 semana Domingo (DOM)
                      </option>
                      <option value="sat_fixed">Fixo no Sábado (FG)</option>
                      <option value="sun_fixed">Fixo no Domingo (DOM)</option>
                    </select>
                  </div>

                  {/* Como preencher os demais dias */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      3. Os demais dias do mês serão preenchidos como:
                    </label>
                    <select
                      value={scaleRestFillMode}
                      onChange={e => setScaleRestFillMode(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="PRESENCA">✓ Presença / Veio Trabalhar (Normal)</option>
                      <option value="EXT">EXT (Trabalho Externo)</option>
                      <option value="HOME">HOME (Home Office)</option>
                      <option value="EMPTY">Deixar em branco (Apenas marcar as folgas)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* CONTEÚDO DA ABA 2: ESCOLHA MANUAL DE FOLGAS */}
              {scaleTabMode === 'manual_days' && (
                <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-xs text-slate-600 font-medium">
                    Clique nos dias do mês abaixo que serão <strong>FOLGA</strong> deste(s) colaborador(es). Os demais dias serão automaticamente preenchidos como presença de trabalho.
                  </div>

                  {/* Grade rápida dos dias do mês */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {monthDaysList.map(d => {
                      const isOff = manualOffDates.includes(d.dateStr);

                      return (
                        <button
                          key={d.dateStr}
                          type="button"
                          onClick={() => {
                            if (isOff) {
                              setManualOffDates(prev => prev.filter(x => x !== d.dateStr));
                            } else {
                              setManualOffDates(prev => [...prev, d.dateStr]);
                            }
                          }}
                          className={`p-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                            isOff 
                              ? d.isSunday 
                                ? 'bg-purple-600 text-white border-purple-700 shadow-xs' 
                                : 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="block text-sm">{d.dayNumber}</span>
                          <span className="text-[9px] uppercase opacity-80">{d.dayNameShort}</span>
                          <span className="text-[9px] block mt-0.5">
                            {isOff ? (d.isSunday ? 'DOM' : 'FG') : '✓'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      Preencher os dias não marcados como:
                    </label>
                    <select
                      value={scaleRestFillMode}
                      onChange={e => setScaleRestFillMode(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-800"
                    >
                      <option value="PRESENCA">✓ Presença / Veio Trabalhar</option>
                      <option value="EXT">EXT (Trabalho Externo)</option>
                      <option value="HOME">HOME (Home Office)</option>
                      <option value="EMPTY">Deixar em branco</option>
                    </select>
                  </div>
                </div>
              )}

              {/* CONTEÚDO DA ABA 3: PERÍODO CONTÍNUO (FÉRIAS, ATESTADO) */}
              {scaleTabMode === 'period' && (
                <div className="flex flex-col gap-4 bg-amber-50/40 p-4 rounded-xl border border-amber-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1 block">Data Inicial:</label>
                      <input
                        type="date"
                        value={periodStartDate}
                        onChange={e => setPeriodStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1 block">Data Final:</label>
                      <input
                        type="date"
                        value={periodEndDate}
                        onChange={e => setPeriodEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Status a Aplicar:</label>
                    <select
                      value={periodStatusCode}
                      onChange={e => setPeriodStatusCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-800"
                    >
                      <option value="FERIAS">FÉRIAS (Férias Regulamentares)</option>
                      <option value="EXT">EXT (Trabalho Externo)</option>
                      <option value="AT">AT (Atestado Médico)</option>
                      <option value="DOFF">DOFF (Day Off Especial)</option>
                      <option value="FJ">FJ (Folga Justificada)</option>
                      <option value="HOME">HOME (Home Office)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                {scaleSelectedMembers.length} colaborador(es) selecionado(s)
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsScaleWizardOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => applySmartScaleMutation.mutate()}
                  disabled={applySmartScaleMutation.isPending || scaleSelectedMembers.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {applySmartScaleMutation.isPending ? 'Lançando...' : 'Aplicar Escala no Mês'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADICIONAR COLABORADORES (INDIVIDUAL OU EM GRUPO) */}
      {/* ============================================================== */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Adicionar Colaboradores à Escala</h3>
              </div>
              <button onClick={() => setIsAddMemberModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {/* Turno de Destino */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-700 mb-1 block">Turno de Destino:</label>
              <select
                value={targetTurnoForAdd}
                onChange={e => setTargetTurnoForAdd(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
              >
                {turnoGroups.map(g => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Abas: Em Grupo vs Colar Lista vs Individual */}
            <div className="flex border-b border-slate-200 mb-4">
              <button
                onClick={() => setAddModeTab('group')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer ${
                  addModeTab === 'group' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'
                }`}
              >
                👥 Do Setor (Em Grupo)
              </button>
              <button
                onClick={() => setAddModeTab('bulk_text')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer ${
                  addModeTab === 'bulk_text' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'
                }`}
              >
                📋 Colar Vários Nomes
              </button>
              <button
                onClick={() => setAddModeTab('single')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer ${
                  addModeTab === 'single' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'
                }`}
              >
                ✍️ Individual
              </button>
            </div>

            {/* ABA 1: MEMBROS DO SETOR COM CHECKBOX */}
            {addModeTab === 'group' && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Selecione os integrantes:</span>
                  <button
                    onClick={() => {
                      if (selectedSectorUserIds.length === (sectorMembersList || []).length) {
                        setSelectedSectorUserIds([]);
                      } else {
                        setSelectedSectorUserIds((sectorMembersList || []).map(p => p.id));
                      }
                    }}
                    className="text-blue-600 font-semibold cursor-pointer"
                  >
                    {selectedSectorUserIds.length === (sectorMembersList || []).length ? 'Desmarcar' : 'Selecionar Todos'}
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 divide-y divide-slate-100">
                  {(!sectorMembersList || sectorMembersList.length === 0) ? (
                    <p className="text-xs text-slate-400 p-4 text-center">Nenhum membro cadastrado neste setor.</p>
                  ) : (
                    sectorMembersList.map(profile => {
                      const isSelected = selectedSectorUserIds.includes(profile.id);
                      return (
                        <label 
                          key={profile.id}
                          className="flex items-center gap-2.5 py-2 px-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedSectorUserIds(prev => prev.filter(id => id !== profile.id));
                              } else {
                                setSelectedSectorUserIds(prev => [...prev, profile.id]);
                              }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-semibold text-xs text-slate-800">{profile.email}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase font-bold">
                              {profile.role}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ABA 2: COLAR VÁRIOS NOMES */}
            {addModeTab === 'bulk_text' && (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-600">
                  Cole uma lista de nomes (um por linha):
                </label>
                <textarea
                  rows={6}
                  placeholder={`Carlos Alberto\nMariana Souza\nFernando Dias\n...`}
                  value={bulkNamesText}
                  onChange={e => setBulkNamesText(e.target.value)}
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl bg-slate-50 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {/* ABA 3: INDIVIDUAL */}
            {addModeTab === 'single' && (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-600">Nome completo do colaborador:</label>
                <input
                  type="text"
                  placeholder="Ex: Roberto Nascimento..."
                  value={singleMemberName}
                  onChange={e => setSingleMemberName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {/* Botões do Modal */}
            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsAddMemberModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAddMembers}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar ao Turno</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: GERENCIAR EQUIPE E TURNOS */}
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
              
              {/* Botão de Limpeza para começar do zero */}
              {totalRosterMembersCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs text-amber-900">
                  <span>Deseja limpar todos os nomes para cadastrar sua equipe do zero?</span>
                  <button
                    onClick={handleClearDemoMembers}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    Limpar Todos os Colaboradores
                  </button>
                </div>
              )}

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

              {/* Lista dos Turnos e Integrantes */}
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
                          setTargetTurnoForAdd(group.name);
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
                        group.members.map(member => {
                          const profile = getMemberProfile(member);
                          const roleBadge = getRoleBadge(profile?.role);

                          return (
                            <div key={member} className="py-2 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2.5 font-medium text-slate-800">
                                {profile?.avatar_url ? (
                                  <img src={profile.avatar_url} alt={member} className="w-5 h-5 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                                    {member.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span>{member}</span>
                                {roleBadge && (
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${roleBadge.bg}`}>
                                    {roleBadge.label}
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() => handleRemoveMember(member, group.name)}
                                className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                                title="Remover da Escala"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setIsManageTeamsOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

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
                  statusCode: 'EXT'
                })}
                className="p-2.5 rounded-xl bg-[#3949ab] hover:bg-[#303f9f] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">EXT</span>
                <span>Trab. Externo</span>
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

            {/* Inserir Horário Específico */}
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

    </div>
  );
}
