import path from 'path';

import DefaultConfig from '@common/constants/DefaultConfig.js';
import { CONFIG_FILE_NAME } from '@common/constants/misc.js';
import type {
  ConfiguredLangSettings,
  ExtensionsMap,
  InitialLangSettings,
  InitialSettings,
} from '@common/types/settings';
import { type IRunContext } from '@common/utils/fns/RunContext';

import uFile from '@utilm/uFile';

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
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Resolve the target path, find and load the config file (if any), validate
 * everything, and compile the per-language settings into the matchers used
 * while formatting. Fills in `targetDir`, `targetFile`, `configFilePath`, and
 * `configuredSettings` on the `ctx` it's given.
 */
async function configureSettings(ctx: IRunContext): Promise<void> {
  // Load settings
  await setTargetPaths(ctx);
  await setConfigFilePath(ctx);
  const initConfigSettings = await getInitConfigSettings(ctx);
  const { All, filter: filterRaw, ...other } = initConfigSettings;
  // Run validations for the `All` and `filter` settings
  validateSharedSettings('All', All);
  ctx.configuredSettings.filter = validateFilterSettings(filterRaw);
  // Configure extensions map
  const finalConfigSettings = Object.keys(other).map((lang) =>
    configureLangEntry(lang, other[lang] as InitialLangSettings),
  );
  ctx.configuredSettings.extensionsMap =
    setupExtensionsMap(finalConfigSettings);
}

/**
 * Get the target directory and file (file may be falsy)
 *
 * Used by: {@link configureSettings}
 *
 * @private
 */
async function setTargetPaths(ctx: IRunContext): Promise<void> {
  // Init
  let targetPath = ctx.targetPathRaw;
  if (!targetPath) {
    targetPath = ctx.cwd;
  } else if (targetPath && !path.isAbsolute(targetPath)) {
    targetPath = path.join(ctx.cwd, targetPath);
  }
  // Check exists
  const exists = await uFile.exists(targetPath);
  if (!exists) {
    throw new Error(
      `targetPath ${targetPath} must be an existing file or directory`,
    );
  }
  // If directory
  if (await uFile.isDir(targetPath)) {
    ctx.targetDir = targetPath;
    ctx.targetFile = null;
    return;
  }
  // If file
  ctx.targetDir = path.dirname(targetPath);
  ctx.targetFile = targetPath;
}

/**
 * Order of priority with loading the configuration file:
 *   1. Explicitly set with flag: `--config`
 *   2. Look in the target directory
 *   3. Look in the current working directory
 *   4. If no configuration file exists, later workflow will use in-memory
 *     settings only.
 *
 * Used by: {@link configureSettings}
 *
 * @private
 */
async function setConfigFilePath(ctx: IRunContext): Promise<void> {
  // If the configuration file path was passed (relative paths are resolved
  // against `cwd`, absolute paths are used as-is)
  if (ctx.configFilePath) {
    const fullPath = path.resolve(ctx.cwd, ctx.configFilePath);
    const exists = await uFile.exists(fullPath);
    if (!exists)
      throw new Error(
        `Configuration file ${ctx.configFilePath} was specified but was not found`,
      );
    ctx.configFilePath = fullPath;
    return;
  }
  // Look in the target directory
  const localConfigFile = path.join(ctx.targetDir, CONFIG_FILE_NAME);
  const exists = await uFile.exists(localConfigFile);
  if (exists) {
    ctx.configFilePath = localConfigFile;
    return;
  }
  // Look in the current working directory
  const cwdConfigFile = path.join(ctx.cwd, CONFIG_FILE_NAME);
  const cwdConfigFileExists = await uFile.exists(cwdConfigFile);
  if (cwdConfigFileExists) {
    ctx.configFilePath = cwdConfigFile;
    return;
  }
  // Use `null` if there's no configuration file anywhere.
  ctx.configFilePath = null;
}

/**
 * Build the full settings object: start from the in-memory defaults, apply
 * the config file's overrides on top (when `configFilePath` is not null), and
 * finally fill each language's missing shared settings from `All`.
 *
 * No file validation is needed here: the previous step should only pass a
 * non-null value if the config file was found.
 *
 * Used by: {@link configureSettings}
 *
 * @private
 */
async function getInitConfigSettings(
  ctx: IRunContext,
): Promise<InitialSettings> {
  // ---- Initialize
  const retVal: InitialSettings = {
    ...DefaultConfig,
    All: { ...DefaultConfig.All },
    filter: { ...DefaultConfig.filter },
  };

  // ---- Apply Settings from Configuration File
  // Note: `.loadJsonFile` will check that it's a valid .json file
  if (ctx.configFilePath !== null) {
    const jsonFileSettings: InitialSettings =
      await uFile.loadJsonFile<InitialSettings>(ctx.configFilePath);
    ctx.logger.info(
      `Using configuration overrides from: ${ctx.configFilePath}`,
    );
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
 * Used by: {@link configureSettings}
 *
 * @private
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
 * Used by: {@link configureLangEntry}
 *
 * @private
 */
function getMarkerRegex(open: string, close: string, token: string): RegExp {
  const escape = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const str = `^\\s*${escape(open)}${escape(token)}(?:[ \\t]+(.+?))?${escape(close)}\\s*$`;
  return new RegExp(str);
}

/**
 * Organize language settings by file extension
 *
 * Used by: {@link configureSettings}
 *
 * @private
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
