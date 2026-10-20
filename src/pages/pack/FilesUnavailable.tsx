import { Link } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import { StateHero } from './PackShell'
import { ContactLink } from './ContactLink'
import { linkButton } from './linkButton'

/**
 * A PAID order that lists no file to download (the backend could not build the list). The thank-you page and the downloads page show the same thing:
 * never an empty list. The payment is not in doubt; what is missing is the files, so the buyer is told to write to us (and can ask for the access by email).
 */
export function FilesUnavailable() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <StateHero tone="orange" icon={CircleAlert} title="No pudimos cargar tus archivos">
        <p>Tu pago está confirmado, pero hubo un problema al cargar los archivos de tu compra. Escribinos y lo resolvemos enseguida.</p>
      </StateHero>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <ContactLink className={linkButton('primary', 'w-full sm:w-auto')} />
        <Link to="/pack/recuperar" className={linkButton('secondary', 'w-full sm:w-auto')}>
          Recibir mi acceso por email
        </Link>
      </div>
    </div>
  )
}
