export type VisibilityMode = 'own_only' | 'all_except_leaders' | 'all_vs_all';

export function normalizeStr(str?: string | null): string {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function isBoardOwnedByUser(
  board?: { name?: string | null; created_by?: string | null } | null,
  user?: { id?: string | null; email?: string | null } | null
): boolean {
  if (!board || !user) return false;

  // 1. Se o quadro possui created_by preenchido e é igual ao ID do usuário atual
  if (board.created_by && user.id && board.created_by === user.id) {
    return true;
  }

  // 2. Verificação baseada em e-mail / nome / apelidos
  if (user.email) {
    const userEmail = user.email;
    const normUserFirstName = normalizeStr(userEmail.split('@')[0]?.split('.')[0]);
    const normUserEmail = normalizeStr(userEmail);
    const normBoardName = normalizeStr(board.name);

    if (!normBoardName) return false;

    // Mapeamento para variações/apelidos conhecidos (ex: Estefany <-> Teffy / Tefy)
    const isTeffyMatch = 
      (normUserEmail.includes('estefany') || normUserEmail.includes('teffy')) &&
      (normBoardName.includes('estefany') || normBoardName.includes('teffy') || normBoardName.includes('tefy'));

    if (isTeffyMatch) return true;

    return (
      normBoardName === normUserFirstName ||
      normBoardName.includes(normUserFirstName) ||
      normUserFirstName.includes(normBoardName) ||
      normUserEmail.includes(normBoardName)
    );
  }

  return false;
}

export function isBoardOwnedByAnyLeaderOrAdmin(
  board: { name?: string | null; created_by?: string | null },
  profiles: { id?: string | null; email: string; role?: string | null }[]
): boolean {
  return profiles.some(p =>
    (p.role === 'leader' || p.role === 'admin') && isBoardOwnedByUser(board, p)
  );
}

export function canUserAccessBoard(options: {
  board: { name?: string | null; created_by?: string | null };
  user: { id?: string | null; email?: string | null };
  userRole?: 'admin' | 'leader' | 'user' | string | null;
  visibilityMode?: VisibilityMode | string | null;
  profiles: { id?: string | null; email: string; role?: string | null }[];
}): boolean {
  const { board, user, userRole, visibilityMode = 'own_only', profiles } = options;

  // 1. Admin e Líder possuem acesso total a todos os quadros do setor
  if (userRole === 'admin' || userRole === 'leader') {
    return true;
  }

  // 2. Se for o próprio quadro do usuário comum (por created_by ou por nome/apelido)
  if (isBoardOwnedByUser(board, user)) {
    return true;
  }

  const activeMode = visibilityMode || 'own_only';

  // 3. Ver todos x todos (Modo 'all_vs_all')
  if (activeMode === 'all_vs_all') {
    return true;
  }

  // 4. Modo 'all_except_leaders' (Todos veem todos, menos quadros dos Líderes/Admins)
  if (activeMode === 'all_except_leaders') {
    const isLeaderBoard = isBoardOwnedByAnyLeaderOrAdmin(board, profiles);
    return !isLeaderBoard;
  }

  // 5. Modo 'own_only' (Padrão: Apenas o próprio quadro)
  return false;
}
