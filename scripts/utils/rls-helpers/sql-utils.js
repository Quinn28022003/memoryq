/**
 * SQL Generation Utilities
 *
 * Helper functions for generating PL/pgSQL function definitions
 */

/**
 * Create a standard PL/pgSQL function header
 * @param {string} name - Function name
 * @param {string[]} params - Array of parameter definitions (e.g., ['p_org_id UUID', 'p_name TEXT'])
 * @param {string} returnType - Return type (e.g., 'BOOLEAN', 'TABLE(...)')
 * @returns {string} SQL function header
 */
function createFunctionHeader(name, params, returnType) {
  const paramList = params.length > 0 ? `\n  ${params.join(',\n  ')}\n` : '';
  return `CREATE OR REPLACE FUNCTION public.${name}(${paramList})
RETURNS ${returnType} AS $$`;
}

/**
 * Create function footer with language and security settings
 * @returns {string} SQL function footer
 */
function createFunctionFooter() {
  return `$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;`;
}

/**
 * Create a section comment header
 * @param {string} title - Section title
 * @returns {string} SQL comment block
 */
function createSectionHeader(title) {
  return `
-- ================================================
-- ${title}
-- ================================================`;
}

module.exports = {
  createFunctionHeader,
  createFunctionFooter,
  createSectionHeader,
};
