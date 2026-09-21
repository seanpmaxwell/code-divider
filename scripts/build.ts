import { build as esbuild } from 'esbuild';
import fs from 'fs/promises';

import logger from '@logger';

import onInit from '@dev-tools/onInit';
import shell from '@dev-tools/shell';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

await onInit(async () => {
  // --- Delete and recreate the folder to keep things clean
  await fs.rm('./lib', { recursive: true, force: true });

  // ---- Typecheck
  // A type error rejects, so `onInit` exits non-zero before anything is built.
  await shell('tsc', ['-p', 'tsconfig.build.json', '--noEmit']);

  // ---- Bundle types
  await shell('dts-bundle-generator', [
    '--project',
    'tsconfig.build.json',
    '-o',
    'lib/index.d.ts',
    'src/index.ts',
  ]);

  // ---- Build and bundle runtime code
  // The version is inlined so the CLI's `--version` needs no filesystem read.
  const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
  await esbuild({
    define: { __CODE_DIVIDER_VERSION__: JSON.stringify(version) },
    entryPoints: {
      index: 'src/index.ts',
      cli: 'src/cli/main.ts',
    },
    outdir: 'lib',
    bundle: true,
    splitting: true,
    minify: true,
    format: 'esm',
    platform: 'node',
  });

  // ---- Finish
  logger.info('Finished building. Output written to "lib/"');
}, 'build');
