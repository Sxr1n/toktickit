import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import App from './App.tsx'
import AppShell from './components/AppShell.tsx'
import { RequesterProvider } from './context/RequesterContext.tsx'
import RequesterSelection from './pages/RequesterSelection.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RequesterProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/select-requester" element={<RequesterSelection />} />
          </Routes>
        </AppShell>
      </RequesterProvider>
    </BrowserRouter>
  </StrictMode>,
)
