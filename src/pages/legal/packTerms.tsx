import type { LegalSection } from './LegalPage'
import {
  CONTACT_EMAIL,
  GUARANTEE_DAYS,
  INVOICE_TEXT,
  LEGAL_ADDRESS,
  LEGAL_ENTITY,
  LICENSE_CUADERNOS,
  LICENSE_FAMILIAS,
  LICENSE_PROFESIONALES,
} from './legalConfig'

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
    title: 'Packs y cuadernos imprimibles (productos digitales)',
    content: (
      <>
        <p>
          El Pack Básico es un conjunto de fichas de estimulación cognitiva en formato PDF, para imprimir en tamaño A4 o Carta. Se ofrece en una edición para familias y
          otra para profesionales, y puede incluir complementos opcionales, como un cuadernillo extra o un mes del Desafío 30 días. Es un producto digital: no se envía
          nada físico.
        </p>
        <p>
          Los Cuadernos TIAM son una colección de cuatro cuadernos con 120 ejercicios de estimulación cognitiva en formato PDF, para imprimir en tamaño A4 o Carta y hacer sin
          acompañante, con las soluciones al final de cada cuaderno. Puede sumarse, como complemento opcional, el primer mes del Desafío 30 días. Es un producto digital: no se
          envía nada físico. Todo lo que dice este apartado sobre el Pack aplica también a los Cuadernos TIAM.
        </p>
        {(LEGAL_ENTITY || LEGAL_ADDRESS) && (
          // The seller-information block: the footers of the landings link here («Datos del vendedor», /terms#vendedor). The street address is printed
          // ONLY here (owner decision, 2026-10-19); tests/seller-address.test.ts keeps it out of everywhere else.
          <div id="vendedor" className="mt-4 scroll-mt-24 rounded-xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-800">Datos del vendedor</p>
            <ul className="mt-1 space-y-1">
              {LEGAL_ENTITY && (
                <li>
                  <strong>Vendedor:</strong> {LEGAL_ENTITY}
                </li>
              )}
              {LEGAL_ADDRESS && (
                <li>
                  <strong>Domicilio:</strong> {LEGAL_ADDRESS}
                </li>
              )}
              <li>
                <strong>Contacto:</strong>{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-tiam-blue hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </li>
            </ul>
          </div>
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
        {LICENSE_CUADERNOS && (
          <p>
            <strong>Cuadernos TIAM:</strong> {LICENSE_CUADERNOS}
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
          El Desafío 30 días es un programa de ejercicios de estimulación cognitiva que se juega desde el celular con un enlace personal, y también por WhatsApp. Se compra por mes
          y puede sumarse al comprar un Pack o los Cuadernos TIAM.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            Los 30 días se cuentan desde la fecha de pago. No esperan ningún mensaje de WhatsApp: se puede empezar de inmediato desde el enlace personal que se entrega con la
            compra, en la página de descargas y en el email de acceso.
          </li>
          <li>
            Si no se pudo generar el enlace, se empieza escribiendo a TIAM Digital por WhatsApp desde el mismo número de teléfono que se indicó en la compra. Ese número debe ser
            del comprador o de la persona que va a realizar el Desafío.
          </li>
          <li>
            Al sumarlo a un Pack o a los Cuadernos TIAM se otorga un solo mes: el próximo que ese número de teléfono todavía no haya comprado. Los meses siguientes son
            opcionales, se compran aparte en la página del Desafío y no hay renovación automática.
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
              Dentro de los {GUARANTEE_DAYS} días de la compra, el comprador puede pedir la devolución del importe completo, incluido el mes del Desafío 30 días si lo sumó. Se pide
              con el{' '}
              <a href="/arrepentimiento" className="text-tiam-blue hover:underline">
                Botón de arrepentimiento
              </a>{' '}
              o escribiendo a{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-tiam-blue hover:underline">
                {CONTACT_EMAIL}
              </a>
              . El reembolso lo hace TIAM Digital desde Mercado Pago y el acceso a los archivos se cierra automáticamente cuando el pago se devuelve. Esta garantía se suma a los
              derechos que la ley reconoce a los consumidores y no los limita.
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
