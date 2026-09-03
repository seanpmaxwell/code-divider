import { build as esbuild } from 'esbuild';
import { $ } from 'execa';

import logger from '@logger';

// ========================================================================= //
//                                      Run                                  //
// ========================================================================= //
// Note 1:
//   This is a bundler, it's meant for libraries, not applications. You don't
//   need to bundle back-end code for applications
//
// Note 2:
//   Build step: compile src/ with TypeScript first, then bundle and minify it
//   from its single entry point into one self-contained lib/index.js, which is
//   what the published package points at. src/ stays the readable dev source;
//   lib/ is generated and git-ignored.
//
// Note 3:
//   TypeScript has to run first because esbuild only strips types, it never
//   checks them. Compiling up front means a type error aborts the build before
//   any bundle is written, rather than leaving a broken lib/ behind.

{
  try {
    // Delete and recreate the folder to keep things clean
    await $`rm -rf lib`;
    await $`mkdir lib`;

    // Typecheck src/ and emit the .d.ts files consumers use. tsc prints its own
    // errors, so on failure just exit with its status rather than dumping a Node
    // stack trace on top of them.
    await $`tsc -p tsconfig.build.json`;

    // Run the build
    await esbuild({
      entryPoints: ['src/index.ts'],
      outfile: 'lib/index.js',
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'node',
    });

    // Print finished
    await $`echo Finished Building. Output send to "lib/"`;
  } catch (err) {
    logger.error(err);
  }
}
