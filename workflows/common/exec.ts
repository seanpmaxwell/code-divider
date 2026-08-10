/* eslint-disable no-console */
import { $ as $$ } from 'execa';


const tracker: Record<string, { first: boolean }> = {};

/**
 * Print execa commands
 */
const $ = $$({
    verbose: (verboseLine: string, { type, commandId }) => {
        if (type === 'command') {
            if (!tracker[commandId].first) console.log();
            tracker[commandId].first = false;
        }
        console.log(verboseLine);
    },
});

export default $;
