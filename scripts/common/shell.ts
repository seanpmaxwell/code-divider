import { $ as $_lib, type TemplateExpression } from 'execa';

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Print .stdout
 */
export const $ = $_lib({ verbose: 'full' });

/**
 * Return .stdout
 */
export const $$ = (() => {
  const _$$ = $_lib({ verbose: 'short' });
  return async (
    templates: TemplateStringsArray,
    ...expressions: readonly TemplateExpression[]
  ): Promise<string> => {
    const { stdout } = await _$$(templates, ...expressions);
    return stdout.trim();
  }
})();
