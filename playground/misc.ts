/* eslint-disable @typescript-eslint/no-unused-vars */
import logger from '@logger';
import insertCodeDividers, { initializeDirectory } from '@src';
import { onInit, processCmdLineArgs } from '../src/cli-helpers';

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

logger.info('horse')

await onInit(async () => {
  logger.info('horse')
  logger.info(processCmdLineArgs(['--help']));
  logger.info(processCmdLineArgs(['-h']));
  logger.info(processCmdLineArgs(['-h', 'horse']));
  logger.info(processCmdLineArgs(['-h', 'horse']));
});
