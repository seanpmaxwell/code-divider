import logger_, { type ILogger, SilentLogger } from '@logger';
import path from 'path';

import uFile, { FilePathDTO } from '@utilm/uFile';

import RunContext from '@common/utils/fns/RunContext';

import applyFormatting from './applyFormatting/applyFormatting';
import configureSettings from './configureSettings/configureSettings';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

export interface InsertCodeDividersOptions {
  cwd?: string;
  configFilePath?: string;
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
 * `configFilePath` empty means "look for one in the target directory, then
 * the cwd, then fall back to the built-in defaults".
 */
async function insertCodeDividers(
  targetPath: string,
  options: InsertCodeDividersOptions = {},
): Promise<string[]> {
  const {
    cwd = process.cwd(),
    configFilePath,
    isDryRun = false,
    logger = logger_,
    silent = false,
  } = options;

  // ---- Init `RunContext`
  const ctx = RunContext({
    cwd: path.resolve(cwd),
    targetPathRaw: targetPath,
    configFilePath: configFilePath ?? null,
    isDryRun,
    // `silent` wins over a given logger
    logger: silent ? SilentLogger : logger,
  });

  // ---- Load settings
  await configureSettings(ctx);

  // ---- Get Files
  // Setup list of files to inspect, if targetFile is null then we need
  // to search a directory for all the files it contains
  let fileDTOs: FilePathDTO[];
  if (ctx.targetFile === null) {
    fileDTOs = await uFile.globSearch(
      ctx.configuredSettings.filter.include,
      ctx.configuredSettings.filter.exclude,
      ctx.targetDir,
    );
    // If it's just one file we don't need to search
  } else {
    const relativePath = path.relative(ctx.targetDir, ctx.targetFile);
    fileDTOs = [uFile.parse(relativePath, ctx.targetDir)];
  }

  // ---- Insert code-dividers
  return applyFormatting(fileDTOs, ctx);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default insertCodeDividers;
