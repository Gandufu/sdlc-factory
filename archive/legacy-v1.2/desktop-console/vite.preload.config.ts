import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: { external: ['electron', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)] },
  },
});
