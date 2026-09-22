import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button, buttonVariants } from '../button'
import { GlassButton } from '../glass-button'

function markup(ui: React.ReactElement) {
  return renderToStaticMarkup(ui)
}

describe('Button glass variant contract', () => {
  it('applies data-glass and glass surface tokens without solid bg-white', () => {
    const html = markup(<Button variant="glass">ادامه</Button>)
    expect(html).toContain('data-glass')
    expect(html).toContain('glass-button')
    expect(html).toContain('bg-white/5')
    expect(html).toContain('backdrop-blur-md')
    expect(html).not.toMatch(/\bbg-white["\s]/)
  })

  it('keeps default and primary solid dark:bg-white (no blanket remap)', () => {
    const def = buttonVariants({ variant: 'default' })
    const primary = buttonVariants({ variant: 'primary' })
    expect(def).toContain('dark:bg-white')
    expect(primary).toContain('dark:bg-white')
    expect(def).not.toContain('bg-white/5')
    expect(primary).not.toContain('bg-white/5')
  })

  it('disables pointer events and reduces opacity when disabled', () => {
    const html = markup(
      <Button variant="glass" disabled>
        غیرفعال
      </Button>,
    )
    expect(html).toContain('disabled')
    expect(html).toMatch(/opacity-40|opacity-50/)
  })

  it('GlassButton forwards to variant=glass', () => {
    const html = markup(<GlassButton>تأیید</GlassButton>)
    expect(html).toContain('data-glass')
    expect(html).toContain('bg-white/5')
    expect(html).toContain('type="button"')
  })
})
