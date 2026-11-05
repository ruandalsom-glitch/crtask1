'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Calendar,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  CheckSquare,
  LayoutGrid,
  Users,
  Settings2,
  ExternalLink,
  Filter
} from 'lucide-react';
import Link from 'next/link';

interface SectorOverviewDashboardProps {
  workspaceId?: string;
  workspaceName?: string;
  boardId?: string;
  boardName?: string;
  userRole?: 'admin' | 'leader' | 'user' | null;
  isReadOnly?: boolean;
  onSwitchTab?: (tab: string) => void;
  onNavigateToConfig?: () => void;
}

export function SectorOverviewDashboard({
  workspaceId,
  workspaceName = 'Setor',
  boardId,
  boardName,
  userRole,
  isReadOnly,
  onSwitchTab,
  onNavigateToConfig
}: SectorOverviewDashboardProps) {
  const queryClient = useQueryClient();
  const [taskFilterTab, setTaskFilterTab] = useState<'pendentes' | 'andamento' | 'concluidas' | 'todas'>('pendentes');
  const [selectedBoardFilter, setSelectedBoardFilter] = useState<string>('all');

  // 1. Usuário atual
  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  // 2. Quadros do Setor (quando em modo workspace)
  const { data: workspaceBoards = [], isLoading: isLoadingBoards } = useQuery({
    queryKey: ['workspace_overview_boards', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('boards')
        .select('id, name, created_at, created_by, workspace_id')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (error) {
        console.error('Erro ao buscar quadros do setor:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!workspaceId
  });

  const effectiveBoardIds = useMemo(() => {
    if (boardId) return [boardId];
    return workspaceBoards.map((b: any) => b.id);
  }, [boardId, workspaceBoards]);

  // 3. Tarefas pertencentes aos quadros do setor
  const { data: allSectorTasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['workspace_overview_tasks', workspaceId, boardId, effectiveBoardIds],
    queryFn: async () => {
      if (effectiveBoardIds.length === 0) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*, boards(id, name, workspace_id)')
        .in('board_id', effectiveBoardIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar tarefas do setor:', error);
        return [];
      }
      return data || [];
    },
    enabled: effectiveBoardIds.length > 0
  });

  // 4. Membros do Setor
  const { data: sectorMembers = [] } = useQuery({
    queryKey: ['workspace_overview_members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data: memberLinks, error } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', workspaceId);

      if (error || !memberLinks || memberLinks.length === 0) return [];

      const userIds = memberLinks.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, avatar_url, role')
        .in('id', userIds);

      // Exclui a conta administrativa pura do Ruan para contagem de equipe operacional
      return (profiles || [])
        .filter((p: any) => p.email !== 'ruan.dalsom@crexpresstransportessp.com.br')
        .map((p: any) => {
          const link = memberLinks.find((m: any) => m.user_id === p.id);
          return {
            ...p,
            sectorRole: link?.role || p.role
          };
        });
    },
    enabled: !!workspaceId
  });

  // Filtragem das tarefas por quadro selecionado
  const scopedTasks = useMemo(() => {
    if (selectedBoardFilter === 'all') return allSectorTasks;
    return allSectorTasks.filter((t: any) => t.board_id === selectedBoardFilter);
  }, [allSectorTasks, selectedBoardFilter]);

  // Estatísticas calculadas
  const totalTasks = scopedTasks.length;
  const concluidasTasks = scopedTasks.filter(
    (t: any) => t.status === 'Feito' || t.status === 'Concluído'
  );
  const andamentoTasks = scopedTasks.filter(
    (t: any) => t.status === 'Trabalhando' || t.status === 'Em Andamento'
  );
  const travadasOuAtrasadas = scopedTasks.filter((t: any) => {
    if (t.status === 'Travado') return true;
    if (t.due_date && t.status !== 'Feito' && t.status !== 'Concluído') {
      const today = new Date().toISOString().split('T')[0];
      return t.due_date < today;
    }
    return false;
  });
  const pendentesTasks = scopedTasks.filter(
    (t: any) =>
      t.status !== 'Feito' &&
      t.status !== 'Concluído' &&
      t.status !== 'Trabalhando' &&
      t.status !== 'Em Andamento'
  );

  const completionRate = totalTasks > 0 ? Math.round((concluidasTasks.length / totalTasks) * 100) : 0;

  // Lista de tarefas filtrada pela aba de status
  const displayedTasks = useMemo(() => {
    if (taskFilterTab === 'pendentes') return pendentesTasks;
    if (taskFilterTab === 'andamento') return andamentoTasks;
    if (taskFilterTab === 'concluidas') return concluidasTasks;
    return scopedTasks;
  }, [taskFilterTab, pendentesTasks, andamentoTasks, concluidasTasks, scopedTasks]);

  // Toggle rápido de status da tarefa
  const handleToggleTaskStatus = async (task: any) => {
    if (isReadOnly) return;
    const isDone = task.status === 'Feito' || task.status === 'Concluído';
    const nextStatus = isDone ? 'Trabalhando' : 'Feito';
    await supabase.from('tasks').update({ status: nextStatus }).eq('id', task.id);
    queryClient.invalidateQueries({ queryKey: ['workspace_overview_tasks'] });
    queryClient.invalidateQueries({ queryKey: ['board_overview_tasks'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['board_tasks'] });
  };

  // Criação rápida de tarefa
  const handleQuickAddTask = async () => {
    if (isReadOnly) return;
    const targetBoardId =
      selectedBoardFilter !== 'all'
        ? selectedBoardFilter
        : boardId || workspaceBoards[0]?.id;

    if (!targetBoardId) {
      alert('Nenhum quadro encontrado neste setor. Crie um quadro primeiro para adicionar tarefas.');
      return;
    }

    const title = prompt('Título da nova tarefa:');
    if (!title || !title.trim()) return;

    const creatorEmail =
      currentUser?.email === 'ruan.dalsom@crexpresstransportessp.com.br'
        ? 'ruan.dalsom@masterdeliveryexpress.com.br'
        : currentUser?.email || '';

    const { error } = await supabase.from('tasks').insert([
      {
        board_id: targetBoardId,
        title: title.trim(),
        status: 'Trabalhando',
        priority: 'Média',
        assignee_name: creatorEmail.split('@')[0] || 'Eu',
        assignee_email: creatorEmail
      }
    ]);

    if (error) {
      alert('Erro ao criar tarefa: ' + error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['workspace_overview_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['board_overview_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Sem prazo';
    try {
      const [year, month, day] = dateStr.split('-');
      const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const mIdx = parseInt(month, 10) - 1;
      return `${day} de ${months[mIdx] || month}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. BARRA SUPERIOR DE RESUMO DO SETOR & SELETOR DE QUADRO */}
      <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-800 dark:text-white">
                Visão Geral: {workspaceName}
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {workspaceBoards.length} {workspaceBoards.length === 1 ? 'quadro' : 'quadros'}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                {sectorMembers.length} {sectorMembers.length === 1 ? 'colaborador' : 'colaboradores'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Métricas consolidadas, tarefas ativas e desempenho operacional do setor.
            </p>
          </div>
        </div>

        {/* Filtro por Quadro no Setor */}
        {workspaceBoards.length > 1 && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedBoardFilter}
              onChange={(e) => setSelectedBoardFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Todos os quadros ({allSectorTasks.length} tarefas)</option>
              {workspaceBoards.map((b: any) => {
                const count = allSectorTasks.filter((t: any) => t.board_id === b.id).length;
                return (
                  <option key={b.id} value={b.id}>
                    {b.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* 2. CARDS DE KPI (MÉTRICAS DO SETOR) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tarefas do Setor */}
        <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-white/[0.08] hover:border-blue-400 dark:hover:border-blue-500/40 rounded-2xl p-5 shadow-sm dark:shadow-lg dark:shadow-black/20 transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500 dark:text-blue-400">
                <CheckSquare className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Total de Tarefas</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {completionRate}% concluído
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              {totalTasks}
            </h3>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Ativas no setor
            </span>
          </div>
        </div>

        {/* Card 2: Em Andamento */}
        <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-white/[0.08] hover:border-amber-400 dark:hover:border-amber-500/40 rounded-2xl p-5 shadow-sm dark:shadow-lg dark:shadow-black/20 transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Em Andamento</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Execução ativa
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              {andamentoTasks.length}
            </h3>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {totalTasks > 0 ? Math.round((andamentoTasks.length / totalTasks) * 100) : 0}% do total
            </span>
          </div>
        </div>

        {/* Card 3: Concluídas */}
        <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-white/[0.08] hover:border-emerald-400 dark:hover:border-emerald-500/40 rounded-2xl p-5 shadow-sm dark:shadow-lg dark:shadow-black/20 transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Concluídas</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Finalizadas
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              {concluidasTasks.length}
            </h3>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> {completionRate}% sucesso
            </span>
          </div>
        </div>

        {/* Card 4: Atrasadas / Travadas */}
        <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-white/[0.08] hover:border-rose-400 dark:hover:border-rose-500/40 rounded-2xl p-5 shadow-sm dark:shadow-lg dark:shadow-black/20 transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Atrasadas / Travadas</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              travadasOuAtrasadas.length > 0 
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            }`}>
              {travadasOuAtrasadas.length > 0 ? 'Atenção' : 'Em Dia'}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              {travadasOuAtrasadas.length}
            </h3>
            <span className={`text-[11px] font-bold flex items-center gap-0.5 ${
              travadasOuAtrasadas.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {travadasOuAtrasadas.length > 0 ? 'Requer atenção' : 'Nenhuma pendência crítica'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. QUADROS DO SETOR (CARDS RÁPIDOS DOS QUADROS DESTE SETOR) */}
      {workspaceBoards.length > 0 && (
        <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06] mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Quadros do Setor ({workspaceBoards.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Progresso e navegação direta para os fluxos de trabalho deste setor
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaceBoards.map((b: any) => {
              const bTasks = allSectorTasks.filter((t: any) => t.board_id === b.id);
              const bDone = bTasks.filter((t: any) => t.status === 'Feito' || t.status === 'Concluído').length;
              const bProgress = bTasks.length > 0 ? Math.round((bDone / bTasks.length) * 100) : 0;

              return (
                <div
                  key={b.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] hover:border-blue-400 dark:hover:border-blue-500/40 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-white truncate">
                        {b.name}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                        {bProgress}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-white/[0.08] h-1.5 rounded-full overflow-hidden my-2.5">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${bProgress}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                      <span>{bTasks.length} {bTasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
                      <span>{bDone} concluídas</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/[0.04] flex items-center justify-end">
                    <Link
                      href={`/boards/${b.id}`}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 group-hover:underline"
                    >
                      <span>Abrir Quadro</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. GRID PRINCIPAL: TAREFAS DO SETOR + COLUNA LATERAL (EQUIPE, INDICADORES, COMUNICADOS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA (2/3): TAREFAS DO SETOR */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white tracking-tight">
                    Tarefas do Setor
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Atividades e demandas distribuídas nos quadros deste setor
                  </p>
                </div>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleQuickAddTask}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Nova Tarefa</span>
                </button>
              )}
            </div>

            {/* Abas Internas de Filtro de Tarefas */}
            <div className="flex flex-wrap items-center gap-2 pt-4 pb-3">
              <button
                type="button"
                onClick={() => setTaskFilterTab('pendentes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  taskFilterTab === 'pendentes'
                    ? 'bg-indigo-100 dark:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/40 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                Pendentes ({pendentesTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilterTab('andamento')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  taskFilterTab === 'andamento'
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                Em Andamento ({andamentoTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilterTab('concluidas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  taskFilterTab === 'concluidas'
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                Concluídas ({concluidasTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilterTab('todas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  taskFilterTab === 'todas'
                    ? 'bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                Todas ({scopedTasks.length})
              </button>
            </div>

            {/* Lista Estilizada de Tarefas */}
            <div className="space-y-2.5">
              {displayedTasks.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  Nenhuma tarefa nesta categoria no momento.
                </div>
              ) : (
                displayedTasks.slice(0, 8).map((task: any, idx: number) => {
                  const isDone = task.status === 'Feito' || task.status === 'Concluído';
                  const priorityClass =
                    task.priority === 'Alta'
                      ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30'
                      : task.priority === 'Baixa'
                      ? 'bg-slate-100 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-500/30'
                      : 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30';

                  const boardInfo = workspaceBoards.find((b: any) => b.id === task.board_id);

                  return (
                    <div
                      key={task.id || idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.04] transition-all group gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox redondinho estilizado */}
                        <button
                          type="button"
                          onClick={() => handleToggleTaskStatus(task)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            isDone
                              ? 'bg-emerald-500 border-emerald-400 text-white'
                              : 'border-slate-400 dark:border-slate-600 hover:border-indigo-500 bg-white dark:bg-white/[0.03]'
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <div className="min-w-0">
                          <span
                            className={`text-xs font-semibold truncate block ${
                              isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {task.title}
                          </span>
                          {boardInfo && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block">
                              Quadro: {boardInfo.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Tag de Grupo */}
                        {task.group_name && (
                          <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                            {task.group_name}
                          </span>
                        )}

                        {/* Prazo */}
                        <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(task.due_date)}</span>
                        </span>

                        {/* Prioridade */}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${priorityClass}`}>
                          {task.priority || 'Média'}
                        </span>

                        {/* Avatar do Responsável */}
                        <div className="relative" title={task.assignee_name || task.assignee_email || 'Não atribuído'}>
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-[10px] font-black border border-white/20">
                            {task.assignee_name?.[0]?.toUpperCase() || task.assignee_email?.[0]?.toUpperCase() || 'R'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {displayedTasks.length > 8 && (
              <div className="pt-4 text-center">
                <span className="text-xs text-slate-400">
                  Mostrando 8 de {displayedTasks.length} tarefas. Acesse o quadro correspondente para visualização completa.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA (1/3): EQUIPE DO SETOR */}
        <div className="space-y-6">
          {/* Card 1: Equipe do Setor */}
          <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">
                    Equipe do Setor
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {sectorMembers.length} {sectorMembers.length === 1 ? 'membro cadastrado' : 'membros cadastrados'}
                  </span>
                </div>
              </div>

              {onNavigateToConfig && (
                <button
                  type="button"
                  onClick={onNavigateToConfig}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Gerenciar</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {sectorMembers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 italic">
                  Nenhum colaborador alocado neste setor ainda.
                </div>
              ) : (
                sectorMembers.slice(0, 5).map((m: any) => {
                  const userTaskCount = scopedTasks.filter(
                    (t: any) => t.assignee_email === m.email || t.assignee_name === m.email.split('@')[0]
                  ).length;
                  const isLeader = m.sectorRole === 'leader' || m.role === 'leader';

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-[10px] font-black border border-white/20 shrink-0">
                          {m.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block">
                            {m.email}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {userTaskCount} {userTaskCount === 1 ? 'tarefa atribuída' : 'tarefas atribuídas'}
                          </span>
                        </div>
                      </div>

                      {isLeader && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                          Líder
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
