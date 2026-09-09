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

Sua missão é analisar integralmente e com extrema precisão os dados brutos de tarefas fornecidos no formato JSON abaixo.

${scopeInfo}

REGRAS RÍGIDAS DE PRECISÃO E ANTI-ALUCINAÇÃO (OBRIGATÓRIAS):
1. NUNCA invente, crie ou presuma e-mails, nomes, cargos ou setores fictícios que não existam EXPLICITAMENTE nos DADOS BRUTOS fornecidos abaixo.
2. Referencie EXCLUSIVAMENTE os e-mails reais contidos no campo "assignee_email" das tarefas recebidas.
3. Se tarefas não tiverem responsável (assignee_email nulo ou vazio), agrupe-as estritamente sob a categoria "Sem Colaborador Atribuído".
4. Baseie 100% das contagens, métricas e análises nos dados reais da lista fornecida.

INSTRUÇÕES DE ANÁLISE:
1. Leia todas as tarefas do Quadro Principal (dados fornecidos abaixo).
2. Para cada colaborador REAL identificado no escopo analisado, gere uma análise individual contendo:
   - E-mail do colaborador real
   - Resumo Executivo das suas tarefas.
   - Atividades em andamento (detalhada com status, prioridade, prazo).
   - Análise de carga de trabalho (Baixa, Moderada, Alta, Crítica).
   - Riscos identificados.
   - Recomendações.

3. Gere uma visão consolidada da equipe (RESUMO GERAL DA SEMANA e RESUMO GERAL DO MÊS).
4. Crie uma seção de INSIGHTS GERENCIAIS (quem está sobrecarregado, capacidade ociosa, riscos).
5. Finalize com um DASHBOARD EXECUTIVO em formato de tabela Markdown com as colunas: Colaborador | Total de Tarefas | Em Andamento | Concluídas | Prioridade Média | Risco.
6. Formate usando Markdown com linguagem profissional e gerencial.

DADOS BRUTOS EXTRAÍDOS DO SISTEMA:
${JSON.stringify(allTasks, null, 2)}
`;

    // Tentativa em cascata com temperatura baixa (0.1) para evitar alucinações de nomes/e-mails
    const candidateModels = ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
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
