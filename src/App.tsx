import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './components/layout/AppShell'
import { useApiPort } from './hooks/useApiPort'
import { setApiPort } from './lib/api'

function Placeholder({ name }: { name: string }) {
  return (
    <div className="p-8 text-[#a09d96]">
      <p className="text-lg">{name}</p>
      <p className="text-sm mt-1">Coming in a future plan.</p>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
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
          <Route path="fragments"  element={<Placeholder name="Memory Fragments" />} />
          <Route path="combatants" element={<Placeholder name="Combatants" />} />
          <Route path="scoring"    element={<Placeholder name="Scoring" />} />
          <Route path="capture"    element={<Placeholder name="Capture" />} />
          <Route path="setup"      element={<Placeholder name="Setup" />} />
          <Route path="rescue"     element={<Placeholder name="Rescue Records" />} />
          <Route path="about"      element={<Placeholder name="About" />} />
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
