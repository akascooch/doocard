'use client'

import { useEffect, useState } from 'react'

/** Lightweight CSS confetti — no new npm dependency. Runs for `durationMs`. */
export function MilestoneConfetti({
  active,
  durationMs = 60_000,
}: {
  active: boolean
  durationMs?: number
}) {
  const [pieces, setPieces] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([])

  useEffect(() => {
    if (!active) {
      setPieces([])
      return
    }
    const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ec4899']
    setPieces(
      Array.from({ length: 48 }, (_, id) => ({
        id,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        color: colors[id % colors.length],
      })),
    )
    const timer = window.setTimeout(() => setPieces([]), durationMs)
    return () => window.clearTimeout(timer)
  }, [active, durationMs])

  if (pieces.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
      aria-hidden
      data-testid="milestone-confetti"
    >
      <style>{`
        @keyframes doocard-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.2; }
        }
      `}</style>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${piece.left}%`,
            width: 8,
            height: 14,
            borderRadius: 2,
            background: piece.color,
            animation: `doocard-confetti-fall 3.2s linear ${piece.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
