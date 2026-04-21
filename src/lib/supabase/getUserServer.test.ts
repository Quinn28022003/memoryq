import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserServer } from './getUserServer';
import { createClient } from './server';

vi.mock('./server', () => ({
  createClient: vi.fn(),
}));

describe('getUserServer', () => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockGetUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });

    (createClient as any).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    });
  });

  it('returns nulls if no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await getUserServer();
    expect(result).toEqual({ user: null, profile: null });
  });

  it('returns user and profile on success', async () => {
    const mockUser = { id: 'u1' };
    const mockProfile = { id: 'u1', role: 'admin' };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockMaybeSingle.mockResolvedValue({ data: mockProfile, error: null });

    const result = await getUserServer();
    expect(result).toEqual({ user: mockUser, profile: mockProfile, error: null });
  });

  it('returns user, null profile, and error on profile fetch fail', async () => {
    const mockUser = { id: 'u1' };
    const mockError = { message: 'Fail' };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: mockError });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getUserServer();
    expect(result).toEqual({ user: mockUser, profile: null, error: mockError });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
