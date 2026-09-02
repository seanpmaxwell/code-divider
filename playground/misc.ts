/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import logger from '@logger';
import processCmdLineArgs from '@src/cli-helpers/processCmdLineArgs';
import insertCodeDividers, { onInit } from '@src/index';
import initializeDirectory from '@src/initializeDirectory/initializeDirectory';
import formatLabel from '@src/insertCodeDividers/applyFormatting/formatLabel';

// @reg run

await onInit.skip(async () => {
  const resp = await initializeDirectory();
  console.log(resp);
  const resp2 = await insertCodeDividers('./playground/misc.ts');
  console.log(resp);
  logger.info(resp);
  // @sec Test the `formatLabel()` function
  // printTestLabels();
});

// @sec Process Command Line Arguments

await onInit(async () => {
  console.info(processCmdLineArgs(['--help']));
  console.info(processCmdLineArgs(['-h']));
  console.info(processCmdLineArgs(['-h']));
});
