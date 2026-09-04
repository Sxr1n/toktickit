import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Integration tests share one real Postgres database rather than mocking it,
    // so files must not run concurrently against the same fixture data.
    fileParallelism: false,
  },
})
