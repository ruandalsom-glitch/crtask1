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

    const prompt = `Você é um Analista de Operações e Gestão de Projetos.

${scopeInfo}

INSTRUÇÕES DE ANÁLISE:
1. Leia todas as tarefas do Quadro Principal fornecidas abaixo.
2. Para cada colaborador no escopo analisado, gere um resumo objetivo das tarefas em andamento, concluídas e carga de trabalho.
3. Se houverem tarefas sem responsável (assignee_email nulo ou vazio), agrupe-as sob "Sem Colaborador Atribuído".
4. Finalize com um DASHBOARD EXECUTIVO em tabela Markdown com as colunas: Colaborador | Total de Tarefas | Em Andamento | Concluídas | Risco.
5. Formate usando Markdown profissional.

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
