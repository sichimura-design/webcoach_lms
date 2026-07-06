import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { MOCKS_ENABLED } from './mocks/config';

// trigger ci
async function bootstrap() {
  // モック有効時のみ MSW を起動（本番バンドルには読み込まれない）
  if (MOCKS_ENABLED) {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      // サブパス配信（/branches/<slug>/）でも worker を正しく解決するため PUBLIC_URL 起点で指定
      serviceWorker: { url: `${process.env.PUBLIC_URL || ''}/mockServiceWorker.js` },
    });
  }

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
