import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/Toast'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'

import { LandingPage } from '@/pages/landing/LandingPage'
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
import { ScreeningTestPage } from '@/pages/screening/ScreeningTestPage'
import { ClinicalFaqPage } from '@/pages/faq/ClinicalFaqPage'
import { DemoTourPage } from '@/pages/demo/DemoTourPage'

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

            {/* Public — legal */}
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            {/* Public — content & lead-gen */}
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/autoevaluacion" element={<ScreeningTestPage />} />
            <Route path="/preguntas-frecuentes" element={<ClinicalFaqPage />} />
            <Route path="/demo" element={<DemoTourPage />} />

            {/* Public — patient at-home exercise (WhatsApp link) */}
            <Route path="/jugar/:token" element={<PatientPlayPage />} />

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
