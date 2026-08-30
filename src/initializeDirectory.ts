import FileUtils from 'my-tools/FileUtils';
import path from 'path';

import DefaultConfig from '@src/common/constants/DefaultConfig';
import { CONFIG_FILE_NAME } from '@src/common/constants/misc';

import customStringifyObject from './common/utils/customStringifyObject';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

const CONFIG_FILE_ALREADY_EXISTS_ERROR = `${CONFIG_FILE_NAME} already exists here, not overwriting`;

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Generate a code-divider.config.json in the given directory (default: the directory
 * code-divider is being run from) containing all the default settings. Refuses to
 * overwrite an existing config. Returns the path of the written file.
 */
async function initializeDirectory(
  dir: string = process.cwd(),
): Promise<string> {
  // Setup file path
  const configPath = path.join(dir, CONFIG_FILE_NAME);
  if (await FileUtils.exists(configPath)) {
    throw new Error(CONFIG_FILE_ALREADY_EXISTS_ERROR);
  }
  // Save file content to JSON file
  await FileUtils.saveJsonFile(configPath, DefaultConfig, customStringifyObject);
  // Return filepath
  return configPath;
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default initializeDirectory;
