/* eslint-disable @typescript-eslint/no-unused-vars */
import insertCodeDividers, {
  initializeDirectory,
  onInit,
  parseCmdLineArgs,
} from '@src/index';

import logger from '@logger';

// @reg run

await onInit.skip(async () => {
  // const resp = await initializeDirectory();
  // logger.info(resp);
  // const resp2 = await insertCodeDividers('./playground/misc.ts');
  // logger.info(resp);
  // logger.info(resp);
  // @sec Test the `formatLabel()` function
  // printTestLabels();
});

// @sec Process Command Line Arguments

logger.info('horse');

await onInit(async () => {
  logger.info('horse');
  logger.info(parseCmdLineArgs(['--help']));
  logger.info(parseCmdLineArgs(['-h']));
  logger.info(parseCmdLineArgs(['-h', 'horse']));
  logger.info(parseCmdLineArgs(['-h', 'horse']));
});
