'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { ShieldAlert, ShieldCheck, BarChart3, Users, Building2, UserPlus, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');

  const [userRole, setUserRole] = useState<'admin' | 'leader' | 'user' | null>(null);
  const [leaderWorkspaceIds, setLeaderWorkspaceIds] = useState<string[]>([]);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const role = profile?.role;

    if (role === 'admin') {
      setUserRole('admin');
    } else if (role === 'leader') {
      setUserRole('leader');
      // Buscar o setor atrelado a este líder
      const { data: memberWorkspaces } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id);
      
      const wsIds = memberWorkspaces?.map(m => m.workspace_id) || [];
      setLeaderWorkspaceIds(wsIds);
      if (wsIds.length > 0) {
        setSelectedWorkspace(wsIds[0]);
      }
    } else {
      setUserRole('user');
    }
  };

  const isAdmin = userRole === 'admin';
  const isLeader = userRole === 'leader';
  const hasAccess = isAdmin || isLeader;

  // 1. Puxar Workspaces (Todos se for Admin, apenas o próprio se for Líder)
  const { data: workspaces } = useQuery({
    queryKey: ['admin_workspaces', userRole],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('*').order('created_at');
      if (error) throw error;
      if (isLeader && leaderWorkspaceIds.length > 0) {
        return data.filter(w => leaderWorkspaceIds.includes(w.id));
      }
      return data || [];
    },
    enabled: hasAccess
  });

  // 2. Puxar todos os Perfis (Usuários)
  const { data: profiles } = useQuery({
    queryKey: ['admin_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('email');
      if (error) throw error;
      return data || [];
    },
    enabled: hasAccess
  });

  // 2.5 Puxar Membros dos Setores
  const { data: workspaceMembers } = useQuery({
    queryKey: ['admin_workspace_members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspace_members').select('*');
      if (error) throw error;
      return data || [];
    },
    enabled: hasAccess
  });

  // 3. Criar novo Workspace (Setor - Apenas Admin)
  const createWorkspace = useMutation({
    mutationFn: async (name: string) => {
      if (!isAdmin) throw new Error("Apenas administradores podem criar setores.");
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

  // 4. Adicionar/Alocar Usuário ao Workspace (Remove de qualquer outro setor anterior para não-admins para garantir 1 setor por usuário)
  const addMember = useMutation({
    mutationFn: async () => {
      if (!selectedWorkspace || !selectedUser) return;
      
      const targetUser = profiles?.find((p: any) => p.id === selectedUser);
      // Se não for admin, garante exclusividade de 1 setor
      if (targetUser?.role !== 'admin') {
        await supabase.from('workspace_members').delete().eq('user_id', selectedUser);
      }
      
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
      alert('Erro ao alocar usuário no setor: ' + err.message);
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

  // 5. Mudar permissão de usuário (Apenas Admin)
  const toggleRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string, newRole: string }) => {
      if (!isAdmin) throw new Error("Apenas administradores podem alterar funções de usuários.");
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_profiles'] });
    }
  });

  if (userRole === null) return <div className="p-10 text-center text-slate-500 font-medium">Verificando permissões...</div>;

  if (!hasAccess) {
    return (
      <div className="p-10 flex flex-col items-center justify-center h-full w-full bg-slate-50">
        <ShieldAlert className="w-20 h-20 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800">Acesso Negado</h1>
        <p className="text-slate-500 mt-2">Você precisa ter função de Líder de Setor ou Administrador para acessar esta página.</p>
        <Link href="/" className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">Voltar ao Início</Link>
      </div>
    );
  }

  const selectedWorkspaceName = workspaces?.find(w => w.id === selectedWorkspace)?.name || 'Seu Setor';

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto pb-16">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600 shrink-0" />
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-800">
                {isAdmin ? 'Painel de Administração Global' : `Gestão do Setor: ${selectedWorkspaceName}`}
              </h1>
              <p className="text-sm text-slate-500">
                {isAdmin ? 'Gerencie todos os setores, aloque membros e defina permissões.' : 'Aloque membros e gerencie a equipe vinculada ao seu setor.'}
              </p>
            </div>
          </div>
          <Link 
            href="/admin/reports" 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm text-sm shrink-0 self-start md:self-auto"
          >
            <BarChart3 className="w-4 h-4" />
            Relatórios e Insights
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Bloco 1: Criar Setor (Apenas Admin) */}
          {isAdmin && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  1. Criar Novo Setor
                </h2>
                <p className="text-xs text-slate-500 mb-4">Adicione um novo setor/workspace à organização.</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Ex: Comercial, Operacional"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm"
                  />
                  <button 
                    onClick={() => createWorkspace.mutate(newWorkspaceName)}
                    disabled={!newWorkspaceName || createWorkspace.isPending}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    Criar
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Setores Existentes:</h3>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                  {workspaces?.map((w: any) => (
                    <li key={w.id} className="p-3 text-sm text-slate-700 font-medium flex items-center justify-between">
                      <span>{w.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Bloco 2: Alocar Usuário no Setor (Admin + Líder de Setor) */}
          <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${!isAdmin ? 'md:col-span-2' : ''}`}>
            <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-600" />
              {isAdmin ? '2. Alocar Usuário no Setor' : 'Alocar Usuário no Seu Setor'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Selecione o usuário cadastrado para vincular diretamente ao setor correspondente.
            </p>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Setor Alvo</label>
                {isAdmin ? (
                  <select 
                    value={selectedWorkspace}
                    onChange={(e) => setSelectedWorkspace(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none text-sm text-slate-800 focus:border-blue-500 bg-white"
                  >
                    <option value="">-- Escolha um setor --</option>
                    {workspaces?.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm font-bold text-slate-700">
                    {selectedWorkspaceName}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Selecione o Usuário</label>
                <select 
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none text-sm text-slate-800 focus:border-blue-500 bg-white"
                >
                  <option value="">-- Escolha um usuário --</option>
                  {profiles?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.email} ({p.role === 'admin' ? 'Admin' : p.role === 'leader' ? 'Líder' : 'Membro'})</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={() => addMember.mutate()}
                disabled={!selectedWorkspace || !selectedUser || addMember.isPending}
                className="mt-2 bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
              >
                Definir Setor deste Usuário
              </button>
            </div>

            {selectedWorkspace && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Membros alocados em "{selectedWorkspaceName}":
                </h3>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                  {workspaceMembers?.filter((m: any) => m.workspace_id === selectedWorkspace).map((m: any) => {
                    const profile = profiles?.find((p: any) => p.id === m.user_id);
                    return (
                      <li key={m.user_id} className="p-3 text-sm text-slate-700 flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{profile?.email || 'Usuário desconhecido'}</span>
                          {profile?.role === 'leader' && <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">Líder</span>}
                          {profile?.role === 'admin' && <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">Admin</span>}
                        </div>
                        <button 
                          onClick={() => {
                            if(confirm(`Remover "${profile?.email}" do setor "${selectedWorkspaceName}"?`)) {
                              removeMember.mutate({ workspace_id: selectedWorkspace, user_id: m.user_id });
                            }
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                          title="Remover Acesso"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </button>
                      </li>
                    );
                  })}
                  {workspaceMembers?.filter((m: any) => m.workspace_id === selectedWorkspace).length === 0 && (
                    <li className="p-3 text-sm text-slate-400 italic">Nenhum usuário alocado neste setor ainda.</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Bloco 3: Controle de Permissões Globais (Apenas Admin) */}
          {isAdmin && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
              <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                3. Controle de Funções e Permissões Globais
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Defina o papel de cada usuário no sistema (Administrador, Líder de Setor ou Usuário Padrão).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="pb-3 font-semibold">E-mail do Usuário</th>
                      <th className="pb-3 font-semibold">Função Atribuída</th>
                      <th className="pb-3 font-semibold text-right">Escopo de Acesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {profiles?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 text-slate-800 font-medium">{p.email}</td>
                        <td className="py-3">
                          <select 
                            value={p.role || 'user'} 
                            onChange={(e) => toggleRole.mutate({ userId: p.id, newRole: e.target.value })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer border transition-colors ${p.role === 'admin' ? 'bg-blue-50 border-blue-200 text-blue-700' : p.role === 'leader' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
                          >
                            <option value="user" className="bg-white text-slate-700">Usuário Padrão</option>
                            <option value="leader" className="bg-white text-slate-700">Líder de Setor</option>
                            <option value="admin" className="bg-white text-slate-700">Administrador Global</option>
                          </select>
                        </td>
                        <td className="py-3 text-right">
                          {p.role === 'admin' && <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-md">Todos os Setores</span>}
                          {p.role === 'leader' && <span className="text-xs text-purple-600 font-bold bg-purple-50 px-2.5 py-1 rounded-md">1 Setor Exclusivo + Gestão</span>}
                          {(p.role === 'user' || !p.role) && <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-md">1 Setor Exclusivo</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
