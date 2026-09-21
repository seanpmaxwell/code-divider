import type {
  FilterSettings,
  InitialLangSettings,
  LabelFormats,
  SharedSettings,
} from '@common/types/settings';
import UserError from '@common/utils/classes/UserError';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const LabelFormatOptions: ReadonlySet<unknown> = new Set([
  'uppercase',
  'lowercase',
  'capitalize',
  'none',
]);

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Run validations that both `All` and individual languages use. None of these
 * settings have to be defined in the `All` property, but each one must end up
 * defined by either `All` or the language itself. Whatever `All` does define
 * gets validated here too.
 */
export function validateSharedSettings<T extends string>(
  lang: T,
  settings: Partial<SharedSettings>,
) {
  const {
    CharacterLimit,
    FillerCharacter,
    RegionLabelFormat,
    SectionLabelFormat,
  } = settings;
  const notAll = lang !== 'All';

  // ---- Run validations
  // Validate "Character Limit"
  if ((notAll || CharacterLimit !== undefined) && !isPosInt(CharacterLimit)) {
    throw new UserError(
      `invalid configuration: "${lang}" CharacterLimit must be a positive integer, e.g. 79`,
    );
  }
  // Validate "Filler Character"
  if (
    (notAll || FillerCharacter !== undefined) &&
    (typeof FillerCharacter !== 'string' || FillerCharacter.length !== 1)
  ) {
    throw new UserError(
      `invalid configuration: "${lang}" FillerCharacter must be a single character, e.g. "="`,
    );
  }
  // Validate "Region Label" format (a non-string value must fail the check
  // below rather than blow up on `.toLowerCase`)
  const rlf = lowerIfString(RegionLabelFormat);
  if ((notAll || rlf !== undefined) && !isLabelFormatOpt(rlf)) {
    throw new UserError(
      `invalid configuration: "${lang}" RegionLabelFormat must be 'uppercase','lowercase','capitalize', or 'none'`,
    );
  }
  // Validate "Section Label" format
  const slf = lowerIfString(SectionLabelFormat);
  if ((notAll || slf !== undefined) && !isLabelFormatOpt(slf)) {
    throw new UserError(
      `invalid configuration: "${lang}" SectionLabelFormat must be 'uppercase','lowercase','capitalize', or 'none'`,
    );
  }

  // ---- Return
  return {
    CharacterLimit,
    FillerCharacter,
    RegionLabelFormat: rlf,
    SectionLabelFormat: slf,
  } as T extends 'All' ? Partial<SharedSettings> : SharedSettings;
}

/**
 * Lowercase a value if it is a string, otherwise pass it through untouched.
 *
 * Used by: {@link validateSharedSettings}
 *
 * @private
 */
function lowerIfString(value: unknown): unknown {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

/**
 * Check that a value is of type: `LabelFormats`
 *
 * Used by: {@link validateSharedSettings}
 *
 * @private
 */
function isLabelFormatOpt(value: unknown): value is LabelFormats {
  return LabelFormatOptions.has(value);
}

/**
 * Check a value is an integer of at least 1.
 *
 * Used by: {@link validateSharedSettings}
 *
 * @private
 */
function isPosInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

// ======================== Validate Filter Settings ======================= //

/**
 * Check the `filter` block: `include` and `exclude` must both be arrays of
 * strings.
 */
export function validateFilterSettings(filter: unknown): FilterSettings {
  const { include, exclude } = (filter ?? {}) as Partial<FilterSettings>;
  if (!isStrArr(include)) {
    throw new UserError(
      'invalid configuration: "filter.include" must be an array of glob patterns, e.g. ["src"]',
    );
  }
  if (!isStrArr(exclude)) {
    throw new UserError(
      'invalid configuration: "filter.exclude" must be an array of glob patterns, e.g. ["node_modules"]',
    );
  }
  return { include, exclude };
}

// ================== Validate Language Specific Settings ================== //

/**
 * Validate Settings that CANNOT be set in the `All` property. Extensions are
 * normalized to a lowercase `.ext` form so lookups are case-insensitive.
 */
export function validateLangSpecificSettings(
  lang: string,
  settings: InitialLangSettings,
): Pick<InitialLangSettings, 'Extensions' | 'Comment' | 'Bookends'> {
  const { Extensions, Comment, Bookends } = settings;

  // ---- Validate "Comment"
  const [open, close] = Array.isArray(Comment) ? Comment : [];
  if (typeof open !== 'string' || typeof close !== 'string') {
    throw new UserError(
      `invalid configuration: "${lang}" needs a Comment pair, e.g. ["# ", ""]`,
    );
  }

  // ---- Validate "Bookends"
  // Bookends default to the comment syntax when the language doesn't set them.
  // For line comments (empty close) the opening comment is mirrored on the
  // right, e.g. `# ` -> ` #`.
  let bookends = Bookends ?? [];
  if (!Bookends) {
    const closeFinal = close || ` ${open.trim()}`;
    bookends = [open, closeFinal];
  }
  if (!isStrArr(bookends) || bookends.length !== 2) {
    throw new UserError(
      `invalid configuration: "${lang}" Bookends must be of type [string, string]`,
    );
  }

  // ---- Validate "Extensions"
  if (!isStrArr(Extensions)) {
    throw new UserError(
      `invalid configuration: "${lang}" Extensions must be of type string[]`,
    );
  }
  const extensions = Extensions.map((ext) => {
    const lower = ext.toLowerCase();
    return lower.startsWith('.') ? lower : `.${lower}`;
  });

  // ---- Return
  return {
    Comment,
    Bookends: bookends,
    Extensions: extensions,
  };
}

/**
 * Check that a value is of type: string[]
 *
 * Used by: {@link validateLangSpecificSettings}
 *
 * @private
 */
function isStrArr(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  const hasNonStringValue = value.some((item) => typeof item !== 'string');
  return !hasNonStringValue;
}
