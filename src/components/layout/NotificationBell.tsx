'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, X, Headphones, Calendar, CheckSquare } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { isBoardOwnedByUser } from '@/lib/privacy';
import { useRouter } from 'next/navigation';

interface NotificationBellProps {
  isCollapsed?: boolean;
}

export function NotificationBell({ isCollapsed }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', userProfile?.email],
    queryFn: async () => {
      if (!userProfile?.email) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', userProfile.email)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) {
        console.error('Erro ao buscar notificações:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!userProfile?.email,
    refetchInterval: 30000,
    refetchIntervalInBackground: false
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!userProfile?.email) return;
      await supabase.from('notifications').update({ read: true }).eq('user_email', userProfile.email);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  // Calcula a posição do popover flutuante via Portal
  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 380;
      const popoverHeight = 440;

      let left = isCollapsed ? rect.right + 12 : rect.right + 12;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }

      let top = Math.max(16, rect.top - 10);
      if (top + popoverHeight > window.innerHeight - 16) {
        top = Math.max(16, window.innerHeight - popoverHeight - 16);
      }

      setPos({ top, left });
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    const handleResize = () => setIsOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  // Resolve o ID do quadro de destino prioritário para o usuário
  const resolveTargetBoardId = async (): Promise<string | null> => {
    if (!userProfile?.id) return null;

    const activeWs = typeof window !== 'undefined' ? localStorage.getItem('monday_active_workspace') : null;

    const { data: allBoards } = await supabase
      .from('boards')
      .select('id, name, created_by, workspace_id')
      .order('created_at');

    if (!allBoards || allBoards.length === 0) return null;

    const orderedBoards = activeWs
      ? [
          ...allBoards.filter((b: any) => b.workspace_id === activeWs),
          ...allBoards.filter((b: any) => b.workspace_id !== activeWs)
        ]
      : allBoards;

    // 1. Procura o próprio quadro do usuário
    const ownBoard = orderedBoards.find((b: any) =>
      isBoardOwnedByUser(
        { name: b.name, created_by: b.created_by },
        { id: userProfile.id, email: userProfile.email || '' }
      )
    );

    if (ownBoard) return ownBoard.id;

    // 2. Fallback para o primeiro quadro disponível
    return orderedBoards[0]?.id || null;
  };

  // Clique na notificação com redirecionamento preciso
  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.read) {
        markAsRead.mutate(notif.id);
      }
      setIsOpen(false);

      const msg = (notif.message || '').toLowerCase();
      const isSla = msg.includes('sla') || msg.includes('plantao') || msg.includes('plantão');
      const isEscala = msg.includes('escala') || msg.includes('turno') || msg.includes('roster');

      // 1. Notificação com task_id (redireciona para o quadro da tarefa)
      if (notif.task_id) {
        const { data: task } = await supabase
          .from('tasks')
          .select('*, task_updates(*)')
          .eq('id', notif.task_id)
          .maybeSingle();

        if (task?.board_id) {
          let targetTab = 'tabela';
          if (task.task_type === 'Lembrete' || isSla) {
            targetTab = 'calendario';
          } else if (typeof window !== 'undefined') {
            const currentTab = new URLSearchParams(window.location.search).get('tab');
            if (currentTab === 'calendario' || currentTab === 'kanban') {
              targetTab = currentTab;
            }
          }

          if (typeof window !== 'undefined') {
            sessionStorage.setItem('crtask_pending_open_task', JSON.stringify(task));
            window.dispatchEvent(new CustomEvent('crtask_tab_switch', { detail: { tab: targetTab } }));
            window.dispatchEvent(new CustomEvent('crtask_open_task', { detail: { task, taskId: task.id } }));
          }

          router.push(`/boards/${task.board_id}?tab=${targetTab}&taskId=${task.id}`);
          return;
        }
      }

      // 2. Notificação de Plantão SLA (vai para a aba Calendário)
      if (isSla) {
        const targetBoardId = await resolveTargetBoardId();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('crtask_tab_switch', { detail: { tab: 'calendario' } }));
        }
        if (targetBoardId) {
          router.push(`/boards/${targetBoardId}?tab=calendario`);
        }
        return;
      }

      // 3. Notificação de Escala ou Turnos (vai para a aba Quadro de Turnos)
      if (isEscala) {
        const targetBoardId = await resolveTargetBoardId();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('crtask_tab_switch', { detail: { tab: 'turnos' } }));
        }
        if (targetBoardId) {
          router.push(`/boards/${targetBoardId}?tab=turnos`);
        }
        return;
      }

      // 4. Padrão: vai para o quadro principal do usuário
      const targetBoardId = await resolveTargetBoardId();
      if (targetBoardId) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('crtask_tab_switch', { detail: { tab: 'tabela' } }));
        }
        router.push(`/boards/${targetBoardId}?tab=tabela`);
      } else {
        router.push('/my-work');
      }
    } catch (err) {
      console.error('Erro ao redirecionar notificação:', err);
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return `Hoje às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      }
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {/* Botão de Disparo na Sidebar (Uniforme com os outros itens do menu) */}
      {!isCollapsed ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
            isOpen
              ? 'bg-blue-50 dark:bg-indigo-600/20 text-blue-700 dark:text-indigo-300 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
          }`}
          title="Notificações"
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0 flex items-center justify-center">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-white dark:ring-[#0e121e]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-xs">Notificações</span>
          </div>

          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400">
              {unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all cursor-pointer relative ${
            isOpen
              ? 'bg-blue-50 dark:bg-indigo-600/20 text-blue-700 dark:text-indigo-300'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
          }`}
          title={`Notificações ${unreadCount > 0 ? `(${unreadCount})` : ''}`}
        >
          <div className="relative flex items-center justify-center">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-white dark:ring-[#0e121e]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Popover de Notificações via Portal (Imune a overflow da sidebar e sem causar scrollbar horizontal) */}
      {isOpen && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[99999] w-[370px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#141a2b] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.1] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100"
          style={{
            top: `${pos.top}px`,
            left: `${pos.left}px`
          }}
        >
          {/* Header do Popover */}
          <div className="p-3.5 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-[#101626]">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Notificações</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-indigo-900/60 text-blue-700 dark:text-indigo-300">
                  {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead.mutate()}
                  className="text-xs text-blue-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Marcar lidas</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de Notificações */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06] scrollbar-thin">
            {!notifications || notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2.5 opacity-60" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Você não tem notificações no momento
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notif: any) => {
                  const rawMsg = notif.message || '';
                  const cleanMessage = rawMsg.includes('||') ? rawMsg.split('||')[1] : rawMsg;
                  const isSla = rawMsg.toLowerCase().includes('sla') || rawMsg.toLowerCase().includes('plantao') || rawMsg.toLowerCase().includes('plantão');
                  const isEscala = rawMsg.toLowerCase().includes('escala') || rawMsg.toLowerCase().includes('turno') || rawMsg.toLowerCase().includes('roster');

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 border-b border-slate-100 dark:border-white/[0.06] cursor-pointer transition-colors flex gap-3 ${
                        notif.read
                          ? 'bg-white dark:bg-[#141a2b] opacity-75 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                          : 'bg-blue-50/60 dark:bg-indigo-950/30 hover:bg-blue-50 dark:hover:bg-indigo-950/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isSla
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60'
                          : isEscala
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                          : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60'
                      }`}>
                        {isSla ? (
                          <Headphones className="w-4 h-4" />
                        ) : isEscala ? (
                          <Calendar className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug break-words ${
                          notif.read
                            ? 'text-slate-700 dark:text-slate-300 font-medium'
                            : 'text-slate-900 dark:text-white font-bold'
                        }`}>
                          {cleanMessage}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            {formatTimestamp(notif.created_at)}
                          </span>
                          <span className="text-[10px] font-semibold text-blue-600 dark:text-indigo-400 hover:underline">
                            Abrir →
                          </span>
                        </div>
                      </div>

                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-indigo-400 mt-1 shrink-0"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
