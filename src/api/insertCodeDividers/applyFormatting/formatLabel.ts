import { LabelFormats } from '@common/types/settings.js';

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
 * and runs of whitespace collapse to a single space.
 */
function formatLabel(label: string, format: LabelFormats): string {
  if (format === 'none') return label;
  // Apply formatting
  const tokens: string[] = [];
  for (const word of label.split(/\s+/)) {
    if (word) {
      const wordNew = applyFormatting(word, format);
      tokens.push(wordNew);
    }
  }
  return tokens.join(' ');
}

/**
 * Change one word's case according to `format`. Words starting or ending
 * with a non-alphanumeric character are returned as-is.
 *
 * @private {@link formatLabel}
 */
function applyFormatting(word: string, format: LabelFormats): string {
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
