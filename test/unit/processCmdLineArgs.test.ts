import { processCmdLineArgs, type ProcessedCmdLineArgs } from '@src';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { CONFIG_FILE_NAME } from '@common/constants/misc';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const CURRENT_WORKING_DIRECTORY = process.cwd();
const DEFAULT_CONFIG_FILE_PATH = path.join(process.cwd(), CONFIG_FILE_NAME);

const DEFAULT_RESULT = {
  showHelp: false,
  showVersion: false,
  doDryRun: false,
  initializeDirectory: false,
  initializeDirectoryPath: CURRENT_WORKING_DIRECTORY,
  configFilePath: DEFAULT_CONFIG_FILE_PATH,
  targetPath: CURRENT_WORKING_DIRECTORY,
} as const satisfies ProcessedCmdLineArgs;

const SHOW_HELP_RESULT = {
  ...DEFAULT_RESULT,
  showHelp: true,
} as const satisfies ProcessedCmdLineArgs;

const SHOW_VERSION_RESULT = {
  ...DEFAULT_RESULT,
  showVersion: true,
} as const satisfies ProcessedCmdLineArgs;

const GetDefaultInitResult = (
  path = CURRENT_WORKING_DIRECTORY,
): ProcessedCmdLineArgs => ({
  ...DEFAULT_RESULT,
  showVersion: false,
  initializeDirectory: true,
  initializeDirectoryPath: path,
});

// ========================================================================= //
//                                 RUN TESTS                                 //
// ========================================================================= //

describe.only('processCmdLineArgs', () => {
  describe('help flag [-h, --help]', () => {
    it('should work as expected', async () => {
      const res1 = processCmdLineArgs(['--help']);
      expect(res1).toEqual(SHOW_HELP_RESULT);
      const res2 = processCmdLineArgs(['-h']);
      expect(res2).toEqual(SHOW_HELP_RESULT);
      const res3 = processCmdLineArgs(['-h', 'horse']);
      expect(res3).toEqual(SHOW_HELP_RESULT);
      const res4 = () => processCmdLineArgs(['horse', '-h']);
      expect(() => res4()).toThrow();
    });
  });

  describe('version flag [-v, --version]', () => {
    it('should work as expected', async () => {
      const res1 = processCmdLineArgs(['--version']);
      expect(res1).toEqual(SHOW_VERSION_RESULT);
      const res2 = processCmdLineArgs(['-v']);
      expect(res2).toEqual(SHOW_VERSION_RESULT);
      const res2a = processCmdLineArgs(['-v']);
      expect(res2a).not.toEqual(SHOW_HELP_RESULT);
      const res3 = processCmdLineArgs(['-v', 'horse']);
      expect(res3).toEqual(SHOW_VERSION_RESULT);
      const res4 = () => processCmdLineArgs(['horse', '-v']);
      expect(() => res4()).toThrow();
    });
  });

  describe('init flag [-i, --init]', () => {
    it('should work as expected', async () => {
      const res1 = processCmdLineArgs(['--init']);
      expect(res1).toEqual(GetDefaultInitResult());
      const res2 = processCmdLineArgs(['-i']);
      expect(res2).toEqual(GetDefaultInitResult());
      const res2a = processCmdLineArgs(['-i']);
      expect(res2a).not.toEqual(SHOW_HELP_RESULT);
      const res3 = processCmdLineArgs(['-i', 'some-folder']);
      console.log(); // pick up here
      expect(res3).toEqual(GetDefaultInitResult());
      const res4 = () => processCmdLineArgs(['some-folder', '--init']);
      expect(() => res4()).toThrow();
    });
  });

  // describe('dryRun flag [-dr, --dry-run]', () => {

  //   it('should work as expected', async () => {
  //     const res1 = processCmdLineArgs(['--dry-run']);
  //     expect(res1).toEqual(SHOW_VERSION_RESULT);
  //     const res2 = processCmdLineArgs(['-dr']);
  //     expect(res2).toEqual(SHOW_VERSION_RESULT);
  //     const res2a = processCmdLineArgs(['-dr']);
  //     expect(res2a).not.toEqual(SHOW_HELP_RESULT);
  //     const res3 = processCmdLineArgs(['-dr', 'horse']);
  //     expect(res3).toEqual(SHOW_VERSION_RESULT);
  //     const res4 = () => processCmdLineArgs(['horse', '-dr']);
  //     expect(() => res4()).toThrow();
  //   });
  // });
});
