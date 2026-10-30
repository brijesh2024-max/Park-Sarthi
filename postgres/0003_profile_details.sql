-- Contact mobile numbers are private and are not SMS-verified identities.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_phone text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION public.parksarthi_sync_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $profile$
BEGIN
 INSERT INTO public.profiles (user_id,full_name,contact_phone)
 VALUES (
  NEW.id,
  left(coalesce(NEW.raw_user_meta_data ->> 'full_name',''),100),
  CASE WHEN jsonb_typeof(NEW.raw_user_meta_data->'contact_phone')='string' THEN left(NEW.raw_user_meta_data->>'contact_phone',24) ELSE '' END
 ) ON CONFLICT (user_id) DO UPDATE SET
  full_name=excluded.full_name,contact_phone=excluded.contact_phone,updated_at=now();
 RETURN NEW;
END;
$profile$;
REVOKE ALL ON FUNCTION public.parksarthi_sync_profile() FROM PUBLIC,anon,authenticated;
UPDATE public.profiles p SET
 contact_phone=CASE WHEN jsonb_typeof(u.raw_user_meta_data->'contact_phone')='string' THEN left(u.raw_user_meta_data->>'contact_phone',24) ELSE '' END
FROM auth.users u WHERE u.id=p.user_id;
COMMIT;
