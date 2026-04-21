-- Generated storage policies for bucket: ct_private
-- Generated: 2026-02-20T11:34:06.129Z

DROP POLICY IF EXISTS "Allow authenticated users to SELECT files from ct_private" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to INSERT files into ct_private" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to UPDATE files in ct_private" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to DELETE files from ct_private" ON storage.objects;

CREATE POLICY "Allow authenticated users to SELECT files from ct_private"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR
  (
    auth.uid() IS NOT NULL
    AND
    
  -- Ensure the object belongs to the target bucket
  bucket_id = 'ct_private'::text
  
  )
);

CREATE POLICY "Allow authenticated users to INSERT files into ct_private"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR
  (
    auth.uid() IS NOT NULL
    AND
    
  -- Ensure the object belongs to the target bucket
  bucket_id = 'ct_private'::text
  
  )
);

CREATE POLICY "Allow authenticated users to UPDATE files in ct_private"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR
  (
    auth.uid() IS NOT NULL
    AND
    
  -- Ensure the object belongs to the target bucket
  bucket_id = 'ct_private'::text
  
  )
)
WITH CHECK (
  public.is_super_admin()
  OR
  (
    auth.uid() IS NOT NULL
    AND
    
  -- Ensure the object belongs to the target bucket
  bucket_id = 'ct_private'::text
  
  )
);

CREATE POLICY "Allow authenticated users to DELETE files from ct_private"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR
  (
    auth.uid() IS NOT NULL
    AND
    
  -- Ensure the object belongs to the target bucket
  bucket_id = 'ct_private'::text
  
  )
);
