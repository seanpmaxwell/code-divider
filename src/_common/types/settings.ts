// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

export type LabelFormats = 'uppercase' | 'lowercase' | 'capitalize' | 'none';

/**
 * Match a language extension to a language settings object.
 */
export type ExtensionsMap = Map<string, ConfiguredLangSettings>;

/**
 * The shared "All" block plus one entry per language.
 */
export interface InitialSettings {
  filter: FilterSettings;
  All: SharedSettings;
  [language: string]: InitialLangSettings | SharedSettings | FilterSettings;
}

/**
 * Files to include/exclude.
 */
export interface FilterSettings {
  include: string[];
  exclude: string[];
}

/**
 * Settings shared by every language, held under the "All" key. A language may
 * override any of these individually.
 */
export interface SharedSettings {
  CharacterLimit: number;
  FillerCharacter: string;
  RegionLabelFormat: LabelFormats;
  SectionLabelFormat: LabelFormats;
}

/**
 * A single language entry: which files it matches, the comment syntax markers
 * are written in, and any overrides of the shared settings.
 */
export interface InitialLangSettings {
  Extensions: string[];
  Comment: [string, string];
  Bookends: [string, string];
  CharacterLimit?: number;
  FillerCharacter?: string;
  RegionLabelFormat?: LabelFormats;
  SectionLabelFormat?: LabelFormats;
}

/**
 * A language entry compiled into the matchers and settings used while walking
 * files. This is the validated, ready-to-use form of an `InitialLangSettings`.
 */
export interface ConfiguredLangSettings {
  EXTENSIONS: string[];
  REGION_MARKER: RegExp;
  SECTION_MARKER: RegExp;
  BOOKENDS: [string, string];
  CHAR_LIMIT: number;
  FILLER: string;
  REGION_LABEL_FORMAT: LabelFormats;
  SECTION_LABEL_FORMAT: LabelFormats;
}
