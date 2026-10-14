import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/Spinner'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'

import { LandingPage } from '@/pages/landing/LandingPage'
import { PlataformaPage } from '@/pages/plataforma/PlataformaPage'
import { PlataformaComingSoonPage } from '@/pages/plataforma/PlataformaComingSoonPage'
import { PLATFORM_LAUNCHED } from '@/lib/platform'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { LibraryPage } from '@/pages/library/LibraryPage'
import { ExerciseDetailPage } from '@/pages/library/ExerciseDetailPage'
import { MyExerciseFormPage } from '@/pages/library/MyExerciseFormPage'
import { AdminExerciseListPage } from '@/pages/admin/AdminExerciseListPage'
import { AdminExerciseFormPage } from '@/pages/admin/AdminExerciseFormPage'
import { PatientsPage } from '@/pages/patients/PatientsPage'
import { PatientDetailPage } from '@/pages/patients/PatientDetailPage'
import { SessionBuilderPage } from '@/pages/sessions/SessionBuilderPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SubscriptionPage } from '@/pages/subscription/SubscriptionPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'
import { TermsPage } from '@/pages/legal/TermsPage'
import { PrivacyPage } from '@/pages/legal/PrivacyPage'
import { PatientPlayPage } from '@/pages/play/PatientPlayPage'
import { BlogListPage } from '@/pages/blog/BlogListPage'
import { BlogPostPage } from '@/pages/blog/BlogPostPage'
import { ClinicalFaqPage } from '@/pages/faq/ClinicalFaqPage'
import { DemoTourPage } from '@/pages/demo/DemoTourPage'
import { RecursosPage } from '@/pages/recursos/RecursosPage'
import { TalleresPage } from '@/pages/talleres/TalleresPage'
import { MaterialDigitalPage } from '@/pages/material-digital/MaterialDigitalPage'
import { Desafio30DiasPage } from '@/pages/desafio-30-dias/Desafio30DiasPage'
import { DesafioExitoPage } from '@/pages/desafio-30-dias/DesafioExitoPage'
import { DesafioPlayPage } from '@/pages/desafio/DesafioPlayPage'

// Pack post-purchase pages: loaded on demand so they add nothing to the bundle every other visitor downloads.
const GraciasPage = lazy(() => import('@/pages/pack/GraciasPage').then((m) => ({ default: m.GraciasPage })))
const DescargasPage = lazy(() => import('@/pages/pack/DescargasPage').then((m) => ({ default: m.DescargasPage })))
const RecuperarPage = lazy(() => import('@/pages/pack/RecuperarPage').then((m) => ({ default: m.RecuperarPage })))

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-white">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public — landing */}
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/plataforma"
              element={PLATFORM_LAUNCHED ? <PlataformaPage /> : <PlataformaComingSoonPage />}
            />

            {/* Public — legal */}
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            {/* Public — content & lead-gen */}
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/preguntas-frecuentes" element={<ClinicalFaqPage />} />
            <Route path="/demo" element={<DemoTourPage />} />
            <Route path="/recursos" element={<RecursosPage />} />
            <Route path="/talleres" element={<TalleresPage />} />
            {/* /pack/familias and /pack/profesionales are the Pack's static landings (pack/ at the
                repo root, served through vercel.json rewrites, outside this app): don't build
                routes for them here, and link to them with a plain <a>, never <Link>. The three
                routes below are the Pack's post-purchase pages, which ARE part of this app. Their
                order token must never reach a third party: see vercel.json (headers) and
                pages/pack/PackShell.tsx. */}
            <Route path="/pack/gracias" element={<Lazy><GraciasPage /></Lazy>} />
            <Route path="/pack/descargas/:token" element={<Lazy><DescargasPage /></Lazy>} />
            <Route path="/pack/recuperar" element={<Lazy><RecuperarPage /></Lazy>} />
            <Route path="/material-digital" element={<MaterialDigitalPage />} />
            <Route path="/desafio-30-dias" element={<Desafio30DiasPage />} />
            <Route path="/desafio-30-dias/exito" element={<DesafioExitoPage />} />

            {/* Public — patient at-home exercise (WhatsApp link) */}
            <Route path="/jugar/:token" element={<PatientPlayPage />} />

            {/* Public — 30-day challenge content (WhatsApp link) */}
            <Route path="/desafio/:token" element={<DesafioPlayPage />} />

            {/* Public — auth */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* Protected — auth only (reachable even with expired trial) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/subscription" element={<SubscriptionPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            {/* Protected — auth + active access (paywall) */}
            <Route element={<ProtectedRoute requireAccess />}>
              <Route element={<AppLayout />}>
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/library/new" element={<MyExerciseFormPage />} />
                <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/patients/:id" element={<PatientDetailPage />} />
                <Route path="/sessions/builder" element={<SessionBuilderPage />} />

                {/* Admin only */}
                <Route element={<ProtectedRoute requireAdmin requireAccess />}>
                  <Route path="/admin/exercises" element={<AdminExerciseListPage />} />
                  <Route path="/admin/exercises/new" element={<AdminExerciseFormPage />} />
                  <Route path="/admin/exercises/:id/edit" element={<AdminExerciseFormPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
