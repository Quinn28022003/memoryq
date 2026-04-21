import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from './server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('server client', () => {
  const mockGetAll = vi.fn();
  const mockSet = vi.fn();
  const mockCookieStore = {
    getAll: mockGetAll,
    set: mockSet,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (cookies as any).mockResolvedValue(mockCookieStore);
    (createServerClient as any).mockReturnValue('mock-client');
  });

  it('creates client with cookie handlers', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'url');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'key');

    const client = await createClient();
    expect(client).toBe('mock-client');
    expect(createServerClient).toHaveBeenCalledWith('url', 'key', expect.any(Object));

    // Inspect cookie methods passed to createServerClient
    const cookieOptions = (createServerClient as any).mock.calls[0][2].cookies;

    // Test getAll
    mockGetAll.mockReturnValue([{ name: 'c', value: 'v' }]);
    expect(cookieOptions.getAll()).toEqual([{ name: 'c', value: 'v' }]);
    expect(mockGetAll).toHaveBeenCalled();

    // Test setAll
    cookieOptions.setAll([{ name: 'c', value: 'v', options: {} }]);
    expect(mockSet).toHaveBeenCalledWith('c', 'v', {});

    vi.unstubAllEnvs();
  });

  it('ignores setAll errors (server component limit)', async () => {
    await createClient();
    const cookieOptions = (createServerClient as any).mock.calls[0][2].cookies;

    mockSet.mockImplementation(() => {
      throw new Error('Server component cannot set cookies');
    });

    expect(() => {
      cookieOptions.setAll([{ name: 'c', value: 'v', options: {} }]);
    }).not.toThrow();
  });
});
