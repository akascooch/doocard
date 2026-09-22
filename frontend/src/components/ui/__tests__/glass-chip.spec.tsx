import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GlassChip } from '../glass-chip'

function markup(ui: React.ReactElement) {
  return renderToStaticMarkup(ui)
}

describe('GlassChip a11y and theme contract', () => {
  it('sets aria-pressed true when selected and false otherwise', () => {
    const selected = markup(<GlassChip selected>13:00</GlassChip>)
    const idle = markup(<GlassChip>13:00</GlassChip>)
    expect(selected).toContain('aria-pressed="true"')
    expect(idle).toContain('aria-pressed="false"')
  })

  it('omits aria-pressed when disabled', () => {
    const html = markup(
      <GlassChip selected disabled>
        13:00
      </GlassChip>,
    )
    expect(html).not.toContain('aria-pressed')
    expect(html).toContain('disabled')
  })

  it('preserves caller sr-only selected label in children', () => {
    const html = markup(
      <GlassChip selected>
        13:00
        <span className="sr-only">انتخاب شده</span>
      </GlassChip>,
    )
    expect(html).toContain('sr-only')
    expect(html).toContain('انتخاب شده')
  })

  it('exposes data-chip and glass-chip on the root button', () => {
    const html = markup(<GlassChip>13:00</GlassChip>)
    expect(html.startsWith('<button')).toBe(true)
    expect(html).toContain('data-chip')
    expect(html).toContain('glass-chip')
  })

  it('applies data-selected true only when selected', () => {
    const selected = markup(<GlassChip selected>13:00</GlassChip>)
    const idle = markup(<GlassChip>13:00</GlassChip>)
    expect(selected).toContain('data-selected="true"')
    expect(idle).toContain('data-selected="false"')
  })

  it('keeps children text and selected theme class tokens', () => {
    const html = markup(
      <GlassChip selected>
        <span aria-hidden>✓</span>
        13:00
      </GlassChip>,
    )
    expect(html).toContain('13:00')
    expect(html).toContain('✓')
    expect(html).toContain('bg-white/15')
    expect(html).toContain('ring-amber-200/80')
    expect(html).toContain('font-semibold')
  })

  it('uses idle glass token and never the solid bg-white CTA class', () => {
    const html = markup(<GlassChip>13:00</GlassChip>)
    expect(html).toContain('bg-white/5')
    expect(html).not.toMatch(/\bbg-white["\s]/)
  })
})
