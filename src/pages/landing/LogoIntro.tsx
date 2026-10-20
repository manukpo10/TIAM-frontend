import { Fragment, useEffect, useRef, useState } from 'react'
import logoImg from '@/assets/logogrande-sinfondo.png'

/**
 * The TIAM logo putting itself together the first time the home opens in a visit: the two heads drop in, the
 * arcs sweep across, the letters rise with what they stand for (Taller Interactivo de Adultos Mayores) under them,
 * and then the logo flies to its place in the header while the page shows through. Pure decoration: once per browser session, never with reduced motion, and a tap, a key or a scroll
 * ends it at once.
 *
 * Every piece is the SAME logo file the header already shows, cut out with clip-path: the intro downloads
 * nothing extra and its pieces can never drift from the real logo.
 */

const SEEN_KEY = 'tiam_logo_intro_seen'

// Boxes of the logo's shapes in the source image (606 × 339 px): left, top, right, bottom. Found by splitting
// the PNG into its connected shapes; the two arcs overlap, so they move as one piece.
const SRC_W = 606
const SRC_H = 339
type Box = readonly [number, number, number, number]
const HEAD_ORANGE: Box = [161, 0, 242, 80]
const HEAD_BLUE: Box = [366, 0, 448, 80]
const ARCS: Box = [87, 82, 540, 160]
const LETTERS: readonly Box[] = [
  [0, 178, 138, 339], // T
  [151, 178, 202, 339], // I
  [216, 178, 389, 339], // A
  [401, 177, 606, 339], // M
]

// What the letters stand for, each initial in the colour of its letter in the logo (sampled from the PNG).
const NAME_WORDS: readonly { initial: string; rest: string; color?: string }[] = [
  { initial: 'T', rest: 'aller', color: '#FD4C00' },
  { initial: 'I', rest: 'nteractivo', color: '#62B519' },
  { initial: '', rest: 'de' },
  { initial: 'A', rest: 'dultos', color: '#0041B5' },
  { initial: 'M', rest: 'ayores', color: '#0041B5' },
]

const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(3)}%`
const clipOf = ([l, t, r, b]: Box) => `inset(${pct(t, SRC_H)} ${pct(SRC_W - r, SRC_W)} ${pct(SRC_H - b, SRC_H)} ${pct(l, SRC_W)})`
/** The arcs' box squeezed to nothing on its left edge: the start of the sweep. */
const clipCollapsedLeft = ([l, t, , b]: Box) => clipOf([l, t, l, b])
const centerOf = ([l, t, r, b]: Box) => `${pct((l + r) / 2, SRC_W)} ${pct((t + b) / 2, SRC_H)}`

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_BOUNCE = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)'

function shouldPlay(): boolean {
  if (typeof window === 'undefined' || typeof Element.prototype.animate !== 'function') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return sessionStorage.getItem(SEEN_KEY) === null
  } catch {
    return false // storage blocked: better no intro than one on every visit
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

export function LogoIntro() {
  const [playing, setPlaying] = useState(shouldPlay)
  const overlayRef = useRef<HTMLDivElement>(null)
  // The white backdrop is its own layer: fading it shows the page while the logo, above it, stays solid in flight.
  const backdropRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const headsRef = useRef<(HTMLImageElement | null)[]>([])
  const arcsRef = useRef<HTMLImageElement>(null)
  const lettersRef = useRef<(HTMLImageElement | null)[]>([])
  const nameRef = useRef<HTMLParagraphElement>(null)
  const wordsRef = useRef<(HTMLSpanElement | null)[]>([])
  // Set by the effect: ends the intro right away (tap, key or scroll).
  const skipRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!playing) return
    const overlay = overlayRef.current
    const backdrop = backdropRef.current
    const logo = logoRef.current
    const arcs = arcsRef.current
    if (!overlay || !backdrop || !logo || !arcs) return
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      // Storage blocked: shouldPlay already returned false in that case.
    }

    let stopped = false
    // Once the logo is flying the overlay is already fading: a skip then just lands it.
    let flying = false
    const running: Animation[] = []
    const headerLogo = document.querySelector<HTMLElement>('[data-brand-logo]')
    const play = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = el.animate(keyframes, { fill: 'both', ...options })
      running.push(animation)
      return animation
    }
    // Whatever happens (an old browser, a stalled animation), the white screen never stays over the home.
    const failSafe = window.setTimeout(() => skipRef.current(), 8000)
    const done = () => {
      window.clearTimeout(failSafe)
      if (headerLogo) headerLogo.style.visibility = ''
      setPlaying(false)
    }

    skipRef.current = () => {
      if (stopped) return
      stopped = true
      running.forEach((animation) => animation.finish())
      if (flying) {
        done()
        return
      }
      overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE_OUT, fill: 'forwards' })
        .finished.then(done, done)
    }

    async function run() {
      // The header already asked for this file, so it is usually decoded by now; never hold a white screen for it.
      const image = new Image()
      image.src = logoImg
      await Promise.race([image.decode(), wait(1200).then(() => Promise.reject(new Error('slow logo')))])
      if (stopped || !overlay || !backdrop || !logo || !arcs) return

      // 1. The heads drop in, the blue one a beat after the orange one.
      headsRef.current.forEach((head, i) => {
        if (!head) return
        play(head, [
          { opacity: 0, transform: 'translateY(-40%) scale(0.5)' },
          { opacity: 1, transform: 'none' },
        ], { duration: 560, delay: i * 120, easing: EASE_BOUNCE })
      })
      // 2. The arcs sweep in from the left, like a brush stroke.
      play(arcs, [
        { opacity: 0, clipPath: clipCollapsedLeft(ARCS) },
        { opacity: 1, clipPath: clipOf(ARCS), offset: 0.15 },
        { opacity: 1, clipPath: clipOf(ARCS) },
      ], { duration: 640, delay: 300, easing: EASE_OUT })
      // 3. The letters rise one after the other.
      lettersRef.current.forEach((letter, i) => {
        if (!letter) return
        play(letter, [
          { opacity: 0, transform: 'translateY(18%)' },
          { opacity: 1, transform: 'none' },
        ], { duration: 480, delay: 620 + i * 80, easing: EASE_OUT })
      })
      // 4. Under it, what TIAM stands for, word by word.
      wordsRef.current.forEach((word, i) => {
        if (!word) return
        play(word, [
          { opacity: 0, transform: 'translateY(40%)' },
          { opacity: 1, transform: 'none' },
        ], { duration: 420, delay: 920 + i * 90, easing: EASE_OUT })
      })
      await Promise.all(running.map((animation) => animation.finished))
      if (stopped) return

      // 5. A small breath once it is whole, and a moment to read the name.
      await play(logo, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }],
        { duration: 420, easing: EASE_IN_OUT, fill: 'none' }).finished
      await wait(600)
      if (stopped) return

      // 6. Off to the header: the logo shrinks into the header's own logo while the page shows through.
      const from = logo.getBoundingClientRect()
      const to = headerLogo?.getBoundingClientRect()
      flying = true
      if (nameRef.current) play(nameRef.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: EASE_OUT })
      const fade = play(backdrop, [{ opacity: 1 }, { opacity: 0 }], { duration: 560, delay: 140, easing: EASE_OUT })
      if (headerLogo && to && to.width > 0 && to.bottom > 0) {
        headerLogo.style.visibility = 'hidden'
        logo.style.transformOrigin = '0 0'
        await play(logo, [
          { transform: 'none' },
          { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})` },
        ], { duration: 720, easing: EASE_IN_OUT }).finished
      } else {
        // No header logo to land on: just fade away.
        play(logo, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.9)' }],
          { duration: 420, easing: EASE_OUT })
      }
      await fade.finished
      if (!stopped) done()
    }

    run().catch(() => {
      if (stopped) return
      stopped = true
      running.forEach((animation) => animation.cancel())
      done()
    })

    const onKey = () => skipRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      stopped = true
      window.clearTimeout(failSafe)
      window.removeEventListener('keydown', onKey)
      running.forEach((animation) => animation.cancel())
      if (headerLogo) headerLogo.style.visibility = ''
    }
  }, [playing])

  if (!playing) return null

  // The pieces start hidden (inline opacity 0) so nothing shows before their animation takes over.
  const pieceClass = 'absolute inset-0 h-full w-full select-none'
  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      onPointerDown={() => skipRef.current()}
      onWheel={() => skipRef.current()}
      onTouchMove={() => skipRef.current()}
      className="fixed inset-0 z-[70] grid place-items-center"
    >
      <div ref={backdropRef} className="absolute inset-0 bg-white" />
      <div className="relative flex flex-col items-center px-6">
        <div ref={logoRef} className="relative aspect-[606/339] w-[min(72vw,420px)]">
          {[HEAD_ORANGE, HEAD_BLUE].map((box, i) => (
            <img
              key={i}
              ref={(el) => { headsRef.current[i] = el }}
              src={logoImg}
              alt=""
              draggable={false}
              className={pieceClass}
              style={{ clipPath: clipOf(box), transformOrigin: centerOf(box), opacity: 0 }}
            />
          ))}
          <img
            ref={arcsRef}
            src={logoImg}
            alt=""
            draggable={false}
            className={pieceClass}
            style={{ clipPath: clipOf(ARCS), opacity: 0 }}
          />
          {LETTERS.map((box, i) => (
            <img
              key={i}
              ref={(el) => { lettersRef.current[i] = el }}
              src={logoImg}
              alt=""
              draggable={false}
              className={pieceClass}
              style={{ clipPath: clipOf(box), transformOrigin: centerOf(box), opacity: 0 }}
            />
          ))}
        </div>
        {/* Words as inline-blocks so each one can rise on its own; the spaces between them stay real text. */}
        <p
          ref={nameRef}
          className="mt-6 text-center font-display text-lg font-semibold text-slate-600 text-balance sm:mt-8 sm:text-2xl"
        >
          {NAME_WORDS.map((word, i) => (
            <Fragment key={word.rest}>
              {i > 0 && ' '}
              <span ref={(el) => { wordsRef.current[i] = el }} className="inline-block" style={{ opacity: 0 }}>
                {word.initial && <span className="font-extrabold" style={{ color: word.color }}>{word.initial}</span>}
                {word.rest}
              </span>
            </Fragment>
          ))}
        </p>
      </div>
    </div>
  )
}
