import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './components/layout/AppShell'
import { useApiPort } from './hooks/useApiPort'
import { setApiPort } from './lib/api'
import { FragmentsPage } from './pages/fragments/FragmentsPage'
import { SetupPage } from './pages/setup/SetupPage'
import { CapturePage } from './pages/capture/CapturePage'
import { RescuePage } from './pages/rescue/RescuePage'

function Placeholder({ name }: { name: string }) {
  return (
    <div className="p-8 text-[#a09d96]">
      <p className="text-lg">{name}</p>
      <p className="text-sm mt-1">Coming in a future plan.</p>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

function AppRoutes() {
  const port = useApiPort()
  useEffect(() => { setApiPort(port) }, [port])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/fragments" replace />} />
          <Route path="optimizer"  element={<Placeholder name="Optimizer" />} />
          <Route path="fragments"  element={<FragmentsPage />} />
          <Route path="combatants" element={<Placeholder name="Combatants" />} />
          <Route path="scoring"    element={<Placeholder name="Scoring" />} />
          <Route path="capture"    element={<CapturePage />} />
          <Route path="setup"      element={<SetupPage />} />
          <Route path="rescue"     element={<RescuePage />} />
          <Route path="about"      element={<Placeholder name="About" />} />
          <Route path="*"          element={<Navigate to="/fragments" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  )
}
