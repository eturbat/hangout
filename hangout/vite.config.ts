import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // Forward API calls to the Nest server in development, so the browser sees
    // a single origin and no CORS setup is needed.
    proxy: { '/api': 'http://localhost:3000' },
  },
})
