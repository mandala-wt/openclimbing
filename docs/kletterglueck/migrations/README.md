# Migrationen für den zentralen Tourenspeicher

Die Dateien werden **nicht** automatisch ausgeführt. Sie gehören in das
Supabase-Projekt des Tourenspeichers (siehe
[zentraler-tourenspeicher.md](../zentraler-tourenspeicher.md)).

## 2026-11-08: Zeitstempel und OSM-Index

[2026-11-08_tours_timestamps_osm_index.sql](2026-11-08_tours_timestamps_osm_index.sql)

- ergänzt `created_at` und `updated_at` (per Trigger gepflegt),
- legt einen Index auf `osm_ref` an, weil Detailansicht und
  Bewertungszusammenfassung danach suchen.

Die App funktioniert mit und ohne diese Migration; sie fragt die neuen Spalten
derzeit nicht ab. Die Zeitstempel dienen der Nachvollziehbarkeit im Speicher und
einer späteren Anzeige.

### Prüfen vor der Produktion

1. In Supabase einen Branch oder ein separates Testprojekt mit `tours.sql`,
   `ratings.sql` und einer Testtour anlegen.
2. Datei im SQL-Editor ausführen. Erwartung: `commit` ohne Fehler.
3. Kontrolle:
   ```sql
   select id, created_at, updated_at from public.kletterglueck_tours limit 5;
   update public.kletterglueck_tours set name = name where id = '<test-id>';
   select updated_at from public.kletterglueck_tours where id = '<test-id>';
   ```
   `updated_at` muss nach dem Update neuer sein.
4. `explain select id from public.kletterglueck_tours where osm_ref = 'way/1156787758';`
   sollte den Index `kletterglueck_tours_osm_ref` nennen (bei sehr wenigen
   Zeilen kann Postgres trotzdem einen Seq Scan wählen).
5. Erst danach im produktiven Projekt ausführen. Der Rückweg steht am Ende der
   SQL-Datei.
