import logger from 'my-tools/simple-logger';

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
  dividerType: 'region' | 'section',
): string {
  // Make sure the label exists
  const labelNew = label?.trim() ?? '';
  if (!labelNew) {
    logger.warn(
      `Warning: ${filePath}:${lineNum + 1}: code-divider marker has no label, skipping`,
    );
    return label;
  }
  // Split into backtick-quoted spans (left untouched, including internal
  // whitespace) and everything else (cased word by word), then rejoin.
  return formatLabelHelper(label, dividerType);
}

/**
 * @private
 * @see {formatLabel}
 *
 * Refer to the calling function for full details.
 */
function formatLabelHelper(
  label: string,
  dividerType: 'region' | 'section'
): string {
  const tokens: string[] = [];
  for (const part of label.split(/(`[^`]*`)/)) {
    if (/^`[^`]*`$/.test(part)) {
      tokens.push(part);
      continue;
    }
    for (const word of part.split(/\s+/)) {
      if (word) {
        const wordNew = changeLabelCasing(word, dividerType);
        tokens.push(wordNew);
      };
    }
  }
  return tokens.join(' ');
}

/**
 * @private
 * @see {formatLabelHelper}
 * 
 * Change a word to uppercase or capitalize depending on the `dividerType` 
 * param.
 */
function changeLabelCasing(word: string, dividerType: 'region' | 'section'): string {
  const firstChar = word[0];
  const lastChar = word[word.length - 1];
  if (!RGX_ALPHA_NUM.test(firstChar) || !RGX_ALPHA_NUM.test(lastChar)) {
    return word;
  }
  // Capitalize for `Sections`
  if (dividerType === 'section') {
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  }
  // UPPERCASE for `Regions`
  return word.toUpperCase();
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default formatLabel;
