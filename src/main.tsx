import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// react-three-fiber v9 still constructs `new THREE.Clock()` internally for its
// render loop, which logs a one-time r183 deprecation notice ("Clock: This
// module has been deprecated. Please use THREE.Timer instead."). It's emitted
// by the library, not our code, and there's nothing to act on until R3F
// migrates to Timer — so filter just that exact message to keep the console
// clean. All other warnings pass through untouched.
const originalWarn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Clock: This module has been deprecated')) {
    return
  }
  originalWarn(...args)
}

// NOTE: intentionally not wrapped in <StrictMode>. The renderer drives an
// imperative, stateful engine (refs + a long-lived WebGL scene); StrictMode's
// double-invoked effects in development would reset/duplicate that state.
createRoot(document.getElementById('root')!).render(<App />)

