import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // Forward API calls to the Nest server in development, so the browser sees
    // a single origin and no CORS setup is needed.
    // /socket.io carries real-time updates, so WebSocket upgrades are forwarded too.
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
})
