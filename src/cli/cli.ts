import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import insertCodeDividers from '@src/api';

import DefaultConfig from '@common/constants/DefaultConfig';

import logger from '@logger';

import cmdLineParser from './_internal/cmdLineParser';
import HELP_TEXT from './_internal/HELP_TEXT';
import initDir from './_internal/initDir';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

/**
 * Run the `code-divider` CLI: parse `args`, then either print help/version,
 * write a config file (`--init`), or insert code-dividers.
 */
async function cli(args: string[], cwd: string): Promise<unknown> {
  // ---- parse the command-line-arguments
  const pArgs = await cmdLineParser(args);

  // ---- `help/version/init`
  if (pArgs.help || pArgs.version || pArgs.init) {
    if (args.length === 1) {
      const thisFilePath = fileURLToPath(import.meta.url);
      const thisFileDir = path.dirname(thisFilePath);
      if (pArgs.help) {
        return logger.info(HELP_TEXT);
      } else if (pArgs.version) {
        const version = await readVersion(thisFileDir);
        return process.stdout.write(`${version}\n`);
      }
    }
    // `cmdLineParser` guarantees `init` is alone (apart from its directory)
    if (pArgs.init) {
      const filePath = await initDir(pArgs.init, DefaultConfig);
      return logger.info(`code-divider: created ${filePath}\n`);
    }
    throw new Error(
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

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Look at the package.json and return the version. Walks up from the
 * directory this file lives in, so it works both from the bundled `lib/cli.js`
 * (one level down) and from `src/cli/cli.ts` (two levels down).
 *
 * @private {@link cli}
 */
async function readVersion(startDir: string): Promise<string> {
  let dir = startDir;
  while (true) {
    const filePath = path.join(dir, 'package.json');
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const packageJson = JSON.parse(content);
      if (packageJson.name === 'code-divider') return packageJson.version;
    } catch {
      // Not here, keep walking up
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Could not find package.json');
    dir = parent;
  }
}

// ========================================================================= //
//                                   EXPORT                                  //
// ========================================================================= //

export default cli;
