import cmdLineParser from '@src/cli/_internal/cmdLineParser';

import logger from '@logger';

import onInit from '@dev-tools/onInit';
import shell from '@dev-tools/shell';

// ========================================================================= //
//                                    RUN                                    //
// ========================================================================= //

// ===================== Process Command Line Arguments ==================== //

await onInit.skip(async () => {
  const cwd = process.cwd();
  logger.info(cmdLineParser(['--help'], cwd));
  logger.info(cmdLineParser(['-h'], cwd));
  logger.info(cmdLineParser(['-i'], cwd));
}, 'pg_parseCommandLineArgs');

// Display the version
await onInit(async () => {
  const stdout = await shell('npm', ['run', 'start', '--', '--version']);
  logger.info(stdout);
}, 'pg_version');
