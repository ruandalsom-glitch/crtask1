'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { ShieldAlert, ShieldCheck, BarChart3, Users, Building2, UserPlus, Trash2, Eye, Lock, Globe, UserCheck, Settings2, Check, LayoutGrid, Headset } from 'lucide-react';
import Link from 'next/link';
import { SlaManagementModal } from '@/components/board/SlaManagementModal';

const AVAILABLE_MENU_TABS = [
  {
    id: 'tabela',
    label: 'Quadro principal',
    description: 'Tabela de tarefas com colunas personalizáveis, grupos, status e responsáveis.'
  },
  {
    id: 'kanban',
    label: 'Kanban',
    description: 'Visualização ágil em colunas e cartões arrastáveis organizados por status.'
  },
  {
    id: 'calendario',
    label: 'Calendário',
    description: 'Visualização cronológica com prazos de entrega e agendamento de plantões SLA.'
  },
  {
    id: 'rotina',
    label: 'Rotinas Diárias',
    description: 'Checklist de rotinas diárias com controle por dia da semana e histórico.'
  },
  {
    id: 'escala',
    label: 'Escala',
    sublabel: '(ou Minha Escala)',
    description: 'Planejamento e visualização diária da escala operacional e operadores.'
  },
  {
    id: 'turnos',
    label: 'Quadro de turnos',
    description: 'Escala mensal oficial (Roster) com visualização e download de escala.'
  }
];

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedTabs, setSelectedTabs] = useState<string[]>(['tabela', 'kanban', 'calendario', 'rotina', 'escala', 'turnos']);
  const [isSlaManagementOpen, setIsSlaManagementOpen] = useState(false);

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

  // 1. Puxar Workspaces (Todos se for Admin, apenas os próprios se for Líder)
  const { data: workspaces } = useQuery({
    queryKey: ['admin_workspaces', userRole],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('*').order('created_at');
      if (error) throw error;
      if (userRole === 'leader') {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: members } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user?.id);
        const allowedIds = new Set(members?.map(m => m.workspace_id) || []);
        return (data || []).filter(w => allowedIds.has(w.id));
      }
      return data || [];
    },
    enabled: hasAccess
  });

  useEffect(() => {
    if (workspaces && workspaces.length > 0 && (!selectedWorkspace || !workspaces.find(w => w.id === selectedWorkspace))) {
      setSelectedWorkspace(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspace]);

  // 1.5 Puxar Workspace selecionado com suporte a modo de visibilidade
  const { data: currentWorkspace } = useQuery({
    queryKey: ['admin_current_workspace', selectedWorkspace],
    queryFn: async () => {
      if (!selectedWorkspace) return null;
      const { data } = await supabase.from('workspaces').select('*').eq('id', selectedWorkspace).single();
      return data;
    },
    enabled: !!selectedWorkspace && hasAccess
  });

  useEffect(() => {
    if (currentWorkspace) {
      let tabs: string[] = ['tabela', 'kanban', 'calendario', 'rotina', 'escala', 'turnos'];
      if (currentWorkspace.visible_tabs && Array.isArray(currentWorkspace.visible_tabs) && currentWorkspace.visible_tabs.length > 0) {
        tabs = currentWorkspace.visible_tabs;
      } else if (typeof window !== 'undefined') {
        const local = localStorage.getItem(`crtask_workspace_tabs_${currentWorkspace.id}`);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) tabs = parsed;
          } catch {}
        }
      }
      setSelectedTabs(tabs);
    }
  }, [currentWorkspace]);

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

  // 2.8 Puxar Quadros do Setor para o Bloco de Exclusão de Administrador
  const { data: adminBoards } = useQuery({
    queryKey: ['admin_boards_management', selectedWorkspace],
    queryFn: async () => {
      if (!selectedWorkspace) return [];
      const { data, error } = await supabase
        .from('boards')
        .select('id, name, created_at, created_by, workspace_id')
        .eq('workspace_id', selectedWorkspace)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedWorkspace && isAdmin
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (boardId: string) => {
      if (!isAdmin) throw new Error("Apenas administradores podem excluir quadros.");
      const { error } = await supabase.from('boards').delete().eq('id', boardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_boards_management', selectedWorkspace] });
      queryClient.invalidateQueries({ queryKey: ['sidebar_boards'] });
      alert('Quadro excluído com sucesso pelo Administrador!');
    },
    onError: (err: any) => {
      alert('Erro ao excluir quadro: ' + err.message);
    }
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

  // 4. Atualizar Modo de Privacidade do Setor
  const updateVisibilityMode = useMutation({
    mutationFn: async (mode: string) => {
      if (!selectedWorkspace) return;
      const { error } = await supabase
        .from('workspaces')
        .update({ visibility_mode: mode })
        .eq('id', selectedWorkspace);

      if (error) {
        if (error.message?.includes('visibility_mode') || error.code === '42703' || error.code === 'PGRST204') {
          throw new Error('A coluna visibility_mode ainda não foi criada no banco de dados. Execute a instrução "migration_workspace_visibility.sql" no Supabase SQL Editor.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['admin_current_workspace'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar_boards'] });
      queryClient.invalidateQueries({ queryKey: ['board_access_check'] });
      alert('Configuração de privacidade dos quadros atualizada com sucesso!');
    },
    onError: (err: any) => {
      alert('Erro ao atualizar privacidade: ' + err.message);
    }
  });

  // 4.5 Atualizar Opções do Menu (Abas Visíveis) do Setor
  const updateWorkspaceTabs = useMutation({
    mutationFn: async (tabs: string[]) => {
      if (!selectedWorkspace) return;
      if (tabs.length === 0) {
        throw new Error("Selecione pelo menos uma opção de menu para o setor.");
      }

      // Salva no localStorage como backup instantâneo
      if (typeof window !== 'undefined') {
        localStorage.setItem(`crtask_workspace_tabs_${selectedWorkspace}`, JSON.stringify(tabs));
      }

      const { error } = await supabase
        .from('workspaces')
        .update({ visible_tabs: tabs })
        .eq('id', selectedWorkspace);

      if (error) {
        if (error.message?.includes('visible_tabs') || error.code === '42703' || error.code === 'PGRST204') {
          alert(
            'Configuração de abas salva localmente com sucesso!\n\n' +
            'Para que todos os computadores e colaboradores sincronizem essa configuração pelo banco de dados, execute no Supabase SQL Editor:\n\n' +
            'ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS visible_tabs JSONB DEFAULT \'["tabela", "kanban", "calendario", "rotina", "escala", "turnos"]\'::jsonb;'
          );
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['admin_current_workspace'] });
      queryClient.invalidateQueries({ queryKey: ['all_workspaces_meta'] });
      queryClient.invalidateQueries({ queryKey: ['board_access_check'] });
      alert(`Opções do menu do setor "${selectedWorkspaceName}" atualizadas com sucesso!`);
    },
    onError: (err: any) => {
      alert('Erro ao atualizar opções de menu: ' + err.message);
    }
  });

  const handleToggleTab = (tabId: string) => {
    setSelectedTabs(prev => {
      if (prev.includes(tabId)) {
        if (prev.length <= 1) {
          alert("Pelo menos uma opção do menu deve permanecer ativa.");
          return prev;
        }
        return prev.filter(t => t !== tabId);
      } else {
        return [...prev, tabId];
      }
    });
  };

  // 5. Adicionar/Alocar Usuário ao Workspace
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

  // 5.5 Remover Usuário do Workspace
  const removeMember = useMutation({
    mutationFn: async ({ workspace_id, user_id }: { workspace_id: string, user_id: string }) => {
      const { error } = await supabase.from('workspace_members').delete().match({ workspace_id, user_id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_workspace_members'] });
    }
  });

  // 6. Mudar permissão de usuário (Apenas Admin)
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
  const activeVisibilityMode = currentWorkspace?.visibility_mode || 'own_only';

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
                {isAdmin ? 'Gerencie todos os setores, aloque membros, configure privacidade e defina permissões.' : 'Aloque membros e configure regras de privacidade dos quadros do seu setor.'}
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

          {/* Bloco 3: Regras de Privacidade e Visibilidade de Quadros no Setor */}
          {selectedWorkspace && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-600" />
                  Privacidade dos Quadros no Setor: "{selectedWorkspaceName}"
                </h2>
                <span className="text-xs px-3 py-1 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200 self-start md:self-auto">
                  Configuração de Visibilidade
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Defina como os membros comuns (`user`) enxergam os quadros dos colegas e dos líderes neste setor.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Opção 1: own_only */}
                <div 
                  onClick={() => updateVisibilityMode.mutate('own_only')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    activeVisibilityMode === 'own_only'
                      ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="p-2.5 bg-blue-100 text-blue-700 rounded-xl"><Lock className="w-5 h-5" /></span>
                      {activeVisibilityMode === 'own_only' && (
                        <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2.5 py-0.5 rounded-full">ATIVO</span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm mb-1.5">Apenas Próprio Quadro</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Cada usuário comum acessa estritamente seu próprio quadro. Líderes continuam visualizando todos os quadros.
                    </p>
                  </div>
                </div>

                {/* Opção 2: all_except_leaders */}
                <div 
                  onClick={() => updateVisibilityMode.mutate('all_except_leaders')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    activeVisibilityMode === 'all_except_leaders'
                      ? 'border-purple-600 bg-purple-50/60 shadow-xs ring-2 ring-purple-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="p-2.5 bg-purple-100 text-purple-700 rounded-xl"><UserCheck className="w-5 h-5" /></span>
                      {activeVisibilityMode === 'all_except_leaders' && (
                        <span className="text-[10px] font-extrabold bg-purple-600 text-white px-2.5 py-0.5 rounded-full">ATIVO</span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm mb-1.5">Todos Menos Líderes</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Usuários enxergam os quadros de todos os colegas do setor, <strong>exceto os quadros pertencentes aos Líderes</strong>.
                    </p>
                  </div>
                </div>

                {/* Opção 3: all_vs_all */}
                <div 
                  onClick={() => updateVisibilityMode.mutate('all_vs_all')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    activeVisibilityMode === 'all_vs_all'
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-xs ring-2 ring-emerald-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl"><Globe className="w-5 h-5" /></span>
                      {activeVisibilityMode === 'all_vs_all' && (
                        <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">ATIVO</span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm mb-1.5">Todos x Todos</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Visibilidade total no setor. Todos os usuários enxergam e navegam entre os quadros de todos os membros.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bloco: Opções do Menu e Abas dos Quadros no Setor */}
          {selectedWorkspace && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Opções do Menu e Abas dos Quadros: "{selectedWorkspaceName}"
                    </h2>
                    <p className="text-xs text-slate-500">
                      Escolha exatamente quais opções e abas de navegação estarão visíveis nos quadros deste setor.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedTabs(['tabela', 'kanban', 'calendario', 'rotina', 'escala', 'turnos'])}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    Marcar Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTabs(['tabela', 'kanban', 'calendario'])}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    Apenas Padrão (3)
                  </button>
                </div>
              </div>

              {/* Grid com os 6 cards de abas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 my-5">
                {AVAILABLE_MENU_TABS.map(tab => {
                  const isChecked = selectedTabs.includes(tab.id);
                  return (
                    <div
                      key={tab.id}
                      onClick={() => handleToggleTab(tab.id)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        isChecked 
                          ? 'border-blue-600 bg-blue-50/40 shadow-xs' 
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 opacity-75'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                            {tab.label}
                            {tab.sublabel && <span className="text-[10px] text-slate-500 font-normal">{tab.sublabel}</span>}
                          </span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            isChecked 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {isChecked ? 'VISÍVEL' : 'OCULTO'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {tab.description}
                        </p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs font-medium">
                        <span className={isChecked ? 'text-blue-700 font-semibold' : 'text-slate-400'}>
                          {isChecked ? 'Ativo no setor' : 'Inativo no setor'}
                        </span>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  {selectedTabs.length} de {AVAILABLE_MENU_TABS.length} opções habilitadas para {selectedWorkspaceName}.
                </span>
                <button
                  type="button"
                  disabled={updateWorkspaceTabs.isPending || selectedTabs.length === 0}
                  onClick={() => updateWorkspaceTabs.mutate(selectedTabs)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {updateWorkspaceTabs.isPending ? 'Salvando...' : 'Salvar Opções de Menu deste Setor'}
                </button>
              </div>
            </div>
          )}

          {/* Bloco 3.8: Gerenciamento e Exclusão de Quadros do Setor (Apenas Administrador) */}
          {isAdmin && selectedWorkspace && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-rose-600" />
                  <span>Gerenciamento e Exclusão de Quadros: "{selectedWorkspaceName}"</span>
                </h2>
                <span className="text-xs px-3 py-1 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 self-start sm:self-auto">
                  Apenas Administrador
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                Exclua quadros obsoletos ou de teste deste setor com segurança. Esta ação apaga o quadro e todas as tarefas nele contidas.
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {adminBoards && adminBoards.length > 0 ? (
                  adminBoards.map((b: any) => {
                    const creator = profiles?.find((p: any) => p.id === b.created_by || p.email === b.created_by);
                    return (
                      <div key={b.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                            <LayoutGrid className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-slate-800 truncate block">
                              {b.name}
                            </span>
                            <span className="text-xs text-slate-400 truncate block">
                              Criado por: {creator?.email || 'Sistema'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`ATENÇÃO ADMINISTRADOR:\n\nTem certeza absoluta que deseja excluir o quadro "${b.name}"?\nTodas as tarefas deste quadro serão excluídas permanentemente.`)) {
                              deleteBoardMutation.mutate(b.id);
                            }
                          }}
                          disabled={deleteBoardMutation.isPending}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                          title="Excluir quadro definitivamente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir Quadro</span>
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400 italic">
                    Nenhum quadro encontrado neste setor.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bloco 4: Controle de Funções e Permissões Globais (Apenas Admin) */}
          {isAdmin && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
              <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                4. Controle de Funções e Permissões Globais
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

          {/* Bloco Gestão de Escalas SLA de Atendimento */}
          {hasAccess && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Headset className="w-5 h-5 text-purple-600" />
                    Gestão de Escalas SLA de Atendimento
                  </h2>
                  <p className="text-xs text-slate-500">
                    Verifique os colaboradores escalados, altere plantonistas e horários ou retire escalas de atendimento SLA.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSlaManagementOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer shrink-0"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Abrir Painel Escalas SLA</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal de Gestão Administrativa de Escalas SLA */}
      <SlaManagementModal
        isOpen={isSlaManagementOpen}
        onClose={() => setIsSlaManagementOpen(false)}
      />
    </div>
  );
}
