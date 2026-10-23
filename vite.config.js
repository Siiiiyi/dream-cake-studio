import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.DEPLOY_TARGET === 'github-pages' ? '/dream-cake-studio/' : '/',
});
