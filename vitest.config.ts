import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      constants: fromRoot('./src/constants'),
      config: fromRoot('./src/config'),
      features: fromRoot('./src/features'),
      lib: fromRoot('./src/lib'),
      repositories: fromRoot('./src/repositories'),
      services: fromRoot('./src/services'),
      utils: fromRoot('./src/utils'),
    },
  },
  test: {
    exclude: ['server/**', 'node_modules/**', 'build/**', 'dist/**'],
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
  },
})
