'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserProfile } from "@/components/layout/UserProfile";
import { LayoutGrid, CheckSquare, MessageSquare, ShieldCheck, Search, Sun, Moon } from "lucide-react";
import { useEffect, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, getFastUser } from '@/lib/supabaseClient';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const INACTIVITY_LIMIT = 12 * 60 * 60 * 1000; // 12 horas em ms

  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => getFastUser(),
    enabled: pathname !== '/login',
    staleTime: 5 * 60 * 1000
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, email, avatar_url, role, receive_emails').order('email');
      return data || [];
    },
    enabled: !!userProfile?.id && pathname !== '/login',
    staleTime: 5 * 60 * 1000
  });

  const userRole = allProfiles?.find((p: any) => p.id === userProfile?.id || p.email === userProfile?.email)?.role || 'user';
  const isAdminOrLeader = userRole === 'admin' || userRole === 'leader';

  // Sincronização global do Tema Escuro / Claro
  useEffect(() => {
    const syncTheme = () => {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
      setIsDarkMode(shouldBeDark);
      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
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

  const handleLogout = useCallback(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    if (pathname === '/login') return;

    let timeoutId: NodeJS.Timeout = setTimeout(handleLogout, INACTIVITY_LIMIT);
    let lastReset = Date.now();

    const resetTimer = () => {
      const now = Date.now();
      if (now - lastReset < 30000) return;
      lastReset = now;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleLogout, INACTIVITY_LIMIT);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [pathname, handleLogout, INACTIVITY_LIMIT]);

  // Checagem global de Lembretes do Calendário
  useEffect(() => {
    if (pathname === '/login') return;

    const checkReminders = async () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const hours = String(today.getHours()).padStart(2, '0');
      const mins = String(today.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${mins}`;

      const user = await getFastUser();
      if (!user?.email) return;

      const { data } = await supabase
        .from('tasks')
        .select('id, title, due_time, board_id')
        .eq('task_type', 'Lembrete')
        .eq('assignee_email', user.email)
        .eq('due_date', dateStr)
        .eq('due_time', timeStr);

      if (data && data.length > 0) {
        data.forEach((lembrete: any) => {
          const notifId = `lembrete-${lembrete.id}-${timeStr}`;
          const alreadyNotified = localStorage.getItem(notifId);
          
          if (!alreadyNotified) {
            localStorage.setItem(notifId, 'true');
            const prevTitle = document.title;
            document.title = `🔔 [ALARME] Lembrete: ${lembrete.title} - CR Task`;
            setTimeout(() => {
              if (document.title.includes(lembrete.title)) {
                document.title = prevTitle || 'CR Admin Workspace';
              }
            }, 12000);
            if ('Notification' in window && Notification.permission === 'granted') {
              const n = new Notification('🔔 Lembrete do Calendário', {
                body: `Está na hora: ${lembrete.title}`,
                icon: '/logo.png',
              });
              n.onclick = () => {
                window.focus();
                router.push(`/boards/${lembrete.board_id}`);
              };
            }
          }
        });
      }
    };

    const initialTimer = setTimeout(checkReminders, 3000);
    const intervalId = setInterval(checkReminders, 60000);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    };
  }, [pathname, router]);

  if (pathname === '/login') {
    return <main className="flex-1 w-full bg-[#0a0a0a] min-h-screen">{children}</main>;
  }

  const isBoardsActive = pathname === '/' || pathname.startsWith('/boards');
  const isMyWorkActive = pathname === '/my-work';
  const isMensagensActive = pathname === '/mensagens';
  const isAdminActive = pathname.startsWith('/admin');

  return (
    <div className="flex h-screen overflow-hidden w-full bg-[#0b1120]">
      {/* Primary Navigation Rail (Modern SaaS Style) */}
      <aside className="w-[68px] bg-[#0b1120] text-slate-300 flex flex-col items-center py-4 shrink-0 z-50 relative border-r border-slate-800/80 shadow-2xl select-none">
        {/* Logo Oficial CR Task */}
        <div 
          onClick={() => router.push('/')}
          className="w-11 h-11 bg-slate-950 rounded-2xl mb-5 flex items-center justify-center shadow-lg cursor-pointer overflow-hidden border border-slate-800 p-1 hover:border-indigo-500/60 hover:scale-105 transition-all group relative"
          title="CR Task • Início"
        >
          <img src="/logo.png" alt="CR Logo" className="w-full h-full object-contain rounded-xl" />
          <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
        
        {/* Ícones de Navegação Principal */}
        <nav className="flex flex-col gap-2 items-center flex-1 w-full px-2">
          {/* 1. Espaços de Trabalho / Quadros */}
          <button 
            onClick={() => router.push('/')}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all relative group cursor-pointer ${
              isBoardsActive
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
            }`}
            title="Quadros e Espaços de Trabalho"
          >
            {isBoardsActive && (
              <span className="absolute -left-2 w-1 h-5 bg-indigo-500 rounded-r-full"></span>
            )}
            <LayoutGrid strokeWidth={2.1} className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700">
              Meus Quadros
            </div>
          </button>

          {/* 2. Minhas Tarefas */}
          <button 
            onClick={() => router.push('/my-work')}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all relative group cursor-pointer ${
              isMyWorkActive
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm shadow-blue-500/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
            }`}
            title="Minhas Tarefas"
          >
            {isMyWorkActive && (
              <span className="absolute -left-2 w-1 h-5 bg-blue-500 rounded-r-full"></span>
            )}
            <CheckSquare strokeWidth={2.1} className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700">
              Minhas Tarefas
            </div>
          </button>

          {/* 3. Envio de Mensagens */}
          <button 
            onClick={() => router.push('/mensagens')}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all relative group cursor-pointer ${
              isMensagensActive
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
            }`}
            title="Envio de Mensagens Operacionais"
          >
            {isMensagensActive && (
              <span className="absolute -left-2 w-1 h-5 bg-emerald-500 rounded-r-full"></span>
            )}
            <MessageSquare strokeWidth={2.1} className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700">
              Envio de Mensagens
            </div>
          </button>

          {/* 4. Painel de Administração / Gestão (Admin ou Líder) */}
          {isAdminOrLeader && (
            <button 
              onClick={() => router.push('/admin')}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all relative group cursor-pointer ${
                isAdminActive
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm shadow-purple-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
              title={userRole === 'admin' ? 'Painel de Administração' : 'Gestão do Setor'}
            >
              {isAdminActive && (
                <span className="absolute -left-2 w-1 h-5 bg-purple-500 rounded-r-full"></span>
              )}
              <ShieldCheck strokeWidth={2.1} className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700">
                {userRole === 'admin' ? 'Painel de Administração' : 'Gestão do Setor'}
              </div>
            </button>
          )}

          <div className="w-7 h-px bg-slate-800/90 my-1"></div>
          
          {/* 5. Sino de Notificações */}
          <div className="w-full flex justify-center relative group">
            <NotificationBell />
          </div>

          {/* 6. Busca Rápida */}
          <button 
            onClick={() => {
              const term = prompt('Pesquisa rápida por tarefas ou quadros:');
              if (term) router.push(`/?search=${encodeURIComponent(term)}`);
            }}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/70 transition-all relative group cursor-pointer"
            title="Pesquisa Rápida"
          >
            <Search strokeWidth={2.1} className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700">
              Buscar
            </div>
          </button>
        </nav>

        {/* Rodapé da Barra Principal: Alternador Rápido de Tema + Perfil */}
        <div className="mt-auto flex flex-col gap-3 items-center pt-3 border-t border-slate-800/80 w-full px-2">
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group cursor-pointer border ${
              isDarkMode
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25'
                : 'bg-slate-800/70 text-amber-400 border-slate-700/80 hover:bg-slate-800'
            }`}
            title={isDarkMode ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
          >
            {isDarkMode ? (
              <Moon strokeWidth={2.1} className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            ) : (
              <Sun strokeWidth={2.1} className="w-4 h-4 group-hover:rotate-45 transition-transform" />
            )}
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700">
              {isDarkMode ? 'Tema Escuro Ativo (Clique p/ Claro)' : 'Tema Claro Ativo (Clique p/ Escuro)'}
            </div>
          </button>

          <UserProfile />
        </div>
      </aside>
      
      {/* Secondary Workspace Sidebar */}
      <Sidebar />

      {/* Main App Content View Container */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0b1120] z-10 shadow-sm relative border-l border-slate-200 dark:border-slate-800">
        {children}
      </main>
    </div>
  );
}
