import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/dev/' : '/',
  server: {
    allowedHosts: ['ballot-vm.local', 'ballot.arkavo.org', 'webapp'],
    hmr: {
      host: 'ballot.arkavo.org',
      protocol: 'wss',
      port: 443,
      clientPort: 443,
      path: '/',
    },
  },
}))
