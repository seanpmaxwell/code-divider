import logger from '@logger';
import FileUtils from 'my-tools/FileUtils';
import path from 'path';

import DefaultConfig from '@src/common/constants/DefaultConfig';
import { CONFIG_FILE_NAME } from '@src/common/constants/misc';
import type {
  ConfiguredLangSettings,
  ExtensionsMap,
  FilterSettings,
  InitalSettings,
  InitialLangSettings,
} from '@src/common/types/settings.js';

import {
  validateLangSpecificSettings,
  validateSharedSettings,
} from './validators';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

// Marker tokens written in source files: "// @reg Label", "/* @sec Label */".
// These are fixed and not configurable.
const Markers = {
  REGION: '@reg',
  SECTION: '@sec',
} as const;

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Process a path (file or directory). Directories are walked recursively.
 * Returns the list of file paths that were updated.
 */
async function configureSettings(
  targetPath = process.cwd(),
): Promise<{ filter: FilterSettings; extensionsMap: ExtensionsMap }> {
  // Load settings
  const dirPath = await configDirFor(targetPath);
  const { filter, All, ...other } = await loadConfig(dirPath);
  // Run validations for just the `All` settings
  validateSharedSettings('All', All);
  // Configure Settings
  const configuredLangSettings = Object.keys(other).map((lang) =>
    configureLangEntry(lang, other[lang] as InitialLangSettings),
  );
  // Configure extensions map
  const extensionsMap = setupExtensionsMap(configuredLangSettings);
  // Return
  return {
    filter,
    extensionsMap,
  };
}

/**
 * @private
 * @see {configureSettings}
 *
 * Check if a configuration file exists. If it does, override settings from the
 * configuration file into the default file.
 */
async function loadConfig(cwd: string): Promise<InitalSettings> {
  // -- Initialize -- //
  // Set a starting point for the configuration object using the `DefaultConfig`
  // object and pulling in `All` settings.
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

  // -- Apply Settings from Configuration File -- //
  // Check Configuration File exists, otherwise use defaults
  const fileConfigPath = path.join(cwd, CONFIG_FILE_NAME);
  const hasConfigFile = await FileUtils.exists(fileConfigPath);
  if (!hasConfigFile) return retVal;
  // Load overrides from config file
  let fileConfig: InitalSettings;
  try {
    fileConfig = await FileUtils.loadJsonFile<InitalSettings>(fileConfigPath);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const message = `invalid ${CONFIG_FILE_NAME}: ${reason}`;
    throw new Error(message, { cause: err });
  }
  // Combine default settings with file settings.
  Object.keys(fileConfig).forEach((key) => {
    const overridesFromFile = fileConfig[key] as InitialLangSettings;
    retVal[key] = {
      ...retVal[key],
      ...overridesFromFile,
    };
  });

  // -- Return -- //
  logger.info(`Using config overrides from: ${fileConfigPath}`);
  return retVal;
}

/**
 * @private
 * @see {configureSettings}
 *
 * Directory whose code-divider.config.json applies to a target path: the target's own
 * directory if it has one, otherwise the directory code-divider is being run from.
 */
async function configDirFor(targetPath: string): Promise<string> {
  const isTargetDir = await FileUtils.isDir(targetPath);
  const targetPathFull = isTargetDir ? targetPath : path.dirname(targetPath);
  const configFilePath = path.join(targetPathFull, CONFIG_FILE_NAME);
  const exists = await FileUtils.exists(configFilePath);
  return exists ? targetPathFull : process.cwd();
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
//                                     Export                                //
// ========================================================================= //

export default configureSettings;
