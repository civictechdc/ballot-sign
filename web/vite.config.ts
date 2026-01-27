import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/dev/' : '/',
  server: {
    allowedHosts: ['ballot-vm.local', 'ballot.arkavo.org'],
  },
}))
