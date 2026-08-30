import FileUtils, { FilePathMd } from 'my-tools/FileUtils';
import path from 'path';

import { FileEditResult } from '@src/common/types/misc.js';
import type {
  ConfiguredLangSettings,
  ExtensionsMap,
} from '@src/common/types/settings.js';
import logger from '@logger';

import formatLabel from './formatLabel';

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Look at file extension and load it if it matches the extension. Then
 */
async function applyFormatting(
  files: FilePathMd[],
  extensionsMap: ExtensionsMap,
): Promise<FileEditResult[]> {
  // Iterate the list of files
  const editFileJobs: Promise<FileEditResult | null>[] = [];
  for (const file of files) {
    const settingsObj = extensionsMap.get(file.ext);
    if (settingsObj) {
      const job = applyFormattingToOneFile(file.absolutePath, settingsObj);
      if (job) editFileJobs.push(job);
    }
  }
  // Return a list of files that were edited
  const insertions = await Promise.all(editFileJobs);
  return insertions.filter((item) => item !== null);
}

/**
 * @private
 * @see {applyFormatting}
 *
 * Insert code-dividers for a file.
 */
async function applyFormattingToOneFile(
  fileFullPath: string,
  settingsObj: ConfiguredLangSettings,
): Promise<FileEditResult | null> {
  // -- Load content -- //
  const content = await FileUtils.read(fileFullPath);
  const lines = content.split('\n');

  // -- Iterate the file line-by-line -- //
  let insertions = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.match(/^(\s*)/)?.[1] ?? '';
    // Check if inserting `section`
    const sectionMatch = line.match(settingsObj.SECTION_MARKER);
    if (sectionMatch) {
      let label = validateLabel(sectionMatch[1], fileFullPath, i);
      if (!label) continue;
      label = formatLabel(label, settingsObj.SECTION_LABEL_FORMAT);
      lines[i] = insertSection(label, settingsObj, indent);
      insertions++;
      continue;
    }
    // Check if inserting `region`
    const regionMatch = line.match(settingsObj.REGION_MARKER);
    if (regionMatch) {
      let label = validateLabel(regionMatch[1], fileFullPath, i);
      if (!label) continue;
      label = formatLabel(label, settingsObj.REGION_LABEL_FORMAT);
      lines[i] = insertRegion(label, settingsObj, indent);
      insertions++;
      continue;
    }
  }

  // -- Return -- //
  // Return an object if a file WAS edited
  if (insertions) {
    return {
      filename: path.basename(fileFullPath),
      fullPath: fileFullPath,
      insertions,
    };
  }
  // Return null if no insertions were done
  return null;
}

/**
 * @private
 * @see {applyFormattingToOneFile}
 * 
 * Double check the label is truthy after trimming.
 */
function validateLabel(label: string, filePath: string, lineNum: number): string {
  const labelNew = label?.trim() ?? '';
  if (!labelNew) {
    logger.warn(
      `Warning: ${filePath}:${lineNum + 1}: code-divider marker has no label, skipping`,
    );
  }
  return labelNew;
}

/**
 * @private
 * @see {applyFormattingToOneFile}
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
 * @see {applyFormattingToOneFile}
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

export default applyFormatting;
