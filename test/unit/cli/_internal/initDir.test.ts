import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import initDir from '@src/cli/_internal/initDir';

import DefaultConfig from '@common/constants/DefaultConfig';
import { CONFIG_FILE_NAME } from '@common/constants/misc';

import uFile from '@utilm/uFile';

import EdgeCaseConfig from '@test/_common/constants/EdgeCaseConfig';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Exactly what `EdgeCaseConfig` should serialize to.
const EDGE_CASE_EXPECTED =
  [
    '{',
    '  "primitives": ["a", 1, true, null],',
    '  "empty": [],',
    '  "emptyObj": {},',
    '  "objects": [',
    '    {',
    '      "a": 1',
    '    },',
    '    {',
    '      "b": ["x", "y"]',
    '    }',
    '  ],',
    '  "nested": [',
    '    [1, 2],',
    '    [3]',
    '  ],',
    '  "mixed": [',
    '    1,',
    '    {',
    '      "c": null',
    '    }',
    '  ],',
    '  "deep": {',
    '    "list": [',
    '      {',
    '        "name": "q\\"uote",',
    '        "tags": ["t\\\\1"]',
    '      }',
    '    ]',
    '  },',
    '  "scalar": "str",',
    '  "num": 2.5,',
    '  "flag": false,',
    '  "nothing": null',
    '}',
  ].join('\n') + '\n';

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

// A fresh temp directory per test. `initDir` resolves relative paths against
// `process.cwd()`, so the tests for that switch into the temp dir and back.
let tmp: string;
const ORIGINAL_CWD = process.cwd();

/**
 * Read the generated config file as text.
 */
function readConfig(dir: string): Promise<string> {
  return uFile.read(path.join(dir, CONFIG_FILE_NAME));
}

// ========================================================================= //
//                                    TESTS                                  //
// ========================================================================= //

describe('initDir', () => {
  beforeEach(async () => {
    // `realpath` so the path matches `process.cwd()` after a `chdir`, which
    // resolves symlinks (on macOS, `/var` -> `/private/var`).
    tmp = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'code-divider-init-')),
    );
  });

  afterEach(async () => {
    process.chdir(ORIGINAL_CWD);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  // ---- Writing the file
  describe('writing the config file', () => {
    it('should write the config file into an absolute directory and return its path', async () => {
      const result = await initDir(tmp, DefaultConfig);
      expect(result).toBe(path.join(tmp, CONFIG_FILE_NAME));
      expect(await uFile.exists(result)).toBe(true);
    });

    it('should write every default setting', async () => {
      const result = await initDir(tmp, DefaultConfig);
      expect(await uFile.loadJsonFile(result)).toEqual(DefaultConfig);
    });

    it('should end the file with a single newline', async () => {
      await initDir(tmp, DefaultConfig);
      const content = await readConfig(tmp);
      expect(content.endsWith('}\n')).toBe(true);
      expect(content.endsWith('\n\n')).toBe(false);
    });
  });

  // ---- Relative paths
  describe('relative paths', () => {
    it('should resolve a relative directory against process.cwd()', async () => {
      await uFile.mkDir(path.join(tmp, 'sub'));
      process.chdir(tmp);
      const result = await initDir('sub', DefaultConfig);
      expect(result).toBe(path.join(tmp, 'sub', CONFIG_FILE_NAME));
      expect(await uFile.exists(result)).toBe(true);
    });

    it('should accept "." for the current directory', async () => {
      process.chdir(tmp);
      const result = await initDir('.', DefaultConfig);
      expect(result).toBe(path.join(tmp, CONFIG_FILE_NAME));
    });
  });

  // ---- Formatting
  describe('formatting', () => {
    it('should use 2-space indentation with one key per line', async () => {
      await initDir(tmp, DefaultConfig);
      const lines = (await readConfig(tmp)).split('\n');
      expect(lines[0]).toBe('{');
      expect(lines[1]).toBe('  "filter": {');
      expect(lines.at(-2)).toBe('}');
      // Every non-brace line is indented by a multiple of two spaces
      for (const line of lines) {
        const indent = line.match(/^ */)![0].length;
        expect(indent % 2, line).toBe(0);
      }
    });

    it('should keep arrays of primitives on a single line', async () => {
      await initDir(tmp, DefaultConfig);
      const content = await readConfig(tmp);
      expect(content).toContain(
        '"Extensions": ["ts", "tsx", "js", "jsx", "mjs", "cjs"]',
      );
      expect(content).toContain('"Comment": ["// ", ""]');
      expect(content).toContain('"include": []');
      // No array is ever broken across lines
      expect(content).not.toMatch(/\[\n/);
    });

    it('should expand objects one key per line', async () => {
      await initDir(tmp, DefaultConfig);
      const content = await readConfig(tmp);
      expect(content).toContain(
        [
          '  "All": {',
          '    "CharacterLimit": 79,',
          '    "FillerCharacter": "=",',
          '    "RegionLabelFormat": "uppercase",',
          '    "SectionLabelFormat": "capitalize"',
          '  },',
        ].join('\n'),
      );
    });

    it('should keep the default config’s key order', async () => {
      await initDir(tmp, DefaultConfig);
      const written = await uFile.loadJsonFile(
        path.join(tmp, CONFIG_FILE_NAME),
      );
      expect(Object.keys(written)).toEqual(Object.keys(DefaultConfig));
    });
  });

  // ---- Formatting edge cases (arrays of objects, nested arrays, escapes)
  describe('formatting edge cases', () => {
    it('should expand arrays that contain objects or arrays, one item per line', async () => {
      await initDir(tmp, EdgeCaseConfig);
      const content = await readConfig(tmp);
      expect(content).toContain(
        ['  "objects": [', '    {', '      "a": 1', '    },'].join('\n'),
      );
      expect(content).toContain(
        ['  "nested": [', '    [1, 2],', '    [3]', '  ],'].join('\n'),
      );
    });

    it('should keep a primitive array inside an expanded object on one line', async () => {
      await initDir(tmp, EdgeCaseConfig);
      const content = await readConfig(tmp);
      expect(content).toContain('      "b": ["x", "y"]');
      expect(content).toContain('        "tags": ["t\\\\1"]');
    });

    it('should write empty arrays and objects inline', async () => {
      await initDir(tmp, EdgeCaseConfig);
      const content = await readConfig(tmp);
      expect(content).toContain('  "empty": [],');
      expect(content).toContain('  "emptyObj": {},');
    });

    it('should escape strings like JSON.stringify', async () => {
      await initDir(tmp, EdgeCaseConfig);
      const content = await readConfig(tmp);
      expect(content).toContain('"name": "q\\"uote"');
    });

    it('should produce the exact expected text', async () => {
      await initDir(tmp, EdgeCaseConfig);
      expect(await readConfig(tmp)).toBe(EDGE_CASE_EXPECTED);
    });

    it('should still be valid JSON that round-trips', async () => {
      const result = await initDir(tmp, EdgeCaseConfig);
      expect(await uFile.loadJsonFile(result)).toEqual(EdgeCaseConfig);
    });
  });

  // ---- Errors
  describe('errors', () => {
    it('should throw when the directory does not exist', async () => {
      await expect(
        initDir(path.join(tmp, 'nope'), DefaultConfig),
      ).rejects.toThrow(/must be a directory/);
    });

    it('should throw when the target is a file', async () => {
      const file = path.join(tmp, 'a.txt');
      await uFile.testOnly.mkFile(file);
      await expect(initDir(file, DefaultConfig)).rejects.toThrow(
        /must be a directory/,
      );
    });

    it('should refuse to overwrite an existing config and leave it untouched', async () => {
      const configPath = path.join(tmp, CONFIG_FILE_NAME);
      await fs.writeFile(configPath, '{ "custom": true }\n', 'utf8');
      await expect(initDir(tmp, DefaultConfig)).rejects.toThrow(
        /already exists/,
      );
      expect(await uFile.read(configPath)).toBe('{ "custom": true }\n');
    });

    it('should not create the file when it throws', async () => {
      await expect(
        initDir(path.join(tmp, 'nope'), DefaultConfig),
      ).rejects.toThrow();
      expect(await uFile.exists(path.join(tmp, 'nope', CONFIG_FILE_NAME))).toBe(
        false,
      );
    });
  });
});
