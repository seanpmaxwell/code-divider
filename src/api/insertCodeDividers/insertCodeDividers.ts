import path from 'path';

import type { IRunContext } from '@common/types/RunContext';
import type { UserConfig } from '@common/types/settings';

import uFile, { FileCtx } from '@utilm/uFile';

import logger_, { type ILogger, SilentLogger } from '@logger';

import applyFormatting from './applyFormatting/applyFormatting';
import configureSettings from './configureSettings/configureSettings';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

export interface InsertCodeDividersOptions {
  cwd?: string;
  configFilePath?: string;
  config?: UserConfig;
  isDryRun?: boolean;
  logger?: ILogger;
  silent?: boolean;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Process a path (file or directory). Directories are walked recursively.
 * Returns the list of file paths that were updated.
 *
 * `targetPath` empty (the default) means the `cwd`. `configFilePath` empty
 * means "look for one in the target directory, then the cwd, then fall back
 * to the built-in defaults". An inline `config` replaces that lookup.
 */
async function insertCodeDividers(
  targetPath = '',
  options: InsertCodeDividersOptions = {},
): Promise<string[]> {
  const {
    cwd = process.cwd(),
    configFilePath,
    config,
    isDryRun = false,
    logger = logger_,
    silent = false,
  } = options;
  const cwdAbs = path.resolve(cwd);
  // `silent` wins over a given logger
  const loggerFinal = silent ? SilentLogger : logger;

  // ---- Load settings
  const settings = await configureSettings({
    cwd: cwdAbs,
    targetPath,
    configFilePath: configFilePath || null,
    config: config ?? null,
    logger: loggerFinal,
  });
  const ctx: IRunContext = {
    ...settings,
    cwd: cwdAbs,
    isDryRun,
    logger: loggerFinal,
  };

  // ---- Get Files
  // If the target is a directory search it for files, otherwise it's the
  // one file to inspect
  let fileDTOs: FileCtx[];
  if (ctx.targetFile === null) {
    fileDTOs = await uFile.globSearch(
      ctx.filter.include,
      ctx.filter.exclude,
      ctx.targetDir,
    );
  } else {
    fileDTOs = [uFile.parse(path.basename(ctx.targetFile), ctx.targetDir)];
  }

  // ---- Insert code-dividers
  return applyFormatting(fileDTOs, ctx);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default insertCodeDividers;
