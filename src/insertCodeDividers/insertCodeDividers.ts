import fileUtils from '@src/common/utils/fileUtils';
import configureSettings from './configureSettings';
import applySettingsToFiles from './applySettingsToFiles';

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
  // Insert code-dividers
  await applySettingsToFiles(targetPath, files, extensionsMap)
  // 
  return files;
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default insertCodeDividers;
