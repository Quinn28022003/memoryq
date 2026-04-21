import { describe, it, expect } from 'vitest';
import { createFunctionHeader, createFunctionFooter, createSectionHeader } from './sql-utils';

describe('sql-utils', () => {
  describe('createFunctionHeader', () => {
    it('should create a function header with no parameters', () => {
      const result = createFunctionHeader('my_func', [], 'BOOLEAN');
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.my_func()');
      expect(result).toContain('RETURNS BOOLEAN AS $$');
    });

    it('should create a function header with parameters', () => {
      const result = createFunctionHeader('my_func', ['p_id UUID', 'p_name TEXT'], 'VOID');
      expect(result).toContain('CREATE OR REPLACE FUNCTION public.my_func(');
      expect(result).toContain('p_id UUID');
      expect(result).toContain('p_name TEXT');
      expect(result).toContain('RETURNS VOID AS $$');
    });
  });

  describe('createFunctionFooter', () => {
    it('should return standard footer', () => {
      const result = createFunctionFooter();
      expect(result).toContain('$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;');
    });
  });

  describe('createSectionHeader', () => {
    it('should create a section header comment', () => {
      const result = createSectionHeader('My Section');
      expect(result).toContain('-- ================================================');
      expect(result).toContain('-- My Section');
      expect(result).toContain('-- ================================================');
    });
  });
});
