import type { LegalSection } from './LegalPage'
import { GUARANTEE_DAYS, INVOICE_TEXT, LEGAL_ENTITY, LICENSE_FAMILIAS, LICENSE_PROFESIONALES } from './legalConfig'

/**
 * Terms clauses for the Packs and the 30-day Challenge (clauses 10 to 12 of /terms).
 *
 * PENDING LEGAL REVIEW: draft text, see the note in legalConfig.ts. It describes how the sale really works
 * (Proyecto Digitales/pack/cobro-diseno.md, sections 2.7 and 2.8) and uses only data that exists as configuration;
 * the seller's name, the licence texts, the warranty days and the invoice instructions appear only when the
 * owner has filled their variables in.
 */

export const PACK_TERMS_SECTIONS: LegalSection[] = [
  {
    number: 10,
    title: 'Packs imprimibles (productos digitales)',
    content: (
      <>
        <p>
          El Pack Básico es un conjunto de fichas de estimulación cognitiva en formato PDF, para imprimir en tamaño A4 o Carta. Se ofrece en una edición para familias y
          otra para profesionales, y puede incluir complementos opcionales, como un cuadernillo extra o un mes del Desafío 30 días. Es un producto digital: no se envía
          nada físico.
        </p>
        {LEGAL_ENTITY && (
          <p>
            <strong>Vendedor:</strong> {LEGAL_ENTITY}
          </p>
        )}
        <p className="font-semibold text-slate-800 mt-4">Precio y pago</p>
        <p className="mt-1">
          El precio final, en pesos argentinos, es el que se muestra en la página de venta en el momento de la compra. El pago se procesa por Mercado Pago, con los medios de
          pago que esa plataforma ofrezca; TIAM Digital no almacena datos de tarjetas. La compra queda concretada cuando el pago se acredita.
        </p>
        <p className="font-semibold text-slate-800 mt-4">Entrega y acceso</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-1">
          <li>
            Cuando el pago se acredita se habilita la descarga: en la página a la que se vuelve desde Mercado Pago y en un email con un enlace personal, enviado a la dirección
            que el comprador escribió al comprar. El comprador es responsable de escribirla correctamente y de revisar la carpeta de correo no deseado.
          </li>
          <li>
            Si el pago es en efectivo, el acceso se habilita cuando el pago se acredita, lo que puede demorar desde unas horas hasta algunos días hábiles.
          </li>
          <li>
            El acceso a las descargas dura el plazo que se informa en la página de descargas. Quien perdió el enlace puede pedir uno nuevo, con el email de la compra, desde la
            página <a href="/pack/recuperar" className="text-tiam-blue hover:underline">Recuperar mi acceso</a>.
          </li>
          <li>
            Los enlaces de descarga son personales. Por seguridad, los archivos se entregan con direcciones temporales y puede haber un límite de descargas por día.
          </li>
        </ul>
        <p className="font-semibold text-slate-800 mt-4">Licencia de uso</p>
        <p className="mt-1">
          La compra otorga una licencia de uso no exclusiva e intransferible, con el alcance de la edición adquirida. El contenido sigue siendo de TIAM Digital. Queda prohibido
          revender, redistribuir, publicar o compartir los archivos con terceros fuera de lo que la licencia permita.
        </p>
        {LICENSE_FAMILIAS && (
          <p>
            <strong>Edición familias:</strong> {LICENSE_FAMILIAS}
          </p>
        )}
        {LICENSE_PROFESIONALES && (
          <p>
            <strong>Edición profesionales:</strong> {LICENSE_PROFESIONALES}
          </p>
        )}
        {INVOICE_TEXT && (
          <>
            <p className="font-semibold text-slate-800 mt-4">Factura</p>
            <p className="mt-1">{INVOICE_TEXT}</p>
          </>
        )}
        <p className="font-semibold text-slate-800 mt-4">Alcance del material</p>
        <p className="mt-1">
          Las fichas son material de estimulación cognitiva. No reemplazan la evaluación ni el tratamiento de un profesional de la salud.
        </p>
      </>
    ),
  },
  {
    number: 11,
    title: 'Desafío 30 días',
    content: (
      <>
        <p>
          El Desafío 30 días es un programa de ejercicios de estimulación cognitiva que se recibe a través de WhatsApp y de un enlace personal. Se compra por mes y puede
          sumarse al comprar un Pack.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            Para activarlo hace falta escribir a TIAM Digital por WhatsApp desde el mismo número de teléfono que se indicó en la compra. Ese número debe ser del comprador o de
            la persona que va a realizar el Desafío.
          </li>
          <li>
            Los 30 días se cuentan desde la fecha de pago.
          </li>
          <li>
            Al sumarlo a un Pack se activa con el mismo número de WhatsApp indicado en la compra y se comunica también en el email de acceso.
          </li>
          <li>
            El Desafío es un material de estimulación cognitiva y no reemplaza la evaluación ni el tratamiento de un profesional de la salud.
          </li>
        </ul>
      </>
    ),
  },
  {
    number: 12,
    title: 'Arrepentimiento, garantía y reembolsos de los productos digitales',
    content: (
      <>
        <p className="font-semibold text-slate-800">Botón de arrepentimiento</p>
        <p className="mt-1">
          Quien compra a distancia puede revocar la compra dentro de los diez (10) días corridos contados desde que se entrega el producto o se celebra el contrato, lo último
          que ocurra (artículo 34 de la Ley 24.240), sin costo alguno. Para hacerlo se usa el{' '}
          <a href="/arrepentimiento" className="text-tiam-blue hover:underline">
            Botón de arrepentimiento
          </a>
          , que también está en el pie de las páginas de venta. Al enviarlo, el comprador ve en pantalla una constancia con su número de referencia y la fecha y hora de recepción, y recibe una copia por email si esa dirección corresponde a una compra. TIAM Digital responde a la dirección indicada en el formulario.
        </p>
        <p>
          Cuando la solicitud corresponde, TIAM Digital devuelve el importe pagado por el mismo medio de pago que se usó y el acceso a los archivos deja de funcionar.
        </p>
        {GUARANTEE_DAYS > 0 && (
          <>
            <p className="font-semibold text-slate-800 mt-4">Garantía de {GUARANTEE_DAYS} días</p>
            <p className="mt-1">
              Además, si el pack no es lo que el comprador esperaba, puede escribir a TIAM Digital dentro de los {GUARANTEE_DAYS} días de la compra y se le devuelve el pago.
              Esta garantía se suma a los derechos que la ley reconoce a los consumidores y no los limita.
            </p>
          </>
        )}
        <p className="font-semibold text-slate-800 mt-4">Cómo se devuelve el pago</p>
        <p className="mt-1">
          Los reembolsos se hacen desde Mercado Pago, al mismo medio de pago usado en la compra. El tiempo en que el importe se ve reflejado depende de ese medio de pago.
        </p>
      </>
    ),
  },
]
