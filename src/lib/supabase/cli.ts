import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const createClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
        throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required");
    }

    if (!serviceRoleKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
    }

    return createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};
