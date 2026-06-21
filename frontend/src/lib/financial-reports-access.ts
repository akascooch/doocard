const TOKEN_KEY = 'financialReportsAccessToken';
const EXPIRES_KEY = 'financialReportsAccessExpiresAt';

export function getFinancialAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiresAt = sessionStorage.getItem(EXPIRES_KEY);
  if (!token || !expiresAt) return null;
  if (Date.now() > Number(expiresAt)) {
    clearFinancialAccess();
    return null;
  }
  return token;
}

export function setFinancialAccess(token: string, expiresInSeconds: number): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(
    EXPIRES_KEY,
    String(Date.now() + expiresInSeconds * 1000),
  );
}

export function clearFinancialAccess(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}

export function isFinancialAccessValid(): boolean {
  return !!getFinancialAccessToken();
}
