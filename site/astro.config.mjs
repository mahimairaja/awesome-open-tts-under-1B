import { defineConfig } from 'astro/config';

// Served from the root of a custom domain, so there is no base path.
//
// Do NOT reintroduce `base: '/awesome-open-tts-under-1B'`. That is only correct
// for the default mahimairaja.github.io/<repo> URL; on a custom domain it
// prefixes every asset href with a directory that does not exist, and the page
// loads with no CSS.
export default defineConfig({
  site: 'https://1btts.voicegateway.dev',
});
