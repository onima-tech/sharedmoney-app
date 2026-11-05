-- #419 WhatsApp monthly balance reminders.
-- 1. Owner-only reminder opt-in (separate table: profiles rows are readable by
--    group co-members, opt-in must not be).
-- 2. Reminders share the WhatsApp monthly INR ledger with OTP sign-in.
--    OTP keeps priority: reminder reservations refuse once remaining budget
--    would fall below p_reserve_inr. OTP reserve still sums ALL purposes.
-- 3. Monthly pg_cron job (1st of month, 10:00 IST). It only fires when Vault
--    secrets whatsapp_reminders_function_url + monthly_reminders_cron_secret
--    exist, and the edge function is a no-op unless
--    ENABLE_WHATSAPP_MONTHLY_REMINDERS=true (default off).

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_reminder_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  opt_in boolean NOT NULL DEFAULT false,
  opted_in_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_reminder_prefs IS
  'Per-user opt-in for monthly WhatsApp balance reminders. Owner-only via RLS.';

ALTER TABLE public.whatsapp_reminder_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own WhatsApp reminder prefs" ON public.whatsapp_reminder_prefs;
CREATE POLICY "Users can view own WhatsApp reminder prefs"
  ON public.whatsapp_reminder_prefs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own WhatsApp reminder prefs" ON public.whatsapp_reminder_prefs;
CREATE POLICY "Users can insert own WhatsApp reminder prefs"
  ON public.whatsapp_reminder_prefs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own WhatsApp reminder prefs" ON public.whatsapp_reminder_prefs;
CREATE POLICY "Users can update own WhatsApp reminder prefs"
  ON public.whatsapp_reminder_prefs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.whatsapp_reminder_prefs FROM PUBLIC;
REVOKE ALL ON TABLE public.whatsapp_reminder_prefs FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.whatsapp_reminder_prefs TO authenticated;
GRANT ALL ON TABLE public.whatsapp_reminder_prefs TO service_role;
GRANT ALL ON TABLE public.whatsapp_reminder_prefs TO postgres;

-- Shared ledger: tag each row with its purpose.
ALTER TABLE public.whatsapp_otp_sends
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'otp',
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period_key text;

ALTER TABLE public.whatsapp_otp_sends
  DROP CONSTRAINT IF EXISTS whatsapp_otp_sends_purpose_check;
ALTER TABLE public.whatsapp_otp_sends
  ADD CONSTRAINT whatsapp_otp_sends_purpose_check
  CHECK (purpose IN ('otp', 'reminder'));

-- One reminder per user per period (failed rows do not count).
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_reminder_user_period
  ON public.whatsapp_otp_sends (user_id, period_key)
  WHERE purpose = 'reminder' AND status <> 'failed';

-- OTP phone/IP limits only count OTP rows; the budget sum still counts all.
CREATE OR REPLACE FUNCTION public.reserve_whatsapp_otp_send(
  p_phone_e164 text,
  p_country_code text,
  p_ip_hash text,
  p_est_cost_inr numeric,
  p_budget_inr numeric,
  p_cooldown_seconds integer DEFAULT 60,
  p_max_sends_per_hour integer DEFAULT 5,
  p_max_sends_per_ip_hour integer DEFAULT 10
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_budget_month text;
  v_spent numeric(12, 4);
  v_latest_created timestamptz;
  v_phone_hourly integer;
  v_ip_hourly integer;
  v_wait_sec integer;
  v_id uuid;
BEGIN
  IF p_phone_e164 IS NULL OR p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'VALIDATION:invalid_phone';
  END IF;
  IF p_country_code IS NULL OR p_country_code !~ '^[0-9]{1,4}$' THEN
    RAISE EXCEPTION 'VALIDATION:invalid_country';
  END IF;
  IF p_est_cost_inr IS NULL OR p_est_cost_inr < 0 OR p_budget_inr IS NULL OR p_budget_inr < 0 THEN
    RAISE EXCEPTION 'WHATSAPP_BUDGET_EXHAUSTED';
  END IF;
  IF p_cooldown_seconds IS NULL OR p_cooldown_seconds < 0
     OR p_max_sends_per_hour IS NULL OR p_max_sends_per_hour < 0
     OR p_max_sends_per_ip_hour IS NULL OR p_max_sends_per_ip_hour < 0 THEN
    RAISE EXCEPTION 'WHATSAPP_BUDGET_EXHAUSTED';
  END IF;

  -- Serialize all OTP send reservations (low volume; fail-closed budget).
  PERFORM pg_advisory_xact_lock(87201401);

  v_budget_month := to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM');

  SELECT COALESCE(SUM(s.est_cost_inr), 0)
    INTO v_spent
  FROM public.whatsapp_otp_sends s
  WHERE s.budget_month = v_budget_month
    AND s.status <> 'failed';

  IF v_spent + p_est_cost_inr > p_budget_inr THEN
    RAISE EXCEPTION 'WHATSAPP_BUDGET_EXHAUSTED';
  END IF;

  -- Phone cooldown/hourly must read this ledger under the lock (challenge rows
  -- are inserted after the transaction commits and are not race-safe here).
  SELECT s.created_at
    INTO v_latest_created
  FROM public.whatsapp_otp_sends s
  WHERE s.phone_e164 = p_phone_e164
    AND s.purpose = 'otp'
    AND s.status <> 'failed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_latest_created IS NOT NULL
     AND v_latest_created > now() - make_interval(secs => p_cooldown_seconds) THEN
    v_wait_sec := CEIL(
      EXTRACT(EPOCH FROM (v_latest_created + make_interval(secs => p_cooldown_seconds) - now()))
    )::integer;
    IF v_wait_sec < 1 THEN
      v_wait_sec := 1;
    END IF;
    RAISE EXCEPTION 'RATE_LIMITED:cooldown:%', v_wait_sec;
  END IF;

  SELECT COUNT(*)::integer
    INTO v_phone_hourly
  FROM public.whatsapp_otp_sends s
  WHERE s.phone_e164 = p_phone_e164
    AND s.purpose = 'otp'
    AND s.status <> 'failed'
    AND s.created_at >= now() - interval '1 hour';

  IF v_phone_hourly >= p_max_sends_per_hour THEN
    RAISE EXCEPTION 'RATE_LIMITED:hourly';
  END IF;

  IF p_ip_hash IS NOT NULL AND length(p_ip_hash) > 0 THEN
    SELECT COUNT(*)::integer
      INTO v_ip_hourly
    FROM public.whatsapp_otp_sends s
    WHERE s.ip_hash = p_ip_hash
      AND s.purpose = 'otp'
      AND s.created_at >= now() - interval '1 hour';

    IF v_ip_hourly >= p_max_sends_per_ip_hour THEN
      RAISE EXCEPTION 'RATE_LIMITED:ip_hourly';
    END IF;
  END IF;

  INSERT INTO public.whatsapp_otp_sends (
    phone_e164,
    country_code,
    ip_hash,
    est_cost_inr,
    status,
    budget_month
  ) VALUES (
    p_phone_e164,
    p_country_code,
    NULLIF(p_ip_hash, ''),
    p_est_cost_inr,
    'reserved',
    v_budget_month
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


/**
 * Reserve one monthly reminder send against the shared IST monthly budget,
 * keeping p_reserve_inr free for OTP sign-in.
 *   WHATSAPP_REMINDER_BUDGET_RESERVE  remaining budget too low
 *   WHATSAPP_REMINDER_DUPLICATE       already reserved/sent for this period
 */
CREATE OR REPLACE FUNCTION public.reserve_whatsapp_reminder_send(
  p_user_id uuid,
  p_phone_e164 text,
  p_period_key text,
  p_est_cost_inr numeric,
  p_budget_inr numeric,
  p_reserve_inr numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_budget_month text;
  v_spent numeric(12, 4);
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION:invalid_user';
  END IF;
  IF p_phone_e164 IS NULL OR p_phone_e164 !~ '^\+91[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'VALIDATION:invalid_phone';
  END IF;
  IF p_period_key IS NULL OR p_period_key !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'VALIDATION:invalid_period';
  END IF;
  IF p_est_cost_inr IS NULL OR p_est_cost_inr <= 0
     OR p_budget_inr IS NULL OR p_budget_inr <= 0
     OR p_reserve_inr IS NULL OR p_reserve_inr < 0 THEN
    RAISE EXCEPTION 'WHATSAPP_REMINDER_BUDGET_RESERVE';
  END IF;

  -- Same lock as OTP so the shared budget is race-safe.
  PERFORM pg_advisory_xact_lock(87201401);

  v_budget_month := to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM');

  SELECT COALESCE(SUM(s.est_cost_inr), 0)
    INTO v_spent
  FROM public.whatsapp_otp_sends s
  WHERE s.budget_month = v_budget_month
    AND s.status <> 'failed';

  IF v_spent + p_est_cost_inr > p_budget_inr - p_reserve_inr THEN
    RAISE EXCEPTION 'WHATSAPP_REMINDER_BUDGET_RESERVE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.whatsapp_otp_sends s
    WHERE s.purpose = 'reminder'
      AND s.user_id = p_user_id
      AND s.period_key = p_period_key
      AND s.status <> 'failed'
  ) THEN
    RAISE EXCEPTION 'WHATSAPP_REMINDER_DUPLICATE';
  END IF;

  INSERT INTO public.whatsapp_otp_sends (
    phone_e164, country_code, ip_hash, est_cost_inr, status, budget_month,
    purpose, user_id, period_key
  ) VALUES (
    p_phone_e164, '91', NULL, p_est_cost_inr, 'reserved', v_budget_month,
    'reminder', p_user_id, p_period_key
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_whatsapp_reminder_send(
  uuid, text, text, numeric, numeric, numeric
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_whatsapp_reminder_send(
  uuid, text, text, numeric, numeric, numeric
) TO service_role;

COMMIT;

-- Monthly schedule: 04:30 UTC on the 1st = 10:00 IST.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
  THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'whatsapp-monthly-reminders';

    PERFORM cron.schedule(
      'whatsapp-monthly-reminders',
      '30 4 1 * *',
      $cron$
        WITH cfg AS (
          SELECT
            MAX(decrypted_secret) FILTER (WHERE name = 'whatsapp_reminders_function_url') AS function_url,
            MAX(decrypted_secret) FILTER (WHERE name = 'monthly_reminders_cron_secret') AS cron_secret
          FROM vault.decrypted_secrets
        )
        SELECT CASE
          WHEN function_url IS NOT NULL AND cron_secret IS NOT NULL THEN
            net.http_post(
              url := function_url,
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-reminder-cron-secret', cron_secret
              ),
              body := jsonb_build_object('scheduled_at', NOW()),
              timeout_milliseconds := 120000
            )
          ELSE NULL
        END AS request_id
        FROM cfg;
      $cron$
    );
  END IF;
END
$$;
