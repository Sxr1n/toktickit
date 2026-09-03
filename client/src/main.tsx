import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import App from './App.tsx'
import AppShell from './components/AppShell.tsx'
import RequireRequester from './components/RequireRequester.tsx'
import { RequesterProvider } from './context/RequesterContext.tsx'
import CreateTicket from './pages/CreateTicket.tsx'
import MyTickets from './pages/MyTickets.tsx'
import RequesterSelection from './pages/RequesterSelection.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RequesterProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/select-requester" element={<RequesterSelection />} />
            <Route
              path="/create-ticket"
              element={
                <RequireRequester>
                  <CreateTicket />
                </RequireRequester>
              }
            />
            <Route
              path="/tickets"
              element={
                <RequireRequester>
                  <MyTickets />
                </RequireRequester>
              }
            />
          </Routes>
        </AppShell>
      </RequesterProvider>
    </BrowserRouter>
  </StrictMode>,
)
