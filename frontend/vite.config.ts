import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/workflows': { target: 'http://localhost:8000' },
      '/api/auth': {
        target: 'http://localhost:8000',
        configure(proxy) {
          proxy.on('proxyReq', (proxyRequest, request) => {
            // Keep LAN requests same-origin in the browser and preserve the
            // backend's origin check for requests from other sites.
            if (request.headers.origin === `http://${request.headers.host}`) {
              proxyRequest.setHeader('Origin', 'http://localhost:5173');
            }
          });
        },
      },
    },
  },
});
