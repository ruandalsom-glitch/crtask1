'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getFastUser } from '@/lib/supabaseClient';
import { canUserAccessBoard } from '@/lib/privacy';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function redirectUserToAllowedSectorBoard() {
      try {
        const user = await getFastUser();
        
        if (!user) {
          router.replace('/login');
          return;
        }

        // 1. Executa TODAS as consultas em 1 único round-trip paralelo (sem esperar workspaces para buscar boards)
        const [allWorkspacesRes, membersRes, profilesRes, allBoardsRes] = await Promise.all([
          supabase.from('workspaces').select('*').order('created_at'),
          supabase.from('workspace_members').select('workspaces(*)').eq('user_id', user.id),
          supabase.from('profiles').select('id, email, role'),
          supabase.from('boards').select('id, name, created_by, workspace_id').order('created_at')
        ]);

        const profiles = profilesRes.data || [];
        const profile = profiles.find((p: any) => p.id === user.id || p.email === user.email);
        let allowedWorkspaces: any[] = [];

        if (profile?.role === 'admin') {
          allowedWorkspaces = allWorkspacesRes.data || [];
        } else {
          allowedWorkspaces = membersRes.data?.map((d: any) => d.workspaces).filter(Boolean) || [];
        }

        if (allowedWorkspaces.length === 0) {
          setError('Você não possui acesso a nenhum setor. Solicite ao administrador do sistema para incluir seu usuário no setor correto.');
          setLoading(false);
          return;
        }

        // 2. Determina o setor ativo seguro (vinculado ao ID do usuário)
        const storageKey = `monday_active_workspace_${user.id}`;
        let activeWorkspace = allowedWorkspaces.find((w: any) => w.id === localStorage.getItem(storageKey));

        if (!activeWorkspace) {
          activeWorkspace = allowedWorkspaces[0];
          localStorage.setItem(storageKey, activeWorkspace.id);
        }

        localStorage.setItem('monday_active_workspace', activeWorkspace.id);

        // 3. Filtra os quadros do setor ativo em memória (0ms extra de rede)
        const boards = (allBoardsRes.data || []).filter((b: any) => b.workspace_id === activeWorkspace.id);
        const visibilityMode = activeWorkspace.visibility_mode || 'own_only';

        const allowedBoards = boards.filter(board =>
          canUserAccessBoard({
            board: { name: board.name, created_by: board.created_by },
            user: { id: user.id, email: user.email || '' },
            userRole: profile?.role,
            visibilityMode,
            profiles
          })
        );

        if (allowedBoards.length > 0) {
          router.replace(`/boards/${allowedBoards[0].id}`);
        } else {
          setError(`Você não possui quadros visíveis no seu setor (${activeWorkspace.name}). Caso ache que isso é um engano, entre em contato com o seu líder.`);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Erro de redirecionamento:', err);
        setError(err.message || 'Erro ao carregar dados do seu setor.');
        setLoading(false);
      }
    }

    redirectUserToAllowedSectorBoard();
  }, [router]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 dark:bg-[#0b0e17] text-slate-900 dark:text-slate-100 p-6">
      {loading ? (
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 dark:border-indigo-500/30 dark:border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Validando permissões e acessando seu setor...</p>
        </div>
      ) : (
        <div className="p-8 bg-white dark:bg-[#131929] rounded-xl shadow-lg border border-slate-200 dark:border-white/[0.08] max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Acesso de Setor</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-4">{error}</p>
          <button 
            onClick={() => { supabase.auth.signOut(); window.location.href = '/login'; }} 
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Sair e Fazer Login Novamente
          </button>
        </div>
      )}
    </div>
  );
}
