import path from 'path';

import FileUtils, { FilePathDTO } from '@modules/FileUtils';

import applyFormatting from './applyFormatting/applyFormatting';
import configureSettings from './configureSettings/configureSettings';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

export interface InsertCodeDividersOptions {
  cwd?: string;
  configFilePath?: string;
  isDryRun?: boolean;
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
    configFilePath = '',
    isDryRun = false,
  } = options;

  // ---- Load settings
  const cwdAbs = path.resolve(cwd);
  const configuredSettings = await configureSettings(
    cwdAbs,
    targetPath,
    configFilePath,
  );

  // ---- Get Files
  // Setup list of files to inspect, if targetFile is null then we need
  // to search a directory for all the files it contains
  let fileDTOs: FilePathDTO[];
  if (configuredSettings.targetFile === null) {
    const { filter, targetDir } = configuredSettings;
    fileDTOs = await FileUtils.globSearch(
      filter.include,
      filter.exclude,
      targetDir,
    );
    // If it's just one file we don't need to search
  } else {
    const { targetFile, targetDir } = configuredSettings;
    const relativePath = path.relative(targetDir, targetFile);
    fileDTOs = [FileUtils.parse(relativePath, targetDir)];
  }

  // ---- Insert code-dividers
  return applyFormatting(fileDTOs, configuredSettings.extensionsMap, isDryRun);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default insertCodeDividers;
