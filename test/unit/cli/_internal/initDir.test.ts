import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import initDir from '@src/cli/_internal/initDir';

import DefaultConfig from '@common/constants/DefaultConfig';
import { CONFIG_FILE_NAME, SCHEMA_URL } from '@common/constants/misc';
import type { InitialSettings } from '@common/types/settings';

import uFile from '@utilm/uFile';

import EdgeCaseConfig from '@test/_common/constants/EdgeCaseConfig';
import { makeTmpDir, mkFile } from '@test/_common/utils';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Exactly what `EdgeCaseConfig` should serialize to.
const EDGE_CASE_EXPECTED =
  [
    '{',
    `  "$schema": "${SCHEMA_URL}",`,
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

// A fresh temp directory per test, which doubles as the cwd relative paths
// are resolved against.
let tmp: string;

/**
 * Run `initDir` with `tmp` as the cwd.
 */
function init(dir: string, config: InitialSettings = DefaultConfig) {
  return initDir(dir, config, tmp);
}

/**
 * Read the generated config file as text.
 */
function readConfig(dir: string): Promise<string> {
  return uFile.read(path.join(dir, CONFIG_FILE_NAME));
}

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('initDir', () => {
  beforeEach(async () => {
    tmp = await makeTmpDir('init');
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  // ---- Writing the file
  describe('writing the config file', () => {
    it('should write the config file into an absolute directory and return its path', async () => {
      const result = await init(tmp);
      expect(result).toBe(path.join(tmp, CONFIG_FILE_NAME));
      expect(await uFile.exists(result)).toBe(true);
    });

    it('should write every default setting, with the $schema line first', async () => {
      const result = await init(tmp);
      const written = await uFile.loadJsonFile(result);
      expect(written).toEqual({ $schema: SCHEMA_URL, ...DefaultConfig });
      expect(Object.keys(written)[0]).toBe('$schema');
    });

    it('should end the file with a single newline', async () => {
      await init(tmp);
      const content = await readConfig(tmp);
      expect(content.endsWith('}\n')).toBe(true);
      expect(content.endsWith('\n\n')).toBe(false);
    });
  });

  // ---- Relative paths
  describe('relative paths', () => {
    it('should resolve a relative directory against the given cwd', async () => {
      await fs.mkdir(path.join(tmp, 'sub'));
      const result = await init('sub');
      expect(result).toBe(path.join(tmp, 'sub', CONFIG_FILE_NAME));
      expect(await uFile.exists(result)).toBe(true);
    });

    it('should accept "." for the cwd', async () => {
      const result = await init('.');
      expect(result).toBe(path.join(tmp, CONFIG_FILE_NAME));
    });
  });

  // ---- Formatting
  describe('formatting', () => {
    it('should use 2-space indentation with one key per line', async () => {
      await init(tmp);
      const lines = (await readConfig(tmp)).split('\n');
      expect(lines[0]).toBe('{');
      expect(lines[1]).toBe(`  "$schema": "${SCHEMA_URL}",`);
      expect(lines[2]).toBe('  "filter": {');
      expect(lines.at(-2)).toBe('}');
      // Every non-brace line is indented by a multiple of two spaces
      for (const line of lines) {
        const indent = line.match(/^ */)![0].length;
        expect(indent % 2, line).toBe(0);
      }
    });

    it('should keep arrays of primitives on a single line', async () => {
      await init(tmp);
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
      await init(tmp);
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
      await init(tmp);
      const written = await uFile.loadJsonFile(
        path.join(tmp, CONFIG_FILE_NAME),
      );
      expect(Object.keys(written)).toEqual([
        '$schema',
        ...Object.keys(DefaultConfig),
      ]);
    });
  });

  // ---- Formatting edge cases (arrays of objects, nested arrays, escapes)
  describe('formatting edge cases', () => {
    it('should expand arrays that contain objects or arrays, one item per line', async () => {
      await init(tmp, EdgeCaseConfig);
      const content = await readConfig(tmp);
      expect(content).toContain(
        ['  "objects": [', '    {', '      "a": 1', '    },'].join('\n'),
      );
      expect(content).toContain(
        ['  "nested": [', '    [1, 2],', '    [3]', '  ],'].join('\n'),
      );
    });

    it('should keep a primitive array inside an expanded object on one line', async () => {
      await init(tmp, EdgeCaseConfig);
      const content = await readConfig(tmp);
      expect(content).toContain('      "b": ["x", "y"]');
      expect(content).toContain('        "tags": ["t\\\\1"]');
    });

    it('should write empty arrays and objects inline', async () => {
      await init(tmp, EdgeCaseConfig);
      const content = await readConfig(tmp);
      expect(content).toContain('  "empty": [],');
      expect(content).toContain('  "emptyObj": {},');
    });

    it('should escape strings like JSON.stringify', async () => {
      await init(tmp, EdgeCaseConfig);
      const content = await readConfig(tmp);
      expect(content).toContain('"name": "q\\"uote"');
    });

    it('should produce the exact expected text', async () => {
      await init(tmp, EdgeCaseConfig);
      expect(await readConfig(tmp)).toBe(EDGE_CASE_EXPECTED);
    });

    it('should still be valid JSON that round-trips', async () => {
      const result = await init(tmp, EdgeCaseConfig);
      expect(await uFile.loadJsonFile(result)).toEqual({
        $schema: SCHEMA_URL,
        ...EdgeCaseConfig,
      });
    });
  });

  // ---- Errors
  describe('errors', () => {
    it('should throw when the directory does not exist', async () => {
      await expect(init(path.join(tmp, 'nope'))).rejects.toThrow(
        /must be a directory/,
      );
    });

    it('should throw when the target is a file', async () => {
      const file = path.join(tmp, 'a.txt');
      await mkFile(file);
      await expect(init(file)).rejects.toThrow(/must be a directory/);
    });

    it('should refuse to overwrite an existing config and leave it untouched', async () => {
      const configPath = path.join(tmp, CONFIG_FILE_NAME);
      await fs.writeFile(configPath, '{ "custom": true }\n', 'utf8');
      await expect(init(tmp)).rejects.toThrow(/already exists/);
      expect(await uFile.read(configPath)).toBe('{ "custom": true }\n');
    });

    it('should not create the file when it throws', async () => {
      await expect(init(path.join(tmp, 'nope'))).rejects.toThrow();
      expect(await uFile.exists(path.join(tmp, 'nope', CONFIG_FILE_NAME))).toBe(
        false,
      );
    });
  });
});
