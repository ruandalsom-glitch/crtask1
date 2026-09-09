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

Sua missão é analisar integralmente o Quadro Principal e o Calendário, cruzando todas as informações disponíveis para gerar um relatório executivo completo sobre as atividades da equipe.

${scopeInfo}

INSTRUÇÕES DE ANÁLISE:
1. Leia todas as tarefas do Quadro Principal (dados fornecidos abaixo).
2. Leia todos os eventos, reuniões, entregas e compromissos do Calendário (itens com datas e tipo lembrete/reunião).
3. Cruze as informações entre ambos para identificar:
   * Atividades planejadas, em execução, concluídas.
   * Possíveis divergências entre quadro e calendário.
   * Sobrecarga de colaboradores ou baixa demanda.
   * Entregas críticas próximas do prazo, gargalos operacionais e dependências.

4. Para cada colaborador no escopo analisado, gere uma análise individual contendo:
   - Nome/E-mail do colaborador
   - Resumo Executivo (responsabilidades, objetivos).
   - Atividades em andamento (detalhada com status, prioridade, prazo).
   - Agenda e compromissos (reuniões, entregas).
   - Análise de carga de trabalho (Baixa, Moderada, Alta, Crítica).
   - Riscos identificados.
   - Recomendações.

5. Gere uma visão consolidada da equipe (RESUMO GERAL DA SEMANA e RESUMO GERAL DO MÊS).
6. Crie uma seção de INSIGHTS GERENCIAIS (quem está sobrecarregado, capacidade ociosa, riscos, etc).
7. Finalize com um DASHBOARD EXECUTIVO em formato de tabela Markdown com as colunas: Colaborador | Nº de Tarefas | Em Andamento | Concluídas | Reuniões | Prioridade Média | Risco.
8. O relatório deve ser objetivo, analítico e gerencial. Explique o impacto das atividades.
9. Caso existam informações conflitantes, destaque-as em "Inconsistências Encontradas".
10. Formate usando Markdown, linguagem profissional e gerencial.

DADOS BRUTOS EXTRAÍDOS DO SISTEMA:
${JSON.stringify(allTasks, null, 2)}
`;

    // Tentativa em cascata para evitar instabilidade 503 dos servidores da Google
    const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"];
    let responseText = '';
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
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
