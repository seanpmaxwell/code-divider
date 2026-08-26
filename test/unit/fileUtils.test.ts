import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FileUtils } from '../../src';

// ========================================================================= //
//                                 Constants                                 //
// ========================================================================= //

const TEMP_DIRECTORY = import.meta.dirname + '/.tmp';

// Note: `FileUtils.create` will create folders for items ending in '/'.
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
//                                  Helpers                                  //
// ========================================================================= //

/**
 * To test directory and glob pattern functions
 */
async function makeDirItemsToTest(): Promise<void> {
  for (const item of DIRECTORY_ITEMS_TO_TEST) {
    await FileUtils.create(item, TEMP_DIRECTORY);
  }
}

// ========================================================================= //
//                                 Run Tests                                 //
// ========================================================================= //

describe.only('FileUtils', () => {
  beforeAll(async () => {
    await FileUtils.delete(TEMP_DIRECTORY);
    await makeDirItemsToTest();
  });

  afterAll(async () => {
    await FileUtils.delete(TEMP_DIRECTORY);
  });

  // Test: `.filterDirItemsGlob`
  describe('.filterDirItemsGlob', () => {
    // Normal
    it('should work as expected', async () => {
      const result = await FileUtils.filterDirItemsGlob(
        ['**/someLib/*'],
        ['**/bad*'],
        TEMP_DIRECTORY,
      );
      const expectedResult = [
        'node_modules/someLib/bar.py',
        'node_modules/someLib/foo.py',
      ];
      expect(result).toEqual(expectedResult);
    });
  });

  // Test: `filterDirItemsShallow`
  describe('.filterDirItems`', () => {
    // Normal
    it('should work as expected', async () => {
      const result = await FileUtils.filterDirItems(
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
