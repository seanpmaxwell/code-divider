import { Dirent } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UNIT_TEST_ENV } from '@common/constants/misc';

import uFile, { FilePathDTO } from '@utilm/uFile';

import logger from '@logger';

import { getDummyDirent } from '@test/_common/utils';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const TEMP_DIRECTORY = path.join(import.meta.dirname, 'tmp');
// Mutating tests (mkFile, copy, etc.) work in here so the search tests above
// them always see the same fixture.
const SCRATCH_DIRECTORY = path.join(TEMP_DIRECTORY, '_scratch');
const IS_CASE_INSENSITIVE_FS = ['darwin', 'win32'].includes(process.platform);

// Note: `makeDirItemsToTest` will create folders for items ending in '/'.
const DIRECTORY_ITEMS_TO_TEST: ReadonlyArray<Dirent<string>> = [
  './node_modules/', // 0
  './node_modules/cache.conf', // 1
  './node_modules/someLib/', // 2
  './node_modules/someLib/foo.py', // 3
  './node_modules/someLib/bar.py', // 4
  './node_modules/someLib/bad.py', // 5
  './dist/', // 6
  './dist/out.js', // 7
  './dist/bad.text', // 8
  'package.json', // 9
  'foo.log', // 10
  '.gitignore', // 11
].map((item) => getDummyDirent(item, TEMP_DIRECTORY));

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

/**
 * Create files/folders for testing purposes.
 */
async function makeDirItemsToTest(): Promise<void> {
  try {
    for (const dirent of DIRECTORY_ITEMS_TO_TEST) {
      const absPath = path.join(dirent.parentPath, dirent.name);
      if (!dirent.isFile()) {
        await uFile.mkDir(absPath);
      } else {
        await uFile.testOnly.mkFile(absPath);
      }
    }
  } catch (err) {
    logger.error(err);
    throw err;
  }
}

/**
 * Convert dirents from the {@link DIRECTORY_ITEMS_TO_TEST} array to a
 * {@link FilePathDTO} array using indexes on the array.
 */
function getExpectedResultByIndex(...args: number[]): FilePathDTO[] {
  const dirents: Dirent<string>[] = [];
  for (const index of args) {
    const item = DIRECTORY_ITEMS_TO_TEST[index];
    dirents.push(item);
  }
  return uFile.testOnly.parseDirentArr(dirents, TEMP_DIRECTORY);
}

/**
 * Shorthand for `globSearch` against the fixture directory.
 */
function search(include: string[], exclude: string[]): Promise<FilePathDTO[]> {
  return uFile.globSearch(include, exclude, TEMP_DIRECTORY);
}

/**
 * Absolute path inside the scratch directory.
 */
function scratch(...parts: string[]): string {
  return path.join(SCRATCH_DIRECTORY, ...parts);
}

// ========================================================================= //
//                                    TESTS                                  //
// ========================================================================= //

describe('uFile', () => {
  // ---- `beforeAll` hook
  beforeAll(async () => {
    await uFile.rm(TEMP_DIRECTORY);
    await makeDirItemsToTest();
  });

  // ---- `afterAll` hook
  afterAll(async () => {
    await uFile.rm(TEMP_DIRECTORY);
  });

  // ---- Test `.globSearch`
  describe('globSearch', () => {
    it('should work as expected', async () => {
      const result = await search(['**/someLib/*'], ['**/bad*']);
      const expected = getExpectedResultByIndex(4, 3);
      expect(result).toEqual(expected);
    });

    it('should return every file, but no folders or dotfiles, when both lists are empty', async () => {
      const result = await search([], []);
      // Sorted per directory level, folders walked in place
      const expected = getExpectedResultByIndex(8, 7, 10, 1, 5, 4, 3, 9);
      expect(result).toEqual(expected);
    });

    it('should treat a plain folder name in `exclude` as that folder and everything in it', async () => {
      const result = await search([], ['node_modules', 'dist']);
      expect(result).toEqual(getExpectedResultByIndex(10, 9));
    });

    it('should treat a plain folder name in `include` as that folder and everything in it', async () => {
      const result = await search(['dist'], []);
      expect(result).toEqual(getExpectedResultByIndex(8, 7));
    });

    it('should only match root-level files with a bare `*` pattern', async () => {
      const excluded = await search([], ['*.log', '*.json']);
      expect(excluded).toEqual(getExpectedResultByIndex(8, 7, 1, 5, 4, 3));
      const included = await search(['*'], []);
      expect(included).toEqual(getExpectedResultByIndex(10, 9));
    });

    it('should match at any depth with `**`', async () => {
      const result = await search(['**/*.py'], []);
      expect(result).toEqual(getExpectedResultByIndex(5, 4, 3));
    });

    it('should let `exclude` win over `include`', async () => {
      const result = await search(['**/*.py'], ['**/bad.*']);
      expect(result).toEqual(getExpectedResultByIndex(4, 3));
    });

    it('should match a single character with `?`', async () => {
      const result = await search(['**/someLib/?oo.py'], []);
      expect(result).toEqual(getExpectedResultByIndex(3));
    });

    it('should match a dotfile when the dot is spelled out', async () => {
      const result = await search(['.gitignore'], []);
      expect(result).toEqual(getExpectedResultByIndex(11));
    });

    it('should return an empty array when nothing matches', async () => {
      const result = await search(['does-not-exist'], []);
      expect(result).toEqual([]);
    });

    it('should match case-insensitively on macOS and Windows, like tsc', async () => {
      const result = await search(['DIST'], []);
      const expected = IS_CASE_INSENSITIVE_FS
        ? getExpectedResultByIndex(8, 7)
        : [];
      expect(result).toEqual(expected);
    });

    it('should reject invalid patterns', async () => {
      await expect(search(['../x'], [])).rejects.toThrow(/leave the target/);
      await expect(search(['a**b'], [])).rejects.toThrow(/whole path segment/);
      await expect(search(['dist/**'], [])).rejects.toThrow(/cannot end/);
      await expect(search([''], [])).rejects.toThrow(/Empty pattern/);
    });
  });

  // ---- Test `.parse`
  describe('parse', () => {
    it('should split a relative path into its parts', () => {
      const dto = uFile.parse('./dist/out.js', TEMP_DIRECTORY);
      expect(dto).toEqual({
        absolutePath: path.join(TEMP_DIRECTORY, 'dist', 'out.js'),
        parentPath: TEMP_DIRECTORY,
        relativePath: path.join('dist', 'out.js'),
        filename: 'out.js',
        name: 'out',
        ext: '.js',
      });
    });

    it('should treat a leading dot as part of the name, not an extension', () => {
      const dto = uFile.parse('.gitignore', TEMP_DIRECTORY);
      expect(dto.filename).toBe('.gitignore');
      expect(dto.name).toBe('.gitignore');
      expect(dto.ext).toBe('');
    });

    it('should throw if the parent path is not absolute', () => {
      expect(() => uFile.parse('dist/out.js', 'tmp')).toThrow(
        /must be absolute/,
      );
    });
  });

  // ---- Test `.exists` + `.isDir`
  describe('exists + isDir', () => {
    it('should tell files, folders and missing paths apart', async () => {
      const file = path.join(TEMP_DIRECTORY, 'package.json');
      const dir = path.join(TEMP_DIRECTORY, 'dist');
      const missing = path.join(TEMP_DIRECTORY, 'nope');
      expect(await uFile.exists(file)).toBe(true);
      expect(await uFile.exists(dir)).toBe(true);
      expect(await uFile.exists(missing)).toBe(false);
      expect(await uFile.isDir(file)).toBe(false);
      expect(await uFile.isDir(dir)).toBe(true);
      expect(await uFile.isDir(missing)).toBe(false);
    });
  });

  // ---- Mutating tests: everything below works inside SCRATCH_DIRECTORY
  describe('mutating functions', () => {
    beforeAll(() => uFile.mkDir(SCRATCH_DIRECTORY));
    afterAll(() => uFile.rm(SCRATCH_DIRECTORY));

    // ---- Test `.mkFile`
    describe('mkFile', () => {
      it('should create a file with placeholder content', async () => {
        const file = scratch('made.txt');
        await uFile.testOnly.mkFile(file);
        expect(await uFile.read(file)).toBe('FILE_UTIL_GENERATED_FILE');
      });

      it('should resolve a relative path against `startingDir`', async () => {
        await uFile.testOnly.mkFile('rel.txt', SCRATCH_DIRECTORY);
        expect(await uFile.exists(scratch('rel.txt'))).toBe(true);
      });

      it('should skip, not throw, when the file already exists', async () => {
        const file = scratch('twice.txt');
        await uFile.testOnly.mkFile(file);
        await expect(uFile.testOnly.mkFile(file)).resolves.toBeUndefined();
      });
    });

    // ---- Test `.mkDir`
    describe('mkDir', () => {
      it('should create nested folders and tolerate existing ones', async () => {
        const dir = scratch('a', 'b', 'c');
        await uFile.mkDir(dir);
        expect(await uFile.isDir(dir)).toBe(true);
        await expect(uFile.mkDir(dir)).resolves.toBeUndefined();
      });

      it('should resolve a relative path against `startingDir`', async () => {
        await uFile.mkDir('rel-dir', SCRATCH_DIRECTORY);
        expect(await uFile.isDir(scratch('rel-dir'))).toBe(true);
      });
    });

    // ---- Test `.rm` + `.emptyDir`
    describe('rm + emptyDir', () => {
      it('should remove a folder with contents', async () => {
        const dir = scratch('to-remove');
        await uFile.mkDir(dir);
        await uFile.testOnly.mkFile(path.join(dir, 'x.txt'));
        await uFile.rm(dir);
        expect(await uFile.exists(dir)).toBe(false);
      });

      it('should not throw when the path does not exist', async () => {
        await expect(uFile.rm(scratch('ghost'))).resolves.toBeUndefined();
      });

      it('should leave an empty folder behind with `emptyDir`', async () => {
        const dir = scratch('to-empty');
        await uFile.mkDir(dir);
        await uFile.testOnly.mkFile(path.join(dir, 'x.txt'));
        await uFile.emptyDir(dir);
        expect(await uFile.isDir(dir)).toBe(true);
        expect(await fs.readdir(dir)).toEqual([]);
      });
    });

    // ---- Test `.write` + `.read`
    describe('write + read', () => {
      it('should read what was written, unless running as a dry-run', async () => {
        const file = scratch('rw.txt');
        await fs.writeFile(file, 'before', 'utf8');
        await uFile.write(file, 'after');
        // Under the unit-test env `write` is a no-op (dry-run)
        const isDryRun = process.env.NODE_ENV === UNIT_TEST_ENV;
        expect(await uFile.read(file)).toBe(isDryRun ? 'before' : 'after');
      });
    });

    // ---- Test `.saveJsonFile` + `.loadJsonFile`
    describe('saveJsonFile + loadJsonFile', () => {
      it('should round-trip an object and append ".json" when missing', async () => {
        const value = { a: 1, b: ['x', 'y'], c: { d: null } };
        const written = await uFile.saveJsonFile(scratch('data'), value);
        expect(written).toBe(scratch('data.json'));
        expect(await uFile.loadJsonFile(written)).toEqual(value);
      });

      it('should not double the extension', async () => {
        const written = await uFile.saveJsonFile(scratch('once.json'), {});
        expect(written).toBe(scratch('once.json'));
      });

      it('should pretty-print with a trailing newline by default', async () => {
        const written = await uFile.saveJsonFile(scratch('pretty'), {
          a: 1,
        });
        expect(await uFile.read(written)).toBe('{\n  "a": 1\n}\n');
      });

      it('should accept an array', async () => {
        const written = await uFile.saveJsonFile(scratch('arr'), [1, 2]);
        expect(await uFile.loadJsonFile(written)).toEqual([1, 2]);
      });

      it('should reject a non-.json extension', async () => {
        await expect(uFile.loadJsonFile(scratch('x.txt'))).rejects.toThrow(
          /must be \.json/,
        );
      });

      it('should reject invalid JSON and non-object JSON', async () => {
        await fs.writeFile(scratch('bad.json'), '{ nope', 'utf8');
        await expect(uFile.loadJsonFile(scratch('bad.json'))).rejects.toThrow(
          /invalid JSON/,
        );
        await fs.writeFile(scratch('num.json'), '42', 'utf8');
        await expect(uFile.loadJsonFile(scratch('num.json'))).rejects.toThrow(
          /object or array/,
        );
      });
    });

    // ---- Test `.copyTo`
    describe('copyTo', () => {
      const SRC = scratch('copy-src');

      beforeAll(async () => {
        await uFile.mkDir(path.join(SRC, 'sub'));
        await uFile.testOnly.mkFile(path.join(SRC, 'a.txt'));
        await uFile.testOnly.mkFile(path.join(SRC, 'sub', 'b.txt'));
      });

      it('should copy a folder into the destination, keeping its name', async () => {
        const dest = scratch('copy-dest');
        const target = await uFile.testOnly.copyTo(SRC, dest);
        expect(target).toBe(path.join(dest, 'copy-src'));
        expect(await uFile.exists(path.join(target, 'a.txt'))).toBe(true);
        expect(await uFile.exists(path.join(target, 'sub', 'b.txt'))).toBe(
          true,
        );
      });

      it('should rename the copy with the `rename` option', async () => {
        const target = await uFile.testOnly.copyTo(SRC, scratch('copy-dest'), {
          rename: 'renamed',
        });
        expect(target).toBe(scratch('copy-dest', 'renamed'));
        expect(await uFile.exists(path.join(target, 'a.txt'))).toBe(true);
      });

      it('should replace an existing target instead of merging', async () => {
        const dest = scratch('copy-replace');
        const stale = path.join(dest, 'copy-src', 'STALE.txt');
        await uFile.mkDir(path.dirname(stale));
        await uFile.testOnly.mkFile(stale);
        await uFile.testOnly.copyTo(SRC, dest);
        expect(await uFile.exists(stale)).toBe(false);
        expect(await uFile.exists(path.join(dest, 'copy-src', 'a.txt'))).toBe(
          true,
        );
      });

      it('should skip entries rejected by `filter`', async () => {
        const dest = scratch('copy-filtered');
        const target = await uFile.testOnly.copyTo(SRC, dest, {
          filter: (src) => path.basename(src) !== 'sub',
        });
        expect(await uFile.exists(path.join(target, 'a.txt'))).toBe(true);
        expect(await uFile.exists(path.join(target, 'sub'))).toBe(false);
      });

      it('should throw for a missing source without deleting the existing target', async () => {
        const dest = scratch('copy-missing');
        const keep = path.join(dest, 'ghost', 'keep.txt');
        await uFile.mkDir(path.dirname(keep));
        await uFile.testOnly.mkFile(keep);
        await expect(
          uFile.testOnly.copyTo(scratch('ghost'), dest),
        ).rejects.toThrow(/does not exist/);
        expect(await uFile.exists(keep)).toBe(true);
      });

      it('should refuse to copy a folder into itself', async () => {
        await expect(
          uFile.testOnly.copyTo(SRC, path.dirname(SRC)),
        ).rejects.toThrow(/overlap/);
        await expect(
          uFile.testOnly.copyTo(SRC, path.join(SRC, 'sub')),
        ).rejects.toThrow(/overlap/);
        // Source untouched
        expect(await uFile.exists(path.join(SRC, 'a.txt'))).toBe(true);
      });
    });
  });
});
