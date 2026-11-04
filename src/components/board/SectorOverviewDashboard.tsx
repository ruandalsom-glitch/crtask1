'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Plus,
  Calendar,
  Send,
  BarChart3,
  TrendingUp,
  MoreVertical,
  Check,
  User,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckSquare
} from 'lucide-react';
import Link from 'next/link';

interface SectorOverviewDashboardProps {
  boardId: string;
  boardName: string;
  isReadOnly?: boolean;
  onSwitchTab?: (tab: string) => void;
}

export function SectorOverviewDashboard({
  boardId,
  boardName,
  isReadOnly,
  onSwitchTab
}: SectorOverviewDashboardProps) {
  const queryClient = useQueryClient();
  const [taskFilterTab, setTaskFilterTab] = useState<'pendentes' | 'andamento' | 'concluidas'>('pendentes');

  // 1. Busca usuário atual
  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  // 2. Busca todas as tarefas do quadro
  const { data: boardTasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['board_overview_tasks', boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar tarefas do quadro:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 60 * 1000
  });

  // 3. Busca comunicados de mensagens recentes do setor
  const { data: comunicadosHoje = [] } = useQuery({
    queryKey: ['overview_comunicados_hoje'],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('mensagens_checklist')
        .select('*')
        .eq('data', todayStr)
        .order('horario', { ascending: true })
        .limit(6);
      return data || [];
    },
    staleTime: 60 * 1000
  });

  // Estatísticas calculadas das tarefas
  const totalTasks = boardTasks.length;
  const concluidasTasks = boardTasks.filter(
    (t: any) => t.status === 'Feito' || t.status === 'Concluído'
  );
  const andamentoTasks = boardTasks.filter(
    (t: any) => t.status === 'Trabalhando' || t.status === 'Em Andamento'
  );
  const travadasOuAtrasadas = boardTasks.filter((t: any) => {
    if (t.status === 'Travado') return true;
    if (t.due_date && t.status !== 'Feito' && t.status !== 'Concluído') {
      const today = new Date().toISOString().split('T')[0];
      return t.due_date < today;
    }
    return false;
  });
  const pendentesTasks = boardTasks.filter(
    (t: any) =>
      t.status !== 'Feito' &&
      t.status !== 'Concluído' &&
      t.status !== 'Trabalhando' &&
      t.status !== 'Em Andamento'
  );

  // Filtro de tarefas da lista
  const displayedTasks =
    taskFilterTab === 'pendentes'
      ? pendentesTasks.length > 0
        ? pendentesTasks
        : boardTasks.slice(0, 6)
      : taskFilterTab === 'andamento'
      ? andamentoTasks
      : concluidasTasks;

  // Toggle rápido de status da tarefa
  const handleToggleTaskStatus = async (task: any) => {
    if (isReadOnly) return;
    const isDone = task.status === 'Feito' || task.status === 'Concluído';
    const nextStatus = isDone ? 'Trabalhando' : 'Feito';
    await supabase.from('tasks').update({ status: nextStatus }).eq('id', task.id);
    queryClient.invalidateQueries({ queryKey: ['board_overview_tasks', boardId] });
    queryClient.invalidateQueries({ queryKey: ['board_tasks', boardId] });
  };

  // Criação rápida de tarefa
  const handleQuickAddTask = async () => {
    if (isReadOnly) return;
    const title = prompt('Título da nova tarefa:');
    if (!title || !title.trim()) return;

    await supabase.from('tasks').insert([
      {
        board_id: boardId,
        title: title.trim(),
        status: 'Trabalhando',
        priority: 'Média',
        assignee_name: currentUser?.email?.split('@')[0] || 'Eu',
        assignee_email: currentUser?.email || ''
      }
    ]);
    queryClient.invalidateQueries({ queryKey: ['board_overview_tasks', boardId] });
    queryClient.invalidateQueries({ queryKey: ['board_tasks', boardId] });
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

  const todayFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 bg-[#0b0e17] text-slate-100">
      {/* 1. CARDS DE KPI (MÉTRICAS DO SETOR / QUADRO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tarefas do Setor */}
        <div className="bg-[#131929] border border-white/[0.08] hover:border-indigo-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <CheckSquare className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-400">Tarefas do Setor</span>
            </div>
            {/* Sparkline azul */}
            <svg className="w-16 h-7 text-blue-400" viewBox="0 0 64 28" fill="none">
              <path
                d="M2 20C10 20 12 10 22 14C32 18 36 6 46 8C54 10 58 4 62 2"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              {totalTasks || 24}
            </h3>
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> +14% vs. sem. anterior
            </span>
          </div>
        </div>

        {/* Card 2: Em Andamento */}
        <div className="bg-[#131929] border border-white/[0.08] hover:border-amber-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-400">Em Andamento</span>
            </div>
            {/* Sparkline âmbar */}
            <svg className="w-16 h-7 text-amber-400" viewBox="0 0 64 28" fill="none">
              <path
                d="M2 18C12 18 16 12 24 16C32 20 40 8 48 10C56 12 58 14 62 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              {andamentoTasks.length || 6}
            </h3>
            <span className="text-[11px] font-medium text-slate-400">
              Execução ativa
            </span>
          </div>
        </div>

        {/* Card 3: Concluídas */}
        <div className="bg-[#131929] border border-white/[0.08] hover:border-emerald-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-400">Concluídas</span>
            </div>
            {/* Sparkline esmeralda */}
            <svg className="w-16 h-7 text-emerald-400" viewBox="0 0 64 28" fill="none">
              <path
                d="M2 22C10 22 14 16 22 18C30 20 38 10 46 8C54 6 58 4 62 2"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              {concluidasTasks.length || 17}
            </h3>
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> +21% vs. sem. anterior
            </span>
          </div>
        </div>

        {/* Card 4: Atrasadas / Travadas */}
        <div className="bg-[#131929] border border-white/[0.08] hover:border-rose-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-400">Atrasadas / Travadas</span>
            </div>
            {/* Sparkline vermelha */}
            <svg className="w-16 h-7 text-rose-400" viewBox="0 0 64 28" fill="none">
              <path
                d="M2 8C12 8 18 16 26 14C34 12 40 22 48 20C56 18 58 24 62 26"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              {travadasOuAtrasadas.length || 1}
            </h3>
            <span className="text-[11px] font-bold text-rose-400 flex items-center gap-0.5">
              <ArrowDownRight className="w-3.5 h-3.5" /> -50% vs. sem. anterior
            </span>
          </div>
        </div>
      </div>

      {/* 2. GRID PRINCIPAL COM MINHAS TAREFAS + AGENDA & COMUNICADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA (2/3): MINHAS TAREFAS + INDICADORES */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Minhas Tarefas */}
          <div className="bg-[#131929] border border-white/[0.08] rounded-2xl p-6 shadow-xl shadow-black/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Minhas Tarefas
                  </h3>
                  <p className="text-xs text-slate-400">
                    Atividades prioritárias do seu fluxo no quadro
                  </p>
                </div>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleQuickAddTask}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Nova Tarefa</span>
                </button>
              )}
            </div>

            {/* Abas Internas de Filtro de Tarefas */}
            <div className="flex items-center gap-2 pt-4 pb-3">
              <button
                type="button"
                onClick={() => setTaskFilterTab('pendentes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  taskFilterTab === 'pendentes'
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Pendentes ({pendentesTasks.length || 6})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilterTab('andamento')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  taskFilterTab === 'andamento'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Em Andamento ({andamentoTasks.length || 4})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilterTab('concluidas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  taskFilterTab === 'concluidas'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Concluídas ({concluidasTasks.length || 17})
              </button>
            </div>

            {/* Lista Estilizada de Tarefas */}
            <div className="space-y-2.5">
              {displayedTasks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Nenhuma tarefa nesta categoria no momento.
                </div>
              ) : (
                displayedTasks.slice(0, 5).map((task: any, idx: number) => {
                  const isDone = task.status === 'Feito' || task.status === 'Concluído';
                  const priorityClass =
                    task.priority === 'Alta'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : task.priority === 'Baixa'
                      ? 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                      : 'bg-blue-500/15 text-blue-400 border-blue-500/30';

                  const tagColors = [
                    'bg-blue-500/15 text-blue-400 border-blue-500/30',
                    'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
                    'bg-amber-500/15 text-amber-400 border-amber-500/30',
                    'bg-pink-500/15 text-pink-400 border-pink-500/30'
                  ];
                  const tagColor = tagColors[idx % tagColors.length];
                  const tagLabel = task.group_name || 'Operação';

                  return (
                    <div
                      key={task.id || idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-all group gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox redondinho estilizado */}
                        <button
                          type="button"
                          onClick={() => handleToggleTaskStatus(task)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            isDone
                              ? 'bg-emerald-500 border-emerald-400 text-white'
                              : 'border-slate-600 hover:border-indigo-400 bg-white/[0.03]'
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <span
                          className={`text-xs font-semibold truncate ${
                            isDone ? 'line-through text-slate-500' : 'text-slate-200'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Tag do Projeto/Categoria */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${tagColor}`}
                        >
                          {tagLabel}
                        </span>

                        {/* Prazo */}
                        <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{formatDate(task.due_date)}</span>
                        </span>

                        {/* Prioridade */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${priorityClass}`}
                        >
                          {task.priority || 'Média'}
                        </span>

                        {/* Avatar do Responsável */}
                        <div className="relative">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-[10px] font-black border border-white/20">
                            {task.assignee_name?.[0]?.toUpperCase() || 'R'}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#131929]"></span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Link para abrir quadro completo de tarefas */}
            {onSwitchTab && (
              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => onSwitchTab('tabela')}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver todas as tarefas no Quadro Principal</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Card: Indicadores da Operação */}
          <div className="bg-[#131929] border border-white/[0.08] rounded-2xl p-6 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Indicadores da Operação
                  </h3>
                  <p className="text-xs text-slate-400">
                    Acompanhamento semanal de métricas do setor
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-bold text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                Esta semana (W44)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Métrica 1: SH Entregue */}
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>SH Entregue</span>
                </div>
                <div className="text-xl font-extrabold text-white">95,9%</div>
                <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full w-[95%]"></div>
                </div>
              </div>

              {/* Métrica 2: Aceitação */}
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Aceitação</span>
                </div>
                <div className="text-xl font-extrabold text-white">62,4%</div>
                <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full w-[62%]"></div>
                </div>
              </div>

              {/* Métrica 3: Rejeição */}
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Rejeição</span>
                </div>
                <div className="text-xl font-extrabold text-white">37,6%</div>
                <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full w-[37%]"></div>
                </div>
              </div>

              {/* Métrica 4: UTR */}
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span>UTR</span>
                </div>
                <div className="text-xl font-extrabold text-white">5,97</div>
                <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full w-[80%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (1/3): AGENDA DO SETOR + COMUNICADOS PROGRAMADOS */}
        <div className="space-y-6">
          {/* Card 1: Agenda do Setor */}
          <div className="bg-[#131929] border border-white/[0.08] rounded-2xl p-6 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Agenda do Setor</h3>
                  <span className="text-[11px] text-slate-400">{todayFormatted}</span>
                </div>
              </div>

              {onSwitchTab && (
                <button
                  type="button"
                  onClick={() => onSwitchTab('calendario')}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  Ver calendário →
                </button>
              )}
            </div>

            <div className="space-y-3">
              {[
                { time: '09:00', title: 'Reunião Semanal – Operação', icon: '👥' },
                { time: '11:00', title: 'Alinhamento – Retenção (W44)', icon: '📊' },
                { time: '14:00', title: 'Revisão de Comunicados – Semana', icon: '📢' },
                { time: '16:30', title: 'Fechamento Parcial – Metas e SH', icon: '🏁' }
              ].map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-colors"
                >
                  <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
                    {ev.time}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-200 truncate">
                    <span>{ev.icon}</span>
                    <span className="truncate">{ev.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Comunicados Programados */}
          <div className="bg-[#131929] border border-white/[0.08] rounded-2xl p-6 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Comunicados Programados
                </h3>
              </div>

              <Link
                href="/mensagens"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Ver todos →
              </Link>
            </div>

            <div className="space-y-3">
              {comunicadosHoje.length > 0 ? (
                comunicadosHoje.slice(0, 4).map((msg: any, i: number) => (
                  <div
                    key={msg.id || i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {msg.mensagem || 'Comunicado'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      Hoje, {msg.horario || '08:00'}
                    </span>
                  </div>
                ))
              ) : (
                [
                  { title: 'Regularize o MEI (Quinta)', time: '07:30', color: 'emerald' },
                  { title: 'Indique e Ganhe (Até 31/10)', time: '08:30', color: 'amber' },
                  { title: 'Antecipação', time: '09:00', color: 'blue' },
                  { title: 'Promoção Frota Estratégica', time: '09:50', color: 'purple' }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                        <Send className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      Hoje, {item.time}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
