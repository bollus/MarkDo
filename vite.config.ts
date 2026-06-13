import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        note: 'note.html',
        quick: 'quick.html',
        deadline: 'deadline.html'
      }
    }
  }
});
