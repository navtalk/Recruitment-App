import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: mode === 'development' ? '/' : '/Recruitment-App/',
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
}))
