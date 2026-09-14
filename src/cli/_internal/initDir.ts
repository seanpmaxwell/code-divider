import path from 'path';

import uFile from '@utilm/uFile';

import { CONFIG_FILE_NAME } from '@common/constants/misc.js';
import { InitialSettings } from '@common/types/settings';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Write `initLangSettings` as a code-divider.config.json into `targetDir`
 * (relative paths are resolved against `process.cwd()`). Refuses to overwrite
 * an existing config. Returns the path of the written file.
 */
async function initDir(
  targetDir: string,
  initLangSettings: InitialSettings,
): Promise<string> {
  // Get the directory
  const targetDirNew = path.isAbsolute(targetDir)
    ? targetDir
    : path.join(process.cwd(), targetDir);
  const isDir = await uFile.isDir(targetDirNew);
  if (!isDir) throw new Error('--init value must be a directory');
  // Get the path for the configuration file
  const configPath = path.join(targetDirNew, CONFIG_FILE_NAME);
  const configAlreadyExists = await uFile.exists(configPath);
  if (configAlreadyExists) {
    throw new Error(`${CONFIG_FILE_NAME} already exists here, not overwriting`);
  }
  // Save file content to JSON file
  await uFile.saveJsonFile(configPath, initLangSettings, stringifyJsonObj);
  // Return filepath
  return configPath;
}

/**
 * Serialize a config object like JSON.stringify(value, null, 2), but keep
 * arrays whose elements are all primitives on a single line (e.g.
 * "Extensions": ["ts", "tsx"]). Arrays containing an object or nested array
 * are expanded one element per line, like objects.
 *
 * @private {@link initDir}
 */
function stringifyJsonObj(value: unknown, indent = ''): string {
  // Stringify the array
  if (Array.isArray(value)) {
    if (value.every(isPrimitive)) {
      const stringArr = value.map((item) => JSON.stringify(item));
      return `[${stringArr.join(', ')}]`;
    }
    const inner = `${indent}  `;
    const items = value.map((item) => {
      const nestedObjStr = stringifyJsonObj(item, inner);
      return `${inner}${nestedObjStr}`;
    });
    const arrStr = items.join(',\n');
    return `[\n${arrStr}\n${indent}]`;
  }
  // Stringify non-array object
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const inner = `${indent}  `;
    const stringifiedEntries = entries.map(([key, val]) => {
      const keyStr = JSON.stringify(key);
      const valueStr = stringifyJsonObj(val, inner);
      return `${inner}${keyStr}: ${valueStr}`;
    });
    const fullObjStr = stringifiedEntries.join(',\n');
    return `{\n${fullObjStr}\n${indent}}`;
  }
  // Return
  return JSON.stringify(value);
}

/**
 * Check if the value is not an object.
 *
 * @private {@link stringifyJsonObj}
 */
function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default initDir;
