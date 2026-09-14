import { describe, expect, it } from 'vitest';

import cmdLineParser, {
  type ParsedCmdLineArgs,
} from '@src/cli/_internal/cmdLineParser';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const CWD = process.cwd();

const DEFAULT_RESULT = {
  help: false,
  version: false,
  init: '',
  dryRun: false,
  check: false,
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
//                                  TESTS                                    //
// ========================================================================= //

describe('cmdLineParser', () => {
  // Help
  describe('help flag [-h, --help]', () => {
    it('should work as expected', async () => {
      const res1 = cmdLineParser(['--help']);
      expect(res1).toEqual(FLAG_HELP_RESULT);
      const res2 = cmdLineParser(['-h']);
      expect(res2).toEqual(FLAG_HELP_RESULT);
      // A trailing positional is parsed as the path; `cli` rejects the combo
      const res3 = cmdLineParser(['-h', 'horse']);
      expect(res3).toEqual({ ...FLAG_HELP_RESULT, path: 'horse' });
      const res4 = () => cmdLineParser(['horse', '-h']);
      expect(() => res4()).toThrow();
    });
  });

  // Version
  describe('version flag [-v, --version]', () => {
    it('should work as expected', async () => {
      const res1 = cmdLineParser(['--version']);
      expect(res1).toEqual(FLAG_VERSION_RESULT);
      const res2 = cmdLineParser(['-v']);
      expect(res2).toEqual(FLAG_VERSION_RESULT);
      const res2a = cmdLineParser(['-v']);
      expect(res2a).not.toEqual(FLAG_HELP_RESULT);
      const res3 = cmdLineParser(['-v', 'horse']);
      expect(res3).toEqual({ ...FLAG_VERSION_RESULT, path: 'horse' });
      const res4 = () => cmdLineParser(['horse', '-v']);
      expect(() => res4()).toThrow();
    });
  });

  // Initialize
  describe('init flag [-i, --init]', () => {
    it('should work as expected', async () => {
      const res1 = cmdLineParser(['--init']);
      expect(res1).toEqual(GetFlagInitResult());
      const res2 = cmdLineParser(['-i']);
      expect(res2).toEqual(GetFlagInitResult());
      const res2a = cmdLineParser(['-i']);
      expect(res2a).not.toEqual(FLAG_HELP_RESULT);
      const res3 = cmdLineParser(['-i', 'some-folder']);
      expect(res3).toEqual(GetFlagInitResult('some-folder'));
      const res4 = () => cmdLineParser(['some-folder', '--init']);
      expect(() => res4()).toThrow();
      const res5 = () => cmdLineParser(['-i', '--config']);
      expect(() => res5()).toThrow();
    });

    it('should accept the --init=<dir> form when it comes first', async () => {
      const res = cmdLineParser(['--init=some-folder']);
      expect(res).toEqual(GetFlagInitResult('some-folder'));
    });

    it('should reject init combined with anything but its directory', async () => {
      const re = /--init takes at most one argument/;
      expect(() => cmdLineParser(['-i', '-d'])).toThrow(re);
      expect(() => cmdLineParser(['--init', 'dir', '--dry-run'])).toThrow(re);
      expect(() => cmdLineParser(['--init=dir', 'extra'])).toThrow(re);
      expect(() => cmdLineParser(['-i', 'dir', '-p', 'src'])).toThrow(re);
      expect(() => cmdLineParser(['-i', 'dir', '-c', 'x.json'])).toThrow(re);
      expect(() => cmdLineParser(['-i', 'dir', '-h'])).toThrow(re);
    });
  });

  // DryRun
  describe('dry-run flag [-d, --dry-run]', () => {
    it('should work as expected', async () => {
      const res1 = cmdLineParser(['--dry-run']);
      expect(res1).toEqual(FLAG_DRY_RUN_RESULT);
      const res2 = cmdLineParser(['-d']);
      expect(res2).toEqual(FLAG_DRY_RUN_RESULT);
      const res2a = cmdLineParser(['-d']);
      expect(res2a).not.toEqual(FLAG_HELP_RESULT);
      // Order doesn't matter for options; the positional becomes the path
      const res3 = cmdLineParser(['-d', 'horse']);
      expect(res3).toEqual({ ...FLAG_DRY_RUN_RESULT, path: 'horse' });
      const res4 = cmdLineParser(['horse', '-d']);
      expect(res4).toEqual({ ...FLAG_DRY_RUN_RESULT, path: 'horse' });
    });
  });

  // Check
  describe('check flag [--check]', () => {
    it('should parse alone and combined with a path or dry run', async () => {
      expect(cmdLineParser(['--check'])).toEqual({
        ...DEFAULT_RESULT,
        check: true,
      });
      expect(cmdLineParser(['--check', 'src'])).toEqual({
        ...GetPathConfigResult('src'),
        check: true,
      });
      expect(cmdLineParser(['-d', '--check'])).toEqual({
        ...FLAG_DRY_RUN_RESULT,
        check: true,
      });
    });

    it('should not be combinable with --init', async () => {
      expect(() => cmdLineParser(['--init', 'dir', '--check'])).toThrow(
        /--init takes at most one argument/,
      );
    });
  });

  // Positional path
  describe('positional path', () => {
    it('should treat a bare argument as the path', async () => {
      expect(cmdLineParser(['src'])).toEqual(GetPathConfigResult('src'));
      expect(cmdLineParser(['./src/'])).toEqual(GetPathConfigResult('src/'));
    });

    it('should reject a positional combined with --path', async () => {
      expect(() => cmdLineParser(['src', '--path', 'lib'])).toThrow(/not both/);
      expect(() => cmdLineParser(['--path', 'lib', 'src'])).toThrow(/not both/);
    });

    it('should reject more than one positional', async () => {
      expect(() => cmdLineParser(['src', 'lib'])).toThrow(/at most one/);
    });
  });

  // Path + Config
  describe('path + config [-p/--path, -c/--config]', () => {
    it('should work as expected', async () => {
      // Each on its own
      const res1 = cmdLineParser(['--path', './src']);
      expect(res1).toEqual(GetPathConfigResult('src'));
      const res2 = cmdLineParser(['--config', './cfg.json']);
      expect(res2).toEqual(GetPathConfigResult('', 'cfg.json'));
      // Short forms
      const res3 = cmdLineParser(['-p', './src']);
      expect(res3).toEqual(GetPathConfigResult('src'));
      const res4 = cmdLineParser(['-c', './cfg.json']);
      expect(res4).toEqual(GetPathConfigResult('', 'cfg.json'));
      // Can be combined with the other option flags
      const res5 = cmdLineParser(['--path', './src', '--dry-run']);
      expect(res5).toEqual({
        ...GetPathConfigResult('src'),
        dryRun: true,
      });
    });

    it('should not care which of the two comes first', async () => {
      const expected = GetPathConfigResult('src', 'cfg.json');
      // `path` first
      const res1 = cmdLineParser(['--path', './src', '--config', './cfg.json']);
      expect(res1).toEqual(expected);
      const res2 = cmdLineParser(['-p', './src', '-c', './cfg.json']);
      expect(res2).toEqual(expected);
      // `config` first
      const res3 = cmdLineParser(['--config', './cfg.json', '--path', './src']);
      expect(res3).toEqual(expected);
      const res4 = cmdLineParser(['-c', './cfg.json', '-p', './src']);
      expect(res4).toEqual(expected);
    });

    it('should throw if the argument is missing', async () => {
      // Nothing at all after the flag
      expect(() => cmdLineParser(['--path'])).toThrow();
      expect(() => cmdLineParser(['--config'])).toThrow();
      expect(() => cmdLineParser(['-p'])).toThrow();
      expect(() => cmdLineParser(['-c'])).toThrow();
      // Another flag where the value should be
      expect(() => cmdLineParser(['--path', '--config'])).toThrow();
      expect(() => cmdLineParser(['--config', '--path'])).toThrow();
      // Only the trailing flag is missing its value
      expect(() => cmdLineParser(['--path', './src', '--config'])).toThrow();
    });
  });
});
