import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateSession } from "./middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

vi.mock("@supabase/ssr", () => ({
    createServerClient: vi.fn()
}));

vi.mock("next/server", () => {
    const nextResponseMock = {
        cookies: {
            set: vi.fn(),
            getAll: vi.fn(() => [])
        }
    };
    return {
        NextResponse: {
            next: vi.fn().mockReturnValue(nextResponseMock),
            json: vi.fn()
        }
    };
});

describe("middleware updateSession", () => {
    const mockRequest = {
        headers: new Headers(),
        nextUrl: { pathname: "/path" },
        cookies: {
            getAll: vi.fn(() => []),
            set: vi.fn()
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates client and sets up cookies", async () => {
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "url");
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "key");

        await updateSession(mockRequest as any);

        expect(createServerClient).toHaveBeenCalledWith("url", "key", expect.any(Object));
        const cookieOptions = (createServerClient as any).mock.calls[0][2].cookies;

        // Test getAll
        cookieOptions.getAll();
        expect(mockRequest.cookies.getAll).toHaveBeenCalled();

        // Test setAll
        const mockSetRespCookie = (NextResponse as any).next().cookies.set;
        cookieOptions.setAll([{ name: "c", value: "v", options: { httpOnly: true } }]);

        // Should call request.cookies.set AND response.cookies.set
        expect(mockRequest.cookies.set).toHaveBeenCalledWith("c", "v");
        expect(mockSetRespCookie).toHaveBeenCalledWith("c", "v", { httpOnly: true });

        vi.unstubAllEnvs();
    });
});
