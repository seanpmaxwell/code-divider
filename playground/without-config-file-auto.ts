import shell from '@shell';

import uFile from '@utilm/uFile';

import onInit from '../dev-tools/onInit';

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
