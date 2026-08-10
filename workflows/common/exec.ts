/* eslint-disable no-console */
import { $ as $$ } from 'execa';


let first = true;

/**
 * Print execa commands
 */
const $ = $$({
  verbose: (verboseLine: string, { type }: { type: string }) => {
    if (type === 'command') {
      if (!first) console.log();
      first = false;
    }
    console.log(verboseLine);
  },
});

export default $;
