import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(request: Request) {
  try {
    // 1. Proteção obrigatória: aceita CRON_SECRET (Vercel Cron) OU token de Administrador autenticado
    const authHeader = request.headers.get('Authorization') || '';
    const cronSecret = process.env.CRON_SECRET;

    let authorized = false;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      authorized = true;
    } else if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user } } = await authClient.auth.getUser(token);
      if (user?.id) {
        const adminCheck = createClient(supabaseUrl, supabaseServiceKey);
        const { data: prof } = await adminCheck
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (prof?.role === 'admin') {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Acesso não autorizado ao Cron.' }, { status: 401 });
    }

    // Usa a chave Service Role (que tem poder de admin) para ler tarefas de todos os workspaces
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Busca todos os usuários
    const { data: profiles, error: profilesError } = await supabaseAdmin.from('profiles').select('*');
    if (profilesError) throw profilesError;

    // Busca todas as tarefas
    const { data: tasks, error: tasksError } = await supabaseAdmin.from('tasks').select('*, boards(name)');
    if (tasksError) throw tasksError;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    let sentCount = 0;
    let errorCount = 0;

    // Para cada usuário, filtra as tarefas dele
    for (const profile of profiles) {
      if (!profile.email || profile.receive_emails === false) continue;

      const userTasks = tasks.filter((t: any) =>
        t.assignee_email &&
        t.assignee_email
          .split(',')
          .map((e: string) => e.trim().toLowerCase())
          .includes(profile.email.trim().toLowerCase()) &&
        t.status !== 'Feito' &&
        t.status !== 'Concluído'
      );

      if (userTasks.length === 0) continue;

      const overdueTasks = userTasks.filter((t: any) => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
      });

      const todayTasks = userTasks.filter((t: any) => {
        if (!t.due_date) return false;
        return new Date(t.due_date).toDateString() === new Date().toDateString();
      });

      // Se não tiver nada atrasado ou pra hoje, nem manda e-mail para não encher a caixa
      if (overdueTasks.length === 0 && todayTasks.length === 0) continue;

      const html = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #0073ea; margin-bottom: 5px;">Seu Resumo Diário</h2>
          <p style="margin-top: 0; color: #666;">Olá! Aqui está o resumo das suas tarefas no Master Delivery Express.</p>
          
          ${overdueTasks.length > 0 ? `
            <div style="background-color: #ffe6e6; padding: 15px; border-left: 4px solid #ff3333; border-radius: 4px; margin-bottom: 20px;">
              <h3 style="color: #cc0000; margin-top: 0;">🔴 Tarefas Atrasadas (${overdueTasks.length})</h3>
              <ul style="padding-left: 20px; margin-bottom: 0;">
                ${overdueTasks.map((t: any) => `<li><b>${escapeHtml(t.title)}</b> (Quadro: ${escapeHtml(t.boards?.name || 'Desconhecido')})</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${todayTasks.length > 0 ? `
            <div style="background-color: #e6f7ff; padding: 15px; border-left: 4px solid #0073ea; border-radius: 4px; margin-bottom: 20px;">
              <h3 style="color: #0073ea; margin-top: 0;">🔵 Vencem Hoje (${todayTasks.length})</h3>
              <ul style="padding-left: 20px; margin-bottom: 0;">
                ${todayTasks.map((t: any) => `<li><b>${escapeHtml(t.title)}</b> (Quadro: ${escapeHtml(t.boards?.name || 'Desconhecido')})</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <p style="margin-top: 30px; font-size: 12px; color: #999;">
            Este é um e-mail automático enviado pelo seu sistema de gestão.
          </p>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: `"Master Delivery" <${process.env.SMTP_EMAIL}>`,
          to: profile.email,
          subject: `Resumo Diário - Você tem ${overdueTasks.length + todayTasks.length} tarefas precisando de atenção`,
          html,
        });
        sentCount++;
      } catch (err) {
        console.error('Erro ao enviar resumo diário:', err);
        errorCount++;
      }
    }

    return NextResponse.json({ success: true, sent: sentCount, errors: errorCount });
  } catch (error: any) {
    console.error('CRON Error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar o resumo diário.' }, { status: 500 });
  }
}
