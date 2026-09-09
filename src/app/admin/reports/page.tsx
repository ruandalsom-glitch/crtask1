'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { ShieldAlert, BarChart3, ArrowLeft, PieChart as PieChartIcon, Sparkles, Filter, Copy, Check, FileText, User, Building2 } from 'lucide-react';
import Link from 'next/link';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

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

  // Buscar todos os setores (workspaces)
  const { data: workspaces } = useQuery({
    queryKey: ['admin_workspaces_reports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: hasAccess === true
  });

  // Buscar todas as tarefas com relacional boards -> workspace_id
  const { data: allTasks, isLoading } = useQuery({
    queryKey: ['admin_all_tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, priority, assignee_email, due_date, task_type, group_name, board_id, boards(workspace_id, name)');
      if (error) throw error;
      return data || [];
    },
    enabled: hasAccess === true
  });

  // Tarefas filtradas pelo setor selecionado
  const tasksInSelectedSector = selectedSector
    ? (allTasks || []).filter((t: any) => t.boards?.workspace_id === selectedSector)
    : (allTasks || []);

  // Lista de colaboradores únicos extraídos estritamente do setor selecionado
  const uniqueAssignees = Array.from(
    new Set(
      tasksInSelectedSector.flatMap((t: any) => 
        t.assignee_email ? t.assignee_email.split(',').map((e: string) => e.trim()) : []
      )
    )
  ).filter(Boolean).sort();

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
    mutationFn: async ({ allTasksData, sectorName, assigneeEmail }: { allTasksData: any[], sectorName?: string | null, assigneeEmail?: string | null }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/generate-team-insight', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ 
          allTasks: allTasksData,
          sectorName,
          assigneeEmail
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_latest_insight'] });
    },
    onError: (err: any) => {
      alert('Erro ao gerar relatório com IA: ' + err.message);
    }
  });

  const handleGenerateAiInsight = () => {
    // Filtrar tarefas segundo o setor e colaborador selecionados
    const filtered = (allTasks || []).filter((task: any) => {
      if (selectedSector) {
        const workspaceId = task.boards?.workspace_id;
        if (workspaceId !== selectedSector) return false;
      }
      if (selectedAssignee) {
        if (!task.assignee_email) return false;
        const emails = task.assignee_email.split(',').map((e: string) => e.trim());
        if (!emails.includes(selectedAssignee)) return false;
      }
      return true;
    });

    const sectorObj = workspaces?.find((w: any) => w.id === selectedSector);
    generateInsight.mutate({
      allTasksData: filtered,
      sectorName: sectorObj?.name || null,
      assigneeEmail: selectedAssignee || null
    });
  };

  const handleCopyInsight = () => {
    if (!latestInsight?.summary_text) return;
    navigator.clipboard.writeText(latestInsight.summary_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportAiPdf = () => {
    if (!latestInsight?.summary_text) return;
    
    const sectorName = workspaces?.find((w: any) => w.id === selectedSector)?.name || 'Geral / Todos os Setores';
    const assigneeLabel = selectedAssignee || 'Todos os Colaboradores';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const contentElement = document.getElementById('ai-insight-content');
    const innerHTML = contentElement ? contentElement.innerHTML : latestInsight.summary_text;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Executivo de Inteligência - CR Task</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              margin: 0;
              padding: 36px;
              color: #0f172a;
              background: #ffffff;
            }
            .header {
              border-bottom: 2px solid #4f46e5;
              padding-bottom: 16px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title {
              font-size: 22px;
              font-weight: 800;
              color: #312e81;
              margin: 0 0 6px 0;
            }
            .subtitle {
              font-size: 13px;
              color: #64748b;
              margin: 0;
            }
            .meta {
              font-size: 11px;
              color: #64748b;
              text-align: right;
            }
            .badge-container {
              display: flex;
              gap: 10px;
              margin-bottom: 24px;
            }
            .badge {
              background: #eef2ff;
              color: #4338ca;
              padding: 6px 14px;
              border-radius: 8px;
              font-size: 12px;
              font-weight: 600;
              border: 1px solid #c7d2fe;
            }
            .content {
              font-size: 13.5px;
              line-height: 1.75;
              color: #1e293b;
            }
            h1, h2, h3, h4 {
              color: #1e1b4b;
              margin-top: 22px;
              margin-bottom: 10px;
            }
            h1 { font-size: 19px; font-weight: 800; }
            h2 { font-size: 16px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            h3 { font-size: 14px; font-weight: 600; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 16px 0;
              font-size: 12.5px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background-color: #312e81;
              color: #ffffff;
              font-weight: 700;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            ul, ol {
              padding-left: 20px;
              margin: 8px 0;
            }
            li {
              margin-bottom: 4px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 16px;
              border-top: 1px solid #e2e8f0;
              font-size: 11px;
              color: #94a3b8;
              text-align: center;
            }
            @media print {
              body { padding: 0; }
              @page { margin: 1.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">✨ Relatório de Inteligência Operacional (IA)</h1>
              <p class="subtitle">CR Task • Análise Executiva de Desempenho e Capacidade da Equipe</p>
            </div>
            <div class="meta">
              <strong>Data de Geração:</strong><br />
              ${new Date(latestInsight.created_at).toLocaleString('pt-BR')}
            </div>
          </div>

          <div class="badge-container">
            <span class="badge">📍 Setor: ${sectorName}</span>
            <span class="badge">👤 Colaborador: ${assigneeLabel}</span>
          </div>

          <div class="content">
            ${innerHTML}
          </div>

          <div class="footer">
            CR Task System • Relatório Gerado via Inteligência Artificial Google Gemini
          </div>

          <script>
            setTimeout(() => {
              window.print();
            }, 600);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
        <div className="text-slate-500 font-medium p-6">Carregando dados do sistema...</div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* Sessão de Insights IA */}
          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-50 p-6 md:p-8 rounded-2xl shadow-xs border border-indigo-100">
            
            {/* Header da IA com Filtros */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-indigo-100 pb-5">
              <div>
                <h2 className="text-xl font-extrabold text-indigo-950 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-indigo-600" />
                  Resumo Inteligente da Equipe (IA)
                </h2>
                <p className="text-xs text-indigo-600/80 mt-1 font-medium">
                  Selecione os filtros abaixo para gerar um relatório analítico personalizado por setor ou colaborador.
                </p>
              </div>

              {/* Botão Gerar */}
              <button 
                onClick={handleGenerateAiInsight}
                disabled={generateInsight.isPending || allTasks?.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                {generateInsight.isPending ? 'Analisando dados com IA...' : 'Gerar Resumo por IA'}
              </button>
            </div>

            {/* Barra de Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-indigo-100/80 shadow-2xs">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  Filtrar por Setor (Workspace)
                </label>
                <select
                  value={selectedSector}
                  onChange={(e) => {
                    setSelectedSector(e.target.value);
                    setSelectedAssignee('');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="">-- Todos os Setores (Geral) --</option>
                  {workspaces?.map((ws: any) => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Filtrar por Colaborador
                </label>
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="">-- Todos os Colaboradores --</option>
                  {uniqueAssignees.map((email: string) => (
                    <option key={email} value={email}>{email}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Conteúdo do Relatório */}
            {latestInsight ? (
              <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-2xs">
                
                {/* Ações do Relatório (Copiar / PDF) */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-md border border-indigo-100">
                    Análise Concluída
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyInsight}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Copiar texto do relatório"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      {copied ? 'Copiado!' : 'Copiar Texto'}
                    </button>

                    <button
                      onClick={handleExportAiPdf}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-indigo-200"
                      title="Exportar como PDF visual formatado"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      Exportar PDF
                    </button>
                  </div>
                </div>

                {/* ReactMarkdown Formatado */}
                <div 
                  id="ai-insight-content"
                  className="prose prose-indigo max-w-none w-full text-slate-700 text-sm md:text-base leading-relaxed space-y-4 [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:bg-indigo-950 [&_th]:text-white [&_th]:p-3 [&_th]:text-xs [&_th]:font-bold [&_th]:border [&_th]:border-indigo-900 [&_td]:p-2.5 [&_td]:text-xs [&_td]:border [&_td]:border-slate-200 [&_tr:nth-child(even)]:bg-indigo-50/40 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {latestInsight.summary_text}
                  </ReactMarkdown>
                </div>

                <p className="text-xs text-slate-400 mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span>Última atualização: {new Date(latestInsight.created_at).toLocaleString('pt-BR')}</span>
                  <span className="text-[11px] text-slate-400">Powered by Google Gemini</span>
                </p>
              </div>
            ) : (
              <p className="text-indigo-400 italic text-sm">
                Nenhum resumo gerado ainda. Selecione os filtros acima e clique em "Gerar Resumo por IA".
              </p>
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
