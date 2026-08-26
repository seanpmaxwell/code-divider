import initializeDirectory from '@src/initializeDirectory';
import insertCodeDividers from '@src/index';
import logger from 'my-tools/simple-logger';

// const resp = await initializeDirectory();
// console.log(resp);

const resp = await insertCodeDividers();
logger.info(resp);
