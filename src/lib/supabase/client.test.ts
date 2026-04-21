import { describe, it, expect, vi } from "vitest";
import { createClient } from "./client";
import { createBrowserClient } from "@supabase/ssr";

vi.mock("@supabase/ssr", () => ({
    createBrowserClient: vi.fn()
}));

describe("client", () => {
    it("creates browser client with anon key", () => {
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

        createClient();

        expect(createBrowserClient).toHaveBeenCalledWith("https://test.supabase.co", "anon-key");

        vi.unstubAllEnvs();
    });
});
