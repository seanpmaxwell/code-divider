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
  files: string[], // These need to be the relative paths
  extensionsMap: ExtensionsMap,
): Promise<FileEditResult[]> {
  // Iterate the list of files
  const editFileJobs: Promise<FileEditResult | null>[] = [];
  for (const file of files) {
    const ext = path.extname(file);
    const settingsObj = extensionsMap.get(ext);
    if (settingsObj) {

      console.log()
      // create a new object that has filename, targetpath, fileFullPath, ext, relativePath
            const fileFullPath = path.join(targetPath, file);

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

// /**
//  * @private
//  *
//  * Recursively walk a path, rewriting markers in every supported file.
//  */
// function walkDirectoryRecursivelyx(
//   targetPath: string,
//   langConfigArr: LangSettings[],
// ): string[] {
//   // pick up here, maybe this can be replaced with something which just lists
//   // all the files + full path using a glob match
//   console.log();

//   const updated: string[] = [];
//   const isDirectory = fileUtils.isDir(targetPath);
//   // Go recursive if directory
//   if (isDirectory) {
//     const items = fileUtils.listDirItems(targetPath);
//     for (const item of items) {
//       if (item === 'node_modules' || item.startsWith('.')) {
//         continue;
//       }
//       const fileFullPath = path.join(targetPath, item);
//       const result = walkDirectoryRecursively(fileFullPath, langConfigArr);
//       updated.push(...result);
//     }
//     return updated;
//   }
//   // Check the patting type
//   const langConfig =
//     langConfigArr.find((type) => type.FILE_EXT.test(targetPath)) ?? null;
//   if (!langConfig) return updated;
//   // Write the divider comment (unless doing a dryRun)
//   const content = fileUtils.read(targetPath);
//   const next = content
//     .split('\n')
//     .map((line, i) =>
//       checkForMarkerAndAddDivider(line, i, langConfig, targetPath),
//     )
//     .join('\n');
//   if (next !== content) {
//     fileUtils.write(targetPath, next);
//     const logMsgStart = fileUtils.getIsDryRun() ? 'Would update' : 'Updated';
//     logger.info(logMsgStart + ': ' + targetPath);
//     updated.push(targetPath);
//   }
//   // Return
//   return updated;
// }

/**
 * @private
 *
 * Determine whether to format a "section" or a "region".
 */
function checkForMarkerAndAddDivider(
  line: string,
  index: number,
  langConfig: ConfiguredLangSettings,
  filePath: string,
): string {
  const indent = line.match(/^(\s*)/)?.[1] ?? '';
  const sectionMatch = line.match(langConfig.SECTION_MARKER);
  // Insert "section" divider
  if (sectionMatch) {
    const label = sectionMatch[1]?.trim() ?? '';
    if (!label) {
      printMissingLabelWarning(filePath, index);
      return line;
    }
    const labelFinal = formatLabel(label, langConfig);
    return formatSection(labelFinal, langConfig, indent);
  }
  // Insert "region" divider
  const regionMatch = line.match(langConfig.REGION_MARKER);
  if (regionMatch) {
    const label = regionMatch[1]?.trim() ?? '';
    if (!label) {
      printMissingLabelWarning(filePath, index);
      return line;
    }
    const labelFinal = formatLabel(label, langConfig);
    return formatRegion(labelFinal, langConfig, indent);
  }
  // Return unedited line if no marker found
  return line;
}

/**
 * @private
 *
 * Build a single-line section header centered within `[open] = label = [close]`.
 * Filler fills up to the character limit and stops; a label too long to fit
 * simply gets no filler rather than pushing the line past the limit.
 */
function formatSection(
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
function formatRegion(
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
