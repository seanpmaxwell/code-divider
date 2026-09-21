import { describe, expect, it } from 'vitest';

import cmdLineParser, {
  type ParsedCmdLineArgs,
} from '@src/cli/_internal/cmdLineParser';

import UserError from '@common/utils/classes/UserError';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const CWD = process.cwd();

// Every call passes the same cwd, which is what a bare `--init` defaults to.
const parse = (args: string[]) => cmdLineParser(args, CWD);

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
//                                   TESTS                                   //
// ========================================================================= //

describe('cmdLineParser', () => {
  // Help
  describe('help flag [-h, --help]', () => {
    it('should work as expected', async () => {
      const res1 = parse(['--help']);
      expect(res1).toEqual(FLAG_HELP_RESULT);
      const res2 = parse(['-h']);
      expect(res2).toEqual(FLAG_HELP_RESULT);
      // Bare arguments are rejected, wherever they appear
      const res3 = () => parse(['-h', 'horse']);
      expect(() => res3()).toThrow(/Unexpected argument "horse"/);
      const res4 = () => parse(['horse', '-h']);
      expect(() => res4()).toThrow();
    });
  });

  // Version
  describe('version flag [-v, --version]', () => {
    it('should work as expected', async () => {
      const res1 = parse(['--version']);
      expect(res1).toEqual(FLAG_VERSION_RESULT);
      const res2 = parse(['-v']);
      expect(res2).toEqual(FLAG_VERSION_RESULT);
      const res2a = parse(['-v']);
      expect(res2a).not.toEqual(FLAG_HELP_RESULT);
      const res3 = () => parse(['-v', 'horse']);
      expect(() => res3()).toThrow(/Unexpected argument "horse"/);
      const res4 = () => parse(['horse', '-v']);
      expect(() => res4()).toThrow();
    });
  });

  // Initialize
  describe('init flag [-i, --init]', () => {
    it('should work as expected', async () => {
      const res1 = parse(['--init']);
      expect(res1).toEqual(GetFlagInitResult());
      const res2 = parse(['-i']);
      expect(res2).toEqual(GetFlagInitResult());
      const res2a = parse(['-i']);
      expect(res2a).not.toEqual(FLAG_HELP_RESULT);
      const res3 = parse(['-i', 'some-folder']);
      expect(res3).toEqual(GetFlagInitResult('some-folder'));
      const res4 = () => parse(['some-folder', '--init']);
      expect(() => res4()).toThrow();
      const res5 = () => parse(['-i', '--config']);
      expect(() => res5()).toThrow();
    });

    it('should accept the --init=<dir> form when it comes first', async () => {
      const res = parse(['--init=some-folder']);
      expect(res).toEqual(GetFlagInitResult('some-folder'));
    });

    it('should reject init combined with anything but its directory', async () => {
      const re = /--init takes at most one argument/;
      expect(() => parse(['-i', '-d'])).toThrow(re);
      expect(() => parse(['--init', 'dir', '--dry-run'])).toThrow(re);
      expect(() => parse(['--init=dir', 'extra'])).toThrow(re);
      expect(() => parse(['-i', 'dir', '-p', 'src'])).toThrow(re);
      expect(() => parse(['-i', 'dir', '-c', 'x.json'])).toThrow(re);
      expect(() => parse(['-i', 'dir', '-h'])).toThrow(re);
    });
  });

  // DryRun
  describe('dry-run flag [-d, --dry-run]', () => {
    it('should work as expected', async () => {
      const res1 = parse(['--dry-run']);
      expect(res1).toEqual(FLAG_DRY_RUN_RESULT);
      const res2 = parse(['-d']);
      expect(res2).toEqual(FLAG_DRY_RUN_RESULT);
      const res2a = parse(['-d']);
      expect(res2a).not.toEqual(FLAG_HELP_RESULT);
      // Order doesn't matter for options
      const res3 = parse(['-d', '-p', 'horse']);
      expect(res3).toEqual({ ...FLAG_DRY_RUN_RESULT, path: 'horse' });
      const res4 = parse(['-p', 'horse', '-d']);
      expect(res4).toEqual({ ...FLAG_DRY_RUN_RESULT, path: 'horse' });
    });
  });

  // Check
  describe('check flag [--check]', () => {
    it('should parse alone and combined with a path or dry run', async () => {
      expect(parse(['--check'])).toEqual({
        ...DEFAULT_RESULT,
        check: true,
      });
      expect(parse(['--check', '--path', 'src'])).toEqual({
        ...GetPathConfigResult('src'),
        check: true,
      });
      expect(parse(['-d', '--check'])).toEqual({
        ...FLAG_DRY_RUN_RESULT,
        check: true,
      });
    });

    it('should not be combinable with --init', async () => {
      expect(() => parse(['--init', 'dir', '--check'])).toThrow(
        /--init takes at most one argument/,
      );
    });
  });

  // Errors
  describe('errors', () => {
    it('should throw a UserError for an unknown option', async () => {
      expect(() => parse(['--bogus'])).toThrow(UserError);
      expect(() => parse(['--bogus'])).toThrow(/bogus/);
    });

    it('should throw a UserError for a bare argument', async () => {
      expect(() => parse(['src'])).toThrow(UserError);
    });
  });

  // Bare arguments
  describe('bare arguments', () => {
    it('should reject a bare path and point to --path', async () => {
      expect(() => parse(['src'])).toThrow(
        'Unexpected argument "src". Pass the path with --path (e.g. --path src)',
      );
    });

    it('should reject a bare argument alongside --path', async () => {
      const re = /Unexpected argument "src"/;
      expect(() => parse(['src', '--path', 'lib'])).toThrow(re);
      expect(() => parse(['--path', 'lib', 'src'])).toThrow(re);
    });

    it('should reject more than one bare argument', async () => {
      expect(() => parse(['src', 'lib'])).toThrow(/Unexpected argument "src"/);
    });
  });

  // Path + Config
  describe('path + config [-p/--path, -c/--config]', () => {
    it('should work as expected', async () => {
      // Each on its own
      const res1 = parse(['--path', './src']);
      expect(res1).toEqual(GetPathConfigResult('src'));
      const res2 = parse(['--config', './cfg.json']);
      expect(res2).toEqual(GetPathConfigResult('', 'cfg.json'));
      // Short forms
      const res3 = parse(['-p', './src']);
      expect(res3).toEqual(GetPathConfigResult('src'));
      const res4 = parse(['-c', './cfg.json']);
      expect(res4).toEqual(GetPathConfigResult('', 'cfg.json'));
      // Can be combined with the other option flags
      const res5 = parse(['--path', './src', '--dry-run']);
      expect(res5).toEqual({
        ...GetPathConfigResult('src'),
        dryRun: true,
      });
    });

    it('should not care which of the two comes first', async () => {
      const expected = GetPathConfigResult('src', 'cfg.json');
      // `path` first
      const res1 = parse(['--path', './src', '--config', './cfg.json']);
      expect(res1).toEqual(expected);
      const res2 = parse(['-p', './src', '-c', './cfg.json']);
      expect(res2).toEqual(expected);
      // `config` first
      const res3 = parse(['--config', './cfg.json', '--path', './src']);
      expect(res3).toEqual(expected);
      const res4 = parse(['-c', './cfg.json', '-p', './src']);
      expect(res4).toEqual(expected);
    });

    it('should throw if the argument is missing', async () => {
      // Nothing at all after the flag
      expect(() => parse(['--path'])).toThrow();
      expect(() => parse(['--config'])).toThrow();
      expect(() => parse(['-p'])).toThrow();
      expect(() => parse(['-c'])).toThrow();
      // Another flag where the value should be
      expect(() => parse(['--path', '--config'])).toThrow();
      expect(() => parse(['--config', '--path'])).toThrow();
      // Only the trailing flag is missing its value
      expect(() => parse(['--path', './src', '--config'])).toThrow();
    });
  });
});
