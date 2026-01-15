import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 2222,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:6500',
        ws: true,
      },
    },
  },
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
});
