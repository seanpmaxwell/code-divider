import FileUtils from 'my-tools/FileUtils';
import logger from '@logger';
import path from 'path';

import DefaultConfig from '@src/common/constants/DefaultConfig';
import { CONFIG_FILE_NAME } from '@src/common/constants/misc';
import type {
  ConfiguredLangSettings,
  ExtensionsMap,
  FilterSettings,
  InitalSettings,
  InitialLangSettings,
  LabelFormats,
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

const LabelFormatOptions: ReadonlySet<unknown> = new Set([
  'uppercase',
  'lowercase',
  'capitalize',
  'none',
]);

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
  const { filter, ...other } = await loadConfig(dirPath);
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
  // -- Initialize -- //
  // Set a starting point for the configuration object using the `DefaultConfig`
  // object and pulling in `All` settings.
  const retVal: InitalSettings = {
    ...DefaultConfig,
    All: { ...DefaultConfig.All },
  };
  Object.keys(retVal).forEach((key) => {
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
    Bookends,
    RegionLabelFormat,
    SectionLabelFormat,
  } = settings;

  // -- Run validations -- //
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
  const regionLabelFormat = RegionLabelFormat?.toLowerCase() ?? '';
  if (!isLabelFormat(regionLabelFormat)) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" RegionLabelFormat must be 'uppercase','lowercase','capitalize', or 'none'`,
    );
  }
  const sectionLabelFormat = SectionLabelFormat?.toLowerCase() ?? '';
  if (!isLabelFormat(sectionLabelFormat)) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" SectionLabelFormat must be 'uppercase','lowercase','capitalize', or 'none'`,
    );
  }

  // -- Bookends -- //
  // Bookends default to the comment syntax when the language doesn't set them.
  let bookends = Bookends ?? [];
  if (!Bookends) {
    const closeFinal = close ?? ` ${open.trim()}`;
    bookends = [open, closeFinal];
  }
  if (!isStrArr(bookends) || bookends.length !== 2) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" Bookends must of type [string, string]`,
    );
  }

  // -- Extensions -- //
  // Add periods to extensions that don't start with one because path.extname
  // returns a periods: i.e. path.extname('foo.bar.tsx') => `.tsx`
  if (!isStrArr(Extensions)) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" Extensions must of type string[]`,
    );
  }
  const extensions = Extensions.map((ext) =>
    ext.startsWith('.') ? ext.slice(1) : ext,
  );

  // -- Return -- //
  return {
    EXTENSIONS: extensions,
    REGION_MARKER: getMarkerRegex(open, close, Markers.REGION),
    SECTION_MARKER: getMarkerRegex(open, close, Markers.SECTION),
    BOOKENDS: bookends,
    CHAR_LIMIT: CharacterLimit,
    FILLER: fillerChar,
    REGION_LABEL_FORMAT: regionLabelFormat,
    SECTION_LABEL_FORMAT: sectionLabelFormat,
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
 * Check that a value is of type: string[]
 */
function isStrArr(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  const hasNonStringValue = value.some((item) => typeof item !== 'string');
  return !hasNonStringValue;
}

/**
 * @private
 * 
 * Check that a value is of type: `LabelFormats`
 */
function isLabelFormat(value: unknown): value is LabelFormats {
  return LabelFormatOptions.has(value);
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
