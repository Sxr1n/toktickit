import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import App from './App.tsx'
import AppShell from './components/AppShell.tsx'
import RequireAuth from './components/RequireAuth.tsx'
import RequireRole from './components/RequireRole.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import ChangePassword from './pages/ChangePassword.tsx'
import CreateTicket from './pages/CreateTicket.tsx'
import Login from './pages/Login.tsx'
import MyTickets from './pages/MyTickets.tsx'
import RequesterTicketDetail from './pages/RequesterTicketDetail.tsx'
import StaffTicketDetail from './pages/StaffTicketDetail.tsx'
import StaffTicketQueue from './pages/StaffTicketQueue.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/change-password"
              element={
                <RequireAuth>
                  <ChangePassword />
                </RequireAuth>
              }
            />
            <Route
              path="/create-ticket"
              element={
                <RequireRole roles={['REQUESTER']}>
                  <CreateTicket />
                </RequireRole>
              }
            />
            <Route
              path="/tickets"
              element={
                <RequireRole roles={['REQUESTER']}>
                  <MyTickets />
                </RequireRole>
              }
            />
            <Route
              path="/tickets/:id"
              element={
                <RequireRole roles={['REQUESTER']}>
                  <RequesterTicketDetail />
                </RequireRole>
              }
            />
            <Route
              path="/staff/tickets"
              element={
                <RequireRole roles={['IT_STAFF', 'ADMINISTRATOR']}>
                  <StaffTicketQueue />
                </RequireRole>
              }
            />
            <Route
              path="/staff/tickets/:id"
              element={
                <RequireRole roles={['IT_STAFF', 'ADMINISTRATOR']}>
                  <StaffTicketDetail />
                </RequireRole>
              }
            />
          </Routes>
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
