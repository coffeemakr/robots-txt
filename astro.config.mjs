// @ts-check
import { defineConfig } from 'astro/config';

// Served from GitHub Pages at https://coffeemakr.github.io/robots-txt/
export default defineConfig({
  site: 'https://coffeemakr.github.io',
  base: '/robots-txt',
  output: 'static',
});
