import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/lib/context/ThemeContext'
import { AuthProvider } from '@/lib/context/AuthContext'
import { ToastProvider } from '@/lib/context/ToastContext'
import { ConfirmProvider } from '@/lib/context/ConfirmContext'
import { ToastContainer } from '@/components/ui/Toast'
import { ClaimsNotice } from '@/components/finance/ClaimsNotice'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import App from './App'
import './globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <App />
              <ToastContainer>
                <ClaimsNotice />
              </ToastContainer>
              <ConfirmDialog />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
