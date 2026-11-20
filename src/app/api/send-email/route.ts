import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    // 1. Autenticação obrigatória via Bearer token do Supabase
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Sessão não autenticada.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
    }

    const dbClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } }
        });

    // 2. Verifica se o remetente é Líder ou Administrador
    const { data: senderProfile } = await dbClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const senderRole = (senderProfile?.role || 'user').toLowerCase().trim();
    const isLeaderOrAdmin = ['admin', 'administrador', 'leader', 'lider', 'líder'].includes(senderRole);

    if (!isLeaderOrAdmin) {
      return NextResponse.json(
        { error: 'Apenas Líderes e Administradores podem disparar e-mails pelo sistema.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const to = typeof body?.to === 'string' ? body.to.trim() : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const html = typeof body?.html === 'string' ? body.html : '';

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes (to, subject, html).' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(to)) {
      return NextResponse.json({ error: 'E-mail de destinatário inválido.' }, { status: 400 });
    }

    if (subject.length > 200 || html.length > 60000) {
      return NextResponse.json({ error: 'Conteúdo do e-mail excede o tamanho permitido.' }, { status: 400 });
    }

    // 3. Garante que o destinatário é um colaborador cadastrado no sistema (evita abuso de relay/spam externo)
    const { data: targetProfile } = await dbClient
      .from('profiles')
      .select('id, email, receive_emails')
      .ilike('email', to)
      .maybeSingle();

    if (!targetProfile) {
      return NextResponse.json(
        { error: 'Destinatário não encontrado na base de colaboradores cadastrados.' },
        { status: 403 }
      );
    }

    if (targetProfile.receive_emails === false) {
      return NextResponse.json({ success: true, skipped: true, reason: 'user_opted_out' });
    }

    // Configura o transportador do Nodemailer usando o Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD, // App Password do Gmail
      },
    });

    // Envia o e-mail
    const info = await transporter.sendMail({
      from: `"Master Delivery Express" <${process.env.SMTP_EMAIL}>`,
      to: targetProfile.email,
      subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Erro ao enviar e-mail:', error);
    return NextResponse.json({ error: 'Erro interno ao enviar e-mail.' }, { status: 500 });
  }
}
