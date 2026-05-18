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
import { CombatantsPage } from './pages/combatants/CombatantsPage'
import { OptimizerPage } from './pages/optimizer/OptimizerPage'
import { AboutPage } from './pages/about/AboutPage'
import { HomePage } from './pages/home/HomePage'
import { ScoringPage } from './pages/scoring/ScoringPage'
import { SimulatorPage } from './pages/simulator/SimulatorPage'
import { EncyclopediaPage } from './pages/encyclopedia/EncyclopediaPage'
import { CardsTab } from './pages/encyclopedia/components/CardsTab'
import { EquipmentsTab } from './pages/encyclopedia/components/EquipmentsTab'
import { EngravingsTab } from './pages/encyclopedia/components/EngravingsTab'
import { GlossaryTab } from './pages/encyclopedia/components/GlossaryTab'
import { BattlePage } from './pages/battle/BattlePage'
import { DeckBuilderPage } from './pages/deck-builder/DeckBuilderPage'

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
          <Route index element={<HomePage />} />
          <Route path="optimizer"  element={<OptimizerPage />} />
          <Route path="fragments"  element={<FragmentsPage />} />
          <Route path="combatants" element={<CombatantsPage />} />
          <Route path="scoring"    element={<ScoringPage />} />
          <Route path="encyclopedia" element={<EncyclopediaPage />}>
            <Route index element={<Navigate to="cards" replace />} />
            <Route path="cards"      element={<CardsTab />} />
            <Route path="equipments" element={<EquipmentsTab />} />
            <Route path="engravings" element={<EngravingsTab />} />
            <Route path="glossary"   element={<GlossaryTab />} />
          </Route>
          <Route path="cards" element={<Navigate to="/encyclopedia/cards" replace />} />
          <Route path="deck-builder" element={<DeckBuilderPage />} />
          <Route path="simulator"  element={<SimulatorPage />} />
          <Route path="capture"    element={<CapturePage />} />
          <Route path="setup"      element={<SetupPage />} />
          <Route path="rescue"     element={<RescuePage />} />
          <Route path="battle"     element={<BattlePage />} />
          <Route path="about"      element={<AboutPage />} />
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
