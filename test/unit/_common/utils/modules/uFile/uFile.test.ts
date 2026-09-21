import fs from 'fs/promises';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import uFile, { FileCtx } from '@utilm/uFile';

import { mkFile } from '@test/_common/utils';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const TEMP_DIRECTORY = path.join(import.meta.dirname, 'tmp');
// Mutating tests work in here so the search tests always see the same fixture.
const SCRATCH_DIRECTORY = path.join(TEMP_DIRECTORY, '_scratch');
const IS_CASE_INSENSITIVE_FS = ['darwin', 'win32'].includes(process.platform);

// Note: items ending in '/' are created as folders.
const DIRECTORY_ITEMS_TO_TEST = [
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
];

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

/**
 * Create files/folders for testing purposes.
 */
async function makeDirItemsToTest(): Promise<void> {
  for (const item of DIRECTORY_ITEMS_TO_TEST) {
    const absPath = path.join(TEMP_DIRECTORY, item);
    if (item.endsWith('/')) {
      await fs.mkdir(absPath, { recursive: true });
    } else {
      await mkFile(absPath);
    }
  }
}

/**
 * The `FileCtx` objects `globSearch` should return for the given indexes
 * into {@link DIRECTORY_ITEMS_TO_TEST}.
 */
function getExpectedResultByIndex(...indexes: number[]): FileCtx[] {
  return indexes.map((index) =>
    uFile.parse(DIRECTORY_ITEMS_TO_TEST[index], TEMP_DIRECTORY),
  );
}

/**
 * Shorthand for `globSearch` against the fixture directory.
 */
function search(include: string[], exclude: string[]): Promise<FileCtx[]> {
  return uFile.globSearch(include, exclude, TEMP_DIRECTORY);
}

/**
 * Absolute path inside the scratch directory.
 */
function scratch(...parts: string[]): string {
  return path.join(SCRATCH_DIRECTORY, ...parts);
}

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('uFile', () => {
  beforeAll(async () => {
    await fs.rm(TEMP_DIRECTORY, { recursive: true, force: true });
    await makeDirItemsToTest();
  });

  afterAll(async () => {
    await fs.rm(TEMP_DIRECTORY, { recursive: true, force: true });
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

    it('should skip symbolic links to files and to folders', async () => {
      const linkDir = path.join(TEMP_DIRECTORY, 'linked');
      await fs.mkdir(linkDir);
      await mkFile(path.join(linkDir, 'real.py'));
      await fs.symlink(
        path.join(TEMP_DIRECTORY, 'dist'),
        path.join(linkDir, 'to-dist'),
      );
      await fs.symlink(
        path.join(TEMP_DIRECTORY, 'package.json'),
        path.join(linkDir, 'to-file.py'),
      );
      // A link back to the root would loop if links were followed
      await fs.symlink(TEMP_DIRECTORY, path.join(linkDir, 'to-root'));
      try {
        const result = await search(['linked'], []);
        expect(result.map((r) => r.relativePath)).toEqual([
          path.join('linked', 'real.py'),
        ]);
      } finally {
        await fs.rm(linkDir, { recursive: true, force: true });
      }
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

  // ---- Test `.exists` + `.isDir` + `.pathType`
  describe('exists + isDir + pathType', () => {
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
      expect(await uFile.pathType(file)).toBe('file');
      expect(await uFile.pathType(dir)).toBe('directory');
      expect(await uFile.pathType(missing)).toBeNull();
    });
  });

  // ---- Mutating tests: everything below works inside SCRATCH_DIRECTORY
  describe('mutating functions', () => {
    beforeAll(() => fs.mkdir(SCRATCH_DIRECTORY, { recursive: true }));
    afterAll(() => fs.rm(SCRATCH_DIRECTORY, { recursive: true, force: true }));

    // ---- Test `.write` + `.read`
    describe('write + read', () => {
      it('should read what was written', async () => {
        const file = scratch('rw.txt');
        await fs.writeFile(file, 'before', 'utf8');
        await uFile.write(file, 'after');
        expect(await uFile.read(file)).toBe('after');
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
  });
});
