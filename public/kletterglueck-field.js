/* global globalThis, document, navigator, indexedDB */
const EARTH_M = 6371008.8;
const DB_NAME = 'kletterglueck-offline';
const STORE = 'tours';
const CARDINALS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

const haversineMeters = (a, b) => {
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const dLambda = ((b.lon - a.lon) * Math.PI) / 180;
  const sine =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(sine)));
};

const initialBearingDegrees = (from, to) => {
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const dLambda = ((to.lon - from.lon) * Math.PI) / 180;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (Math.atan2(y, x) * 180) / Math.PI;
};

const normalizeBearing = (degrees) => ((degrees % 360) + 360) % 360;
const cardinalFromBearing = (degrees) =>
  CARDINALS[Math.round(normalizeBearing(degrees) / 45) % 8];

const distanceToSegmentMeters = (point, start, end) => {
  const meanLat = ((start.lat + end.lat) / 2) * (Math.PI / 180);
  const metersPerDegLat = 111132.92;
  const metersPerDegLon = 111412.84 * Math.cos(meanLat);
  const bx = (end.lon - start.lon) * metersPerDegLon;
  const by = (end.lat - start.lat) * metersPerDegLat;
  const px = (point.lon - start.lon) * metersPerDegLon;
  const py = (point.lat - start.lat) * metersPerDegLat;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return Math.hypot(px, py);
  const t = Math.min(1, Math.max(0, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
};

const distanceToTrackMeters = (point, track) => {
  if (!track || track.length === 0) return null;
  if (track.length === 1) return haversineMeters(point, track[0]);
  let best = Infinity;
  for (let index = 1; index < track.length; index += 1) {
    best = Math.min(
      best,
      distanceToSegmentMeters(point, track[index - 1], track[index]),
    );
  }
  return best;
};

const formatMeters = (meters) => {
  if (!Number.isFinite(meters) || meters < 0) return '–';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatAxis = (value, positive, negative) => {
  const hemisphere = value >= 0 ? positive : negative;
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(2);
  return `${degrees}° ${String(minutes).padStart(2, '0')}′ ${seconds.padStart(5, '0')}″ ${hemisphere}`;
};

const formatDecimal = (lat, lon) => `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
const formatDms = (lat, lon) =>
  `${formatAxis(lat, 'N', 'S')}, ${formatAxis(lon, 'O', 'W')}`;

const formatStamp = (value) => {
  if (!value) return 'Zeitpunkt unbekannt';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const finiteOrNull = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');

const openDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const allPacks = async () => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

const deletePack = async (id) => {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

const selectedPack = (state) =>
  state.packs.find((pack) => pack.id === state.tourId) || null;

const effectiveTheme = (state) => {
  if (state.theme === 'light' || state.theme === 'dark') return state.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const positionBlock = (state) => {
  if (state.locationError) {
    return `<p class="warn" role="status">${escapeHtml(state.locationError)}</p>`;
  }
  if (!state.fix) return '<p role="status">Standort wird ermittelt …</p>';
  const { fix } = state;
  const rows = [
    ['Dezimal', formatDecimal(fix.lat, fix.lon)],
    ['Grad, Minuten, Sekunden', formatDms(fix.lat, fix.lon)],
    [
      'Genauigkeit',
      fix.accuracy == null ? 'nicht geliefert' : `${Math.round(fix.accuracy)} m`,
    ],
    [
      'Höhe laut Ortung',
      fix.altitude == null
        ? 'nicht geliefert'
        : `${Math.round(fix.altitude)} m${
            fix.altitudeAccuracy == null
              ? ''
              : ` (± ${Math.round(fix.altitudeAccuracy)} m)`
          }`,
    ],
    [
      'Bewegungsrichtung laut Ortung',
      fix.heading == null ? 'nicht geliefert' : `${Math.round(fix.heading)}°`,
    ],
    ['Letzte Ortung', formatStamp(fix.timestamp)],
  ];
  return `<dl>${rows
    .map(
      ([label, value]) =>
        `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join('')}</dl>`;
};

const trackFacts = (state, pack) => {
  const track = pack.tracks[state.trackIndex] || null;
  if (!track || !state.fix) {
    return '<p>Entfernung und Richtung gibt es erst mit Standort und gespeicherter Linie.</p>';
  }
  const start = track.points[0];
  const end = track.points[track.points.length - 1];
  const along = distanceToTrackMeters(state.fix, track.points);
  let nearest = track.points[0];
  let nearestDistance = haversineMeters(state.fix, nearest);
  track.points.forEach((point) => {
    const distance = haversineMeters(state.fix, point);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  });
  const bearing =
    nearestDistance >= 1
      ? `${Math.round(normalizeBearing(initialBearingDegrees(state.fix, nearest)))}° ${cardinalFromBearing(initialBearingDegrees(state.fix, nearest))}. Berechnet aus den Koordinaten, kein Kompass.`
      : 'Du stehst am gespeicherten Punkt. Eine Richtung dazu gibt es nicht.';
  const elevation =
    typeof nearest.ele === 'number'
      ? `${Math.round(nearest.ele)} m am nächsten gespeicherten Punkt`
      : 'Die gespeicherten Punkte haben keine Höhe.';
  return `<dl>
    <div><dt>Entfernung zur Linie</dt><dd>${formatMeters(along)}</dd></div>
    <div><dt>Entfernung zum Start</dt><dd>${formatMeters(haversineMeters(state.fix, start))}</dd></div>
    <div><dt>Entfernung zum Ende</dt><dd>${formatMeters(haversineMeters(state.fix, end))}</dd></div>
    <div><dt>Richtung</dt><dd>${escapeHtml(bearing)}</dd></div>
    <div><dt>Höhe der Linie</dt><dd>${escapeHtml(elevation)}</dd></div>
  </dl>`;
};

const renderList = (state) => {
  const used = state.packs.reduce((sum, pack) => sum + (pack.bytes || 0), 0);
  const cards = state.packs
    .map((pack) => {
      const line = pack.tracks?.[0]
        ? `${pack.tracks.length} Linie(n), ${pack.tracks[0].points.length} Punkte`
        : 'Keine Linie gespeichert';
      return `<button class="card" data-open="${escapeHtml(pack.id)}">
        <strong>${escapeHtml(pack.nameFromOsm ? pack.name : 'Ohne OSM-Namen')}</strong>
        <span>${escapeHtml(pack.id)}</span>
        <span>${escapeHtml(line)}</span>
        <span>Gespeichert: ${escapeHtml(formatStamp(pack.savedAt))}</span>
      </button>`;
    })
    .join('');
  const browser =
    state.browserUsage == null
      ? ''
      : ` Browserschätzung für die ganze Seite: ${escapeHtml(formatBytes(state.browserUsage))}.`;
  return `<section>
    <h1>Für unterwegs</h1>
    <p>Gespeicherte Touren auf diesem Gerät. ${escapeHtml(formatBytes(used))} belegt${
      state.packs.length
        ? ` in ${state.packs.length} Tour${state.packs.length === 1 ? '' : 'en'}`
        : ''
    }.${browser}</p>
    ${
      state.packs.length
        ? cards
        : '<p class="warn">Noch keine Tour gespeichert. Das geht in der Karte bei einer geladenen Tour.</p>'
    }
  </section>`;
};

const renderTour = (state) => {
  const pack = selectedPack(state);
  if (!pack) {
    return `<section>
      <button class="ghost" data-action="list">Zurück</button>
      <h1>Nicht gespeichert</h1>
      <p class="warn">Diese Tour ist nicht für unterwegs gespeichert. Ohne Netz kann sie nicht geladen werden.</p>
    </section>`;
  }
  const difficulty = pack.difficulty?.length
    ? pack.difficulty.map((pair) => `${pair.key}: ${pair.value}`).join(' · ')
    : 'Keine Schwierigkeit in den gespeicherten OSM-Angaben.';
  const description = pack.description?.length
    ? pack.description
        .map(
          (pair) =>
            `<p><strong>${escapeHtml(pair.key)}</strong><br>${escapeHtml(pair.value)}</p>`,
        )
        .join('')
    : '<p>Keine Beschreibung in den gespeicherten OSM-Angaben.</p>';
  const track = pack.tracks[state.trackIndex];
  const switcher =
    pack.tracks.length > 1
      ? `<div class="row">${pack.tracks
          .map(
            (item, index) =>
              `<button class="${index === state.trackIndex ? '' : 'ghost'}" data-track="${index}">${escapeHtml(item.label)}</button>`,
          )
          .join('')}</div>`
      : '';
  const place =
    pack.lat == null ? '' : ` ${escapeHtml(formatDecimal(pack.lat, pack.lon))}`;
  return `<section>
    <button class="ghost" data-action="list">Alle Touren</button>
    <h1>${escapeHtml(pack.nameFromOsm ? pack.name : 'Ohne Namen in OpenStreetMap')}</h1>
    <p>${escapeHtml(pack.id)} · ${escapeHtml(difficulty)}</p>
    <p>Gespeichert am ${escapeHtml(formatStamp(pack.savedAt))}. OSM-Stand: ${escapeHtml(formatStamp(pack.osmTimestamp))}. Das ist nicht der Live-Stand.</p>
    <p>${escapeHtml(pack.locationSource || 'Keine Lage gespeichert.')}${place}</p>
    ${description}
    ${switcher}
    <p class="source">${track ? escapeHtml(track.source) : 'Keine Linie.'}</p>
    <canvas width="320" height="220" aria-label="Gespeicherte Linie ohne Kartenbild"></canvas>
    ${trackFacts(state, pack)}
    <p>${escapeHtml(pack.mapTilesNote || '')}</p>
    <p class="source">${escapeHtml(pack.attribution || '')}</p>
    <div class="row">
      <button data-action="delete">Diese Tour löschen</button>
      <button class="ghost" data-action="emergency">Notfall</button>
    </div>
  </section>`;
};

const renderEmergency = (state) => `<section>
  <button class="ghost" data-action="list">Zurück</button>
  <h1>Notfall</h1>
  ${positionBlock(state)}
  <div class="row">
    <button data-action="share" ${state.fix ? '' : 'disabled'}>Standort teilen</button>
    <button class="ghost" data-action="wake">${state.wake ? 'Bildschirm wieder freigeben' : 'Bildschirm an lassen'}</button>
  </div>
  <p role="status">${escapeHtml(state.wakeNote)}</p>
  <div class="notice">
    <p><strong>Notruf Europa: 112.</strong> Bergrettung in Österreich 140, in der Schweiz 1414. Welche Nummer vor Ort gilt, steht nicht in dieser App. Im Zweifel 112.</p>
    <p>Das ist keine Hilfeleistung und keine Garantie. Keine Aussage zu Wetter, Sperrungen oder dazu, ob ein Steig begehbar ist.</p>
  </div>
</section>`;

const projectPoint = (point, bounds, width, height, pad) => ({
  x: pad + ((point.lon - bounds.minLon) / bounds.spanLon) * (width - pad * 2),
  y:
    height -
    pad -
    ((point.lat - bounds.minLat) / bounds.spanLat) * (height - pad * 2),
});

const drawTrack = (canvas, state) => {
  const pack = selectedPack(state);
  if (!canvas || !pack) return;
  const track = pack.tracks[state.trackIndex];
  const context = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(width * ratio));
  canvas.height = Math.max(1, Math.floor(height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const dark = effectiveTheme(state) === 'dark';
  context.fillStyle = dark ? '#1b1916' : '#fffdf8';
  context.fillRect(0, 0, width, height);
  context.fillStyle = dark ? '#f6f1e7' : '#1c1915';
  context.font = '14px sans-serif';
  if (!track || track.points.length < 2) {
    context.fillText('Keine gespeicherte Linie.', 16, 32);
    return;
  }
  const points = track.points.slice();
  if (state.fix) points.push(state.fix);
  const lons = points.map((point) => point.lon);
  const lats = points.map((point) => point.lat);
  const bounds = {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
  bounds.spanLon = Math.max(bounds.maxLon - bounds.minLon, 0.0001);
  bounds.spanLat = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  context.strokeStyle = dark ? '#f6f1e7' : '#111111';
  context.lineWidth = 4;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.beginPath();
  track.points.forEach((point, index) => {
    const projected = projectPoint(point, bounds, width, height, 24);
    if (index === 0) context.moveTo(projected.x, projected.y);
    else context.lineTo(projected.x, projected.y);
  });
  context.stroke();
  const start = projectPoint(track.points[0], bounds, width, height, 24);
  const end = projectPoint(
    track.points[track.points.length - 1],
    bounds,
    width,
    height,
    24,
  );
  context.fillStyle = '#167345';
  context.beginPath();
  context.arc(start.x, start.y, 7, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ad481d';
  context.beginPath();
  context.arc(end.x, end.y, 7, 0, Math.PI * 2);
  context.fill();
  if (state.fix) {
    const here = projectPoint(state.fix, bounds, width, height, 24);
    context.fillStyle = '#1d4ed8';
    context.beginPath();
    context.arc(here.x, here.y, 8, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = dark ? '#f6f1e7' : '#1c1915';
  context.fillText('Keine Karte, nur die gespeicherte Linie.', 12, height - 12);
};

const sharePosition = async (state, render) => {
  if (!state.fix) return;
  const text = [
    'Standort aus Kletterglück',
    `Dezimal: ${formatDecimal(state.fix.lat, state.fix.lon)}`,
    `Grad Minuten Sekunden: ${formatDms(state.fix.lat, state.fix.lon)}`,
    state.fix.accuracy == null
      ? null
      : `Genauigkeit: ${Math.round(state.fix.accuracy)} m`,
    `Zeitpunkt der letzten Ortung: ${formatStamp(state.fix.timestamp)}`,
    'Keine Aussage zu Wetter, Sperrung oder Begehbarkeit.',
  ]
    .filter(Boolean)
    .join('\n');
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Standort', text });
      return;
    }
  } catch (error) {
    if (error && error.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    state.wakeNote = 'Standort in die Zwischenablage kopiert.';
  } catch (copyError) {
    state.wakeNote = 'Teilen ist in diesem Browser nicht verfügbar.';
  }
  render();
};

const toggleWake = async (state, render) => {
  if (!('wakeLock' in navigator)) {
    state.wakeNote = 'Dieser Browser kann den Bildschirm nicht wach halten.';
    render();
    return;
  }
  if (state.wake) {
    await state.wake.release();
    state.wake = null;
    state.wakeNote = 'Bildschirm darf wieder ausgehen.';
    render();
    return;
  }
  try {
    state.wake = await navigator.wakeLock.request('screen');
    state.wakeNote = 'Bildschirm bleibt an, solange diese Ansicht offen ist.';
    state.wake.addEventListener('release', () => {
      state.wake = null;
    });
  } catch (error) {
    state.wakeNote =
      'Der Bildschirm konnte nicht wach gehalten werden. Das passiert zum Beispiel ohne Nutzeraktion oder im Stromsparmodus.';
  }
  render();
};

const setWatch = (state, active, render) => {
  if (!active) {
    if (state.watchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.watchId);
    }
    state.watchId = null;
    return;
  }
  if (state.watchId != null) return;
  if (!navigator.geolocation) {
    state.locationError = 'Dieser Browser stellt keine Ortung bereit.';
    return;
  }
  state.watchId = navigator.geolocation.watchPosition(
    (position) => {
      state.locationError = null;
      state.fix = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: finiteOrNull(position.coords.accuracy),
        altitude: finiteOrNull(position.coords.altitude),
        altitudeAccuracy: finiteOrNull(position.coords.altitudeAccuracy),
        heading: finiteOrNull(position.coords.heading),
        timestamp: position.timestamp,
      };
      render();
    },
    (failure) => {
      state.fix = null;
      if (failure.code === 1) {
        state.locationError =
          'Standortfreigabe fehlt. Ohne sie gibt es keine Position.';
      } else if (failure.code === 3) {
        state.locationError = 'Die Ortung hat nicht rechtzeitig geantwortet.';
      } else {
        state.locationError = 'Die Ortung ist fehlgeschlagen.';
      }
      render();
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  );
};

const bindActions = (root, state, actions) => {
  root.querySelectorAll('[data-open]').forEach((button) => {
    button.addEventListener('click', () => actions.open(button.dataset.open));
  });
  root.querySelectorAll('[data-track]').forEach((button) => {
    button.addEventListener('click', () => {
      state.trackIndex = Number(button.dataset.track);
      actions.render();
    });
  });
  root.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => actions.run(button.dataset.action));
  });
};

const renderShell = (root, state) => {
  const online = navigator.onLine;
  const themeLabel =
    state.theme === 'dark' ? 'Dunkel' : state.theme === 'light' ? 'Hell' : 'Wie das Gerät';
  const body =
    state.view === 'emergency'
      ? renderEmergency(state)
      : state.view === 'tour'
        ? renderTour(state)
        : renderList(state);
  document.documentElement.dataset.theme = effectiveTheme(state);
  root.innerHTML = `
    <header>
      <p class="status ${online ? 'on' : 'off'}" role="status">${
        online
          ? 'Netz vorhanden. Gespeicherte Touren bleiben der Stand vom Speicherzeitpunkt.'
          : 'Kein Netz. Suche, frische OSM-Daten, Fotos und der Kartenhintergrund fehlen.'
      }</p>
      <div class="row">
        <button class="ghost" data-action="theme">Darstellung: ${themeLabel}</button>
        <button class="ghost" data-action="emergency">Notfall</button>
        <a class="ghost" href="/">Zur Karte</a>
      </div>
    </header>
    <main>${body}</main>`;
};

const boot = (rootElement) => {
  const host = window.location.hostname;
  if (
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    'serviceWorker' in navigator
  ) {
    navigator.serviceWorker.register('/kletterglueck-sw.js').catch(() => {});
  }
  const state = {
    packs: [],
    view: 'list',
    tourId: null,
    trackIndex: 0,
    fix: null,
    locationError: null,
    watchId: null,
    wake: null,
    wakeNote: '',
    browserUsage: null,
    theme: 'system',
  };
  const cookie = document.cookie.match(/(?:^|; )userTheme=(light|dark|system)/);
  state.theme = cookie ? cookie[1] : 'system';

  const render = () => {
    renderShell(rootElement, state);
    bindActions(rootElement, state, {
      open: (id) => {
        state.view = 'tour';
        state.tourId = id;
        state.trackIndex = 0;
        setWatch(state, true, render);
        render();
      },
      render,
      run: (action) => {
        if (action === 'list') {
          state.view = 'list';
          setWatch(state, false, render);
          render();
        }
        if (action === 'emergency') {
          state.view = 'emergency';
          setWatch(state, true, render);
          render();
        }
        if (action === 'delete' && selectedPack(state)) {
          const id = selectedPack(state).id;
          deletePack(id).then(() => {
            state.view = 'list';
            state.tourId = null;
            setWatch(state, false, render);
            return refresh();
          });
        }
        if (action === 'share') sharePosition(state, render);
        if (action === 'wake') toggleWake(state, render);
        if (action === 'theme') {
          state.theme =
            state.theme === 'system'
              ? 'dark'
              : state.theme === 'dark'
                ? 'light'
                : 'system';
          document.cookie = `userTheme=${state.theme}; Path=/; Max-Age=31536000`;
          render();
        }
      },
    });
    drawTrack(rootElement.querySelector('canvas'), state);
  };

  const refresh = async () => {
    state.packs = await allPacks();
    state.packs.sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'));
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      state.browserUsage = finiteOrNull(estimate.usage);
    }
    render();
  };

  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  window.addEventListener('pagehide', () => setWatch(state, false, render));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') render();
  });
  const params = new URLSearchParams(window.location.search);
  const pathTour = window.location.pathname.match(/^\/(node|way|relation)\/(\d+)/);
  refresh().then(() => {
    if (params.get('ansicht') === 'notfall') {
      state.view = 'emergency';
      setWatch(state, true, render);
      render();
      return;
    }
    const requested =
      params.get('tour') || (pathTour ? `${pathTour[1]}/${pathTour[2]}` : '');
    if (requested) {
      state.view = 'tour';
      state.tourId = requested;
      state.trackIndex = 0;
      setWatch(state, true, render);
      render();
    }
  });
};

const api = {
  haversineMeters,
  initialBearingDegrees,
  normalizeBearing,
  cardinalFromBearing,
  distanceToTrackMeters,
  formatMeters,
  formatBytes,
  formatDecimal,
  formatDms,
  boot,
};

(function publish(root) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KletterglueckField = api;
  if (typeof document !== 'undefined' && document.getElementById('unterwegs')) {
    api.boot(document.getElementById('unterwegs'));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
