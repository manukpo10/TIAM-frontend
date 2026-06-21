import { LegalPage, type LegalSection } from './LegalPage'

// ─── Static section data (hoisted outside component) ─────────────────────────

const LAST_UPDATED = '21 de junio de 2026'

const TERMS_SECTIONS: LegalSection[] = [
  {
    number: 1,
    title: 'Aceptación de los términos',
    content: (
      <>
        <p>
          Al acceder, registrarse o utilizar la plataforma TIAM Digital (en adelante, "TIAM" o "el
          Servicio"), el usuario declara haber leído, comprendido y aceptado en su totalidad los
          presentes Términos y Condiciones, así como la{' '}
          <a href="/privacy" className="text-tiam-blue hover:underline">
            Política de Privacidad
          </a>{' '}
          de TIAM Digital.
        </p>
        <p>
          Si el usuario no acepta alguna de las condiciones establecidas en este documento, deberá
          abstenerse de utilizar el Servicio. El uso continuado de la plataforma constituye la
          aceptación expresa de cualquier modificación que se realice a estos términos.
        </p>
      </>
    ),
  },
  {
    number: 2,
    title: 'Descripción del servicio',
    content: (
      <>
        <p>
          TIAM Digital es una plataforma de software como servicio (SaaS) orientada a profesionales
          de la salud que trabajan en el campo de la estimulación cognitiva. El Servicio incluye,
          entre otras funcionalidades:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            Una biblioteca curada de ejercicios de estimulación cognitiva, organizada por área
            cognitiva y nivel de dificultad.
          </li>
          <li>
            Herramientas para el armado y planificación de sesiones personalizadas para cada
            paciente.
          </li>
          <li>
            Generación de fichas de ejercicios en formato A4 listas para imprimir.
          </li>
          <li>
            Gestión de un registro de pacientes con seguimiento de su evolución.
          </li>
          <li>
            Posibilidad de crear y gestionar ejercicios propios del profesional.
          </li>
        </ul>
        <p>
          TIAM Digital se reserva el derecho de incorporar, modificar o discontinuar funcionalidades
          del Servicio en cualquier momento, con o sin previo aviso, conforme a lo establecido en la
          cláusula 9 del presente documento.
        </p>
      </>
    ),
  },
  {
    number: 3,
    title: 'Registro y cuenta',
    content: (
      <>
        <p>
          Para acceder al Servicio, el usuario debe registrarse proporcionando información veraz,
          completa y actualizada. El usuario es responsable de mantener la exactitud de sus datos de
          registro y de actualizarlos ante cualquier modificación.
        </p>
        <p>
          Cada profesional debe crear y utilizar una única cuenta personal e intransferible. La cuenta
          registrada corresponde exclusivamente al profesional habilitado que la crea y no podrá ser
          cedida, transferida ni compartida con terceros. El usuario es el único responsable de la
          confidencialidad de sus credenciales de acceso (usuario y contraseña) y de todas las
          actividades que se realicen bajo su cuenta.
        </p>
        <p>
          Ante cualquier uso no autorizado de la cuenta o sospecha de vulneración de la seguridad, el
          usuario deberá notificarlo de forma inmediata a TIAM Digital a través de los canales de
          contacto indicados en la cláusula 11.
        </p>
      </>
    ),
  },
  {
    number: 4,
    title: 'Planes, suscripciones y pagos',
    content: (
      <>
        <p>
          TIAM Digital ofrece los siguientes modelos de acceso al Servicio:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            <strong>Prueba gratuita:</strong> período de 7 (siete) días con acceso completo al
            Servicio, sin necesidad de ingresar datos de pago, disponible una única vez por
            profesional.
          </li>
          <li>
            <strong>Plan Profesional:</strong> suscripción mensual o anual destinada a profesionales
            independientes.
          </li>
          <li>
            <strong>Plan Institucional:</strong> contratación especial para instituciones de salud,
            centros de día, geriátricos u organismos que requieran acceso para múltiples
            profesionales. Su precio se define por acuerdo entre las partes.
          </li>
        </ul>
        <p>
          Los pagos correspondientes a los planes de suscripción son procesados de forma segura por
          Mercado Pago. TIAM Digital no almacena datos de tarjetas de crédito ni débito. El usuario
          queda sujeto también a los términos y condiciones de Mercado Pago aplicables a las
          transacciones que realice.
        </p>
        <p>
          Las suscripciones se renuevan automáticamente al vencimiento del período contratado, salvo
          que el usuario proceda a su cancelación antes de la fecha de renovación. La cancelación
          puede realizarse en cualquier momento desde la configuración de la cuenta. Una vez cancelada
          la suscripción, el acceso al Servicio se mantendrá activo hasta el fin del período ya
          abonado.
        </p>
        <p>
          Con carácter general, TIAM Digital no realiza reembolsos por períodos parciales de
          suscripción no utilizados. No obstante, en los casos en que la legislación argentina vigente
          establezca el derecho a reembolso, TIAM Digital dará cumplimiento a dicha obligación.
        </p>
      </>
    ),
  },
  {
    number: 5,
    title: 'Uso aceptable',
    content: (
      <>
        <p>
          El usuario se compromete a utilizar el Servicio exclusivamente para fines lícitos y en el
          marco de su práctica profesional en el ámbito de la salud. Queda expresamente prohibido:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            Compartir las credenciales de acceso con terceros o permitir el uso de la cuenta por
            personas no autorizadas.
          </li>
          <li>
            Utilizar el Servicio con fines comerciales distintos a los previstos, incluyendo la
            reventa o redistribución de los contenidos de TIAM Digital sin autorización expresa.
          </li>
          <li>
            Intentar acceder, modificar o eliminar información perteneciente a otros usuarios.
          </li>
          <li>
            Introducir código malicioso, virus o cualquier otro elemento que pueda dañar el Servicio
            o los sistemas de TIAM Digital.
          </li>
          <li>
            Usar el Servicio de manera contraria a la ética profesional o a la normativa vigente en
            materia de salud.
          </li>
          <li>
            Realizar ingeniería inversa, descompilar o intentar extraer el código fuente de la
            plataforma.
          </li>
        </ul>
        <p>
          El incumplimiento de las presentes normas de uso aceptable podrá dar lugar a la suspensión
          o cancelación inmediata de la cuenta, sin perjuicio de las acciones legales que pudieran
          corresponder.
        </p>
      </>
    ),
  },
  {
    number: 6,
    title: 'Contenido y propiedad intelectual',
    content: (
      <>
        <p>
          Todos los contenidos originales de TIAM Digital —incluyendo, sin limitación, la biblioteca
          de ejercicios, el diseño de la plataforma, los textos, gráficos, logotipos, íconos y demás
          elementos— son propiedad de TIAM Digital o de sus licenciantes y están protegidos por la
          legislación argentina e internacional en materia de propiedad intelectual.
        </p>
        <p>
          Por su parte, los ejercicios, materiales y contenidos que el profesional cargue en la
          plataforma como ejercicios propios, así como los datos de sus pacientes, son y permanecen
          de su exclusiva titularidad. TIAM Digital no reclama derechos de propiedad sobre dichos
          contenidos.
        </p>
        <p>
          Al cargar contenidos en la plataforma, el profesional otorga a TIAM Digital una licencia
          limitada, no exclusiva y revocable para alojar, almacenar y mostrar dichos contenidos
          únicamente a los efectos de prestar el Servicio al propio profesional que los ha cargado.
          Esta licencia no habilita a TIAM Digital a compartir, ceder o explotar dichos contenidos
          con terceros ajenos al Servicio.
        </p>
        <p>
          Queda prohibida la reproducción, distribución, comunicación pública o transformación de los
          contenidos propiedad de TIAM Digital sin contar con autorización escrita previa.
        </p>
      </>
    ),
  },
  {
    number: 7,
    title: 'Responsabilidad del profesional',
    content: (
      <>
        <p>
          TIAM Digital es una herramienta de apoyo a la práctica clínica y, en ningún caso, sustituye
          el criterio, la formación ni la responsabilidad profesional del usuario.
        </p>
        <p>
          El profesional es el único y exclusivo responsable de:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            Las decisiones clínicas que adopte en el marco de su práctica, incluyendo la selección y
            aplicación de ejercicios a sus pacientes.
          </li>
          <li>
            La exactitud y veracidad de los datos de sus pacientes que ingrese en la plataforma.
          </li>
          <li>
            Obtener el consentimiento informado de sus pacientes —o de sus representantes legales—
            para el registro y tratamiento de sus datos personales y de salud en el Servicio, conforme
            a lo establecido en la Ley 25.326 de Protección de los Datos Personales y demás normativa
            aplicable.
          </li>
          <li>
            El cumplimiento de la normativa deontológica y legal que regule su profesión.
          </li>
        </ul>
        <p>
          TIAM Digital no asume responsabilidad alguna por los resultados clínicos derivados del uso
          del Servicio ni por el contenido de las sesiones diseñadas por el profesional.
        </p>
      </>
    ),
  },
  {
    number: 8,
    title: 'Limitación de responsabilidad',
    content: (
      <>
        <p>
          El Servicio se presta en el estado en que se encuentra ("as is") y sin garantías de ningún
          tipo, ya sean expresas o implícitas. TIAM Digital no garantiza que el Servicio sea
          ininterrumpido, libre de errores o que cumpla con las expectativas particulares de cada
          usuario.
        </p>
        <p>
          En la máxima medida permitida por la ley aplicable, TIAM Digital no será responsable por:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>
            Daños directos, indirectos, incidentales, especiales o consecuentes derivados del uso o
            la imposibilidad de uso del Servicio.
          </li>
          <li>
            Resultados clínicos o de salud de los pacientes atendidos por el profesional usuario.
          </li>
          <li>
            Pérdida de datos atribuible a causas fuera del control razonable de TIAM Digital.
          </li>
          <li>
            Interrupciones del Servicio debidas a mantenimiento, fallas técnicas o causas de fuerza
            mayor.
          </li>
        </ul>
        <p>
          Lo anterior no limita la responsabilidad de TIAM Digital en aquellos supuestos en que la
          normativa argentina vigente no permita dicha limitación.
        </p>
      </>
    ),
  },
  {
    number: 9,
    title: 'Modificaciones del servicio y de los términos',
    content: (
      <>
        <p>
          TIAM Digital se reserva el derecho de modificar, actualizar o discontinuar el Servicio o
          cualquiera de sus funcionalidades en cualquier momento, con o sin previo aviso al usuario.
        </p>
        <p>
          Asimismo, TIAM Digital podrá actualizar los presentes Términos y Condiciones. Cuando los
          cambios sean sustanciales, se notificará al usuario mediante el correo electrónico asociado
          a su cuenta o mediante un aviso destacado en la plataforma. El uso continuado del Servicio
          con posterioridad a dicha notificación implica la aceptación de los nuevos términos. Si el
          usuario no acepta las modificaciones, deberá cancelar su cuenta antes de la fecha de
          entrada en vigor de los nuevos términos.
        </p>
      </>
    ),
  },
  {
    number: 10,
    title: 'Ley aplicable y jurisdicción',
    content: (
      <p>
        Los presentes Términos y Condiciones se rigen por las leyes de la República Argentina. Para
        cualquier controversia o reclamación derivada de o relacionada con el presente documento o el
        Servicio, las partes se someten a la jurisdicción de los tribunales ordinarios competentes de
        la República Argentina, con renuncia expresa a cualquier otro fuero o jurisdicción que pudiera
        corresponderles.
      </p>
    ),
  },
  {
    number: 11,
    title: 'Contacto',
    content: (
      <p>
        Para consultas, reclamos o notificaciones relacionadas con los presentes Términos y
        Condiciones, puede comunicarse con TIAM Digital a través de la siguiente dirección de correo
        electrónico:{' '}
        <a href="mailto:legal@tiam.com.ar" className="text-tiam-blue hover:underline">
          legal@tiam.com.ar
        </a>
        .
      </p>
    ),
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TermsPage() {
  return (
    <LegalPage
      title="Términos y Condiciones"
      lastUpdated={LAST_UPDATED}
      sections={TERMS_SECTIONS}
      crossLinkTo="/privacy"
      crossLinkLabel="Ver Política de Privacidad"
    />
  )
}
