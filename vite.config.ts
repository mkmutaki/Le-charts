
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

/**
 * Vite plugin: after every production build, replace the __BUILD_VERSION__
 * placeholder inside dist/service-worker.js with a unique timestamp.
 * This guarantees browsers detect a new SW on every deploy.
 */
function stampServiceWorker(): import('vite').Plugin {
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/service-worker.js');
      if (fs.existsSync(swPath)) {
        const version = Date.now().toString(36);
        let content = fs.readFileSync(swPath, 'utf-8');
        content = content.replace(/__BUILD_VERSION__/g, version);
        fs.writeFileSync(swPath, content);
        console.log(`\x1b[36m[SW]\x1b[0m Stamped service worker with version: ${version}`);
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    stampServiceWorker(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    minify: 'terser',
    sourcemap: mode === 'development',
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Explicit content hashes in every output filename — guarantees
        // unique URLs when source changes, enabling aggressive caching.
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-toast',
            'lucide-react'
          ],
          state: [
            'zustand',
            '@tanstack/react-query'
          ]
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production'
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand']
  }
}));
