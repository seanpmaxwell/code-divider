/* eslint-disable @typescript-eslint/no-unused-vars */
import initializeDirectory from '@src/initializeDirectory';
import insertCodeDividers from '@src/index';
import logger from '@logger';
import formatLabel from '@src/insertCodeDividers/applyFormatting/formatLabel';

// const resp = await initializeDirectory();
// console.log(resp);

const resp = await insertCodeDividers();
// logger.info(resp);


// @sec Test the `formatLabel()` function

// printTestLabels();

function printTestLabels() {
  const LABEL_1 = 'Functions';
  const LABEL_2 = 'setup the .someFn function';
  const LABEL_3 = 'setup the `someFn` function';
  const LABEL_4 = 'setup the `someFn function`';
  const LABELS = [LABEL_1, LABEL_2, LABEL_3, LABEL_4];
  let i = 0;
  for (const label of LABELS) {
    const dividerType = i++ % 2 === 0 ? 'region' : 'section';
    const labelNew = formatLabel(label, '', 0, dividerType);
    logger.info(labelNew);
  }
}
