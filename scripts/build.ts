import logger from '@logger';
import shell from '@shell';
import { build as esbuild } from 'esbuild';

import uFile from '@utilm/uFile';

import onInit from '../dev-tools/onInit';

// ========================================================================= //
//                                    INIT                                   //
// ========================================================================= //

await onInit(async () => {
  // --- Delete and recreate the folder to keep things clean
  await uFile.emptyDir('lib');

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
  await esbuild({
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
