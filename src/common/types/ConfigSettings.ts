// ========================================================================= //
//                                    Types                                  //
// ========================================================================= //

/**
 * The shared "All" block plus one entry per language.
 */
export interface ConfigSettings {
  filter: FilterSettings;
  All: SharedSettings;
  [language: string]: LangSettingsRaw | SharedSettings | FilterSettings;
}

/**
 * Files to include/exclude. NodeJS pre v22 does not support glob patterns.
 */
interface FilterSettings {
  include: string[];
  exclude: string[];
  nodePre22Exclude?: string[];
}

/**
 * Settings shared by every language, held under the "All" key. A language may
 * override any of these individually.
 */
interface SharedSettings {
  CharacterLimit: number;
  DisableCapitalization: boolean;
  FillerCharacter: string;
}

/**
 * A single language entry: which files it matches, the comment syntax markers
 * are written in, and any overrides of the shared settings.
 */
export interface LangSettingsRaw {
  Extensions: string[];
  Comment: [string, string];
  Bookends?: [string, string];
  CharacterLimit?: number;
  FillerCharacter?: string;
  DisableCapitalization?: boolean;
}

/**
 * A language entry compiled into the matchers and settings used while walking
 * files. This is the validated, ready-to-use form of a `LanguageEntry`.
 */
export interface LangSettings {
  FILE_EXT: RegExp;
  REGION_MARKER: RegExp;
  SECTION_MARKER: RegExp;
  BOOKENDS: [string, string];
  CHAR_LIMIT: number;
  FILLER: string;
  DISABLE_CAP: boolean;
}
