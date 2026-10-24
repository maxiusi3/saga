-- Public schema materialized from the pinned, reviewed metadata. Synthetic identity/ACL environment.
CREATE ROLE fixture_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE anon LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE authenticated LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE metadata_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE service_role LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, metadata_reader, service_role;
GRANT USAGE, CREATE ON SCHEMA public TO fixture_owner;
CREATE SCHEMA auth AUTHORIZATION fixture_owner;
CREATE SCHEMA extensions AUTHORIZATION fixture_owner;
SET ROLE fixture_owner;
SET search_path=pg_catalog,public,auth,extensions;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;
-- Disclosed local UUID shim; this is not the original uuid-ossp extension.
CREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql VOLATILE SET search_path = '' AS $$ SELECT pg_catalog.gen_random_uuid() $$;
CREATE TABLE public."projects" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "facilitator_id" uuid NOT NULL,
  "status" text DEFAULT 'active'::text,
  "settings" jsonb DEFAULT '{}'::jsonb,
  "subscription_mode" text DEFAULT 'interactive'::text,
  "subscription_expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "owner_id" uuid,
  "storyteller_id" uuid,
  "title" text,
  "invitation_token" text,
  "invitation_expires_at" timestamp with time zone,
  "payment_status" text NOT NULL DEFAULT 'paid'::text
);
CREATE TABLE public."project_roles" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "role" text NOT NULL,
  "status" text DEFAULT 'active'::text,
  "invited_by" uuid,
  "joined_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."project_members" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" character varying(20) NOT NULL,
  "status" character varying(20) DEFAULT 'active'::character varying,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."user_resource_wallets" (
  "user_id" uuid NOT NULL,
  "project_vouchers" integer DEFAULT 0,
  "facilitator_seats" integer DEFAULT 0,
  "storyteller_seats" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "last_payment_reference" text
);
CREATE TABLE public."seat_transactions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "transaction_type" text NOT NULL,
  "resource_type" text NOT NULL,
  "amount" integer NOT NULL,
  "project_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."notifications" (
  "id" uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "recipient_id" uuid NOT NULL,
  "sender_id" uuid,
  "type" character varying(50) NOT NULL,
  "title" character varying(255) NOT NULL,
  "message" text NOT NULL,
  "data" jsonb,
  "action_url" character varying(500),
  "is_read" boolean DEFAULT false,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."export_requests" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" text DEFAULT 'pending'::text,
  "progress" integer DEFAULT 0,
  "options" jsonb DEFAULT '{}'::jsonb,
  "download_url" text,
  "file_size_bytes" bigint,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "completed_at" timestamp with time zone
);
ALTER TABLE public."export_requests" ADD CONSTRAINT "export_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."project_members" ADD CONSTRAINT "project_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."project_members" ADD CONSTRAINT "project_members_project_id_user_id_key" UNIQUE (project_id, user_id);
ALTER TABLE public."project_roles" ADD CONSTRAINT "project_roles_pkey" PRIMARY KEY (id);
ALTER TABLE public."project_roles" ADD CONSTRAINT "project_roles_user_id_project_id_role_key" UNIQUE (user_id, project_id, role);
ALTER TABLE public."projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY (id);
ALTER TABLE public."seat_transactions" ADD CONSTRAINT "seat_transactions_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_resource_wallets" ADD CONSTRAINT "user_resource_wallets_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."export_requests" ADD CONSTRAINT "export_requests_progress_check" CHECK (((progress >= 0) AND (progress <= 100)));
ALTER TABLE public."export_requests" ADD CONSTRAINT "export_requests_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public."export_requests" ADD CONSTRAINT "export_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE public."export_requests" ADD CONSTRAINT "export_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_type_check" CHECK (((type)::text = ANY ((ARRAY['new_story'::character varying, 'new_comment'::character varying, 'new_follow_up_question'::character varying, 'story_response'::character varying, 'project_invitation'::character varying, 'member_joined'::character varying, 'chapter_completed'::character varying, 'export_ready'::character varying])::text[])));
ALTER TABLE public."project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public."project_members" ADD CONSTRAINT "project_members_role_check" CHECK (((role)::text = ANY ((ARRAY['facilitator'::character varying, 'storyteller'::character varying])::text[])));
ALTER TABLE public."project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."project_roles" ADD CONSTRAINT "project_roles_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id);
ALTER TABLE public."project_roles" ADD CONSTRAINT "project_roles_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public."project_roles" ADD CONSTRAINT "project_roles_role_check" CHECK ((role = ANY (ARRAY['facilitator'::text, 'storyteller'::text])));
ALTER TABLE public."project_roles" ADD CONSTRAINT "project_roles_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text])));
ALTER TABLE public."project_roles" ADD CONSTRAINT "project_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."projects" ADD CONSTRAINT "projects_facilitator_id_fkey" FOREIGN KEY (facilitator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."projects" ADD CONSTRAINT "projects_subscription_mode_check" CHECK ((subscription_mode = ANY (ARRAY['interactive'::text, 'archive'::text])));
ALTER TABLE public."seat_transactions" ADD CONSTRAINT "seat_transactions_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE public."seat_transactions" ADD CONSTRAINT "seat_transactions_resource_type_check" CHECK ((resource_type = ANY (ARRAY['project_voucher'::text, 'facilitator_seat'::text, 'storyteller_seat'::text, 'package'::text])));
ALTER TABLE public."seat_transactions" ADD CONSTRAINT "seat_transactions_transaction_type_check" CHECK ((transaction_type = ANY (ARRAY['purchase'::text, 'consume'::text, 'reserve'::text, 'release'::text, 'activate'::text])));
ALTER TABLE public."seat_transactions" ADD CONSTRAINT "seat_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."user_resource_wallets" ADD CONSTRAINT "user_resource_wallets_facilitator_seats_check" CHECK ((facilitator_seats >= 0));
ALTER TABLE public."user_resource_wallets" ADD CONSTRAINT "user_resource_wallets_project_vouchers_check" CHECK ((project_vouchers >= 0));
ALTER TABLE public."user_resource_wallets" ADD CONSTRAINT "user_resource_wallets_storyteller_seats_check" CHECK ((storyteller_seats >= 0));
ALTER TABLE public."user_resource_wallets" ADD CONSTRAINT "user_resource_wallets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_export_requests_created_at ON public.export_requests USING btree (created_at);
CREATE INDEX idx_export_requests_project ON public.export_requests USING btree (project_id);
CREATE INDEX idx_export_requests_status ON public.export_requests USING btree (status);
CREATE INDEX idx_export_requests_user ON public.export_requests USING btree (user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);
CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);
CREATE INDEX idx_notifications_recipient_id ON public.notifications USING btree (recipient_id);
CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);
CREATE INDEX idx_project_roles_project ON public.project_roles USING btree (project_id);
CREATE INDEX idx_project_roles_role ON public.project_roles USING btree (role);
CREATE INDEX idx_project_roles_status ON public.project_roles USING btree (status);
CREATE INDEX idx_project_roles_user ON public.project_roles USING btree (user_id);
CREATE UNIQUE INDEX project_roles_project_user_unique ON public.project_roles USING btree (project_id, user_id);
CREATE INDEX project_roles_user_id_idx ON public.project_roles USING btree (user_id);
CREATE UNIQUE INDEX uq_project_roles_project_user ON public.project_roles USING btree (project_id, user_id);
CREATE INDEX idx_projects_created_at ON public.projects USING btree (created_at);
CREATE INDEX idx_projects_facilitator ON public.projects USING btree (facilitator_id);
CREATE INDEX idx_projects_status ON public.projects USING btree (status);
CREATE INDEX projects_facilitator_id_idx ON public.projects USING btree (facilitator_id);
CREATE INDEX idx_seat_transactions_created_at ON public.seat_transactions USING btree (created_at);
CREATE INDEX idx_seat_transactions_project ON public.seat_transactions USING btree (project_id);
CREATE INDEX idx_seat_transactions_resource ON public.seat_transactions USING btree (resource_type);
CREATE INDEX idx_seat_transactions_type ON public.seat_transactions USING btree (transaction_type);
CREATE INDEX idx_seat_transactions_user ON public.seat_transactions USING btree (user_id);
CREATE INDEX idx_wallet_payment_ref ON public.user_resource_wallets USING btree (last_payment_reference);
ALTER TABLE public."projects" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."projects" FROM PUBLIC, anon, authenticated, metadata_reader, service_role;
ALTER TABLE public."project_roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."project_roles" FROM PUBLIC, anon, authenticated, metadata_reader, service_role;
ALTER TABLE public."project_members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."project_members" FROM PUBLIC, anon, authenticated, metadata_reader, service_role;
ALTER TABLE public."user_resource_wallets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."user_resource_wallets" FROM PUBLIC, anon, authenticated, metadata_reader, service_role;
ALTER TABLE public."seat_transactions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."seat_transactions" FROM PUBLIC, anon, authenticated, metadata_reader, service_role;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."notifications" FROM PUBLIC, anon, authenticated, metadata_reader, service_role;
ALTER TABLE public."export_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."export_requests" FROM PUBLIC, anon, authenticated, metadata_reader, service_role;
RESET ROLE;
GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, metadata_reader, service_role;
