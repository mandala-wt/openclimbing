# Kletterglück – Norissteig: Übergabe an Work

## Ziel
Norissteig als erste Testtour mit echtem GPS-Track in der Karte darstellen. Keine Änderung am produktiven Raspberry-Pi-Container ohne gesonderte Freigabe.

## Bereits lokal verifiziert (6.11.2026)
- Quelle Tour: https://www.via-ferrata.de/klettersteige/topo/norissteig
- GPX-Datei: https://www.via-ferrata.de/wp-content/uploads/gpx/ralf-norissteig-new.gpx
- GPX: 1 Track, 1 Segment, 291 Trackpunkte, 0 Wegpunkte, 0 GPX-Routen
- Länge aus Trackpunkten (Haversine): ca. 3,52 km; größte Punktlücke ca. 61 m
- Anfang (lat,lon): 49.55174,11.52507; Ende: 49.551741,11.524927
- Schwierigkeit B/C, Dauer 3 Stunden, für Anfänger geeignet: Ja
- Startkoordinaten: 49.551756,11.525013
- Einstieg: 49.546417,11.523000
- Die vollständige Datei `norissteig.gpx` und eine konvertierte `norissteig.geojson` wurden im Chat vom Nutzer bereitgestellt/erzeugt, **aber sind noch nicht im Repository**.

## Umsetzung durch Work
1. Aktuellen Stand des Repos prüfen. Achtung: Projekt nutzt Next.js + MapLibre GL (nicht einfach Leaflet voraussetzen). Vorhandene Touren-/Track-Datenstruktur und Kartenlayer suchen.
2. GPX aus der vom Nutzer hochgeladenen Datei oder dem oben genannten Link übernehmen, wenn technisch zugänglich; GeoJSON [lon,lat] aus dem Track erzeugen. Die 291 Punkte nicht durch eine gerade Linie ersetzen.
3. Daten zunächst isoliert als Testtour integrieren; bestehende Marker, Filter und Layer erhalten. Norissteig nur einmal anzeigen, nicht doppelt.
4. Nur passende kleine Tests ausführen, PR erstellen, keine automatische Produktionsbereitstellung.
5. Prüfen, ob Track Zustieg/Klettersteig/Abstieg tatsächlich abdeckt. Der Track ist technisch plausibel, aber noch nicht geografisch/fachlich vollständig verifiziert.
6. Nutzungsrechte der externen GPX-Daten sind nicht abschließend geklärt. Keine generelle Freigabe behaupten; vor produktiver Übernahme klären.

## Raspberry-Pi-Kontext
- Container `klettersteig` mit Image `klettersteig-karte:pi`, Port `127.0.0.1:3005 -> 3000`.
- Keine Mounts, Container läuft aus Image. Projektkopien `/home/simon/openclimbing` (lokal Commit c6edb42) und `/home/simon/klettersteig` (lokal b4be261), beide remote `mandala-wt/openclimbing`.
- Keine manuelle Änderung am laufenden Container vorgenommen.

## Erfolgskriterien
- Norissteig zeigt sich als Testtour mit tatsächlicher 291-Punkte-Route.
- Details B/C, 3 h, Start und Einstieg nachvollziehbar.
- Kein Eingriff in andere Touren und keine unbeabsichtigte Veröffentlichung/Deployment.
