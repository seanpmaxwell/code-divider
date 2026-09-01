/* eslint-disable @typescript-eslint/no-unused-vars */

import logger from '@logger';
import insertCodeDividers, { onInit } from '@src/index';
import initializeDirectory from '@src/initializeDirectory/initializeDirectory';
import formatLabel from '@src/insertCodeDividers/applyFormatting/formatLabel';
import processCmdLineArgs from '@src/cli-helpers/processCmdLineArgs';

// @reg run

/**
 * Run
 */
await onInit(async () => {
  // const resp = await initializeDirectory();
  // console.log(resp);
  // const resp = await insertCodeDividers('./playground/misc.ts');
  // console.log(resp);
  // logger.info(resp);
  // @sec Test the `formatLabel()` function
  // printTestLabels();
});

/**
 * 
 */
function testProcessCmdLineArgs() {
  console.log() // pick up here
}
