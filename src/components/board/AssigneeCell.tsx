'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { UserPlus, X, Search, User, Mail, Image, Crown, Building2 } from 'lucide-react';
import { AssigneeViewMode } from './AssigneeViewToggle';

export function AssigneeCell({ task, disabled }: { task: any; disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('current');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const [viewMode, setViewModeState] = useState<AssigneeViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('crtask_assignee_view_mode') as AssigneeViewMode) || 'icons';
    }
    return 'icons';
  });

  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem('crtask_assignee_view_mode') as AssigneeViewMode;
      if (saved) setViewModeState(saved);
    };
    window.addEventListener('assignee_view_mode_change', handleSync);
    return () => window.removeEventListener('assignee_view_mode_change', handleSync);
  }, []);

  const setViewMode = (mode: AssigneeViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('crtask_assignee_view_mode', mode);
      window.dispatchEvent(new Event('assignee_view_mode_change'));
    }
  };

  // Reutiliza o cache global de perfis para renderizar avatares instantaneamente (0 queries extras por linha)
  const { data: allProfiles } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, email, avatar_url, role, receive_emails').order('email');
      return data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // Buscar setores e membros APENAS quando o usuário abre o menu suspenso (isOpen === true)
  const { data: allWorkspaces } = useQuery({
    queryKey: ['all_workspaces_meta'],
    queryFn: async () => {
      const { data } = await supabase.from('workspaces').select('id, name, visibility_mode').order('created_at');
      return data || [];
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000
  });

  const { data: boardInfo } = useQuery({
    queryKey: ['board_info', task.board_id],
    queryFn: async () => {
      if (task.boards?.workspace_id) return { workspace_id: task.boards.workspace_id };
      if (!task.board_id) return null;
      const { data } = await supabase.from('boards').select('name, workspace_id').eq('id', task.board_id).single();
      return data || null;
    },
    enabled: isOpen && !!task.board_id,
    staleTime: 10 * 60 * 1000
  });

  const { data: workspaceMembers } = useQuery({
    queryKey: ['all_workspace_members'],
    queryFn: async () => {
      const { data } = await supabase.from('workspace_members').select('workspace_id, user_id');
      return data || [];
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000
  });

  const currentWorkspaceId = task.boards?.workspace_id || boardInfo?.workspace_id;

  const teamMembers = useMemo(() => {
    const profiles = allProfiles || [];
    if (!isOpen) return profiles;
    const members = workspaceMembers || [];

    let filteredProfiles = profiles;

    if (selectedSectorId === 'current') {
      if (currentWorkspaceId) {
        const memberUserIds = new Set(members.filter((m: any) => m.workspace_id === currentWorkspaceId).map((m: any) => m.user_id));
        filteredProfiles = profiles.filter((p: any) => memberUserIds.has(p.id));
      }
    } else if (selectedSectorId !== 'all') {
      const memberUserIds = new Set(members.filter((m: any) => m.workspace_id === selectedSectorId).map((m: any) => m.user_id));
      filteredProfiles = profiles.filter((p: any) => memberUserIds.has(p.id));
    }

    // Exclui a conta de administração pura do Ruan para tarefas operacionais,
    // garantindo que as atribuições sejam direcionadas à conta de líder (ruan.dalsom@masterdeliveryexpress.com.br)
    filteredProfiles = filteredProfiles.filter((p: any) => p.email !== 'ruan.dalsom@crexpresstransportessp.com.br');

    if (search.trim()) {
      return filteredProfiles.filter((u: any) => u.email.toLowerCase().includes(search.toLowerCase()));
    }
    return filteredProfiles;
  }, [allProfiles, workspaceMembers, isOpen, selectedSectorId, currentWorkspaceId, search]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      if (buttonRef.current) {
        setRect(buttonRef.current.getBoundingClientRect());
      }
    };

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  // Calcula posição inteligente (abre para cima se estiver próximo ao rodapé da tela para não cortar)
  const coords = useMemo(() => {
    if (!rect || typeof window === 'undefined') return null;

    const dropdownWidth = 340;
    const padding = 12;

    // Horizontal: centraliza no botão mas mantém 100% dentro dos limites da tela
    let left = rect.left + rect.width / 2 - dropdownWidth / 2;
    if (left < padding) left = padding;
    if (left + dropdownWidth > window.innerWidth - padding) {
      left = window.innerWidth - dropdownWidth - padding;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Se o espaço abaixo for inferior a 400px e houver mais espaço acima, abre para CIMA!
    const openUpward = spaceBelow < 420 && spaceAbove > spaceBelow;

    if (openUpward) {
      const bottom = Math.max(padding, window.innerHeight - rect.top + 8);
      const maxHeight = Math.max(260, Math.min(520, rect.top - padding - 16));
      return {
        bottom: `${bottom}px`,
        left: `${left}px`,
        maxHeight: `${maxHeight}px`,
      };
    } else {
      const top = Math.max(padding, rect.bottom + 8);
      const maxHeight = Math.max(260, Math.min(520, spaceBelow - padding - 16));
      return {
        top: `${top}px`,
        left: `${left}px`,
        maxHeight: `${maxHeight}px`,
      };
    }
  }, [rect]);

  const handleOpen = (e: React.MouseEvent) => {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const bounds = e.currentTarget.getBoundingClientRect();
    setRect(bounds);
    setIsOpen(true);
    setSearch('');
  };

  const updateTask = useMutation({
    mutationFn: async (newEmail: string | null) => {
      const { error } = await supabase
        .from('tasks')
        .update({ assignee_email: newEmail })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsOpen(false);
    }
  });

  const currentEmails = useMemo(() => {
    return task.assignee_email
      ? task.assignee_email.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];
  }, [task.assignee_email]);

  const formattedNames = useMemo(() => {
    if (currentEmails.length === 0) return '';
    return currentEmails.map((email: string) => {
      const prefix = email.split('@')[0];
      return prefix
        .split(/[\._-]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }).join(', ');
  }, [currentEmails]);

  const toggleEmail = (email: string) => {
    let newEmails;
    if (currentEmails.includes(email)) {
      newEmails = currentEmails.filter((e: string) => e !== email);
    } else {
      newEmails = [...currentEmails, email];
    }
    const newString = newEmails.length > 0 ? newEmails.join(', ') : null;
    updateTask.mutate(newString);
  };

  const renderContent = () => {
    if (currentEmails.length === 0) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-100 border border-dashed border-slate-300 hover:bg-slate-200 flex items-center justify-center">
          <UserPlus className="w-4 h-4 text-slate-400" />
        </div>
      );
    }

    if (viewMode === 'names') {
      return (
        <div className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full text-xs font-semibold text-slate-700 max-w-[150px] truncate flex items-center gap-1.5 shadow-xs transition-colors">
          <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate">{formattedNames}</span>
        </div>
      );
    }

    if (viewMode === 'emails') {
      return (
        <div className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full text-xs font-medium text-blue-800 max-w-[170px] truncate flex items-center gap-1.5 shadow-xs transition-colors">
          <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate">{currentEmails.join(', ')}</span>
        </div>
      );
    }

    // Default: icons (images)
    return (
      <div className="flex -space-x-2">
        {currentEmails.map((email: string, i: number) => {
          const userProfile = allProfiles?.find((u: any) => u.email === email);
          const avatarSrc = userProfile?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${email}`;
          return (
            <img 
              key={email} 
              src={avatarSrc} 
              alt={email}
              loading="lazy"
              className="w-8 h-8 rounded-full border border-slate-200 object-cover bg-white shadow-sm hover:z-10 hover:ring-2 ring-blue-400 transition-all" 
              style={{ zIndex: currentEmails.length - i }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <div 
        ref={buttonRef}
        onClick={handleOpen}
        title={task.assignee_email || 'Atribuir responsável'}
        className="relative mx-auto cursor-pointer flex items-center justify-center"
      >
        {renderContent()}
      </div>
      
      {updateTask.isPending && (
        <span className="absolute right-1 top-1 w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
      )}

      {/* Hover Tooltip */}
      {currentEmails.length > 0 && !isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 shadow-md">
          <div className="font-bold text-slate-100">{formattedNames}</div>
          <div className="text-[11px] text-slate-300">{currentEmails.join(', ')}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}

      {isOpen && rect && coords && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] w-[340px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 text-left animate-in fade-in zoom-in-95 duration-150 flex flex-col"
          style={coords}
        >
          {/* Seletor de Modo de Exibição */}
          <div className="mb-3 p-2 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg shrink-0">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[11px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Exibição do Responsável
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-white dark:bg-slate-800 p-1 rounded-md border border-purple-100 dark:border-purple-900/40 shadow-xs">
              <button 
                onClick={() => setViewMode('icons')} 
                className={`px-2 py-1 rounded text-xs font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${viewMode === 'icons' ? 'bg-purple-600 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                title="Visualização por Ícones / Avatares"
              >
                <Image className="w-3.5 h-3.5" /> Ícones
              </button>
              <button 
                onClick={() => setViewMode('names')} 
                className={`px-2 py-1 rounded text-xs font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${viewMode === 'names' ? 'bg-purple-600 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                title="Visualização por Nomes Agrupados"
              >
                <User className="w-3.5 h-3.5" /> Nomes
              </button>
              <button 
                onClick={() => setViewMode('emails')} 
                className={`px-2 py-1 rounded text-xs font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${viewMode === 'emails' ? 'bg-purple-600 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                title="Visualização por E-mails Agrupados"
              >
                <Mail className="w-3.5 h-3.5" /> E-mails
              </button>
            </div>
          </div>

          {/* Seletor de Setor dos Colaboradores */}
          <div className="mb-3 p-2 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-lg shrink-0">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Filtrar por Setor
              </span>
            </div>
            <select
              value={selectedSectorId}
              onChange={(e) => setSelectedSectorId(e.target.value)}
              className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
            >
              <option value="current">Setor Atual (Este Quadro)</option>
              <option value="all">Todos os Setores (Empresa Inteira)</option>
              {allWorkspaces?.map((ws: any) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>

          {currentEmails.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3 max-h-20 overflow-y-auto shrink-0 pr-1">
              {currentEmails.map((email: string) => {
                const userProfile = allProfiles?.find((u: any) => u.email === email);
                const avatarSrc = userProfile?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${email}`;
                return (
                  <div key={email} className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full pl-1 pr-2 py-0.5 gap-1.5 border border-slate-200 dark:border-slate-700">
                    <img src={avatarSrc} className="w-5 h-5 rounded-full bg-white object-cover" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{email.split('@')[0]}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEmail(email);
                      }}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-0.5 rounded-full transition-colors ml-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="relative mb-3 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              autoFocus
              placeholder="Pesquise nomes ou e-mails..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim() && search.includes('@')) {
                  toggleEmail(search.trim());
                  setSearch('');
                }
              }}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1 min-h-[100px] max-h-56 overflow-y-auto mb-2 pr-1 overscroll-contain">
            <h4 className="text-xs text-slate-400 dark:text-slate-500 font-semibold mb-2 px-1">Pessoas sugeridas</h4>
            {teamMembers.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma pessoa encontrada. Digite um e-mail e aperte Enter para convidar.</div>
            ) : (
              <div className="flex flex-col gap-1">
                {teamMembers.map((member: any) => {
                  const email = member.email;
                  const isSelected = currentEmails.includes(email);
                  const avatarSrc = member.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${email}`;
                  return (
                    <button
                      key={email}
                      onClick={() => toggleEmail(email)}
                      className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-sm transition-colors text-left cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'}`}
                    >
                      <img src={avatarSrc} className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 object-cover shrink-0" />
                      <span className="truncate flex-1">{email}</span>
                      {isSelected && <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded-full shrink-0">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-auto shrink-0">
            <button 
              onClick={() => {
                const email = prompt("E-mail para convidar:");
                if (email && email.includes('@')) {
                  toggleEmail(email);
                }
              }}
              className="flex items-center gap-2.5 w-full p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0"><UserPlus className="w-3.5 h-3.5" /></div>
              Convide um novo membro por e-mail
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
