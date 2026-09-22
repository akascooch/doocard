/**
 * Phase 3 static hot-path smoke: contract checks for converted + gated controls.
 * Run: node --experimental-vm-modules ... OR via jest; this file is executed by jest-like node script.
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const failures = []

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function assert(cond, msg) {
  if (!cond) failures.push(msg)
}

// Converted — must use glass markers / tokens
const converted = [
  ['src/components/ui/alert-dialog.tsx', /data-glass|glass-button/, /bg-white text-zinc-950/],
  ['src/components/layout/DashboardShell.tsx', /variant=["']glass["']/, /border-2 border-white bg-white text-gray-900/],
  ['src/components/RoleBasedSidebar.tsx', /glass-nav-active|bg-white\/15/, /border border-white bg-white text-black/],
  ['src/components/NotificationPrompt.tsx', /variant=["']glass["']/, /border border-white bg-white text-black/],
  ['src/app/dashboard/customer/page.tsx', /variant=["']glass["']/, /className="bg-white text-black/],
  ['src/components/shop/CartSummary.tsx', /data-glass|bg-white\/5/, /bg-white px-4 text-sm font-semibold text-black/],
  ['src/components/shop/CheckoutForm.tsx', /variant=["']glass["']/, /bg-white text-black hover:bg-zinc-200/],
  ['src/app/products/page.tsx', /data-glass|bg-white\/5/, /rounded-md bg-white px-4 text-sm font-semibold text-black/],
  ['src/components/appointments/AppointmentList.tsx', /variant=["']glass["']/, /bg-green-100 text-green-800/],
  ['src/lib/glass-tokens.ts', /GLASS_SURFACE|bg-white\/5/, null],
  ['src/app/glass-exemptions.css', /--glass-bg|data-glass/, null],
]

for (const [file, must, mustNot] of converted) {
  const src = read(file)
  assert(must.test(src), `CONVERT miss: ${file} lacks ${must}`)
  if (mustNot) assert(!mustNot.test(src), `CONVERT leftover solid white: ${file}`)
}

// GATED — must keep solid white brand/auth classes
const gated = [
  ['src/app/page.tsx', /bg-white px-8 py-3\.5 text-sm font-semibold text-black/, /GATED-W-B/],
  ['src/components/landing/LandingHeader.tsx', /rounded-md bg-white px-3 text-xs font-semibold text-black/, /GATED-W-B/],
  ['src/app/login/page.tsx', /rounded-xl bg-white px-6 py-3\.5 font-semibold text-black/, /GATED-W-B/],
]

for (const [file, solid, gate] of gated) {
  const src = read(file)
  assert(solid.test(src), `GATED solid style missing (regression?): ${file}`)
  assert(gate.test(src), `GATED marker missing: ${file}`)
}

// Button default/primary not remapped
const btn = read('src/components/ui/button.tsx')
assert(/default:.*dark:bg-white/.test(btn.replace(/\s+/g, ' ')), 'default dark:bg-white missing')
assert(/primary:.*dark:bg-white/.test(btn.replace(/\s+/g, ' ')), 'primary dark:bg-white missing')
assert(/glass:/.test(btn), 'glass variant missing')

// GlassChip a11y attrs
const chip = read('src/components/ui/glass-chip.tsx')
assert(/data-chip/.test(chip) && /aria-pressed/.test(chip) && /data-glass/.test(chip), 'GlassChip attrs incomplete')
assert(/GLASS_SURFACE/.test(chip), 'GlassChip not using shared tokens')

if (failures.length) {
  console.error('SMOKE FAIL')
  failures.forEach((f) => console.error(' -', f))
  process.exit(1)
}
console.log('SMOKE PASS — converted glass + GATED solid baseline intact')
