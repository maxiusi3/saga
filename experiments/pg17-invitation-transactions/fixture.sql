-- Pinned 2026-10-17 invitations metadata; synthetic local auth extension only.
BEGIN;
DO $$ BEGIN
 IF pg_catalog.current_database() <> 'saga_pg17_rehearsal' THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='local fixture only';
 END IF;
END $$;
SET ROLE fixture_owner;
SET search_path=pg_catalog,public;
ALTER TABLE auth.users ADD COLUMN email text, ADD COLUMN email_confirmed_at timestamptz;
CREATE TABLE public.invitations (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL,
 inviter_id uuid NOT NULL,
 invitee_email text NOT NULL,
 role text NOT NULL,
 status text DEFAULT 'pending'::text,
 token text NOT NULL,
 expires_at timestamp with time zone NOT NULL,
 accepted_at timestamp with time zone,
 created_at timestamp with time zone DEFAULT now(),
 updated_at timestamp with time zone DEFAULT now(),
 message text);
ALTER TABLE public.invitations ADD CONSTRAINT invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);
ALTER TABLE public.invitations ADD CONSTRAINT invitations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_role_check CHECK ((role = ANY (ARRAY['facilitator'::text, 'storyteller'::text])));
ALTER TABLE public.invitations ADD CONSTRAINT invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'expired'::text])));
ALTER TABLE public.invitations ADD CONSTRAINT invitations_token_key UNIQUE (token);
CREATE INDEX idx_invitations_email ON public.invitations USING btree (invitee_email);
CREATE INDEX idx_invitations_expires_at ON public.invitations USING btree (expires_at);
CREATE INDEX idx_invitations_inviter ON public.invitations USING btree (inviter_id);
CREATE INDEX idx_invitations_project ON public.invitations USING btree (project_id);
CREATE INDEX idx_invitations_status ON public.invitations USING btree (status);
CREATE INDEX idx_invitations_token ON public.invitations USING btree (token);
CREATE INDEX invitations_token_idx ON public.invitations USING btree (token);
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON public.invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitations,auth.users FROM PUBLIC,anon,authenticated,service_role,metadata_reader;
RESET ROLE;
COMMIT;
