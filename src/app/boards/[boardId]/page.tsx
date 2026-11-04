'use client';

import { useState, use, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { BoardTableView } from '@/components/board/BoardTableView';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { canUserAccessBoard, isBoardOwnedByUser } from '@/lib/privacy';
import {
  Sparkles,
  Table2,
  Columns3,
  CalendarDays,
  ListChecks,
  Users,
  Grid3x3,
  Search,
  Lock,
  Globe2,
  Bell,
  HelpCircle
} from 'lucide-react';

const TabLoadingSkeleton = () => (
  <div className="flex h-full w-full items-center justify-center bg-[#0b0e17] p-8">
    <div className="flex flex-col items-center">
      <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
      <p className="text-slate-400 text-xs font-medium">Carregando visualização...</p>
    </div>
  </div>
);

const SectorOverviewDashboard = dynamic(
  () => import('@/components/board/SectorOverviewDashboard').then(m => m.SectorOverviewDashboard),
  { loading: () => <TabLoadingSkeleton /> }
);
const BoardKanbanView = dynamic(
  () => import('@/components/board/BoardKanbanView').then(m => m.BoardKanbanView),
  { loading: () => <TabLoadingSkeleton /> }
);
const BoardCalendarView = dynamic(
  () => import('@/components/board/BoardCalendarView').then(m => m.BoardCalendarView),
  { loading: () => <TabLoadingSkeleton /> }
);
const BoardRoutineView = dynamic(
  () => import('@/components/board/BoardRoutineView').then(m => m.BoardRoutineView),
  { loading: () => <TabLoadingSkeleton /> }
);
const BoardShiftView = dynamic(
  () => import('@/components/board/BoardShiftView').then(m => m.BoardShiftView),
  { loading: () => <TabLoadingSkeleton /> }
);
const BoardMonthlyRosterView = dynamic(
  () => import('@/components/board/BoardMonthlyRosterView').then(m => m.BoardMonthlyRosterView),
  { loading: () => <TabLoadingSkeleton /> }
);

type TabType = 'visao_geral' | 'tabela' | 'kanban' | 'calendario' | 'rotina' | 'escala' | 'turnos';

export default function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'visao-geral' || tabParam === 'visao_geral') return 'visao_geral';
      if (tabParam === 'turnos' || tabParam === 'minha-escala') return 'turnos';
      if (tabParam === 'escala') return 'escala';
      if (tabParam === 'rotina') return 'rotina';
      if (tabParam === 'calendario') return 'calendario';
      if (tabParam === 'kanban') return 'kanban';
    }
    return 'visao_geral';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      if (tabParam === 'visao-geral' || tabParam === 'visao_geral') {
        setActiveTab('visao_geral');
      } else if (tabParam === 'turnos' || tabParam === 'minha-escala') {
        setActiveTab('turnos');
      } else if (tabParam === 'escala') {
        setActiveTab('escala');
      } else if (tabParam === 'rotina') {
        setActiveTab('rotina');
      } else if (tabParam === 'calendario') {
        setActiveTab('calendario');
      } else if (tabParam === 'kanban') {
        setActiveTab('kanban');
      }
    }
  }, []);

  const { data: accessCheck, isLoading } = useQuery({
    queryKey: ['board_access_check', boardId],
    queryFn: async () => {
      const user = await getFastUser();
      if (!user) return { allowed: false, reason: 'unauthenticated', userRole: 'user' };

      const [boardRes, profiles, workspacesRes] = await Promise.all([
        supabase.from('boards').select('id, name, workspace_id, created_by').eq('id', boardId).single(),
        queryClient.fetchQuery({
          queryKey: ['all_profiles'],
          queryFn: async () => {
            const { data } = await supabase.from('profiles').select('id, email, avatar_url, role, receive_emails').order('email');
            return data || [];
          },
          staleTime: 5 * 60 * 1000
        }),
        queryClient.fetchQuery({
          queryKey: ['all_workspaces_meta'],
          queryFn: async () => {
            const { data } = await supabase.from('workspaces').select('*').order('created_at');
            return data || [];
          },
          staleTime: 5 * 60 * 1000
        })
      ]);

      const board = boardRes.data;
      if (!board) return { allowed: false, reason: 'not_found', userRole: 'user' };

      queryClient.setQueryData(['board_info', boardId], { name: board.name, workspace_id: board.workspace_id });
      queryClient.setQueryData(['board_workspace_roster', boardId], { workspace_id: board.workspace_id, name: board.name });
      queryClient.setQueryData(['board_workspace_shift', boardId], { workspace_id: board.workspace_id, name: board.name });

      const workspace = (workspacesRes || []).find((w: any) => w.id === board.workspace_id);
      const visibilityMode = workspace?.visibility_mode || 'own_only';
      const profile = (profiles || []).find((p: any) => p.id === user.id || p.email === user.email);
      const userRole = profile?.role || 'user';

      let visibleTabs: string[] = ['visao_geral', 'tabela', 'kanban', 'calendario', 'rotina', 'escala', 'turnos'];
      if (workspace?.visible_tabs) {
        if (Array.isArray(workspace.visible_tabs) && workspace.visible_tabs.length > 0) {
          visibleTabs = ['visao_geral', ...workspace.visible_tabs.filter((t: string) => t !== 'visao_geral')];
        } else if (typeof workspace.visible_tabs === 'string') {
          try {
            const parsed = JSON.parse(workspace.visible_tabs);
            if (Array.isArray(parsed) && parsed.length > 0) {
              visibleTabs = ['visao_geral', ...parsed.filter((t: string) => t !== 'visao_geral')];
            }
          } catch {}
        }
      }

      const allowed = canUserAccessBoard({
        board: { name: board.name, created_by: board.created_by },
        user: { id: user.id, email: user.email || '' },
        userRole,
        visibilityMode,
        profiles
      });

      if (allowed) {
        const isOwnBoard = isBoardOwnedByUser(
          { name: board.name, created_by: board.created_by },
          { id: user.id, email: user.email || '' }
        );
        const canEdit = userRole === 'admin' || userRole === 'leader' || isOwnBoard;

        return { allowed: true, canEdit, board, workspace, userRole, visibleTabs, redirectBoardId: null };
      }

      const { data: sectorBoards } = await supabase
        .from('boards')
        .select('id, name, created_by, workspace_id');

      const candidates = [
        ...(sectorBoards || []).filter(b => b.workspace_id === board.workspace_id),
        ...(sectorBoards || []).filter(b => b.workspace_id !== board.workspace_id)
      ];

      const ownBoard = candidates.find(b =>
        isBoardOwnedByUser(
          { name: b.name, created_by: b.created_by },
          { id: user.id, email: user.email || '' }
        )
      );

      return {
        allowed: false,
        canEdit: false,
        reason: 'private_board',
        board,
        workspace,
        userRole,
        redirectBoardId: ownBoard?.id || null
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  });

  useEffect(() => {
    if (accessCheck?.allowed === false) {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      if (accessCheck.redirectBoardId && accessCheck.redirectBoardId !== boardId) {
        router.replace(`/boards/${accessCheck.redirectBoardId}${search}`);
      } else {
        const timer = setTimeout(() => router.replace('/'), 1800);
        return () => clearTimeout(timer);
      }
    }
  }, [accessCheck, boardId, router]);

  const boardName = accessCheck?.board?.name || 'Operação';
  const workspaceName = accessCheck?.workspace?.name || 'Workspace Operacional';
  const isReadOnly = accessCheck?.canEdit === false;
  const visibleTabs: string[] = accessCheck?.visibleTabs || ['visao_geral', 'tabela', 'kanban', 'calendario', 'rotina', 'escala', 'turnos'];

  if (isLoading || (accessCheck?.allowed === false && accessCheck?.redirectBoardId && accessCheck.redirectBoardId !== boardId)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0b0e17]">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
          <p className="text-slate-400 text-sm font-medium">Abrindo seu quadro...</p>
        </div>
      </div>
    );
  }

  if (accessCheck?.allowed === false) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0b0e17] p-6">
        <div className="p-8 bg-[#131929] rounded-2xl shadow-2xl border border-white/[0.08] max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito ao Setor</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Você não possui permissão para visualizar este quadro conforme a política de privacidade configurada no seu setor. Redirecionando...
          </p>
          <button 
            onClick={() => router.push('/')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-colors shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            Ir para Meu Setor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0e17] overflow-hidden">
      {/* Banner de Modo de Leitura */}
      {isReadOnly && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-2 flex items-center justify-between text-xs font-semibold text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <span>👁️</span>
            <span><strong>Modo de Leitura:</strong> Visualizando o quadro de um colega. Alterações restritas a líderes e ao proprietário.</span>
          </div>
          <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider text-amber-300">
            Apenas Leitura
          </span>
        </div>
      )}

      {/* HEADER MODERNO DO SETOR / QUADRO (CLICKUP/MONDAY STYLE) */}
      <div className="flex flex-col border-b border-white/[0.06] px-6 md:px-8 pt-6 pb-0 gap-5 bg-[#0e1322] z-20 shrink-0 relative overflow-hidden">
        {/* Glow sutil no topo direito */}
        <div className="absolute top-0 right-1/4 w-96 h-28 bg-gradient-to-r from-purple-600/10 via-indigo-600/10 to-transparent blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Esquerda: Ícone Gradiente + Título + Badge de Privacidade + Subtítulo */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-purple-600/25 shrink-0">
              <Sparkles className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight truncate">
                  {boardName}
                </h1>

                {/* Badge de Privacidade */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/[0.06] text-slate-300 border border-white/[0.1] shrink-0">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Acesso restrito ao setor</span>
                </span>

                {isReadOnly && (
                  <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-slate-700 shrink-0">
                    Apenas Leitura
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 font-medium mt-1 truncate">
                Gestão de tarefas, comunicação, escalas e rotinas operacionais
              </p>
            </div>
          </div>

          {/* Direita: Campo de Busca Integrado (Ctrl + K) + Ações */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Barra de Pesquisa Integrada */}
            <div
              onClick={() => {
                const term = prompt('Pesquisar no setor:');
                if (term) router.push(`/?search=${encodeURIComponent(term)}`);
              }}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-400 hover:text-white transition-all cursor-pointer shadow-sm text-xs font-medium"
            >
              <Search className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Buscar no setor {boardName}...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white/[0.06] border border-white/[0.1] rounded text-slate-400">
                Ctrl + K
              </kbd>
            </div>

            {/* Indicador de Tempo Real */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500"></span>
              </span>
              Tempo Real
            </span>
          </div>
        </div>

        {/* ABAS MODERNAS (CLICKUP/MONDAY PILL & UNDERLINE STYLE) */}
        <div className="flex gap-1 overflow-x-auto -mb-px scrollbar-none pt-2">
          {([
            { id: 'visao_geral', label: 'Visão Geral', icon: Sparkles },
            { id: 'tabela', label: 'Quadro de Tarefas', icon: Table2 },
            { id: 'kanban', label: 'Kanban', icon: Columns3 },
            { id: 'calendario', label: 'Calendário', icon: CalendarDays },
            { id: 'rotina', label: 'Rotinas', icon: ListChecks },
            {
              id: 'escala',
              label: accessCheck?.userRole === 'admin' || accessCheck?.userRole === 'leader' ? 'Escala' : 'Minha Escala',
              icon: Users
            },
            { id: 'turnos', label: 'Quadro de turnos', icon: Grid3x3 }
          ] as { id: TabType; label: string; icon: typeof Table2 }[])
            .filter(tab => visibleTabs.includes(tab.id))
            .map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative px-4 pt-2.5 pb-3 text-xs whitespace-nowrap flex items-center gap-2 cursor-pointer transition-all border-b-2 ${
                    isActive
                      ? 'border-indigo-500 text-white font-bold bg-indigo-500/10 rounded-t-xl'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02] font-semibold'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 transition-colors ${
                      isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* RENDERIZAÇÃO CONDICIONAL DO CONTEÚDO */}
      <div className="flex-1 overflow-auto bg-[#0b0e17]">
        {activeTab === 'visao_geral' ? (
          <SectorOverviewDashboard
            boardId={boardId}
            boardName={boardName}
            isReadOnly={isReadOnly}
            onSwitchTab={(tab) => setActiveTab(tab as TabType)}
          />
        ) : activeTab === 'tabela' ? (
          <BoardTableView boardId={boardId} isReadOnly={isReadOnly} />
        ) : activeTab === 'kanban' ? (
          <BoardKanbanView boardId={boardId} isReadOnly={isReadOnly} />
        ) : activeTab === 'rotina' ? (
          <BoardRoutineView boardId={boardId} isReadOnly={isReadOnly} />
        ) : activeTab === 'escala' ? (
          <BoardShiftView 
            boardId={boardId} 
            isReadOnly={isReadOnly} 
            onSwitchToTurnos={() => setActiveTab('turnos')} 
          />
        ) : activeTab === 'turnos' ? (
          <BoardMonthlyRosterView boardId={boardId} isReadOnly={isReadOnly} />
        ) : (
          <BoardCalendarView boardId={boardId} isReadOnly={isReadOnly} />
        )}
      </div>
    </div>
  );
}
