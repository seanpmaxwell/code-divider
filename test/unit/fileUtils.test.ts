import path from 'path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import FileUtils from '@FileUtils';
import logger from '@logger';

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

const FilePathDTOs = {
  bar: FileUtils.parse(DIRECTORY_ITEMS_TO_TEST[4], TEMP_DIRECTORY),
  foo: FileUtils.parse(DIRECTORY_ITEMS_TO_TEST[3], TEMP_DIRECTORY),
} as const;

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

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
  // `beforeAll` hook
  beforeAll(async () => {
    await FileUtils.remove(TEMP_DIRECTORY);
    await makeDirItemsToTest();
  });

  // `afterAll` hook
  afterAll(async () => {
    await FileUtils.remove(TEMP_DIRECTORY);
  });

  // Test: `.globSearch`
  describe.only('.globSearch', () => {
    it('should work as expected', async () => {
      const result = await FileUtils.globSearch(
        ['**/someLib/*'],
        ['**/bad*'],
        TEMP_DIRECTORY,
      );
      const expectedResult = [ FilePathDTOs.bar, FilePathDTOs.foo ];
      expect(result).toEqual(expectedResult);
    });
  });

  // Test: `.basicSearch`
  describe('.basicSearch`', () => {
    it('should work as expected', async () => {
      const result = await FileUtils.basicSearch(
        [],
        ['node_modules', 'dist/bad.text'],
        TEMP_DIRECTORY,
      );
      const expectedResult = [
        '.gitignore',
        'dist',
        'foo.log',
        'package.json',
        'dist/out.js',
      ];
      expect(result).toEqual(expectedResult);
    });
  });
});
