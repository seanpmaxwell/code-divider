import fs from 'fs';
import path from 'path';

import DefaultConfig from '@src/common/constants/DefaultConfig';
import { CONFIG_FILE_NAME } from '@src/common/constants/misc';
import customStringifyObject from '@src/common/utils/customStringifyObject';
import fileUtils from '@src/common/utils/fileUtils';

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
function initializeDirectory(dir: string = process.cwd()): string {
  // Setup file path
  const configPath = path.join(dir, CONFIG_FILE_NAME);
  if (fs.existsSync(configPath)) {
    throw new Error(CONFIG_FILE_ALREADY_EXISTS_ERROR);
  }
  // Save file content to JSON file
  fileUtils.saveJsonFile(configPath, DefaultConfig, customStringifyObject);
  // Return filepath
  return configPath;
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default initializeDirectory;
