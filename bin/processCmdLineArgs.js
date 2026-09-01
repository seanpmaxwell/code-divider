
// @reg Constants

const DEFAULT_VALUES = {
  showHelp: false,
  showVersion: false,
  doDryRun: false,
  initializeDirectory: false,
  configFilePath: './code-divider.config.json',
  targetPath: './',
};

const CommandLineArgs = {
  // Helpers (only one option)
  helpers: {
    help: ['-h', '--help'],
    version: ['-v', '--version'],
    dryRun: ['-dr', '--dry-run'],
  },
  testHelper(key, arg) {
    return this.helpers[key].includes(arg);
  },

  // Options when inserting code-dividers
  targetPath: ['-p', '--path'],
  configFilePath: ['-c', '--config'],
};

// @reg Functions

/**
 * Convert the command line args array to an object. For the "helpers" 
 * property, there should only be one argument so we return right away.
 * 
 * 
 * @returns {typeof DEFAULT_VALUES}
 */
function processCommandLineArgs(args) {
  const arg1 = args[0];
  const retVal = { ...DEFAULT_VALUES };
  // Check `helpers`
  if (CommandLineArgs.testHelper('help', arg1)) {
    return { ...retVal, showHelp: true };
  } else if (CommandLineArgs.testHelper('version', arg1)) {
    return { ...retVal, showVersion: true };
  } else if (CommandLineArgs.testHelper('dryRun', arg1)) {
    return { ...retVal, doDryRun: true };
  }

  // Next, check targetPath, configFilePath

  return retVal;
}

// @reg Export

export default processCommandLineArgs;
