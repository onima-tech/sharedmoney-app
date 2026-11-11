-- Last-seen native app version for the #479 email update line (#485).
--
-- profiles is the wrong home: group co-members can SELECT those rows, and a
-- write would also bump profiles.updated_at. push_tokens is per device, is
-- service-role only, and does not exist for people who never registered for
-- push — the reminder email still has to reach them.
--
-- One row per user. The caller can write only their own row (RLS). The
-- monthly reminder job reads with the service role, which bypasses RLS.

CREATE TABLE public.user_last_seen_apps (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  app_version text NOT NULL,
  platform text,
  seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_last_seen_apps_app_version_semver CHECK (
    char_length(app_version) BETWEEN 5 AND 32
    AND app_version ~ '^\d+\.\d+\.\d+$'
  ),
  CONSTRAINT user_last_seen_apps_platform_known CHECK (
    platform IS NULL OR platform IN ('ios', 'android')
  )
);

COMMENT ON TABLE public.user_last_seen_apps IS
  'Last-seen native app version from X-App-Version, one row per user. Owner writes only. Service role reads this for monthly reminder emails.';

COMMENT ON COLUMN public.user_last_seen_apps.app_version IS
  'Parseable x.y.z from X-App-Version. Unparseable headers are not stored.';

COMMENT ON COLUMN public.user_last_seen_apps.platform IS
  'ios or android when the request or push registration said so. Null shows both store links.';

ALTER TABLE public.user_last_seen_apps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_last_seen_apps FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_last_seen_apps TO authenticated;
GRANT ALL ON TABLE public.user_last_seen_apps TO service_role;

CREATE POLICY "Users can view own last-seen app"
  ON public.user_last_seen_apps
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own last-seen app"
  ON public.user_last_seen_apps
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own last-seen app"
  ON public.user_last_seen_apps
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_last_seen_app(
  p_app_version text,
  p_platform text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version text := btrim(p_app_version);
  v_platform text := lower(btrim(coalesce(p_platform, '')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Authentication required';
  END IF;

  -- Missing or unparseable versions must not clear a version we already stored.
  IF v_version IS NULL
     OR char_length(v_version) < 5
     OR char_length(v_version) > 32
     OR v_version !~ '^\d+\.\d+\.\d+$' THEN
    RETURN;
  END IF;

  IF v_platform NOT IN ('ios', 'android') THEN
    v_platform := NULL;
  END IF;

  INSERT INTO public.user_last_seen_apps AS seen (
    user_id,
    app_version,
    platform,
    seen_at
  ) VALUES (
    v_user_id,
    v_version,
    v_platform,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET app_version = EXCLUDED.app_version,
        platform = COALESCE(EXCLUDED.platform, seen.platform),
        seen_at = now()
    WHERE seen.app_version IS DISTINCT FROM EXCLUDED.app_version
       OR (
         EXCLUDED.platform IS NOT NULL
         AND seen.platform IS DISTINCT FROM EXCLUDED.platform
       );
END;
$$;

COMMENT ON FUNCTION public.record_last_seen_app(text, text) IS
  'Upserts the caller''s last-seen app version. Ignores a missing or unparseable version. A null platform does not clear a known ios/android platform. Skips the write when nothing changed.';

REVOKE ALL ON FUNCTION public.record_last_seen_app(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_last_seen_app(text, text) TO authenticated;
