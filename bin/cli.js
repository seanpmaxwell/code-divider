#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { onInit } from '../lib';
import insertCodeDividers, { initializeDirectory } from '../lib/index.js';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

// Module-load entry point. Wrapped in a named function (rather than firing
// directly at module scope) so early exits can use `return` and the async
// work below can be awaited properly.
await onInit(async () => {
  // == Initialize a directory == //
  // `init` option generates a default config file instead of inserting
  // code-dividers
  const args = process.argv.slice(2);
  if (args[0] === 'init') {
    try {
      const filePath = initializeDirectory();
      process.stdout.write(`code-divider: created ${filePath}\n`);
    } catch (err) {
      process.stderr.write(`code-divider: ${err.message}\n`);
      process.exitCode = 1;
    }
    return;
  }

  // == Process Command-Line-Arguments == //
  // Process other command line arguments (besides `init`). A null result means
  // the args were fully handled already (e.g. --help/--version), so stop here.
  const result = await processCommandLineArgs(args);
  if (!result) {
    return;
  }
  const { paths, isDryRun } = result;

  // == Insert Code-Dividers == //
  let total = 0;
  for (const p of paths) {
    try {
      const filesChanged = insertCodeDividers(p);
      total += filesChanged.length;
    } catch (err) {
      process.stderr.write(`code-divider: ${p}: ${err.message}\n`);
      process.exitCode = 1;
    }
  }

  // == Finish == //
  // Print finished message
  const verb = isDryRun ? 'would be updated' : 'updated';
  const message = `code-divider: ${total} file${total === 1 ? '' : 's'} ${verb}.\n`;
  process.stdout.write(message);
})();

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * @private
 *
 * Process the command-line arguments. If running insertCodeDividers, return an
 * object with an array of paths (strings) and whether to do a dry-run, if not
 * return `null`.
 *
 * @param {string[]} args
 * @returns {object | null}
 */
async function processCommandLineArgs(args) {
  // Get the directory of the the command-line-file
  const cliFilePath = fileURLToPath(import.meta.url);
  const cliFileDir = path.dirname(cliFilePath);
  // Init retVal
  const retVal = {
    paths: [],
    isDryRun: false,
  };
  // Process other command line arguments (besides init)
  for (const arg of args) {
    switch (arg) {
      case '-h':
      case '--help': {
        const content = await loadHelpArgContent(cliFileDir);
        process.stdout.write(content);
        return null;
      }
      case '-v':
      case '--version': {
        const version = readVersion(cliFileDir);
        process.stdout.write(`${version}\n`);
        return null;
      }
      case '-n':
      case '--dry-run':
        retVal.isDryRun = true;
        break;
      default:
        if (arg.startsWith('-')) {
          process.stderr.write(`code-divider: unknown option '${arg}'\n`);
          process.exitCode = 1;
          return null;
        }
        retVal.paths.push(arg);
    }
  }
  // If no paths, use the current directory.
  if (retVal.paths.length === 0) {
    retVal.paths.push('.');
  }
  // Return
  return retVal;
}

/**
 * @private
 *
 * Load the contents of the `--help` flag
 *
 * @param {string} cliFileDir
 * @returns {Promise<string>}
 */
async function loadHelpArgContent(cliFileDir) {
  const helpContentFilePath = path.join(cliFileDir, 'help.txt');
  return fs.readFile(helpContentFilePath);
}

/**
 * @private
 *
 * Look at the package.json and return the version.
 *
 * @param {string} cliFileDir
 * @returns {string}
 */
async function readVersion(cliFileDir) {
  const filePath = path.join(cliFileDir, '..', 'package.json');
  const content = await fs.readFile(filePath);
  const packageJson = JSON.parse(content);
  return packageJson.version;
}
