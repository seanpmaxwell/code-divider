import path from 'path';

import FileUtils from '@modules/FileUtils';
import logger from '@modules/logger';

import DefaultConfig from '@common/constants/DefaultConfig.js';
import { CONFIG_FILE_NAME } from '@common/constants/misc.js';
import type {
  ConfiguredLangSettings,
  ExtensionsMap,
  FilterSettings,
  InitialLangSettings,
  InitialSettings,
} from '@common/types/settings.js';

import {
  validateFilterSettings,
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
 * Resolve the target path, find and load the config file (if any), validate
 * everything, and compile the per-language settings into the matchers used
 * while formatting.
 */
async function configureSettings(
  cwd: string,
  targetPath: string,
  configFilePath: string,
): Promise<ConfiguredSettings> {
  // Load settings
  const { targetDir, targetFile } = await getTargetPaths(cwd, targetPath);
  const configFilePathNew = await getConfigFilePath(
    cwd,
    targetDir,
    configFilePath,
  );
  const initConfigSettings = await getInitConfigSettings(configFilePathNew);
  const { All, filter: filterRaw, ...other } = initConfigSettings;
  // Run validations for the `All` and `filter` settings
  validateSharedSettings('All', All);
  const filter = validateFilterSettings(filterRaw);
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
 * Get the target directory and file (file may be falsey)
 *
 * @private {@link configureSettings}
 */
async function getTargetPaths(
  cwd: string,
  targetPath: string,
): Promise<{ targetDir: string; targetFile: string | null }> {
  // Init
  if (!targetPath) {
    targetPath = cwd;
  } else if (targetPath && !path.isAbsolute(targetPath)) {
    targetPath = path.join(cwd, targetPath);
  }
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
  const targetDir = path.dirname(targetPath);
  return { targetDir, targetFile: targetPath };
}

/**
 * Order of priority with loading the configuration file:
 *   1. Explicitly set with flag: `--config`
 *   2. Look in the target directory
 *   3. Look in the current working directory
 *   4. If no configuration file exists, later workflow will use in-memory
 *     settings only.
 *
 * @private {@link configureSettings}
 */
async function getConfigFilePath(
  cwd: string,
  targetDir: string,
  configFilePath: string,
): Promise<string | null> {
  // If the configuration file path was passed (relative paths are resolved
  // against `cwd`, absolute paths are used as-is)
  if (configFilePath) {
    const fullPath = path.resolve(cwd, configFilePath);
    const exists = await FileUtils.exists(fullPath);
    if (!exists)
      throw new Error(
        `Configuration file ${configFilePath} was specified but was not found`,
      );
    return fullPath;
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
 * Build the full settings object: start from the in-memory defaults, apply
 * the config file's overrides on top (when `configFilePath` is not null), and
 * finally fill each language's missing shared settings from `All`.
 *
 * Don't need to do any file validation, previous workflow should only pass a
 * non-null value if the config file was found.
 *
 * @private {@link configureSettings}
 */
async function getInitConfigSettings(
  configFilePath: string | null,
): Promise<InitialSettings> {
  // ---- Initialize
  const retVal: InitialSettings = {
    ...DefaultConfig,
    All: { ...DefaultConfig.All },
    filter: { ...DefaultConfig.filter },
  };

  // ---- Apply Settings from Configuration File
  // Note: `.loadJsonFile` will check that it's a valid .json file
  if (configFilePath !== null) {
    const jsonFileSettings: InitialSettings =
      await FileUtils.loadJsonFile<InitialSettings>(configFilePath);
    logger.info(`Using configuration overrides from: ${configFilePath}`);
    Object.keys(jsonFileSettings).forEach((key) => {
      const overridesFromFile = jsonFileSettings[key] as InitialLangSettings;
      // Spreading a string/array/null would silently produce garbage
      if (
        overridesFromFile === null ||
        typeof overridesFromFile !== 'object' ||
        Array.isArray(overridesFromFile)
      ) {
        throw new Error(
          `invalid ${CONFIG_FILE_NAME}: "${key}" must be an object`,
        );
      }
      retVal[key] = {
        ...retVal[key],
        ...overridesFromFile,
      };
    });
  }

  // ---- Fill in the languages
  Object.keys(retVal).forEach((key) => {
    if (key === 'filter' || key === 'All') return;
    retVal[key] = {
      ...retVal.All,
      ...retVal[key],
    };
  });

  // ---- Return
  return retVal;
}

/**
 * Setup an object the individual language can use for formatting files.
 *
 * @private {@link configureSettings}
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
 * Capture the label if present. A bare marker ("// @reg" with no label) still
 * matches, but is warned about and skipped rather than formatted.
 *
 * @private {@link configureLangEntry}
 */
function getMarkerRegex(open: string, close: string, token: string): RegExp {
  const escape = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const str = `^\\s*${escape(open)}${escape(token)}(?:[ \\t]+(.+?))?${escape(close)}\\s*$`;
  return new RegExp(str);
}

/**
 * Organize language settings by file extension
 *
 * @private {@link configureSettings}
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
