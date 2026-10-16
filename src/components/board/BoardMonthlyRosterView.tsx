'use client';

import { useState, useMemo, Fragment, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { isBoardOwnedByUser } from '@/lib/privacy';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, Search, Filter, 
  Trash2, Edit, User, Clock, Check, CheckCircle2, X, Layers, 
  CalendarDays, RefreshCw, Download, Sparkles, Settings, Users, 
  BarChart2, LayoutGrid, List, CalendarRange, AlertCircle, Eye, 
  Share2, Copy, UserPlus, FileSpreadsheet, TrendingUp, Sun, Moon, 
  Coffee, Briefcase, Zap, Info, ShieldAlert, Award, FileText,
  CheckSquare, Square, ArrowRight, Send, Mail
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
  
  // Abas de Visualização: Matriz (Planilha), Card Individual (GO), Calendário Tradicional, Cards da Equipe, Métricas/Dashboard
  const [activeViewMode, setActiveViewMode] = useState<'matriz' | 'go_card' | 'calendario' | 'cards' | 'dashboard'>('matriz');

  // Filtros
  const [searchMember, setSearchMember] = useState('');
  const [filterTurno, setFilterTurno] = useState('all');
  const [filterStatusCode, setFilterStatusCode] = useState('all');

  // Modais
  const [isScaleWizardOpen, setIsScaleWizardOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isManageTeamsOpen, setIsManageTeamsOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Colaborador selecionado para visualização/compartilhamento no estilo GO
  const [selectedGoMember, setSelectedGoMember] = useState<string>('');
  const [isSendingShare, setIsSendingShare] = useState(false);
  const [shareFeedbackMsg, setShareFeedbackMsg] = useState<string | null>('');

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
  // Folga no final de semana: 'alternate' (1ª sem sab, 2ª sem dom), 'alternate_sun_first', 'sat_fixed', 'sun_fixed'
  const [scaleWeekendOffMode, setScaleWeekendOffMode] = useState<'alternate' | 'alternate_sun_first' | 'sat_fixed' | 'sun_fixed'>('alternate');
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

    // 0. Apelido conhecido Teffy / Tefy <-> Estefany
    if (clean === 'teffy' || clean === 'tefy' || clean.includes('estefany')) {
      const teffyProfile = allProfiles.find(p => {
        const em = (p.email || '').toLowerCase();
        return em.includes('estefany') || em.includes('teffy');
      });
      if (teffyProfile) return teffyProfile;
    }

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

  // Identificação de Líder ou Administrador
  const isLeaderOrAdmin = useMemo(() => {
    const role = (currentUser?.profile?.role || '').toLowerCase().trim();
    return role === 'admin' || role === 'administrador' || role === 'leader' || role === 'lider' || role === 'líder';
  }, [currentUser]);

  // Permissão de Gerenciamento (Líderes e Administradores)
  const canManageRoster = useMemo(() => {
    return isLeaderOrAdmin;
  }, [isLeaderOrAdmin]);

  // 3.8. Busca todos os quadros do mesmo Workspace/Setor para unificar a escala entre líder e colaboradores
  const { data: workspaceBoardIds } = useQuery({
    queryKey: ['workspace_boards_roster_ids', boardData?.workspace_id, boardId],
    queryFn: async () => {
      if (!boardData?.workspace_id) return [boardId];
      const { data } = await supabase.from('boards').select('id').eq('workspace_id', boardData.workspace_id);
      const ids = (data || []).map((b: any) => b.id);
      if (!ids.includes(boardId)) ids.push(boardId);
      return ids;
    },
    staleTime: 5 * 60 * 1000
  });

  // 4. Configurações dos Turnos e Colaboradores Salvas no Banco (Unificadas no Setor)
  const { data: rosterSettings } = useQuery({
    queryKey: ['operational_shift_settings_roster', boardId, boardData?.workspace_id, workspaceBoardIds],
    queryFn: async () => {
      let query = supabase.from('operational_shift_settings').select('*');
      if (boardData?.workspace_id && workspaceBoardIds && workspaceBoardIds.length > 0) {
        query = query.or(`workspace_id.eq.${boardData.workspace_id},board_id.in.(${workspaceBoardIds.join(',')})`);
      } else if (boardData?.workspace_id) {
        query = query.or(`workspace_id.eq.${boardData.workspace_id},board_id.eq.${boardId}`);
      } else {
        query = query.eq('board_id', boardId);
      }
      const { data } = await query.order('updated_at', { ascending: false });
      if (!data || data.length === 0) return null;

      // Prioriza a configuração que possui grupos com lista de membros (formato do Quadro de Turnos)
      const withMembers = data.find((row: any) => 
        Array.isArray(row.shifts) && row.shifts.some((s: any) => Array.isArray(s.members) && s.members.length > 0)
      );
      if (withMembers) return withMembers;

      const withMembersArray = data.find((row: any) =>
        Array.isArray(row.shifts) && row.shifts.some((s: any) => Array.isArray(s.members))
      );
      return withMembersArray || data[0];
    }
  });

  // 5. Busca Todas as Escalas do Mês Atual (Unificadas no Setor)
  const { data: rawShiftsData } = useQuery({
    queryKey: ['operational_shifts_roster', boardId, boardData?.workspace_id, workspaceBoardIds, startOfMonthStr, endOfMonthStr],
    queryFn: async () => {
      let query = supabase.from('operational_shifts').select('*');
      if (boardData?.workspace_id && workspaceBoardIds && workspaceBoardIds.length > 0) {
        query = query.or(`workspace_id.eq.${boardData.workspace_id},board_id.in.(${workspaceBoardIds.join(',')})`);
      } else if (boardData?.workspace_id) {
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

  // Grupos de Turnos estruturados (com deduplicação case-insensitive para nunca duplicar Davis.lmarques e DAVIS.LMARQUES)
  const turnoGroups: TurnoGroup[] = useMemo((): TurnoGroup[] => {
    let baseGroups = DEFAULT_TURNO_GROUPS;
    if (rosterSettings?.shifts && Array.isArray(rosterSettings.shifts) && rosterSettings.shifts.length > 0) {
      const hasRosterFormat = rosterSettings.shifts.some((s: any) => Array.isArray(s.members));
      if (hasRosterFormat) {
        const seenGlobal = new Map<string, string>();
        baseGroups = rosterSettings.shifts.map((s: any): TurnoGroup => {
          const rawMembers: string[] = Array.isArray(s.members) ? s.members : [];
          const cleanMembers: string[] = [];
          rawMembers.forEach(m => {
            if (!m || !m.trim()) return;
            const trimmed = m.trim();
            const key = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            if (!key) return;
            if (!seenGlobal.has(key)) {
              // Se estiver todo em MAIÚSCULAS (ex: DAVIS.LMARQUES), formata para Davis.lmarques
              const formatted =
                trimmed === trimmed.toUpperCase() && trimmed.length > 3
                  ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
                  : trimmed;
              seenGlobal.set(key, formatted);
              cleanMembers.push(formatted);
            }
          });
          return {
            id: s.id || s.name.toLowerCase().replace(/\s+/g, '_'),
            name: s.name,
            color: s.color || 'blue',
            members: cleanMembers
          };
        });
      }
    }
    return baseGroups;
  }, [rosterSettings]);

  // Total de Colaboradores Cadastrados
  const totalRosterMembersCount = useMemo(() => {
    return turnoGroups.reduce((acc, g) => acc + g.members.length, 0);
  }, [turnoGroups]);

  // Mapeamento em O(1): chave `${operatorName.toLowerCase().trim()}_${shiftDate}` -> { id, status, notes, ... }
  const cellShiftMap = useMemo(() => {
    const map = new Map<string, any>();
    (rawShiftsData || []).forEach((row: any) => {
      if (row.shift_name === '__ESC_ENVIADA__') return;
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
      
      const targetBoardId = rosterSettings?.board_id || boardId;
      const payload: any = {
        board_id: targetBoardId,
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
        const firstDayMonOffset = (new Date(currentYear, currentMonthIndex, 1).getDay() + 6) % 7;

        for (let d = 1; d <= daysInCurrentMonth; d++) {
          const dStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          datesToClear.push(dStr);

          const dateObj = new Date(currentYear, currentMonthIndex, d);
          const dow = dateObj.getDay(); // 0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sab

          // Determina a linha da semana no calendário (Segunda a Domingo: 0, 1, 2, 3, 4, 5)
          const weekIndex = Math.floor((firstDayMonOffset + d - 1) / 7);

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
          } else if (scaleWeekendOffMode === 'alternate_sun_first') {
            if (weekIndex % 2 === 0) {
              // Semana par: folga no Domingo
              if (dow === 0) { isWeekendOff = true; weekendStatus = 'DOM'; }
            } else {
              // Semana ímpar: folga no Sábado
              if (dow === 6) { isWeekendOff = true; weekendStatus = 'FG'; }
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

      // Deleta dados existentes para estes membros e datas no setor
      const targetBoardIds = workspaceBoardIds && workspaceBoardIds.length > 0 ? workspaceBoardIds : [boardId];
      for (const m of scaleSelectedMembers) {
        await supabase
          .from('operational_shifts')
          .delete()
          .in('board_id', targetBoardIds)
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

  const normText = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

  // Formata nomes em CAIXA ALTA (ex: DAVIS.LMARQUES -> Davis.lmarques) para padronizar visualmente
  const formatCollaboratorName = (rawName: string) => {
    const trimmed = (rawName || '').trim();
    if (!trimmed) return '';
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    }
    return trimmed;
  };

  // Verifica se dois nomes representam o mesmo colaborador (ex: "Davis.lmarques" === "DAVIS.LMARQUES" === "Davis", "Teffy" === "Estefany")
  const isSameCollaborator = (nameA: string, nameB: string) => {
    if (!nameA || !nameB) return false;
    const normA = normText(nameA);
    const normB = normText(nameB);
    if (!normA || !normB) return false;
    if (normA === normB) return true;

    const profA = getMemberProfile(nameA);
    const profB = getMemberProfile(nameB);
    if (profA?.id && profB?.id && profA.id === profB.id) return true;

    const partsA = nameA.toLowerCase().trim().split(/[\s._-]+/).filter(Boolean);
    const partsB = nameB.toLowerCase().trim().split(/[\s._-]+/).filter(Boolean);
    if (
      partsA[0] &&
      partsB[0] &&
      partsA[0].length >= 3 &&
      normText(partsA[0]) === normText(partsB[0]) &&
      (partsA.length === 1 || partsB.length === 1)
    ) {
      return true;
    }

    return false;
  };

  // Função auxiliar para interpretar o status da célula
  const resolveCellStatus = (operatorName: string, dateStr: string): { 
    def: StatusDefinition | null; 
    customText: string; 
    rawStatus: string 
  } => {
    if (!operatorName) return { def: null, customText: '', rawStatus: '' };
    const cleanName = operatorName.toLowerCase().trim();
    let row = cellShiftMap.get(`${cleanName}_${dateStr}`);

    // Se o quadro/card estiver usando o apelido/primeiro nome (ex: "Davis") e o turno foi salvo como "davis.lmarques", busca pelo prefixo do perfil do próprio colaborador
    if (!row) {
      const prof = getMemberProfile(operatorName);
      const emailPrefix = (prof?.email?.split('@')[0] || '').toLowerCase().trim();
      if (emailPrefix && emailPrefix !== cleanName) {
        row = cellShiftMap.get(`${emailPrefix}_${dateStr}`);
      }
    }

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

  // Lista completa de todos os colaboradores do setor/escala (deduplicada case-insensitively para nunca exibir Davis.lmarques e DAVIS.LMARQUES duplicados)
  const allRosterMembers = useMemo(() => {
    const result: string[] = [];
    const addUnique = (rawName: string) => {
      const formatted = formatCollaboratorName(rawName);
      if (!formatted) return;
      const alreadyExists = result.some(existing => isSameCollaborator(existing, formatted));
      if (!alreadyExists) {
        result.push(formatted);
      }
    };

    // 1. Membros cadastrados nos grupos de turnos
    turnoGroups.forEach(g => g.members.forEach(m => addUnique(m)));

    // 2. Operadores que possuem turnos lançados no mês (excluindo marcadores de publicação)
    (rawShiftsData || []).forEach((r: any) => {
      if (r.shift_name === '__ESC_ENVIADA__') return;
      if (r.operator_name && r.operator_name.trim()) {
        addUnique(r.operator_name);
      }
    });

    // 3. Membros do setor atual (para que colaboradores sem escala definida também apareçam na lista com "Ainda não definido")
    (sectorMembersList || []).forEach((p: any) => {
      const role = (p.role || '').toLowerCase();
      if (role === 'admin') return;
      const emailPrefix = p.email?.split('@')[0] || '';
      if (emailPrefix) {
        addUnique(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }
    });

    return result;
  }, [turnoGroups, rawShiftsData, sectorMembersList, allProfiles]);

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

    const computeForMember = (member: string) => {
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

      const obj = {
        totalWork: work,
        totalOff: off,
        totalVacation: vac,
        totalMedical: med,
        totalRemote: rem,
        totalDelayOrAbsence: delay
      };
      stats.set(member, obj);
      stats.set(member.toLowerCase().trim(), obj);
    };

    allRosterMembers.forEach(m => computeForMember(m));
    turnoGroups.forEach(g => g.members.forEach(m => {
      if (!stats.has(m)) computeForMember(m);
    }));

    return stats;
  }, [allRosterMembers, turnoGroups, cellShiftMap, currentYear, currentMonthIndex, daysInCurrentMonth, allProfiles]);

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

  // Conjunto de colaboradores cuja escala deste mês já foi ENVIADA pelo gestor via botão
  const publishedMembersSet = useMemo(() => {
    const set = new Set<string>();
    (rawShiftsData || []).forEach((row: any) => {
      if (row.shift_name === '__ESC_ENVIADA__' && row.operator_name) {
        set.add(row.operator_name.toLowerCase().trim());
      }
    });
    return set;
  }, [rawShiftsData]);

  // Verifica se o gestor já clicou em "Enviar" para este colaborador neste mês
  const isMemberSchedulePublished = (memberName: string) => {
    if (!memberName) return false;
    for (const pub of publishedMembersSet) {
      if (isSameCollaborator(pub, memberName)) return true;
    }
    return false;
  };

  // Verifica se há ao menos 1 turno lançado para este colaborador no mês selecionado
  const hasMemberShiftsInMonth = (memberName: string) => {
    if (!memberName) return false;
    return (rawShiftsData || []).some((row: any) => {
      if (row.shift_name === '__ESC_ENVIADA__' || !row.operator_name) return false;
      return isSameCollaborator(row.operator_name, memberName);
    });
  };

  // Identifica estritamente o colaborador correspondente ao usuário/quadro atual (sem NUNCA cair na escala de outro colega)
  const matchedCurrentUserMember = useMemo(() => {
    const boardTitle = (boardData?.name || '').trim();
    const isGenericBoard = !boardTitle || boardTitle.toLowerCase().includes('panorama');
    const userEmail = (currentUser?.email || '').toLowerCase().trim();
    const userPrefix = userEmail.split('@')[0] || '';

    // CASO 1: Colaborador Comum (!isLeaderOrAdmin) -> "Minha Escala" é SEMPRE do usuário logado!
    // Nunca usa o nome do quadro se o quadro pertencer a outro colega.
    if (!isLeaderOrAdmin) {
      if (userEmail) {
        // Procura na lista se o próprio usuário logado já está cadastrado
        const matchedInList = allRosterMembers.find(m => {
          const p = getMemberProfile(m);
          if (p?.email?.toLowerCase().trim() === userEmail) return true;
          return isBoardOwnedByUser({ name: m }, { id: currentUser?.id, email: userEmail });
        });
        if (matchedInList) return matchedInList;
      }

      // Se o quadro aberto pertence ao próprio usuário logado (ex: quadro "Teffy" para estefany@...), usa o nome do quadro
      if (!isGenericBoard && currentUser && isBoardOwnedByUser({ name: boardTitle }, { id: currentUser.id, email: userEmail })) {
        return boardTitle;
      }

      // Caso contrário, usa o próprio prefixo do e-mail do usuário logado (exibirá seu card nominal com "Ainda não definido")
      if (userPrefix) {
        return userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1);
      }
      return 'Colaborador';
    }

    // CASO 2: Líder ou Administrador (isLeaderOrAdmin)
    // Se o líder abriu o quadro específico de um colaborador (ex: quadro "Ruan", "Teffy", "Davis"), alinha ao colaborador daquele quadro!
    if (!isGenericBoard) {
      const matchedByBoard = allRosterMembers.find(m => isSameCollaborator(m, boardTitle));
      if (matchedByBoard) return matchedByBoard;
      return boardTitle;
    }

    // Se for um quadro geral, tenta o próprio líder ou o primeiro da lista
    if (userEmail) {
      const matchedSelf = allRosterMembers.find(m => isSameCollaborator(m, userPrefix));
      if (matchedSelf) return matchedSelf;
    }

    return allRosterMembers[0] || (userPrefix ? userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1) : 'Colaborador');
  }, [isLeaderOrAdmin, currentUser, allRosterMembers, allProfiles, boardData]);

  // Sempre que mudar de quadro (boardId) ou carregar o colaborador correspondente ao quadro/usuário, alinha o card selecionado
  useEffect(() => {
    if (matchedCurrentUserMember) {
      setSelectedGoMember(matchedCurrentUserMember);
    }
  }, [boardId, matchedCurrentUserMember]);

  // Resolve a cor e categoria de cada dia no padrão visual oficial CR TASK (Segunda a Domingo)
  const resolveGoCellStyle = (memberName: string, dateStr: string, dayOfWeek: number) => {
    const { def, customText } = resolveCellStatus(memberName, dateStr);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Célula sem lançamento: não marca como "Trabalha" automaticamente
    if (!def) {
      return {
        bgHex: '#0f172a',
        borderHex: '#1e293b',
        textHex: '#64748b',
        subTextHex: '#475569',
        category: 'vazio' as const,
        badge: '-'
      };
    }

    if (def.code === 'PRESENCA') {
      return {
        bgHex: '#1e293b',
        borderHex: '#334155',
        textHex: '#f8fafc',
        subTextHex: '#34d399',
        category: 'trabalha' as const,
        badge: '✓ Trabalha'
      };
    }

    if (def.code === 'FG' || def.code === 'FJ') {
      if (isWeekend) {
        return {
          bgHex: '#7c3aed',
          borderHex: '#a78bfa',
          textHex: '#ffffff',
          subTextHex: '#ede9fe',
          category: 'folga_fds' as const,
          badge: def.code === 'FJ' ? 'FJ • FDS' : 'FG • FDS'
        };
      }
      return {
        bgHex: '#059669',
        borderHex: '#34d399',
        textHex: '#ffffff',
        subTextHex: '#d1fae5',
        category: 'folga_semana' as const,
        badge: def.code === 'FJ' ? 'FJ • Semana' : 'FG • Folga'
      };
    }

    if (def.code === 'DOM') {
      return {
        bgHex: '#7c3aed',
        borderHex: '#a78bfa',
        textHex: '#ffffff',
        subTextHex: '#ede9fe',
        category: 'folga_fds' as const,
        badge: 'DOM • Folga'
      };
    }

    if (def.code === 'DOFF') {
      return {
        bgHex: '#e11d48',
        borderHex: '#fb7185',
        textHex: '#ffffff',
        subTextHex: '#ffe4e6',
        category: 'day_off' as const,
        badge: 'DAY OFF'
      };
    }

    if (def.code === 'FERIAS') {
      return {
        bgHex: '#f59e0b',
        borderHex: '#fcd34d',
        textHex: '#0f172a',
        subTextHex: '#451a03',
        category: 'ferias' as const,
        badge: 'FÉRIAS'
      };
    }

    if (def.code === 'EXT') {
      return {
        bgHex: '#4f46e5',
        borderHex: '#818cf8',
        textHex: '#ffffff',
        subTextHex: '#e0e7ff',
        category: 'trabalha' as const,
        badge: 'EXT • Externo'
      };
    }

    if (def.code === 'HOME') {
      return {
        bgHex: '#db2777',
        borderHex: '#f472b6',
        textHex: '#ffffff',
        subTextHex: '#fce7f3',
        category: 'trabalha' as const,
        badge: 'HOME OFFICE'
      };
    }

    if (def.code === 'AT') {
      return {
        bgHex: '#0284c7',
        borderHex: '#38bdf8',
        textHex: '#ffffff',
        subTextHex: '#e0f2fe',
        category: 'outros' as const,
        badge: 'ATESTADO'
      };
    }

    if (def.code === 'HORARIO' || def.code === 'FALTA') {
      return {
        bgHex: '#dc2626',
        borderHex: '#f87171',
        textHex: '#ffffff',
        subTextHex: '#fee2e2',
        category: 'outros' as const,
        badge: customText || 'FALTA'
      };
    }

    return {
      bgHex: '#1e293b',
      borderHex: '#334155',
      textHex: '#f8fafc',
      subTextHex: '#94a3b8',
      category: 'trabalha' as const,
      badge: customText !== 'x' ? customText : 'Fora Escala'
    };
  };

  // Matriz de semanas Segunda -> Domingo para o Card CR Task
  const goCalendarWeeks = useMemo(() => {
    const firstDayDate = new Date(currentYear, currentMonthIndex, 1);
    // 0 = Segunda, 1 = Terça, ..., 5 = Sábado, 6 = Domingo
    const startOffset = (firstDayDate.getDay() + 6) % 7;

    const cells: ({ dayNumber: number; dateStr: string; dayOfWeek: number } | null)[] = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateObj = new Date(currentYear, currentMonthIndex, d);
      const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNumber: d,
        dateStr,
        dayOfWeek: dateObj.getDay()
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [currentYear, currentMonthIndex, daysInCurrentMonth]);

  // Gera um Canvas HTML5 de Alta Resolução com o visual oficial CR TASK e a logo /logo.png
  const generateGoScheduleCanvas = async (memberName: string): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    const numWeeks = goCalendarWeeks.length;
    const width = 1280;
    const rowH = 102;
    const rowGap = 10;
    const tableTop = 235;
    const height = tableTop + 56 + numWeeks * (rowH + rowGap) + 70;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 1. Fundo Escuro Oficial CR Task (#0f172a -> #090d16)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#111827');
    bgGrad.addColorStop(1, '#0b1120');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Borda externa sutil
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // 2. Carrega e desenha a Logo Oficial da CR (/logo.png) no canto superior esquerdo
    const logoImg = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/logo.png';
    });

    // Caixa preta da logo CR
    const logoBoxX = 56;
    const logoBoxY = 38;
    const logoBoxSize = 96;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 22);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#334155';
    ctx.stroke();
    ctx.clip();

    if (logoImg) {
      ctx.drawImage(logoImg, logoBoxX + 8, logoBoxY + 8, logoBoxSize - 16, logoBoxSize - 16);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 36px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CR', logoBoxX + logoBoxSize / 2, logoBoxY + logoBoxSize / 2);
    }
    ctx.restore();

    // Texto de Marca ao lado da Logo
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('CR TASK', logoBoxX + logoBoxSize + 18, logoBoxY + 18);

    ctx.fillStyle = '#818cf8';
    ctx.font = '700 12px Inter, Arial, sans-serif';
    ctx.fillText('GESTÃO OPERACIONAL', logoBoxX + logoBoxSize + 18, logoBoxY + 50);

    const groupObj = turnoGroups.find(g => g.members.includes(memberName));
    const shiftLabel = groupObj?.name || 'Geral';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 12px Inter, Arial, sans-serif';
    ctx.fillText(`Turno: ${shiftLabel}`, logoBoxX + logoBoxSize + 18, logoBoxY + 70);

    // 3. Nome do Colaborador e Mês/Ano no Centro
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(memberName.toUpperCase(), width / 2, 68);

    // Badge do Mês e Ano
    const monthUpper = `${MONTH_NAMES[currentMonthIndex].toUpperCase()} ${currentYear}`;
    const mBadgeW = 260;
    const mBadgeH = 38;
    ctx.beginPath();
    ctx.roundRect(width / 2 - mBadgeW / 2, 98, mBadgeW, mBadgeH, 12);
    ctx.fillStyle = 'rgba(79, 70, 229, 0.22)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#6366f1';
    ctx.stroke();

    ctx.fillStyle = '#a5b4fc';
    ctx.font = '800 18px Inter, Arial, sans-serif';
    ctx.fillText(monthUpper, width / 2, 98 + mBadgeH / 2 + 1);

    // 4. Pílulas de Legenda CR Task
    const pills = [
      { label: '✓ TRABALHA', bg: '#1e293b', border: '#475569', text: '#f8fafc' },
      { label: 'FOLGA SEMANA (FG)', bg: '#059669', border: '#34d399', text: '#ffffff' },
      { label: 'FOLGA FDS (DOM)', bg: '#7c3aed', border: '#a78bfa', text: '#ffffff' },
      { label: 'DAY OFF', bg: '#e11d48', border: '#fb7185', text: '#ffffff' },
      { label: 'FÉRIAS', bg: '#f59e0b', border: '#fcd34d', text: '#0f172a' },
      { label: 'EXTERNO (EXT)', bg: '#4f46e5', border: '#818cf8', text: '#ffffff' }
    ];
    const pillW = 165;
    const pillH = 34;
    const pillGap = 12;
    const totalPillsW = pills.length * pillW + (pills.length - 1) * pillGap;
    let startPillX = (width - totalPillsW) / 2;
    const pillY = 162;

    pills.forEach(p => {
      ctx.beginPath();
      ctx.roundRect(startPillX, pillY, pillW, pillH, 10);
      ctx.fillStyle = p.bg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = p.border;
      ctx.stroke();

      ctx.fillStyle = p.text;
      ctx.font = '800 11px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label, startPillX + pillW / 2, pillY + pillH / 2 + 1);

      startPillX += pillW + pillGap;
    });

    // 5. Cabeçalho dos Dias da Semana (SEGUNDA a DOMINGO)
    const tableLeft = 56;
    const tableWidth = width - tableLeft * 2;
    const colGap = 10;
    const colW = (tableWidth - colGap * 6) / 7;
    const dowHeaders = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO'];

    dowHeaders.forEach((h, idx) => {
      const hx = tableLeft + idx * (colW + colGap);
      ctx.beginPath();
      ctx.roundRect(hx, tableTop, colW, 40, 10);
      ctx.fillStyle = idx >= 5 ? '#1e1b4b' : '#1e293b';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = idx >= 5 ? '#4338ca' : '#334155';
      ctx.stroke();

      ctx.fillStyle = idx >= 5 ? '#a5b4fc' : '#cbd5e1';
      ctx.font = '800 13px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h, hx + colW / 2, tableTop + 21);
    });

    // 6. Grade de Cards dos Dias
    const gridStartY = tableTop + 52;
    goCalendarWeeks.forEach((week, rIdx) => {
      const y = gridStartY + rIdx * (rowH + rowGap);
      week.forEach((cell, cIdx) => {
        const x = tableLeft + cIdx * (colW + colGap);

        if (!cell) {
          ctx.beginPath();
          ctx.roundRect(x, y, colW, rowH, 14);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#1e293b';
          ctx.stroke();
          return;
        }

        const st = resolveGoCellStyle(memberName, cell.dateStr, cell.dayOfWeek);

        ctx.beginPath();
        ctx.roundRect(x, y, colW, rowH, 14);
        ctx.fillStyle = st.bgHex;
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = st.borderHex;
        ctx.stroke();

        // Número do Dia
        ctx.fillStyle = st.textHex;
        ctx.font = '900 26px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(cell.dayNumber), x + colW / 2, y + rowH / 2 - 10);

        // Badge / Status embaixo
        if (st.badge) {
          ctx.fillStyle = st.subTextHex;
          ctx.font = '800 11px Inter, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(st.badge.toUpperCase(), x + colW / 2, y + rowH - 20);
        }
      });
    });

    // 7. Rodapé Oficial CR Task
    const stats = memberMonthlyStats.get(memberName);
    ctx.fillStyle = '#64748b';
    ctx.font = '600 13px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Resumo do Mês:   Trabalha: ${stats?.totalWork || 0} dias   •   Folgas: ${stats?.totalOff || 0} dias   •   Férias: ${stats?.totalVacation || 0} dias`,
      tableLeft,
      height - 30
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.fillText('Gerado via CR Task • Gestão Operacional', width - tableLeft, height - 30);

    return canvas;
  };

  // Baixar PNG da Escala no Formato Oficial CR Task
  const handleDownloadGoPng = async (memberName: string) => {
    if (!memberName) return;
    const canvas = await generateGoScheduleCanvas(memberName);
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const cleanName = memberName.toLowerCase().replace(/\s+/g, '_');
    link.download = `escala_crtask_${cleanName}_${MONTH_SHORT[currentMonthIndex]}_${currentYear}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShareFeedbackMsg(`📥 Imagem da escala CR Task de ${memberName} baixada com sucesso!`);
    setTimeout(() => setShareFeedbackMsg(''), 4000);
  };

  // Copiar PNG da Escala para a Área de Transferência (WhatsApp / Teams)
  const handleCopyGoPng = async (memberName: string) => {
    if (!memberName) return;
    try {
      const canvas = await generateGoScheduleCanvas(memberName);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setShareFeedbackMsg(`📋 Escala CR Task de ${memberName} copiada! Basta colar (Ctrl+V) no WhatsApp ou chat.`);
        setTimeout(() => setShareFeedbackMsg(''), 4500);
      }, 'image/png');
    } catch (err) {
      await handleDownloadGoPng(memberName);
    }
  };

  // Grava no banco que a escala deste colaborador/mês foi oficialmente enviada pela liderança
  const markMemberScheduleAsPublished = async (membersToPublish: string[]) => {
    const targetBoardIds = workspaceBoardIds && workspaceBoardIds.length > 0 ? workspaceBoardIds : [boardId];
    for (const m of membersToPublish) {
      await supabase
        .from('operational_shifts')
        .delete()
        .in('board_id', targetBoardIds)
        .eq('shift_name', '__ESC_ENVIADA__')
        .eq('operator_name', m)
        .eq('shift_date', startOfMonthStr);
    }

    const rows = membersToPublish.map(m => {
      const row: any = {
        board_id: boardId,
        shift_date: startOfMonthStr,
        shift_name: '__ESC_ENVIADA__',
        shift_time: '00:00',
        region_name: 'Sistema',
        operator_name: m,
        operator_type: 'Publicacao',
        status: 'ENVIADA',
        notes: `Enviada em ${new Date().toISOString()}`
      };
      if (boardData?.workspace_id) row.workspace_id = boardData.workspace_id;
      return row;
    });

    if (rows.length > 0) {
      let { error } = await supabase.from('operational_shifts').insert(rows);
      if (error && error.message?.includes('workspace_id')) {
        const cleanRows = rows.map(({ workspace_id, ...rest }) => rest);
        const retry = await supabase.from('operational_shifts').insert(cleanRows);
        if (retry.error) throw retry.error;
      } else if (error) {
        throw error;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['operational_shifts_roster'] });
  };

  // Enviar / Compartilhar Escala com o Colaborador no Sistema (+ E-mail)
  const handleSendScaleToCollaborator = async (memberName: string) => {
    if (!memberName) return;
    setIsSendingShare(true);
    try {
      // 1. Libera oficialmente a escala deste mês para o colaborador visualizar em "Minha Escala"
      await markMemberScheduleAsPublished([memberName]);

      const profile = getMemberProfile(memberName);
      const authorEmail = currentUser?.email || 'lider@masterdeliveryexpress.com.br';
      const monthLabel = `${MONTH_NAMES[currentMonthIndex]} de ${currentYear}`;

      if (profile?.email) {
        // 2. Insere notificação no sino do colaborador
        await supabase.from('notifications').insert([{
          user_email: profile.email,
          message: `${authorEmail}||📅 Sua escala de ${monthLabel} foi compartilhada! Clique para abrir Minha Escala.`,
          read: false
        }]);

        // 3. Dispara e-mail formatado no padrão visual CR Task
        const s = memberMonthlyStats.get(memberName);
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: profile.email,
            subject: `📅 Sua Escala Mensal CR Task - ${MONTH_NAMES[currentMonthIndex].toUpperCase()} ${currentYear}`,
            html: `
              <div style="font-family: Inter, Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 32px; border-radius: 20px; max-width: 620px; margin: 0 auto; border: 1px solid #1e293b;">
                <div style="text-align: center; margin-bottom: 16px;">
                  <span style="background: #4f46e5; color: #fff; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 999px; letter-spacing: 1.5px;">CR TASK • GESTÃO OPERACIONAL</span>
                </div>
                <h2 style="color: #ffffff; text-align: center; letter-spacing: 1px; margin-bottom: 4px; font-size: 26px;">${memberName.toUpperCase()}</h2>
                <h3 style="color: #818cf8; text-align: center; letter-spacing: 2px; margin-top: 0; font-size: 16px;">${MONTH_NAMES[currentMonthIndex].toUpperCase()} ${currentYear}</h3>
                <p style="text-align: center; color: #cbd5e1; font-size: 14px; line-height: 1.6;">Sua escala mensal foi publicada pela liderança. Acesse a aba <strong style="color: #fff;">Minha Escala</strong> no CR Task para visualizar seu calendário completo.</p>
                <div style="background: #1e293b; padding: 16px; border-radius: 14px; margin-top: 20px; text-align: center; border: 1px solid #334155;">
                  <span style="display:inline-block; margin: 6px 12px; color: #34d399;"><strong>✓ Trabalha:</strong> ${s?.totalWork || 0} dias</span>
                  <span style="display:inline-block; margin: 6px 12px; color: #a78bfa;"><strong>Folgas:</strong> ${s?.totalOff || 0} dias</span>
                  <span style="display:inline-block; margin: 6px 12px; color: #fbbf24;"><strong>Férias:</strong> ${s?.totalVacation || 0} dias</span>
                </div>
              </div>
            `
          })
        }).catch(() => {});

        setShareFeedbackMsg(`✅ Escala de ${monthLabel} liberada e enviada para ${memberName} (${profile.email})!`);
      } else {
        setShareFeedbackMsg(`✅ Escala de ${monthLabel} liberada no painel para ${memberName}!`);
      }
      setTimeout(() => setShareFeedbackMsg(''), 5000);
    } catch (err: any) {
      alert('Erro ao compartilhar escala: ' + err.message);
    } finally {
      setIsSendingShare(false);
    }
  };

  // Compartilhar Escala com TODOS os Colaboradores da Equipe de uma só vez
  const handleSendScaleToAllTeam = async () => {
    if (allRosterMembers.length === 0) return;
    setIsSendingShare(true);
    try {
      const membersWithShifts = allRosterMembers.filter(m => hasMemberShiftsInMonth(m));
      const targetList = membersWithShifts.length > 0 ? membersWithShifts : allRosterMembers;

      // 1. Libera oficialmente as escalas no banco
      await markMemberScheduleAsPublished(targetList);

      const authorEmail = currentUser?.email || 'lider@masterdeliveryexpress.com.br';
      const monthLabel = `${MONTH_NAMES[currentMonthIndex]} de ${currentYear}`;
      const notifsToInsert: any[] = [];

      targetList.forEach(m => {
        const p = getMemberProfile(m);
        if (p?.email) {
          notifsToInsert.push({
            user_email: p.email,
            message: `${authorEmail}||📅 Sua escala de ${monthLabel} foi publicada pela liderança! Clique para abrir Minha Escala.`,
            read: false
          });
        }
      });

      if (notifsToInsert.length > 0) {
        await supabase.from('notifications').insert(notifsToInsert);
      }

      setShareFeedbackMsg(`🚀 Escalas de ${monthLabel} liberadas e enviadas para a equipe (${targetList.length} colaboradores)!`);
      setTimeout(() => setShareFeedbackMsg(''), 5000);
    } catch (err: any) {
      alert('Erro ao compartilhar escalas em lote: ' + err.message);
    } finally {
      setIsSendingShare(false);
    }
  };

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
        const merged = [...g.members];
        namesToAdd.forEach(n => {
          const clean = formatCollaboratorName(n);
          if (clean && !merged.some(existing => isSameCollaborator(existing, clean))) {
            merged.push(clean);
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

  // Renderizador do Card Visual Oficial "CR TASK" (Com logotipo /logo.png e cores do sistema)
  const renderGoScheduleCard = (memberName: string, compact = false) => {
    const targetName = memberName || (!isLeaderOrAdmin ? matchedCurrentUserMember : (selectedGoMember || allRosterMembers[0])) || 'COLABORADOR';
    const stats = memberMonthlyStats.get(targetName);
    const groupObj = turnoGroups.find(g => g.members.some(m => m.toLowerCase() === targetName.toLowerCase()));
    const shiftLabel = groupObj?.name || 'Geral';
    const profile = getMemberProfile(targetName);
    const roleBadge = getRoleBadge(profile?.role);

    // Verifica se a escala deste mês foi lançada e enviada/publicada
    const hasShifts = hasMemberShiftsInMonth(targetName);
    const isPublished = isMemberSchedulePublished(targetName);
    // Para o colaborador comum: só libera a visualização quando o gestor clicou em "Enviar" E existem turnos lançados no mês.
    // Para o gestor/líder: se o mês futuro ainda não teve nenhum lançamento, exibe o aviso de "Ainda não definido".
    const isScheduleUndefined = !isLeaderOrAdmin ? (!hasShifts || !isPublished) : !hasShifts;

    return (
      <div className="flex flex-col items-center w-full">
        {/* Barra rápida de resumo numérico acima do card */}
        <div className="w-full max-w-[940px] mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs text-slate-800">
              Turno: <strong className="text-indigo-600">{shiftLabel}</strong>
            </span>
            {!isScheduleUndefined ? (
              <>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                  Trabalha: <strong>{stats?.totalWork || 0} dias</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-800">
                  Folgas: <strong>{stats?.totalOff || 0} dias</strong>
                </span>
                {(stats?.totalVacation || 0) > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                    Férias: <strong>{stats?.totalVacation} dias</strong>
                  </span>
                )}
              </>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                ⏳ Escala do mês: <strong>Ainda não definido</strong>
              </span>
            )}
            {isLeaderOrAdmin && hasShifts && (
              <span
                className={`px-2.5 py-1 rounded-lg border ${
                  isPublished
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                {isPublished
                  ? '✅ Enviada ao colaborador'
                  : '⏳ Rascunho (Clique em "Enviar" para liberar ao colaborador)'}
              </span>
            )}
          </div>

          {canManageRoster && (
            <span className="text-[11px] text-slate-500 font-medium">
              💡 Dica: Clique em qualquer dia do card abaixo para alterar o status diretamente
            </span>
          )}
        </div>

        {/* CARD OFICIAL CR TASK (TEMA DARK SLATE / INDIGO COM LOGO CR) */}
        <div
          className={`w-full max-w-[940px] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1120] rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden select-none text-white ${
            compact ? 'p-4 sm:p-6' : 'p-5 sm:p-8'
          }`}
        >
          {/* TOPO: LOGO CR TASK + COLABORADOR & MÊS + BARRA DE LEGENDA COMPLETA */}
          <div className="flex flex-col gap-4 mb-5 pb-5 border-b border-slate-800/90">
            
            {/* Linha 1: Logo CR Task à Esquerda + Colaborador & Mês à Direita */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
              
              {/* Esquerda: Logotipo Oficial CR (/logo.png) + Selo CR Task */}
              <div className="flex items-center gap-3.5 shrink-0">
                <div className={`${compact ? 'w-14 h-14' : 'w-16 h-16'} bg-black rounded-2xl border border-slate-700/80 shadow-xl p-1.5 flex items-center justify-center shrink-0`}>
                  <img
                    src="/logo.png"
                    alt="CR Task Logo"
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl font-black tracking-tight text-white">
                      CR TASK
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Oficial
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    Gestão Operacional • Escala Mensal
                  </span>
                  <span className="text-[11px] font-bold text-indigo-400 mt-0.5">
                    Setor / Turno: {shiftLabel}
                  </span>
                </div>
              </div>

              {/* Direita: Avatar + Nome do Colaborador + Mês/Ano */}
              <div className="flex flex-col items-center sm:items-end text-center sm:text-right min-w-0">
                <div className="flex items-center gap-2.5 mb-1 max-w-full">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={targetName}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-indigo-500/60 shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-600/30 border border-indigo-400/40 text-indigo-200 font-black text-base flex items-center justify-center shrink-0">
                      {targetName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <h2
                    className={`${
                      compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
                    } font-black text-white uppercase tracking-tight leading-tight truncate`}
                  >
                    {targetName}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 mt-0.5">
                  <span className="px-3.5 py-1 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-black text-xs sm:text-sm uppercase tracking-widest shadow-xs">
                    📅 {MONTH_NAMES[currentMonthIndex].toUpperCase()} {currentYear}
                  </span>
                  {roleBadge && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
                      {roleBadge.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Linha 2: Pílulas de Legenda em Largura Total (Sem cortar nenhum item) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 w-full pt-1">
              <div className="bg-[#1e293b] border border-slate-600 rounded-lg py-1.5 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="truncate">TRABALHA</span>
              </div>
              <div className="bg-emerald-600/90 border border-emerald-400/50 rounded-lg py-1.5 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-200 shrink-0"></span>
                <span className="truncate">FOLGA SEMANA</span>
              </div>
              <div className="bg-purple-600/90 border border-purple-400/50 rounded-lg py-1.5 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-purple-200 shrink-0"></span>
                <span className="truncate">FOLGA FDS</span>
              </div>
              <div className="bg-rose-600/90 border border-rose-400/50 rounded-lg py-1.5 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-rose-200 shrink-0"></span>
                <span className="truncate">DAY OFF</span>
              </div>
              <div className="bg-amber-500 border border-amber-300 rounded-lg py-1.5 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-slate-950">
                <span className="w-2 h-2 rounded-full bg-slate-950 shrink-0"></span>
                <span className="truncate">FÉRIAS</span>
              </div>
              <div className="bg-indigo-600/90 border border-indigo-400/50 rounded-lg py-1.5 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-indigo-200 shrink-0"></span>
                <span className="truncate">EXTERNO (EXT)</span>
              </div>
            </div>
          </div>

          {/* GRADE MODERNA DE CALENDÁRIO SEGUNDA A DOMINGO (ESTILO CR TASK) */}
          <div className="w-full overflow-x-auto relative">
            <div className="min-w-[620px] flex flex-col gap-2 relative">
              {/* Cabeçalho dos Dias da Semana */}
              <div className="grid grid-cols-7 gap-2">
                {['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO'].map((dayHeader, idx) => (
                  <div
                    key={dayHeader}
                    className={`py-2.5 px-1 text-center font-extrabold text-xs uppercase tracking-wider rounded-xl border ${
                      idx >= 5
                        ? 'bg-indigo-950/70 border-indigo-700/60 text-indigo-300'
                        : 'bg-slate-800/90 border-slate-700/80 text-slate-300'
                    }`}
                  >
                    {dayHeader}
                  </div>
                ))}
              </div>

              {/* Container das Semanas com Blur quando a escala do mês ainda não foi definida/enviada */}
              <div className="relative">
                <div
                  className={`flex flex-col gap-2 transition-all duration-300 ${
                    isScheduleUndefined && !canManageRoster
                      ? 'blur-[6px] opacity-30 pointer-events-none select-none'
                      : isScheduleUndefined && canManageRoster
                      ? 'blur-[4px] opacity-40'
                      : ''
                  }`}
                >
                  {goCalendarWeeks.map((week, wIdx) => (
                    <div key={wIdx} className="grid grid-cols-7 gap-2">
                      {week.map((cell, cIdx) => {
                        if (!cell) {
                          return (
                            <div
                              key={`empty_${wIdx}_${cIdx}`}
                              className="h-14 sm:h-16 rounded-xl bg-slate-900/40 border border-slate-800/60"
                            />
                          );
                        }

                        const cellStyle = resolveGoCellStyle(targetName, cell.dateStr, cell.dayOfWeek);
                        const rawStatus = resolveCellStatus(targetName, cell.dateStr);

                        return (
                          <div
                            key={cell.dateStr}
                            onClick={(e) => {
                              if (!canManageRoster) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActiveCellPopover({
                                dateStr: cell.dateStr,
                                operatorName: targetName,
                                shiftName: shiftLabel,
                                anchorRect: rect,
                                currentCode: rawStatus.def?.code || '',
                                currentTimeText: rawStatus.def?.isCustomTime ? rawStatus.customText : ''
                              });
                            }}
                            style={{
                              backgroundColor: isScheduleUndefined ? '#1e293b' : cellStyle.bgHex,
                              borderColor: isScheduleUndefined ? '#334155' : cellStyle.borderHex,
                              color: isScheduleUndefined ? '#64748b' : cellStyle.textHex
                            }}
                            title={
                              isScheduleUndefined
                                ? `${targetName} - Dia ${cell.dayNumber}: Ainda não definido`
                                : `${targetName} - Dia ${cell.dayNumber}: ${cellStyle.badge || 'Não definido'}`
                            }
                            className={`h-14 sm:h-16 rounded-xl border-[1.5px] flex flex-col items-center justify-center relative transition-all shadow-sm ${
                              canManageRoster
                                ? 'cursor-pointer hover:brightness-110 hover:scale-[1.02] active:scale-95'
                                : ''
                            }`}
                          >
                            <span className="text-lg sm:text-xl font-black tracking-tight leading-none">
                              {cell.dayNumber}
                            </span>
                            {!isScheduleUndefined && (
                              <span
                                style={{ color: cellStyle.subTextHex }}
                                className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-tight mt-1 truncate max-w-[90%]"
                              >
                                {cellStyle.badge}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* FAIXA CENTRAL "AINDA NÃO DEFINIDO" SOBRE OS DIAS COM BLUR */}
                {isScheduleUndefined && (
                  <div
                    className={`absolute inset-0 flex items-center justify-center z-10 ${
                      canManageRoster ? 'pointer-events-none' : ''
                    }`}
                  >
                    <div className="w-full py-5 px-6 bg-slate-950/85 backdrop-blur-md border-y border-indigo-500/40 shadow-2xl flex flex-col items-center justify-center text-center gap-1.5">
                      <span className="px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-widest">
                        ⏳ Escala de {MONTH_NAMES[currentMonthIndex]} {currentYear}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">
                        Ainda não definido
                      </h3>
                      <p className="text-xs text-slate-400 font-medium max-w-md">
                        {canManageRoster
                          ? 'Nenhum turno foi lançado para este colaborador neste mês. Clique em qualquer dia (ou use a Planilha Mensal) para definir a escala.'
                          : 'A escala deste mês ainda não foi definida e enviada pelo gestor do seu setor.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rodapé do Card CR Task */}
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-medium">
            {!isScheduleUndefined ? (
              <span>
                Resumo Mensal: <strong className="text-emerald-400">{stats?.totalWork || 0} dias trabalhados</strong> • <strong className="text-purple-400">{stats?.totalOff || 0} folgas</strong>
                {(stats?.totalVacation || 0) > 0 ? ` • ${stats?.totalVacation} dias de férias` : ''}
              </span>
            ) : (
              <span className="text-amber-400/90 font-semibold">
                ⏳ Escala mensal de {MONTH_NAMES[currentMonthIndex]} {currentYear} ainda não definida
              </span>
            )}
            <span className="text-slate-500 font-semibold">
              CR Task • Painel Operacional
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // VISÃO EXCLUSIVA DO COLABORADOR COMUM (!isLeaderOrAdmin)
  // ============================================================================
  if (!isLeaderOrAdmin) {
    // Alinhado estritamente ao colaborador do quadro/logado (ex: Ruan vê apenas Ruan, nunca o Davis)
    const activeMemberForUser = matchedCurrentUserMember;
    const canExportUserScale = hasMemberShiftsInMonth(activeMemberForUser) && isMemberSchedulePublished(activeMemberForUser);

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
                Minha Escala Mensal
                <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-full">
                  {activeMemberForUser}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Consulte seus dias de trabalho, folgas da semana, finais de semana e férias por mês
              </p>
            </div>
          </div>

          {/* Seletor de Mês e Ações do Colaborador */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Navegação de Mês */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-all cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-sm font-bold text-slate-800 capitalize flex items-center gap-1.5 min-w-[140px] justify-center">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{MONTH_NAMES[currentMonthIndex]} {currentYear}</span>
              </div>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-all cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleCurrentMonth}
                className="ml-1 px-2.5 py-1 text-xs font-semibold bg-white text-blue-700 hover:bg-blue-50 rounded-lg border border-slate-200/80 cursor-pointer"
              >
                Atual
              </button>
            </div>

            {/* Botões de Baixar / Copiar Escala (Apenas quando a escala do mês já foi definida e enviada) */}
            {activeMemberForUser && canExportUserScale && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyGoPng(activeMemberForUser)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Imagem</span>
                </button>
                <button
                  onClick={() => handleDownloadGoPng(activeMemberForUser)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Escala (PNG)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {shareFeedbackMsg && (
          <div className="mx-6 mt-4 bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>{shareFeedbackMsg}</span>
            <button onClick={() => setShareFeedbackMsg(null)} className="text-emerald-700 hover:text-emerald-950">✕</button>
          </div>
        )}

        {/* Corpo com o Card CR Task Centralizado do Próprio Colaborador */}
        <div className="flex-1 p-6 flex flex-col items-center justify-start">
          {renderGoScheduleCard(activeMemberForUser)}
        </div>
      </div>
    );
  }

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
                  Controle de vindas, folgas 5x2, férias e envio individual de escalas
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
                onClick={() => setActiveViewMode('go_card')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeViewMode === 'go_card' 
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60 font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Card Individual (CR)</span>
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

                {/* 2. COMPARTILHAR / ENVIAR ESCALAS (NOVO BOTÃO SOLICITADO) */}
                <button
                  onClick={() => {
                    if (!selectedGoMember && allRosterMembers.length > 0) {
                      setSelectedGoMember(allRosterMembers[0]);
                    }
                    setShareFeedbackMsg(null);
                    setIsShareModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Visualizar no formato GO e enviar a escala para o colaborador"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Compartilhar Escalas</span>
                </button>

                {/* 3. Adicionar Colaboradores (Individual ou em Grupo) */}
                <button
                  onClick={() => setIsAddMemberModalOpen(true)}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Adicionar Colaborador</span>
                </button>

                {/* 4. Gerenciar Equipe & Turnos */}
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
        {/* VISÃO ESPECIAL: CARD INDIVIDUAL (FORMATO GO DA IMAGEM) */}
        {/* ============================================================== */}
        {activeViewMode === 'go_card' && (
          <div className="p-6 max-w-5xl mx-auto flex flex-col items-center gap-5">
            {/* Barra de Seleção do Colaborador e Botões de Envio Rápido */}
            <div className="w-full max-w-[920px] bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Colaborador:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const idx = allRosterMembers.indexOf(selectedGoMember);
                      const prevIdx = idx > 0 ? idx - 1 : allRosterMembers.length - 1;
                      if (allRosterMembers[prevIdx]) setSelectedGoMember(allRosterMembers[prevIdx]);
                    }}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                    title="Colaborador Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <select
                    value={selectedGoMember}
                    onChange={e => setSelectedGoMember(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[220px]"
                  >
                    {allRosterMembers.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const idx = allRosterMembers.indexOf(selectedGoMember);
                      const nextIdx = idx < allRosterMembers.length - 1 ? idx + 1 : 0;
                      if (allRosterMembers[nextIdx]) setSelectedGoMember(allRosterMembers[nextIdx]);
                    }}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                    title="Próximo Colaborador"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleCopyGoPng(selectedGoMember)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Copiar imagem para colar no WhatsApp ou Teams"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Imagem</span>
                </button>
                <button
                  onClick={() => handleDownloadGoPng(selectedGoMember)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PNG</span>
                </button>
                <button
                  onClick={() => handleSendScaleToCollaborator(selectedGoMember)}
                  disabled={isSendingShare || !selectedGoMember}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingShare ? 'Enviando...' : 'Enviar para Colaborador'}</span>
                </button>
              </div>
            </div>

            {shareFeedbackMsg && (
              <div className="w-full max-w-[920px] bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
                <span>{shareFeedbackMsg}</span>
                <button onClick={() => setShareFeedbackMsg(null)} className="text-emerald-700 hover:text-emerald-950">✕</button>
              </div>
            )}

            {renderGoScheduleCard(selectedGoMember)}
          </div>
        )}

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
                  <col style={{ width: '275px', minWidth: '275px' }} />
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
                            <div className="flex items-center justify-between gap-1.5">
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
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200/60 truncate max-w-[100px]" title={`Turno: ${item.turnoName}`}>
                                      {item.turnoName}
                                    </span>
                                    {/* Cargo */}
                                    {roleBadge ? (
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border truncate max-w-[100px] ${roleBadge.bg}`} title={`Cargo: ${roleBadge.label}`}>
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
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={() => {
                                      setSelectedGoMember(member);
                                      setShareFeedbackMsg(null);
                                      setIsShareModalOpen(true);
                                    }}
                                    className="opacity-0 group-hover/row:opacity-100 text-indigo-600 hover:bg-indigo-50 p-1 rounded transition-opacity cursor-pointer"
                                    title={`Compartilhar / Enviar escala de ${member}`}
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveMember(member, item.turnoName)}
                                    className="opacity-0 group-hover/row:opacity-100 text-slate-400 hover:text-red-600 p-1 rounded transition-opacity cursor-pointer"
                                    title="Remover da Escala"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
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
        {/* VISÃO 2: CALENDÁRIO MENSAL TRADICIONAL (COM MENU SUSPENSO AO PASSAR O MOUSE) */}
        {/* ============================================================== */}
        {activeViewMode === 'calendario' && (
          <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <CalendarRange className="w-4 h-4 text-blue-600" />
                  <span>Visão de Calendário da Equipe — {MONTH_NAMES[currentMonthIndex]} {currentYear}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                  💡 Passe o mouse sobre <strong className="text-emerald-700">Trabalhando</strong> ou <strong className="text-purple-700">Folga</strong> para ver os nomes no menu suspenso
                </span>
              </div>

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
                  <div key={`empty_${i}`} className="min-h-[115px] bg-slate-50/60 rounded-xl border border-dashed border-slate-200/60 p-2"></div>
                ))}

                {monthDaysList.map(d => {
                  type DayMemberEntry = {
                    name: string;
                    turno: string;
                    def: StatusDefinition;
                    customText: string;
                  };

                  const workList: DayMemberEntry[] = [];
                  const offList: DayMemberEntry[] = [];
                  const vacList: DayMemberEntry[] = [];
                  const atList: DayMemberEntry[] = [];
                  const seenInDay = new Set<string>();

                  // 1. Membros dos grupos filtrados
                  filteredGroups.forEach(g => {
                    g.members.forEach(m => {
                      const normKey = normText(m);
                      if (seenInDay.has(normKey)) return;
                      seenInDay.add(normKey);

                      const res = resolveCellStatus(m, d.dateStr);
                      if (res.def) {
                        const entry: DayMemberEntry = {
                          name: m,
                          turno: g.name,
                          def: res.def,
                          customText: res.customText
                        };
                        if (res.def.category === 'work' || res.def.category === 'remote') workList.push(entry);
                        else if (res.def.category === 'off') offList.push(entry);
                        else if (res.def.category === 'vacation') vacList.push(entry);
                        else if (res.def.category === 'medical' || res.def.category === 'special') atList.push(entry);
                      }
                    });
                  });

                  // 2. Caso haja algum colaborador com turno lançado que ainda não esteja em um grupo
                  if (filterTurno === 'all') {
                    allRosterMembers.forEach(m => {
                      const normKey = normText(m);
                      if (seenInDay.has(normKey)) return;
                      if (searchMember && !m.toLowerCase().includes(searchMember.toLowerCase())) return;
                      seenInDay.add(normKey);

                      const res = resolveCellStatus(m, d.dateStr);
                      if (res.def) {
                        const entry: DayMemberEntry = {
                          name: m,
                          turno: 'Geral',
                          def: res.def,
                          customText: res.customText
                        };
                        if (res.def.category === 'work' || res.def.category === 'remote') workList.push(entry);
                        else if (res.def.category === 'off') offList.push(entry);
                        else if (res.def.category === 'vacation') vacList.push(entry);
                        else if (res.def.category === 'medical' || res.def.category === 'special') atList.push(entry);
                      }
                    });
                  }

                  const alignRight = d.dayOfWeek >= 5; // Sexta e Sábado alinham o menu suspenso à direita para não cortar na tela

                  const renderHoverDropdown = (
                    title: string,
                    dotColor: string,
                    headerBadgeClass: string,
                    entries: DayMemberEntry[]
                  ) => (
                    <div
                      className={`hidden group-hover/pill:block absolute top-full pt-1.5 z-50 w-68 ${
                        alignRight ? 'right-0' : 'left-0'
                      }`}
                    >
                      <div className="bg-[#0f172a] text-white rounded-xl shadow-2xl border border-slate-700/90 overflow-hidden ring-1 ring-black/20">
                        {/* Cabeçalho do Menu Suspenso */}
                        <div className="px-3 py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
                              {title} ({entries.length})
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {d.label} ({d.dayNameShort})
                          </span>
                        </div>

                        {/* Lista de Nomes dos Colaboradores */}
                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/70 p-1.5 flex flex-col gap-0.5">
                          {entries.map(item => {
                            const prof = getMemberProfile(item.name);
                            const badgeLabel =
                              item.def.code === 'PRESENCA'
                                ? '✓ Trabalha'
                                : item.def.code === 'FG'
                                ? 'FG • Folga'
                                : item.def.code === 'DOM'
                                ? 'DOM • Folga'
                                : item.def.code === 'DOFF'
                                ? 'DAY OFF'
                                : item.def.code === 'FERIAS'
                                ? 'FÉRIAS'
                                : item.def.code === 'EXT'
                                ? 'EXT • Externo'
                                : item.def.code === 'HOME'
                                ? 'HOME'
                                : item.customText || item.def.shortLabel;

                            return (
                              <div
                                key={item.name}
                                onClick={() => {
                                  setSelectedGoMember(item.name);
                                  setShareFeedbackMsg(null);
                                  setIsShareModalOpen(true);
                                }}
                                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/90 transition-colors cursor-pointer"
                                title={`Clique para abrir o card individual de ${item.name}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {prof?.avatar_url ? (
                                    <img
                                      src={prof.avatar_url}
                                      alt={item.name}
                                      className="w-6 h-6 rounded-full object-cover border border-slate-600 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-indigo-600/40 border border-indigo-400/40 text-indigo-200 font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {item.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0 leading-tight">
                                    <span className="text-xs font-bold text-white truncate">
                                      {item.name}
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-400 truncate">
                                      {item.turno}
                                    </span>
                                  </div>
                                </div>

                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 ${headerBadgeClass}`}>
                                  {badgeLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <div 
                      key={d.dateStr}
                      className={`min-h-[115px] rounded-xl border p-2 flex flex-col justify-between transition-all relative hover:z-40 ${
                        d.isSunday 
                          ? 'bg-purple-50/30 border-purple-200/60' 
                          : d.isWeekend 
                            ? 'bg-amber-50/30 border-amber-200/60' 
                            : 'bg-white border-slate-200 hover:shadow-sm'
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
                        {workList.length > 0 && (
                          <div className="group/pill relative">
                            <div className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200/90 text-emerald-900 border border-emerald-200/80 flex items-center justify-between cursor-pointer transition-colors">
                              <span>Trabalhando:</span>
                              <span className="flex items-center gap-1 font-extrabold">
                                {workList.length}
                                <span className="text-[9px] opacity-70">▾</span>
                              </span>
                            </div>
                            {renderHoverDropdown(
                              'Trabalhando',
                              'bg-emerald-400',
                              'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
                              workList
                            )}
                          </div>
                        )}

                        {offList.length > 0 && (
                          <div className="group/pill relative">
                            <div className="px-2 py-1 rounded-lg bg-purple-100 hover:bg-purple-200/90 text-purple-900 border border-purple-200/80 flex items-center justify-between cursor-pointer transition-colors">
                              <span>Folga:</span>
                              <span className="flex items-center gap-1 font-extrabold">
                                {offList.length}
                                <span className="text-[9px] opacity-70">▾</span>
                              </span>
                            </div>
                            {renderHoverDropdown(
                              'De Folga',
                              'bg-purple-400',
                              'bg-purple-500/20 text-purple-300 border border-purple-500/30',
                              offList
                            )}
                          </div>
                        )}

                        {vacList.length > 0 && (
                          <div className="group/pill relative">
                            <div className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200/90 text-amber-900 border border-amber-200/80 flex items-center justify-between cursor-pointer transition-colors">
                              <span>Férias:</span>
                              <span className="flex items-center gap-1 font-extrabold">
                                {vacList.length}
                                <span className="text-[9px] opacity-70">▾</span>
                              </span>
                            </div>
                            {renderHoverDropdown(
                              'Em Férias',
                              'bg-amber-400',
                              'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                              vacList
                            )}
                          </div>
                        )}

                        {atList.length > 0 && (
                          <div className="group/pill relative">
                            <div className="px-2 py-1 rounded-lg bg-sky-100 hover:bg-sky-200/90 text-sky-900 border border-sky-200/80 flex items-center justify-between cursor-pointer transition-colors">
                              <span>Atestado / Outros:</span>
                              <span className="flex items-center gap-1 font-extrabold">
                                {atList.length}
                                <span className="text-[9px] opacity-70">▾</span>
                              </span>
                            </div>
                            {renderHoverDropdown(
                              'Atestado / Outros',
                              'bg-sky-400',
                              'bg-sky-500/20 text-sky-300 border border-sky-500/30',
                              atList
                            )}
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
                          <div className="flex flex-col gap-1.5">
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
                            <button
                              onClick={() => {
                                setSelectedGoMember(member);
                                setShareFeedbackMsg(null);
                                setIsShareModalOpen(true);
                              }}
                              className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Compartilhar Escala (CR)</span>
                            </button>
                          </div>
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
      {/* MODAL DE COMPARTILHAMENTO E ENVIO DE ESCALAS (PADRÃO CR TASK) */}
      {/* ============================================================== */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 max-h-[94vh] flex flex-col">
            
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Compartilhar & Enviar Escala Individual (CR Task)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Envie a escala mensal diretamente para a conta do colaborador ou copie/baixe o card oficial CR Task em alta definição
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Barra de Seleção do Colaborador + Botões de Disparo */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Colaborador:</span>
                <button
                  onClick={() => {
                    const idx = allRosterMembers.indexOf(selectedGoMember);
                    const prevIdx = idx > 0 ? idx - 1 : allRosterMembers.length - 1;
                    if (allRosterMembers[prevIdx]) setSelectedGoMember(allRosterMembers[prevIdx]);
                  }}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={selectedGoMember}
                  onChange={e => setSelectedGoMember(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[200px]"
                >
                  {allRosterMembers.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const idx = allRosterMembers.indexOf(selectedGoMember);
                    const nextIdx = idx < allRosterMembers.length - 1 ? idx + 1 : 0;
                    if (allRosterMembers[nextIdx]) setSelectedGoMember(allRosterMembers[nextIdx]);
                  }}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleCopyGoPng(selectedGoMember)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Copiar imagem pronta para colar no WhatsApp"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>Copiar Imagem (WhatsApp)</span>
                </button>

                <button
                  onClick={() => handleDownloadGoPng(selectedGoMember)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Baixar PNG</span>
                </button>

                <button
                  onClick={() => handleSendScaleToCollaborator(selectedGoMember)}
                  disabled={isSendingShare || !selectedGoMember}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingShare ? 'Enviando...' : `Enviar para ${selectedGoMember.split(' ')[0]}`}</span>
                </button>

                <button
                  onClick={handleSendScaleToAllTeam}
                  disabled={isSendingShare || allRosterMembers.length === 0}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Notificar todos os colaboradores do setor sobre a escala do mês"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Enviar p/ Toda Equipe</span>
                </button>
              </div>
            </div>

            {shareFeedbackMsg && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between shrink-0">
                <span>{shareFeedbackMsg}</span>
                <button onClick={() => setShareFeedbackMsg(null)} className="text-emerald-700 hover:text-emerald-950">✕</button>
              </div>
            )}

            {/* Pré-visualização ao Vivo do Card GO */}
            <div className="flex-1 overflow-y-auto p-2 flex flex-col items-center">
              {renderGoScheduleCard(selectedGoMember, true)}
            </div>

            {/* Rodapé do Modal */}
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>
                O colaborador também pode acessar este card a qualquer momento na aba <strong>"Minha Escala"</strong> do seu painel.
              </span>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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
                        🔄 Alternar: 1ª semana Sábado (FG) / 2ª semana Domingo (DOM)
                      </option>
                      <option value="alternate_sun_first">
                        🔄 Alternar (Invertido): 1ª semana Domingo (DOM) / 2ª semana Sábado (FG)
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
