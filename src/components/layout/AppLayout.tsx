'use client';

import { usePathname, useRouter } from 'next/navigation';
import { UnifiedSidebar } from "@/components/layout/UnifiedSidebar";
import { useEffect, useCallback, useState } from 'react';
import { supabase, getFastUser } from '@/lib/supabaseClient';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const INACTIVITY_LIMIT = 12 * 60 * 60 * 1000; // 12 horas em ms

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

  return (
    <div className="flex h-screen overflow-hidden w-full bg-slate-50 dark:bg-[#0b0e17] text-slate-900 dark:text-slate-100">
      {/* Sidebar Única e Integrada (ClickUp/Monday Modern Style) */}
      <UnifiedSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main App Content View Container */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0b0e17] z-10 relative">
        {children}
      </main>
    </div>
  );
}
