-- Hand-authored local candidate. This is not a deployable migration.
BEGIN;
DO $$
BEGIN
  IF pg_catalog.current_database() <> 'saga_notification_rehearsal'
     OR pg_catalog.current_setting('saga.notification_rehearsal', true)
        IS DISTINCT FROM 'only_synthetic_local' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'local notification rehearsal only';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR $1 IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'notification access denied';
  END IF;
  RETURN (
    SELECT pg_catalog.count(*)::integer
    FROM public.notifications AS notification
    WHERE notification.recipient_id = $1 AND notification.is_read = false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_as_read(
  user_id uuid,
  notification_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected integer;
BEGIN
  IF auth.uid() IS NULL OR $1 IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'notification access denied';
  END IF;
  UPDATE public.notifications AS notification
  SET is_read = true,
      read_at = COALESCE(notification.read_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE notification.recipient_id = $1
    AND notification.is_read = false
    AND ($2 IS NULL OR notification.id = ANY ($2));
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count(uuid)
  FROM PUBLIC, anon, metadata_reader, service_role;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_as_read(uuid, uuid[])
  FROM PUBLIC, anon, metadata_reader, service_role;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_as_read(uuid, uuid[]) TO authenticated;
COMMIT;
