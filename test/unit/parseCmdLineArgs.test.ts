import { describe, expect, it } from 'vitest';

import { parseCmdLineArgs, type ParsedCmdLineArgs } from '@src/cli-helpers';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const CWD = process.cwd();

const DEFAULT_RESULT = {
  help: false,
  version: false,
  init: '',
  dryRun: false,
  path: '',
  config: '',
} as const satisfies ParsedCmdLineArgs;

const FLAG_HELP_RESULT = {
  ...DEFAULT_RESULT,
  help: true,
} as const satisfies ParsedCmdLineArgs;

const FLAG_VERSION_RESULT = {
  ...DEFAULT_RESULT,
  version: true,
} as const satisfies ParsedCmdLineArgs;

const GetFlagInitResult = (path = CWD): ParsedCmdLineArgs => ({
  ...DEFAULT_RESULT,
  init: path,
});

const FLAG_DRY_RUN_RESULT = {
  ...DEFAULT_RESULT,
  dryRun: true,
} as const satisfies ParsedCmdLineArgs;

const GetPathConfigResult = (path = '', config = ''): ParsedCmdLineArgs => ({
  ...DEFAULT_RESULT,
  path,
  config,
});

// ========================================================================= //
//                                 RUN TESTS                                 //
// ========================================================================= //

describe.only('parseCmdLineArgs', () => {
  // Help
  describe('help flag [-h, --help]', () => {
    it('should work as expected', async () => {
      const res1 = parseCmdLineArgs(['--help']);
      expect(res1).toEqual(FLAG_HELP_RESULT);
      const res2 = parseCmdLineArgs(['-h']);
      expect(res2).toEqual(FLAG_HELP_RESULT);
      const res3 = parseCmdLineArgs(['-h', 'horse']);
      expect(res3).toEqual(FLAG_HELP_RESULT);
      const res4 = () => parseCmdLineArgs(['horse', '-h']);
      expect(() => res4()).toThrow();
    });
  });

  // Version
  describe('version flag [-v, --version]', () => {
    it('should work as expected', async () => {
      const res1 = parseCmdLineArgs(['--version']);
      expect(res1).toEqual(FLAG_VERSION_RESULT);
      const res2 = parseCmdLineArgs(['-v']);
      expect(res2).toEqual(FLAG_VERSION_RESULT);
      const res2a = parseCmdLineArgs(['-v']);
      expect(res2a).not.toEqual(FLAG_HELP_RESULT);
      const res3 = parseCmdLineArgs(['-v', 'horse']);
      expect(res3).toEqual(FLAG_VERSION_RESULT);
      const res4 = () => parseCmdLineArgs(['horse', '-v']);
      expect(() => res4()).toThrow();
    });
  });

  // Initialize
  describe('init flag [-i, --init]', () => {
    it('should work as expected', async () => {
      const res1 = parseCmdLineArgs(['--init']);
      expect(res1).toEqual(GetFlagInitResult());
      const res2 = parseCmdLineArgs(['-i']);
      expect(res2).toEqual(GetFlagInitResult());
      const res2a = parseCmdLineArgs(['-i']);
      expect(res2a).not.toEqual(FLAG_HELP_RESULT);
      const res3 = parseCmdLineArgs(['-i', 'some-folder']);
      expect(res3).toEqual(GetFlagInitResult('some-folder'));
      const res4 = () => parseCmdLineArgs(['some-folder', '--init']);
      expect(() => res4()).toThrow();
      const res5 = () => parseCmdLineArgs(['-i', '--config']);
      expect(() => res5()).toThrow();
    });
  });

  // DryRun
  describe('dry-run flag [-d, --dry-run]', () => {
    it('should work as expected', async () => {
      const res1 = parseCmdLineArgs(['--dry-run']);
      expect(res1).toEqual(FLAG_DRY_RUN_RESULT);
      const res2 = parseCmdLineArgs(['-d']);
      expect(res2).toEqual(FLAG_DRY_RUN_RESULT);
      const res2a = parseCmdLineArgs(['-d']);
      expect(res2a).not.toEqual(FLAG_HELP_RESULT);
      const res3 = parseCmdLineArgs(['-d', 'horse']);
      expect(res3).toEqual(FLAG_DRY_RUN_RESULT);
      const res4 = parseCmdLineArgs(['horse', '-d']);
      expect(res4).toEqual(FLAG_DRY_RUN_RESULT);
    });
  });

  // Path + Config
  describe('path + config [-p/--path, -c/--config]', () => {
    it('should work as expected', async () => {
      // Each on its own
      const res1 = parseCmdLineArgs(['--path', './src']);
      expect(res1).toEqual(GetPathConfigResult('./src'));
      const res2 = parseCmdLineArgs(['--config', './cfg.json']);
      expect(res2).toEqual(GetPathConfigResult('', './cfg.json'));
      // Short forms
      const res3 = parseCmdLineArgs(['-p', './src']);
      expect(res3).toEqual(GetPathConfigResult('./src'));
      const res4 = parseCmdLineArgs(['-c', './cfg.json']);
      expect(res4).toEqual(GetPathConfigResult('', './cfg.json'));
      // Can be combined with the other option flags
      const res5 = parseCmdLineArgs(['--path', './src', '--dry-run']);
      expect(res5).toEqual({
        ...GetPathConfigResult('./src'),
        dryRun: true,
      });
    });

    it('should not care which of the two comes first', async () => {
      const expected = GetPathConfigResult('./src', './cfg.json');
      // `path` first
      const res1 = parseCmdLineArgs([
        '--path',
        './src',
        '--config',
        './cfg.json',
      ]);
      expect(res1).toEqual(expected);
      const res2 = parseCmdLineArgs(['-p', './src', '-c', './cfg.json']);
      expect(res2).toEqual(expected);
      // `config` first
      const res3 = parseCmdLineArgs([
        '--config',
        './cfg.json',
        '--path',
        './src',
      ]);
      expect(res3).toEqual(expected);
      const res4 = parseCmdLineArgs(['-c', './cfg.json', '-p', './src']);
      expect(res4).toEqual(expected);
    });

    it('should throw if the argument is missing', async () => {
      // Nothing at all after the flag
      expect(() => parseCmdLineArgs(['--path'])).toThrow();
      expect(() => parseCmdLineArgs(['--config'])).toThrow();
      expect(() => parseCmdLineArgs(['-p'])).toThrow();
      expect(() => parseCmdLineArgs(['-c'])).toThrow();
      // Another flag where the value should be
      expect(() => parseCmdLineArgs(['--path', '--config'])).toThrow();
      expect(() => parseCmdLineArgs(['--config', '--path'])).toThrow();
      // Only the trailing flag is missing its value
      expect(() => parseCmdLineArgs(['--path', './src', '--config'])).toThrow();
    });
  });
});
