import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'KICKCRAFT_')
  return {
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => ['model-viewer', 'extra-model'].includes(tag),
        },
      },
    }),
    tailwindcss(),
  ],
  server: {
    port: Number(env.KICKCRAFT_DEV_PORT || 5173),
    strictPort: true,
    proxy: {
      '/api': {
        target: env.KICKCRAFT_API_TARGET || 'http://localhost/kickcraft',
        changeOrigin: true,
      },
    },
  },
  }
})
