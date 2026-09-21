import copyDir from '@dev-tools/copyDir';
import onInit from '@dev-tools/onInit';
import shell from '@dev-tools/shell';

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
  await copyDir(TEMPLATES_DIR, TEMP_DIR);
  await shell('npm', ['run', 'start:build', '--', `--path=${TEMP_DIR}`]);
}, 'without-config-file-auto');
