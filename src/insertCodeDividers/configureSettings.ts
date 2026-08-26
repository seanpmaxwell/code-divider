import fileUtils from 'my-tools/fileUtils';
import logger from 'my-tools/simple-logger';
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
  // Configure Settings
  const configuredLangSettings = Object.keys(other).map((lang) =>
    configureLangEntry(lang, other[lang] as InitialLangSettings),
  );
  // Return
  return {
    filter,
    extensionsMap: setupExtensionsMap(configuredLangSettings),
  };
}

/**
 * @private
 *
 * Check if a configuration file exists. If it does, override settings from the
 * configuration file into the default file.
 */
async function loadConfig(cwd: string): Promise<InitalSettings> {
  // Check Configuration File exists, otherwise use defaults
  const fileConfigPath = path.join(cwd, CONFIG_FILE_NAME);
  const hasConfigFile = await fileUtils.exists(fileConfigPath);

  console.log('// pick up here, need to combine DefaultConfig.All into the others before proceeding');
  if (!hasConfigFile) return DefaultConfig;
  // Load overrides from config file
  let fileConfig: InitalSettings;
  try {
    fileConfig = await fileUtils.loadJsonFile<InitalSettings>(fileConfigPath);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const message = `invalid ${CONFIG_FILE_NAME}: ${reason}`;
    throw new Error(message, { cause: err });
  }
  // Initialize "All", which holds settings shared by every language.
  const retVal: InitalSettings = {
    ...DefaultConfig,
    All: { ...DefaultConfig.All, ...fileConfig.All },
  };
  // Combine default settings with file settings.
  Object.entries(fileConfig).forEach((fileConfigEntry) => {
    const [key, settings] = fileConfigEntry;
    retVal[key] = {
      ...retVal.All,
      ...retVal[key],
      ...(settings as InitialLangSettings),
    };
  });
  // Return
  logger.info(`Using config overrides from: ${fileConfigPath}`);
  return retVal;
}

/**
 * @private
 *
 * Directory whose code-divider.config.json applies to a target path: the target's own
 * directory if it has one, otherwise the directory code-divider is being run from.
 */
async function configDirFor(targetPath: string): Promise<string> {
  const isTargetDir = await fileUtils.isDir(targetPath);
  const targetPathFull = isTargetDir ? targetPath : path.dirname(targetPath);
  const configFilePath = path.join(targetPathFull, CONFIG_FILE_NAME);
  const exists = await fileUtils.exists(configFilePath);
  return exists ? targetPathFull : process.cwd();
}

/**
 * @private
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
  const {
    Extensions,
    Comment,
    CharacterLimit,
    FillerCharacter,
    DisableRegionFormatting,
    DisableSectionFormatting,
    Bookends,
  } = settings;
  // Check the configuration for errors
  if (!Array.isArray(Extensions) || Extensions.length === 0) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" needs an Extensions array`,
    );
  }
  const [open, close] = Array.isArray(Comment) ? Comment : [];
  if (typeof open !== 'string' || typeof close !== 'string') {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" needs a Comment pair, e.g. ["# ", ""]`,
    );
  }
  console.trace(settings)
  if (!isPositiveInt(CharacterLimit)) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" CharacterLimit must be a positive integer, e.g. 79`,
    );
  }
  const fillerChar = FillerCharacter;
  if (typeof fillerChar !== 'string' || fillerChar.length !== 1) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" FillerCharacter must be a single character, e.g. "="`,
    );
  }
  const disableRegFormatting = DisableRegionFormatting ?? false;
  if (typeof disableRegFormatting !== 'boolean') {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" DisableRegionFormatting must be true or false`,
    );
  }
  const disableSecFormatting = DisableSectionFormatting ?? false;
  if (typeof disableSecFormatting !== 'boolean') {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" DisableSectionFormatting must be true or false`,
    );
  }
  // Bookends default to the comment syntax when the language doesn't set them.
  let bookends: [string, string];
  if (!Bookends) {
    const closeFinal = close ?? ` ${open.trim()}`;
    bookends = [open, closeFinal];
  } else {
    bookends = Bookends as [string, string];
  }
  // Add periods to extensions that don't start with one because path.extname
  // returns a periods: i.e. path.extname('foo.bar.tsx') => `.tsx`
  const extensions = Extensions.map((ext) =>
    ext.startsWith('.') ? ext.slice(1) : ext,
  );
  // Return
  return {
    EXTENSIONS: extensions,
    REGION_MARKER: getMarkerRegex(open, close, Markers.REGION),
    SECTION_MARKER: getMarkerRegex(open, close, Markers.SECTION),
    BOOKENDS: bookends,
    CHAR_LIMIT: CharacterLimit,
    FILLER: fillerChar,
    DISABLE_REGION_FORMATTING: disableRegFormatting,
    DISABLE_SECTION_FORMATTING: disableSecFormatting,
  };
}

/**
 * @private
 *
 * Check a value is an integer of at least 1.
 */
function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

/**
 * @private
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
