'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserProfile } from "@/components/layout/UserProfile";
import { Briefcase, Search, Sparkles } from "lucide-react";
import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  const INACTIVITY_LIMIT = 12 * 60 * 60 * 1000; // 12 horas em ms

  const handleLogout = useCallback(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    if (pathname === '/login') return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleLogout, INACTIVITY_LIMIT);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [pathname, handleLogout]);

  // Checagem global de Lembretes do Calendário
  useEffect(() => {
    if (pathname === '/login') return;

    const checkReminders = async () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const hours = String(today.getHours()).padStart(2, '0');
      const mins = String(today.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${mins}`;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
            if ('Notification' in window && Notification.permission === 'granted') {
              const n = new Notification('🔔 Lembrete do Calendário', {
                body: `Está na hora: ${lembrete.title}`,
                icon: '/logo.png',
              });
              n.onclick = () => {
                window.focus();
                window.location.href = `/boards/${lembrete.board_id}`;
              };
            }
          }
        });
      }
    };

    checkReminders();
    const intervalId = setInterval(checkReminders, 60000);
    
    return () => clearInterval(intervalId);
  }, [pathname]);

  if (pathname === '/login') {
    return <main className="flex-1 w-full bg-[#0a0a0a] min-h-screen">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden w-full bg-slate-900">
      {/* Primary Navigation Rail (Dark Theme - Linear / Monday Style) */}
      <aside className="w-16 bg-[#0f172a] text-slate-300 flex flex-col items-center py-4 shrink-0 z-50 relative border-r border-slate-800/80 shadow-2xl">
        <div 
          onClick={() => window.location.href = '/'}
          className="w-10 h-10 bg-slate-950 rounded-xl mb-6 flex items-center justify-center shadow-lg cursor-pointer overflow-hidden border border-slate-800 p-0.5 hover:border-indigo-500/50 hover:scale-105 transition-all group relative"
          title="CR Operacional - Início"
        >
          <img src="/logo.png" alt="CR Logo" className="w-full h-full object-contain rounded-lg" />
          <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
        
        <nav className="flex flex-col gap-4 items-center flex-1 w-full">
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full flex justify-center py-3 text-white border-l-[3px] border-indigo-500 bg-slate-800/60 transition-all relative group cursor-pointer"
            title="Espaços de Trabalho"
          >
            <Briefcase strokeWidth={2.2} className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-800">
              Espaços de Trabalho
            </div>
          </button>
          
          <div className="w-full relative group">
            <NotificationBell />
          </div>

          <button 
            onClick={() => {
              const term = prompt('Pesquisa global por tarefas ou quadros:');
              if (term) window.location.href = `/?search=${encodeURIComponent(term)}`;
            }}
            className="w-full flex justify-center py-3 text-slate-400 hover:text-white transition-all border-l-[3px] border-transparent hover:border-slate-500 relative group cursor-pointer"
            title="Pesquisa Rápida"
          >
            <Search strokeWidth={2.2} className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-800">
              Buscar (Ctrl + K)
            </div>
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4 items-center">
          <UserProfile />
        </div>
      </aside>
      
      {/* Secondary Workspace Sidebar */}
      <Sidebar />

      {/* Main App Content View Container */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 z-10 shadow-sm relative rounded-tl-2xl md:rounded-none border-l border-slate-200">
        {children}
      </main>
    </div>
  );
}
