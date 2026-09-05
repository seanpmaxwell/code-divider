import path from 'path';

import DefaultConfig from '@common/constants/DefaultConfig.js';
import { CONFIG_FILE_NAME } from '@common/constants/misc.js';
import type {
  ConfiguredLangSettings,
  ExtensionsMap,
  FilterSettings,
  InitalSettings,
  InitialLangSettings,
} from '@common/types/settings.js';

import logger from '@logger';

import FileUtils from '@FileUtils';

import {
  validateLangSpecificSettings,
  validateSharedSettings,
} from './validators';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Marker tokens written in source files: "// @reg Label", "/* @sec Label */".
// These are fixed and not configurable.
const Markers = {
  REGION: '@reg',
  SECTION: '@sec',
} as const;

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface ConfiguredSettings {
  filter: FilterSettings; 
  extensionsMap: ExtensionsMap;
  targetDir: string;
  targetFile: string | null;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Process a path (file or directory). Directories are walked recursively.
 * Returns the list of file paths that were updated.
 */
async function configureSettings(
  cwd: string,
  targetPath: string,
  configFilePath: string,
): Promise<ConfiguredSettings> {
  // Load settings
  const { targetDir, targetFile } = await getTargetPaths(cwd, targetPath);
  const configFilePathNew = await getConfigFilePath(cwd, targetDir, configFilePath);
  const initConfigSettings = await getInitialConfigSettings(configFilePathNew);
  const { All, filter, ...other } = initConfigSettings;
  // Run validations for just the `All` settings
  validateSharedSettings('All', All);
  // Configure extensions map
  const finalConfigSettings = Object.keys(other).map((lang) =>
    configureLangEntry(lang, other[lang] as InitialLangSettings),
  );
  const extensionsMap = setupExtensionsMap(finalConfigSettings);
  // Return
  return {
    filter,
    extensionsMap,
    targetDir,
    targetFile,
  };
}

/**
 * @private
 * @see {configSettings}
 * 
 * Get the target directory and file (file may be falsey)
 */
async function getTargetPaths(
  cwd: string,
  targetPath: string,
): Promise<{ targetDir: string; targetFile: string | null }> {
  // Check exists
  const exists = await FileUtils.exists(targetPath);
  if (!exists) {
    throw new Error(
      `targetPath ${targetPath} must be an existing file or directory`,
    );
  }
  // If directory
  const isDir = await FileUtils.isDir(targetPath);
  if (isDir) return { targetDir: targetPath, targetFile: null };
  // If file
  const targetFile = path.isAbsolute(targetPath)
    ? targetPath
    : path.join(cwd, targetPath);
  const targetDir = path.dirname(targetFile);
  return { targetDir, targetFile };
}

/**
 * @private
 * @see {configureSettings}
 *
 * Order of priority with loading the configuration file:
 *   1. Explicitly set with flag: `--config`
 *   2. Look in the target directory
 *   3. Look in the current working directory
 *   4. If no configuration file exists, later workflow will use in-memory
 *     settings only.
 */
async function getConfigFilePath(
  cwd: string,
  targetDir: string,
  configFilePath: string,
): Promise<string | null> {
  // If the configuration file path was passed 
  if (configFilePath) {
    const exists = await FileUtils.exists(configFilePath);
    if (!exists)
      throw new Error(
        `Configuration file ${configFilePath} was specified but was not found`,
      );
    return path.join(cwd, configFilePath);
  }
  // Look in the target directory
  const localConfigFile = path.join(targetDir, CONFIG_FILE_NAME);
  const exists = await FileUtils.exists(localConfigFile);
  if (exists) return localConfigFile;
  // Look in the current working directory
  const cwdConfigFile = path.join(cwd, CONFIG_FILE_NAME);
  const cwdConfigFileExists = await FileUtils.exists(cwdConfigFile);
  if (cwdConfigFileExists) return cwdConfigFile;
  // Use `null` if there's no configuration file anywhere.
  return null;
}

/**
 * @private
 * @see {configureSettings}
 *
 * If the `configFilePath` param is not null, load it and combine it with the 
 * in memory settings, else just return the in memory settings.
 * 
 * Don't need to do any file validation, previous workflow should only pass a 
 * non-null value if the config file was found.
 */
async function getInitialConfigSettings(configFilePath: string | null): Promise<InitalSettings> {
  // == Initialize == //
  // Setup the in memory settings. All should be the filler for missing 
  // individual language settings.
  const retVal: InitalSettings = {
    ...DefaultConfig,
    All: { ...DefaultConfig.All },
  };
  Object.keys(retVal).forEach((key) => {
    if (key === 'filter') return;
    retVal[key] = {
      ...retVal.All,
      ...retVal[key],
    };
  });
  if (configFilePath === null) return retVal;

  // == Apply Settings from Configuration File == //
  // Note: `.loadJsonFile` will check that it's a valid .json file
  const jsonFileSettings: InitalSettings = await FileUtils.loadJsonFile<InitalSettings>(configFilePath);
  logger.info(`Using configuration overrides from: ${configFilePath}`);
  Object.keys(jsonFileSettings).forEach((key) => {
    const overridesFromFile = jsonFileSettings[key] as InitialLangSettings;
    retVal[key] = {
      ...retVal[key],
      ...overridesFromFile,
    };
  });

  // == Return == //
  return retVal;
}

/**
 * @private
 * @see {configureSettings}
 *
 * Compile a declarative language entry into the matchers used while walking:
 * a FILE_EXT regex and REGION/SECTION marker regexes built from the comment
 * syntax around the fixed marker tokens. CharacterLimit/FillerCharacter fall
 * back to the shared "All" settings.
 */
function configureLangEntry(
  lang: string,
  settings: InitialLangSettings,
): ConfiguredLangSettings {
  // Validate "Shared" settings
  const {
    CharacterLimit,
    FillerCharacter,
    RegionLabelFormat,
    SectionLabelFormat,
  } = validateSharedSettings(lang, settings);
  // Validate "Language" specific settings
  const { Extensions, Comment, Bookends } = validateLangSpecificSettings(
    lang,
    settings,
  );
  const [open, close] = Comment;
  // Return
  return {
    EXTENSIONS: Extensions,
    REGION_MARKER: getMarkerRegex(open, close, Markers.REGION),
    SECTION_MARKER: getMarkerRegex(open, close, Markers.SECTION),
    BOOKENDS: Bookends,
    CHAR_LIMIT: CharacterLimit,
    FILLER: FillerCharacter,
    REGION_LABEL_FORMAT: RegionLabelFormat,
    SECTION_LABEL_FORMAT: SectionLabelFormat,
  };
}

/**
 * @private
 * @see {configureLangEntry}
 *
 * Capture the label if present. A bare marker ("// @reg" with no label) still
 * matches, but is warned about and skipped rather than formatted.
 */
function getMarkerRegex(open: string, close: string, token: string): RegExp {
  const escape = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const str = `^\\s*${escape(open)}${escape(token)}(?: (.+?))?${escape(close)}\\s*$`;
  return new RegExp(str);
}

/**
 * @private
 * @see {configureSettings}
 *
 * Organize language settings by file extension
 */
function setupExtensionsMap(
  configuredLangSettings: ConfiguredLangSettings[],
): ExtensionsMap {
  const map: ExtensionsMap = new Map();
  for (const setting of configuredLangSettings) {
    for (const ext of setting.EXTENSIONS) {
      map.set(ext, setting);
    }
  }
  return map;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default configureSettings;
