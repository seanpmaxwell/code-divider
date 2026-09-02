// @reg Constants

const DEFAULT_VALUES = {
  showHelp: false,
  showVersion: false,
  initializeDirectory: false,
  initializeDirectoryPath: './',
  configFilePath: './code-divider.config.json',
  targetPath: './',
  doDryRun: false,
} as const satisfies ProcessedCmdLineArgs;

const CommandLineArgs = {
  // Helpers (only one option)
  helpers: {
    help: ['-h', '--help'],
    version: ['-v', '--version'],
    init: ['-i', '--init'],
  },
  // Options when inserting code-dividers
  options: {
    targetPath: ['-p', '--path'],
    configFilePath: ['-c', '--config'],
    dryRun: ['-dr', '--dry-run'],
  },
} as const;

// @reg Types

type CommandLineArgs = typeof CommandLineArgs;

interface ProcessedCmdLineArgs {
  showHelp: boolean;
  showVersion: boolean;
  doDryRun: boolean;
  initializeDirectory: boolean;
  initializeDirectoryPath: string;
  configFilePath: string;
  targetPath: string;
}

// @reg Functions

/**
 * Convert the command line args array to an object: 2 categories.
 * 
 * `Helpers`: Run alone and do not insert code-dividers.
 * 
 * `Options`: Can be combined with each-other and do insert code-dividers.
 *   Exception: `--dry-run` fires `insertCodeDividers()` but skips the actual
 *     file editing.
 */
function processCmdLineArgs(argsParam: string[]): ProcessedCmdLineArgs {
  const args = splitEqualsSign(argsParam);
  const retVal: ProcessedCmdLineArgs = { ...DEFAULT_VALUES };

  // == Process Helpers == //
  const arg1 = args[0];
  const arg2 = args[1];
  if (testHelperFlag('help', arg1)) {
    return { ...retVal, showHelp: true };
  } else if (testHelperFlag('version', arg1)) {
    return { ...retVal, showVersion: true };
  } else if (testHelperFlag('init', arg1)) {
    return {
      ...retVal,
      initializeDirectory: true,
      initializeDirectoryPath: arg2 ?? './',
    };
  }

  // == Process Options == //
  // Check `targetPath`
  const targetPathIdx = getOptionIdx('targetPath', args);
  if (targetPathIdx > -1) {
    retVal.targetPath = args[targetPathIdx + 1];
    args.splice(targetPathIdx, 2);
  }
  // Check `configFilePath`
  const configFilePath = getOptionIdx('configFilePath', args);
  if (configFilePath > -1) {
    retVal.configFilePath = args[configFilePath + 1];
    args.splice(configFilePath, 2);
  }
  // Check `dryRun`
  const dryRunIdx = getOptionIdx('dryRun', args);
  if (dryRunIdx > -1) {
    retVal.doDryRun = true;
    args.splice(configFilePath, 2);
  }
  // `getOptionValue` contains args.splice, so if we get to this point the 
  // `argsNew.length` should be `0`.  
  if (args.length > 0) {
    throw new Error(`Unknown option "${args[0]}".`)
  }

  // == Return == //
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
function getOptionIdx(
  optionKey: keyof CommandLineArgs['options'],
  args: string[],
): number {
  const optionFlags = CommandLineArgs.options[optionKey];
  const [shortFlag, longFlag] = optionFlags;
  let optionIdx = args.indexOf(shortFlag);
  if (optionIdx === -1) {
    return args.indexOf(longFlag);
  }
  return optionIdx;
}

// @reg Export

export default processCmdLineArgs;
