import path from 'path';

import { CONFIG_FILE_NAME } from '@common/constants/misc';
import { getRange } from '@common/utils/misc';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const DEFAULT_VALUES = {
  showHelp: false,
  showVersion: false,
  initializeDirectory: false,
  initializeDirectoryPath: './',
  configFilePath: './code-divider.config.json',
  targetPath: './',
  doDryRun: false,
} as const satisfies ProcessedCmdLineArgs;

const CmdLineArgFlags = {
  // Helpers, run alone
  help: ['-h', '--help'],
  version: ['-v', '--version'],
  init: ['-i', '--init'],
  // Options when inserting code-dividers
  targetPath: ['-p', '--path'],
  configFilePath: ['-c', '--config'],
  dryRun: ['-dr', '--dry-run'],
} as const;

const FlagGroups = {
  Helpers: new Set<CmdLineArgKey>(['help', 'version', 'init']),
  Options: new Set<CmdLineArgKey>(['targetPath', 'configFilePath', 'dryRun']),
} as const;

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

type CmdLineArgFlags = typeof CmdLineArgFlags;
type CmdLineArgKey = keyof CmdLineArgFlags;
type CmdLineArgMap = Map<CmdLineArgKey, number>;

// Exported for testing purposes
export interface ProcessedCmdLineArgs {
  showHelp: boolean;
  showVersion: boolean;
  doDryRun: boolean;
  initializeDirectory: boolean;
  initializeDirectoryPath: string;
  configFilePath: string;
  targetPath: string;
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
function processCmdLineArgs(args: string[]): ProcessedCmdLineArgs {
  // Init
  const currWorkingDir = process.cwd();
  const argsObj: ProcessedCmdLineArgs = {
    ...DEFAULT_VALUES,
    initializeDirectoryPath: currWorkingDir,
    targetPath: currWorkingDir,
    configFilePath: path.join(currWorkingDir, CONFIG_FILE_NAME),
  };
  if (!args.length) {
    return argsObj;
  }
  // Process Helpers
  const argsMap = setupCmdLineArgMap(args);
  const arg1 = args[0];
  if (FlagGroups.Helpers.has(arg1 as CmdLineArgKey)) {
    if (argsMap.has('help')) {
      return { ...argsObj, showHelp: true };
    } else if
  }

  // // Process Helpers
  // const arg1 = args[0];
  // const arg2 = args[1];
  // if (testHelperFlag('help', arg1)) {
  //   return { ...argsObj, showHelp: true };
  // } else if (testHelperFlag('version', arg1)) {
  //   return { ...argsObj, showVersion: true };
  // } else if (testHelperFlag('init', arg1)) {
  //   return {
  //     ...argsObj,
  //     initializeDirectory: true,
  //     initializeDirectoryPath: arg2 ?? process.cwd(),
  //   };
  // }
  // // Process Options
  // const argsNoEqualSigns = splitEqualsSign(args);
  // return processOptions(argsNoEqualSigns, argsObj);
}

/**
 * 
 */
function setupCmdLineArgMap(args: string[]): CmdLineArgMap {
  const argMap: CmdLineArgMap = new Map();
  // Remove equals sign for things like `--init=./some-path`
  const argsNew = args.flatMap((arg) => {
    const i = arg.indexOf('=');
    return i === -1 ? [arg] : [arg.slice(0, i), arg.slice(i + 1)];
  });
  // Add keys/indexes to the map
  for (const idx of getRange(argsNew.length)) {
    const arg = argsNew[idx];
    for (const flag in CmdLineArgFlags) {
      if (flag.includes(arg)) {
        argMap.set(flag as CmdLineArgKey, idx);
      }
    }
  }
  // Return
  return argMap;
}

/**
 * @private
 * @see {processCmdLineArgs}
 *
 * See if a helper flag was passed. These skip running "insertCodeDividers"
 * function so should return right away.
 */
function testHelperFlag(
  key: keyof CmdLineArgFlags['helpers'],
  arg1: string,
): boolean {
  const flags: string[] = [...CmdLineArgFlags.helpers[key]];
  return flags.includes(arg1);
}

/**
 * @private
 * @see {processCmdLineArgs}
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
 * @see {processCmdLineArgs}
 *
 * Process the "Options". Unlike the "Helpers", these can be combined with each-other
 * and do fire `insertCodeDividers`.
 */
function processOptions(
  args: string[],
  argsObj: ProcessedCmdLineArgs,
): ProcessedCmdLineArgs {
  const targetPathFlagIdx = getOptionIdx('targetPath', args);
  const configFilePathFlagIdx = getOptionIdx('configFilePath', args);
  const dryRunIdx = getOptionIdx('dryRun', args);
  const optionIdxSet = new Set([
    targetPathFlagIdx,
    configFilePathFlagIdx,
    dryRunIdx,
  ]);
  const argsTracker = [...args];
  // Process `targetPath`
  if (targetPathFlagIdx > -1) {
    const targetPathValueIdx = targetPathFlagIdx + 1;
    if (!targetPathValueIdx || optionIdxSet.has(targetPathValueIdx)) {
      throw new Error(
        'The "path" command line flag was passed but no value was present.',
      );
    }
    argsObj.targetPath = args[targetPathValueIdx];
    argsTracker.splice(targetPathFlagIdx, 2);
  }
  // Process `configFilePath`
  if (configFilePathFlagIdx > -1) {
    const configFilePathValueIdx = configFilePathFlagIdx + 1;
    if (!configFilePathValueIdx || optionIdxSet.has(configFilePathValueIdx)) {
      throw new Error(
        'The "config" command line flag was passed but no value was present.',
      );
    }
    argsObj.configFilePath = args[configFilePathValueIdx];
    argsTracker.splice(configFilePathFlagIdx, 2);
  }
  // Process `dryRun`. Is just a boolean so has no value.
  if (dryRunIdx > -1) {
    argsObj.doDryRun = true;
    argsTracker.splice(dryRunIdx, 1);
  }
  // Splicing should reduce the length of the final array to 0
  if (argsTracker.length > 0) {
    throw new Error(`Unknown option/s "${args.join(', ')}"`);
  }
  // Return
  return argsObj;
}

/**
 * @private
 * @see {processCmdLineArgs}
 *
 * Get the value for an option flag: i.e. `-c ./config.json`
 */
function getOptionIdx(
  optionKey: keyof CmdLineArgFlags['options'],
  args: string[],
): number {
  const optionFlags = CmdLineArgFlags.options[optionKey];
  const [shortFlag, longFlag] = optionFlags;
  const optionIdx = args.indexOf(shortFlag);
  if (optionIdx === -1) {
    return args.indexOf(longFlag);
  }
  return optionIdx;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default processCmdLineArgs;
