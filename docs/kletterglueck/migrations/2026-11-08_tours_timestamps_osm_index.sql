-- Kletterglück: Zeitstempel und OSM-Index für den zentralen Tourenspeicher
--
-- Voraussetzung: tours.sql (und ggf. ratings.sql) wurden bereits ausgeführt.
-- Nicht automatisch ausgeführt. Zuerst in einem Test- oder Vorschauprojekt
-- prüfen, siehe docs/kletterglueck/migrations/README.md.
--
-- Bestehende Zeilen erhalten als created_at den Zeitpunkt der Rechtebestätigung,
-- weil das der früheste bekannte Zeitpunkt der Tour ist. updated_at wird bei
-- jeder Änderung durch einen Trigger gesetzt.

begin;

alter table public.kletterglueck_tours
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.kletterglueck_tours
  set created_at = coalesce(created_at, rights_confirmed_at),
      updated_at = coalesce(updated_at, rights_confirmed_at);

alter table public.kletterglueck_tours
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function public.kletterglueck_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kletterglueck_tours_touch on public.kletterglueck_tours;
create trigger kletterglueck_tours_touch
  before update on public.kletterglueck_tours
  for each row execute function public.kletterglueck_touch_updated_at();

-- Detailansicht und Bewertungen fragen nach osm_ref.
create index if not exists kletterglueck_tours_osm_ref
  on public.kletterglueck_tours (osm_ref)
  where osm_ref is not null;

commit;

-- Rückweg (nur falls nötig, entfernt die Zeitstempel wieder):
-- begin;
-- drop trigger if exists kletterglueck_tours_touch on public.kletterglueck_tours;
-- drop function if exists public.kletterglueck_touch_updated_at();
-- drop index if exists public.kletterglueck_tours_osm_ref;
-- alter table public.kletterglueck_tours drop column if exists updated_at, drop column if exists created_at;
-- commit;
