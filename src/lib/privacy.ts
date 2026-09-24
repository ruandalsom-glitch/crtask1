export type VisibilityMode = 'own_only' | 'all_except_leaders' | 'all_vs_all';

export function normalizeStr(str?: string | null): string {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function isBoardOwnedByUser(boardName?: string | null, userEmail?: string | null): boolean {
  if (!boardName || !userEmail) return false;
  const normUserFirstName = normalizeStr(userEmail.split('@')[0]?.split('.')[0]);
  const normUserEmail = normalizeStr(userEmail);
  const normBoardName = normalizeStr(boardName);

  return (
    normBoardName === normUserFirstName ||
    normBoardName.includes(normUserFirstName) ||
    normUserFirstName.includes(normBoardName) ||
    normUserEmail.includes(normBoardName)
  );
}

export function isBoardOwnedByAnyLeaderOrAdmin(
  boardName: string,
  profiles: { email: string; role?: string | null }[]
): boolean {
  return profiles.some(p =>
    (p.role === 'leader' || p.role === 'admin') && isBoardOwnedByUser(boardName, p.email)
  );
}

export function canUserAccessBoard(options: {
  boardName: string;
  userEmail: string;
  userRole?: 'admin' | 'leader' | 'user' | string | null;
  visibilityMode?: VisibilityMode | string | null;
  profiles: { email: string; role?: string | null }[];
}): boolean {
  const { boardName, userEmail, userRole, visibilityMode = 'own_only', profiles } = options;

  // 1. Admin e Líder possuem acesso total a todos os quadros
  if (userRole === 'admin' || userRole === 'leader') {
    return true;
  }

  // 2. Se for o próprio quadro do usuário comum
  if (isBoardOwnedByUser(boardName, userEmail)) {
    return true;
  }

  const activeMode = visibilityMode || 'own_only';

  // 3. Ver todos x todos (Modo 'all_vs_all')
  if (activeMode === 'all_vs_all') {
    return true;
  }

  // 4. Modo 'all_except_leaders' (Todos veem todos, menos quadros dos Líderes/Admins)
  if (activeMode === 'all_except_leaders') {
    const isLeaderBoard = isBoardOwnedByAnyLeaderOrAdmin(boardName, profiles);
    return !isLeaderBoard;
  }

  // 5. Modo 'own_only' (Padrão: Apenas o próprio quadro)
  return false;
}
