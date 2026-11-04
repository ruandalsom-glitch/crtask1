'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import {
  LayoutTemplate,
  Grid,
  ChevronLeft,
  ChevronDown,
  CheckSquare,
  ShieldCheck,
  MessageSquare,
  Monitor,
  Building2,
  Plus,
  Trash2,
  Check,
  Download
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { canUserAccessBoard } from '@/lib/privacy';
import { useIsDesktopApp } from '@/lib/useIsDesktopApp';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isDesktopApp = useIsDesktopApp();

  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, email, avatar_url, role, receive_emails').order('email');
      return data || [];
    },
    enabled: !!userProfile?.id,
    staleTime: 5 * 60 * 1000
  });

  const userRole = allProfiles?.find((p: any) => p.id === userProfile?.id || p.email === userProfile?.email)?.role || 'user';

  const { data: workspaces } = useQuery({
    queryKey: ['sidebar_workspaces', userProfile?.id, userRole],
    queryFn: async () => {
      if (!userProfile?.id) return [];

      if (userRole === 'admin') {
        const { data } = await supabase.from('workspaces').select('*').order('created_at');
        return data || [];
      } else {
        const { data } = await supabase.from('workspace_members').select('workspaces(*)').eq('user_id', userProfile.id);
        const mapped = data?.map((d: any) => d.workspaces).filter(Boolean) || [];
        return mapped;
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

  const { data: boards, isLoading: isLoadingBoards } = useQuery({
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

      if (userRole === 'admin' || userRole === 'leader') {
        return data;
      }

      const allowedBoards = data.filter((board: any) =>
        canUserAccessBoard({
          board: { name: board.name, created_by: board.created_by },
          user: { id: userProfile.id, email: userProfile.email || '' },
          userRole: userRole,
          visibilityMode,
          profiles
        })
      );

      return allowedBoards;
    },
    enabled: !!activeWorkspaceId && !!userProfile?.id && !!allProfiles,
    staleTime: 5 * 60 * 1000
  });

  const activeWorkspaceName = workspaces?.find(w => w.id === activeWorkspaceId)?.name || workspaces?.[0]?.name || 'Carregando...';
  const hasMultipleWorkspaces = Boolean(workspaces && workspaces.length > 1);

  const isAtreladoOperacional = Boolean(
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
    } else if (!activeWorkspaceId) {
      alert('Selecione um setor primeiro!');
    }
  };

  return (
    <div
      className={`relative bg-white dark:bg-[#0b1120] border-slate-200/70 dark:border-white/[0.06] flex flex-col z-40 hidden md:flex shrink-0 transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? 'w-3.5 border-r-0 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer' : 'w-[264px] border-r'
      }`}
      onClick={() => isCollapsed && setIsCollapsed(false)}
    >
      {/* Botão de Recolher / Expandir Sidebar */}
      <button 
        onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
        className={`absolute top-6 -right-3 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-500 shadow-md z-[100] transition-all cursor-pointer ${
          isCollapsed ? 'rotate-180 -right-3 opacity-90 hover:opacity-100' : 'opacity-100'
        }`}
        title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <div className={`flex flex-col h-full w-[264px] overflow-hidden transition-opacity duration-200 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Topo: Seletor de Setor (Workspace) */}
        <div className="p-3.5 shrink-0 relative">
          <div
            onClick={() => hasMultipleWorkspaces && setIsDropdownOpen(!isDropdownOpen)}
            className={`w-full flex items-center justify-between p-2.5 rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.03] transition-all ${
              hasMultipleWorkspaces ? 'hover:border-blue-400 dark:hover:border-blue-500/60 cursor-pointer' : ''
            }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/20 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start overflow-hidden">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none mb-1">
                  Setor Atual
                </span>
                <h2 className="font-extrabold text-[14px] tracking-tight text-slate-800 dark:text-slate-100 truncate w-full text-left leading-tight">
                  {activeWorkspaceName}
                </h2>
              </div>
            </div>
            {hasMultipleWorkspaces && (
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
            )}
          </div>

          {hasMultipleWorkspaces && isDropdownOpen && (
            <div className="absolute top-full left-3.5 right-3.5 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl z-50 py-1.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 mb-1">
                Alternar Setor
              </div>
              {workspaces?.map(w => {
                const isSelected = w.id === activeWorkspaceId;
                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      if (w.id !== activeWorkspaceId && userProfile?.id) {
                        setActiveWorkspaceId(w.id);
                        localStorage.setItem(`monday_active_workspace_${userProfile.id}`, w.id);
                        localStorage.setItem('monday_active_workspace', w.id);
                        setIsDropdownOpen(false);
                        if (pathname.startsWith('/boards/')) {
                          router.push('/');
                        }
                      } else {
                        setIsDropdownOpen(false);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 font-medium'
                    }`}
                  >
                    <span className="truncate">{w.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Corpo do Menu */}
        <div className="p-3.5 flex-1 overflow-y-auto space-y-5">
          {/* Seção 1: Atalhos e Módulos */}
          <div>
            <div className="px-2 mb-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Menu Principal
            </div>
            <div className="space-y-1">
              <Link 
                href="/my-work"
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all w-full ${
                  pathname === '/my-work'
                    ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] font-medium'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  pathname === '/my-work'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-blue-500 dark:text-blue-400'
                }`}>
                  <CheckSquare className="w-4 h-4" />
                </div>
                <span className="text-[13px] truncate">Minhas Tarefas</span>
              </Link>

              {isAtreladoOperacional && (
                <Link 
                  href="/mensagens"
                  className={`flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer transition-all w-full ${
                    pathname === '/mensagens'
                      ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      pathname === '/mensagens'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'text-emerald-500 dark:text-emerald-400'
                    }`}>
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <span className="text-[13px] truncate">Envio de Mensagens</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Tempo Real"></span>
                </Link>
              )}

              {(userRole === 'admin' || userRole === 'leader') && (
                <Link 
                  href="/admin"
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all w-full ${
                    pathname.startsWith('/admin')
                      ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] font-medium'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    pathname.startsWith('/admin')
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'text-purple-500 dark:text-purple-400'
                  }`}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-[13px] truncate">
                    {userRole === 'admin' ? 'Painel de Administração' : 'Gestão do Setor'}
                  </span>
                </Link>
              )}
            </div>
          </div>

          {/* Seção 2: Lista de Quadros do Setor */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                <LayoutTemplate className="w-3.5 h-3.5 text-slate-400" />
                <span>Meus Quadros</span>
                {boards && (
                  <span className="ml-0.5 px-1.5 py-px bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 rounded-full text-[9px]">
                    {boards.length}
                  </span>
                )}
              </div>

              <button 
                onClick={handleCreateBoard}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer shrink-0"
                title="Adicionar Novo Quadro"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                <span>Novo</span>
              </button>
            </div>

            {isLoadingBoards ? (
              <div className="px-2 py-3 text-xs text-slate-400 shrink-0">Carregando quadros...</div>
            ) : (
              <div className="flex flex-col gap-1 shrink-0">
                {boards?.map(board => {
                  const isBoardActive = pathname === `/boards/${board.id}`;
                  return (
                    <div key={board.id} className="flex items-center group/board relative shrink-0">
                      <Link 
                        href={`/boards/${board.id}`}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all w-full border ${
                          isBoardActive
                            ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white font-semibold border-transparent'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] font-medium border-transparent'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          isBoardActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500'
                        }`}>
                          <Grid className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[13px] truncate pr-7">{board.name}</span>
                      </Link>
                      <button 
                        onClick={async (e) => {
                          e.preventDefault();
                          if(confirm(`Excluir o quadro "${board.name}"? Todas as tarefas serão perdidas!`)) {
                            await supabase.from('boards').delete().eq('id', board.id);
                            queryClient.invalidateQueries({ queryKey: ['sidebar_boards', activeWorkspaceId] });
                            router.push('/');
                          }
                        }}
                        className="absolute right-2 opacity-0 group-hover/board:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg text-slate-400 hover:text-red-500 transition-all shrink-0 cursor-pointer"
                        title="Excluir Quadro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé: Download do Aplicativo Desktop Windows (oculto dentro do próprio App Desktop) */}
        {!isDesktopApp && (
        <div className="p-3 shrink-0">
          <a
            href="/CR-Task-Desktop.exe"
            download="CR-Task-Desktop.exe"
            className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#0f172a] to-[#1e293b] hover:from-[#1e293b] hover:to-[#334155] text-white border border-slate-700/80 shadow-md transition-all group cursor-pointer"
            title="Baixar Aplicativo CR Task para Windows (Fica na bandeja do sistema ^ igual ao Slack)"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Monitor className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-extrabold text-white leading-tight truncate">
                  App Desktop (PC)
                </span>
                <span className="text-[10px] text-slate-300 truncate">
                  Bandeja ^ + Auto-WhatsApp
                </span>
              </div>
            </div>
            <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 shrink-0 transition-colors" />
          </a>
        </div>
        )}
      </div>
    </div>
  );
}
