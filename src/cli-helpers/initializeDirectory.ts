import path from 'path';

import DefaultConfig from '@common/constants/DefaultConfig.js';
import { CONFIG_FILE_NAME } from '@common/constants/misc.js';
import customStringifyObject from '@common/utils/customStringifyObject';

import FileUtils from '@FileUtils';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Generate a code-divider.config.json in the given directory (default: the directory
 * code-divider is being run from) containing all the default settings. Refuses to
 * overwrite an existing config. Returns the path of the written file.
 */
async function initializeDirectory(targetDir: string): Promise<string> {
  // Get the directory
  const targetDirNew = targetDir || process.cwd();
  const isDir = await FileUtils.isDir(targetDirNew);
  if (!isDir) throw new Error('target path is not a directory');
  // Get the path for the configuration file
  const configPath = path.join(targetDirNew, CONFIG_FILE_NAME);
  const configAlreadyExists = await FileUtils.exists(configPath);
  if (configAlreadyExists) {
    throw new Error(`${CONFIG_FILE_NAME} already exists here, not overwriting`);
  }
  // Save file content to JSON file
  await FileUtils.saveJsonFile(
    configPath,
    DefaultConfig,
    customStringifyObject,
  );
  // Return filepath
  return configPath;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default initializeDirectory;
