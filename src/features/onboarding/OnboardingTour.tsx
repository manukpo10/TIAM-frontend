import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import './onboarding-tour.css'

/**
 * First-time onboarding walkthrough (hands-on).
 *
 * Spotlights the REAL controls and advances when the user actually completes
 * each step, walking through the full core flow with real actions:
 *   1. create a patient
 *   2. build a session (pick exercises → assign → save)
 *   3. send a home exercise (share via WhatsApp)
 *
 * Robustness: every step advances on a real SUCCESS CONDITION (the next control
 * appeared, the form closed because it saved, a patient was selected…), never
 * on a blind timer. Data-entry steps are gated — "Siguiente" only works once the
 * required fields are filled — so deviating from the script can't break the tour;
 * at worst it waits. If a condition never happens, the tour stays put instead of
 * jumping to a missing element.
 *
 * Built on driver.js. Runs automatically the first time (localStorage flag) and
 * can be replayed via the `tiam:start-tour` window event. The × button skips it.
 */

const TOUR_FLAG = 'tiam_tour_completed'
export const START_TOUR_EVENT = 'tiam:start-tour'
/** Ask AppLayout to open the mobile navigation drawer. */
export const OPEN_DRAWER_EVENT = 'tiam:open-drawer'

const ACTION_ONLY: ('next' | 'previous' | 'close')[] = ['previous', 'close']

/** Below the `lg` breakpoint the sidebar is an off-canvas drawer. */
const isMobile = () => window.matchMedia('(max-width: 1023px)').matches

const sel = {
  navPatients: '[data-tour="nav-patients"]',
  navLibrary: '[data-tour="nav-library"]',
  newPatientBtn: '[data-tour="new-patient-btn"]',
  patientForm: '[data-tour="patient-form"]',
  patientFormSubmit: '[data-tour="patient-form-submit"]',
  addExerciseBtn: '[data-tour="add-exercise-btn"]',
  buildSessionBtn: '[data-tour="build-session-btn"]',
  sessionPatientSelect: '[data-tour="session-patient-select"]',
  saveSessionBtn: '[data-tour="save-session-btn"]',
  sendExerciseBtn: '[data-tour="send-exercise-btn"]',
  whatsappShareBtn: '[data-tour="whatsapp-share-btn"]',
}

const present = (s: string) => () => !!document.querySelector(s)
const absent = (s: string) => () => !document.querySelector(s)

/** The patient form has its required fields filled. */
function patientFormReady() {
  const form = document.querySelector(sel.patientForm)
  if (!form) return false
  const name = (form.querySelector('input[type="text"]') as HTMLInputElement | null)?.value.trim()
  const date = (form.querySelector('input[type="date"]') as HTMLInputElement | null)?.value
  return !!name && name.length >= 2 && !!date
}

/** A patient is chosen in the session builder. */
function sessionPatientChosen() {
  const s = document.querySelector(sel.sessionPatientSelect) as HTMLSelectElement | null
  return !!s && s.value !== ''
}

export function OnboardingTour() {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  const tourRef = useRef<ReturnType<typeof driver> | null>(null)
  const suppressFlag = useRef(false)

  const startTour = useCallback(() => {
    if (tourRef.current) {
      suppressFlag.current = true
      tourRef.current.destroy()
      suppressFlag.current = false
    }

    let advancing = false

    // Steps whose target lives inside the (mobile) navigation drawer.
    const drawerSteps = new Set<string>([sel.navPatients, sel.navLibrary])

    /**
     * Move to the next step. On mobile, if that step's target is a drawer nav
     * link, open the drawer first and wait for the slide-in before highlighting.
     */
    function goNext() {
      const nextSel = steps[(tour.getActiveIndex() ?? 0) + 1]?.element as string | undefined
      if (isMobile() && nextSel && drawerSteps.has(nextSel)) {
        window.dispatchEvent(new Event(OPEN_DRAWER_EVENT))
        window.setTimeout(() => tour.moveNext(), 320)
      } else {
        tour.moveNext()
      }
    }

    /**
     * Move to the next step once `ready()` becomes true. Polls up to ~12s and
     * then STOPS (never jumps to a missing element) so a deviation just waits.
     */
    function advanceWhen(ready: () => boolean) {
      if (advancing) return
      advancing = true
      let tries = 0
      const tick = () => {
        if (!tour.isActive()) {
          advancing = false
          return
        }
        if (ready()) {
          advancing = false
          goNext()
        } else if (tries++ < 120) {
          window.setTimeout(tick, 100)
        } else {
          advancing = false // give up quietly; stay on the current step
        }
      }
      window.setTimeout(tick, 150)
    }

    /** Advance when the user clicks the highlighted control AND `ready()` holds. */
    function onClickAdvance(ready: () => boolean) {
      return (el?: Element) =>
        el?.addEventListener('click', () => advanceWhen(ready), { once: true })
    }

    /** "Siguiente" that navigates first (for nav steps), then waits for `ready`. */
    function navNext(path: string, ready: () => boolean) {
      return () => {
        navigateRef.current(path)
        advanceWhen(ready)
      }
    }

    /** "Siguiente" that only proceeds once `gate()` is satisfied. */
    function gatedNext(gate: () => boolean, ready: () => boolean) {
      return () => {
        if (gate()) advanceWhen(ready)
      }
    }

    const steps: DriveStep[] = [
      {
        popover: {
          title: '¡Bienvenido/a a TIAM! 👋',
          description:
            'Te acompaño a hacer las 3 cosas clave: crear un paciente, armar una sesión y enviar un ejercicio. Vas haciendo cada paso vos. Podés salir cuando quieras con la ×.',
          // Opens the mobile drawer before highlighting the first nav link.
          onNextClick: () => goNext(),
        },
      },
      // ── Flow 1 · Create a patient ───────────────────────────────────────────
      {
        element: sel.navPatients,
        popover: {
          title: 'Paso 1 · Tus pacientes',
          description: 'Todo arranca acá. Hacé click en “Pacientes”.',
          side: 'right',
          align: 'start',
          onNextClick: navNext('/patients', present(sel.newPatientBtn)),
        },
        onHighlighted: onClickAdvance(present(sel.newPatientBtn)),
      },
      {
        element: sel.newPatientBtn,
        popover: {
          title: 'Creá tu primer paciente',
          description: 'Hacé click en “Nuevo paciente” para abrir el formulario.',
          side: 'bottom',
          align: 'end',
          showButtons: ACTION_ONLY,
        },
        onHighlighted: onClickAdvance(present(sel.patientForm)),
      },
      {
        element: sel.patientForm,
        popover: {
          title: 'Cargá los datos',
          description:
            'Completá el nombre y la fecha de nacimiento (son obligatorios). Después tocá “Siguiente”.',
          side: 'left',
          align: 'start',
          onNextClick: gatedNext(patientFormReady, present(sel.patientFormSubmit)),
        },
      },
      {
        element: sel.patientFormSubmit,
        popover: {
          title: 'Guardá el paciente',
          description: 'Hacé click en “Guardar”. ¡Ya tenés tu primer paciente cargado!',
          side: 'top',
          align: 'start',
          showButtons: ACTION_ONLY,
        },
        // Advance only when the form actually closes (i.e. it saved).
        onHighlighted: onClickAdvance(absent(sel.patientForm)),
      },
      // ── Flow 2 · Build a session ────────────────────────────────────────────
      {
        element: sel.navLibrary,
        popover: {
          title: 'Paso 2 · Armá una sesión',
          description: 'Ahora vamos a la biblioteca de ejercicios. Hacé click en “Biblioteca”.',
          side: 'right',
          align: 'start',
          onNextClick: navNext('/library', present(sel.addExerciseBtn)),
        },
        onHighlighted: onClickAdvance(present(sel.addExerciseBtn)),
      },
      {
        element: sel.addExerciseBtn,
        popover: {
          title: 'Elegí un ejercicio',
          description: 'Hacé click en el “+” de un ejercicio para sumarlo a la sesión.',
          side: 'left',
          align: 'start',
          showButtons: ACTION_ONLY,
        },
        // The "Armar sesión" button only appears once an exercise is added.
        onHighlighted: onClickAdvance(present(sel.buildSessionBtn)),
      },
      {
        element: sel.buildSessionBtn,
        popover: {
          title: 'Armá la sesión',
          description: 'Listo, sumaste un ejercicio. Hacé click en “Armar sesión”.',
          side: 'bottom',
          align: 'end',
          onNextClick: navNext('/sessions/builder', present(sel.sessionPatientSelect)),
        },
        onHighlighted: onClickAdvance(present(sel.sessionPatientSelect)),
      },
      {
        element: sel.sessionPatientSelect,
        popover: {
          title: 'Asigná el paciente',
          description:
            'Elegí en la lista el paciente que acabás de crear. Después tocá “Siguiente”.',
          side: 'right',
          align: 'start',
          onNextClick: gatedNext(sessionPatientChosen, present(sel.saveSessionBtn)),
        },
      },
      {
        element: sel.saveSessionBtn,
        popover: {
          title: 'Guardá la sesión',
          description: 'Hacé click en “Guardar sesión”. Te lleva directo a la ficha del paciente.',
          side: 'top',
          align: 'start',
          showButtons: ACTION_ONLY,
        },
        // Advance only once we land on the patient detail (the send button appears).
        onHighlighted: onClickAdvance(present(sel.sendExerciseBtn)),
      },
      // ── Flow 3 · Send a home exercise ───────────────────────────────────────
      {
        element: sel.sendExerciseBtn,
        popover: {
          title: 'Paso 3 · Enviá un ejercicio',
          description: 'Hacé click en “Enviar ejercicio a domicilio” para generar el enlace.',
          side: 'top',
          align: 'start',
          showButtons: ACTION_ONLY,
        },
        onHighlighted: onClickAdvance(present(sel.whatsappShareBtn)),
      },
      {
        element: sel.whatsappShareBtn,
        popover: {
          title: '¡Listo! 🎉',
          description:
            'Desde acá compartís el ejercicio por WhatsApp y tu paciente lo hace desde su celular. Eso es todo: ya sabés crear pacientes, armar sesiones y enviar ejercicios.',
          side: 'top',
          align: 'start',
        },
      },
    ]

    const tour = driver({
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: '¡Listo!',
      overlayColor: '#16263F',
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 12,
      popoverClass: 'tiam-tour',
      steps,
      onCloseClick: () => tour.destroy(),
      onDestroyStarted: () => {
        if (!tour.hasNextStep()) tour.destroy()
      },
      onDestroyed: () => {
        if (!suppressFlag.current) localStorage.setItem(TOUR_FLAG, '1')
      },
    })

    tourRef.current = tour
    navigateRef.current('/library')
    window.setTimeout(() => tour.drive(), 350)
  }, [])

  useEffect(() => {
    if (localStorage.getItem(TOUR_FLAG)) return
    const t = window.setTimeout(() => startTour(), 700)
    return () => window.clearTimeout(t)
  }, [startTour])

  useEffect(() => {
    const handler = () => startTour()
    window.addEventListener(START_TOUR_EVENT, handler)
    return () => window.removeEventListener(START_TOUR_EVENT, handler)
  }, [startTour])

  useEffect(() => {
    return () => {
      suppressFlag.current = true
      tourRef.current?.destroy()
    }
  }, [])

  return null
}
