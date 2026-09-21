import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { insertCodeDividers } from '@src/api';

import DefaultConfig from '@common/constants/DefaultConfig';
import UserError from '@common/utils/classes/UserError';

import logger from '@logger';

import cmdLineParser from './_internal/cmdLineParser';
import initDir from './_internal/initDir';
import printHelpText from './_internal/printHelpText';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Injected by esbuild at build time (see scripts/build.ts), so the bundled
// CLI answers `--version` without touching the filesystem. Absent when the
// source runs directly under tsx, where `loadVersionFromPkgJson` takes over.
declare const __CODE_DIVIDER_VERSION__: string | undefined;

const PACKAGE_NAME = 'code-divider';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Run the `code-divider` CLI: parse `args`, then either print help/version,
 * write a config file (`--init`), or insert code-dividers. Relative paths
 * are resolved against `cwd`.
 */
async function cli(args: string[], cwd: string): Promise<unknown> {
  // ---- parse the command-line-arguments
  const pArgs = cmdLineParser(args, cwd);

  // ---- `help/version/init`
  if (pArgs.help || pArgs.version || pArgs.init) {
    if (args.length === 1) {
      if (pArgs.help) return printHelpText();
      else if (pArgs.version) return printVersion();
    }
    // `cmdLineParser` guarantees `init` is alone (apart from its directory)
    if (pArgs.init) {
      const filePath = await initDir(pArgs.init, DefaultConfig, cwd);
      return logger.info(`code-divider: created ${filePath}\n`);
    }
    throw new UserError(
      'Invalid command-line arguments. Please use the "-h" flag for assistance',
    );
  }

  // ---- `insertCodeDividers` (`--check` never writes, same as a dry run)
  const filesChanged = await insertCodeDividers(pArgs.path, {
    cwd,
    configFilePath: pArgs.config,
    isDryRun: pArgs.dryRun || pArgs.check,
    logger,
  });
  const count = filesChanged.length;

  // ---- Print the list of files for `--check` and dry runs
  let finalMessage;
  if (pArgs.check || pArgs.dryRun) {
    if (count > 0) {
      logger.line();
      logger.info(filesChanged.join('\n'));
      logger.line();
    }
    if (pArgs.check) {
      finalMessage =
        count > 0
          ? `[Check] code-divider: ${count} file/s need code-dividers inserted`
          : '[Check] code-divider: all files are up to date';
      // Fail the process (CI, pre-commit) when something would change
      if (count > 0) process.exitCode = 1;
    } else {
      finalMessage = `[Dry Run] code-divider CLI: ${count} file/s would have been updated`;
    }
  } else {
    finalMessage = `code-divider CLI: ${count} file/s updated`;
  }

  // ---- Finish
  logger.info(finalMessage);
  return logger.line();
}

/**
 * Print the version inlined by the build. If it's absent (the source is
 * running unbundled) read it from package.json instead.
 *
 * Used by: {@link cli}
 *
 * @private
 */
async function printVersion(): Promise<boolean> {
  let version;
  if (typeof __CODE_DIVIDER_VERSION__ === 'string') {
    version = __CODE_DIVIDER_VERSION__;
  } else {
    const thisFileDir = path.dirname(fileURLToPath(import.meta.url));
    version = await loadVersionFromPkgJson(thisFileDir);
  }
  return process.stdout.write(`${version}\n`);
}

/**
 * Walk up from `startDir` to the package.json of this package and return its
 * version.
 *
 * Used by: {@link printVersion}
 *
 * @private
 */
async function loadVersionFromPkgJson(startDir: string): Promise<string> {
  let dir = startDir;
  while (true) {
    const filePath = path.join(dir, 'package.json');
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const packageJson = JSON.parse(content);
      if (packageJson.name === PACKAGE_NAME) return packageJson.version;
    } catch {
      // Not here, keep walking up
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Could not find package.json');
    dir = parent;
  }
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default cli;
