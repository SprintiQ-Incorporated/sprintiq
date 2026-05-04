/**
 * ESLint Rule: no-raw-fetch-api
 *
 * Prevents direct fetch() calls to /api/* routes in client code.
 * These calls should use csrfFetch() instead to ensure CSRF protection.
 *
 * @example
 * // Bad - will be flagged
 * fetch('/api/tasks/save', { method: 'POST', ... })
 * fetch(`/api/workspace/${id}/stories`, { method: 'DELETE', ... })
 *
 * // Good - uses csrfFetch
 * csrfFetch('/api/tasks/save', { method: 'POST', ... })
 *
 * // Exempt - has bypass comment
 * // eslint-disable-next-line no-raw-fetch-api -- GET request, no CSRF needed
 * fetch('/api/data')
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow direct fetch() calls to /api/* routes; use csrfFetch() instead',
      category: 'Security',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      useCSRFFetch: 'Direct fetch() to API routes should use csrfFetch() for CSRF protection. Import from "@/hooks/useCsrfFetch".',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        // Check if this is a fetch() call
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'fetch') {
          return;
        }

        // Get the first argument (URL)
        const urlArg = node.arguments[0];
        if (!urlArg) return;

        let urlValue = null;

        // Handle string literal: fetch('/api/...')
        if (urlArg.type === 'Literal' && typeof urlArg.value === 'string') {
          urlValue = urlArg.value;
        }
        // Handle template literal: fetch(`/api/...`)
        else if (urlArg.type === 'TemplateLiteral') {
          // Get the first quasi (static part before any ${})
          const firstQuasi = urlArg.quasis[0];
          if (firstQuasi && firstQuasi.value && firstQuasi.value.raw) {
            urlValue = firstQuasi.value.raw;
          }
        }

        // Check if URL starts with /api/
        if (urlValue && urlValue.startsWith('/api/')) {
          context.report({
            node,
            messageId: 'useCSRFFetch',
            fix(fixer) {
              // Auto-fix: replace 'fetch' with 'csrfFetch'
              return fixer.replaceText(node.callee, 'csrfFetch');
            },
          });
        }
      },
    };
  },
};
