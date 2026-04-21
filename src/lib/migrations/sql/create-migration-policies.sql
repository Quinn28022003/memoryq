DROP POLICY IF EXISTS "Allow authenticated users to read migrations" ON public._migration;
CREATE POLICY "Allow authenticated users to read migrations"
  ON public._migration FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage migrations
DROP POLICY IF EXISTS "Allow service role to manage migrations" ON public._migration;
CREATE POLICY "Allow service role to manage migrations"
  ON public._migration FOR ALL
  TO service_role
  USING (true); 