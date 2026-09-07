'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  const { data: workspaceUsers } = useQuery({
    queryKey: ['workspace_users'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
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
        .limit(20);
      
      if (error) {
        console.error("Erro ao buscar notificações:", error);
        return [];
      }
      return data;
    },
    enabled: !!userProfile?.email,
    refetchInterval: 15000 // Polling otimizado a cada 15s
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

  // Solicitar permissão para notificações do Windows/Navegador
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
      // Na primeira carga da página, apenas marca todos como processados para não subir pop-up antigo
      notifications.forEach((notif: any) => notifiedSet.current.add(notif.id));
      initialLoadDone.current = true;
      return;
    }

    notifications.forEach((notif: any) => {
      // Se não está lida e é uma notificação nova (não estava no initial load)
      if (!notif.read && !notifiedSet.current.has(notif.id)) {
        notifiedSet.current.add(notif.id);

        if ('Notification' in window && Notification.permission === 'granted') {
          // Extrai o email exato se existir o formato "email||mensagem"
          let actualMessage = notif.message;
          let authorEmail = '';
          
          if (notif.message.includes('||')) {
            const parts = notif.message.split('||');
            authorEmail = parts[0];
            actualMessage = parts[1];
          }

          // Pega o nome do autor (ex: 'ruan.dalsom' de "ruan.dalsom atualizou...")
          const authorMatch = actualMessage.split(' ')[0];
          
          const getFirstName = (str: string) => {
            const name = str.split('.')[0];
            return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
          };
          
          const firstName = getFirstName(authorMatch);
          // O fallback agora usa o email exato (se existir) para gerar o MESMO Dicebear do canto inferior esquerdo
          const fallbackSeed = authorEmail || authorMatch;
          let iconUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${fallbackSeed}`;
          let title = `Notificação de ${firstName}`;
          let bodyText = actualMessage.replace(authorMatch, firstName);

          if (workspaceUsers && authorEmail) {
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
            if (notif.task_id) {
              const { data } = await supabase.from('tasks').select('board_id').eq('id', notif.task_id).single();
              if (data?.board_id) {
                window.location.href = `/boards/${data.board_id}?taskId=${notif.task_id}`;
              }
            }
          };
        }
      }
    });
  }, [notifications]);

  return (
    <div className="relative">
      <button 
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-center p-2 transition-colors border-l-[3px] ${isOpen ? 'text-white border-blue-400 bg-white/10' : 'text-slate-400 hover:text-white border-transparent'}`}
      >
        <div className="relative">
          <Bell strokeWidth={2.5} className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#292f4c]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute left-16 top-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col animate-in slide-in-from-left-2"
        >
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-800">Notificações</h3>
            <div className="flex items-center gap-3">
              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
                <button 
                  onClick={() => Notification.requestPermission().then(() => window.location.reload())}
                  className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 font-semibold transition-colors"
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
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Lidas
                </button>
              )}
            </div>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                <Bell className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-sm">Você não tem notificações</p>
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
                      }
                    }}
                    className={`p-4 border-b border-slate-50 cursor-pointer transition-colors ${notif.read ? 'bg-white opacity-60' : 'bg-blue-50/50 hover:bg-blue-50'}`}
                  >
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-1">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${notif.read ? 'text-slate-600' : 'text-slate-800 font-semibold'}`}>
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
