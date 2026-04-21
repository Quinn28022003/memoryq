import { describe, it, expect } from 'vitest';
import { generateDropStatements, HELPER_FUNCTION_SIGNATURES } from './drop-statements';

describe('drop-statements', () => {
  describe('generateDropStatements', () => {
    it('should generate drop statements for all signatures', () => {
      const result = generateDropStatements();
      HELPER_FUNCTION_SIGNATURES.forEach((sig) => {
        expect(result).toContain(`DROP FUNCTION IF EXISTS ${sig} CASCADE;`);
      });
    });

    it('should include user_has_permission signatures', () => {
      const result = generateDropStatements();
      expect(result).toContain(
        'DROP FUNCTION IF EXISTS public.user_has_permission(UUID, UUID, TEXT) CASCADE;',
      );
      expect(result).toContain(
        'DROP FUNCTION IF EXISTS public.user_has_permission(UUID, UUID, UUID, TEXT) CASCADE;',
      );
    });
  });
});
