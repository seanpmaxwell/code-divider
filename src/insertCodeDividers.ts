import path from 'path';
import DefaultConfig from './common/constants/DefaultConfig';
import { CONFIG_FILE_NAME } from './common/constants/misc';
import type {
  ConfigSettings,
  LangSettings,
  LangSettingsRaw,
} from './common/types/ConfigSettings';
import logger from './common/utils/logger';
import fileUtils from './common/utils/fileUtils';

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
async function insertCodeDividers(targetPath: string): Promise<string[]> {
  const dirPath = await configDirFor(targetPath);
  const { filter, All, ...other } = await loadConfig(dirPath);
  const { include, exclude } = filter;
  const files = await fileUtils.filterDirItemsGlob(include, exclude, targetPath);

  console.trace(files);
  return ['test']
  // Configure the settings per language
  // const settingsArrAllLang = Object.keys(other).map((lang) => 
  //   configureLangEntry(lang, other[lang] as LangSettingsRaw)
  // );

  // return walkDirectoryRecursively(targetPath, configuredLanguagesArr);
}

// =========================== Private Helpers ============================= //

/**
 * @private
 *
 * Check if a configuration file exists. If it does, override settings from the
 * configuration file into the default file.
 */
async function loadConfig(cwd: string): Promise<ConfigSettings> {
  const fileConfigPath = path.join(cwd, CONFIG_FILE_NAME);
  // Check Configuration File exists, otherwise use defaults
  if (!fileUtils.exists(fileConfigPath)) {
    return DefaultConfig;
  }
  // Load overrides from config file
  let fileConfig: ConfigSettings;
  try {
    fileConfig = await fileUtils.loadJsonFile<ConfigSettings>(fileConfigPath);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const message = `invalid ${CONFIG_FILE_NAME}: ${reason}`;
    throw new Error(message, { cause: err });
  }
  // Initialize "All", which holds settings shared by every language.
  const retVal: ConfigSettings = {
    ...DefaultConfig,
    All: { ...DefaultConfig.All, ...fileConfig.All },
  };
  // Combine default settings with file settings.
  Object.entries(fileConfig).forEach((fileConfigEntry) => {
    const [key, settings] = fileConfigEntry;
    retVal[key] = {
      ...retVal.All,
      ...retVal[key],
      ...(settings as LangSettingsRaw),
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
  settings: LangSettingsRaw,
): LangSettings {
  const {
    Extensions,
    Comment,
    CharacterLimit,
    FillerCharacter,
    DisableCapitalization,
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
  const disableCap = DisableCapitalization ?? false;
  if (typeof disableCap !== 'boolean') {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" DisableCapitalization must be true or false`,
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
  // Capture the label if present. A bare marker ("// @reg" with no label) still
  // matches, but is warned about and skipped rather than formatted.
  const marker = (token: string) =>
    new RegExp(
      `^\\s*${escapeRegex(open)}${escapeRegex(token)}(?: (.+?))?${escapeRegex(close)}\\s*$`,
    );
  // Return
  return {
    FILE_EXT: getExtensionRegex(Extensions),
    REGION_MARKER: marker(Markers.REGION),
    SECTION_MARKER: marker(Markers.SECTION),
    BOOKENDS: bookends,
    CHAR_LIMIT: CharacterLimit,
    FILLER: fillerChar,
    DISABLE_CAP: disableCap,
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
 */
function getExtensionRegex(extensions: string[]): RegExp {
  const cleanExtensions = extensions.map((ext: string) => {
    const extFinal = ext.replace(/^\./, '');
    return escapeRegex(extFinal);
  });
  return new RegExp(`\\.(${cleanExtensions.join('|')})$`);
}

/**
 * @private
 *
 * Escape regex special characters in a literal string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @private
 *
 * Recursively walk a path, rewriting markers in every supported file.
 */
function walkDirectoryRecursivelyx(
  targetPath: string,
  langConfigArr: LangSettings[],
): string[] {
  // pick up here, maybe this can be replaced with something which just lists
  // all the files + full path using a glob match
  console.log();

  const updated: string[] = [];
  const isDirectory = fileUtils.isDir(targetPath);
  // Go recursive if directory
  if (isDirectory) {
    const items = fileUtils.listDirItems(targetPath);
    for (const item of items) {
      if (item === 'node_modules' || item.startsWith('.')) {
        continue;
      }
      const fileFullPath = path.join(targetPath, item);
      const result = walkDirectoryRecursively(fileFullPath, langConfigArr);
      updated.push(...result);
    }
    return updated;
  }
  // Check the patting type
  const langConfig =
    langConfigArr.find((type) => type.FILE_EXT.test(targetPath)) ?? null;
  if (!langConfig) return updated;
  // Write the divider comment (unless doing a dryRun)
  const content = fileUtils.read(targetPath);
  const next = content
    .split('\n')
    .map((line, i) =>
      checkForMarkerAndAddDivider(line, i, langConfig, targetPath),
    )
    .join('\n');
  if (next !== content) {
    fileUtils.write(targetPath, next);
    const logMsgStart = fileUtils.getIsDryRun() ? 'Would update' : 'Updated';
    logger.info(logMsgStart + ': ' + targetPath);
    updated.push(targetPath);
  }
  // Return
  return updated;
}

/**
 * @private
 *
 * Determine whether to format a "section" or a "region".
 */
function checkForMarkerAndAddDivider(
  line: string,
  index: number,
  langConfig: LangSettings,
  filePath: string,
): string {
  const indent = line.match(/^(\s*)/)?.[1] ?? '';
  const sectionMatch = line.match(langConfig.SECTION_MARKER);
  // Insert "section" divider
  if (sectionMatch) {
    const label = sectionMatch[1]?.trim() ?? '';
    if (!label) {
      printMissingLabelWarning(filePath, index);
      return line;
    };
    const labelFinal = capitalizeLabel(label, langConfig);
    return formatSection(labelFinal, langConfig, indent);
  }
  // Insert "region" divider
  const regionMatch = line.match(langConfig.REGION_MARKER);
  if (regionMatch) {
    const label = regionMatch[1]?.trim() ?? '';
    if (!label) {
      printMissingLabelWarning(filePath, index);
      return line;
    }
    const labelFinal = capitalizeLabel(label, langConfig);
    return formatRegion(labelFinal, langConfig, indent);
  }
  // Return unedited line if no marker found
  return line;
}

/**
 * @private
 *
 * Warn that a marker on the given (0-based) line has no label, and return the
 * line unchanged so nothing is inserted.
 */
function printMissingLabelWarning(
  filePath: string,
  index: number,
): void {
  logger.warn(`Warning: ${filePath}:${index + 1}: code-divider marker has no label, skipping`);
}

/**
 * @private
 *
 * Capitalize each word in a label (first letter upper, rest lower), unless the
 * language has DisableCapitalization set. Words that start or end with a
 * non-alphanumeric character are left untouched (e.g. "@decorator", "foo()").
 */
function capitalizeLabel(label: string, langConfig: LangSettings): string {
  if (langConfig.DISABLE_CAP) return label;
  return label
    .split(/\s+/)
    .map((word) => {
      if (!getIsAlphaNum(word[0]) || !getIsAlphaNum(word[word.length - 1])) {
        return word;
      }
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * @private
 *
 * Check if a string is an alphanumeric string.
 */
function getIsAlphaNum(value: string): boolean {
  return /[a-z0-9]/i.test(value);
}

/**
 * @private
 *
 * Build a single-line section header centered within `[open] = label = [close]`.
 * Filler fills up to the character limit and stops; a label too long to fit
 * simply gets no filler rather than pushing the line past the limit.
 */
function formatSection(
  label: string,
  langConfig: LangSettings,
  indent: string,
): string {
  const [open, close] = langConfig.BOOKENDS;
  const filler = langConfig.FILLER;
  const lineLen = langConfig.CHAR_LIMIT - indent.length;
  const available = lineLen - open.length - close.length - label.length - 2;
  const left = Math.max(Math.ceil(available / 2), 0);
  const right = Math.max(Math.floor(available / 2), 0);
  return `${indent}${open}${filler.repeat(left)} ${label} ${filler.repeat(right)}${close}`;
}

/**
 * @private
 *
 * Build a 3-line region header block with the label centered on the middle line.
 * Rule lines stop at the character limit: "// " + filler + " //".
 */
function formatRegion(
  label: string,
  paddingType: LangSettings,
  indent: string,
): string {
  const [open, close] = paddingType.BOOKENDS;
  const lineLen = paddingType.CHAR_LIMIT - indent.length;
  const inner = Math.max(lineLen - open.length - close.length, 0);
  const rule = indent + open + paddingType.FILLER.repeat(inner) + close;
  const leftPad = Math.max(Math.floor((inner - label.length) / 2), 0);
  const rightPad = Math.max(inner - label.length - leftPad, 0);
  const middle =
    indent + open + ' '.repeat(leftPad) + label + ' '.repeat(rightPad) + close;
  return [rule, middle, rule].join('\n');
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default insertCodeDividers;
