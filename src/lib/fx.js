import confetti from 'canvas-confetti'

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Cheerful side + center burst for success toasts. */
export function celebrate() {
  if (prefersReducedMotion()) return

  const colors = ['#1ec8a5', '#ffe650', '#4aa3e8', '#0a0a0a', '#ffffff']

  confetti({
    particleCount: 70,
    spread: 68,
    startVelocity: 38,
    origin: { x: 0.12, y: 0.72 },
    colors,
    ticks: 180,
    gravity: 0.95,
    scalar: 0.95,
    disableForReducedMotion: true,
  })
  confetti({
    particleCount: 70,
    spread: 68,
    startVelocity: 38,
    origin: { x: 0.88, y: 0.72 },
    colors,
    ticks: 180,
    gravity: 0.95,
    scalar: 0.95,
    disableForReducedMotion: true,
  })
  window.setTimeout(() => {
    confetti({
      particleCount: 90,
      spread: 100,
      startVelocity: 32,
      origin: { x: 0.5, y: 0.35 },
      colors,
      ticks: 200,
      gravity: 0.85,
      scalar: 1.05,
      disableForReducedMotion: true,
    })
  }, 140)
}

/** Sharp red “boom” burst for error toasts. */
export function boom() {
  if (prefersReducedMotion()) return

  const colors = ['#d7263d', '#8f1024', '#ff6b6b', '#2a2a2a', '#f4a261']

  confetti({
    particleCount: 55,
    spread: 360,
    startVelocity: 48,
    decay: 0.88,
    gravity: 1.15,
    origin: { x: 0.5, y: 0.45 },
    colors,
    ticks: 120,
    scalar: 1.15,
    shapes: ['circle', 'square'],
    disableForReducedMotion: true,
  })
  window.setTimeout(() => {
    confetti({
      particleCount: 35,
      spread: 360,
      startVelocity: 28,
      decay: 0.9,
      gravity: 1.2,
      origin: { x: 0.5, y: 0.48 },
      colors,
      ticks: 90,
      scalar: 0.85,
      disableForReducedMotion: true,
    })
  }, 90)
}
