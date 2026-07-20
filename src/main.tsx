import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CartProvider } from './contexts/CartContext'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import './index.css'
import App from './App.tsx'

// Utilitaire de seed démo (avis, commandes, clients fictifs) — dev uniquement,
// éliminé du build de production. Voir src/dev/seedDemoData.ts.
if (import.meta.env.DEV) {
  import('./dev/seedDemoData')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
