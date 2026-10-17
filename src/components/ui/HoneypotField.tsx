import { useId } from 'react'

interface HoneypotFieldProps {
  value: string
  onChange: (value: string) => void
}

/**
 * A text input people never see: off-screen, out of the tab order and hidden from screen readers. Bots that
 * fill every input fill this one too, and the backend drops the submission (see useBotTrap).
 */
export function HoneypotField({ value, onChange }: HoneypotFieldProps) {
  const id = useId()
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
      <label htmlFor={id}>Sitio web</label>
      <input
        id={id}
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
