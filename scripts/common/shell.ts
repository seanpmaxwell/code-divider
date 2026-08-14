import { $ as $_lib, type TemplateExpression } from 'execa';

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Print .stdout
 */
export const $ = $_lib({ stdio: 'inherit' });

/**
 * Return .stdout
 */
export const $$ = (() => {
  const $_local = $_lib({ verbose: 'short' });
  return async (
    templates: TemplateStringsArray,
    ...expressions: readonly TemplateExpression[]
  ): Promise<string> => {
    const { stdout } = await $_local(templates, ...expressions);
    return String(stdout).trim();
  }
})();
