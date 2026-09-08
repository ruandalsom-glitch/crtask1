'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { ShieldAlert, BarChart3, ArrowLeft, PieChart as PieChartIcon, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (data?.role === 'admin' || data?.role === 'leader') {
      setHasAccess(true);
    } else {
      setHasAccess(false);
    }
  };

  // Buscar todas as tarefas
  const { data: allTasks, isLoading } = useQuery({
    queryKey: ['admin_all_tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('id, title, status, priority, assignee_email, due_date, task_type, group_name');
      if (error) throw error;
      return data || [];
    },
    enabled: hasAccess === true
  });

  // Buscar último insight gerado
  const { data: latestInsight, isLoading: isLoadingInsight } = useQuery({
    queryKey: ['admin_latest_insight'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('type', 'team_summary')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 é "not found"
      return data;
    },
    enabled: hasAccess === true
  });

  const generateInsight = useMutation({
    mutationFn: async ({ allTasksData }: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/generate-team-insight', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ allTasks: allTasksData })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_latest_insight'] });
    },
    onError: (err: any) => {
      alert('Erro ao gerar insight: ' + err.message + '\nVerifique se a GEMINI_API_KEY está configurada no .env.local');
    }
  });

  if (hasAccess === null) return <div className="p-10 text-center text-slate-500 font-medium">Verificando permissões...</div>;
  if (hasAccess === false) return (
    <div className="p-10 flex flex-col items-center justify-center h-full w-full bg-slate-50">
      <ShieldAlert className="w-20 h-20 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-slate-800">Acesso Negado</h1>
      <p className="text-slate-500 mt-2">Você precisa ter função de Líder de Setor ou Administrador para acessar os relatórios.</p>
      <Link href="/" className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">Voltar ao Início</Link>
    </div>
  );

  const totalTasks = allTasks?.length || 0;
  const completedTasks = allTasks?.filter(t => t.status === 'Feito').length || 0;
  const pendingTasks = totalTasks - completedTasks;

  const statusCounts = allTasks?.reduce((acc: any, task: any) => {
    const status = task.status || 'Pendente';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const pieData = statusCounts ? Object.keys(statusCounts).map(key => ({
    name: key,
    value: statusCounts[key]
  })) : [];

  const userStats = allTasks?.reduce((acc: any, task: any) => {
    if (!task.assignee_email) return acc;
    const emails = task.assignee_email.split(',').map((e: string) => e.trim()).filter(Boolean);
    emails.forEach((email: string) => {
      const username = email.split('@')[0];
      if (!acc[username]) {
        acc[username] = { name: username, concluido: 0, pendente: 0 };
      }
      if (task.status === 'Feito') {
        acc[username].concluido += 1;
      } else {
        acc[username].pendente += 1;
      }
    });
    return acc;
  }, {});

  const barData = userStats ? Object.values(userStats).sort((a: any, b: any) => (b.concluido + b.pendente) - (a.concluido + a.pendente)).slice(0, 10) : [];

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto pb-16">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors shadow-xs" title="Voltar ao Painel Admin">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl md:text-3xl font-black text-slate-800">Relatórios e Insights do Time</h1>
        </div>
      
      {isLoading ? (
        <div className="text-slate-500">Carregando dados...</div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* Sessão de Insights IA */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl shadow-sm border border-indigo-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-indigo-600" />
                Resumo Inteligente (IA)
              </h2>
              <button 
                onClick={() => generateInsight.mutate({ allTasksData: allTasks })}
                disabled={generateInsight.isPending || allTasks?.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {generateInsight.isPending ? 'Analisando dados...' : 'Gerar Novo Resumo'}
              </button>
            </div>
            
            {latestInsight ? (
              <div className="text-slate-700 text-sm md:text-base leading-relaxed space-y-4">
                <div className="prose prose-indigo max-w-none w-full">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {latestInsight.summary_text}
                  </ReactMarkdown>
                </div>
                <p className="text-xs text-slate-400 mt-4 pt-4 border-t border-indigo-200/50">
                  Última atualização: {new Date(latestInsight.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ) : (
              <p className="text-indigo-400 italic">Nenhum resumo gerado ainda. Clique no botão acima para a IA analisar a equipe.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-slate-500 font-semibold mb-2">Total de Tarefas Cadastradas</h2>
              <p className="text-5xl font-black text-slate-800">{totalTasks}</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200 relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-emerald-600 font-semibold mb-2">Tarefas Concluídas (Feito)</h2>
                <p className="text-5xl font-black text-emerald-600">{completedTasks}</p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <PieChartIcon className="w-32 h-32 text-emerald-600" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-200">
              <h2 className="text-orange-600 font-semibold mb-2">Tarefas Pendentes / Em andamento</h2>
              <p className="text-5xl font-black text-orange-600">{pendingTasks}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-blue-500" />
                Status das Tarefas
              </h2>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                      {pieData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Feito' ? '#10b981' : entry.name === 'Travado' ? '#ef4444' : entry.name === 'Trabalhando' ? '#f59e0b' : '#3b82f6'} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                Carga de Trabalho por Usuário (Top 10)
              </h2>
              <div className="h-[350px] w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height="100%" minWidth={500}>
                  <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend />
                    <Bar dataKey="concluido" name="Concluídas" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="pendente" name="Pendentes" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
