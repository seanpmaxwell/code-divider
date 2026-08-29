import { LabelFormats } from '#src/common/types/settings.js';
import logger from '#src/common/utils/logger.js';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

const RGX_ALPHA_NUM = /[a-z0-9]/i;

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Capitalize or UpperCase each word in a label (first letter upper, rest lower).
 * Words that start or end with a non-alphanumeric character are left untouched
 * (e.g. "@decorator", "foo()"), and any portion of the label wrapped in
 * backticks (`) is left untouched verbatim, including internal spacing.
 */
function formatLabel(
  label: string,
  filePath: string,
  lineNum: number,
  format: LabelFormats,
): string {
  // Make sure the label exists
  const labelNew = label?.trim() ?? '';
  if (!labelNew) {
    logger.warn(
      `Warning: ${filePath}:${lineNum + 1}: code-divider marker has no label, skipping`,
    );
    return label;
  }
  // Skip if value is "none"
  if (format === 'none') return label;
  // Apply formatting
  const tokens: string[] = [];
  for (const word of label.split(/\s+/)) {
    if (word) {
      const wordNew = applyFormatting(word, format);
      tokens.push(wordNew);
    };
  }
  return tokens.join(' ');
}

/**
 * @private
 * @see {formatLabel}
 * 
 * Change a word to uppercase or capitalize depending on the `dividerType` 
 * param.
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
//                                     Export                                //
// ========================================================================= //

export default formatLabel;
