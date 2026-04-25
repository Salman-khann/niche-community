import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { applyUserPreferences, loadUserPreferences } from './utils/userPreferences'

const GOOGLE_CLIENT_ID = '790222953164-h67j494qmt8gjl4pluvmb69mgoqjkoej.apps.googleusercontent.com'

applyUserPreferences(loadUserPreferences())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)
