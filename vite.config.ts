import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: any;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    base: './', 
    build: {
      outDir: 'dist',
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000', // Assuming standard Vercel dev port
          changeOrigin: true,
          secure: false,
        }
      }
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})