-- Supabase-specific: apply after 0001_marketplace.sql in the SQL editor.
BEGIN;
CREATE TABLE IF NOT EXISTS public.profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Authentication remains in auth.users. Metadata can set a name, never a role.
CREATE OR REPLACE FUNCTION public.parksarthi_sync_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $profile$
BEGIN
 INSERT INTO public.profiles (user_id,full_name)
 VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data ->> 'full_name', ''), 100))
 ON CONFLICT (user_id) DO UPDATE
 SET full_name = excluded.full_name, updated_at = now();
 RETURN NEW;
END;
$profile$;
REVOKE ALL ON FUNCTION public.parksarthi_sync_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS parksarthi_profile_changed ON auth.users;
CREATE TRIGGER parksarthi_profile_changed AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.parksarthi_sync_profile();
INSERT INTO public.profiles (user_id,full_name)
 SELECT id,left(coalesce(raw_user_meta_data ->> 'full_name',''),100) FROM auth.users
 ON CONFLICT (user_id) DO NOTHING;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('parking-photos','parking-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
-- No storage.objects policy is added: browsers cannot access the private bucket.
-- The server's secret key writes/reads only after application authorization.
COMMIT;
