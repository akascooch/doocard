import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button, buttonVariants } from '../button'
import { GlassButton } from '../glass-button'

function markup(ui: React.ReactElement) {
  return renderToStaticMarkup(ui)
}

describe('Button glass variant contract', () => {
  it('applies data-glass and glass surface tokens without a legacy white fill', () => {
    const html = markup(<Button variant="glass">ادامه</Button>)
    expect(html).toContain('data-glass')
    expect(html).toContain('glass-button')
    expect(html).toContain('bg-card')
    expect(html).toContain('text-card-foreground')
    expect(html).not.toContain(['bg', 'white'].join('-'))
  })

  it('keeps default and primary on palette tokens', () => {
    const def = buttonVariants({ variant: 'default' })
    const primary = buttonVariants({ variant: 'primary' })
    expect(def).toContain('bg-primary')
    expect(def).toContain('text-primary-foreground')
    expect(primary).toContain('bg-primary')
    expect(def).not.toContain('bg-accent')
    expect(primary).not.toContain('bg-accent')
  })

  it('disables pointer events and reduces opacity when disabled', () => {
    const html = markup(
      <Button variant="glass" disabled>
        غیرفعال
      </Button>,
    )
    expect(html).toContain('disabled')
    expect(html).toMatch(/opacity-60/)
  })

  it('GlassButton forwards to variant=glass', () => {
    const html = markup(<GlassButton>تأیید</GlassButton>)
    expect(html).toContain('data-glass')
    expect(html).toContain('bg-card')
    expect(html).toContain('type="button"')
  })
})
