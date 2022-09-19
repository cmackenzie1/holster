import { build } from 'esbuild';

(async () => {
  try {
    await build({
      bundle: true,
      sourcemap: true,
      minify: false,
      mainFields: ['browser', 'node', 'main'],
      platform: 'browser',
      format: 'esm',
      target: ['es2022'],
      entryPoints: ['src/index.ts'],
      outfile: 'dist/index.mjs',
    });
  } catch (e) {
    console.error(e);
  }
})();
