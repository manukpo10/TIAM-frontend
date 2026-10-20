import { LegalPage, type LegalSection } from './LegalPage'
import { CONTACT_EMAIL, LEGAL_ENTITY, PIXEL_ENABLED } from './legalConfig'

// PENDING LEGAL REVIEW: everything about buyers of the Packs and the 30-day Challenge (clause 1's seller line,
// 2d, the purchase items of 3, 4, 6 and 8, and the purchase/Pixel items of 10) is a DRAFT written from how the
// sale really works. See src/pages/legal/legalConfig.ts for what the lawyer must confirm before the sale opens.
// Also check, in Meta Events Manager, whether "Automatic Advanced Matching" is on: it can read form fields
// (email, phone) on the landing pages, which this policy says TIAM's own events do not send.

// ─── Static section data (hoisted outside component) ─────────────────────────

const LAST_UPDATED = '19 de octubre de 2026'

// Contact address for privacy requests and unsubscribes. Every clause that
// mentions it renders this link; the address itself comes from legalConfig.ts.
const PRIVACY_EMAIL = CONTACT_EMAIL

function PrivacyEmailLink() {
  return (
    <a href={`mailto:${PRIVACY_EMAIL}`} className="text-tiam-blue hover:underline">
      {PRIVACY_EMAIL}
    </a>
  )
}

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    number: 1,
    title: 'Responsable de los datos',
    content: (
      <p>
        El responsable del tratamiento de los datos personales recopilados a través del sitio web y
        la plataforma TIAM Digital es TIAM Digital (en adelante, "TIAM" o "nosotros"). Para
        consultas relacionadas con el tratamiento de sus datos personales, puede comunicarse a:{' '}
        <PrivacyEmailLink />.{LEGAL_ENTITY && <> Vendedor de los productos digitales: {LEGAL_ENTITY}.</>}
      </p>
    ),
  },
  {
    number: 2,
    title: 'Datos que recopilamos',
    content: (
      <>
        <p>
          TIAM Digital recopila y trata las siguientes categorías de datos:
        </p>
        <p className="font-semibold text-slate-800 mt-4">a) Datos del profesional usuario</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-1">
          <li>Nombre y apellido, dirección de correo electrónico y contraseña de acceso.</li>
          <li>Especialidad y datos profesionales que el usuario opte por proporcionar.</li>
          <li>
            Datos de facturación y pago, los cuales son gestionados directamente por el proveedor de
            pago Mercado Pago. TIAM Digital no almacena datos de tarjetas de crédito o débito.
          </li>
          <li>
            Datos de uso del Servicio: funcionalidades utilizadas, frecuencia de acceso, preferencias
            de configuración.
          </li>
        </ul>
        <p className="font-semibold text-slate-800 mt-4">b) Datos de pacientes cargados por el profesional</p>
        <p className="mt-1">
          A través del Servicio, el profesional puede registrar datos relativos a sus pacientes. Estos
          datos pueden incluir:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>Nombre y apellido, fecha de nacimiento.</li>
          <li>
            Diagnóstico, notas de sesión, historial de ejercicios y demás información clínica que el
            profesional decida incorporar.
          </li>
        </ul>
        <p className="mt-2">
          Estos datos constituyen <strong>datos sensibles de salud</strong> en los términos de la Ley
          25.326 de Protección de los Datos Personales y son objeto de especial protección. Véase la
          cláusula 5 para mayor detalle.
        </p>
        <p className="font-semibold text-slate-800 mt-4">c) Datos de contacto de personas interesadas</p>
        <p className="mt-1">
          Quienes dejan su correo electrónico en el sitio web —para descargar las fichas gratuitas o
          para recibir un aviso cuando la plataforma para profesionales esté disponible— nos
          proporcionan su dirección de correo electrónico y, de manera opcional, su nombre. También
          registramos desde qué formulario lo hicieron y en qué fecha.
        </p>
        <p className="font-semibold text-slate-800 mt-4">d) Datos de quienes compran packs, Cuadernos TIAM o el Desafío 30 días</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-1">
          <li>Nombre y dirección de correo electrónico, que se piden para enviar el acceso a los archivos.</li>
          <li>
            Número de teléfono (WhatsApp), solo cuando se compra el Desafío 30 días o un mes del Desafío junto con un pack o con los
            Cuadernos TIAM, para asignar el mes al comprador y para poder atenderlo por WhatsApp si hace falta.
          </li>
          <li>
            Datos de la compra: producto, importe, estado y fecha del pago e identificador del pago en Mercado Pago. TIAM
            Digital no accede a los datos de la tarjeta.
          </li>
          <li>
            Origen de la visita (parámetros de campaña de los anuncios, como la fuente o el identificador de clic), para saber
            qué anuncios llevan a compras.
          </li>
          <li>Registro de las descargas (fecha y archivo), para detectar el uso abusivo de los enlaces.</li>
          <li>
            Si se usa el botón de arrepentimiento: el nombre, el email, el número de pedido y el motivo que la persona escriba.
          </li>
        </ul>
      </>
    ),
  },
  {
    number: 3,
    title: 'Finalidad del tratamiento',
    content: (
      <>
        <p>Los datos recopilados son tratados exclusivamente para las siguientes finalidades:</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            Prestar el Servicio contratado, incluyendo el acceso a la plataforma, la gestión de
            ejercicios, el armado de sesiones y la generación de fichas.
          </li>
          <li>
            Gestionar el registro de pacientes y el seguimiento de su evolución, según los datos
            ingresados por el profesional.
          </li>
          <li>
            Procesar pagos y gestionar la suscripción del profesional.
          </li>
          <li>
            Enviar comunicaciones relacionadas con el Servicio: actualizaciones, cambios relevantes y
            soporte técnico.
          </li>
          <li>
            Enviar a las personas interesadas lo que solicitaron —las fichas gratuitas o el aviso de
            lanzamiento de la plataforma— y, cuando lo hayan aceptado, novedades de TIAM Digital.
            Pueden dejar de recibirlas en cualquier momento escribiendo a <PrivacyEmailLink />.
          </li>
          <li>
            Entregar los productos digitales comprados: habilitar la descarga, enviar por email el enlace de acceso y entregar el
            mes del Desafío 30 días, que corre desde la compra y se empieza desde el enlace personal. Los emails que se envían a quienes compran son de servicio: acceso, constancias y
            soporte.
          </li>
          <li>
            Atender las solicitudes de reenvío de acceso y de arrepentimiento, y enviar la constancia correspondiente.
          </li>
          <li>
            Mejorar el Servicio a través del análisis de patrones de uso agregados y anonimizados.
          </li>
        </ul>
        <p>
          TIAM Digital no utiliza los datos de los pacientes para ningún fin distinto a la prestación
          del Servicio al profesional que los ha cargado.
        </p>
      </>
    ),
  },
  {
    number: 4,
    title: 'Base legal y consentimiento',
    content: (
      <>
        <p>
          El tratamiento de los datos personales del profesional usuario se basa en la relación
          contractual derivada de la aceptación de los{' '}
          <a href="/terms" className="text-tiam-blue hover:underline">
            Términos y Condiciones
          </a>{' '}
          y en el consentimiento prestado al momento del registro en la plataforma.
        </p>
        <p>
          Los datos de contacto de las personas interesadas se tratan sobre la base del consentimiento
          que prestan al enviar el formulario correspondiente, el cual pueden revocar en cualquier
          momento.
        </p>
        <p>
          Los datos de quienes compran packs o el Desafío 30 días se tratan para ejecutar el contrato de compra —entregar el
          producto, atender reclamos, devoluciones y arrepentimientos— y para cumplir las obligaciones legales de TIAM Digital.
        </p>
        <p>
          Respecto de los datos de salud de los pacientes, <strong>el profesional es el responsable
          exclusivo de obtener el consentimiento informado de sus pacientes</strong> —o de sus
          representantes legales cuando corresponda— para el registro, almacenamiento y tratamiento de
          sus datos personales y de salud en el Servicio, en cumplimiento de la Ley 25.326, la
          normativa del sistema de salud argentina y las obligaciones deontológicas de su profesión.
        </p>
        <p>
          TIAM Digital actúa, respecto de los datos de los pacientes, en calidad de encargado del
          tratamiento (o "processor"), limitándose a tratar dichos datos por instrucción y en nombre
          del profesional usuario, que reviste la condición de responsable del tratamiento frente a
          sus pacientes.
        </p>
      </>
    ),
  },
  {
    number: 5,
    title: 'Datos sensibles de salud',
    content: (
      <>
        <p>
          Los datos de salud de los pacientes registrados en la plataforma constituyen datos sensibles
          en los términos del artículo 2 y concordantes de la Ley 25.326, y reciben por tanto un nivel
          de protección reforzado.
        </p>
        <p>
          TIAM Digital aplica medidas técnicas y organizativas adicionales para la protección de esta
          categoría de datos, incluyendo control de acceso estricto —únicamente el profesional
          titular de la cuenta puede acceder a los datos de sus propios pacientes— y cifrado de la
          información almacenada.
        </p>
        <p>
          El profesional, como responsable del tratamiento frente a sus pacientes, asume las
          obligaciones establecidas por la normativa aplicable en materia de datos sensibles. TIAM
          Digital actuará como encargado del tratamiento conforme a las instrucciones del profesional
          y a las disposiciones legales vigentes.
        </p>
      </>
    ),
  },
  {
    number: 6,
    title: 'Con quién compartimos los datos',
    content: (
      <>
        <p>
          TIAM Digital no vende, alquila ni comercializa los datos personales de sus usuarios ni de
          los pacientes registrados en la plataforma.
        </p>
        <p>
          Los datos podrán ser accedidos o tratados únicamente por los siguientes proveedores de
          servicios esenciales, que actúan como subencargados del tratamiento y están sujetos a
          obligaciones de confidencialidad y seguridad:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            <strong>Mercado Pago:</strong> procesamiento de pagos de las suscripciones, los packs y el Desafío 30 días. Aplican los
            términos y política de privacidad de Mercado Pago para los datos de pago.
          </li>
          <li>
            <strong>Proveedor de envío de correo electrónico:</strong> envía los emails de acceso y las constancias, por lo que
            recibe la dirección de correo, el nombre del destinatario y el contenido del mensaje.
          </li>
          <li>
            <strong>Proveedor de almacenamiento de archivos:</strong> aloja los PDF y los entrega con direcciones temporales; puede
            registrar datos técnicos de la descarga, como la dirección IP.
          </li>
          <li>
            <strong>WhatsApp (Meta Platforms):</strong> si el comprador escribe por WhatsApp (por ejemplo, cuando no tiene su enlace personal del Desafío 30 días) se
            trata, a través de WhatsApp, el número de teléfono desde el que escribe y los mensajes.
          </li>
          {PIXEL_ENABLED && (
            <li>
              <strong>Meta Platforms (Píxel de Meta):</strong> medición de los anuncios de las páginas de venta, según se describe en
              la cláusula 10.
            </li>
          )}
          <li>
            <strong>Proveedor de infraestructura y hosting:</strong> almacenamiento y operación de la
            plataforma en la nube.
          </li>
        </ul>
        <p>
          TIAM Digital podrá divulgar datos en cumplimiento de una obligación legal o por requerimiento
          de autoridad competente, en cuyo caso informará al usuario afectado en la medida en que la
          ley lo permita.
        </p>
      </>
    ),
  },
  {
    number: 7,
    title: 'Seguridad de la información',
    content: (
      <>
        <p>
          TIAM Digital implementa medidas de seguridad técnicas y organizativas razonables destinadas
          a proteger los datos personales frente a accesos no autorizados, pérdida, alteración,
          divulgación o destrucción. Entre dichas medidas se incluyen:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>Cifrado de datos en tránsito mediante TLS/HTTPS.</li>
          <li>Cifrado de datos sensibles en reposo.</li>
          <li>Control de acceso basado en roles, de modo que cada profesional accede únicamente a sus propios datos y los de sus pacientes.</li>
          <li>Monitoreo de la infraestructura para la detección de incidentes de seguridad.</li>
        </ul>
        <p>
          No obstante, ningún sistema de transmisión o almacenamiento de datos es absolutamente seguro.
          En caso de que TIAM Digital tomara conocimiento de una vulneración de seguridad que afecte
          datos personales, procederá conforme a la normativa vigente.
        </p>
      </>
    ),
  },
  {
    number: 8,
    title: 'Conservación de los datos',
    content: (
      <>
        <p>
          Los datos personales del profesional y los datos de sus pacientes se conservarán mientras la
          cuenta permanezca activa. Una vez que el profesional solicite la eliminación de su cuenta,
          TIAM Digital procederá a eliminar o anonimizar los datos personales en un plazo razonable,
          salvo que su conservación sea necesaria para el cumplimiento de obligaciones legales, la
          resolución de disputas o la defensa de reclamaciones legítimas, en cuyo caso se mantendrán
          por el plazo legalmente exigible.
        </p>
        <p>
          Los datos de contacto de las personas interesadas se conservan hasta que soliciten la baja o
          revoquen su consentimiento.
        </p>
        <p>
          Los datos de las compras (nombre, email, teléfono, importes y estado del pago) se conservan mientras sean necesarios
          para entregar el producto, permitir una nueva descarga, atender reclamos, devoluciones y arrepentimientos, y cumplir las
          obligaciones legales y fiscales. Cumplido ese plazo se eliminan o se anonimizan.
        </p>
      </>
    ),
  },
  {
    number: 9,
    title: 'Derechos del titular de los datos',
    content: (
      <>
        <p>
          De conformidad con la Ley 25.326 de Protección de los Datos Personales, el titular de los
          datos tiene derecho a:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            <strong>Acceso:</strong> solicitar información sobre los datos personales que obren en
            poder de TIAM Digital y cómo son tratados.
          </li>
          <li>
            <strong>Rectificación:</strong> solicitar la corrección de datos inexactos o incompletos.
          </li>
          <li>
            <strong>Actualización:</strong> solicitar la puesta al día de los datos.
          </li>
          <li>
            <strong>Supresión:</strong> solicitar la eliminación de los datos cuando ya no sean
            necesarios para la finalidad que motivó su recopilación o cuando se revoque el
            consentimiento, salvo que exista obligación legal de conservarlos.
          </li>
        </ul>
        <p>
          Para ejercer cualquiera de estos derechos, el usuario puede contactar a TIAM Digital en{' '}
          <PrivacyEmailLink />, indicando su nombre, el derecho que desea ejercer y adjuntando la documentación que
          acredite su identidad. TIAM Digital responderá en los plazos previstos por la normativa
          vigente.
        </p>
        <p>
          El titular tiene asimismo el derecho de presentar una reclamación ante la{' '}
          <strong>Agencia de Acceso a la Información Pública (AAIP)</strong>, autoridad de control en
          materia de protección de datos personales en la República Argentina (
          <a
            href="https://www.argentina.gob.ar/aaip"
            target="_blank"
            rel="noopener noreferrer"
            className="text-tiam-blue hover:underline"
          >
            www.argentina.gob.ar/aaip
          </a>
          ).
        </p>
      </>
    ),
  },
  {
    number: 10,
    title: 'Cookies y almacenamiento local',
    content: (
      <>
        <p>
          TIAM Digital utiliza cookies y mecanismos de almacenamiento local del navegador con las
          siguientes finalidades:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            <strong>Autenticación:</strong> para mantener la sesión del usuario activa y verificar su
            identidad entre visitas.
          </li>
          <li>
            <strong>Preferencias:</strong> para recordar la configuración y preferencias del usuario
            en la plataforma.
          </li>
          <li>
            <strong>Rendimiento:</strong> para recopilar información agregada sobre el uso de la
            plataforma y mejorar su funcionamiento.
          </li>
          <li>
            <strong>Acceso al Desafío 30 días:</strong> un identificador aleatorio guardado en el
            navegador y el tipo de dispositivo y navegador (por ejemplo, «Android · Chrome»), que se
            asocian a la compra, para saber desde cuántos dispositivos se abre cada link de acceso. En
            esta medición no guardamos la dirección IP.
          </li>
          <li>
            <strong>Compras:</strong> en las páginas de compra y de descarga, el navegador guarda de forma temporal (sin cookies, y
            hasta cerrar la pestaña) el identificador del pedido y lo escrito en el formulario, para no pedirlo de nuevo si algo falla.
            También puede recordar el tamaño de papel elegido.
          </li>
        </ul>
        {PIXEL_ENABLED && (
          <p>
            Las páginas de venta de los packs usan el Píxel de Meta para medir el resultado de los anuncios: informa a Meta qué
            páginas se visitan y cuándo se inicia o se completa una compra, con el importe. Los eventos que TIAM Digital envía no
            incluyen el email, el nombre ni el teléfono del comprador. El Píxel no se carga en la página de descargas.
          </p>
        )}
        <p>
          El usuario puede configurar su navegador para rechazar cookies, aunque esto podría afectar
          el correcto funcionamiento de determinadas funcionalidades del Servicio.
        </p>
      </>
    ),
  },
  {
    number: 11,
    title: 'Transferencias internacionales de datos',
    content: (
      <p>
        El alojamiento y procesamiento de los datos puede realizarse en servidores ubicados fuera del
        territorio de la República Argentina. En tal caso, TIAM Digital adoptará las medidas
        necesarias para garantizar que dichas transferencias se realicen con un nivel de protección
        adecuado, conforme a lo establecido por la Ley 25.326 y las disposiciones de la Agencia de
        Acceso a la Información Pública.
      </p>
    ),
  },
  {
    number: 12,
    title: 'Cambios en la política de privacidad',
    content: (
      <p>
        TIAM Digital podrá actualizar la presente Política de Privacidad para reflejar cambios en el
        Servicio, en la legislación aplicable o en las prácticas de tratamiento de datos. Cuando los
        cambios sean sustanciales, se notificará al usuario mediante correo electrónico o un aviso
        visible en la plataforma. El uso continuado del Servicio tras la notificación implica la
        aceptación de la nueva política.
      </p>
    ),
  },
  {
    number: 13,
    title: 'Contacto',
    content: (
      <p>
        Para cualquier consulta, solicitud o reclamo relacionado con el tratamiento de sus datos
        personales, puede contactarse con TIAM Digital en: <PrivacyEmailLink />.
      </p>
    ),
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PrivacyPage() {
  return (
    <LegalPage
      title="Política de Privacidad"
      lastUpdated={LAST_UPDATED}
      sections={PRIVACY_SECTIONS}
      crossLinkTo="/terms"
      crossLinkLabel="Ver Términos y Condiciones"
    />
  )
}
