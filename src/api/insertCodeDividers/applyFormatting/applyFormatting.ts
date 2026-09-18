import type { ConfiguredLangSettings } from '@common/types/settings';
import type { IRunContext } from '@common/utils/fns/RunContext';

import uFile, { FilePathDTO } from '@utilm/uFile';

import type { ILogger } from '@logger';

import formatLabel from './formatLabel';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Files processed at once. Starting every file in a huge repo at the same
// time can run into the OS limit on open files (EMFILE).
const MAX_OPEN_FILES = 50;

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Format every file whose extension has a settings object, in parallel
 * batches of {@link MAX_OPEN_FILES}. Files with no matching language are
 * skipped. Returns the paths of the files that were (or on a dry run, would
 * be) changed, in the same order as `dtos`.
 */
async function applyFormatting(
  dtos: FilePathDTO[],
  ctx: IRunContext,
): Promise<string[]> {
  // Collect a job per file, but don't start any yet
  const { extensionsMap } = ctx.configuredSettings;
  const jobs: (() => Promise<string | null>)[] = [];
  for (const dto of dtos) {
    const settingsObj = extensionsMap.get(dto.ext);
    if (settingsObj) {
      jobs.push(() =>
        applyFormattingToOneFile(dto.absolutePath, settingsObj, ctx),
      );
    }
  }
  // Run them in batches and return the files that were edited
  const edited: string[] = [];
  for (let i = 0; i < jobs.length; i += MAX_OPEN_FILES) {
    const batch = jobs.slice(i, i + MAX_OPEN_FILES).map((job) => job());
    for (const result of await Promise.all(batch)) {
      if (result !== null) edited.push(result);
    }
  }
  return edited;
}

/**
 * Insert code-dividers for a file.
 *
 * Used by: {@link applyFormatting}
 *
 * @private
 */
async function applyFormattingToOneFile(
  fileFullPath: string,
  settingsObj: ConfiguredLangSettings,
  ctx: IRunContext,
): Promise<string | null> {
  // -- Load content -- //
  // Keep the file's own line endings (CRLF files stay CRLF).
  const content = await uFile.read(fileFullPath);
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(eol);

  // -- Iterate the file line-by-line -- //
  let insertions = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.match(/^(\s*)/)?.[1] ?? '';
    // Check if inserting `section`
    const sectionMatch = line.match(settingsObj.SECTION_MARKER);
    if (sectionMatch) {
      let label = validateLabel(sectionMatch[1], fileFullPath, i, ctx.logger);
      if (!label) continue;
      label = formatLabel(label, settingsObj.SECTION_LABEL_FORMAT);
      lines[i] = insertSection(label, settingsObj, indent);
      insertions = true;
      continue;
    }
    // Check if inserting `region`
    const regionMatch = line.match(settingsObj.REGION_MARKER);
    if (regionMatch) {
      let label = validateLabel(regionMatch[1], fileFullPath, i, ctx.logger);
      if (!label) continue;
      label = formatLabel(label, settingsObj.REGION_LABEL_FORMAT);
      lines[i] = insertRegion(label, settingsObj, indent, eol);
      insertions = true;
      continue;
    }
  }

  // -- Return -- //
  // Return an object if a file WAS edited
  if (insertions) {
    if (!ctx.isDryRun) {
      const newContent = lines.join(eol);
      await uFile.write(fileFullPath, newContent);
    }
    return fileFullPath;
  }
  // Return null if no insertions were done
  return null;
}

/**
 * Double-check the label is truthy after trimming.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function validateLabel(
  label: string,
  filePath: string,
  lineNum: number,
  logger: ILogger,
): string {
  const labelNew = label?.trim() ?? '';
  if (!labelNew) {
    logger.warn(
      `Warning: ${filePath}:${lineNum + 1}: code-divider marker has no label, skipping`,
    );
  }
  return labelNew;
}

/**
 * Build a single-line section header centered within `[open] = label = [close]`.
 * Filler fills up to the character limit and stops; a label too long to fit
 * simply gets no filler rather than pushing the line past the limit.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
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
 * Build a 3-line region header block with the label centered on the middle line.
 * Rule lines stop at the character limit: "// " + filler + " //".
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function insertRegion(
  label: string,
  paddingType: ConfiguredLangSettings,
  indent: string,
  eol: string,
): string {
  const [open, close] = paddingType.BOOKENDS;
  const lineLen = paddingType.CHAR_LIMIT - indent.length;
  const inner = Math.max(lineLen - open.length - close.length, 0);
  const rule = indent + open + paddingType.FILLER.repeat(inner) + close;
  const leftPad = Math.max(Math.floor((inner - label.length) / 2), 0);
  const rightPad = Math.max(inner - label.length - leftPad, 0);
  const middle =
    indent + open + ' '.repeat(leftPad) + label + ' '.repeat(rightPad) + close;
  return [rule, middle, rule].join(eol);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default applyFormatting;
