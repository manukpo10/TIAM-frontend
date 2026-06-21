import { useId } from 'react'

interface TiamLogoProps {
  variant?: 'mark' | 'full'
  className?: string
}

export function TiamLogo({ variant = 'full', className }: TiamLogoProps) {
  const uid = useId()
  const gradId = `${uid}-arch`

  if (variant === 'mark') {
    return (
      <svg viewBox="0 0 80 68" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="TIAM">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E8581A" />
            <stop offset="45%" stopColor="#5CB85C" />
            <stop offset="100%" stopColor="#1D68A6" />
          </linearGradient>
        </defs>
        {/* Arch */}
        <path d="M 20 30 Q 40 2 60 22" stroke={`url(#${gradId})`} strokeWidth="7" fill="none" strokeLinecap="round" />
        {/* Left figure (orange) */}
        <circle cx="18" cy="30" r="10" fill="#E8581A" />
        <path d="M 27 38 C 38 53 46 43 44 27" stroke="#E8581A" strokeWidth="10" fill="none" strokeLinecap="round" />
        {/* Right figure (blue) */}
        <circle cx="62" cy="22" r="9" fill="#1D68A6" />
        <path d="M 53 30 C 42 45 34 35 36 19" stroke="#1D68A6" strokeWidth="10" fill="none" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 200 195" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="TIAM — taller interactivo adultos mayores">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E8581A" />
          <stop offset="45%" stopColor="#5CB85C" />
          <stop offset="100%" stopColor="#1D68A6" />
        </linearGradient>
      </defs>
      {/* Arch */}
      <path d="M 52 58 Q 100 8 148 50" stroke={`url(#${gradId})`} strokeWidth="12" fill="none" strokeLinecap="round" />
      {/* Left figure (orange) */}
      <circle cx="50" cy="58" r="22" fill="#E8581A" />
      <path d="M 68 72 C 88 98 104 83 100 55" stroke="#E8581A" strokeWidth="20" fill="none" strokeLinecap="round" />
      {/* Right figure (blue) */}
      <circle cx="150" cy="50" r="19" fill="#1D68A6" />
      <path d="M 132 64 C 112 90 96 75 100 47" stroke="#1D68A6" strokeWidth="18" fill="none" strokeLinecap="round" />
      {/* TIAM letters */}
      <text fontFamily="'Arial Black', 'Arial Bold', Arial, sans-serif" fontWeight="900" fontSize="70">
        <tspan x="14" y="165" fill="#E8581A">T</tspan>
        <tspan fill="#5CB85C">I</tspan>
        <tspan fill="#1D68A6">AM</tspan>
      </text>
      {/* Subtitle */}
      <text x="100" y="185" fontFamily="Arial, sans-serif" fontSize="13.5" fill="#666666" textAnchor="middle">taller interactivo adultos mayores</text>
    </svg>
  )
}
