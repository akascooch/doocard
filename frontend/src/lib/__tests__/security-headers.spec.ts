import fs from 'fs';
import path from 'path';

describe('production CSP and cache headers', () => {
  const config = require(path.join(__dirname, '../../../next.config.js'));

  it('drops stale hosts from the production CSP and keeps the app and maps', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const headers = await config.headers();
      const document = headers.find(
        (entry: { source: string }) => entry.source === '/:path*',
      );
      const csp = document.headers.find(
        (header: { key: string }) => header.key === 'Content-Security-Policy',
      ).value as string;

      expect(csp).not.toContain('185.255.88.158');
      expect(csp).not.toContain('45.159.115.148');
      expect(csp).not.toContain(':3001');
      expect(csp).toContain('https://doocardbarbershop.com');
      expect(csp).toContain('https://maps.googleapis.com');
      expect(csp).toContain("'unsafe-inline'");
      expect(config.poweredByHeader).toBe(false);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('keeps HTML uncacheable and marks hashed static files immutable', async () => {
    const headers = await config.headers();
    const html = headers.find((entry: { source: string }) => entry.source === '/');
    const pages = headers.find(
      (entry: { source: string }) => entry.source === '/:path((?!_next/static|_next/image).*)',
    );
    const assets = headers.find(
      (entry: { source: string }) => entry.source === '/_next/static/:path*',
    );
    const cacheOf = (entry: { headers: Array<{ key: string; value: string }> }) =>
      entry.headers.find((header) => header.key === 'Cache-Control')?.value;

    expect(cacheOf(html)).toContain('no-store');
    expect(cacheOf(pages)).toContain('no-store');
    expect(cacheOf(assets)).toBe('public, max-age=31536000, immutable');
    expect(cacheOf(assets)).not.toContain('no-store');
  });

  it('does not embed secrets in the config source', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../../next.config.js'), 'utf8');
    expect(source).not.toMatch(/JWT_SECRET|DATABASE_URL|BEGIN (RSA |OPENSSH )?PRIVATE KEY/);
    expect(source).not.toContain('185.255.88.158');
    expect(source).not.toContain('45.159.115.148');
  });
});
