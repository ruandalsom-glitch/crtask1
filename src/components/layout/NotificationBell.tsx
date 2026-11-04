'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { isBoardOwnedByUser, canUserAccessBoard } from '@/lib/privacy';
import { useRouter } from 'next/navigation';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    staleTime: 5 * 60 * 1000
  });

  const { data: workspaceUsers } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, email, avatar_url, role, receive_emails').order('email');
      return data || [];
    },
    enabled: !!userProfile?.id,
    staleTime: 5 * 60 * 1000
  });

  const navigateToUserScaleBoard = async () => {
    if (!userProfile) return;
    const activeWs = typeof window !== 'undefined' ? localStorage.getItem('monday_active_workspace') : null;

    const [boardsRes, workspacesRes] = await Promise.all([
      supabase.from('boards').select('id, name, created_by, workspace_id'),
      supabase.from('workspaces').select('id, visibility_mode')
    ]);

    const allBoards = boardsRes.data || [];
    if (allBoards.length === 0) return;

    const profiles = workspaceUsers || [];
    const currentProf = profiles.find((p: any) => p.id === userProfile.id || p.email === userProfile.email);
    const userRole = currentProf?.role || 'user';
    const wsMap = new Map((workspacesRes.data || []).map((w: any) => [w.id, w.visibility_mode || 'own_only']));

    const orderedBoards = activeWs
      ? [
          ...allBoards.filter((b: any) => b.workspace_id === activeWs),
          ...allBoards.filter((b: any) => b.workspace_id !== activeWs)
        ]
      : allBoards;

    const ownBoard = orderedBoards.find((b: any) =>
      isBoardOwnedByUser(
        { name: b.name, created_by: b.created_by },
        { id: userProfile.id, email: userProfile.email || '' }
      )
    );

    if (ownBoard) {
      setIsOpen(false);
      router.push(`/boards/${ownBoard.id}?tab=turnos`);
      return;
    }

    const accessibleBoard = orderedBoards.find((b: any) =>
      canUserAccessBoard({
        board: { name: b.name, created_by: b.created_by },
        user: { id: userProfile.id, email: userProfile.email || '' },
        userRole,
        visibilityMode: wsMap.get(b.workspace_id) || 'own_only',
        profiles
      })
    );

    if (accessibleBoard) {
      setIsOpen(false);
      router.push(`/boards/${accessibleBoard.id}?tab=turnos`);
    }
  };

  const { data: notifications } = useQuery({
    queryKey: ['notifications', userProfile?.email],
    queryFn: async () => {
      if (!userProfile?.email) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', userProfile.email)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error("Erro ao buscar notificações:", error);
        return [];
      }
      return data;
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  const notifiedSet = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!notifications) return;

    if (!initialLoadDone.current) {
      notifications.forEach((notif: any) => notifiedSet.current.add(notif.id));
      initialLoadDone.current = true;
      return;
    }

    notifications.forEach((notif: any) => {
      if (!notif.read && !notifiedSet.current.has(notif.id)) {
        notifiedSet.current.add(notif.id);

        if ('Notification' in window && Notification.permission === 'granted') {
          let actualMessage = notif.message;
          let authorEmail = '';
          
          if (notif.message.includes('||')) {
            const parts = notif.message.split('||');
            authorEmail = parts[0];
            actualMessage = parts[1];
          }

          const authorMatch = actualMessage.split(' ')[0];
          const isScheduleNotif = actualMessage.toLowerCase().includes('escala');
          
          const getFirstName = (str: string) => {
            const clean = str.split('@')[0] || str;
            const name = clean.split('.')[0];
            return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
          };
          
          const firstName = authorEmail ? getFirstName(authorEmail) : getFirstName(authorMatch);
          const fallbackSeed = authorEmail || authorMatch;
          let iconUrl = isScheduleNotif ? '/logo.png' : `https://api.dicebear.com/7.x/notionists/svg?seed=${fallbackSeed}`;
          let title = isScheduleNotif ? `📅 Escala Mensal • CR Task` : `Notificação de ${firstName}`;
          let bodyText = isScheduleNotif ? actualMessage : actualMessage.replace(authorMatch, firstName);

          if (!isScheduleNotif && workspaceUsers && authorEmail) {
             const matchedUser = workspaceUsers.find((u: any) => u.email === authorEmail);
             if (matchedUser?.avatar_url) {
                iconUrl = matchedUser.avatar_url;
             }
          }

          const n = new Notification(title, {
            body: bodyText,
            icon: iconUrl,
          });

          n.onclick = async () => {
            window.focus();
            if (!notif.read) markAsRead.mutate(notif.id);
            if (notif.task_id) {
              const { data } = await supabase.from('tasks').select('board_id').eq('id', notif.task_id).single();
              if (data?.board_id) {
                window.location.href = `/boards/${data.board_id}?taskId=${notif.task_id}`;
              }
            } else if (notif.message?.toLowerCase().includes('escala')) {
              await navigateToUserScaleBoard();
            }
          };
        }
      }
    });
  }, [notifications]);

  return (
    <div className="relative flex justify-center w-full">
      <button 
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all relative group cursor-pointer border ${
          isOpen
            ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border-transparent'
        }`}
        title="Notificações"
      >
        <div className="relative">
          <Bell strokeWidth={2.1} className="w-5 h-5 group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#0b1120]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {!isOpen && (
          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700">
            Notificações {unreadCount > 0 ? `(${unreadCount})` : ''}
          </div>
        )}
      </button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute left-16 top-0 w-80 sm:w-96 bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden flex flex-col animate-in slide-in-from-left-2"
        >
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between bg-slate-50 dark:bg-[#0f172a]">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Notificações</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
                <button 
                  onClick={() => Notification.requestPermission().then(() => window.location.reload())}
                  className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 px-2.5 py-1 rounded-lg hover:bg-blue-200 font-semibold transition-colors cursor-pointer"
                >
                  Ativar pop-ups
                </button>
              )}
              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied' && (
                <span className="text-[10px] text-red-500 font-medium" title="Para receber pop-ups, clique no ícone de cadeado na barra de endereços e permita as notificações.">
                  Pop-ups Bloqueados 🔒
                </span>
              )}
              {unreadCount > 0 && (
                <button 
                  onClick={() => markAllAsRead.mutate()}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Marcar lidas
                </button>
              )}
            </div>
          </div>
          
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/80">
            {!notifications || notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2.5" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Você não tem notificações no momento</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notif: any) => (
                  <div 
                    key={notif.id} 
                    onClick={async () => {
                      if (!notif.read) markAsRead.mutate(notif.id);
                      if (notif.task_id) {
                         const { data } = await supabase.from('tasks').select('board_id').eq('id', notif.task_id).single();
                         if (data?.board_id) {
                            window.location.href = `/boards/${data.board_id}?taskId=${notif.task_id}`;
                         }
                      } else if (notif.message?.toLowerCase().includes('escala')) {
                         await navigateToUserScaleBoard();
                      }
                    }}
                    className={`p-3.5 border-b border-slate-100 dark:border-slate-700/60 cursor-pointer transition-colors ${
                      notif.read
                        ? 'bg-white dark:bg-[#1e293b] opacity-65 hover:opacity-100'
                        : 'bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 border border-blue-200/60 dark:border-blue-800/60">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${
                          notif.read
                            ? 'text-slate-600 dark:text-slate-300'
                            : 'text-slate-900 dark:text-white font-bold'
                        }`}>
                          {notif.message.includes('||') ? notif.message.split('||')[1] : notif.message}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(notif.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {!notif.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
