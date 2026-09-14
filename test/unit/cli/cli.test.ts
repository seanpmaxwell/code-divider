import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HELP_TEXT from '@src/cli/_internal/HELP_TEXT';
import cli from '@src/cli/cli';

import { CONFIG_FILE_NAME } from '@common/constants/misc';

import uFile from '@utilm/uFile';

import logger from '@logger';

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

const PACKAGE_JSON = path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'package.json',
);

let cwd: string;
let write: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;

/**
 * Write a file under the temp cwd.
 */
async function writeFile(rel: string, content: string): Promise<string> {
  const abs = path.join(cwd, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return abs;
}

/**
 * Everything printed through `logger.info`, as one string.
 */
function printed(): string {
  return info.mock.calls.map((args: unknown[]) => args.join(' ')).join('\n');
}

// ========================================================================= //
//                                    TESTS                                  //
// ========================================================================= //

describe('cli', () => {
  beforeEach(async () => {
    cwd = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'code-divider-cli-')),
    );
    // `uFile.write` is a no-op under the unit-test env; capture instead.
    write = vi.spyOn(uFile, 'write').mockResolvedValue(undefined);
    info = vi.spyOn(logger, 'info').mockImplementation(() => '');
    vi.spyOn(logger, 'line').mockImplementation(() => undefined);
    vi.spyOn(logger, 'warn').mockImplementation(() => '');
    process.exitCode = undefined;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await fs.rm(cwd, { recursive: true, force: true });
  });

  // ---- Helpers
  describe('help and version', () => {
    it('should print the help text', async () => {
      await cli(['--help'], cwd);
      expect(info).toHaveBeenCalledWith(HELP_TEXT);
    });

    it('should print the package version', async () => {
      const stdout = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);
      const { version } = JSON.parse(await fs.readFile(PACKAGE_JSON, 'utf8'));
      await cli(['--version'], cwd);
      expect(stdout).toHaveBeenCalledWith(`${version}\n`);
    });

    it('should reject help or version combined with anything else', async () => {
      await expect(cli(['-h', '--path', 'src'], cwd)).rejects.toThrow(
        /Invalid command-line arguments/,
      );
      await expect(cli(['-v', '-d'], cwd)).rejects.toThrow(
        /Invalid command-line arguments/,
      );
      expect(write).not.toHaveBeenCalled();
    });

    it('should reject an unknown option', async () => {
      await expect(cli(['--bogus'], cwd)).rejects.toThrow();
    });
  });

  // ---- `--init`
  describe('--init', () => {
    it('should write a config file into the given directory', async () => {
      await cli(['--init', cwd], cwd);
      const configPath = path.join(cwd, CONFIG_FILE_NAME);
      expect(await uFile.exists(configPath)).toBe(true);
      expect(printed()).toContain(`created ${configPath}`);
    });

    it('should reject --init combined with another option', async () => {
      await expect(cli(['--init', cwd, '-d'], cwd)).rejects.toThrow(
        /--init takes at most one argument/,
      );
      expect(await uFile.exists(path.join(cwd, CONFIG_FILE_NAME))).toBe(false);
    });
  });

  // ---- Inserting code-dividers
  describe('inserting code-dividers', () => {
    it('should process the cwd when no path is given', async () => {
      const a = await writeFile('a.ts', '// @reg one\n');
      await cli([], cwd);
      expect(write).toHaveBeenCalledTimes(1);
      expect(write.mock.calls[0][0]).toBe(a);
      expect(printed()).toContain('code-divider CLI: 1 file/s updated');
    });

    it('should only process the directory given with --path', async () => {
      const a = await writeFile('src/a.ts', '// @reg one\n');
      await writeFile('other/b.ts', '// @reg two\n');
      await cli(['--path', 'src'], cwd);
      expect(write.mock.calls.map((c: unknown[]) => c[0])).toEqual([a]);
    });

    it('should reject a bare path without writing anything', async () => {
      await writeFile('src/a.ts', '// @reg one\n');
      await expect(cli(['src'], cwd)).rejects.toThrow(
        /Unexpected argument "src"\. Pass the path with --path/,
      );
      expect(write).not.toHaveBeenCalled();
    });

    it('should process a single file given with --path', async () => {
      const a = await writeFile('src/a.ts', '// @reg one\n');
      await writeFile('src/b.ts', '// @reg two\n');
      await cli(['--path', 'src/a.ts'], cwd);
      expect(write.mock.calls.map((c: unknown[]) => c[0])).toEqual([a]);
    });

    it('should use the config file given with --config', async () => {
      await writeFile('src/a.ts', '// @sec x\n');
      await uFile.saveJsonFile(path.join(cwd, 'custom.json'), {
        All: { CharacterLimit: 40 },
      });
      await cli(['-c', 'custom.json', '-p', 'src'], cwd);
      const written = write.mock.calls[0][1] as string;
      expect(written.trimEnd()).toHaveLength(40);
      // The CLI passes its logger to the API, so the config file is reported
      expect(printed()).toContain(
        `Using configuration overrides from: ${path.join(cwd, 'custom.json')}`,
      );
    });

    it('should list the files but not write them on a dry run', async () => {
      const a = await writeFile('a.ts', '// @reg one\n');
      await cli(['--dry-run'], cwd);
      expect(write).not.toHaveBeenCalled();
      expect(printed()).toContain(a);
      expect(printed()).toContain(
        '[Dry Run] code-divider CLI: 1 file/s would have been updated',
      );
      expect(process.exitCode).toBeUndefined();
    });
  });

  // ---- `--check`
  describe('--check', () => {
    it('should exit with code 1 and list the files when changes are needed', async () => {
      const a = await writeFile('a.ts', '// @reg one\n');
      await cli(['--check'], cwd);
      expect(write).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      expect(printed()).toContain(a);
      expect(printed()).toContain('[Check] code-divider: 1 file/s need');
    });

    it('should leave the exit code alone when nothing would change', async () => {
      await writeFile('a.ts', 'const x = 1;\n');
      await cli(['--check'], cwd);
      expect(process.exitCode).toBeUndefined();
      expect(printed()).toContain('all files are up to date');
    });

    it('should behave as a check when combined with --dry-run', async () => {
      await writeFile('a.ts', '// @reg one\n');
      await cli(['--check', '-d'], cwd);
      expect(write).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });
  });
});
