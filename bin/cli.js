#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import insertCodeDividers from '../lib';
import {
  initializeDirectory,
  onInit,
  parseCmdLineArgs,
} from '../lib/cli-helpers';

// ========================================================================= //
//                                   DOCS                                    //
// ========================================================================= //

/**
 * @typedef {Object} ParsedCmdLineArgs
 * @property {boolean} help - Whether `--help`/`-h` was passed.
 * @property {boolean} version - Whether `--version`/`-v` was passed.
 * @property {string} init - Target directory for the `init` command.
 * @property {boolean} dryRun - Whether `--dry-run`/`-n` was passed.
 * @property {string} path - The target path to process.
 * @property {string} config - Path to the config file to use.
 */

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

/**
 * Parsed command-line arguments for the `code-divider` CLI.
 */
await onInit(async () => {
  const args = process.argv.slice(2);
  const cwd = process.cwd();

  // == Process Command-Line-Arguments == //
  /** @see {ParsedCmdLineArgs} above for type */
  const parsedArgs = await parseCmdLineArgs(args);
  if (args.length === 1) {
    const thisFilePath = fileURLToPath(import.meta.url);
    const thisFileDir = path.dirname(thisFilePath);
    if (parsedArgs.help) {
      return loadHelpArgContent(thisFileDir);
    } else if (parsedArgs.version) {
      return readVersion(thisFileDir);
    }
  }
  // Add a configuration file to a directory
  if ([1, 2].includes(args.length) && parsedArgs.init) {
    return addConfigFileToDir(parsedArgs.init);
  }

  // == Insert Code-Dividers == //
  let numOfFilesChanged = 0;
  try {
    const { path, config, dryRun } = parsedArgs;
    const filesChanged = insertCodeDividers(cwd, path, config, dryRun);
    numOfFilesChanged = filesChanged.length;
  } catch (err) {
    process.stderr.write(`code-divider: ${p}: ${err.message}\n`);
    process.exitCode = 1;
  }

  // == Print finished message == //
  const verb = parsedArgs.dryRun ? 'would be updated' : 'updated';
  const message = `code-divider: ${numOfFilesChanged} file/s ${verb}.\n`;
  process.stdout.write(message);
})();

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

// /**
//  * @private
//  *
//  * Process the command-line arguments. If running insertCodeDividers, return an
//  * object with an array of paths (strings) and whether to do a dry-run, if not
//  * return `null`.
//  *
//  * @param {string[]} args
//  * @returns {object | null}
//  */
// async function processCommandLineArgs(args) {
//   // Get the directory of the the command-line-file
//   const cliFilePath = fileURLToPath(import.meta.url);
//   const cliFileDir = path.dirname(cliFilePath);

//   //   if (args[0] === 'init') {
//   //   try {
//   //     const filePath = initializeDirectory();
//   //     process.stdout.write(`code-divider: created ${filePath}\n`);
//   //   } catch (err) {
//   //     process.stderr.write(`code-divider: ${err.message}\n`);
//   //     process.exitCode = 1;
//   //   }
//   //   return;
//   // }

//   // Init retVal
//   const retVal = {
//     paths: [],
//     isDryRun: false,
//   };
//   // Process other command line arguments (besides init)
//   for (const arg of args) {
//     switch (arg) {
//       case '-h':
//       case '--help': {
//         const content = await loadHelpArgContent(cliFileDir);
//         process.stdout.write(content);
//         return null;
//       }
//       case '-v':
//       case '--version': {
//         const version = readVersion(cliFileDir);
//         process.stdout.write(`${version}\n`);
//         return null;
//       }
//       case '-n':
//       case '--dry-run':
//         retVal.isDryRun = true;
//         break;
//       default:
//         if (arg.startsWith('-')) {
//           process.stderr.write(`code-divider: unknown option '${arg}'\n`);
//           process.exitCode = 1;
//           return null;
//         }
//         retVal.paths.push(arg);
//     }
//   }
//   // If no paths, use the current directory.
//   if (retVal.paths.length === 0) {
//     retVal.paths.push('.');
//   }
//   // Return
//   return retVal;
// }

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
  const content = await fs.readFile(helpContentFilePath);
  return process.stdout.write(content);
}

/**
 * @private
 *
 * Look at the package.json and return the version.
 *
 * @param {string} cliFileDir
 * @returns {Promise<string>}
 */
async function readVersion(cliFileDir) {
  const filePath = path.join(cliFileDir, '..', 'package.json');
  const content = await fs.readFile(filePath);
  const packageJson = JSON.parse(content);
  return packageJson.version;
}

/**
 * @private
 *
 * @param {string} targetDir
 */
async function addConfigFileToDir(targetDir) {
  try {
    const filePath = initializeDirectory(targetDir);
    process.stdout.write(`code-divider: created ${filePath}\n`);
  } catch (err) {
    process.stderr.write(`code-divider: ${err.message}\n`);
    process.exitCode = 1;
  }
}
