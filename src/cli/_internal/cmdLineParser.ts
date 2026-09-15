import path from 'path';
import util from 'util';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const ShouldBeFirstSet = new Set([
  '--init',
  '-i',
  '--help',
  '-h',
  '--version',
  '-v',
]);

const PARSE_ARG_OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  init: { type: 'string', short: 'i' }, // no default — stays undefined if omitted
  ['dry-run']: { type: 'boolean', short: 'd' },
  check: { type: 'boolean' }, // no short flag: `-c` is taken by `--config`
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
  check: boolean;
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
function cmdLineParser(args: string[]): ParsedCmdLineArgs {
  // ---- Parse the arguments with `util`
  const { values: pArgs, positionals } = util.parseArgs({
    args: preprocessArgs(args),
    options: PARSE_ARG_OPTIONS,
    allowPositionals: true,
  });

  // ---- Validate helpers (`args[0]` may be in the `--flag=value` form)
  const firstFlag = args[0]?.split('=')[0];
  if (
    (pArgs.help || pArgs.version || pArgs.init) &&
    !ShouldBeFirstSet.has(firstFlag)
  ) {
    throw new Error(
      'If specified, the flags [--init,--version,--help] should come first',
    );
  }

  // ---- `init` runs alone: the only thing it accepts is its own directory value
  if (pArgs.init) {
    const hasOtherFlag =
      pArgs.help ||
      pArgs.version ||
      pArgs['dry-run'] ||
      pArgs.check ||
      pArgs.path !== undefined ||
      pArgs.config !== undefined;
    if (hasOtherFlag || positionals.length > 0) {
      throw new Error(
        '--init takes at most one argument (a directory) and cannot be combined with other options',
      );
    }
  }

  // ---- Bare arguments aren't accepted: the path must be given with `--path`.
  // Positionals are still allowed by `parseArgs` so this error can say so.
  if (positionals.length > 0) {
    throw new Error(
      `Unexpected argument "${positionals[0]}". Pass the path with --path (e.g. --path ${positionals[0]})`,
    );
  }
  const targetPath = pArgs.path;

  // ---- Return
  return {
    help: !!pArgs.help,
    version: !!pArgs.version,
    init: pArgs.init ? path.normalize(pArgs.init) : '',
    dryRun: !!pArgs['dry-run'],
    check: !!pArgs.check,
    path: targetPath ? path.normalize(targetPath) : '',
    config: pArgs.config ? path.normalize(pArgs.config) : '',
  };
}

/**
 * `--init` if specified but no value is passed will default to process.cwd.
 * But `parseArgs` still requires a string value and will throw if there isn't
 * one. This preprocessing step supplies the `process.cwd()` value in that
 * bare-flag case before parsing.
 *
 * Used by: {@link cmdLineParser}
 *
 * @private
 */
function preprocessArgs(argv: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    result.push(arg);
    if (arg === '--init' || arg === '-i') {
      const next = argv[i + 1];
      const hasValue = next !== undefined && !next.startsWith('-');
      if (!hasValue) result.push(process.cwd());
    }
  }
  return result;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default cmdLineParser;
