import { describe, it, expect, vi } from 'vitest';
import { createClient } from './cli';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('cli', () => {
  it('creates supabase client with service role key', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');

    createClient();

    expect(createSupabaseClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'service-role-key',
    );

    vi.unstubAllEnvs();
  });
});
