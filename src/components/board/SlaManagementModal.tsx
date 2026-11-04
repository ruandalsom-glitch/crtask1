'use client';

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import {
  Headset,
  Calendar,
  Clock,
  User,
  Users,
  Trash2,
  Edit3,
  Search,
  Filter,
  X,
  Check,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ArrowRight,
  CheckSquare,
  AlertTriangle
} from 'lucide-react';

interface SlaManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId?: string;
  workspaceId?: string;
  onOpenCreateSla?: () => void;
}

export function SlaManagementModal({
  isOpen,
  onClose,
  boardId,
  workspaceId,
  onOpenCreateSla
}: SlaManagementModalProps) {
  const queryClient = useQueryClient();

  // Estados de Filtro e Navegação de Data
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedCollab, setSelectedCollab] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonthOnly, setFilterMonthOnly] = useState(true);

  // Estados de Seleção em Lote
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchActionModal, setBatchActionModal] = useState<'reassign' | null>(null);
  const [batchTargetEmail, setBatchTargetEmail] = useState('');

  // Estado de Edição Individual
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editStatus, setEditStatus] = useState('');

  // 1. Busca todos os plantões SLA
  const { data: rawSlaTasks = [], isLoading } = useQuery({
    queryKey: ['sla_management_tasks', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          start_date,
          due_time,
          status,
          priority,
          group_name,
          assignee_email,
          board_id,
          boards:board_id (id, name, workspace_id)
        `)
        .or('priority.eq.SLA,group_name.eq.SLA Atendimento,title.ilike.*SLA*')
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Erro ao buscar escalas SLA:', error);
        return [];
      }
      return data || [];
    },
    enabled: isOpen,
    staleTime: 30 * 1000
  });

  // 2. Busca todos os perfis para resolução de fotos e nomes
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, avatar_url, role')
        .order('email');
      return data || [];
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000
  });

  // Perfis operacionais válidos para o SLA (exclui a conta admin pura do Ruan)
  const operationalProfiles = useMemo(() => {
    return (allProfiles || []).filter(
      (p: any) => p.email !== 'ruan.dalsom@crexpresstransportessp.com.br'
    );
  }, [allProfiles]);

  // Navegação de Mês
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const currentMonthLabel = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const currentMonthPrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  // Filtros aplicados
  const filteredTasks = useMemo(() => {
    return rawSlaTasks.filter((t: any) => {
      // Filtro de Mês
      if (filterMonthOnly && t.due_date && !t.due_date.startsWith(currentMonthPrefix)) {
        return false;
      }
      // Filtro de Colaborador
      if (selectedCollab !== 'all' && t.assignee_email !== selectedCollab) {
        return false;
      }
      // Filtro de Status
      if (selectedStatus !== 'all' && t.status !== selectedStatus) {
        return false;
      }
      // Filtro de Busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDate = (t.due_date || '').includes(q);
        const matchesCollab = (t.assignee_email || '').toLowerCase().includes(q);
        const matchesTitle = (t.title || '').toLowerCase().includes(q);
        if (!matchesDate && !matchesCollab && !matchesTitle) return false;
      }
      return true;
    });
  }, [rawSlaTasks, filterMonthOnly, currentMonthPrefix, selectedCollab, selectedStatus, searchQuery]);

  // Contagem por Colaborador no período filtrado
  const collaboratorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTasks.forEach((t: any) => {
      const email = t.assignee_email || 'Sem Responsável';
      counts[email] = (counts[email] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredTasks]);

  // Helpers de Usuário
  const getProfile = (email?: string) => {
    if (!email) return null;
    return allProfiles.find((p: any) => p.email === email) || null;
  };
  const getDisplayName = (email?: string) => {
    if (!email) return 'Sem Responsável';
    const prefix = email.split('@')[0];
    return prefix
      .split(/[\._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  };

  // MUTAÇÃO: Excluir plantão individual
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla_management_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  // MUTAÇÃO: Exclusão em Lote
  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('tasks').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['sla_management_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  // MUTAÇÃO: Alterar Colaborador em Lote
  const batchReassignMutation = useMutation({
    mutationFn: async ({ ids, newEmail }: { ids: string[]; newEmail: string }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ assignee_email: newEmail })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedIds([]);
      setBatchActionModal(null);
      queryClient.invalidateQueries({ queryKey: ['sla_management_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  // MUTAÇÃO: Salvar Edição Individual
  const updateTaskMutation = useMutation({
    mutationFn: async ({
      id,
      due_date,
      due_time,
      assignee_email,
      status
    }: {
      id: string;
      due_date: string;
      due_time: string;
      assignee_email: string;
      status: string;
    }) => {
      const { error } = await supabase
        .from('tasks')
        .update({
          due_date,
          start_date: due_date,
          due_time,
          assignee_email,
          status
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingTask(null);
      queryClient.invalidateQueries({ queryKey: ['sla_management_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  // Abre modal de edição individual
  const startEditing = (task: any) => {
    setEditingTask(task);
    setEditDate(task.due_date || '');
    setEditTime(task.due_time || '09:00');
    setEditAssignee(task.assignee_email || '');
    setEditStatus(task.status || 'Feito');
  };

  // Toggle de seleção de todos
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTasks.map((t: any) => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  if (!isOpen) return null;

  return typeof document !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111625] w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08] flex flex-col max-h-[92vh] overflow-hidden text-slate-800 dark:text-slate-100">
            {/* 1. CABEÇALHO DO PAINEL */}
            <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0d1220] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                  <Headset className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      Painel Administrativo • Escala SLA
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                      {filteredTasks.length} plantões
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Controle de plantonistas, alteração de datas/horários e exclusão de escalas SLA
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end md:self-auto">
                {onOpenCreateSla && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCreateSla();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>+ Escalar Plantão</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2. BARRA DE CARDS DE RESUMO & PLANTÕES POR COLABORADOR */}
            <div className="p-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.01] shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Total no Período */}
                <div className="p-3 bg-white dark:bg-[#161c2e] border border-slate-200 dark:border-white/[0.06] rounded-xl shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total no Período</span>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {filteredTasks.length}
                  </div>
                </div>

                {/* Plantonistas Ativos */}
                <div className="p-3 bg-white dark:bg-[#161c2e] border border-slate-200 dark:border-white/[0.06] rounded-xl shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Colaboradores</span>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5">
                    {collaboratorCounts.length}
                  </div>
                </div>

                {/* Plantonistas e Dias (Resumo visual rápido) */}
                <div className="p-3 bg-white dark:bg-[#161c2e] border border-slate-200 dark:border-white/[0.06] rounded-xl shadow-2xs col-span-2 overflow-x-auto">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                    Dias por Colaborador
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {collaboratorCounts.map(([email, count]) => {
                      const profile = getProfile(email);
                      const name = getDisplayName(email);
                      const isFilterActive = selectedCollab === email;

                      return (
                        <button
                          key={email}
                          type="button"
                          onClick={() => setSelectedCollab(isFilterActive ? 'all' : email)}
                          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            isFilterActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-300'
                          }`}
                          title={`Filtrar apenas ${name}`}
                        >
                          <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-200 shrink-0">
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center font-bold text-[9px]">
                                {name[0]}
                              </span>
                            )}
                          </div>
                          <span>{name.split(' ')[0]}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                              isFilterActive
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-200 dark:bg-white/[0.1] text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {count}d
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. FILTROS E CONTROLES */}
            <div className="p-4 border-b border-slate-200 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white dark:bg-[#111625]">
              {/* Navegação de Mês */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-extrabold capitalize px-2 text-slate-800 dark:text-slate-100 min-w-[130px] text-center">
                  {currentMonthLabel}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
                  title="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMonthOnly(!filterMonthOnly)}
                  className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    !filterMonthOnly
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 dark:border-white/[0.08] text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                  title="Ver todos os meses sem limitação"
                >
                  {!filterMonthOnly ? 'Mostrando Todos' : 'Mês Atual'}
                </button>
              </div>

              {/* Filtro Colaborador, Status e Campo de Busca */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Seletor de Colaborador */}
                <select
                  value={selectedCollab}
                  onChange={e => setSelectedCollab(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#161c2e] text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                >
                  <option value="all">Todos os Colaboradores</option>
                  {operationalProfiles.map((p: any) => (
                    <option key={p.email} value={p.email}>
                      {getDisplayName(p.email)}
                    </option>
                  ))}
                </select>

                {/* Seletor de Status */}
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#161c2e] text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                >
                  <option value="all">Todos os Status</option>
                  <option value="Feito">Feito / Confirmado</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Trabalhando">Trabalhando</option>
                </select>

                {/* Campo de Busca */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar plantão..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#161c2e] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none w-40 focus:w-52 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* BARRA DE AÇÕES EM LOTE (SE HOUVER ITENS SELECIONADOS) */}
            {selectedIds.length > 0 && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 border-b border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between gap-3 text-xs font-bold text-indigo-900 dark:text-indigo-200 shrink-0 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">
                    {selectedIds.length}
                  </span>
                  <span>plantões selecionados</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBatchTargetEmail(operationalProfiles[0]?.email || '');
                      setBatchActionModal('reassign');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Substituir Colaborador</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `ATENÇÃO:\n\nTem certeza que deseja EXCLUIR ${selectedIds.length} plantões SLA selecionados?\nEsta ação retirará essas escalas do calendário permanentemente.`
                        )
                      ) {
                        batchDeleteMutation.mutate(selectedIds);
                      }
                    }}
                    disabled={batchDeleteMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{batchDeleteMutation.isPending ? 'Excluindo...' : 'Excluir Selecionados'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* 4. TABELA DE PLANTÕES */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.04]">
              {isLoading ? (
                <div className="p-16 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                  <span className="text-xs text-slate-400">Carregando escalas SLA...</span>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center">
                  <Headset className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3 opacity-60" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Nenhum plantão SLA encontrado
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {searchQuery || selectedCollab !== 'all' || selectedStatus !== 'all'
                      ? 'Nenhum plantão corresponde aos filtros selecionados. Tente limpar os filtros.'
                      : 'Nenhum plantão SLA agendado para este período.'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/[0.08] text-slate-400 text-[10px] uppercase font-black tracking-wider bg-slate-50/70 dark:bg-white/[0.02] sticky top-0 z-10 backdrop-blur-xs">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredTasks.length && filteredTasks.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 dark:border-white/[0.2] cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Data do Plantão</th>
                      <th className="py-2.5 px-3">Horário</th>
                      <th className="py-2.5 px-3">Colaborador Escalado</th>
                      <th className="py-2.5 px-3">Quadro / Origem</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                    {filteredTasks.map((t: any) => {
                      const profile = getProfile(t.assignee_email);
                      const name = getDisplayName(t.assignee_email);
                      const isSelected = selectedIds.includes(t.id);

                      // Formatação da Data (ex: Sex, 06/11)
                      let formattedDate = t.due_date || '-';
                      let dayOfWeek = '';
                      let isPast = false;
                      let isToday = false;
                      if (t.due_date) {
                        try {
                          const dateObj = new Date(t.due_date + 'T12:00:00');
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const dateOnly = new Date(t.due_date + 'T00:00:00');
                          isPast = dateOnly < today;
                          isToday = dateOnly.getTime() === today.getTime();

                          dayOfWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
                          formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        } catch {}
                      }

                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${
                            isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(t.id)}
                              className="rounded border-slate-300 dark:border-white/[0.2] cursor-pointer"
                            />
                          </td>

                          {/* Data */}
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="capitalize text-slate-400 font-medium min-w-[32px]">{dayOfWeek}</span>
                              <span className="font-extrabold">{formattedDate}</span>
                              {isToday && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-600 text-white uppercase tracking-wider">
                                  Hoje
                                </span>
                              )}
                              {isPast && !isToday && (
                                <span className="text-[10px] text-slate-400">Passado</span>
                              )}
                            </div>
                          </td>

                          {/* Horário */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 font-bold text-[11px] border border-slate-200/80 dark:border-white/[0.06]">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              <span>{t.due_time || '09:00 - 17:00'}</span>
                            </span>
                          </td>

                          {/* Colaborador */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 border border-slate-200 dark:border-white/[0.1] shrink-0">
                                {profile?.avatar_url ? (
                                  <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-600">
                                    {name[0]}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-slate-900 dark:text-white truncate">{name}</span>
                                <span className="text-[10px] text-slate-400 truncate font-mono">{t.assignee_email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Quadro */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium">
                            {t.boards?.name || 'Geral'}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.status === 'Feito'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : t.status === 'Trabalhando'
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {t.status || 'Feito'}
                            </span>
                          </td>

                          {/* Ações */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* Botão Alterar / Editar */}
                              <button
                                type="button"
                                onClick={() => startEditing(t)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                                title="Alterar plantão (data, horário ou responsável)"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Botão Retirar / Excluir */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Tem certeza que deseja retirar a escala de SLA de ${name} no dia ${formattedDate}?`
                                    )
                                  ) {
                                    deleteMutation.mutate(t.id);
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                title="Retirar escala de SLA"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* 5. RODAPÉ DO PAINEL */}
            <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0d1220] flex items-center justify-between gap-4 shrink-0">
              <span className="text-xs text-slate-400">
                Total exibido: <strong>{filteredTasks.length}</strong> de <strong>{rawSlaTasks.length}</strong> plantões
              </span>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer"
              >
                Fechar Painel
              </button>
            </div>
          </div>

          {/* MODAL DE EDIÇÃO INDIVIDUAL DE ESCALA SLA */}
          {editingTask && (
            <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-white dark:bg-[#161c2e] w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.1] p-6 text-slate-800 dark:text-slate-100">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Edit3 className="w-4 h-4" />
                    </div>
                    <h3 className="font-extrabold text-sm">Alterar Escala de SLA</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Colaborador Responsável */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Colaborador Plantonista
                    </label>
                    <select
                      value={editAssignee}
                      onChange={e => setEditAssignee(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] font-medium outline-none cursor-pointer"
                    >
                      {operationalProfiles.map((p: any) => (
                        <option key={p.email} value={p.email}>
                          {getDisplayName(p.email)} ({p.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Data do Plantão */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Data do Plantão
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] font-medium outline-none cursor-pointer"
                    />
                  </div>

                  {/* Horário */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Horário do Plantão
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 09:00 - 17:00"
                      value={editTime}
                      onChange={e => setEditTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] font-medium outline-none"
                    />
                    <div className="flex gap-1.5 mt-2">
                      {['09:00 - 17:00', '08:00 - 17:00', '09:00', '10:00 - 19:00'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditTime(t)}
                          className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Status do Plantão
                    </label>
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] font-medium outline-none cursor-pointer"
                    >
                      <option value="Feito">Feito / Confirmado</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Trabalhando">Trabalhando / Em Andamento</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!editDate) {
                        alert('Por favor, informe a data do plantão.');
                        return;
                      }
                      updateTaskMutation.mutate({
                        id: editingTask.id,
                        due_date: editDate,
                        due_time: editTime,
                        assignee_email: editAssignee,
                        status: editStatus
                      });
                    }}
                    disabled={updateTaskMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    {updateTaskMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL DE SUBSTIUIÇÃO EM LOTE */}
          {batchActionModal === 'reassign' && (
            <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-white dark:bg-[#161c2e] w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.1] p-5 text-slate-800 dark:text-slate-100">
                <h3 className="font-extrabold text-sm mb-1">Substituir Colaborador em Lote</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Selecione o novo colaborador para os <strong>{selectedIds.length}</strong> plantões selecionados:
                </p>

                <select
                  value={batchTargetEmail}
                  onChange={e => setBatchTargetEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] outline-none mb-5 cursor-pointer"
                >
                  {operationalProfiles.map((p: any) => (
                    <option key={p.email} value={p.email}>
                      {getDisplayName(p.email)} ({p.email})
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchActionModal(null)}
                    className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!batchTargetEmail) return;
                      batchReassignMutation.mutate({
                        ids: selectedIds,
                        newEmail: batchTargetEmail
                      });
                    }}
                    disabled={batchReassignMutation.isPending}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {batchReassignMutation.isPending ? 'Substituindo...' : 'Confirmar Substituição'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )
    : null;
}
