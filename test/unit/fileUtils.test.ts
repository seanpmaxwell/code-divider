import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import logger from '@logger';

import FileUtils, { FilePathDTO } from '@FileUtils';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const TEMP_DIRECTORY = path.join(import.meta.dirname, 'tmp');

// Note: `makeDirItemsToTest` will create folders for items ending in '/'.
const DIRECTORY_ITEMS_TO_TEST = [
  './node_modules/',
  './node_modules/cache.conf',
  './node_modules/someLib/',
  './node_modules/someLib/foo.py',
  './node_modules/someLib/bar.py',
  './node_modules/someLib/bad.py',
  './dist/',
  './dist/out.js',
  './dist/bad.text',
  'package.json',
  'foo.log',
  '.gitignore',
] as const;

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

/**
 * Given an index from `DIRECTORY_ITEMS_TO_TEST`, turn it into a dto object.
 */
function dirItemToDto(index: number, isDir: boolean): FilePathDTO {
  const filePath = DIRECTORY_ITEMS_TO_TEST[index];
  if (!filePath) throw new Error('Dummy file-path not found');
  const dto = FileUtils.parse(filePath, TEMP_DIRECTORY);
  return {
    ...dto,
    isDir,
  }
}

/**
 * Create files/folders for testing purposes.
 */
async function makeDirItemsToTest(): Promise<void> {
  try {
    for (const item of DIRECTORY_ITEMS_TO_TEST) {
      if (item.endsWith('/')) {
        await FileUtils.mkDir(item, TEMP_DIRECTORY);
      } else {
        await FileUtils.mkFile(item, TEMP_DIRECTORY);
      }
    }
  } catch (err) {
    logger.error(err);
    throw err;
  }
}

// ========================================================================= //
//                                 RUN TESTS                                 //
// ========================================================================= //

describe('FileUtils', () => {
  // ---- `beforeAll` hook ---- //
  beforeAll(async () => {
    await FileUtils.remove(TEMP_DIRECTORY);
    await makeDirItemsToTest();
  });

  // ---- `afterAll` hook ---- //
  afterAll(async () => {
    await FileUtils.remove(TEMP_DIRECTORY);
  });

  // ---- Test `.globSearch` ---- //
  describe.skip('.globSearch', () => {
    // Dummy data
    const DTOs = {
      bar: dirItemToDto(4, false),
      foo: dirItemToDto(3, false),
    } as const;

    // Test
    it('should work as expected', async () => {
      const result = await FileUtils.globSearch(
        ['**/someLib/*'],
        ['**/bad*'],
        TEMP_DIRECTORY,
      );
      const expectedResult = [DTOs.bar, DTOs.foo];
      expect(result).toEqual(expectedResult);
    });
  });

  // ---- Test `.basicSearch` ---- //
  describe('.basicSearch', () => {
    // Dummy Data
    const DTOs = {
      gitignore: dirItemToDto(11, false),
      // foo: dirItemToDto(3, false),
    } as const;

    it('should work as expected', async () => {
      const result = await FileUtils.basicSearch(
        [],
        ['node_modules', 'dist/bad.text'],
        TEMP_DIRECTORY,
      );
      const expectedResult = [
        DTOs.gitignore,
        // 'dist',
        // 'foo.log',
        // 'package.json',
        // 'dist/out.js',
      ];
      expect(result).toEqual(expectedResult);
    });
  });
});
