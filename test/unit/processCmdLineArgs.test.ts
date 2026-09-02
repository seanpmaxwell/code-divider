import { describe, expect, it } from 'vitest';

import { processCmdLineArgs } from '../../src/cli-helpers';

// @reg Constants

const SHOW_HELP_RESULT = {
  showHelp: true,
  showVersion: false,
  doDryRun: false,
  initializeDirectory: false,
  configFilePath: './code-divider.config.json',
  targetPath: './'
} as const;

const SHOW_VERSION_RESULT = {
  showHelp: false,
  showVersion: true,
  doDryRun: false,
  initializeDirectory: false,
  configFilePath: './code-divider.config.json',
  targetPath: './'
} as const;

// ========================================================================= //
//                                 Run Tests                                 //
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
