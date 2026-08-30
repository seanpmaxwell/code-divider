/* eslint-disable @typescript-eslint/no-unused-vars */
import logger from '@logger';

import insertCodeDividers from '@src/index';
import initializeDirectory from '@src/initializeDirectory';
import formatLabel from '@src/insertCodeDividers/applyFormatting/formatLabel';

// @reg run

/**
 * Run
 */
await (async function _run(): Promise<void> {
  try {
    // const resp = await initializeDirectory();
    // console.log(resp);

    const resp = await insertCodeDividers('./playground/misc.ts');
    console.log(resp)

  } catch (err) {
    logger.error(err);
    // logger.info(resp);
    // @sec Test the `formatLabel()` function
    // printTestLabels();
  }
})();
