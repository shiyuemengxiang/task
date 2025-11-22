import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 关键：使用相对路径，确保在 Vercel/GitHub Pages/子目录下都能正确引用资源
  build: {
    outDir: 'dist',
  }
})