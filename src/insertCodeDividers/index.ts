import fileUtils from 'my-tools/fileUtils';

import applyFormatting from './applyFormatting';
import configureSettings from './configureSettings';

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
  const files = await fileUtils.filterDirItemsGlob(
    filter.include,
    filter.exclude,
    targetPath,
  );
  const fileDTOs = files.map((file) => fileUtils.parse(file, targetPath)); 
  // Insert code-dividers
  await applyFormatting(fileDTOs, extensionsMap);
  return files;
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default insertCodeDividers;
