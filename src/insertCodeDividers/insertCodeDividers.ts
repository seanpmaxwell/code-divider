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
  targetPath = process.cwd(),
): Promise<string[]> {
  // There's an issue with how targetPath and default include in the configSettings
  // is getting loaded.
  // Maybe the command line path should point to what to include: file or directory
  // Use a flag to set the configFile path to another directory
  // If there's not configpath flag look in current directory
  // if there's no configPath in current directory or directory set through flag
  // go with default settings.

  console.log('targetPath', targetPath);
  // Load settings
  const { filter, extensionsMap } = await configureSettings(targetPath);
  console.log('filter', filter);
  // Setup list of files to inspect
  const fileDTOs = await FileUtils.globSearch(
    filter.include,
    filter.exclude,
    targetPath,
  );
  console.log('globSearch', fileDTOs);
  // Insert code-dividers
  const updatedFiles: FileEditResult[] = await applyFormatting(
    fileDTOs,
    extensionsMap,
  );
  // Return
  return updatedFiles.map((file) => file.fullPath);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default insertCodeDividers;
