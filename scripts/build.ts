import logger from '@logger';
import shell from '@shell';
import { build as esbuild } from 'esbuild';
import fs from 'fs/promises';

import uFile from '@utilm/uFile';

import onInit from '@common/utils/fns/onInit';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// An import of one of the tsconfig `paths` aliases, which consumers can't resolve
const ALIAS_IMPORT = /from ['"]@(src|common|utilm|logger|shell)\b[^'"]*['"]/;

// ========================================================================= //
//                                    RUN                                    //
// ========================================================================= //

await onInit(async () => {
  // --- Delete and recreate the folder to keep things clean
  await uFile.emptyDir('lib');

  // ---- Typecheck
  // A type error rejects, so `onInit` exits non-zero before anything is built.
  await shell('tsc', ['-p', 'tsconfig.build.json', '--noEmit']);

  // ---- Bundle types
  // Bundle only the public API's types into a single `lib/index.d.ts`, so no
  // internal .d.ts files are published and path aliases are resolved.
  await shell('dts-bundle-generator', [
    '--project',
    'tsconfig.build.json',
    '-o',
    'lib/index.d.ts',
    'src/index.ts',
  ]);
  const types = await fs.readFile('lib/index.d.ts', 'utf8');
  const alias = types.match(ALIAS_IMPORT);
  if (alias) {
    throw new Error(`lib/index.d.ts has an unresolved path alias: ${alias[0]}`);
  }

  // ---- Build and bundle runtime code
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
