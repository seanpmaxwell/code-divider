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

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

/**
 * Create files/folders for testing purposes.
 */
async function makeDirItemsToTest(): Promise<void> {
  try {
    const reqs = [];
    for (const item of DIRECTORY_ITEMS_TO_TEST) {
      let req;
      if (item.endsWith('/')) {
        req = FileUtils.mkDir(item, TEMP_DIRECTORY);
      } else {
        req = FileUtils.mkFile(item, TEMP_DIRECTORY);
      }
      reqs.push(req);
    }
    await Promise.all(reqs);
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
  describe('.globSearch', () => {
    it('should work as expected', async () => {
      const result = await FileUtils.globSearch(
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
