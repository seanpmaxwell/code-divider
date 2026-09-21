import path from 'path';

import DefaultConfig from '@common/constants/DefaultConfig';
import { CONFIG_FILE_NAME, Markers } from '@common/constants/misc';
import type { ConfiguredSettings } from '@common/types/RunContext';
import type {
  ConfiguredLangSettings,
  ExtensionsMap,
  InitialLangSettings,
  InitialSettings,
  UserConfig,
} from '@common/types/settings';
import UserError from '@common/utils/classes/UserError';

import uFile from '@utilm/uFile';

import type { ILogger } from '@logger';

import {
  validateFilterSettings,
  validateLangSpecificSettings,
  validateSharedSettings,
} from './validators';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

export interface ConfigureSettingsOptions {
  cwd: string; // absolute
  targetPath: string; // '' means `cwd`
  configFilePath: string | null;
  config: UserConfig | null;
  logger: ILogger;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Resolve the target path, find and load the config file (if any, and unless
 * an inline `config` was given), validate everything, and compile the
 * per-language settings into the matchers used while formatting.
 */
async function configureSettings(
  options: ConfigureSettingsOptions,
): Promise<ConfiguredSettings> {
  const { cwd, config, logger } = options;
  if (config && options.configFilePath) {
    throw new UserError(
      'Pass either an inline "config" or a "configFilePath", not both',
    );
  }
  // ---- Resolve the target and the config
  const { targetDir, targetFile } = await resolveTargetPaths(
    cwd,
    options.targetPath,
  );
  let configFilePath: string | null = null;
  let overrides: UserConfig | null = config;
  if (!config) {
    configFilePath = await resolveConfigFilePath(
      cwd,
      targetDir,
      options.configFilePath,
    );
    if (configFilePath !== null) {
      overrides = await uFile.loadJsonFile<UserConfig>(configFilePath);
      logger.info(`Using configuration overrides from: ${configFilePath}`);
    }
  }
  // ---- Merge and validate
  const { All, filter: filterRaw, ...languages } = mergeSettings(overrides);
  validateSharedSettings('All', All);
  const filter = validateFilterSettings(filterRaw);
  const langEntries = Object.keys(languages).map((lang) =>
    configureLangEntry(lang, languages[lang] as InitialLangSettings),
  );
  const extensionsMap = setupExtensionsMap(langEntries, logger);
  // ---- Return
  return { targetDir, targetFile, configFilePath, filter, extensionsMap };
}

/**
 * Get the target directory and file (file is null for a directory target).
 * Relative paths are resolved against `cwd`; an empty path means `cwd`.
 *
 * Used by: {@link configureSettings}
 *
 * @private
 */
async function resolveTargetPaths(
  cwd: string,
  targetPathRaw: string,
): Promise<Pick<ConfiguredSettings, 'targetDir' | 'targetFile'>> {
  const targetPath = path.resolve(cwd, targetPathRaw);
  const type = await uFile.pathType(targetPath);
  if (type === null || type === 'other') {
    throw new UserError(
      `targetPath ${targetPath} must be an existing file or directory`,
    );
  }
  if (type === 'directory') {
    return { targetDir: targetPath, targetFile: null };
  }
  return { targetDir: path.dirname(targetPath), targetFile: targetPath };
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
async function resolveConfigFilePath(
  cwd: string,
  targetDir: string,
  explicitPath: string | null,
): Promise<string | null> {
  // If the configuration file path was passed (relative paths are resolved
  // against `cwd`, absolute paths are used as-is)
  if (explicitPath) {
    const fullPath = path.resolve(cwd, explicitPath);
    if (!(await uFile.exists(fullPath))) {
      throw new UserError(
        `Configuration file ${explicitPath} was specified but was not found`,
      );
    }
    return fullPath;
  }
  // Look in the target directory, then the current working directory
  for (const dir of [targetDir, cwd]) {
    const candidate = path.join(dir, CONFIG_FILE_NAME);
    if (await uFile.exists(candidate)) return candidate;
  }
  // `null` if there's no configuration file anywhere.
  return null;
}

/**
 * Build the full settings object: start from the in-memory defaults, apply
 * the user's overrides on top, and finally fill each language's missing
 * shared settings from `All`.
 *
 * A language set to `null` is removed. Keys starting with `$` (e.g. the
 * `$schema` key editors use) are ignored.
 *
 * Used by: {@link configureSettings}
 *
 * @private
 */
function mergeSettings(overrides: UserConfig | null): InitialSettings {
  // ---- Initialize
  const retVal: InitialSettings = {
    ...DefaultConfig,
    All: { ...DefaultConfig.All },
    filter: { ...DefaultConfig.filter },
  };

  // ---- Apply the overrides
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (key.startsWith('$') || value === undefined) continue;
    const isShared = key === 'All' || key === 'filter';
    if (value === null && !isShared) {
      delete retVal[key];
      continue;
    }
    // Spreading a string/array/null would silently produce garbage
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new UserError(`invalid configuration: "${key}" must be an object`);
    }
    retVal[key] = { ...retVal[key], ...value } as InitialLangSettings;
  }

  // ---- Fill in the languages
  for (const key of Object.keys(retVal)) {
    if (key === 'filter' || key === 'All') continue;
    retVal[key] = { ...retVal.All, ...retVal[key] };
  }

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
    LANGUAGE: lang,
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
  const str = `^\\s*${escapeRegex(open)}${escapeRegex(token)}(?:[ \\t]+(.+?))?${escapeRegex(close)}\\s*$`;
  return new RegExp(str);
}

/**
 * Escape a string so it matches literally inside a `RegExp`.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Organize language settings by file extension. Warns when two languages
 * claim the same extension (the later one wins).
 *
 * Used by: {@link configureSettings}
 *
 * @private
 */
function setupExtensionsMap(
  configuredLangSettings: ConfiguredLangSettings[],
  logger: ILogger,
): ExtensionsMap {
  const map: ExtensionsMap = new Map();
  for (const setting of configuredLangSettings) {
    for (const ext of setting.EXTENSIONS) {
      const previous = map.get(ext);
      if (previous && previous !== setting) {
        logger.warn(
          `Warning: extension "${ext}" is listed under both "${previous.LANGUAGE}" and "${setting.LANGUAGE}", using "${setting.LANGUAGE}"`,
        );
      }
      map.set(ext, setting);
    }
  }
  return map;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default configureSettings;
