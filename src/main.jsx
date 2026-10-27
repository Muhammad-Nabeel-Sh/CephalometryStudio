import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.js'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support: register the service worker in production builds only.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  import("./pwa.js").then((m) => m.registerServiceWorker()).catch(() => {});
}

// Dev-only debugging hooks (no-op in production builds).
if (import.meta.env.DEV) {
  import("./workspace/autoTrace.js").then((m) => { window.__cephAI = m; });
  import("./canvas/landmarkDetector.js").then((m) => { window.__cephAIDetector = m; });
  import("./data/landmarkModelInfo.js").then((m) => { window.__cephModelInfo = m; });
}
