# Änderung besprechen (Vorschau)

Unten links liegt ein kleines Icon ohne Schrift. Erst ein Tipp öffnet ein
kurzes Feld. Die Karte bleibt bedienbar. Schließen lässt den Verlauf in diesem
Feld stehen.

Mitgeschickt wird der Name des offenen Steigs, sein OSM-Link und der
Kartenausschnitt, falls vorhanden. Familiennotizen und Bewertungen nicht.
Grok antwortet in dem Feld. Der Code ändert sich dadurch nicht.

Aufgerufen wird `grok-3` über `https://api.x.ai` mit `XAI_API_KEY` auf dem
Server. Der Schlüssel steht nicht im Browser.

Bewusst nur in `VERCEL_ENV=preview` sichtbar und erreichbar.

Neben einer Antwort liegt ein Lautsprecher. Der Browser schickt nur diesen
Antworttext an `/api/kletterglueck/tts`. Der Server entfernt Auszeichnung und
ruft ElevenLabs (`eleven_multilingual_v2`, Stimme Rachel) mit
`ELEVENLABS_API_KEY` auf. Der Schlüssel und die Stimmen-ID bleiben auf dem
Server. Zurück kommt eine MP3-Datei, die das Chatfenster abspielt. Auch dieser
Weg ist nur in der Vorschau erreichbar und verbraucht ElevenLabs-Guthaben.

## Daten und Grenzen

- Werkzeug `searchTours`: Namen, Stadt und ISO-Ländercode im öffentlichen
  OpenStreetMap-Klettersteig-Katalog, den die Karte bereits nutzt.
- Optional Metadaten der ersten 200 zentral gespeicherten Touren mit gültigem
  OSM-Verweis, sofern der bestehende Supabase-Tourenspeicher in der Vorschau
  konfiguriert ist. Quellenfehler werden im Chat angezeigt.
- Nur serverseitige Daten bestimmen die Kartenlinks. Werkzeugergebnisse sind
  Suchtreffer, nicht automatisch eine Rangliste oder bestätigte Empfehlung.
- Keine allgemeine Websuche oder Geocodierung. Eine Region muss im Tourennamen
  oder Ort vorkommen. Keine aktuellen Sperrungen/Wetterdaten und keine
  detaillierten Wegbeschreibungen; fehlende Angaben soll das Modell benennen.
- Nachrichten und ausgewählte Metadaten werden an Gateway/Modellanbieter
  übertragen. Keine Familiennotizen, Bewertungen, Profile oder GPX-Tracks.
  Der Browser speichert den Verlauf nur im React-Zustand, nicht dauerhaft.
  Minimieren und erneut öffnen erhält ihn; Neuladen oder „Neuer Chat“ löscht ihn
  im Browser, nicht etwaige Logs bei Gateway/Anbieter.

## Kosten und Schutz

KI-Anfragen verursachen nutzungsabhängige Kosten. Ein Projektbudget sollte vor
dem Test gesetzt sein; kein automatischer Guthabenkauf durch die Anwendung.
Das Budget ist die gemeinsame Gateway-Kostengrenze (keine atomare Cent-genaue
Sperre bei parallelen Anfragen). Das instanzlokale Limit von sechs Anfragen pro
Minute/IP ist nur zusätzliche Entlastung, kein verteilter Missbrauchsschutz.
Ein öffentliches Produktionsangebot braucht vor Freischaltung eine eigene
Zugangskontrolle und dauerhaftes Rate-Limiting.

Jede Anfrage erlaubt maximal 12 alternierende Nachrichten mit je 2000 Zeichen,
32 KB Request-Body, drei Modellschritte, 700 Ausgabetoken pro Schritt und
35 Sekunden Modelllaufzeit. Es werden höchstens fünf vorherige Austauschpaare
mitgesendet. Keine Systemrollen/Werkzeugaufrufe vom Browser akzeptiert.

## Prüfung

`yarn jest src/server/chat/__tests__/chat.test.ts src/components/TourChat --runInBand`
prüft Validierung, Vorschau- und Origin-Schutz, Drosselung, echte Quellenlinks,
Gesprächskontext, Datenminimierung, bereinigte Fehler und das nicht modale Feld
(zunächst eingeklappt, Vorschläge erst nach dem Tipp, Verlauf beim Minimieren,
Karte nicht blockiert). Zusätzlich in der PR-Vorschau die Tourenhilfe öffnen,
die Karte dabei verschieben, Region anfragen, Folgefrage stellen und einen
Kartenlink prüfen.
