// @reg Constants

const DEFAULT_VALUES = {
  showHelp: false,
  showVersion: false,
  doDryRun: false,
  initializeDirectory: false,
  configFilePath: './code-divider.config.json',
  targetPath: './',
} as const satisfies ProcessedCmdLineArgs;

const CommandLineArgs = {
  // Helpers (only one option)
  helpers: {
    help: ['-h', '--help'],
    version: ['-v', '--version'],
    dryRun: ['-dr', '--dry-run'],
    init: ['init'],
  },
  // Options when inserting code-dividers
  options: {
    targetPath: ['-p', '--path'],
    configFilePath: ['-c', '--config'],
  },
} as const;

// @reg Types

type CommandLineArgs = typeof CommandLineArgs;

interface ProcessedCmdLineArgs {
  showHelp: boolean;
  showVersion: boolean;
  doDryRun: boolean;
  initializeDirectory: boolean;
  configFilePath: string;
  targetPath: string;
}

// @reg Functions

/**
 * Convert the command line args array to an object. For the "helpers"
 * property, there should only be one argument so we return right away.
 */
function processCmdLineArgs(args: string[]): ProcessedCmdLineArgs {
  const arg1 = args[0];
  const retVal: ProcessedCmdLineArgs = { ...DEFAULT_VALUES };
  // Check `helpers`
  if (testHelperFlag('help', arg1)) {
    return { ...retVal, showHelp: true };
  } else if (testHelperFlag('version', arg1)) {
    return { ...retVal, showVersion: true };
  } else if (testHelperFlag('dryRun', arg1)) {
    return { ...retVal, doDryRun: true };
  } else if (testHelperFlag('init', arg1)) {
    return { ...retVal, initializeDirectory: true };
  }
  // Check `targetPath`
  const argsNew = splitEqualsSign(args);
  const targetPath = getOptionValue('targetPath', argsNew);
  if (targetPath !== null) {
    retVal.targetPath = targetPath;
  }
  // Check `configFilePath`
  const configFilePath = getOptionValue('configFilePath', argsNew);
  if (configFilePath !== null) {
    retVal.configFilePath = configFilePath;
  }
  // Return
  return retVal;
}

/**
 * @private
 *
 * See if a helper flag was passed. These skip running "insertCodeDividers"
 * function so should return right away.
 */
function testHelperFlag(
  key: keyof CommandLineArgs['helpers'],
  arg1: string,
): boolean {
  const flags: string[] = [...CommandLineArgs.helpers[key]];
  return flags.includes(arg1);
}

/**
 * @private
 *
 * This is incase the user passes equal signs when specifying the options.
 * Split something like:
 *   ['-c', './pathf', '--path=./pathb'] => ['-c', './pathf', '--path', './pathb']
 */
function splitEqualsSign(args: string[]): string[] {
  return args.flatMap((arg) => {
    const i = arg.indexOf('=');
    return i === -1 ? [arg] : [arg.slice(0, i), arg.slice(i + 1)];
  });
}

/**
 * @private
 *
 * Get the value for an option flag: i.e. `-c ./config.json`
 */
function getOptionValue(
  optionKey: keyof CommandLineArgs['options'],
  args: string[],
): string | null {
  const optionFlags = CommandLineArgs.options[optionKey];
  const [shortFlag, longFlag] = optionFlags;
  let optionIdx = args.indexOf(shortFlag);
  if (optionIdx === -1) {
    optionIdx = args.indexOf(longFlag);
  }
  if (optionIdx === -1) {
    return null;
  }
  // The value should be the index after the flag
  return args[optionIdx + 1];
}

// @reg Export

export default processCmdLineArgs;
