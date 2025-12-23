
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Injecte les variables d'environnement système (Vercel) ou locales
    // Injection d'une variable factice ou suppression pour sécurité
    'process.env.API_KEY': JSON.stringify('proxied'),
    'process.env.TEACHER_PASSWORD': JSON.stringify(process.env.TEACHER_PASSWORD || process.env.VITE_TEACHER_PASSWORD || 'admin'),
  },
});
