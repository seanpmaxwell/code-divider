// ========================================================================= //
//                                    Types                                  //
// ========================================================================= //

/**
 * The shared "All" block plus one entry per language.
 */
export interface InitalSettings {
  filter: FilterSettings;
  All: SharedSettings;
  [language: string]: InitialLangSettings | SharedSettings | FilterSettings;
}

/**
 * Files to include/exclude. NodeJS pre v22 does not support glob patterns.
 */
export interface FilterSettings {
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
  FillerCharacter: string;
}

/**
 * A single language entry: which files it matches, the comment syntax markers
 * are written in, and any overrides of the shared settings.
 */
export interface InitialLangSettings {
  Extensions: string[];
  Comment: [string, string];
  Bookends?: [string, string];
  CharacterLimit?: number;
  FillerCharacter?: string;
}

/**
 * A language entry compiled into the matchers and settings used while walking
 * files. This is the validated, ready-to-use form of a `LanguageEntry`.
 */
export interface ConfiguredLangSettings {
  EXTENSIONS: string[];
  REGION_MARKER: RegExp;
  SECTION_MARKER: RegExp;
  BOOKENDS: [string, string];
  CHAR_LIMIT: number;
  FILLER: string;
}

/**
 * Match a language extension to a language settings object. 
 */
export type ExtensionsMap = Map<string, ConfiguredLangSettings>;
