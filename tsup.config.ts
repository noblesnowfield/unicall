import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022'
  },
  {
    entry: {
      'browser/index': 'browser/index.ts'
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    outDir: 'dist'
  },
  {
    entry: {
      unicall: 'browser/index.ts'
    },
    format: ['iife'],
    globalName: 'Unicall',
    sourcemap: true,
    target: 'es2022',
    outDir: 'dist'
  }
]);
