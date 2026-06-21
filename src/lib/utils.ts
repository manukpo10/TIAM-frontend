import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  Brain, Target, MessageCircle, Compass, Zap, Hand, Eye, Music,
  Printer, Fingerprint, Mic, Images,
  Sprout, TrendingUp, Flame,
  type LucideIcon,
} from 'lucide-react'
import type { DifficultyLevel, CognitiveArea, MaterialType } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  BASIC: 'Básico',
  INTERMEDIATE: 'Intermedio',
  ADVANCED: 'Avanzado',
}

export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  BASIC: 'bg-green-100 text-green-800',
  INTERMEDIATE: 'bg-yellow-100 text-yellow-800',
  ADVANCED: 'bg-red-100 text-red-800',
}

export const DIFFICULTY_ICONS: Record<DifficultyLevel, LucideIcon> = {
  BASIC: Sprout,
  INTERMEDIATE: TrendingUp,
  ADVANCED: Flame,
}

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  PRINTABLE: 'Imprimible',
  SENSORIAL: 'Sensorial',
  VERBAL: 'Verbal',
  IMAGE_SEQUENCE: 'Secuencia de imágenes',
}

export const COGNITIVE_AREAS: CognitiveArea[] = [
  { id: '1', name: 'Memoria', slug: 'memoria' },
  { id: '2', name: 'Atención', slug: 'atencion' },
  { id: '3', name: 'Fluencia Verbal', slug: 'fluencia-verbal' },
  { id: '4', name: 'Orientación Espacial', slug: 'orientacion-espacial' },
  { id: '5', name: 'Funciones Ejecutivas', slug: 'funciones-ejecutivas' },
  { id: '6', name: 'Praxias', slug: 'praxias' },
  { id: '7', name: 'Agnosias', slug: 'agnosias' },
  { id: '8', name: 'Estimulación Sensorial', slug: 'estimulacion-sensorial' },
]

export const AREA_COLORS: Record<string, { bg: string; text: string; light: string; icon: LucideIcon }> = {
  'memoria':                { bg: 'bg-violet-500',  text: 'text-violet-700',  light: 'bg-violet-50',  icon: Brain },
  'atencion':               { bg: 'bg-orange-500',  text: 'text-orange-700',  light: 'bg-orange-50',  icon: Target },
  'fluencia-verbal':        { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', icon: MessageCircle },
  'orientacion-espacial':   { bg: 'bg-cyan-500',    text: 'text-cyan-700',    light: 'bg-cyan-50',    icon: Compass },
  'funciones-ejecutivas':   { bg: 'bg-blue-600',    text: 'text-blue-700',    light: 'bg-blue-50',    icon: Zap },
  'praxias':                { bg: 'bg-rose-500',    text: 'text-rose-700',    light: 'bg-rose-50',    icon: Hand },
  'agnosias':               { bg: 'bg-amber-500',   text: 'text-amber-700',   light: 'bg-amber-50',   icon: Eye },
  'estimulacion-sensorial': { bg: 'bg-pink-500',    text: 'text-pink-700',    light: 'bg-pink-50',    icon: Music },
}

export const MATERIAL_TYPE_ICONS: Record<string, LucideIcon> = {
  PRINTABLE: Printer,
  SENSORIAL: Fingerprint,
  VERBAL: Mic,
  IMAGE_SEQUENCE: Images,
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateString))
}
