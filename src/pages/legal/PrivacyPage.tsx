import { LegalPage, type LegalSection } from './LegalPage'

// ─── Static section data (hoisted outside component) ─────────────────────────

const LAST_UPDATED = '21 de junio de 2026'

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    number: 1,
    title: 'Responsable de los datos',
    content: (
      <p>
        El responsable del tratamiento de los datos personales recopilados a través de la plataforma
        TIAM Digital es TIAM Digital (en adelante, "TIAM" o "nosotros"). Para consultas relacionadas
        con el tratamiento de sus datos personales, puede comunicarse a:{' '}
        <a href="mailto:privacidad@tiam.com.ar" className="text-tiam-blue hover:underline">
          privacidad@tiam.com.ar
        </a>
        .
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
            <strong>Mercado Pago:</strong> procesamiento de pagos. Aplican los términos y política de
            privacidad de Mercado Pago para los datos de pago.
          </li>
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
      <p>
        Los datos personales del profesional y los datos de sus pacientes se conservarán mientras la
        cuenta permanezca activa. Una vez que el profesional solicite la eliminación de su cuenta,
        TIAM Digital procederá a eliminar o anonimizar los datos personales en un plazo razonable,
        salvo que su conservación sea necesaria para el cumplimiento de obligaciones legales, la
        resolución de disputas o la defensa de reclamaciones legítimas, en cuyo caso se mantendrán
        por el plazo legalmente exigible.
      </p>
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
          <a href="mailto:privacidad@tiam.com.ar" className="text-tiam-blue hover:underline">
            privacidad@tiam.com.ar
          </a>
          , indicando su nombre, el derecho que desea ejercer y adjuntando la documentación que
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
        </ul>
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
        personales, puede contactarse con TIAM Digital en:{' '}
        <a href="mailto:privacidad@tiam.com.ar" className="text-tiam-blue hover:underline">
          privacidad@tiam.com.ar
        </a>
        .
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
