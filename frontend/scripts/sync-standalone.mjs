/**
 * Next.js `output: 'standalone'` does not copy `public/` or `.next/static`
 * into the runtime folder. Nginx aliases and PM2 both depend on a complete tree:
 *   .next/standalone/server.js
 *   .next/standalone/public/**
 *   .next/standalone/.next/static/**
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')
const staticSrc = join(root, '.next', 'static')
const publicSrc = join(root, 'public')

function fail(msg) {
  console.error(`[sync-standalone] ${msg}`)
  process.exit(1)
}

if (!existsSync(join(standalone, 'server.js'))) {
  fail(`missing ${join(standalone, 'server.js')} — run next build first`)
}
if (!existsSync(staticSrc)) {
  fail(`missing ${staticSrc}`)
}
if (!existsSync(publicSrc)) {
  fail(`missing ${publicSrc}`)
}

const publicDest = join(standalone, 'public')
const staticDest = join(standalone, '.next', 'static')

rmSync(publicDest, { recursive: true, force: true })
cpSync(publicSrc, publicDest, { recursive: true })

mkdirSync(join(standalone, '.next'), { recursive: true })
rmSync(staticDest, { recursive: true, force: true })
cpSync(staticSrc, staticDest, { recursive: true })

const logo = join(publicDest, 'logo', 'logo-2048.png')
if (!existsSync(logo)) {
  fail(`post-sync check failed: ${logo} missing`)
}

console.log('[sync-standalone] synced public/ and .next/static into .next/standalone')
