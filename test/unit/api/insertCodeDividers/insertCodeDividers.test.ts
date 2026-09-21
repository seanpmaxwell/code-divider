import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { insertCodeDividers } from '@src/index';

import UserError from '@common/utils/classes/UserError';

import uFile from '@utilm/uFile';

import {
  createLogger,
  JS_RULE,
  makeTmpDir,
  writeFile as writeFile_,
} from '@test/_common/utils';

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

let cwd: string;
let write: ReturnType<typeof vi.spyOn>;

/**
 * Write a file under the temp cwd.
 */
function writeFile(rel: string, content: string): Promise<string> {
  return writeFile_(cwd, rel, content);
}

/**
 * The content written for `file`, or '' if it wasn't written.
 */
function written(file: string): string {
  const call = write.mock.calls.find((c: unknown[]) => c[0] === file);
  return (call?.[1] as string | undefined) ?? '';
}

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('insertCodeDividers', () => {
  beforeEach(async () => {
    cwd = await makeTmpDir('icd');
    // Capture writes instead of touching the disk
    write = vi.spyOn(uFile, 'write').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it('should process a single file given as the target', async () => {
    const file = await writeFile('src/a.ts', '// @reg one\n');
    await writeFile('src/b.ts', '// @reg two\n');
    const result = await insertCodeDividers('src/a.ts', { cwd });
    expect(result).toEqual([file]);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toBe(file);
  });

  it('should process every matching file in a directory target', async () => {
    const a = await writeFile('src/a.ts', '// @reg one\n');
    const b = await writeFile('src/sub/b.py', '# @sec two\n');
    await writeFile('src/c.txt', '// @reg ignored\n');
    const result = await insertCodeDividers('src', { cwd });
    expect(result.sort()).toEqual([a, b].sort());
  });

  it('should default the target to the cwd and resolve a relative cwd', async () => {
    const a = await writeFile('a.ts', '// @reg one\n');
    const rel = path.relative(process.cwd(), cwd);
    const result = await insertCodeDividers('', { cwd: rel });
    expect(result).toEqual([a]);
  });

  it('should default every option (and the target path) when none are passed', async () => {
    const a = await writeFile('a.ts', '// @reg one\n');
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    const result = await insertCodeDividers();
    expect(result).toEqual([a]);
    // Not a dry run by default, so the file is written
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('should default `cwd` to process.cwd() when omitted from the options', async () => {
    const a = await writeFile('src/a.ts', '// @reg one\n');
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    const result = await insertCodeDividers('src', { isDryRun: true });
    expect(result).toEqual([a]);
  });

  it('should match extensions case-insensitively', async () => {
    const a = await writeFile('a.TS', '// @reg one\n');
    const result = await insertCodeDividers('', { cwd });
    expect(result).toEqual([a]);
  });

  it('should honor a config file found in the target directory', async () => {
    const a = await writeFile('src/a.ts', '// @sec x\n');
    await uFile.saveJsonFile(
      path.join(cwd, 'src', 'code-divider.config.json'),
      {
        All: { CharacterLimit: 40 },
      },
    );
    await insertCodeDividers('src', { cwd });
    expect(written(a).trimEnd()).toHaveLength(40);
  });

  it('should use an explicit `configFilePath` over the automatic lookup', async () => {
    const a = await writeFile('src/a.ts', '// @sec x\n');
    await uFile.saveJsonFile(
      path.join(cwd, 'src', 'code-divider.config.json'),
      { All: { CharacterLimit: 40 } },
    );
    await uFile.saveJsonFile(path.join(cwd, 'custom.json'), {
      All: { CharacterLimit: 50 },
    });
    await insertCodeDividers('src', { cwd, configFilePath: 'custom.json' });
    expect(written(a).trimEnd()).toHaveLength(50);
  });

  it('should report but not write on a dry run', async () => {
    const a = await writeFile('a.ts', '// @reg one\n');
    const result = await insertCodeDividers('', {
      cwd,
      configFilePath: '',
      isDryRun: true,
    });
    expect(result).toEqual([a]);
    expect(write).not.toHaveBeenCalled();
  });

  it('should throw a UserError for a target that does not exist', async () => {
    const promise = insertCodeDividers('nope', { cwd });
    await expect(promise).rejects.toThrow(/must be an existing/);
    await expect(promise).rejects.toThrow(UserError);
  });

  it('should throw for an explicit config file that does not exist', async () => {
    await expect(
      insertCodeDividers('', { cwd, configFilePath: 'missing.json' }),
    ).rejects.toThrow(/was not found/);
  });

  // ---- Inline config
  describe('inline `config` option', () => {
    it('should use the inline config instead of looking for a file', async () => {
      // A config file that would set 40 is ignored in favor of the inline 50
      await uFile.saveJsonFile(path.join(cwd, 'code-divider.config.json'), {
        All: { CharacterLimit: 40 },
      });
      const a = await writeFile('a.ts', '// @sec x\n');
      const info = vi.fn();
      await insertCodeDividers('', {
        cwd,
        config: { All: { CharacterLimit: 50 } },
        logger: createLogger({ info }),
      });
      expect(written(a).trimEnd()).toHaveLength(50);
      expect(info).not.toHaveBeenCalled();
    });

    it('should let an inline config add a language', async () => {
      const a = await writeFile('a.toml', '# @sec x\n');
      await insertCodeDividers('', {
        cwd,
        config: { Toml: { Extensions: ['toml'], Comment: ['# ', ''] } },
      });
      expect(written(a)).toMatch(/^# =+ X =+ #\n$/);
    });

    it('should let a language be removed with null', async () => {
      await writeFile('a.ts', '// @reg one\n');
      const b = await writeFile('b.py', '# @reg two\n');
      const result = await insertCodeDividers('', {
        cwd,
        config: { JavaScript: null },
      });
      expect(result).toEqual([b]);
    });

    it('should validate the inline config like a file', async () => {
      await expect(
        insertCodeDividers('', { cwd, config: { All: { CharacterLimit: 0 } } }),
      ).rejects.toThrow(/CharacterLimit/);
    });

    it('should reject an inline config combined with a configFilePath', async () => {
      await uFile.saveJsonFile(path.join(cwd, 'custom.json'), {});
      await expect(
        insertCodeDividers('', {
          cwd,
          config: {},
          configFilePath: 'custom.json',
        }),
      ).rejects.toThrow(/not both/);
    });
  });

  // ---- Existing dividers
  describe('existing dividers', () => {
    it('should re-center dividers generated with a different character limit', async () => {
      const a = await writeFile(
        'a.ts',
        `${JS_RULE}\n// ${' '.repeat(34)}HELLO${' '.repeat(34)} //\n${JS_RULE}\n// ${'='.repeat(30)} Section ${'='.repeat(30)} //\n`,
      );
      const result = await insertCodeDividers('', {
        cwd,
        config: { All: { CharacterLimit: 60 } },
      });
      expect(result).toEqual([a]);
      const lines = written(a).split('\n');
      expect(lines[0]).toBe(`// ${'='.repeat(54)} //`);
      expect(lines[1]).toHaveLength(60);
      expect(lines[1]).toContain('HELLO');
      expect(lines[3]).toHaveLength(60);
      expect(lines[3]).toContain(' Section ');
    });

    it('should report nothing when the dividers already match', async () => {
      const a = await writeFile('a.ts', '// @reg one\n// @sec two\n');
      await insertCodeDividers('', { cwd });
      const formatted = written(a);
      write.mockClear();
      await fs.writeFile(a, formatted, 'utf8');
      expect(await insertCodeDividers('', { cwd })).toEqual([]);
    });
  });

  // ---- Logger
  describe('logger', () => {
    it('should print to the console by default', async () => {
      const config = await writeFile('code-divider.config.json', '{}');
      const file = await writeFile('a.ts', '// @reg\n');
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await insertCodeDividers('', { cwd });
      expect(info).toHaveBeenCalledWith(
        `Using configuration overrides from: ${config}`,
      );
      expect(warn).toHaveBeenCalledWith(
        `Warning: ${file}:1: code-divider marker has no label, skipping`,
      );
    });

    it('should accept `console` as the logger', async () => {
      const config = await writeFile('code-divider.config.json', '{}');
      await writeFile('a.ts', '// @reg one\n');
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      await insertCodeDividers('', { cwd, logger: console });
      expect(info).toHaveBeenCalledWith(
        `Using configuration overrides from: ${config}`,
      );
    });

    it('should print nothing when `silent` is true', async () => {
      await writeFile('code-divider.config.json', '{}');
      await writeFile('a.ts', '// @reg\n');
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await insertCodeDividers('', { cwd, silent: true });
      expect(info).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it('should let `silent` override a given logger', async () => {
      await writeFile('code-divider.config.json', '{}');
      await writeFile('a.ts', '// @reg\n');
      const mockLogger = createLogger({ info: vi.fn(), warn: vi.fn() });
      await insertCodeDividers('', { cwd, logger: mockLogger, silent: true });
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should send the config file and warnings to a given logger', async () => {
      const config = await writeFile('code-divider.config.json', '{}');
      const file = await writeFile('a.ts', '// @reg\n');
      const mockLogger = createLogger({ info: vi.fn(), warn: vi.fn() });
      await insertCodeDividers('', { cwd, logger: mockLogger });
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Using configuration overrides from: ${config}`,
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Warning: ${file}:1: code-divider marker has no label, skipping`,
      );
    });
  });
});
