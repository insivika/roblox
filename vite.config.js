import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: './',
  publicDir: 'public',
  server: {
    port: 8080,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:6500',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html')
    }
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx']
  }
});
