-- Entirely synthetic. This is a reduced local test fixture, not a migration.
CREATE ROLE fixture_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE anon LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE authenticated LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE metadata_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE service_role LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, metadata_reader, service_role;
GRANT USAGE, CREATE ON SCHEMA public TO fixture_owner;
CREATE SCHEMA auth AUTHORIZATION fixture_owner;
CREATE SCHEMA rehearsal AUTHORIZATION fixture_owner;
SET ROLE fixture_owner;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE rehearsal.family_members (user_id uuid PRIMARY KEY REFERENCES auth.users(id), family_id uuid NOT NULL);
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY,
  recipient_id uuid NOT NULL REFERENCES auth.users(id),
  is_read boolean DEFAULT false,
  read_at timestamptz,
  updated_at timestamptz DEFAULT pg_catalog.now()
);
-- Test adapter only: it simulates a trusted PostgREST claim, not JWT verification.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_self_read ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY synthetic_self_update ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
-- No tested caller has table privileges. Routine EXECUTE remains a separate gate.
REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated, metadata_reader, service_role;
RESET ROLE;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, metadata_reader, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, metadata_reader, service_role;
