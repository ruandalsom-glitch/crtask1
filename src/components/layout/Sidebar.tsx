'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { LayoutTemplate, Grid, ChevronLeft, ChevronDown, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { data: userProfile } = useQuery({
    queryKey: ['current_user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  const { data: workspaces } = useQuery({
    queryKey: ['sidebar_workspaces', userProfile?.id],
    queryFn: async () => {
      if (!userProfile) return [];
      
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userProfile.id).single();
      
      if (profile?.role === 'admin') {
        const { data } = await supabase.from('workspaces').select('*').order('created_at');
        return data || [];
      } else {
        const { data } = await supabase.from('workspace_members').select('workspaces(*)').eq('user_id', userProfile.id);
        return data?.map((d: any) => d.workspaces).filter(Boolean) || [];
      }
    },
    enabled: !!userProfile?.id
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

  const { data: boards, isLoading } = useQuery({
    queryKey: ['sidebar_boards', activeWorkspaceId],
    queryFn: async () => {
      if (!activeWorkspaceId) return [];
      const { data, error } = await supabase.from('boards').select('*').eq('workspace_id', activeWorkspaceId).order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!activeWorkspaceId
  });

  return (
    <div className={`relative bg-[#f7f8f9] border-slate-200 flex flex-col z-40 hidden md:flex shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-4 border-r-0 hover:bg-slate-200 cursor-pointer' : 'w-[260px] border-r'}`}
         onClick={() => isCollapsed && setIsCollapsed(false)}>
      
      {/* Botão de Toggle */}
      <button 
        onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
        className={`absolute top-6 -right-3 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 shadow-sm z-[100] transition-transform ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className={`flex flex-col h-full w-[260px] overflow-hidden transition-opacity duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="p-4 border-b border-slate-200 shrink-0 relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Setor Atual</span>
              <h2 className="font-extrabold text-[16px] tracking-tight text-[#323338] truncate w-full text-left">
                {workspaces?.find(w => w.id === activeWorkspaceId)?.name || 'Carregando...'}
              </h2>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-4 right-4 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg z-50 py-2 max-h-64 overflow-y-auto">
              <div className="px-3 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Alternar Setor</div>
              {workspaces?.map(w => (
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
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${w.id === activeWorkspaceId ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'}`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <Link 
            href="/my-work"
            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer mb-6 transition-colors w-full ${pathname === '/my-work' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            <CheckSquare className="w-5 h-5 shrink-0" />
            <span className="text-[14px]">Minhas Tarefas</span>
          </Link>

          <div className="flex items-center justify-between text-slate-500 hover:bg-slate-100 p-2 rounded-md cursor-pointer mb-2 transition-colors group shrink-0">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4" />
              <span className="text-[14px] font-medium">Meus Quadros</span>
            </div>
            <button 
              onClick={async () => {
                const name = prompt('Nome do novo quadro:');
                if (name && activeWorkspaceId) {
                  const { data, error } = await supabase.from('boards').insert([{ name, workspace_id: activeWorkspaceId }]).select();
                  if (!error && data) {
                    window.location.href = `/boards/${data[0].id}`;
                  }
                } else if (!activeWorkspaceId) {
                  alert('Selecione um setor primeiro!');
                }
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600 transition-all shrink-0"
              title="Adicionar Novo Quadro"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 4v16m8-8H4"/></svg>
            </button>
          </div>

          {isLoading ? (
            <div className="px-2 py-2 text-xs text-slate-400 shrink-0">Carregando quadros...</div>
          ) : (
            <div className="flex flex-col gap-1 shrink-0">
              {boards?.map(board => (
                <div key={board.id} className="flex items-center group/board relative shrink-0">
                  <Link 
                    href={`/boards/${board.id}`}
                    className="flex items-center gap-2 text-[#323338] hover:bg-slate-100 p-2 rounded-md cursor-pointer transition-colors w-full"
                  >
                    <Grid className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-[14px] font-medium truncate pr-8">{board.name}</span>
                  </Link>
                  <button 
                    onClick={async (e) => {
                      e.preventDefault();
                      if(confirm(`Excluir o quadro "${board.name}"? Todas as tarefas serão perdidas!`)) {
                        await supabase.from('boards').delete().eq('id', board.id);
                        window.location.href = '/'; 
                      }
                    }}
                    className="absolute right-2 opacity-0 group-hover/board:opacity-100 p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 transition-all shrink-0"
                    title="Excluir Quadro"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
