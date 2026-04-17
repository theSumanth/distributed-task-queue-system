import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/database/migrate.ts', 'src/workers/*.worker.ts'],
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
