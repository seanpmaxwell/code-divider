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
 *
 * @main
 */
await onInit(async () => {
  const args = process.argv.slice(2);
  const cwd = process.cwd();

  /** Process Command-Line-Arguments @see {ParsedCmdLineArgs} */
  const pArgs = await parseCmdLineArgs(args);

  // == `-help/-version` == //
  if (args.length === 1 && (pArgs.help || pArgs.version)) {
    const thisFilePath = fileURLToPath(import.meta.url);
    const thisFileDir = path.dirname(thisFilePath);
    if (pArgs.help) {
      return loadHelpArgContent(thisFileDir);
    } else if (pArgs.version) {
      return readVersion(thisFileDir);
    }
  }

  // == `-init` == //
  // Add a configuration file to a directory
  if ([1, 2].includes(args.length) && pArgs.init) {
    return addConfigFileToDir(pArgs.init);
  }

  // == `insertCodeDividers` == //
  const { path, config, dryRun } = pArgs;
  const filesChanged = insertCodeDividers(cwd, path, config, dryRun);
  const numOfFilesChanged = filesChanged.length;

  // == Finish == //
  const verb = pArgs.dryRun ? 'would be updated' : 'updated';
  const message = `code-divider: ${numOfFilesChanged} file/s ${verb}.\n`;
  process.stdout.write(message);
}, 'main');

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Load the contents of the `--help` flag
 *
 * @private
 * @param {string} cliFileDir
 * @returns {Promise<string>}
 */
async function loadHelpArgContent(cliFileDir) {
  const helpContentFilePath = path.join(cliFileDir, 'help.txt');
  const content = await fs.readFile(helpContentFilePath);
  return process.stdout.write(content);
}

/**
 * Look at the package.json and return the version.
 *
 * @private
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
 * When the init flag is used, copy the in-memory configuration settings to
 * as JSON file
 *
 * @private
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
