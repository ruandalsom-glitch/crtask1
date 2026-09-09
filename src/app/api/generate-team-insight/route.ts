import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Acesso negado. Token não fornecido.' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
    }

    const { allTasks, sectorName, assigneeEmail } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave da API do Gemini não configurada' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    let scopeInfo = 'ESCOPO DE ANÁLISE: Visão Geral de Todos os Setores e Colaboradores.';
    if (sectorName && assigneeEmail) {
      scopeInfo = `ESCOPO DE ANÁLISE: Focado no Setor "${sectorName}" e especificamente no Colaborador "${assigneeEmail}".`;
    } else if (sectorName) {
      scopeInfo = `ESCOPO DE ANÁLISE: Focado exclusivamente no Setor "${sectorName}".`;
    } else if (assigneeEmail) {
      scopeInfo = `ESCOPO DE ANÁLISE: Focado exclusivamente no Colaborador "${assigneeEmail}".`;
    }

    const prompt = `Você é um Analista Sênior de Operações e Gestão de Projetos.

Sua missão é realizar uma análise detalhada, analítica e aprofundada das atividades do sistema, fornecendo um Relatório Executivo de Inteligência completo para a liderança.

${scopeInfo}

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

1. INTRODUÇÃO EXECUTIVA
   - Contextualização do setor e escopo de análise.
   - Metodologia de análise cruzando dados brutos do quadro de tarefas.

2. ANÁLISE INDIVIDUAL DO COLABORADOR (Para cada colaborador no escopo)
   - Nome / E-mail do Colaborador.
   - Resumo Executivo: Papel estratégico e responsabilidades do colaborador.
   - Atividades em Andamento: Título, status, prioridade, prazo e o IMPACTO operacional/estratégico detalhado de cada tarefa.
   - Atividades Concluídas Recentemente: Histórico detalhado das últimas entregas com datas, prioridade e colaboradores compartilhados.
   - Agenda e Compromissos: Reuniões e compromissos identificados no quadro.
   - Análise de Carga de Trabalho: Avaliação detalhada do passado recente, estado atual e nível de carga (Baixa, Moderada, Alta ou Crítica).
   - Riscos Identificados: Lista numerada detalhada de 3 a 4 riscos operacionais específicos.
   - Recomendações: Lista numerada detalhada de 3 a 4 ações gerenciais recomendadas.

3. INCONSISTÊNCIAS ENCONTRADAS
   - Destaque de prazos genéricos, ausência de datas de vencimento ou dependências não mapeadas.

4. VISÃO CONSOLIDADA DA EQUIPE
   - Resumo Geral da Semana.
   - Resumo Geral do Mês.

5. INSIGHTS GERENCIAIS
   - Análise de Capacidade Ociosa vs. Carga de Trabalho Oculta.
   - Gestão de Prazos e Gargalos.
   - Colaboração e Interdependências entre membros da equipe.

6. DASHBOARD EXECUTIVO (Tabela Markdown)
   - Tabela formatada em Markdown com as colunas: Colaborador | Nº de Tarefas | Em Andamento | Concluídas | Reuniões | Prioridade Média | Risco.

7. CONCLUSÃO
   - Síntese final com orientações estratégicas para a gestão.

REGRAS DE PRECISÃO:
- Use exclusivamente as tarefas e e-mails reais presentes nos DADOS BRUTOS abaixo.
- Caso existam tarefas sem e-mail atribuído (assignee_email nulo ou vazio), agrupe-as sob "Sem Colaborador Atribuído".

DADOS BRUTOS EXTRAÍDOS DO SISTEMA:
${JSON.stringify(allTasks, null, 2)}
`;

    // Tentativa em cascata priorizando gemini-3.6-flash para analises detalhadas
    const candidateModels = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
    let responseText = '';
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: { temperature: 0.1 }
        });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        if (responseText) break;
      } catch (err: any) {
        console.warn(`[Gemini API Warning] Falha no modelo ${modelName}:`, err.message);
        lastError = err;
      }
    }

    if (!responseText) {
      if (lastError?.message?.includes('503') || lastError?.status === 503) {
        return NextResponse.json({ 
          error: 'A API do Google Gemini está passando por uma alta demanda temporária nos servidores da Google. Por favor, aguarde alguns segundos e tente clicar novamente.' 
        }, { status: 503 });
      }
      throw lastError || new Error('Não foi possível gerar a resposta com os modelos disponíveis.');
    }

    // Salvar no banco
    const { data, error } = await supabase.from('ai_insights').insert([
      { summary_text: responseText, type: 'team_summary' }
    ]).select();

    if (error) {
      console.error('Erro ao salvar no supabase:', error);
      throw error;
    }

    return NextResponse.json({ success: true, insight: data[0] });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
