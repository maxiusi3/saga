-- Synthetic hostile ACL fixture. No source records are adopted or seeded.
BEGIN;
DO $$ BEGIN
 IF pg_catalog.current_database()<>'saga_pg17_rehearsal' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='local fixture only'; END IF;
END $$;
CREATE ROLE entitlement_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE SCHEMA entitlement_candidate AUTHORIZATION fixture_owner;
GRANT USAGE ON SCHEMA entitlement_candidate TO entitlement_writer;
GRANT USAGE ON SCHEMA public,auth TO entitlement_writer;
-- Deliberate pre-install weaknesses exercise both table and column revocation.
GRANT ALL ON public.projects,public.project_roles,public.project_members,public.user_resource_wallets,public.seat_transactions,public.invitations TO PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer;
GRANT INSERT(storyteller_seats,user_id),UPDATE(storyteller_seats),SELECT(storyteller_seats,user_id),REFERENCES(user_id) ON public.user_resource_wallets TO PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer;
CREATE POLICY synthetic_wallet_acl_probe ON public.user_resource_wallets FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC,anon,authenticated,service_role,metadata_reader,entitlement_writer;
COMMIT;
