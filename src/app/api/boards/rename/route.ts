import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isBoardOwnedByUser } from '@/lib/privacy';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Sessão não autenticada.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
    }

    const body = await req.json();
    const boardId = typeof body?.boardId === 'string' ? body.boardId.trim() : '';
    const trimmedName = typeof body?.newName === 'string' ? body.newName.trim() : '';

    if (!boardId) {
      return NextResponse.json({ error: 'ID do quadro não informado.' }, { status: 400 });
    }

    if (!trimmedName) {
      return NextResponse.json({ error: 'O nome do quadro não pode ficar vazio.' }, { status: 400 });
    }

    if (trimmedName.length > 120) {
      return NextResponse.json({ error: 'O nome do quadro deve ter no máximo 120 caracteres.' }, { status: 400 });
    }

    const dbClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } }
        });

    const [{ data: board, error: boardError }, { data: profile }] = await Promise.all([
      dbClient
        .from('boards')
        .select('id, name, created_by, workspace_id')
        .eq('id', boardId)
        .single(),
      dbClient
        .from('profiles')
        .select('id, email, role')
        .eq('id', user.id)
        .maybeSingle()
    ]);

    if (boardError || !board) {
      return NextResponse.json({ error: 'Quadro não encontrado.' }, { status: 404 });
    }

    const userRole = profile?.role || 'user';
    const userIdentity = { id: user.id, email: profile?.email || user.email || '' };
    const isOwnBoard = isBoardOwnedByUser(
      { name: board.name, created_by: board.created_by },
      userIdentity
    );

    let hasPermission = userRole === 'admin' || isOwnBoard;

    if (!hasPermission && userRole === 'leader') {
      const { data: memberWorkspaces } = await dbClient
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id);

      const allowedWorkspaces = new Set((memberWorkspaces || []).map(m => m.workspace_id));
      if (board.workspace_id && allowedWorkspaces.has(board.workspace_id)) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Você não tem permissão para renomear este quadro.' },
        { status: 403 }
      );
    }

    if (trimmedName === (board.name || '').trim()) {
      return NextResponse.json({ success: true, board });
    }

    // Preserva ou preenche created_by para evitar que o proprietário perca acesso ao renomear pelo nome
    let resolvedCreatedBy = board.created_by || null;
    if (!resolvedCreatedBy) {
      if (isOwnBoard) {
        resolvedCreatedBy = user.id;
      } else {
        const { data: allProfiles } = await dbClient
          .from('profiles')
          .select('id, email, role');

        const matchedOwner =
          (allProfiles || []).find(
            p =>
              p.email !== 'ruan.dalsom@crexpresstransportessp.com.br' &&
              isBoardOwnedByUser({ name: board.name, created_by: null }, p)
          ) ||
          (allProfiles || []).find(p =>
            isBoardOwnedByUser({ name: board.name, created_by: null }, p)
          );

        if (matchedOwner?.id) {
          resolvedCreatedBy = matchedOwner.id;
        }
      }
    }

    const updatePayload: { name: string; created_by?: string } = { name: trimmedName };
    if (resolvedCreatedBy && resolvedCreatedBy !== board.created_by) {
      updatePayload.created_by = resolvedCreatedBy;
    }

    const { data: updatedBoard, error: updateError } = await dbClient
      .from('boards')
      .update(updatePayload)
      .eq('id', boardId)
      .select('id, name, created_by, workspace_id')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Não foi possível renomear o quadro.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, board: updatedBoard });
  } catch (err: any) {
    console.error('[api/boards/rename] Erro ao renomear quadro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao renomear o quadro.' },
      { status: 500 }
    );
  }
}
