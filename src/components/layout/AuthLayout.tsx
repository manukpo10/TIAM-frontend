import { Outlet, Link } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import logoImg from '@/assets/logogrande-sinfondo.png'
import authSide from '@/assets/auth-side.webp'
import claudiaImg from '@/assets/testimonial-claudia.webp'

const BENEFITS = [
  'Biblioteca curada de ejercicios por área cognitiva',
  'Fichas A4 listas para imprimir en segundos',
  'Armá sesiones completas con un clic',
  'Registrá el progreso de cada paciente',
]

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh">
      {/* Left — brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-tiam-blue-dark p-12 lg:flex">
        {/* Background photo + brand scrim for text readability */}
        <img
          src={authSide}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-tiam-blue-dark/90 via-tiam-blue/70 to-tiam-blue-dark/92"
        />

        {/* Logo */}
        <div className="relative">
          <Link to="/" aria-label="TIAM Digital — volver al inicio" className="inline-block">
            <img src={logoImg} alt="TIAM" className="h-14 w-auto object-contain" />
          </Link>
        </div>

        {/* Hero copy */}
        <div className="relative">
          <h1 className="mb-4 text-4xl font-bold leading-tight text-white">
            El material que necesitás,<br />
            cuando lo necesitás.
          </h1>
          <p className="mb-8 text-lg text-white/90">
            La plataforma de estimulación cognitiva para profesionales de la salud que trabajan con adultos mayores.
          </p>

          <ul className="flex flex-col gap-3">
            {BENEFITS.map(b => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />
                <span className="text-white/80">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Testimonial */}
        <div className="relative rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
          <p className="text-sm italic text-white/80">
            "Perdía 2-3 horas por semana buscando material. Ahora lo tengo todo en un solo lugar y mis pacientes notan la diferencia."
          </p>
          <div className="mt-3 flex items-center gap-2">
            <img src={claudiaImg} alt="Claudia Romero" className="h-8 w-8 rounded-full object-cover object-top shrink-0" />
            <p className="text-xs font-semibold text-white/70">Claudia Romero, especialista en estimulación cognitiva, La Plata</p>
          </div>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-12">
        {/* Mobile logo */}
        <Link to="/" aria-label="TIAM Digital — volver al inicio" className="mb-8 flex items-center gap-2 lg:hidden">
          <img src={logoImg} alt="TIAM" className="h-8 w-auto object-contain" />
          <span className="text-xl font-bold text-slate-900">TIAM Digital</span>
        </Link>

        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
