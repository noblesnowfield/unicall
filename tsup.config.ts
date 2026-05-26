import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/cli.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
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
      'unicall.browser': 'browser/index.ts'
    },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    target: 'es2022',
    outDir: 'dist',
    outExtension() {
      return {
        js: '.mjs'
      };
    }
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
