import path from 'path';
import { describe, expect, it } from 'vitest';

import { parseCmdLineArgs, type ParsedCmdLineArgs } from '@src/cli-helpers';
import { CONFIG_FILE_NAME } from '@common/constants/misc';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const CWD = process.cwd();
const DEFAULT_CONFIG_FILE_PATH = path.join(CWD, CONFIG_FILE_NAME);

const DEFAULT_RESULT = {
  help: false,
  version: false,
  init: '',
  dryRun: false,
  path: '',
  config: '',
} as const satisfies ParsedCmdLineArgs;

const SHOW_HELP_RESULT = {
  ...DEFAULT_RESULT,
  help: true,
} as const satisfies ParsedCmdLineArgs;

const SHOW_VERSION_RESULT = {
  ...DEFAULT_RESULT,
  version: true,
} as const satisfies ParsedCmdLineArgs;

const GetDefaultInitResult = (path = CWD): ParsedCmdLineArgs => ({
  ...DEFAULT_RESULT,
  init: path,
});

// ========================================================================= //
//                                 RUN TESTS                                 //
// ========================================================================= //

describe.only('parseCmdLineArgs', () => {
  console.log() // pick up here, make sure existing tests still work
  describe('help flag [-h, --help]', () => {
    it('should work as expected', async () => {
      const res1 = parseCmdLineArgs(['--help']);
      expect(res1).toEqual(SHOW_HELP_RESULT);
      const res2 = parseCmdLineArgs(['-h']);
      expect(res2).toEqual(SHOW_HELP_RESULT);
      const res3 = parseCmdLineArgs(['-h', 'horse']);
      expect(res3).toEqual(SHOW_HELP_RESULT);
      const res4 = () => parseCmdLineArgs(['horse', '-h']);
      expect(() => res4()).toThrow();
    });
  });

  // describe('version flag [-v, --version]', () => {
  //   it('should work as expected', async () => {
  //     const res1 = parseCmdLineArgs(['--version']);
  //     expect(res1).toEqual(SHOW_VERSION_RESULT);
  //     const res2 = parseCmdLineArgs(['-v']);
  //     expect(res2).toEqual(SHOW_VERSION_RESULT);
  //     const res2a = parseCmdLineArgs(['-v']);
  //     expect(res2a).not.toEqual(SHOW_HELP_RESULT);
  //     const res3 = parseCmdLineArgs(['-v', 'horse']);
  //     expect(res3).toEqual(SHOW_VERSION_RESULT);
  //     const res4 = () => parseCmdLineArgs(['horse', '-v']);
  //     expect(() => res4()).toThrow();
  //   });
  // });

  // describe('init flag [-i, --init]', () => {
  //   it('should work as expected', async () => {
  //     const res1 = parseCmdLineArgs(['--init']);
  //     expect(res1).toEqual(GetDefaultInitResult());
  //     const res2 = parseCmdLineArgs(['-i']);
  //     expect(res2).toEqual(GetDefaultInitResult());
  //     const res2a = parseCmdLineArgs(['-i']);
  //     expect(res2a).not.toEqual(SHOW_HELP_RESULT);
  //     const res3 = parseCmdLineArgs(['-i', 'some-folder']);
  //     expect(res3).toEqual(GetDefaultInitResult('some-folder'));
  //     const res4 = () => parseCmdLineArgs(['some-folder', '--init']);
  //     expect(() => res4()).toThrow();
  //     const res5 = () => parseCmdLineArgs(['-i', '--config']);
  //     console.log(res5());
  //     expect(() => res5()).toThrow();
  //   });
  // });

  // describe('dryRun flag [-dr, --dry-run]', () => {

  //   it('should work as expected', async () => {
  //     const res1 = parseCmdLineArgs(['--dry-run']);
  //     expect(res1).toEqual(SHOW_VERSION_RESULT);
  //     const res2 = parseCmdLineArgs(['-dr']);
  //     expect(res2).toEqual(SHOW_VERSION_RESULT);
  //     const res2a = parseCmdLineArgs(['-dr']);
  //     expect(res2a).not.toEqual(SHOW_HELP_RESULT);
  //     const res3 = parseCmdLineArgs(['-dr', 'horse']);
  //     expect(res3).toEqual(SHOW_VERSION_RESULT);
  //     const res4 = () => parseCmdLineArgs(['horse', '-dr']);
  //     expect(() => res4()).toThrow();
  //   });
  // });
});
