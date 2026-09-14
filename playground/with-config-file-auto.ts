import FileUtils from '@modules/FileUtils';

import onInit from '@common/utils/onInit';
import shell from '@common/utils/shell';

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
  await FileUtils.testOnly.copyTo(TEMPLATES_DIR, TEMP_DIR);
  await shell('npm', ['run', 'start', '--', `--path=${TEMP_DIR}`]);
}, 'with-config-file-auto');
