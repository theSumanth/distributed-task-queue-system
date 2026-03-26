import { defineConfig } from 'tsup';
import { existsSync } from 'node:fs';

const hasWorker = existsSync('src/worker.ts');

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    ...(hasWorker ? { worker: 'src/worker.ts' } : {}),
    migrate: 'src/database/migrate.ts',
  },
  format: ['cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: process.env.NODE_ENV === 'production',
  target: 'es2022',
  outDir: 'dist',
  treeshake: true,
  bundle: true,
  skipNodeModulesBundle: true,
  platform: 'node',
  shims: true,
});
