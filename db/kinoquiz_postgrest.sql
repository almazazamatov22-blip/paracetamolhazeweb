alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public,kinoquiz';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

grant usage on schema kinoquiz to anon, authenticated, service_role;
grant select on all tables in schema kinoquiz to anon, authenticated, service_role;
grant insert, update, delete on all tables in schema kinoquiz to service_role;
grant usage, select on all sequences in schema kinoquiz to service_role;

alter default privileges in schema kinoquiz
  grant select on tables to anon, authenticated, service_role;

alter default privileges in schema kinoquiz
  grant insert, update, delete on tables to service_role;

alter default privileges in schema kinoquiz
  grant usage, select on sequences to service_role;

