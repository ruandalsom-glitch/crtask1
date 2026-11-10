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
  LogOut,
  Camera,
  ShieldCheck,
  FileText,
  Mail,
  MailWarning,
  BarChart3,
  Pencil,
  X
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { canUserAccessBoard, isBoardOwnedByUser } from '@/lib/privacy';
import { renameBoard } from '@/lib/boardActions';
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
  const [dropdownPos, setDropdownPos] = useState<{ bottom: number; left: number } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>('tabela');
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingBoardName, setEditingBoardName] = useState('');
  const [isRenamingBoard, setIsRenamingBoard] = useState(false);

  const userButtonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Sincronização segura da aba ativa sem chamar useSearchParams() (evita erro CSR bailout do Next.js)
  useEffect(() => {
    const syncTabFromUrl = () => {
      if (typeof window !== 'undefined') {
        const tab = new URLSearchParams(window.location.search).get('tab') || 'tabela';
        setCurrentTab(tab);
      }
    };
    syncTabFromUrl();

    const handleCustomSwitch = (e: any) => {
      if (e.detail?.tab) setCurrentTab(e.detail.tab);
    };

    window.addEventListener('popstate', syncTabFromUrl);
    window.addEventListener('crtask_tab_switch', handleCustomSwitch);
    return () => {
      window.removeEventListener('popstate', syncTabFromUrl);
      window.removeEventListener('crtask_tab_switch', handleCustomSwitch);
    };
  }, [pathname]);

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

  // Identifica o board atual selecionado ou o primeiro do setor
  const pathBoardIdMatch = pathname.match(/^\/boards\/([^/?]+)/);
  const currentBoardId = pathBoardIdMatch ? pathBoardIdMatch[1] : (boards[0]?.id || '');

  // Sincronização do tema Claro / Escuro
  useEffect(() => {
    const syncTheme = () => {
      try {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
        setIsDarkMode(shouldBeDark);
        if (shouldBeDark) {
          document.documentElement.classList.add('dark');
          document.body.classList.add('dark');
          document.documentElement.style.colorScheme = 'dark';
        } else {
          document.documentElement.classList.remove('dark');
          document.body.classList.remove('dark');
          document.documentElement.style.colorScheme = 'light';
        }
      } catch (e) {}
    };
    syncTheme();
    window.addEventListener('crtask_theme_change', syncTheme);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener('crtask_theme_change', syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('theme', 'light');
    }
    window.dispatchEvent(new Event('crtask_theme_change'));
  };

  // Upload de Foto de Perfil
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile?.id) return;

    try {
      setIsUploadingAvatar(true);
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${userProfile.id}-${Date.now()}.${fileExt}`;

      let uploadRes = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      let publicUrl = '';
      if (!uploadRes.error) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      } else {
        const fallbackRes = await supabase.storage
          .from('attachments')
          .upload(fileName, file, { upsert: true });
        if (fallbackRes.error) throw uploadRes.error;
        const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      }

      await supabase
        .from('profiles')
        .upsert({ id: userProfile.id, email: userProfile.email, avatar_url: publicUrl }, { onConflict: 'id' });

      queryClient.invalidateQueries({ queryKey: ['all_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['current_user'] });
      alert('Foto de perfil atualizada com sucesso!');
    } catch (err: any) {
      alert('Erro ao atualizar foto: ' + (err.message || 'Falha no upload'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const toggleUserMenu = () => {
    if (!isUserMenuOpen && userButtonRef.current) {
      const rect = userButtonRef.current.getBoundingClientRect();
      if (isCollapsed) {
        setDropdownPos({
          bottom: Math.max(16, window.innerHeight - rect.bottom),
          left: rect.right + 12
        });
      } else {
        setDropdownPos({
          bottom: Math.max(16, window.innerHeight - rect.top + 8),
          left: Math.max(12, rect.left)
        });
      }
      setIsUserMenuOpen(true);
    } else {
      setIsUserMenuOpen(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        userButtonRef.current &&
        !userButtonRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    const handleResize = () => setIsUserMenuOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
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

  const startRenamingBoard = (e: React.MouseEvent, board: any) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingBoardId(board.id);
    setEditingBoardName(board.name || '');
  };

  const cancelRenamingBoard = () => {
    setEditingBoardId(null);
    setEditingBoardName('');
  };

  const confirmRenamingBoard = async (board: any) => {
    const trimmed = editingBoardName.trim();
    if (!trimmed || trimmed === (board.name || '').trim()) {
      cancelRenamingBoard();
      return;
    }
    if (isRenamingBoard) return;

    setIsRenamingBoard(true);
    try {
      await renameBoard({
        boardId: board.id,
        currentName: board.name,
        newName: trimmed,
        queryClient
      });
      cancelRenamingBoard();
    } catch (err: any) {
      alert(err?.message || 'Erro ao renomear quadro.');
    } finally {
      setIsRenamingBoard(false);
    }
  };

  const handleTabClick = (tab: string) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crtask_tab_switch', { detail: { tab } }));
    }
    if (currentBoardId) {
      router.push(`/boards/${currentBoardId}?tab=${tab}`);
    }
  };

  return (
    <aside
      className={`h-screen flex flex-col shrink-0 z-40 transition-all duration-300 ease-in-out select-none bg-white dark:bg-[#0e121e] border-r border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 overflow-x-hidden ${
        isCollapsed ? 'w-[64px]' : 'w-[256px]'
      }`}
    >
      {/* 1. TOPO DA SIDEBAR: LOGO + NOME DO APP + BOTÃO DE RECOLHER */}
      <div className={`h-16 flex items-center border-b border-slate-200 dark:border-white/[0.06] shrink-0 bg-white dark:bg-[#0e121e] ${isCollapsed ? 'justify-center px-1' : 'justify-between px-4'}`}>
        {!isCollapsed ? (
          <>
            <Link href="/" className="flex items-center gap-2.5 overflow-hidden group">
              {/* Box da Logo com fundo escuro elegante para o logo branco ficar 100% visível em ambos os temas */}
              <div className="w-9 h-9 rounded-xl bg-[#0a0f1d] border border-slate-700/60 p-1.5 shadow-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <img src="/logo.png" alt="CR Task" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white leading-tight">
                  CR Task
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide truncate">
                  Workspace Operacional
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
              title="Recolher menu lateral"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs"
            title="Expandir menu lateral"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. CORPO ROLÁVEL DA SIDEBAR (overflow-x-hidden para eliminar 100% qualquer scrollbar horizontal) */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden space-y-5 scrollbar-thin ${isCollapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
        {/* SEÇÃO 1: NAVEGAÇÃO RÁPIDA PRINCIPAL */}
        <div className="space-y-1">
          {/* Início */}
          <Link
            href="/"
            className={`flex items-center rounded-xl transition-all cursor-pointer ${
              isCollapsed ? 'w-10 h-10 justify-center mx-auto' : 'gap-3 px-3 py-2'
            } ${
              pathname === '/'
                ? 'bg-blue-600 dark:bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            title="Início"
          >
            <Home className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="text-xs truncate">Início</span>}
          </Link>

          {/* Minhas Tarefas (Limpo, sem notificação desnecessária) */}
          <Link
            href="/my-work"
            className={`flex items-center rounded-xl transition-all cursor-pointer ${
              isCollapsed ? 'w-10 h-10 justify-center mx-auto' : 'gap-3 px-3 py-2'
            } ${
              pathname === '/my-work'
                ? 'bg-blue-600 dark:bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            title="Minhas Tarefas"
          >
            <CheckSquare className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="text-xs truncate">Minhas Tarefas</span>}
          </Link>

          {/* Envio de Mensagens (Acesso Direto) */}
          {(isOperacional || userRole === 'admin') && (
            <Link
              href="/mensagens"
              className={`flex items-center rounded-xl transition-all cursor-pointer ${
                isCollapsed ? 'w-10 h-10 justify-center mx-auto' : 'gap-3 px-3 py-2'
              } ${
                pathname === '/mensagens'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
              }`}
              title="Envio de Mensagens"
            >
              <MessageSquare className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="text-xs truncate">Envio de Mensagens</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-2"></span>
                </div>
              )}
            </Link>
          )}

          {/* Painel de Administração (Acesso Direto para Admin e Líder) */}
          {isAdminOrLeader && (
            <Link
              href="/admin"
              className={`flex items-center rounded-xl transition-all cursor-pointer ${
                isCollapsed ? 'w-10 h-10 justify-center mx-auto' : 'gap-3 px-3 py-2'
              } ${
                pathname.startsWith('/admin')
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
              }`}
              title={userRole === 'admin' ? 'Painel de Administração' : 'Gestão do Setor'}
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
              {!isCollapsed && (
                <span className="text-xs truncate">
                  {userRole === 'admin' ? 'Painel de Administração' : 'Gestão do Setor'}
                </span>
              )}
            </Link>
          )}

          {/* Notificações (Sino com popover via Portal e redimensionamento limpo) */}
          <NotificationBell isCollapsed={isCollapsed} />
        </div>

        {/* SEÇÃO 2: "MEU SETOR" COM ÁRVORE DE MÓDULOS */}
        <div className="space-y-1.5">
          {!isCollapsed ? (
            <div className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Meu Setor
            </div>
          ) : (
            <div className="w-8 h-px bg-slate-200 dark:bg-white/[0.08] mx-auto my-1"></div>
          )}

          {/* Card Seletor de Setor */}
          {!isCollapsed ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSectorDropdownOpen(!isSectorDropdownOpen)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.06] transition-all cursor-pointer group shadow-2xs"
                title={activeWorkspaceName}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                      {activeWorkspaceName}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">Setor Ativo</span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-transform ${
                    isSectorDropdownOpen ? 'rotate-180 text-blue-600 dark:text-indigo-400' : ''
                  }`}
                />
              </button>

              {/* Dropdown de Setores */}
              {isSectorDropdownOpen && (
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
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-indigo-600/20 text-blue-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-2xs hover:scale-105 transition-transform"
              title={`Setor: ${activeWorkspaceName}`}
            >
              <Building2 className="w-4 h-4" />
            </button>
          )}

          {/* Árvore de Módulos do Setor (com redirecionamento perfeito de abas) */}
          {!isCollapsed ? (
            <div className="pl-3 border-l border-slate-200 dark:border-white/[0.06] ml-4 space-y-1 pt-1">
              {/* Quadro de Tarefas */}
              {currentBoardId && (
                <button
                  type="button"
                  onClick={() => handleTabClick('tabela')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                    pathname.startsWith('/boards') && currentTab === 'tabela'
                      ? 'text-blue-700 dark:text-indigo-300 font-bold bg-blue-50/80 dark:bg-indigo-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">Quadro de Tarefas</span>
                </button>
              )}

              {/* Rotinas Diárias */}
              {currentBoardId && (
                <button
                  type="button"
                  onClick={() => handleTabClick('rotina')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                    pathname.startsWith('/boards') && currentTab === 'rotina'
                      ? 'text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <ListChecks className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">Rotinas Diárias</span>
                </button>
              )}

              {/* Escalas e Turnos */}
              {currentBoardId && (
                <button
                  type="button"
                  onClick={() => handleTabClick('turnos')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                    pathname.startsWith('/boards') && (currentTab === 'turnos' || currentTab === 'escala')
                      ? 'text-violet-700 dark:text-violet-300 font-bold bg-violet-50 dark:bg-violet-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                  <span className="truncate">Escalas e Turnos</span>
                </button>
              )}

              {/* Calendário do Setor */}
              {currentBoardId && (
                <button
                  type="button"
                  onClick={() => handleTabClick('calendario')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                    pathname.startsWith('/boards') && currentTab === 'calendario'
                      ? 'text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span className="truncate">Calendário do Setor</span>
                </button>
              )}

              {/* Relatórios & Gestão */}
              {isAdminOrLeader && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    pathname.startsWith('/admin')
                      ? 'text-purple-700 dark:text-purple-300 font-bold bg-purple-50 dark:bg-purple-500/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="truncate">Relatórios & Gestão</span>
                </Link>
              )}
            </div>
          ) : (
            /* Ícones Rápidos quando colapsado */
            <div className="space-y-1 pt-1 flex flex-col items-center">
              {currentBoardId && (
                <button
                  type="button"
                  onClick={() => handleTabClick('tabela')}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    pathname.startsWith('/boards') && currentTab === 'tabela'
                      ? 'bg-blue-600 dark:bg-indigo-600 text-white font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                  }`}
                  title="Quadro de Tarefas"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              )}

              {currentBoardId && (
                <button
                  type="button"
                  onClick={() => handleTabClick('rotina')}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    pathname.startsWith('/boards') && currentTab === 'rotina'
                      ? 'bg-amber-600 text-white font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                  }`}
                  title="Rotinas Diárias"
                >
                  <ListChecks className="w-4 h-4" />
                </button>
              )}

              {currentBoardId && (
                <button
                  type="button"
                  onClick={() => handleTabClick('calendario')}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    pathname.startsWith('/boards') && currentTab === 'calendario'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                  }`}
                  title="Calendário do Setor"
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* SEÇÃO 3: "MEUS QUADROS" */}
        {!isCollapsed ? (
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
                const canRename =
                  userRole === 'admin' ||
                  userRole === 'leader' ||
                  isBoardOwnedByUser(
                    { name: b.name, created_by: b.created_by },
                    { id: userProfile?.id, email: userProfile?.email || '' }
                  );
                const isEditingThis = editingBoardId === b.id;

                if (isEditingThis) {
                  return (
                    <div
                      key={b.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50/80 dark:bg-white/[0.06] border border-blue-400 dark:border-indigo-500/60"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editingBoardName}
                        disabled={isRenamingBoard}
                        onChange={(e) => setEditingBoardName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            confirmRenamingBoard(b);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelRenamingBoard();
                          }
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => confirmRenamingBoard(b)}
                        className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none"
                        placeholder="Nome do quadro..."
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => confirmRenamingBoard(b)}
                        disabled={isRenamingBoard}
                        className="p-0.5 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 cursor-pointer shrink-0"
                        title="Salvar nome"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={cancelRenamingBoard}
                        disabled={isRenamingBoard}
                        className="p-0.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-100/70 dark:hover:bg-rose-950/60 cursor-pointer shrink-0"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={b.id} className="group relative flex items-center">
                    <Link
                      href={`/boards/${b.id}`}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                        canRename ? 'pr-8' : ''
                      } ${
                        isActive
                          ? 'bg-blue-50 dark:bg-white/[0.08] text-blue-700 dark:text-white font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{b.name}</span>
                    </Link>
                    {canRename && (
                      <button
                        type="button"
                        onClick={(e) => startRenamingBoard(e, b)}
                        className="absolute right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-blue-600 dark:hover:text-indigo-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.08] transition-all cursor-pointer"
                        title="Renomear quadro"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* SEÇÃO 4: BOTÃO APP DESKTOP (SÓ SE NÃO ESTIVER NO DESKTOP) */}
        {!isDesktopApp && !isCollapsed && (
          <div className="pt-2">
            <a
              href="/CR-Task-Desktop.exe"
              download="CR-Task-Desktop.exe"
              className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-gradient-to-r dark:from-[#141a2c] dark:to-[#1c243c] border border-slate-200 dark:border-white/[0.08] hover:border-emerald-500/40 text-slate-800 dark:text-white shadow-2xs transition-all group"
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

      {/* 3. RODAPÉ DA SIDEBAR: PERFIL DO USUÁRIO COMPLETO */}
      <div
        className={`border-t border-slate-200 dark:border-white/[0.06] shrink-0 relative bg-white dark:bg-[#0e121e] ${
          isCollapsed ? 'p-2 flex justify-center' : 'p-3'
        }`}
        ref={userButtonRef}
      >
        <div
          onClick={toggleUserMenu}
          className={`rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer group flex items-center ${
            isCollapsed ? 'w-10 h-10 justify-center p-0' : 'w-full justify-between p-2'
          }`}
          title={userName}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs overflow-hidden">
                {currentProfile?.avatar_url ? (
                  <img
                    src={currentProfile.avatar_url}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  userName[0]?.toUpperCase() || 'R'
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-[#0e121e]"></span>
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

          {!isCollapsed && <MoreVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white shrink-0" />}
        </div>
      </div>

      {/* Menu Popover do Perfil via Portal (Nunca cortado pelo overflow-hidden da sidebar) */}
      {isUserMenuOpen && dropdownPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[99999] w-[285px] bg-white dark:bg-[#141a2b] border border-slate-200 dark:border-white/[0.1] shadow-2xl rounded-2xl p-2.5 text-left animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100"
          style={{
            bottom: `${dropdownPos.bottom}px`,
            left: `${dropdownPos.left}px`,
            maxWidth: 'calc(100vw - 32px)'
          }}
        >
          {/* Header do Usuário */}
          <div className="p-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-3 bg-slate-50 dark:bg-white/[0.03] rounded-xl mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/[0.1] shrink-0 text-white font-black text-sm shadow-xs">
              {currentProfile?.avatar_url ? (
                <img src={currentProfile.avatar_url} alt={userName} className="w-full h-full object-cover" />
              ) : (
                userName[0]?.toUpperCase() || 'U'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate capitalize">
                {userName.replace('.', ' ')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">{currentProfile?.email}</p>
              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-indigo-950/80 text-blue-700 dark:text-indigo-300 border border-blue-200/60 dark:border-indigo-800/60">
                {userRole === 'admin' ? 'Administrador' : userRole === 'leader' ? 'Líder de Setor' : 'Colaborador'}
              </span>
            </div>
          </div>

          {/* Lista de Ações do Menu de Perfil */}
          <div className="flex flex-col gap-0.5">
            {/* 1. Trocar Foto de Perfil */}
            <label className="flex items-center gap-2.5 w-full px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span>{isUploadingAvatar ? 'Enviando imagem...' : 'Alterar foto de perfil'}</span>
                <span className="text-[10px] font-normal text-slate-400">JPG, PNG ou GIF</span>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                disabled={isUploadingAvatar}
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>

            {/* 2. Painel de Administração (se admin ou líder) */}
            {isAdminOrLeader && (
              <Link
                href="/admin"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-500/15 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span>Painel de Administração</span>
                  <span className="text-[10px] font-normal text-slate-400">Gerenciar setores e permissões</span>
                </div>
              </Link>
            )}

            {/* 3. Relatórios do Setor */}
            {isAdminOrLeader && (
              <Link
                href="/admin/reports"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span>Relatórios e Insights</span>
                  <span className="text-[10px] font-normal text-slate-400">Métricas e produtividade</span>
                </div>
              </Link>
            )}

            {/* 4. Notificações por E-mail */}
            <button
              type="button"
              onClick={async () => {
                const currentStatus = currentProfile?.receive_emails ?? true;
                const newStatus = !currentStatus;
                try {
                  await supabase.from('profiles').update({ receive_emails: newStatus }).eq('id', userProfile?.id);
                  queryClient.invalidateQueries({ queryKey: ['all_profiles'] });
                } catch (e: any) {
                  alert('Erro ao atualizar preferência de e-mail.');
                }
              }}
              className="flex items-center justify-between w-full px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  (currentProfile?.receive_emails ?? true)
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}>
                  {(currentProfile?.receive_emails ?? true) ? (
                    <Mail className="w-4 h-4" />
                  ) : (
                    <MailWarning className="w-4 h-4" />
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span>Notificações por E-mail</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {(currentProfile?.receive_emails ?? true) ? 'Notificações ativadas' : 'Notificações pausadas'}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                (currentProfile?.receive_emails ?? true)
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}>
                {(currentProfile?.receive_emails ?? true) ? 'Ativo' : 'Inativo'}
              </span>
            </button>

            {/* 5. Alternador de Tema Escuro / Claro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-between w-full px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isDarkMode
                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-500 dark:text-indigo-400'
                    : 'bg-amber-50 text-amber-500'
                }`}>
                  {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </div>
                <div className="flex flex-col text-left">
                  <span>Tema Escuro</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {isDarkMode ? 'Modo noturno ativo' : 'Modo claro ativo'}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isDarkMode
                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}>
                {isDarkMode ? 'Ligado' : 'Desligado'}
              </span>
            </button>

            {/* 6. Botão Sair da Conta */}
            <div className="pt-1 mt-1 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={async () => {
                  localStorage.clear();
                  sessionStorage.clear();
                  queryClient.clear();
                  await supabase.auth.signOut();
                  window.location.href = '/login';
                }}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/15 flex items-center justify-center text-rose-500 shrink-0">
                  <LogOut className="w-4 h-4" />
                </div>
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
}
