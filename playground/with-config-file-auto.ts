import shell from '@shell';

import uFile from '@utilm/uFile';

import onInit from '@common/utils/fns/onInit';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const TEMPLATES_DIR = './playground/templates/with-config-file';
const TEMP_DIR = './playground/tmp';

// ========================================================================= //
//                                   INIT                                    //
// ========================================================================= //

/**
 * Test running code-dividers with an existing config file.
 */
await onInit(async () => {
  await uFile.testOnly.copyTo(TEMPLATES_DIR, TEMP_DIR);
  await shell('npm', ['run', 'start:build', '--', `--path=${TEMP_DIR}`]);
}, 'with-config-file-auto');
