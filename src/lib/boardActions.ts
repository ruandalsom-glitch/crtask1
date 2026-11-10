import { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';

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
