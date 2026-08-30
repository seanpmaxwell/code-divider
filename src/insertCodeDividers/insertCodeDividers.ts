import { FileEditResult } from '#src/common/types/misc.js';
import FileUtils from 'my-tools/FileUtils';

import applyFormatting from './applyFormatting/applyFormatting';
import configureSettings from './configureSettings/configureSettings';

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Process a path (file or directory). Directories are walked recursively.
 * Returns the list of file paths that were updated.
 */
async function insertCodeDividers(
  targetPath = process.cwd(),
): Promise<string[]> {
  // Load settings
  const { filter, extensionsMap } = await configureSettings(targetPath);
  // Setup list of files to inspect
  const fileDTOs = await FileUtils.globSearch(
    filter.include,
    filter.exclude,
    targetPath,
  );
  // Insert code-dividers
  const updatedFiles: FileEditResult[] = await applyFormatting(
    fileDTOs,
    extensionsMap,
  );
  // Return
  return updatedFiles.map((file) => file.fullPath);
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default insertCodeDividers;
