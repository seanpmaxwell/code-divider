/* eslint-disable @typescript-eslint/no-unused-vars */
import logger from '@logger';

import insertCodeDividers from '@src/index';
import initializeDirectory from '@src/initializeDirectory';
import formatLabel from '@src/insertCodeDividers/applyFormatting/formatLabel';

// const resp = await initializeDirectory();
// console.log(resp);

const resp = await insertCodeDividers();
// logger.info(resp);

// @sec Test the `formatLabel()` function

// printTestLabels();
