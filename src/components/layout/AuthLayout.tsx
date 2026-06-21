import { Outlet } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import logoImg from '@/assets/logo-sinfondo.png'

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
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-tiam-blue p-12 lg:flex">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-white" />
          <div className="absolute -bottom-32 -right-20 h-[500px] w-[500px] rounded-full bg-white" />
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>

        {/* Logo */}
        <div className="relative">
          <img src={logoImg} alt="TIAM" className="h-20 w-20 object-contain" />
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
          <p className="mt-3 text-xs font-semibold text-white/70">— Especialista en estimulación cognitiva, La Plata</p>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <img src={logoImg} alt="TIAM" className="h-10 w-10 object-contain" />
          <span className="text-xl font-bold text-slate-900">TIAM Digital</span>
        </div>

        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
