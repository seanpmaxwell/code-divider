import logger from '@logger';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { insertCodeDividers } from '@src/index';

import uFile from '@utilm/uFile';

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

let cwd: string;
let write: ReturnType<typeof vi.spyOn>;

/**
 * Write a file under the temp cwd.
 */
async function writeFile(rel: string, content: string): Promise<string> {
  const abs = path.join(cwd, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return abs;
}

// ========================================================================= //
//                                    TESTS                                  //
// ========================================================================= //

describe('insertCodeDividers', () => {
  beforeEach(async () => {
    cwd = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'code-divider-icd-')),
    );
    // `uFile.write` is a no-op under the unit-test env; capture instead.
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

  it('should default every option when none are passed', async () => {
    const a = await writeFile('a.ts', '// @reg one\n');
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    const result = await insertCodeDividers('');
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

  it('should honor a config file found in the target directory', async () => {
    await writeFile('src/a.ts', '// @sec x\n');
    await uFile.saveJsonFile(
      path.join(cwd, 'src', 'code-divider.config.json'),
      {
        All: { CharacterLimit: 40 },
      },
    );
    await insertCodeDividers('src', { cwd });
    const written = write.mock.calls[0][1] as string;
    expect(written.trimEnd()).toHaveLength(40);
  });

  it('should use an explicit `configFilePath` over the automatic lookup', async () => {
    await writeFile('src/a.ts', '// @sec x\n');
    await uFile.saveJsonFile(
      path.join(cwd, 'src', 'code-divider.config.json'),
      { All: { CharacterLimit: 40 } },
    );
    await uFile.saveJsonFile(path.join(cwd, 'custom.json'), {
      All: { CharacterLimit: 50 },
    });
    await insertCodeDividers('src', { cwd, configFilePath: 'custom.json' });
    const written = write.mock.calls[0][1] as string;
    expect(written.trimEnd()).toHaveLength(50);
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

  it('should throw for a target that does not exist', async () => {
    await expect(insertCodeDividers('nope', { cwd })).rejects.toThrow(
      /must be an existing/,
    );
  });

  it('should throw for an explicit config file that does not exist', async () => {
    await expect(
      insertCodeDividers('', { cwd, configFilePath: 'missing.json' }),
    ).rejects.toThrow(/was not found/);
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
      const mockLogger = logger.create({ info: vi.fn(), warn: vi.fn() });
      await insertCodeDividers('', { cwd, logger: mockLogger, silent: true });
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should send the config file and warnings to a given logger', async () => {
      const config = await writeFile('code-divider.config.json', '{}');
      const file = await writeFile('a.ts', '// @reg\n');
      const mockLogger = logger.create({ info: vi.fn(), warn: vi.fn() });
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
