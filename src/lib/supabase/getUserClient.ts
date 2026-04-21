import { createClient } from '@/lib/supabase/client';

export async function getUserClient() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, profile: null };
  }

  // Get profile information
  const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return { user, profile: null };
  }

  return { user, profile };
}
