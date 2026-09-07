'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { ShieldAlert, ShieldCheck, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (data?.role === 'admin') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  };

  // 1. Puxar todos os Workspaces
  const { data: workspaces } = useQuery({
    queryKey: ['admin_workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true
  });

  // 2. Puxar todos os Perfis (Usuários)
  const { data: profiles } = useQuery({
    queryKey: ['admin_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('email');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true
  });

  // 2.5 Puxar Membros dos Setores
  const { data: workspaceMembers } = useQuery({
    queryKey: ['admin_workspace_members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspace_members').select('*');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true
  });

  // 3. Criar novo Workspace (Setor)
  const createWorkspace = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('workspaces').insert([{ name }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_workspaces'] });
      setNewWorkspaceName('');
    },
    onError: (err: any) => {
      alert('Erro ao criar setor: ' + err.message);
    }
  });

  // 4. Adicionar/Alocar Usuário ao Workspace (Remove de qualquer outro setor anterior para garantir 1 setor por usuário)
  const addMember = useMutation({
    mutationFn: async () => {
      if (!selectedWorkspace || !selectedUser) return;
      
      // Garante exclusividade de setor para não-admins
      await supabase.from('workspace_members').delete().eq('user_id', selectedUser);
      
      const { error } = await supabase.from('workspace_members').insert([
        { workspace_id: selectedWorkspace, user_id: selectedUser, role: 'Membro' }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      alert('Usuário alocado ao setor com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin_workspace_members'] });
      setSelectedUser('');
    },
    onError: (err: any) => {
      alert('Erro ao alocar setor: ' + err.message);
    }
  });

  // 4.5 Remover Usuário do Workspace
  const removeMember = useMutation({
    mutationFn: async ({ workspace_id, user_id }: { workspace_id: string, user_id: string }) => {
      const { error } = await supabase.from('workspace_members').delete().match({ workspace_id, user_id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_workspace_members'] });
    }
  });

  // 5. Mudar permissão de usuário
  const toggleRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string, newRole: string }) => {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_profiles'] });
    }
  });

  if (isAdmin === null) return <div className="p-10 text-center">Verificando permissões...</div>;
  if (isAdmin === false) return (
    <div className="p-10 flex flex-col items-center justify-center h-screen bg-slate-50">
      <ShieldAlert className="w-20 h-20 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-slate-800">Acesso Negado</h1>
      <p className="text-slate-500 mt-2">Você não tem permissão de administrador para acessar esta página.</p>
      <a href="/" className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">Voltar ao Início</a>
    </div>
  );

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-black text-slate-800">Painel de Administração</h1>
        </div>
        <Link 
          href="/admin/reports" 
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <BarChart3 className="w-5 h-5" />
          Ver Relatórios e Insights
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Bloco 1: Criar Setor */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-700 mb-4">1. Criar Novo Setor</h2>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Ex: Comercial, Operacional"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
            />
            <button 
              onClick={() => createWorkspace.mutate(newWorkspaceName)}
              disabled={!newWorkspaceName || createWorkspace.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              Criar
            </button>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">Setores Existentes:</h3>
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg max-h-48 overflow-y-auto">
              {workspaces?.map((w: any) => (
                <li key={w.id} className="p-3 text-slate-700 flex items-center justify-between">
                  <span>{w.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bloco 2: Alocar Usuário */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-700 mb-4">2. Alocar Usuário no Setor</h2>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Selecione o Setor Exclusivo</label>
              <select 
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none"
              >
                <option value="">-- Escolha um setor --</option>
                {workspaces?.map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Selecione o Usuário</label>
              <select 
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none"
              >
                <option value="">-- Escolha um usuário --</option>
                {profiles?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.email}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => addMember.mutate()}
              disabled={!selectedWorkspace || !selectedUser || addMember.isPending}
              className="mt-2 bg-green-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 cursor-pointer"
            >
              Definir Setor deste Usuário
            </button>
          </div>

          {selectedWorkspace && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-500 mb-2">Membros alocados neste setor:</h3>
              <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg max-h-40 overflow-y-auto">
                {workspaceMembers?.filter((m: any) => m.workspace_id === selectedWorkspace).map((m: any) => {
                  const userProfile = profiles?.find((p: any) => p.id === m.user_id);
                  return (
                    <li key={m.user_id} className="p-3 text-sm text-slate-700 flex justify-between items-center">
                      <span>{userProfile?.email || 'Usuário desconhecido'}</span>
                      <button 
                        onClick={() => {
                          if(confirm('Tem certeza que deseja remover este usuário deste setor?')) {
                            removeMember.mutate({ workspace_id: selectedWorkspace, user_id: m.user_id });
                          }
                        }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors cursor-pointer"
                        title="Remover Acesso"
                      >
                        Remover
                      </button>
                    </li>
                  );
                })}
                {workspaceMembers?.filter((m: any) => m.workspace_id === selectedWorkspace).length === 0 && (
                  <li className="p-3 text-sm text-slate-400 italic">Nenhum usuário neste setor ainda.</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Bloco 3: Controle de Administradores */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
          <h2 className="text-xl font-bold text-slate-700 mb-4">3. Controle de Usuários e Permissões</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-sm">
                  <th className="pb-3 font-semibold">E-mail</th>
                  <th className="pb-3 font-semibold">Função Atual</th>
                  <th className="pb-3 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {profiles?.map((p: any) => (
                  <tr key={p.id}>
                    <td className="py-3 text-slate-700">{p.email}</td>
                    <td className="py-3">
                      <select 
                        value={p.role || 'user'} 
                        onChange={(e) => toggleRole.mutate({ userId: p.id, newRole: e.target.value })}
                        className={`px-2 py-1.5 rounded text-xs font-bold outline-none cursor-pointer border-transparent ${p.role === 'admin' ? 'bg-blue-100 text-blue-700' : p.role === 'leader' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        <option value="user" className="bg-white text-slate-700">Usuário Padrão</option>
                        <option value="leader" className="bg-white text-slate-700">Líder do Setor</option>
                        <option value="admin" className="bg-white text-slate-700">Administrador</option>
                      </select>
                    </td>
                    <td className="py-3 text-right">
                      {p.role === 'admin' && <span className="text-xs text-blue-500 font-bold">Admin (Todos os Setores)</span>}
                      {p.role === 'leader' && <span className="text-xs text-purple-500 font-bold">Líder (1 Setor Exclusivo)</span>}
                      {(p.role === 'user' || !p.role) && <span className="text-xs text-slate-400">Usuário (1 Setor Exclusivo)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
