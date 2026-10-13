import { cn } from '@/lib/utils'
import grilla from '@/assets/desafio-pantallas/grilla.webp'
import listaMercado from '@/assets/desafio-pantallas/lista-mercado.webp'
import vuelto from '@/assets/desafio-pantallas/vuelto.webp'

/**
 * Three phones with REAL screens of the Desafío (the 30-day calendar and two of the
 * games), for the dark "Así se juega" band of the sales page. Built like the Pack
 * landings' phones: a bezel, a notch and a home bar drawn in CSS around the screens,
 * which are screenshots (2x, so they stay sharp at the size the Desafío — the product —
 * deserves).
 *
 * The two game screens are transparent cards that float over a dimmed page, which is how
 * the game opens inside the app; the calendar fills its phone. The calendar is a real
 * state of the app, not the all-unlocked one the dev mock shows by default: the first week
 * played (stars), today marked, 14 days open and the other 16 locked — the days unlock
 * 7 at a time, and a calendar with all 30 open would say otherwise. (Re-shoot it with the
 * mock's current day at 14 and the first 7 days seeded as played.)
 */

function Phone({
  className,
  variant,
  children,
}: {
  className?: string
  variant: 'game' | 'calendar'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex-none aspect-[9/19] rounded-[1.75rem] bg-[#0a111d] p-[.4rem] sm:rounded-[2.25rem] sm:p-2',
        'shadow-[0_0_0_2px_#2a384f,0_28px_40px_-18px_rgba(0,0,0,0.85)]',
        // the notch and the home bar
        "before:absolute before:left-1/2 before:top-[.65rem] before:z-10 before:h-[.3rem] before:w-[26%] before:-translate-x-1/2 before:rounded-full before:bg-[#2a384f] before:content-['']",
        "after:absolute after:bottom-[.6rem] after:left-1/2 after:z-10 after:h-[.2rem] after:w-[30%] after:-translate-x-1/2 after:rounded-full after:bg-white/55 after:content-['']",
        className,
      )}
    >
      <div
        className={cn(
          'flex h-full overflow-hidden rounded-[1.4rem] sm:rounded-[1.85rem]',
          variant === 'game'
            ? 'items-center justify-center bg-gradient-to-b from-[#8591ab] to-[#6b7792] p-2'
            : 'items-start bg-[#f2f7fc] pt-5 sm:pt-7',
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function PhoneMockups() {
  return (
    <div className="relative mx-auto flex w-full max-w-[38rem] items-end justify-center px-2 pb-2">
      {/* Widths and overlaps add up to 100% (2 × 32 + 44 − 2 × 4): the center phone covers only the
          inner edge of the side ones, so their games stay readable. */}
      <Phone variant="game" className="mb-5 -mr-[4%] w-[32%] -rotate-[5deg]">
        <img
          src={listaMercado}
          alt="Pantalla del Desafío: el juego «La lista del mercado», día 2 de Memoria, con una lista de productos para memorizar"
          width={592}
          height={1096}
          loading="lazy"
          decoding="async"
          className="block h-auto max-h-full w-auto max-w-full"
        />
      </Phone>
      <Phone variant="calendar" className="z-10 w-[44%]">
        <img
          src={grilla}
          alt="Pantalla del Desafío: el calendario de los 30 días, con cada día en el color de su área cognitiva, las estrellas de la primera semana y los días que todavía no se desbloquearon con candado"
          width={640}
          height={1256}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </Phone>
      <Phone variant="game" className="mb-5 -ml-[4%] w-[32%] rotate-[5deg]">
        <img
          src={vuelto}
          alt="Pantalla del Desafío: el juego «El vuelto», día 5 de Cálculo, con una compra para pagar y dar vuelto"
          width={592}
          height={1304}
          loading="lazy"
          decoding="async"
          className="block h-auto max-h-full w-auto max-w-full"
        />
      </Phone>
    </div>
  )
}
