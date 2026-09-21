import type { LabelFormats } from '@common/types/settings';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const RGX_ALPHA_NUM = /[a-z0-9]/i;

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Apply the configured case (`uppercase`, `lowercase`, `capitalize`, or
 * `none`) to each word in a label. Words that start or end with a
 * non-alphanumeric character are left untouched (e.g. "@decorator", "foo()"),
 * and runs of whitespace collapse to a single space under every format.
 */
function formatLabel(label: string, format: LabelFormats): string {
  const words = label.split(/\s+/).filter(Boolean);
  if (format === 'none') return words.join(' ');
  return words.map((word) => formatWord(word, format)).join(' ');
}

/**
 * Change one word's case according to `format`. Words starting or ending
 * with a non-alphanumeric character are returned as-is.
 *
 * Used by: {@link formatLabel}
 *
 * @private
 */
function formatWord(word: string, format: LabelFormats): string {
  const firstChar = word[0];
  const lastChar = word[word.length - 1];
  if (!RGX_ALPHA_NUM.test(firstChar) || !RGX_ALPHA_NUM.test(lastChar)) {
    return word;
  }
  switch (format) {
    case 'uppercase':
      return word.toUpperCase();
    case 'lowercase':
      return word.toLowerCase();
    case 'capitalize':
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
  }
  return word;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default formatLabel;
