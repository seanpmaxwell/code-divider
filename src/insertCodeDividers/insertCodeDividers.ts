import path from 'path';

import { CONFIG_FILE_NAME } from '@common/constants/misc';
import { FileEditResult } from '@common/types/misc.js';

import FileUtils from '@FileUtils';

import applyFormatting from './applyFormatting/applyFormatting';
import configureSettings from './configureSettings/configureSettings';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Process a path (file or directory). Directories are walked recursively.
 * Returns the list of file paths that were updated.
 */
async function insertCodeDividers(
  cwd: string,
  targetPath: string,
  configFilePath: string,
  isDryRun: boolean,
): Promise<string[]> {
  // Load settings
  const configuredSettings = await configureSettings(
    cwd,
    targetPath,
    configFilePath,
  );
  // Setup list of files to inspect
  let fileDTOs: File = [];
  if (configuredSettings.targetFile === null) {
    const { filter, targetDir } = configuredSettings;
    const fileDTOs = await FileUtils.globSearch(
      filter.include,
      filter.exclude,
      targetDir,
    );
  }

  // Insert code-dividers
  const updatedFiles: FileEditResult[] = await applyFormatting(
    fileDTOs,
    configuredSettings.extensionsMap,
    isDryRun,
  );
  // Return
  return updatedFiles.map((file) => file.fullPath);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default insertCodeDividers;
