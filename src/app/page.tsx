'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function redirectUserToAllowedSectorBoard() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/login');
          return;
        }

        // 1. Busca perfil do usuário
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        let allowedWorkspaces: any[] = [];

        if (profile?.role === 'admin') {
          // Admin tem acesso a todos os setores
          const { data } = await supabase.from('workspaces').select('*').order('created_at');
          allowedWorkspaces = data || [];
        } else {
          // Usuários/Líderes possuem acesso APENAS aos setores vinculados em workspace_members
          const { data } = await supabase
            .from('workspace_members')
            .select('workspaces(*)')
            .eq('user_id', user.id);
          
          allowedWorkspaces = data?.map((d: any) => d.workspaces).filter(Boolean) || [];
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

        // Garante compatibilidade
        localStorage.setItem('monday_active_workspace', activeWorkspace.id);

        // 3. Busca os quadros APENAS do setor ativo permitido
        const { data: boards, error: boardsError } = await supabase
          .from('boards')
          .select('id')
          .eq('workspace_id', activeWorkspace.id)
          .order('created_at')
          .limit(1);

        if (boardsError) throw boardsError;

        if (boards && boards.length > 0) {
          router.push(`/boards/${boards[0].id}`);
        } else {
          setError(`O seu setor (${activeWorkspace.name}) ainda não possui quadros criados. Peça ao líder ou administrador para criar um quadro.`);
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
    <div className="flex h-full w-full items-center justify-center bg-slate-50 p-6">
      {loading ? (
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 font-medium">Validando permissões e acessando seu setor...</p>
        </div>
      ) : (
        <div className="p-8 bg-white rounded-xl shadow-lg border border-slate-200 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso de Setor</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">{error}</p>
          <button 
            onClick={() => { supabase.auth.signOut(); window.location.href = '/login'; }} 
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Sair e Fazer Login Novamente
          </button>
        </div>
      )}
    </div>
  );
}
