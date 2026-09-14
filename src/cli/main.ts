#!/usr/bin/env node

import cli from './cli';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

main();

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Entry point for the command-line version
 */
async function main(): Promise<unknown> {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  try {
    await cli(args, cwd);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return (process.exitCode = 1);
  }
}
