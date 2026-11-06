# Kletterglück: persönliches Bewertungssystem (paralleler Arbeitsstrang)

**Status:** Implementierungsentwurf, **nicht** produktiv eingebaut. Separat vom laufenden Work-Auftrag zur zentralen Tourenspeicherung.

## Zielbild
- Jede Tour kann von Simon und seiner Mutter unabhängig mit **1 bis 5 Sternen** bewertet werden.
- Optional: `begangen`, Begehungsdatum, private Notiz.
- Detailansicht zeigt beide Einzelbewertungen (nur für Berechtigte) und Durchschnitt aus tatsächlich vergebenen Sternen; keine Null-Sterne als fehlende Bewertung zählen.
- Filter: begangen, nicht begangen, bewertet, unbewertet; später Sortierung nach Durchschnitt.
- Eine Person kann pro Tour genau eine Bewertung haben und diese ändern/löschen.
- Gemeinsamer Zugang ohne zusätzliche separate Konten ist ein Wunsch, **keine bestehende verifizierte Identitätslösung**. Sichere Zuordnung ist vor Freigabe zu klären.

## Architektur-Entscheidung für Work
1. **Bestehenden Touren-Datenspeicher prüfen**; keine parallele zweite Tourendatenbank einführen.
2. Touren durch **stabile interne Tour-ID** referenzieren; OSM-IDs oder Anzeigenamen allein nicht als Primärschlüssel verwenden.
3. Bewertungen getrennt von Tour-Stammdaten halten; keinen GPX-Track in Bewertungsdatensätzen speichern.
4. Keine öffentlich lesbaren Bewertungen/Notizen. Authentifizierung und serverseitige Berechtigungsprüfung vor produktiver Speicherung.
5. Gemeinsame Anmeldung ≠ identische Person: Nach Anmeldung persönliche Auswahl Simon/Mutter möglich, aber diese Auswahl allein ist **kein Zugriffsschutz**. Für Vertraulichkeit/Manipulationsschutz sichere Profile/Authentifizierung klären.
6. **Keine Secrets im Frontend** und keine frei zugänglichen Schreib-Endpunkte.

## Vorgeschlagenes Datenmodell (datenbankneutral)

`tour_ratings`
| Feld | Typ | Regel |
|---|---|---|
| tour_id | text/uuid | Fremdschlüssel zur internen Tour |
| profile_id | text/uuid | Fremdschlüssel zu einem privaten Nutzerprofil |
| stars | integer nullable | 1..5, NULL = noch nicht bewertet |
| visited | boolean | default false |
| visited_at | date nullable | optional |
| note | text nullable | max. z. B. 2000 Zeichen |
| created_at | timestamp | serverseitig |
| updated_at | timestamp | serverseitig |

Eindeutiger Schlüssel `(tour_id, profile_id)`. Die beiden Personen dürfen dieselbe Tour unabhängig bewerten.

## Berechnungen
- `average_rating = sum(stars) / count(stars)` für `stars IS NOT NULL`, sonst `null`.
- `rating_count = count(stars)` nur für vorhandene Sterne.
- Ein `visited = true` ohne Sternebewertung ist zulässig.
- Eine Bewertung ohne `visited = true` ist ebenfalls zulässig.
- Die Durchschnittsbewertung ist nur eine **private Familienwertung**, kein öffentlicher Community-Score.

## Akzeptanztests
1. Simon vergibt 4 Sterne, Mutter 5 → Durchschnitt 4,5, Anzahl 2.
2. Mutter noch ohne Sterne → Durchschnitt 4,0, Anzahl 1.
3. Simon setzt „begangen“, ohne Sterne → kein Einfluss auf Durchschnitt.
4. Zwei verschiedene Touren mit gleichem Namen vermischen ihre Bewertungen nicht.
5. Änderung von 4 auf 3 Sterne aktualisiert Durchschnitt ohne Dublette.
6. Unbefugte können Notizen weder lesen noch verändern.
7. Auf iPhone und iPad erscheinen dieselben Werte nach erneutem Laden.
8. Filter bewertet/unbewertet und begangen/nicht begangen funktionieren unabhängig.
9. Bestehende Norissteig-GPX-Funktion bleibt unverändert.

## Integration in die UI
Tour-Detailansicht: unter Tourinformationen kompakte Sterneanzeige mit 1–5 anklickbaren Sternen, Checkbox „Begangen“, optionales Datum und Notiz; darunter getrennte Bewertungen und Familienmittelwert. Bei Fehlern klare Meldung statt stillschweigender Speicherung.

## Grenzen / nächste Schritte
- Kein Datenbankanbieter festgelegt, solange Work die Bestandsprüfung noch durchführt.
- Keine Migration, keine API und kein UI-Code in diesem PR; er dokumentiert die gemeinsam nutzbare Schnittstelle, um Konflikte mit der laufenden Datenbankarbeit zu vermeiden.
- Sobald Work seinen zentralen Datenspeicher festgelegt hat, Bewertungsschema und API dort implementieren; auf separatem Branch testen und anschließend gezielt zusammenführen.
