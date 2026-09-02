// ============================================================
// eslint-rule-no-nested-oninit.ts
// Enforces onInit(...) is only called at the top level of a module.
// ============================================================
import type { Rule } from 'eslint';
import type { Node } from 'estree';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'onInit must be called at the top level of a module, not nested in a function.',
    },
    schema: [],
  },
  create(context: Rule.RuleContext): Rule.RuleListener {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'Identifier' || callee.name !== 'onInit') return;
        let current: Node | undefined = (node as Node & { parent?: Node })
          .parent;
        while (current && current.type !== 'Program') {
          if (
            current.type === 'FunctionDeclaration' ||
            current.type === 'FunctionExpression' ||
            current.type === 'ArrowFunctionExpression'
          ) {
            context.report({
              node,
              message:
                'onInit must be called at the top level of a module, not nested in a function.',
            });
            return;
          }
          current = (current as Node & { parent?: Node }).parent;
        }
      },
    };
  },
};

export default rule;
