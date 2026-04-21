import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserClient } from "./getUserClient";
import { createClient } from "./client";

vi.mock("./client", () => ({
    createClient: vi.fn()
}));

describe("getUserClient", () => {
    const mockFrom = vi.fn();
    const mockSelect = vi.fn();
    const mockEq = vi.fn();
    const mockSingle = vi.fn();
    const mockGetUser = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ single: mockSingle });

        (createClient as any).mockReturnValue({
            auth: { getUser: mockGetUser },
            from: mockFrom
        });
    });

    it("returns nulls if no user", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const result = await getUserClient();
        expect(result).toEqual({ user: null, profile: null });
    });

    it("returns nulls if auth error", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth error" } });
        const result = await getUserClient();
        expect(result).toEqual({ user: null, profile: null });
    });

    it("returns user and profile on success", async () => {
        const mockUser = { id: "u1" };
        const mockProfile = { id: "u1", role: "user" };

        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
        mockSingle.mockResolvedValue({ data: mockProfile, error: null });

        const result = await getUserClient();
        expect(result).toEqual({ user: mockUser, profile: mockProfile });
        expect(mockFrom).toHaveBeenCalledWith("profiles");
        expect(mockEq).toHaveBeenCalledWith("id", "u1");
    });

    it("returns user but null profile on profile fetch error", async () => {
        const mockUser = { id: "u1" };
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
        mockSingle.mockResolvedValue({ data: null, error: { message: "Profile error" } });

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const result = await getUserClient();
        expect(result).toEqual({ user: mockUser, profile: null });
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
