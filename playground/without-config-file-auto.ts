import onInit from '@common/utils/fns/onInit';

import uFile from '@utilm/uFile';

import shell from '@shell';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const TEMPLATES_DIR = './playground/templates/without-config-file';
const TEMP_DIR = './playground/tmp';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

/**
 * Test running code-divider without a config file.
 */
await onInit(async () => {
  await uFile.testOnly.copyTo(TEMPLATES_DIR, TEMP_DIR);
  await shell('npm', ['run', 'start:build', '--', `--path=${TEMP_DIR}`]);
}, 'without-config-file-auto');
