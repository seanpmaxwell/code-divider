import { CONFIG_FILE_NAME } from '@src/common/constants/misc';
import type {
  InitialLangSettings,
  LabelFormats,
  SharedSettings,
} from '@src/common/types/settings.js';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

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
 * Run validations that both `All` and individual languages use. Note that none
 * of these settings need to be defined in the `All` property. But they do
 * eventually defined by either the `All` or the language settings. If they are
 * defined in the `All` property, they do need to be validated.
 */
export function validateSharedSettings<T extends string>(
  lang: T,
  settings: Partial<SharedSettings>,
) {
  // Initialize
  const {
    CharacterLimit,
    FillerCharacter,
    RegionLabelFormat,
    SectionLabelFormat,
  } = settings;
  const notAll = lang !== 'All';
  // Validate "Character Limit"
  if ((notAll || CharacterLimit) && !isPositiveInt(CharacterLimit)) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" CharacterLimit must be a positive integer, e.g. 79`,
    );
  }
  // Validate "Filler Character"
  if (
    (notAll || FillerCharacter) &&
    (typeof FillerCharacter !== 'string' || FillerCharacter.length !== 1)
  ) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" FillerCharacter must be a single character, e.g. "="`,
    );
  }
  // Validate "Region Label" format
  const rlf = RegionLabelFormat?.toLowerCase();
  if ((notAll || rlf) && !isLabelFormat(rlf)) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" RegionLabelFormat must be 'uppercase','lowercase','capitalize', or 'none'`,
    );
  }
  // Validate "Section Label" format
  const slf = SectionLabelFormat?.toLowerCase();
  if ((notAll || slf) && !isLabelFormat(slf)) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" SectionLabelFormat must be 'uppercase','lowercase','capitalize', or 'none'`,
    );
  }
  // Return
  return {
    CharacterLimit,
    FillerCharacter,
    RegionLabelFormat: rlf,
    SectionLabelFormat: slf,
  } as T extends 'All' ? Partial<SharedSettings> : SharedSettings;
}

/**
 * @private
 * @see {validateSharedSettings}
 *
 * Check that a value is of type: `LabelFormats`
 */
function isLabelFormat(value: unknown): value is LabelFormats {
  return LabelFormatOptions.has(value);
}

/**
 * @private
 * @see {validateSharedSettings}
 *
 * Check a value is an integer of at least 1.
 */
function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

// ============= Validate Language Specific Settings ======================= //

/**
 * Validate Settings that CANNOT be set in the `All` property.
 */
export function validateLangSpecificSettings(
  lang: string,
  settings: InitialLangSettings,
): Pick<InitialLangSettings, 'Extensions' | 'Comment' | 'Bookends'> {
  const { Extensions, Comment, Bookends } = settings;

  // -- Validate "Comment" -- //
  const [open, close] = Array.isArray(Comment) ? Comment : [];
  if (typeof open !== 'string' || typeof close !== 'string') {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" needs a Comment pair, e.g. ["# ", ""]`,
    );
  }

  // -- Validate "Bookends" -- //
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

  // -- Validate "Extensions" -- //
  if (!isStrArr(Extensions)) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" Extensions must of type string[]`,
    );
  }
  const extensions = Extensions.map((ext) =>
    !ext.startsWith('.') ? `.${ext}` : ext,
  );

  // -- Return -- //
  return {
    Comment,
    Bookends: bookends,
    Extensions: extensions,
  };
}

/**
 * @private
 * @see {validateLangSpecificSettings}
 *
 * Check that a value is of type: string[]
 */
function isStrArr(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  const hasNonStringValue = value.some((item) => typeof item !== 'string');
  return !hasNonStringValue;
}
