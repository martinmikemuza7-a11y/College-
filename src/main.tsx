import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker for offline shell and asset caching
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] New shell content available');
    },
    onOfflineReady() {
      console.log('[PWA] App shell cached for offline access');
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
