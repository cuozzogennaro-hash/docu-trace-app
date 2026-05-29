
DROP POLICY IF EXISTS "Public read logos" ON storage.objects;

CREATE POLICY "Owners list own logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1]);
