#!/usr/bin/env node

import UserError from '@common/utils/classes/UserError';

import cli from './cli';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

main();

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Entry point for the command-line version. Errors caused by the user's
 * input print just their message; anything else prints the full error so a
 * bug can be reported.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  try {
    await cli(args, cwd);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      err instanceof UserError ? `code-divider: ${err.message}` : err,
    );
    process.exitCode = 1;
  }
}
