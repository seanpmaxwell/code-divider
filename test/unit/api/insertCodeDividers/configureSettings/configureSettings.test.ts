import logger, { type ILogger, SilentLogger } from '@logger';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import configureSettings from '@src/api/insertCodeDividers/configureSettings/configureSettings';

import DefaultConfig from '@common/constants/DefaultConfig';
import { CONFIG_FILE_NAME } from '@common/constants/misc';
import RunContext, { IRunContext } from '@common/utils/fns/RunContext';

import uFile from '@utilm/uFile';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Every language in the default config, by the extension used to look it up.
const DEFAULT_EXTENSIONS = [
  '.ts',
  '.js',
  '.java',
  '.css',
  '.c',
  '.cpp',
  '.go',
  '.rs',
  '.php',
  '.rb',
  '.sql',
  '.sh',
  '.py',
];

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

// A fresh temp directory per test keeps the config-file lookups isolated.
let cwd: string;

/**
 * Create a folder inside `cwd` and return its absolute path.
 */
async function mkDir(...parts: string[]): Promise<string> {
  const dir = path.join(cwd, ...parts);
  await uFile.mkDir(dir);
  return dir;
}

/**
 * Write a `code-divider.config.json` (or a custom file name) into `dir`.
 */
async function writeConfig(
  dir: string,
  config: object,
  fileName = CONFIG_FILE_NAME,
): Promise<string> {
  return uFile.saveJsonFile(path.join(dir, fileName), config);
}

/**
 * Run `configureSettings` from the temp cwd and flatten the parts of the
 * returned context the tests check.
 */
async function configure(
  targetPath = '',
  configFilePath = '',
  logger: ILogger = SilentLogger,
): Promise<IRunContext> {
  const ctx = RunContext({
    cwd,
    configFilePath,
    targetPathRaw: targetPath,
    logger,
  });
  await configureSettings(ctx);
  return ctx;
}

// ========================================================================= //
//                                    TESTS                                  //
// ========================================================================= //

describe('configureSettings', () => {
  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'code-divider-cs-'));
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  // ---- Target paths
  describe('target paths', () => {
    it('should default to the cwd when no target path is given', async () => {
      const { targetDir, targetFile } = await configure();
      expect(targetDir).toBe(cwd);
      expect(targetFile).toBeNull();
    });

    it('should resolve a relative directory against the cwd', async () => {
      const src = await mkDir('src');
      const { targetDir, targetFile } = await configure('src');
      expect(targetDir).toBe(src);
      expect(targetFile).toBeNull();
    });

    it('should accept an absolute directory', async () => {
      const src = await mkDir('src');
      const { targetDir } = await configure(src);
      expect(targetDir).toBe(src);
    });

    it('should split a file target into its directory and the file', async () => {
      const src = await mkDir('src');
      const file = path.join(src, 'a.ts');
      await uFile.testOnly.mkFile(file);
      const { targetDir, targetFile } = await configure('src/a.ts');
      expect(targetDir).toBe(src);
      expect(targetFile).toBe(file);
    });

    it('should throw when the target does not exist', async () => {
      await expect(configure('nope')).rejects.toThrow(/must be an existing/);
    });
  });

  // ---- Defaults (no config file anywhere)
  describe('defaults', () => {
    it('should register every built-in language by extension', async () => {
      const { extensionsMap } = (await configure()).configuredSettings;
      for (const ext of DEFAULT_EXTENSIONS) {
        expect(extensionsMap.has(ext), ext).toBe(true);
      }
    });

    it('should apply the `All` settings to every language', async () => {
      const { extensionsMap } = (await configure()).configuredSettings;
      for (const [ext, settings] of extensionsMap) {
        expect(settings.CHAR_LIMIT, ext).toBe(79);
        expect(settings.FILLER, ext).toBe('=');
        expect(settings.REGION_LABEL_FORMAT, ext).toBe('uppercase');
        expect(settings.SECTION_LABEL_FORMAT, ext).toBe('capitalize');
      }
    });

    it('should return the default filter', async () => {
      const { filter } = (await configure()).configuredSettings;
      expect(filter).toEqual(DefaultConfig.filter);
    });

    it('should prefix extensions with a dot', async () => {
      const { extensionsMap } = (await configure()).configuredSettings;
      for (const ext of extensionsMap.keys()) {
        expect(ext.startsWith('.'), ext).toBe(true);
      }
      // Bash already had the dot in the default config; no double dot
      expect(extensionsMap.has('..sh')).toBe(false);
      expect(extensionsMap.has('.sh')).toBe(true);
    });

    it('should share one settings object across a language’s extensions', async () => {
      const { extensionsMap } = (await configure()).configuredSettings;
      expect(extensionsMap.get('.ts')).toBe(extensionsMap.get('.js'));
      expect(extensionsMap.get('.ts')).not.toBe(extensionsMap.get('.py'));
    });
  });

  // ---- Marker regexes
  describe('marker regexes', () => {
    it('should capture the label of a line-comment marker', async () => {
      const { extensionsMap } = (await configure()).configuredSettings;
      const { REGION_MARKER, SECTION_MARKER } = extensionsMap.get('.ts')!;
      expect('// @reg Functions'.match(REGION_MARKER)?.[1]).toBe('Functions');
      expect('// @sec My Section'.match(SECTION_MARKER)?.[1]).toBe(
        'My Section',
      );
    });

    it('should allow indentation and trailing whitespace', async () => {
      const { extensionsMap } = (await configure()).configuredSettings;
      const { REGION_MARKER } = extensionsMap.get('.ts')!;
      expect('    // @reg Nested   '.match(REGION_MARKER)?.[1]).toBe('Nested');
    });

    it('should match a bare marker with no label', async () => {
      const { extensionsMap } = (await configure()).configuredSettings;
      const { REGION_MARKER } = extensionsMap.get('.ts')!;
      const match = '// @reg'.match(REGION_MARKER);
      expect(match).not.toBeNull();
      expect(match?.[1]).toBeUndefined();
    });

    it('should not match the other marker or ordinary comments', async () => {
      const { extensionsMap } = (await configure()).configuredSettings;
      const { REGION_MARKER, SECTION_MARKER } = extensionsMap.get('.ts')!;
      expect('// @sec Label').not.toMatch(REGION_MARKER);
      expect('// @reg Label').not.toMatch(SECTION_MARKER);
      expect('// not a marker').not.toMatch(REGION_MARKER);
      expect('const x = 1; // @reg Label').not.toMatch(REGION_MARKER);
    });

    it('should require the closing comment for block-comment languages', async () => {
      const { extensionsMap } = (await configure()).configuredSettings;
      const { REGION_MARKER } = extensionsMap.get('.css')!;
      expect('/* @reg Label */'.match(REGION_MARKER)?.[1]).toBe('Label');
      expect('/* @reg Label').not.toMatch(REGION_MARKER);
    });

    it('should use each language’s own comment syntax', async () => {
      const { extensionsMap } = (await configure()).configuredSettings;
      expect(
        '# @reg Label'.match(extensionsMap.get('.py')!.REGION_MARKER)?.[1],
      ).toBe('Label');
      expect(
        '-- @reg Label'.match(extensionsMap.get('.sql')!.REGION_MARKER)?.[1],
      ).toBe('Label');
      expect('// @reg Label').not.toMatch(
        extensionsMap.get('.py')!.REGION_MARKER,
      );
    });
  });

  // ---- Config file lookup
  describe('config file lookup', () => {
    it('should use the config in the target directory', async () => {
      const src = await mkDir('src');
      await writeConfig(src, { JavaScript: { CharacterLimit: 60 } });
      const { extensionsMap } = (await configure('src')).configuredSettings;
      expect(extensionsMap.get('.ts')!.CHAR_LIMIT).toBe(60);
    });

    it('should fall back to the config in the cwd', async () => {
      await mkDir('src');
      await writeConfig(cwd, { JavaScript: { CharacterLimit: 60 } });
      const { extensionsMap } = (await configure('src')).configuredSettings;
      expect(extensionsMap.get('.ts')!.CHAR_LIMIT).toBe(60);
    });

    it('should prefer the target directory over the cwd', async () => {
      const src = await mkDir('src');
      await writeConfig(cwd, { JavaScript: { CharacterLimit: 60 } });
      await writeConfig(src, { JavaScript: { CharacterLimit: 50 } });
      const { extensionsMap } = (await configure('src')).configuredSettings;
      expect(extensionsMap.get('.ts')!.CHAR_LIMIT).toBe(50);
    });

    it('should not merge the two config files', async () => {
      const src = await mkDir('src');
      await writeConfig(cwd, { JavaScript: { CharacterLimit: 60 } });
      await writeConfig(src, { JavaScript: { FillerCharacter: '-' } });
      const { extensionsMap } = (await configure('src')).configuredSettings;
      expect(extensionsMap.get('.ts')!.FILLER).toBe('-');
      expect(extensionsMap.get('.ts')!.CHAR_LIMIT).toBe(79);
    });

    it('should prefer an explicit config path (relative to the cwd) over both', async () => {
      const src = await mkDir('src');
      await writeConfig(cwd, { JavaScript: { CharacterLimit: 60 } });
      await writeConfig(src, { JavaScript: { CharacterLimit: 50 } });
      await writeConfig(
        cwd,
        { JavaScript: { CharacterLimit: 40 } },
        'custom.json',
      );
      const { extensionsMap } = (await configure('src', 'custom.json'))
        .configuredSettings;
      expect(extensionsMap.get('.ts')!.CHAR_LIMIT).toBe(40);
    });

    it('should accept an absolute explicit config path', async () => {
      const file = await writeConfig(
        cwd,
        { JavaScript: { CharacterLimit: 40 } },
        'custom.json',
      );
      const { extensionsMap } = (await configure('', file)).configuredSettings;
      expect(extensionsMap.get('.ts')!.CHAR_LIMIT).toBe(40);
    });

    it('should throw when the explicit config path does not exist', async () => {
      await expect(configure('', 'missing.json')).rejects.toThrow(
        /was not found/,
      );
    });

    it('should reject a config file that is not .json', async () => {
      await fs.writeFile(path.join(cwd, 'config.txt'), '{}', 'utf8');
      await expect(configure('', path.join(cwd, 'config.txt'))).rejects.toThrow(
        /must be \.json/,
      );
    });

    it('should reject a config file with invalid JSON', async () => {
      await fs.writeFile(path.join(cwd, CONFIG_FILE_NAME), '{ nope', 'utf8');
      await expect(configure()).rejects.toThrow(/invalid JSON/);
    });
  });

  // ---- Merging overrides
  describe('merging overrides', () => {
    it('should apply an `All` override to every language', async () => {
      await writeConfig(cwd, {
        All: { CharacterLimit: 100, FillerCharacter: '-' },
      });
      const { extensionsMap } = (await configure()).configuredSettings;
      for (const [ext, settings] of extensionsMap) {
        expect(settings.CHAR_LIMIT, ext).toBe(100);
        expect(settings.FILLER, ext).toBe('-');
      }
    });

    it('should let a language override win over `All`', async () => {
      await writeConfig(cwd, {
        All: { CharacterLimit: 100 },
        JavaScript: { CharacterLimit: 60 },
      });
      const { extensionsMap } = (await configure()).configuredSettings;
      expect(extensionsMap.get('.ts')!.CHAR_LIMIT).toBe(60);
      expect(extensionsMap.get('.py')!.CHAR_LIMIT).toBe(100);
    });

    it('should only change the overridden language', async () => {
      await writeConfig(cwd, { JavaScript: { CharacterLimit: 60 } });
      const { extensionsMap } = (await configure()).configuredSettings;
      expect(extensionsMap.get('.ts')!.CHAR_LIMIT).toBe(60);
      expect(extensionsMap.get('.py')!.CHAR_LIMIT).toBe(79);
    });

    it('should keep a language’s other defaults when overriding one field', async () => {
      await writeConfig(cwd, { JavaScript: { CharacterLimit: 60 } });
      const { extensionsMap } = (await configure()).configuredSettings;
      const js = extensionsMap.get('.ts')!;
      expect(js.FILLER).toBe('=');
      expect(js.BOOKENDS).toEqual(['// ', ' //']);
      expect(js.EXTENSIONS).toContain('.tsx');
    });

    it('should add a new language from an unknown key', async () => {
      await writeConfig(cwd, {
        Toml: {
          Extensions: ['toml'],
          Comment: ['# ', ''],
          Bookends: ['# ', ' #'],
        },
      });
      const { extensionsMap } = (await configure()).configuredSettings;
      const toml = extensionsMap.get('.toml')!;
      expect(toml).toBeDefined();
      expect(toml.CHAR_LIMIT).toBe(79); // inherited from `All`
      expect('# @reg Label'.match(toml.REGION_MARKER)?.[1]).toBe('Label');
    });

    it('should mirror the opening comment as the closing bookend when Bookends is omitted', async () => {
      await writeConfig(cwd, {
        Toml: { Extensions: ['toml'], Comment: ['# ', ''] },
      });
      const { extensionsMap } = (await configure()).configuredSettings;
      expect(extensionsMap.get('.toml')!.BOOKENDS).toEqual(['# ', ' #']);
    });

    it('should replace the filter lists that are given and keep the rest', async () => {
      await writeConfig(cwd, { filter: { include: ['src'] } });
      const { filter } = (await configure()).configuredSettings;
      expect(filter.include).toEqual(['src']);
      expect(filter.exclude).toEqual(DefaultConfig.filter.exclude);
    });

    it('should lowercase label formats', async () => {
      await writeConfig(cwd, {
        JavaScript: {
          RegionLabelFormat: 'NONE',
          SectionLabelFormat: 'Lowercase',
        },
      });
      const { extensionsMap } = (await configure()).configuredSettings;
      expect(extensionsMap.get('.ts')!.REGION_LABEL_FORMAT).toBe('none');
      expect(extensionsMap.get('.ts')!.SECTION_LABEL_FORMAT).toBe('lowercase');
    });
  });

  // ---- Validation
  describe('validation', () => {
    const rejects = async (config: object, re: RegExp) => {
      await writeConfig(cwd, config);
      await expect(configure()).rejects.toThrow(re);
    };

    // Shared settings spelled out, so these tests isolate the field under test
    // from how a new language inherits `All` (covered in "merging overrides").
    const SHARED = {
      CharacterLimit: 79,
      FillerCharacter: '=',
      RegionLabelFormat: 'uppercase',
      SectionLabelFormat: 'capitalize',
    };

    it('should reject a bad CharacterLimit', async () => {
      await rejects({ All: { CharacterLimit: 1.5 } }, /CharacterLimit/);
      await rejects({ All: { CharacterLimit: '79' } }, /CharacterLimit/);
      await rejects({ JavaScript: { CharacterLimit: 0 } }, /CharacterLimit/);
    });

    it('should reject a falsy CharacterLimit in `All`', async () => {
      await rejects({ All: { CharacterLimit: 0 } }, /CharacterLimit/);
    });

    it('should reject a bad FillerCharacter', async () => {
      await rejects({ All: { FillerCharacter: '==' } }, /FillerCharacter/);
      await rejects({ JavaScript: { FillerCharacter: '' } }, /FillerCharacter/);
    });

    it('should reject a bad label format', async () => {
      await rejects(
        { All: { RegionLabelFormat: 'bold' } },
        /RegionLabelFormat/,
      );
      await rejects(
        { JavaScript: { SectionLabelFormat: 'bold' } },
        /SectionLabelFormat/,
      );
    });

    it('should name the offending language in the error', async () => {
      await rejects({ Python: { CharacterLimit: -1 } }, /"Python"/);
    });

    it('should reject a non-string label format with the friendly error', async () => {
      await rejects({ All: { RegionLabelFormat: 5 } }, /RegionLabelFormat/);
      await rejects(
        { JavaScript: { SectionLabelFormat: true } },
        /SectionLabelFormat/,
      );
    });

    it('should reject a filter whose lists are not string arrays', async () => {
      await rejects({ filter: { include: 'src' } }, /filter\.include/);
      await rejects({ filter: { exclude: [1] } }, /filter\.exclude/);
      await rejects({ filter: { include: null } }, /filter\.include/);
    });

    it('should reject a config block that is not an object', async () => {
      await rejects({ filter: 'src' }, /"filter" must be an object/);
      await rejects({ All: [79] }, /"All" must be an object/);
      await rejects({ JavaScript: null }, /"JavaScript" must be an object/);
    });

    it('should reject a new language without a Comment pair', async () => {
      await rejects(
        { Toml: { ...SHARED, Extensions: ['toml'] } },
        /Comment pair/,
      );
      await rejects(
        { Toml: { ...SHARED, Extensions: ['toml'], Comment: '#' } },
        /Comment pair/,
      );
    });

    it('should reject bad Extensions', async () => {
      await rejects({ Toml: { ...SHARED, Comment: ['# ', ''] } }, /Extensions/);
      await rejects(
        { Toml: { ...SHARED, Comment: ['# ', ''], Extensions: [1] } },
        /Extensions/,
      );
    });

    it('should reject bad Bookends', async () => {
      await rejects(
        {
          Toml: {
            ...SHARED,
            Extensions: ['toml'],
            Comment: ['# ', ''],
            Bookends: ['# '],
          },
        },
        /Bookends/,
      );
    });
  });

  // ---- Context
  describe('context', () => {
    it('should resolve an explicit config file to an absolute path', async () => {
      const file = await writeConfig(cwd, {}, 'custom.json');
      const ctx = await configure('', 'custom.json');
      expect(ctx.configFilePath).toBe(file);
    });

    it('should store the config file found in the target directory', async () => {
      const src = await mkDir('src');
      const file = await writeConfig(src, {});
      const ctx = await configure('src');
      expect(ctx.configFilePath).toBe(file);
    });

    it('should store the config file found in the cwd', async () => {
      await mkDir('src');
      const file = await writeConfig(cwd, {});
      const ctx = await configure('src');
      expect(ctx.configFilePath).toBe(file);
    });

    it('should leave configFilePath null when there is no config file', async () => {
      const ctx = await configure();
      expect(ctx.configFilePath).toBeNull();
    });
  });

  // ---- Logger
  describe('logger', () => {
    it('should report the config file it uses through the logger', async () => {
      await writeConfig(cwd, {});
      const mockLogger = logger.create({ info: vi.fn(), warn: vi.fn() });
      await configure('', '', mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Using configuration overrides from: ${path.join(cwd, CONFIG_FILE_NAME)}`,
      );
    });

    it('should not log anything when there is no config file', async () => {
      const mockLogger = logger.create({ info: vi.fn(), warn: vi.fn() });
      await configure('', '', mockLogger);
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
