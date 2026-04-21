import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
        throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required");
    }

    if (!supabaseServiceKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined");
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}
