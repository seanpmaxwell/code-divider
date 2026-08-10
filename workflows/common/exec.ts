/* eslint-disable no-console */
import { $ as $$ } from 'execa';


/**
 * Print execa commands
 */
const $ = $$({
    verbose: 'full',
});

export default $;
