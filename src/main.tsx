import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// NOTE: intentionally not wrapped in <StrictMode>. The renderer drives an
// imperative, stateful engine (refs + a long-lived WebGL scene); StrictMode's
// double-invoked effects in development would reset/duplicate that state.
createRoot(document.getElementById('root')!).render(<App />)
