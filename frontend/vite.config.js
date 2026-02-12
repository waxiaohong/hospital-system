import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

let backendPort = 8080 

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      }
    }
  }
})