import path from 'path';

import FileUtils, { FilePathDTO } from 'my-tools/FileUtils';
import { FileEditResult } from '@src/common/types/misc.js';

import type {
  ConfiguredLangSettings,
  ExtensionsMap,
} from '@src/common/types/settings.js';
import formatLabel from './formatLabel';

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Look at file extension and load it if it matches the extension. Then
 */
async function applyFormatting(
  files: FilePathDTO[], // These need to be the relative paths from the targetPath
  extensionsMap: ExtensionsMap,
): Promise<FileEditResult[]> {
  // Iterate the list of files
  const editFileJobs: Promise<FileEditResult | null>[] = [];
  for (const file of files) {
    const settingsObj = extensionsMap.get(file.ext);
    if (settingsObj) {
      // const fileFullPath = path.join(targetPath, file);
      const job = startFileEditJob(file.absolutePath, settingsObj);
      if (job) editFileJobs.push(job);
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
  const content = await FileUtils.read(fileFullPath);
  // Iterate the file line-by-line
  let insertions = 0;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.match(/^(\s*)/)?.[1] ?? '';
    // Check if inserting `section`
    const sectionMatch = line.match(settingsObj.SECTION_MARKER);
    if (sectionMatch) {
      const label = formatLabel(sectionMatch[1], fileFullPath, i, 'section');
      lines[i] = insertSection(label, settingsObj, indent);
      insertions++;
      continue;
    }
    // Check if inserting `region`
    const regionMatch = line.match(settingsObj.REGION_MARKER);
    if (regionMatch) {
      const label = formatLabel(regionMatch[1], fileFullPath, i, 'region');
      lines[i] = insertRegion(label, settingsObj, indent);
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
    };
  }
  // Return null if no insertions were done
  return null;
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

export default applyFormatting;
