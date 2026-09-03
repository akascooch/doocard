/** Server-side NestJS origin (never exposed to the browser). */
export function getBackendOrigin(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.INTERNAL_API_URL?.replace(/\/api\/?$/, '') ||
    'http://127.0.0.1:3001';
  return raw.replace(/\/$/, '').replace(/\/api$/, '');
}

export function getBackendApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getBackendOrigin()}/api${normalizedPath}`;
}
