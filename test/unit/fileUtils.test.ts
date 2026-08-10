import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { fileUtils } from '../../src';

// ========================================================================= //
//                                 Constants                                 //
// ========================================================================= //

const TEMP_DIRECTORY = import.meta.dirname + '/.tmp';

// Note: `fileUtils.createItem` will create folders for items ending in '/'.
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
function makeDirItemsToTest() {
  for (const item of DIRECTORY_ITEMS_TO_TEST) {
    fileUtils.createItem(item, TEMP_DIRECTORY);
  }
}

// ========================================================================= //
//                                 Run Tests                                 //
// ========================================================================= //

describe.only('fileUtils', () => {
  beforeAll(() => {
    fileUtils.rmItem(TEMP_DIRECTORY);
    makeDirItemsToTest();
  });

  afterAll(() => {
    fileUtils.rmItem(TEMP_DIRECTORY);
  });

  // Test: `.filterDirItemsGlob`
  describe('.filterDirItemsGlob', () => {
    it('should work as expected', () => {
      const result = fileUtils.filterDirItemsGlob(
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
    it('should work as expected', () => {
      const result = fileUtils.filterDirItems(
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
