import { Building2, CalendarDays, Check, Clock, Home, HeartHandshake, Package } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { WhatsAppCta } from '@/pages/talleres/WhatsAppCta'
import domicilioImg from '@/assets/taller/personalizado-domicilio.webp'
import espacioImg from '@/assets/taller/personalizado-espacio.webp'

/**
 * "Talleres personalizados" — the one-to-one / small-group offer, either at the
 * workshop space or at the person's home. It lives on /talleres (anchor
 * #personalizados) below the regular group taller, so a link to the section
 * can be shared on its own.
 *
 * The two card pictures are flat-vector ILLUSTRATIONS on purpose (generated
 * locally with Flux): the rest of the page shows real photos of the taller, and
 * these must never pass as real sessions — keep "Ilustración" in their alt text.
 *
 * Everything the tallerista may want to change is in the data block: prices
 * (per session), the minimum group size for home visits and the message each
 * button opens WhatsApp with.
 */

// ── data:start ──
// Agreed with the tallerista on 2026-10-12. The prices are per SESSION: the first
// release said "por persona, por mes" and the owner corrected it the same day.
const PRICE_SPACE = '$35.000'
const PRICE_HOME = '$45.000'
/** What a price covers. No "por persona" on purpose: per person or per group is still unconfirmed. */
const PRICE_UNIT = 'por sesión'
/** Smallest group the tallerista goes to a home for. */
const HOME_MIN_PEOPLE = 7

const TEXT_GENERAL = '¡Hola! Quiero consultar por los talleres personalizados de TIAM.'
const TEXT_SPACE = '¡Hola! Quiero consultar por el taller personalizado en el espacio de TIAM.'
const TEXT_HOME = '¡Hola! Quiero consultar por el taller personalizado a domicilio de TIAM.'

const FACTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Clock, title: 'Una hora', text: 'de trabajo en cada encuentro' },
  { icon: CalendarDays, title: 'Una vez por semana', text: 'con día y horario a coordinar' },
  { icon: Package, title: 'El material', text: 'para trabajar lo ponemos nosotros' },
]

const STEPS = [
  { title: 'Escribinos por WhatsApp', text: 'Contanos para quién es y si preferís el espacio o tu casa.' },
  { title: 'Coordinamos', text: 'Armamos juntos los días y los horarios.' },
  { title: 'Empezamos', text: 'Un encuentro de una hora por semana, a tu medida.' },
]
// ── data:end ──

interface OptionCardProps {
  icon: LucideIcon
  title: string
  description: string
  conditions: string[]
  price: string
  ctaLabel: string
  ctaText: string
  image?: { src: string; alt: string }
}

function OptionCard({ icon: Icon, title, description, conditions, price, ctaLabel, ctaText, image }: OptionCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
      {image && <img src={image.src} alt={image.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tiam-blue/10 text-tiam-blue">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        </div>
        <p className="mt-4 leading-relaxed text-slate-600">{description}</p>
        <ul role="list" className="mt-4 space-y-2">
          {conditions.map((condition) => (
            <li key={condition} className="flex items-start gap-2 text-slate-700">
              <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" aria-hidden="true" />
              {condition}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-6">
          <div className="border-t border-slate-100 pt-5">
            <p className="text-3xl font-bold text-slate-900">{price}</p>
            <p className="mt-1 text-base font-medium text-slate-600">{PRICE_UNIT}</p>
          </div>
          <div className="mt-5">
            <WhatsAppCta label={ctaLabel} text={ctaText} fullWidth />
          </div>
        </div>
      </div>
    </article>
  )
}

export function TalleresPersonalizadosSection() {
  return (
    <section id="personalizados" aria-labelledby="personalizados-title" className="scroll-mt-20 bg-slate-50 py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-tiam-blue/20 bg-tiam-blue/5 px-4 py-1.5">
            <HeartHandshake className="h-3.5 w-3.5 text-tiam-blue" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide text-tiam-blue">Talleres personalizados</span>
          </div>
          <h2 id="personalizados-title" className="mt-4 text-2xl font-bold text-slate-900 md:text-4xl">
            Un taller a tu medida
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            Trabajamos con lo que necesita cada persona, de forma individual o en un grupo reducido. Elegí si querés
            venir a nuestro espacio o que vayamos a tu casa.
          </p>
        </div>

        <ul role="list" className="mt-10 grid gap-4 sm:grid-cols-3">
          {FACTS.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-col sm:gap-3 sm:text-center"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tiam-orange/10 text-tiam-orange">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="text-sm text-slate-600">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <OptionCard
            icon={Building2}
            title="En nuestro espacio"
            description="Venís al taller, en La Plata, y trabajamos con lo que vos necesitás."
            conditions={['Un espacio amigable y cálido']}
            price={PRICE_SPACE}
            ctaLabel="Consultar por el espacio"
            ctaText={TEXT_SPACE}
            image={{
              src: espacioImg,
              alt: 'Ilustración de un salón de taller: cuatro personas mayores trabajan en cuadernos alrededor de una mesa mientras una tallerista las acompaña',
            }}
          />
          <OptionCard
            icon={Home}
            title="En tu domicilio"
            description="Reuní a tu grupo —amigas, amigos o vecinos— y vamos a tu casa."
            // The group line goes last so it is the one right above the price.
            conditions={['También de forma individual', `Grupo de ${HOME_MIN_PEOPLE} personas o más`]}
            price={PRICE_HOME}
            ctaLabel="Consultar por el domicilio"
            ctaText={TEXT_HOME}
            image={{
              src: domicilioImg,
              alt: 'Ilustración de una tallerista y tres personas mayores sonriendo alrededor de una mesa en un living, con té, cuadernos y fichas de colores',
            }}
          />
        </div>

        <div className="mt-14">
          <h3 className="text-center text-xl font-bold text-slate-900 md:text-2xl">Cómo empezar</h3>
          <ol role="list" className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 sm:flex-col sm:items-center sm:text-center">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-lg font-bold text-white"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-slate-600">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-14 rounded-3xl bg-white p-6 text-center shadow-sm md:p-10">
          <h3 className="text-xl font-bold text-slate-900 md:text-2xl">¿Hablamos?</h3>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Escribinos y te contamos cómo sería para vos: formato, días y horarios.
          </p>
          <div className="mt-6 flex justify-center">
            <WhatsAppCta label="Consultar por WhatsApp" text={TEXT_GENERAL} />
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-slate-600">
          Los talleres son de estimulación cognitiva: no reemplazan un diagnóstico ni un tratamiento.
        </p>
      </div>
    </section>
  )
}
