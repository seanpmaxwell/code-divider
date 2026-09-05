import path from 'path';
import util from 'util';

import { CONFIG_FILE_NAME } from '@common/constants/misc';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const INIT_DEFAULT = './';

const PARSE_ARG_OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  init: { type: 'string', short: 'i' }, // no default — stays undefined if omitted
  dryRun: { type: 'boolean', short: 'd' },
  path: { type: 'string', short: 'p' },
  config: { type: 'string', short: 'c' },
} as const;

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

// Empty strings for falsey arguments
export interface ParsedCmdLineArgs {
  help: boolean;
  version: boolean;
  init: string;
  dryRun: boolean;
  path: string;
  config: string;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Convert the command line args array to an object: 2 categories.
 *
 * `Helpers`: Run alone and do not fire `insertCodeDividers`
 * `Options`: Can be combined with each-other and do fire `insertCodeDividers`.
 */
function parseCmdLineArgs(args: string[]): ParsedCmdLineArgs {
  // Parse the arguments with `util`
  const { values, positionals } = util.parseArgs({
    args: preprocessArgs(args),
    options: PARSE_ARG_OPTIONS,
    allowPositionals: true,
  });
  // Every argument which receives a value should only receive 1
  if (positionals.length > 1) {
    throw new Error(
      `Error: expected at most one path argument, got ${positionals.length}: ${positionals.join(', ')}`,
    );
  }
  // Get the current working directory
  const cwd = process.cwd();
  // Return
  return {
    help: !!values.help,
    version: !!values.version,
    init: processPath(values.init),
    dryRun: !!values.dryRun,
    path: values.path
      ? processPath(values.config)
      : path.join(cwd, CONFIG_FILE_NAME),
    config: processPath(values.config),
  };
}

/**
 * @private
 * @see {parseCmdLineArgs}
 *
 * `--init/-i` defaults to './' when omitted entirely, but if the flag is typed
 * with no following value (e.g. `--init` followed by nothing or another
 * flag), parseArgs still requires a string value and will throw. This
 * preprocessing step supplies './' in that bare-flag case before parsing.
 */
function preprocessArgs(argv: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    result.push(arg);
    if (arg === '--init' || arg === '-i') {
      const next = argv[i + 1];
      const hasValue = next !== undefined && !next.startsWith('-');
      if (!hasValue) {
        result.push(INIT_DEFAULT);
      }
    }
  }
  return result;
}

/**
 * @private
 * @see {parseCmdLineArgs}
 *
 * If a path is not an absolute path, join it to the current working directory.
 */
function processPath(value: string | undefined): string {
  if (value === undefined) {
    return '';
  } else if (path.isAbsolute(value)) {
    return value;
  } else {
    const cwd = process.cwd();
    return path.join(cwd, value);
  }
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default parseCmdLineArgs;
