import { QueryClient } from '@tanstack/react-query';
import { supabase, getFastUser } from './supabaseClient';
import { isBoardOwnedByUser, hasAssigneeEmail, normalizeStr } from './privacy';

/**
 * Busca todas as tarefas pertencentes ao quadro atual + tarefas criadas em outros quadros
 * (ex: quadro de um Líder) que foram compartilhadas/atribuídas ao dono deste quadro na coluna Responsável.
 */
export async function fetchBoardTasksWithShared(
  boardId: string,
  queryClient: QueryClient
): Promise<any[]> {
  // 1. Busca tarefas locais do quadro + metadados em paralelo (usando cache quando disponível)
  const cachedAccess: any = queryClient.getQueryData(['board_access_check', boardId]);
  const cachedBoardInfo: any = queryClient.getQueryData(['board_info', boardId]);
  const cachedProfiles: any[] | undefined = queryClient.getQueryData(['all_profiles']);

  const [localRes, boardMeta, profiles, currentUser] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, task_updates(id)')
      .eq('board_id', boardId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    cachedAccess?.board
      ? Promise.resolve(cachedAccess.board)
      : cachedBoardInfo?.name && cachedBoardInfo?.created_by !== undefined
      ? Promise.resolve(cachedBoardInfo)
      : supabase
          .from('boards')
          .select('id, name, workspace_id, created_by')
          .eq('id', boardId)
          .maybeSingle()
          .then(r => r.data),
    cachedProfiles
      ? Promise.resolve(cachedProfiles)
      : queryClient.fetchQuery({
          queryKey: ['all_profiles'],
          queryFn: async () => {
            const { data } = await supabase
              .from('profiles')
              .select('id, email, avatar_url, role, receive_emails')
              .order('email');
            return data || [];
          },
          staleTime: 5 * 60 * 1000
        }),
    getFastUser()
  ]);

  if (localRes.error) throw localRes.error;
  const localTasks = localRes.data || [];

  if (!boardMeta?.name) {
    return localTasks;
  }

  const normName = normalizeStr(boardMeta.name);
  const isGeneralBoard =
    normName.includes('projeto') ||
    normName.includes('panorama') ||
    normName.includes('geral');

  if (isGeneralBoard) {
    return localTasks;
  }

  // 2. Identifica o(s) e-mail(s) do colaborador dono deste quadro
  const ownerEmailSet = new Set<string>();

  for (const profile of profiles || []) {
    if (!profile?.email) continue;
    if (isBoardOwnedByUser(boardMeta, profile)) {
      const effectiveEmail =
        profile.email === 'ruan.dalsom@crexpresstransportessp.com.br'
          ? 'ruan.dalsom@masterdeliveryexpress.com.br'
          : profile.email;
      ownerEmailSet.add(effectiveEmail.trim().toLowerCase());
    }
  }

  if (currentUser?.email && isBoardOwnedByUser(boardMeta, currentUser)) {
    const effectiveEmail =
      currentUser.email === 'ruan.dalsom@crexpresstransportessp.com.br'
        ? 'ruan.dalsom@masterdeliveryexpress.com.br'
        : currentUser.email;
    ownerEmailSet.add(effectiveEmail.trim().toLowerCase());
  }

  const ownerEmails = Array.from(ownerEmailSet);
  if (ownerEmails.length === 0) {
    return localTasks;
  }

  // 3. Busca tarefas em outros quadros onde o dono deste quadro foi marcado como Responsável
  const orFilter = ownerEmails.map(email => `assignee_email.ilike.%${email}%`).join(',');

  const { data: extData, error: extError } = await supabase
    .from('tasks')
    .select('*, task_updates(id), boards:board_id(id, name, workspace_id)')
    .neq('board_id', boardId)
    .or(orFilter)
    .order('created_at', { ascending: false });

  if (extError || !extData || extData.length === 0) {
    return localTasks;
  }

  const localIds = new Set(localTasks.map((t: any) => t.id));

  const sharedTasks = extData
    .filter((t: any) => {
      if (localIds.has(t.id)) return false;
      if (t.is_routine || t.task_type === 'Rotina') return false;
      return ownerEmails.some(ownerEmail => hasAssigneeEmail(t.assignee_email, ownerEmail));
    })
    .map((t: any) => {
      const boardObj = Array.isArray(t.boards) ? t.boards[0] : t.boards;
      return {
        ...t,
        is_external: true,
        external_board_name: boardObj?.name || 'Compartilhada',
        external_board_id: boardObj?.id || t.board_id
      };
    });

  return [...localTasks, ...sharedTasks];
}

export interface RenameBoardInput {
  boardId: string;
  currentName?: string | null;
  newName: string;
  queryClient: QueryClient;
}

/**
 * Renomeia um quadro via API autenticada e atualiza os caches locais da aplicação.
 */
export async function renameBoard({
  boardId,
  currentName,
  newName,
  queryClient
}: RenameBoardInput): Promise<{ id: string; name: string; created_by?: string | null; workspace_id?: string | null }> {
  const trimmedName = newName.trim();
  if (!trimmedName) {
    throw new Error('O nome do quadro não pode ficar vazio.');
  }

  if (trimmedName === (currentName || '').trim()) {
    return { id: boardId, name: trimmedName };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente para renomear o quadro.');
  }

  const response = await fetch('/api/boards/rename', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ boardId, newName: trimmedName })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || 'Não foi possível renomear o quadro.');
  }

  const updatedBoard = result?.board || { id: boardId, name: trimmedName };

  // Atualização otimista imediata dos caches principais
  queryClient.setQueriesData({ queryKey: ['sidebar_boards'] }, (old: any) => {
    if (!Array.isArray(old)) return old;
    return old.map((b: any) => (b.id === boardId ? { ...b, name: updatedBoard.name, created_by: updatedBoard.created_by ?? b.created_by } : b));
  });

  queryClient.setQueryData(['board_access_check', boardId], (old: any) => {
    if (!old?.board) return old;
    return {
      ...old,
      board: {
        ...old.board,
        name: updatedBoard.name,
        created_by: updatedBoard.created_by ?? old.board.created_by
      }
    };
  });

  queryClient.setQueryData(['board_info', boardId], (old: any) => {
    if (!old) return old;
    return { ...old, name: updatedBoard.name };
  });

  // Invalidação em segundo plano para garantir sincronia completa entre todas as abas
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['sidebar_boards'] }),
    queryClient.invalidateQueries({ queryKey: ['board_access_check', boardId] }),
    queryClient.invalidateQueries({ queryKey: ['board_info', boardId] }),
    queryClient.invalidateQueries({ queryKey: ['board_workspace_roster', boardId] }),
    queryClient.invalidateQueries({ queryKey: ['board_workspace_shift', boardId] }),
    queryClient.invalidateQueries({ queryKey: ['workspace_overview_boards'] }),
    queryClient.invalidateQueries({ queryKey: ['workspace_overview_tasks'] }),
    queryClient.invalidateQueries({ queryKey: ['admin_boards_management'] }),
    queryClient.invalidateQueries({ queryKey: ['admin_all_tasks'] }),
    queryClient.invalidateQueries({ queryKey: ['my_work_clean'] })
  ]);

  return updatedBoard;
}
