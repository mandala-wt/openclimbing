# Unterwegs ohne Netz

Gespeichert wird nur, was schon da ist: Name, Lage, Schwierigkeits-Merkmale,
`description` aus OpenStreetMap, vorhandene Linien und ein in diesem Tab
geladener Norissteig-Pilottrack. Kartenkacheln werden nicht heruntergeladen.
MapTiler, der OpenStreetMap-Kachelserver, Thunderforest, Bing und die übrigen
Basiskarten erlauben das nicht. Die Unterwegs-Ansicht zeichnet deshalb nur die
gespeicherte Linie.

Die Daten liegen in IndexedDB (`kletterglueck-offline`), höchstens 24 Touren
und 8 MB. Jede Tour zeigt Speicherzeitpunkt und OSM-Zeitstempel. Der
Service Worker `public/kletterglueck-sw.js` hält nur die eigene Oberfläche,
höchstens 80 Antworten, und keine `/api`- oder Kachel-Antworten. Die Karte
richtet ihn in der echten Installation ein. Die Unterwegs-Seite tut das
ebenfalls, außer auf dem lokalen Entwicklungsrechner.

Standort, Bildschirm-Wachhalten und Teilen laufen nur in der Unterwegs- oder
Notfallansicht (`/unterwegs.html`). 112 ist der Europa-Notruf. Die App macht
keine Aussage zu Wetter, Sperrung oder Begehbarkeit.
