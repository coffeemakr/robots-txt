import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Served from GitHub Pages at https://coffeemakr.github.io/robots-txt/
export default defineConfig({
  base: '/robots-txt/',
  plugins: [react()],
});
