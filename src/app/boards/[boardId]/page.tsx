'use client';

import { useState, use } from 'react';
import { BoardTableView } from '@/components/board/BoardTableView';
import { BoardKanbanView } from '@/components/board/BoardKanbanView';
import { BoardCalendarView } from '@/components/board/BoardCalendarView';
import { BoardRoutineView } from '@/components/board/BoardRoutineView';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { canUserAccessBoard } from '@/lib/privacy';

export default function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'tabela' | 'kanban' | 'calendario' | 'rotina'>('tabela');

  const { data: accessCheck, isLoading } = useQuery({
    queryKey: ['board_access_check', boardId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { allowed: false, reason: 'unauthenticated' };

      // Executa as consultas de permissão em paralelo para velocidade máxima
      const [boardRes, profileRes, profilesRes] = await Promise.all([
        supabase.from('boards').select('id, name, workspace_id, created_by').eq('id', boardId).single(),
        supabase.from('profiles').select('role').eq('id', user.id).single(),
        supabase.from('profiles').select('id, email, role')
      ]);

      const board = boardRes.data;
      if (!board) return { allowed: false, reason: 'not_found' };

      // Buscar visibilidade do workspace
      const { data: workspaceRes } = await supabase
        .from('workspaces')
        .select('visibility_mode')
        .eq('id', board.workspace_id)
        .maybeSingle();

      const visibilityMode = workspaceRes?.visibility_mode || 'own_only';
      const profile = profileRes.data;
      const profiles = profilesRes.data || [];

      const allowed = canUserAccessBoard({
        board: { name: board.name, created_by: board.created_by },
        user: { id: user.id, email: user.email || '' },
        userRole: profile?.role,
        visibilityMode,
        profiles
      });

      if (allowed) {
        return { allowed: true, board };
      }

      return { allowed: false, reason: 'private_board', board };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  });

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
          <p className="text-slate-500 text-sm font-medium">Verificando permissões de acesso ao quadro...</p>
        </div>
      </div>
    );
  }

  if (accessCheck?.allowed === false) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50 p-6">
        <div className="p-8 bg-white rounded-xl shadow-lg border border-slate-200 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            ⛔
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Restrito ao Setor</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Você não possui permissão para visualizar este quadro conforme a política de privacidade configurada no seu setor. Redirecionando...
          </p>
          <button 
            onClick={() => router.push('/')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            Ir para Meu Setor
          </button>
        </div>
      </div>
    );
  }

  const boardName = accessCheck?.board?.name || 'Panorama do projeto';

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header do Quadro */}
      <div className="flex flex-col border-b border-slate-200 px-8 pt-8 pb-0 gap-6 bg-white z-20 shrink-0">
        <div className="flex justify-between items-start">
          <h1 className="text-[36px] md:text-[42px] font-bold text-[#323338] tracking-tight">{boardName}</h1>
          <button className="p-2 hover:bg-slate-100 rounded text-slate-500">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6 12a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </button>
        </div>
        
        {/* Abas Interativas e Botões */}
        <div className="flex justify-between items-end">
          <div className="flex gap-6 text-[14px] font-medium relative">
            <button 
              onClick={() => setActiveTab('tabela')}
              className={`pb-2 border-b-[3px] transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'tabela' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-[#676879] hover:text-[#323338]'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M3 9h18M9 21V9"/></svg>
              Quadro principal
            </button>

            <button 
              onClick={() => setActiveTab('kanban')}
              className={`pb-2 border-b-[3px] transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'kanban' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-[#676879] hover:text-[#323338]'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 3v18M15 3v18"/></svg>
              Kanban
            </button>
            
            <button 
              onClick={() => setActiveTab('calendario')}
              className={`pb-2 border-b-[3px] transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'calendario' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-[#676879] hover:text-[#323338]'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              Calendário
            </button>

            <button 
              onClick={() => setActiveTab('rotina')}
              className={`pb-2 border-b-[3px] transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'rotina' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-[#676879] hover:text-[#323338]'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              Rotinas Diárias
            </button>
          </div>

          <div className="flex items-center gap-4 text-[13px] text-[#676879] mb-2 font-medium">
            <button className="flex items-center gap-1.5 hover:bg-slate-100 px-2 py-1 rounded transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 005.656-5.656l-1.1 1.1"/></svg>
              Integrar
            </button>
            <button className="flex items-center gap-1.5 hover:bg-slate-100 px-2 py-1 rounded transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
              Automatizar / 2
            </button>
          </div>
        </div>
      </div>

      {/* Renderização Condicional do Conteúdo */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'tabela' ? (
          <BoardTableView boardId={boardId} />
        ) : activeTab === 'kanban' ? (
          <BoardKanbanView boardId={boardId} />
        ) : activeTab === 'rotina' ? (
          <BoardRoutineView boardId={boardId} />
        ) : (
          <BoardCalendarView boardId={boardId} />
        )}
      </div>
    </div>
  );
}
