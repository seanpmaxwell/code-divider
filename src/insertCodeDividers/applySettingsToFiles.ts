import path from 'path';

import type {
  ConfiguredLangSettings,
  ExtensionsMap,
} from '@src/common/types/settings.js';
import logger from '@src/common/utils/logger';
import fileUtils from '@src/common/utils/fileUtils.js';
import { FileEditResult } from '#src/common/types/misc.js';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

const RGX_ALPHA_NUM = /[a-z0-9]/i;

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Look at file extension and load it if it matches the extension. Then
 */
async function applySettingsToFiles(
  targetPath: string,
  files: string[], // These need to be the relative paths from the targetPath
  extensionsMap: ExtensionsMap,
): Promise<FileEditResult[]> {
  // Iterate the list of files
  const editFileJobs: Promise<FileEditResult | null>[] = [];
  for (const file of files) {

    console.log() // Finish setting update the file data object
    // const ext = path.extname(file)

    const settingsObj = extensionsMap.get(ext);
    if (settingsObj) {
      // const fileFullPath = path.join(targetPath, file);
      const job = startFileEditJob(fileFullPath, settingsObj);
      editFileJobs.push(job);
    }
  }
  // Return a list of files that were edited
  const insertions = await Promise.all(editFileJobs);
  return insertions.filter((item) => item !== null);
}

/**
 * @private
 * 
 * Insert code-dividers for a file.
 */
async function startFileEditJob(
  fileFullPath: string,
  settingsObj: ConfiguredLangSettings,
): Promise<FileEditResult | null> {
  // Init
  const content = await fileUtils.read(fileFullPath);
  // Iterate the file line-by-line
  let insertions = 0;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if inserting `section`
    const sectionMatch = line.match(settingsObj.SECTION_MARKER)
    if (sectionMatch) {
      const label = formatLabel(sectionMatch[1], settingsObj, targetPath, i);
      lines[i] = insertSection(line, settingsObj);
      insertions++;
      continue;
    }
    // Check if inserting `region`
    if (line.match(settingsObj.REGION_MARKER)) {
      lines[i] = insertRegion(line, settingsObj);
      insertions++;
      continue;
    }
  }

  // Return an object if a file WAS edited
  if (insertions) {
    return {
      filename: path.basename(fileFullPath),
      fullPath: fileFullPath,
      insertions,
    }
  }
  // Return null if no insertions were done
  return null;
}

/**
 * @private
 *
 * Capitalize each word in a label (first letter upper, rest lower), unless the
 * language has DisableCapitalization set. Words that start or end with a
 * non-alphanumeric character are left untouched (e.g. "@decorator", "foo()").
 */
function formatLabel(
  labelRaw: string,
  langConfig: ConfiguredLangSettings,
  filePath: string,
  index: number,
): string {
  // Make sure the label exists
  const label = labelRaw?.trim() ?? '';
  if (!label) {
    logger.warn(
      `Warning: ${filePath}:${index + 1}: code-divider marker has no label, skipping`,
    );
    return labelRaw;
  }
  // Skip if capitalization is disabled
  if (langConfig.DISABLE_CAP) return label;
  // Callback for .map
  const capitalizeWord = (word: string) => {
    const firstChar = word[0];
    const lastChar = word[word.length - 1];
    if (!RGX_ALPHA_NUM.test(firstChar) || !RGX_ALPHA_NUM.test(lastChar)) {
      return word;
    }
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  }
  // Split -> capitalize -> rejoin -> return
  return label.split(/\s+/).map(capitalizeWord).join(' ');
}

/**
 * @private
 *
 * Build a single-line section header centered within `[open] = label = [close]`.
 * Filler fills up to the character limit and stops; a label too long to fit
 * simply gets no filler rather than pushing the line past the limit.
 */
function insertSection(
  label: string,
  langConfig: ConfiguredLangSettings,
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
function insertRegion(
  label: string,
  paddingType: ConfiguredLangSettings,
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

export default applySettingsToFiles;
