import { FileEditResult } from '@common/types/misc';

import FileUtils, { FilePathDTO } from '@FileUtils';

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
    const dto = FileUtils.parse(configuredSettings.targetFile);
    fileDTOs = [dto];
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
