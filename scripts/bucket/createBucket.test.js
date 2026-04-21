/* global describe, it, expect, vi, beforeAll, beforeEach, afterEach */

const { getBucketMock, createBucketMock } = vi.hoisted(() => {
  return {
    getBucketMock: vi.fn(),
    createBucketMock: vi.fn(),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      getBucket: getBucketMock,
      createBucket: createBucketMock,
    },
  })),
}));

let main;

describe('createBucket script', () => {
  let originalEnv;
  let consoleLogSpy;
  let consoleErrorSpy;
  let processExitSpy;

  beforeAll(() => {
    // Force mock into Node's require cache manually
    const mockSupabasePath = require.resolve('@supabase/supabase-js');
    require.cache[mockSupabasePath] = {
      id: mockSupabasePath,
      filename: mockSupabasePath,
      loaded: true,
      exports: {
        createClient: vi.fn(() => ({
          storage: {
            getBucket: getBucketMock,
            createBucket: createBucketMock,
          },
        })),
      },
    };

    // Now load the module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('./createBucket.js');
    main = module.main;
  });

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';
    process.env.SUPABASE_BUCKET_NAME = 'test-bucket';
    process.env.SUPABASE_PRIVATE_BUCKET_NAME = 'ct_private';

    getBucketMock.mockReset();
    createBucketMock.mockReset();

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should skip bucket creation if bucket already exists', async () => {
    getBucketMock.mockImplementation((name) => {
      return Promise.resolve({
        data: { id: name, name: name },
        error: null,
      });
    });

    await main();

    expect(getBucketMock).toHaveBeenCalledWith('test-bucket');
    expect(getBucketMock).toHaveBeenCalledWith('ct_private');
    expect(createBucketMock).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Bucket test-bucket already exists');
    expect(consoleLogSpy).toHaveBeenCalledWith('Bucket ct_private already exists');
  });

  it('should create bucket if it does not exist', async () => {
    getBucketMock.mockResolvedValue({
      data: null,
      error: { message: 'Bucket not found' },
    });

    createBucketMock.mockImplementation((name, options) => {
      return Promise.resolve({
        data: { id: name, name: name },
        error: null,
      });
    });

    await main();

    expect(getBucketMock).toHaveBeenCalledTimes(2);
    expect(createBucketMock).toHaveBeenCalledWith('test-bucket', { public: true });
    expect(createBucketMock).toHaveBeenCalledWith('ct_private', { public: false });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Bucket test-bucket created successfully (public: true)',
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Bucket ct_private created successfully (public: false)',
    );
  });

  it('should handle bucket creation errors', async () => {
    getBucketMock.mockResolvedValue({
      data: null,
      error: { message: 'Bucket not found' },
    });

    createBucketMock.mockResolvedValue({
      data: null,
      error: { message: 'Permission denied' },
    });

    await main();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error creating bucket test-bucket:',
      'Permission denied',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle getBucket errors other than "Bucket not found"', async () => {
    getBucketMock.mockResolvedValue({
      data: null,
      error: { message: 'Network error' },
    });

    await main();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error creating bucket test-bucket:',
      'Network error',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
