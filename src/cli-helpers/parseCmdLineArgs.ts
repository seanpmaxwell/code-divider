import util from 'util';

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
  // Return
  return {
    help: !!values.help,
    version: !!values.version,
    init: values.init ?? '',
    dryRun: !!values.dryRun,
    path: values.config ?? '',
    config: values.config ?? '',
  };
}

/**
 * `--init/-i` defaults to './' when omitted entirely, but if the flag is typed
 * with no following value (e.g. `--init` followed by nothing or another
 * flag), parseArgs still requires a string value and will throw. This
 * preprocessing step supplies './' in that bare-flag case before parsing.
 *
 * @private
 * @see {parseCmdLineArgs}
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

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default parseCmdLineArgs;
