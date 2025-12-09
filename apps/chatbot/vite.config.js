import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // CSS handled by postcss.config.mjs
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/widget-entry.tsx'),
      name: 'ChatWidgetLib',
      fileName: (format) => `widget-bundle.${format}.js`,
      formats: ['iife']
    },
    cssCodeSplit: false,
    rollupOptions: {
      // Externalize deps that will be available globally via CDN
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    },
    outDir: 'public',
    emptyOutDir: false // Don't delete public on build
  }
})

