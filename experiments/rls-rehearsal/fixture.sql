-- Reduced, synthetic schema only. Saved predicates are installed by the runner.
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
$$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1] $$;

CREATE TABLE public.projects (id uuid PRIMARY KEY, name text NOT NULL, facilitator_id uuid NOT NULL);
CREATE TABLE public.project_roles (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES public.projects(id), user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('facilitator','storyteller')),
  status text CHECK (status IN ('active','inactive','pending')), UNIQUE(project_id,user_id)
);
CREATE TABLE public.project_members (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES public.projects(id), user_id uuid NOT NULL, status text);
CREATE TABLE public.stories (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES public.projects(id), storyteller_id uuid NOT NULL,
  user_id uuid, title text NOT NULL, content text, images jsonb[], is_public boolean
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY, bucket_id text, name text, owner uuid, metadata jsonb, owner_id text,
  UNIQUE(bucket_id,name)
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, storage TO anon, authenticated;
