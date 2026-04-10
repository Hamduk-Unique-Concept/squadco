alter table public.organizations
  add column if not exists country text,
  add column if not exists created_via text not null default 'admin';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_created_via_check'
  ) then
    alter table public.organizations
      add constraint organizations_created_via_check
      check (created_via in ('admin', 'self_serve'));
  end if;
end $$;

create index if not exists idx_organizations_created_via on public.organizations(created_via);
