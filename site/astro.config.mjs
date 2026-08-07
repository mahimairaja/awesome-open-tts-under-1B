import { defineConfig } from 'astro/config';

// The site is published to GitHub Pages from the repo of the same name, so it
// is served under /awesome-open-tts-under-1B rather than at the domain root.
export default defineConfig({
  site: 'https://mahimairaja.github.io',
  base: '/awesome-open-tts-under-1B',
});
