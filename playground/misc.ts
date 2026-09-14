import cmdLineParser from '@src/cli/_internal/cmdLineParser';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import insertCodeDividers from '@src/index';

import logger from '@modules/logger';

import onInit from '@common/utils/onInit';
import shell from '@common/utils/shell';

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

logger.info('horse');

await onInit.skip(async () => {
  logger.info('horse');
  logger.info(cmdLineParser(['--help']));
  logger.info(cmdLineParser(['-h']));
  logger.info(cmdLineParser(['-h', 'horse']));
  logger.info(cmdLineParser(['-h', 'horse']));
}, 'pg_parseCommandLineArgs');

// Display the version
await onInit(async () => {
  const stdout = await shell('npm', ['run', 'start', '--', '--version']);
  logger.info(stdout);
}, 'pg_version');
