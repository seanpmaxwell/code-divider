import ulog from '@logger';
import shell from '@shell';

import cmdLineParser from '@src/cli/_internal/cmdLineParser';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { insertCodeDividers } from '@src/index';

import onInit from '../dev-tools/onInit';

// ========================================================================= //
//                                    RUN                                    //
// ========================================================================= //

// await onInit.skip(async () => {
//   const resp = await initializeDirectory();
//   logger.info(resp);
//   const resp2 = await insertCodeDividers('./playground/misc.ts');
//   logger.info(resp);
//   logger.info(resp);
//   // @sec Test the `formatLabel()` function
//   printTestLabels();
// });

// ===================== Process Command Line Arguments ==================== //

ulog.info('horse');

await onInit.skip(async () => {
  ulog.info('horse');
  ulog.info(cmdLineParser(['--help']));
  ulog.info(cmdLineParser(['-h']));
  ulog.info(cmdLineParser(['-h', 'horse']));
  ulog.info(cmdLineParser(['-h', 'horse']));
}, 'pg_parseCommandLineArgs');

// Display the version
await onInit(async () => {
  const stdout = await shell('npm', ['run', 'start', '--', '--version']);
  ulog.info(stdout);
}, 'pg_version');
