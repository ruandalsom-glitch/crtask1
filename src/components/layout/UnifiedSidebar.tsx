'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import {
  Home,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  MessageSquare,
  ListChecks,
  Users,
  CalendarDays,
  BarChart2,
  Plus,
  Check,
  Building2,
  MoreVertical,
  Monitor,
  Download,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { canUserAccessBoard } from '@/lib/privacy';
import { useIsDesktopApp } from '@/lib/useIsDesktopApp';
import { NotificationBell } from './NotificationBell';

interface UnifiedSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function UnifiedSidebar({ isCollapsed, onToggleCollapse }: UnifiedSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isDesktopApp = useIsDesktopApp();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Usuário atual
  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  // Perfis
  const { data: allProfiles } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, email, avatar_url, role, receive_emails').order('email');
      return data || [];
    },
    enabled: !!userProfile?.id,
    staleTime: 5 * 60 * 1000
  });

  const currentProfile = allProfiles?.find((p: any) => p.id === userProfile?.id || p.email === userProfile?.email);
  const userRole = currentProfile?.role || 'user';
  const isAdminOrLeader = userRole === 'admin' || userRole === 'leader';
  const userName = currentProfile?.email?.split('@')[0] || 'Usuário';

  // Workspaces / Setores
  const { data: workspaces } = useQuery({
    queryKey: ['sidebar_workspaces', userProfile?.id, userRole],
    queryFn: async () => {
      if (!userProfile?.id) return [];
      if (userRole === 'admin') {
        const { data } = await supabase.from('workspaces').select('*').order('created_at');
        return data || [];
      } else {
        const { data } = await supabase.from('workspace_members').select('workspaces(*)').eq('user_id', userProfile.id);
        return data?.map((d: any) => d.workspaces).filter(Boolean) || [];
      }
    },
    enabled: !!userProfile?.id && !!allProfiles,
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (workspaces && workspaces.length > 0 && userProfile?.id) {
      const storageKey = `monday_active_workspace_${userProfile.id}`;
      const savedId = localStorage.getItem(storageKey);
      if (savedId && workspaces.find(w => w.id === savedId)) {
        setActiveWorkspaceId(savedId);
      } else {
        setActiveWorkspaceId(workspaces[0].id);
        localStorage.setItem(storageKey, workspaces[0].id);
        localStorage.setItem('monday_active_workspace', workspaces[0].id);
      }
    }
  }, [workspaces, userProfile?.id]);

  // Quadros do setor
  const { data: boards = [] } = useQuery({
    queryKey: ['sidebar_boards', activeWorkspaceId, userProfile?.id, userRole],
    queryFn: async () => {
      if (!activeWorkspaceId || !userProfile?.id) return [];
      const activeWsObj = workspaces?.find((w: any) => w.id === activeWorkspaceId);
      const [boardsRes, workspaceRes] = await Promise.all([
        supabase.from('boards').select('id, name, workspace_id, created_by').eq('workspace_id', activeWorkspaceId).order('created_at'),
        activeWsObj?.visibility_mode
          ? Promise.resolve({ data: { visibility_mode: activeWsObj.visibility_mode } })
          : supabase.from('workspaces').select('visibility_mode').eq('id', activeWorkspaceId).maybeSingle()
      ]);

      if (boardsRes.error) throw boardsRes.error;
      const data = boardsRes.data || [];
      const visibilityMode = workspaceRes.data?.visibility_mode || 'own_only';
      const profiles = allProfiles || [];

      if (userRole === 'admin' || userRole === 'leader') return data;

      return data.filter((board: any) =>
        canUserAccessBoard({
          board: { name: board.name, created_by: board.created_by },
          user: { id: userProfile.id, email: userProfile.email || '' },
          userRole,
          visibilityMode,
          profiles
        })
      );
    },
    enabled: !!activeWorkspaceId && !!userProfile?.id && !!allProfiles,
    staleTime: 5 * 60 * 1000
  });

  // Quantidade de tarefas reais pendentes (excluindo rotinas automáticas de lote e lembretes de calendário)
  const { data: pendingTasksCount = 0 } = useQuery({
    queryKey: ['sidebar_pending_tasks_count_clean', userProfile?.email],
    queryFn: async () => {
      if (!userProfile?.email) return 0;
      const { count } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .ilike('assignee_email', `%${userProfile.email}%`)
        .not('status', 'in', '("Feito","Concluído")')
        .neq('task_type', 'Lembrete')
        .neq('task_type', 'Rotina')
        .neq('is_routine', true);
      return count || 0;
    },
    enabled: !!userProfile?.email,
    staleTime: 60 * 1000
  });

  // Sincronização do tema Claro / Escuro
  useEffect(() => {
    const syncTheme = () => {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
      setIsDarkMode(shouldBeDark);
    };
    syncTheme();
    window.addEventListener('crtask_theme_change', syncTheme);
    return () => window.removeEventListener('crtask_theme_change', syncTheme);
  }, []);

  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    window.dispatchEvent(new Event('crtask_theme_change'));
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeWorkspaceName = workspaces?.find(w => w.id === activeWorkspaceId)?.name || 'Operação';
  const isOperacional = Boolean(
    userRole === 'admin' ||
    workspaces?.some((w: any) => {
      const norm = (w.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return norm.includes('operac');
    })
  );

  const handleCreateBoard = async () => {
    const name = prompt('Nome do novo quadro:');
    if (name && activeWorkspaceId) {
      const { data: { user } } = await supabase.auth.getUser();
      let insertResult = await supabase
        .from('boards')
        .insert([{ name, workspace_id: activeWorkspaceId, created_by: user?.id }])
        .select();

      if (insertResult.error && insertResult.error.message?.includes('created_by')) {
        insertResult = await supabase
          .from('boards')
          .insert([{ name, workspace_id: activeWorkspaceId }])
          .select();
      }

      if (!insertResult.error && insertResult.data && insertResult.data.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['sidebar_boards', activeWorkspaceId] });
        router.push(`/boards/${insertResult.data[0].id}`);
      } else if (insertResult.error) {
        alert('Erro ao criar quadro: ' + insertResult.error.message);
      }
    }
  };

  const primaryBoardId = boards[0]?.id;

  return (
    <aside
      className={`h-screen flex flex-col shrink-0 z-40 transition-all duration-300 ease-in-out select-none bg-slate-50 dark:bg-[#0e121e] border-r border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 ${
        isCollapsed ? 'w-[68px]' : 'w-[256px]'
      }`}
    >
      {/* 1. TOPO DA SIDEBAR: LOGO + NOME DO APP + BOTÃO DE RECOLHER */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] shrink-0 bg-white dark:bg-[#0e121e]">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-0.5 shadow-md shadow-blue-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-white dark:bg-[#0e121e] rounded-[10px] flex items-center justify-center p-1">
              <img src="/logo.png" alt="CR Task" className="w-full h-full object-contain" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white leading-tight">
                CR Task
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide truncate">
                Workspace Operacional
              </span>
            </div>
          )}
        </Link>

        {/* Botão de Recolher « / Expandir » */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. CORPO ROLÁVEL DA SIDEBAR */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {/* SEÇÃO 1: NAVEGAÇÃO RÁPIDA PRINCIPAL */}
        <div className="space-y-1">
          {/* Início */}
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer ${
              pathname === '/'
                ? 'bg-blue-600 dark:bg-indigo-600 text-white font-bold shadow-md shadow-blue-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.04]'
            }`}
            title="Início"
          >
            <Home className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="text-xs truncate">Início</span>}
          </Link>

          {/* Minhas Tarefas com Badge Limpo de Tarefas Pessoais */}
          <Link
            href="/my-work"
            className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
              pathname === '/my-work'
                ? 'bg-blue-600 dark:bg-indigo-600 text-white font-bold shadow-md shadow-blue-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.04]'
            }`}
            title="Minhas Tarefas"
          >
            <div className="flex items-center gap-3 min-w-0">
              <CheckSquare className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="text-xs truncate">Minhas Tarefas</span>}
            </div>
            {!isCollapsed && pendingTasksCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400 border border-pink-200 dark:border-pink-500/30">
                {pendingTasksCount}
              </span>
            )}
          </Link>

          {/* Notificações */}
          <div className="w-full">
            {!isCollapsed ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.04] transition-all">
                <div className="flex items-center gap-3">
                  <NotificationBell />
                  <span className="text-xs">Notificações</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-1">
                <NotificationBell />
              </div>
            )}
          </div>
        </div>

        {/* SEÇÃO 2: "MEU SETOR" COM ÁRVORE DE MÓDULOS */}
        <div className="space-y-2">
          {!isCollapsed && (
            <div className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Meu Setor
            </div>
          )}

          {/* Card Seletor de Setor */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSectorDropdownOpen(!isSectorDropdownOpen)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.06] transition-all cursor-pointer group shadow-2xs"
              title={activeWorkspaceName}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                      {activeWorkspaceName}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">Setor Ativo</span>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-transform ${
                    isSectorDropdownOpen ? 'rotate-180 text-blue-600 dark:text-indigo-400' : ''
                  }`}
                />
              )}
            </button>

            {/* Dropdown de Setores */}
            {isSectorDropdownOpen && !isCollapsed && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#141a2b] border border-slate-200 dark:border-white/[0.1] shadow-2xl rounded-xl z-50 py-1.5 max-h-56 overflow-y-auto">
                <div className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/[0.06] mb-1">
                  Alternar Setor
                </div>
                {workspaces?.map((w: any) => {
                  const isSelected = w.id === activeWorkspaceId;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        if (w.id !== activeWorkspaceId && userProfile?.id) {
                          setActiveWorkspaceId(w.id);
                          localStorage.setItem(`monday_active_workspace_${userProfile.id}`, w.id);
                          localStorage.setItem('monday_active_workspace', w.id);
                          setIsSectorDropdownOpen(false);
                          router.push('/');
                        } else {
                          setIsSectorDropdownOpen(false);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-indigo-600/30 text-blue-700 dark:text-indigo-300 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="truncate">{w.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-indigo-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Árvore de Módulos do Setor */}
          {!isCollapsed && (
            <div className="pl-3 border-l border-slate-200 dark:border-white/[0.06] ml-4 space-y-1 pt-1">
              {/* Quadro de Tarefas */}
              {primaryBoardId && (
                <Link
                  href={`/boards/${primaryBoardId}`}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    pathname.startsWith('/boards') &&
                    (typeof window === 'undefined' ||
                      !new URLSearchParams(window.location.search).get('tab') ||
                      new URLSearchParams(window.location.search).get('tab') === 'tabela')
                      ? 'text-blue-700 dark:text-indigo-300 font-bold bg-blue-50/80 dark:bg-indigo-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Quadro de Tarefas</span>
                </Link>
              )}

              {/* Envio de Mensagens */}
              {isOperacional && (
                <Link
                  href="/mensagens"
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    pathname === '/mensagens'
                      ? 'text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate">Envio de Mensagens</span>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </Link>
              )}

              {/* Rotinas Diárias */}
              {primaryBoardId && (
                <Link
                  href={`/boards/${primaryBoardId}?tab=rotina`}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    pathname.startsWith('/boards') &&
                    typeof window !== 'undefined' &&
                    new URLSearchParams(window.location.search).get('tab') === 'rotina'
                      ? 'text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <ListChecks className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Rotinas Diárias</span>
                </Link>
              )}

              {/* Escalas e Turnos */}
              {primaryBoardId && (
                <Link
                  href={`/boards/${primaryBoardId}?tab=turnos`}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    pathname.startsWith('/boards') &&
                    typeof window !== 'undefined' &&
                    (new URLSearchParams(window.location.search).get('tab') === 'turnos' ||
                      new URLSearchParams(window.location.search).get('tab') === 'escala')
                      ? 'text-violet-700 dark:text-violet-300 font-bold bg-violet-50 dark:bg-violet-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span>Escalas e Turnos</span>
                </Link>
              )}

              {/* Calendário do Setor */}
              {primaryBoardId && (
                <Link
                  href={`/boards/${primaryBoardId}?tab=calendario`}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    pathname.startsWith('/boards') &&
                    typeof window !== 'undefined' &&
                    new URLSearchParams(window.location.search).get('tab') === 'calendario'
                      ? 'text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Calendário do Setor</span>
                </Link>
              )}

              {/* Relatórios / Gestão */}
              {isAdminOrLeader && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    pathname.startsWith('/admin')
                      ? 'text-purple-700 dark:text-purple-300 font-bold bg-purple-50 dark:bg-purple-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Relatórios & Gestão</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* SEÇÃO 3: "MEUS QUADROS" */}
        {!isCollapsed && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Meus Quadros ({boards.length})
              </span>
              <button
                type="button"
                onClick={handleCreateBoard}
                className="p-1 rounded-md bg-blue-50 dark:bg-indigo-600/30 hover:bg-blue-600 dark:hover:bg-indigo-600 text-blue-600 dark:text-indigo-300 hover:text-white transition-all cursor-pointer"
                title="Criar Novo Quadro"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
              </button>
            </div>

            <div className="space-y-0.5">
              {boards.map((b: any) => {
                const isActive = pathname === `/boards/${b.id}`;
                return (
                  <div key={b.id} className="group relative flex items-center">
                    <Link
                      href={`/boards/${b.id}`}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                        isActive
                          ? 'bg-blue-50 dark:bg-white/[0.08] text-blue-700 dark:text-white font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate pr-5">{b.name}</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SEÇÃO 4: BOTÃO APP DESKTOP (SÓ SE NÃO ESTIVER NO DESKTOP) */}
        {!isDesktopApp && !isCollapsed && (
          <div className="pt-2">
            <a
              href="/CR-Task-Desktop.exe"
              download="CR-Task-Desktop.exe"
              className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-gradient-to-r dark:from-[#141a2c] dark:to-[#1c243c] border border-slate-200 dark:border-white/[0.08] hover:border-emerald-500/40 text-slate-800 dark:text-white shadow-xs transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Monitor className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold truncate">App Desktop (PC)</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Bandeja ^ + Auto-WhatsApp</span>
              </div>
              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 ml-auto shrink-0 transition-colors" />
            </a>
          </div>
        )}
      </div>

      {/* 3. RODAPÉ DA SIDEBAR: PERFIL DO USUÁRIO COM MENU COMPLETO */}
      <div className="p-3 border-t border-slate-200 dark:border-white/[0.06] shrink-0 relative bg-white dark:bg-[#0e121e]" ref={userMenuRef}>
        <div
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                {currentProfile?.avatar_url ? (
                  <img
                    src={currentProfile.avatar_url}
                    alt={userName}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  userName[0]?.toUpperCase() || 'R'
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0e121e]"></span>
            </div>

            {!isCollapsed && (
              <div className="flex flex-col text-left overflow-hidden">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{userName}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {userRole === 'admin' ? 'Administrador' : activeWorkspaceName}
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && <MoreVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white" />}
        </div>

        {/* Menu Popover do Usuário */}
        {isUserMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-[#141a2b] border border-slate-200 dark:border-white/[0.1] shadow-2xl rounded-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-white/[0.06]">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentProfile?.email}</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                Função: {userRole}
              </p>
            </div>

            {/* Alternador de Tema Escuro / Claro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Alternar p/ Tema Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-blue-600" />
                  <span>Alternar p/ Tema Escuro</span>
                </>
              )}
            </button>

            {/* Botão de Logout */}
            <button
              type="button"
              onClick={async () => {
                localStorage.clear();
                sessionStorage.clear();
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da Conta</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
