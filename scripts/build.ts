import { build as esbuild } from 'esbuild';

import FileUtils from '@modules/FileUtils';
import logger from '@modules/logger';

import onInit from '@common/utils/onInit';
import shell from '@common/utils/shell';

// ========================================================================= //
//                                    RUN                                    //
// ========================================================================= //

await onInit(async () => {
  // --- Delete and recreate the folder to keep things clean
  await FileUtils.emptyDir('lib');

  // ---- `Transpile`
  // Typecheck src/ and emit the .d.ts files consumers use. tsc prints its own
  // errors; a failure here rejects, so `onInit` exits non-zero and esbuild
  // never runs against broken code.
  await shell('tsc', ['-p', 'tsconfig.build.json']);

  // ---- `Build`
  // One call, two entry points: the library (`lib/index.js`) and the CLI
  // (`lib/cli.js`). `splitting` puts the code both entries share in a single
  // chunk instead of bundling a second copy of it into the CLI.
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
