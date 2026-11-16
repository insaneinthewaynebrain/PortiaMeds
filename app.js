/* Portia Meds — plain JS, all data in localStorage. */
(function () {
  'use strict';

  var STORAGE_KEY = 'portiaMeds.v1';
  var HOUR = 3600 * 1000;
  var DAY = 24 * HOUR;
  var SOON_MS = 30 * 60 * 1000; // "due soon" window
  var REVIEW_HOURS = 48;

  var SYMPTOMS = [
    { id: 'poo_normal', label: 'Pooed normally', emoji: '💩', tone: 'good' },
    { id: 'strained', label: 'Strained', emoji: '😣', tone: 'bad' },
    { id: 'blood_wee', label: 'Blood in wee', emoji: '🩸', tone: 'bad' },
    { id: 'diarrhoea', label: 'Diarrhoea', emoji: '💧', tone: 'bad' },
    { id: 'vomited', label: 'Vomited', emoji: '🤮', tone: 'bad' },
    { id: 'ate_well', label: 'Ate well', emoji: '🍽️', tone: 'good' },
    // Kept the id 'wee_normal' so existing log entries still match. Entries logged before
    // amount/blood were added have neither field and are shown with the old label.
    { id: 'wee_normal', label: 'Weed', legacyLabel: 'Weed normally', emoji: '🚽', tone: 'good' },
    { id: 'wee_nothing', label: 'Strained to wee, nothing came', emoji: '🚫', tone: 'bad' }
  ];
  var SYMPTOM_BY_ID = {};
  SYMPTOMS.forEach(function (s) { SYMPTOM_BY_ID[s.id] = s; });

  function defaultMeds() {
    var now = new Date().toISOString();
    return [
      {
        id: 'lactulose', name: 'Lactulose', purpose: 'Laxative',
        dose: '0.5 ml by mouth', intervalHours: 8, schedule: '3 times a day (every 8 hours)',
        requiredPerDay: null,
        notes: 'Stop if diarrhoea. Can be increased to 1 ml if no poo by day 2.',
        paused: false, pausedNote: '', updatedAt: now
      },
      {
        id: 'gabapentin', name: 'Gabapentin', purpose: 'Pain relief',
        dose: '0.4 ml by mouth', intervalHours: 8, schedule: '2–3 times a day (every 8 hours)',
        requiredPerDay: 2,
        notes: 'Third dose optional — only if she is still straining.',
        paused: false, pausedNote: '', updatedAt: now
      },
      {
        id: 'metacam', name: 'Metacam', purpose: 'Anti-inflammatory / pain relief',
        dose: 'As prescribed', intervalHours: 24, schedule: 'As directed by vet',
        requiredPerDay: null, notes: '',
        paused: true, pausedNote: 'Stopped by vet for 24–48 hours, ask before restarting',
        updatedAt: now
      }
    ];
  }

  function addDays(date, days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }
  function addMonths(date, months) {
    var d = new Date(date.getTime());
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function defaultFollowups() {
    var today = new Date();
    var now = today.toISOString();
    return [
      { id: 'urine', label: 'Urine sample (about 2 weeks)', date: toDateInput(addDays(today, 14)), done: false, updatedAt: now },
      { id: 'bloods', label: 'Repeat bloods (3–4 months)', date: toDateInput(addMonths(today, 3)), done: false, updatedAt: now }
    ];
  }

  function freshState() {
    return {
      version: 1,
      meds: defaultMeds(),
      doses: [],      // {id, medId, time, dose, note}
      symptoms: [],   // {id, type, time, note}
      followups: defaultFollowups(),
      reviewDone: false,
      notified: {}    // key -> true, to avoid repeat notifications
    };
  }

  /* ---------- storage ---------- */
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      return normalise(JSON.parse(raw));
    } catch (e) {
      console.error('Could not load data', e);
      return freshState();
    }
  }

  function normalise(s) {
    var base = freshState();
    if (!s || typeof s !== 'object') return base;
    return {
      version: 1,
      meds: Array.isArray(s.meds) ? s.meds : base.meds,
      doses: Array.isArray(s.doses) ? s.doses : [],
      symptoms: Array.isArray(s.symptoms) ? s.symptoms : [],
      followups: Array.isArray(s.followups) ? s.followups : base.followups,
      reviewDone: !!s.reviewDone,
      notified: (s.notified && typeof s.notified === 'object') ? s.notified : {}
    };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      alert('Could not save — storage may be full or disabled (private browsing?).');
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- helpers ---------- */
  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toLocalInput(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fromLocalInput(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }
  function toDateInput(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fromDateInput(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function fmtTime(d) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDayTime(d) {
    var today = new Date();
    var tomorrow = addDays(today, 1);
    var yesterday = addDays(today, -1);
    var day;
    if (d.toDateString() === today.toDateString()) day = 'Today';
    else if (d.toDateString() === tomorrow.toDateString()) day = 'Tomorrow';
    else if (d.toDateString() === yesterday.toDateString()) day = 'Yesterday';
    else day = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    return day + ' ' + fmtTime(d);
  }
  function fmtDate(d) {
    return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function fmtDuration(ms) {
    var neg = ms < 0;
    ms = Math.abs(ms);
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var out = h > 0 ? h + 'h ' + pad(m) + 'm ' + pad(s) + 's' : m + 'm ' + pad(s) + 's';
    return neg ? '-' + out : out;
  }
  function fmtAgo(ms) {
    var mins = Math.round(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h < 48) return h + 'h ' + m + 'm ago';
    return Math.round(h / 24) + ' days ago';
  }

  function medById(id) {
    for (var i = 0; i < state.meds.length; i++) if (state.meds[i].id === id) return state.meds[i];
    return null;
  }
  function dosesFor(medId) {
    return state.doses.filter(function (d) { return d.medId === medId; })
      .sort(function (a, b) { return new Date(a.time) - new Date(b.time); });
  }
  function lastDose(medId) {
    var list = dosesFor(medId);
    return list.length ? list[list.length - 1] : null;
  }
  function firstDoseTime() {
    var t = null;
    state.doses.forEach(function (d) {
      var dt = new Date(d.time);
      if (!t || dt < t) t = dt;
    });
    return t;
  }
  function lastSymptom(types) {
    var best = null;
    state.symptoms.forEach(function (s) {
      if (types.indexOf(s.type) === -1) return;
      if (!best || new Date(s.time) > new Date(best.time)) best = s;
    });
    return best;
  }
  function symptomsSince(types, sinceMs) {
    return state.symptoms.filter(function (s) {
      return types.indexOf(s.type) !== -1 && new Date(s.time).getTime() >= sinceMs;
    });
  }

  /* Status of a medication right now */
  function medStatus(med, now) {
    now = now || Date.now();
    if (med.paused) return { state: 'paused' };
    var last = lastDose(med.id);
    if (!last) return { state: 'new' };
    var interval = (Number(med.intervalHours) || 8) * HOUR;
    var lastT = new Date(last.time).getTime();
    var next = lastT + interval;
    var diff = next - now;
    var count24 = dosesFor(med.id).filter(function (d) {
      var t = new Date(d.time).getTime();
      return t > now - DAY && t <= now;
    }).length;
    var req = Number(med.requiredPerDay) || 0;
    var optional = req > 0 && count24 >= req;
    var st;
    if (diff <= 0) st = optional ? 'optional' : 'overdue';
    else if (diff <= SOON_MS) st = 'soon';
    else st = 'ok';
    return { state: st, last: last, lastT: lastT, next: next, diff: diff, count24: count24, optional: optional };
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg, actionLabel, actionFn) {
    var el = $('#toast');
    el.innerHTML = esc(msg) + (actionLabel ? ' <u>' + esc(actionLabel) + '</u>' : '');
    el.style.pointerEvents = actionFn ? 'auto' : 'none';
    el.onclick = actionFn ? function () { el.classList.remove('show'); actionFn(); } : null;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, actionFn ? 5000 : 2500);
  }

  /* ---------- dialog ---------- */
  var dialogHandler = null;
  function openDialog(title, bodyHtml, onClose, okLabel, hideCancel) {
    var dlg = $('#dialog');
    $('#dialog-title').textContent = title;
    $('#dialog-body').innerHTML = bodyHtml;
    $('#dialog-ok').textContent = okLabel || 'Save';
    $('#dialog-cancel').classList.toggle('hidden', !!hideCancel);
    dialogHandler = onClose;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }
  $('#dialog').addEventListener('close', function () {
    var dlg = $('#dialog');
    var h = dialogHandler;
    dialogHandler = null;
    if (h) h(dlg.returnValue, dlg);
  });

  /* ---------- dose logging ---------- */
  function logDose(medId, time, note) {
    var med = medById(medId);
    var dose = { id: uid(), medId: medId, time: time.toISOString(), dose: med ? med.dose : '', note: note || '' };
    state.doses.push(dose);
    save();
    renderAll();
    return dose;
  }

  function givenNow(medId) {
    var med = medById(medId);
    var st = medStatus(med);
    if (st.last) {
      var since = Date.now() - st.lastT;
      var interval = (Number(med.intervalHours) || 8) * HOUR;
      if (since < interval / 2) {
        if (!confirm(med.name + ' was last logged ' + fmtAgo(since) + ' (' + fmtDayTime(new Date(st.lastT)) +
          ').\n\nAre you sure you want to log another dose now?')) return;
      }
    }
    var dose = logDose(medId, new Date(), '');
    toast(med.name + ' logged at ' + fmtTime(new Date(dose.time)), 'Edit', function () { editEntry('dose', dose.id); });
  }

  function givenEarlier(medId) {
    var med = medById(medId);
    var body =
      '<p class="muted">Use this if you gave ' + esc(med.name) + ' earlier and are logging it late.</p>' +
      '<label class="field"><span>Time given</span><input type="datetime-local" name="time" required value="' + toLocalInput(new Date()) + '"></label>' +
      '<label class="field"><span>Note (optional)</span><textarea name="note" placeholder="e.g. took it with food, spat some out"></textarea></label>';
    openDialog('Log ' + med.name + ' at another time', body, function (rv, dlg) {
      if (rv !== 'ok') return;
      var t = fromLocalInput(dlg.querySelector('[name=time]').value);
      if (!t) return;
      if (t.getTime() > Date.now() + 5 * 60000 && !confirm('That time is in the future. Log it anyway?')) return;
      logDose(medId, t, dlg.querySelector('[name=note]').value.trim());
      toast(med.name + ' logged for ' + fmtDayTime(t));
    }, 'Log dose');
  }

  function editEntry(kind, id) {
    var list = kind === 'dose' ? state.doses : state.symptoms;
    var entry = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) entry = list[i];
    if (!entry) return;
    if (kind === 'symptom') { symptomDialog(entry.type, entry); return; }
    var title, extra = '';
    if (kind === 'dose') {
      var med = medById(entry.medId);
      title = 'Edit ' + (med ? med.name : 'dose');
      extra = '<label class="field"><span>Dose given</span><input type="text" name="dose" value="' + esc(entry.dose) + '"></label>';
    } else {
      var sym = SYMPTOM_BY_ID[entry.type];
      title = 'Edit: ' + (sym ? sym.label : entry.type);
    }
    var body =
      '<label class="field"><span>Time</span><input type="datetime-local" name="time" required value="' + toLocalInput(new Date(entry.time)) + '"></label>' +
      extra +
      '<label class="field"><span>Note</span><textarea name="note">' + esc(entry.note) + '</textarea></label>' +
      '<button value="delete" class="btn btn-danger" formnovalidate>Delete this entry</button>';
    openDialog(title, body, function (rv, dlg) {
      if (rv === 'delete') {
        if (!confirm('Delete this entry?')) return;
        var idx = list.indexOf(entry);
        if (idx !== -1) list.splice(idx, 1);
        save(); renderAll(); toast('Deleted');
        return;
      }
      if (rv !== 'ok') return;
      var t = fromLocalInput(dlg.querySelector('[name=time]').value);
      if (t) entry.time = t.toISOString();
      entry.note = dlg.querySelector('[name=note]').value.trim();
      var doseEl = dlg.querySelector('[name=dose]');
      if (doseEl) entry.dose = doseEl.value.trim();
      save(); renderAll(); toast('Saved');
    });
  }

  /* ---------- photos (stored in IndexedDB, separate from the log) ---------- */
  var PHOTO_DB = 'portiaMedsPhotos';
  var dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        if (!window.indexedDB) { reject(new Error('Photo storage is not available in this browser.')); return; }
        var req = indexedDB.open(PHOTO_DB, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('photos'); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
      dbPromise.catch(function () { dbPromise = null; });
    }
    return dbPromise;
  }
  function photoTx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction('photos', mode);
        var store = tx.objectStore('photos');
        var result;
        var req = fn(store);
        if (req) req.onsuccess = function () { result = req.result; };
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Photo save aborted (storage full?)')); };
      });
    });
  }
  function putPhoto(id, blob) { invalidatePhoto(id); return photoTx('readwrite', function (s) { return s.put(blob, id); }); }
  function getPhoto(id) { return photoTx('readonly', function (s) { return s.get(id); }); }
  function deletePhoto(id) { invalidatePhoto(id); return photoTx('readwrite', function (s) { return s.delete(id); }); }
  function clearPhotos() { photoUrls = {}; return photoTx('readwrite', function (s) { return s.clear(); }); }
  function photoEntries() {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var out = {};
        var tx = d.transaction('photos', 'readonly');
        var req = tx.objectStore('photos').openCursor();
        req.onsuccess = function () {
          var c = req.result;
          if (c) { out[c.key] = c.value; c.continue(); }
        };
        tx.oncomplete = function () { resolve(out); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  var photoUrls = {};
  function invalidatePhoto(id) {
    if (photoUrls[id]) { URL.revokeObjectURL(photoUrls[id]); delete photoUrls[id]; }
  }
  function photoUrl(id) {
    if (photoUrls[id]) return Promise.resolve(photoUrls[id]);
    return getPhoto(id).then(function (blob) {
      if (!blob) return null;
      photoUrls[id] = URL.createObjectURL(blob);
      return photoUrls[id];
    });
  }
  function hydratePhotos(root) {
    root.querySelectorAll('img[data-photo-id]').forEach(function (img) {
      photoUrl(img.getAttribute('data-photo-id')).then(function (url) {
        if (url) img.src = url; else img.alt = 'Photo missing on this device';
      }).catch(function () { img.alt = 'Photo unavailable'; });
    });
  }
  function viewPhoto(id) {
    openDialog('Photo', '<img class="photo-full" data-photo-id="' + esc(id) + '" alt="Photo">', null, 'Close', true);
    hydratePhotos($('#dialog-body'));
  }

  // Shrink a camera photo to a sensible size (max 1280px, JPEG) before storing it.
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1280;
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * s));
        c.height = Math.max(1, Math.round(img.naturalHeight * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('Could not process that photo.')); }, 'image/jpeg', 0.75);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')); };
      img.src = url;
    });
  }
  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function dataURLToBlob(dataUrl) {
    var m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl || '');
    if (!m) return null;
    var bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] || 'image/jpeg' });
  }

  /* ---------- symptoms ---------- */
  function symptomTitle(e) {
    var sym = SYMPTOM_BY_ID[e.type] || { emoji: '•', label: e.type };
    if (e.type === 'wee_normal') {
      if (!e.amount && e.blood == null) return sym.emoji + ' ' + esc(sym.legacyLabel); // older entries
      var parts = [];
      if (e.amount) parts.push(esc(e.amount) + ' amount');
      parts.push(e.blood ? '<span class="blood">with blood 🩸</span>' : 'no blood');
      return sym.emoji + ' ' + esc(sym.label) + ' — ' + parts.join(', ');
    }
    return sym.emoji + ' ' + esc(sym.label);
  }

  function segHtml(name, options, current) {
    return '<div class="seg" role="radiogroup">' + options.map(function (o) {
      var id = 'seg-' + name + '-' + o.value;
      return '<input type="radio" name="' + name + '" id="' + id + '" value="' + esc(o.value) + '"' + (current === o.value ? ' checked' : '') + '>' +
        '<label for="' + id + '" class="' + (o.cls || '') + '">' + esc(o.label) + '</label>';
    }).join('') + '</div>';
  }

  // Dialog for logging a new symptom (entry == null) or editing an existing one.
  var pendingPhoto = null; // { blob } new photo chosen, or { remove: true }
  function symptomDialog(type, entry) {
    var isNew = !entry;
    var sym = SYMPTOM_BY_ID[type] || { label: type };
    var isWee = type === 'wee_normal';
    pendingPhoto = null;
    var initialTime = toLocalInput(isNew ? new Date() : new Date(entry.time));
    var body = '<label class="field"><span>Time</span><input type="datetime-local" name="time" required value="' +
      initialTime + '"></label>';
    if (isWee) {
      body += '<div class="field"><span>Amount</span>' + segHtml('amount', [
        { value: 'Small', label: 'Small' }, { value: 'Medium', label: 'Medium' }, { value: 'Large', label: 'Large' }
      ], entry ? entry.amount : '') + '</div>';
      body += '<div class="field"><span>Blood</span>' + segHtml('blood', [
        { value: 'no', label: 'Without blood' }, { value: 'yes', label: 'With blood 🩸', cls: 'bad' }
      ], entry && entry.blood ? 'yes' : 'no') + '</div>';
    }
    var hasPhoto = !!(entry && entry.photoId);
    body += '<div class="field"><span>Photo (optional)</span>' +
      '<div class="photo-preview" id="photo-preview">' + (hasPhoto ? '<img data-photo-id="' + esc(entry.photoId) + '" alt="Photo">' : '') + '</div>' +
      '<label class="btn btn-secondary file-btn" id="photo-pick">📷 ' + (hasPhoto ? 'Replace photo' : 'Take / add photo') +
      '<input type="file" accept="image/*" name="photo"></label>' +
      '<button type="button" class="btn btn-secondary btn-small' + (hasPhoto ? '' : ' hidden') + '" id="photo-remove" style="margin-top:8px">Remove photo</button>' +
      '<div class="note" id="photo-status"></div></div>';
    body += '<label class="field"><span>Note (optional)</span><textarea name="note">' + esc(entry ? entry.note : '') + '</textarea></label>';
    if (!isNew) body += '<button value="delete" class="btn btn-danger" formnovalidate>Delete this entry</button>';

    openDialog((isNew ? 'Log: ' : 'Edit: ') + sym.label, body, function (rv, dlg) {
      var photo = pendingPhoto;
      pendingPhoto = null;
      if (rv === 'delete') {
        if (!confirm('Delete this entry?')) return;
        var idx = state.symptoms.indexOf(entry);
        if (idx !== -1) state.symptoms.splice(idx, 1);
        if (entry.photoId) deletePhoto(entry.photoId).catch(function () {});
        save(); renderAll(); toast('Deleted');
        return;
      }
      if (rv !== 'ok') return;
      var e = entry || { id: uid(), type: type, time: new Date().toISOString(), note: '' };
      var timeVal = dlg.querySelector('[name=time]').value;
      var t = fromLocalInput(timeVal);
      // Keep the exact current time (with seconds) if a new entry's time wasn't changed.
      if (t && !(isNew && timeVal === initialTime)) e.time = t.toISOString();
      e.note = dlg.querySelector('[name=note]').value.trim();
      if (isWee) {
        var amt = dlg.querySelector('[name=amount]:checked');
        e.amount = amt ? amt.value : '';
        var bl = dlg.querySelector('[name=blood]:checked');
        e.blood = !!(bl && bl.value === 'yes');
      }
      if (isNew) state.symptoms.push(e);
      var done = function (msg) { save(); renderAll(); toast(msg); };
      if (photo && photo.blob) {
        var pid = e.photoId || e.id;
        putPhoto(pid, photo.blob).then(function () {
          e.photoId = pid;
          done(isNew ? 'Logged: ' + sym.label + ' with photo' : 'Saved');
        }).catch(function (err) {
          done('Saved without photo');
          alert('The entry was saved, but the photo could not be stored: ' + (err && err.message ? err.message : err));
        });
      } else if (photo && photo.remove && e.photoId) {
        var old = e.photoId;
        delete e.photoId;
        deletePhoto(old).catch(function () {});
        done('Saved');
      } else {
        done(isNew ? 'Logged: ' + sym.label : 'Saved');
      }
    }, isNew ? 'Log it' : 'Save');
    hydratePhotos($('#dialog-body'));
  }

  // Photo picking inside the dialog
  $('#dialog-body').addEventListener('change', function (ev) {
    var input = ev.target;
    if (input.name !== 'photo' || !input.files || !input.files[0]) return;
    var status = $('#photo-status');
    status.textContent = 'Processing photo…';
    compressImage(input.files[0]).then(function (blob) {
      pendingPhoto = { blob: blob };
      var prev = $('#photo-preview');
      prev.innerHTML = '<img alt="New photo">';
      prev.querySelector('img').src = URL.createObjectURL(blob);
      $('#photo-remove').classList.remove('hidden');
      status.textContent = 'Photo ready (' + Math.round(blob.size / 1024) + ' KB). It is saved when you tap the button below.';
    }).catch(function (err) {
      status.textContent = err.message || 'Could not use that photo.';
    });
    input.value = '';
  });
  $('#dialog-body').addEventListener('click', function (ev) {
    if (!ev.target.closest('#photo-remove')) return;
    pendingPhoto = { remove: true };
    $('#photo-preview').innerHTML = '';
    $('#photo-remove').classList.add('hidden');
    $('#photo-status').textContent = 'Photo will be removed when you save.';
  });

  function logSymptom(type) {
    if (type === 'wee_normal') { symptomDialog(type, null); return; }
    var s = { id: uid(), type: type, time: new Date().toISOString(), note: '' };
    state.symptoms.push(s);
    save();
    renderAll();
    var sym = SYMPTOM_BY_ID[type];
    toast('Logged: ' + sym.label, 'Add note / photo', function () { editEntry('symptom', s.id); });
  }

  function symptomButtonsHtml() {
    return SYMPTOMS.map(function (s) {
      return '<button class="symptom-btn ' + s.tone + '" data-symptom="' + s.id + '">' +
        '<span class="emoji" aria-hidden="true">' + s.emoji + '</span>' + esc(s.label) + '</button>';
    }).join('');
  }

  /* ---------- rendering: Today ---------- */
  function renderVetFlags() {
    var now = Date.now();
    var flags = [];
    var urgent = symptomsSince(['blood_wee', 'wee_nothing'], now - DAY);
    urgent.forEach(function (s) {
      flags.push(SYMPTOM_BY_ID[s.type].label + ' logged ' + fmtDayTime(new Date(s.time)) + ' — call the vet.');
    });
    symptomsSince(['wee_normal'], now - DAY).forEach(function (s) {
      if (s.blood) flags.push('Wee with blood logged ' + fmtDayTime(new Date(s.time)) + ' — call the vet.');
    });
    var first = firstDoseTime();
    var lastPoo = lastSymptom(['poo_normal', 'diarrhoea']);
    var ref = lastPoo ? new Date(lastPoo.time).getTime() : (first ? first.getTime() : null);
    if (ref && now - ref > 48 * HOUR) {
      flags.push(lastPoo ? 'No poo logged since ' + fmtDayTime(new Date(lastPoo.time)) + ' — call the vet.'
        : 'No poo logged since the first dose (' + fmtDayTime(first) + ') — call the vet.');
    }
    $('#vet-flags').innerHTML = flags.map(function (f) { return '<div class="flag">⚠️ ' + esc(f) + '</div>'; }).join('');
  }

  function renderReview() {
    var el = $('#review-card');
    var first = firstDoseTime();
    if (!first) { el.innerHTML = ''; return; }
    var reviewAt = new Date(first.getTime() + REVIEW_HOURS * HOUR);
    var due = Date.now() >= reviewAt.getTime();
    var msg = 'If pooing normally and no blood in wee, ask vet about stopping medication.';
    var html = '<div class="card review' + (due ? ' due' : '') + '">';
    if (state.reviewDone) {
      html += '<strong>✅ 48-hour review done</strong><span class="muted">' + esc(msg) + '</span>' +
        '<button class="btn btn-secondary btn-small" data-action="review-undo" style="margin-top:8px">Mark as not done</button>';
    } else if (due) {
      html += '<strong>🔔 48-hour review is due (since ' + esc(fmtDayTime(reviewAt)) + ')</strong>' + esc(msg) +
        '<button class="btn" data-action="review-done">Done — spoken to vet</button>';
    } else {
      html += '<strong>📅 48-hour review: ' + esc(fmtDayTime(reviewAt)) + '</strong>' +
        '<span data-review-countdown="' + reviewAt.getTime() + '">in ' + fmtDuration(reviewAt.getTime() - Date.now()) + '</span>' +
        '<br><span class="muted">Then: ' + esc(msg) + '</span>';
    }
    html += '<div class="note">Counted from the first logged dose (' + esc(fmtDayTime(first)) + ').</div></div>';
    el.innerHTML = html;
  }

  function medWarnings(med, st) {
    var out = [];
    var now = Date.now();
    var key = (med.id + ' ' + med.name).toLowerCase();
    if (key.indexOf('lactulose') !== -1 && !med.paused) {
      var diar = symptomsSince(['diarrhoea'], now - DAY);
      if (diar.length) out.push({ bad: true, text: 'Diarrhoea logged ' + fmtDayTime(new Date(diar[diar.length - 1].time)) + ' — vet said STOP lactulose.' });
      var first = firstDoseTime();
      var poo = lastSymptom(['poo_normal', 'diarrhoea']);
      if (first && now - first.getTime() >= 48 * HOUR && (!poo || new Date(poo.time) < first)) {
        out.push({ bad: false, text: 'No poo logged by day 2 — vet said the dose can be increased to 1 ml (change it in Settings).' });
      }
    }
    if (st.optional) {
      out.push({ bad: false, text: st.count24 + ' doses given in the last 24h. Next dose is optional — ' + (med.notes || 'only if needed') });
    }
    return out;
  }

  function statusPill(st) {
    switch (st.state) {
      case 'paused': return '<span class="pill paused">⏸ PAUSED</span>';
      case 'new': return '<span class="pill new">Not started</span>';
      case 'overdue': return '<span class="pill overdue">⚠️ OVERDUE</span>';
      case 'optional': return '<span class="pill soon">Optional dose</span>';
      case 'soon': return '<span class="pill soon">Due soon</span>';
      default: return '<span class="pill ok">✓ On track</span>';
    }
  }

  function renderMeds() {
    var now = Date.now();
    var html = state.meds.map(function (med) {
      var st = medStatus(med, now);
      var h = '<div class="card med state-' + st.state + '" data-med="' + esc(med.id) + '" data-state="' + st.state + '">';
      h += '<div class="med-head"><div><h3>' + esc(med.name) + '</h3><div class="med-purpose">' + esc(med.purpose) + '</div></div>' + statusPill(st) + '</div>';
      h += '<div class="dose-big">' + esc(med.dose) + '</div>';
      h += '<div class="muted">' + esc(med.schedule) + '</div>';

      if (med.paused) {
        h += '<p class="paused-note">⏸ ' + esc(med.pausedNote || 'Paused') + '</p>';
        h += '<p class="note">To restart, untick “Paused” in Settings (only after checking with the vet).</p>';
        return h + '</div>';
      }

      if (med.notes) h += '<p class="med-note">ℹ️ ' + esc(med.notes) + '</p>';
      medWarnings(med, st).forEach(function (w) {
        h += '<div class="med-warn' + (w.bad ? ' bad' : '') + '">' + esc(w.text) + '</div>';
      });

      h += '<dl class="med-rows">';
      if (st.state === 'new') {
        h += '<dt>Last dose</dt><dd>None logged yet</dd>';
        h += '<dt>Next due</dt><dd>When you give the first dose</dd>';
      } else {
        h += '<dt>Last dose</dt><dd>' + esc(fmtDayTime(new Date(st.lastT))) + (st.last.dose && st.last.dose !== med.dose ? ' (' + esc(st.last.dose) + ')' : '') + '</dd>';
        h += '<dt>Next due</dt><dd>' + esc(fmtDayTime(new Date(st.next))) + '</dd>';
        h += '<dt>' + (st.diff <= 0 ? 'Overdue by' : 'Due in') + '</dt><dd class="countdown" data-countdown="' + st.next + '">' + fmtDuration(Math.abs(st.diff)) + '</dd>';
        h += '<dt>Last 24h</dt><dd>' + st.count24 + ' dose' + (st.count24 === 1 ? '' : 's') + '</dd>';
      }
      h += '</dl>';

      h += '<button class="btn btn-big" data-action="given" data-id="' + esc(med.id) + '">✅ Given now</button>';
      h += '<div class="btn-row">';
      h += '<button class="btn btn-secondary btn-small" data-action="earlier" data-id="' + esc(med.id) + '">🕑 Given at another time</button>';
      if (st.last) h += '<button class="btn btn-secondary btn-small" data-action="edit-last" data-id="' + esc(st.last.id) + '">✏️ Edit last dose</button>';
      h += '</div>';
      return h + '</div>';
    }).join('');
    $('#med-list').innerHTML = html || '<div class="card muted">No medications. Add one in Settings.</div>';

    var overdue = state.meds.filter(function (m) { return medStatus(m, now).state === 'overdue'; });
    var banner = $('#overdue-banner');
    if (overdue.length) {
      banner.textContent = '⚠️ Overdue: ' + overdue.map(function (m) { return m.name; }).join(', ');
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
    document.querySelector('.tab[data-view=today]').classList.toggle('has-alert', overdue.length > 0);
    document.title = overdue.length ? '⚠️ Dose overdue — Portia Meds' : 'Portia Meds';
  }

  function renderLastPoo() {
    var poo = lastSymptom(['poo_normal']);
    $('#last-poo').textContent = poo ? 'Last normal poo: ' + fmtDayTime(new Date(poo.time)) + ' (' + fmtAgo(Date.now() - new Date(poo.time)) + ')'
      : 'No normal poo logged yet.';
  }

  function renderFollowups() {
    var today = fromDateInput(toDateInput(new Date()));
    $('#followups').innerHTML = state.followups.map(function (f) {
      var d = fromDateInput(f.date);
      var whenTxt = '', cls = '';
      if (d && !f.done) {
        var days = Math.round((d - today) / DAY);
        if (days < 0) { whenTxt = 'Was due ' + (-days) + ' day' + (days === -1 ? '' : 's') + ' ago'; cls = 'past'; }
        else if (days === 0) { whenTxt = 'Due today'; cls = 'past'; }
        else { whenTxt = 'In ' + days + ' day' + (days === 1 ? '' : 's') + ' — ' + fmtDate(d); cls = days <= 3 ? 'soon' : ''; }
      } else if (f.done) {
        whenTxt = 'Done';
      }
      return '<div class="followup' + (f.done ? ' done' : '') + '">' +
        '<div class="followup-top"><input type="checkbox" id="fu-' + esc(f.id) + '" data-fu-done="' + esc(f.id) + '"' + (f.done ? ' checked' : '') + '>' +
        '<label for="fu-' + esc(f.id) + '">' + esc(f.label) + '</label></div>' +
        '<div class="followup-when ' + cls + '">' + esc(whenTxt) + '</div>' +
        '<input type="date" aria-label="Date for ' + esc(f.label) + '" data-fu-date="' + esc(f.id) + '" value="' + esc(f.date) + '">' +
        '</div>';
    }).join('');
  }

  function renderNotifyStatus() {
    var el = $('#notify-status'), btn = $('#btn-notify');
    if (!('Notification' in window)) {
      el.textContent = 'This browser does not support notifications here. On iPhone, add the app to the Home Screen first and open it from there.';
      btn.classList.add('hidden');
      return;
    }
    if (Notification.permission === 'granted') {
      el.textContent = '✅ Notifications are on. You will be alerted when a dose becomes due (while the app is open).';
      btn.classList.add('hidden');
    } else if (Notification.permission === 'denied') {
      el.textContent = 'Notifications are blocked. Re-enable them in your browser / iPhone Settings → Notifications.';
      btn.classList.add('hidden');
    } else {
      el.textContent = 'Notifications are off.';
      btn.classList.remove('hidden');
    }
  }

  /* ---------- rendering: Log ---------- */
  function renderLog() {
    var filter = $('#log-filter').value;
    var items = [];
    if (filter !== 'symptoms') state.doses.forEach(function (d) { items.push({ kind: 'dose', e: d }); });
    if (filter !== 'doses') state.symptoms.forEach(function (s) { items.push({ kind: 'symptom', e: s }); });
    items.sort(function (a, b) { return new Date(b.e.time) - new Date(a.e.time); });
    if (!items.length) { $('#log-list').innerHTML = '<p class="muted">Nothing logged yet.</p>'; return; }
    var html = '', lastDay = '';
    items.forEach(function (it) {
      var d = new Date(it.e.time);
      var day = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
      if (day !== lastDay) { html += '<h3 class="log-day">' + esc(day) + '</h3>'; lastDay = day; }
      var title;
      if (it.kind === 'dose') {
        var med = medById(it.e.medId);
        title = '💊 ' + esc(med ? med.name : it.e.medId) + (it.e.dose ? ' — ' + esc(it.e.dose) : '');
      } else {
        title = symptomTitle(it.e);
      }
      html += '<div class="log-item"><div class="log-time">' + esc(fmtTime(d)) + '</div>' +
        '<div class="log-main"><div class="log-title">' + title + '</div>' +
        (it.e.note ? '<div class="log-note">' + esc(it.e.note) + '</div>' : '') +
        (it.e.photoId ? '<button class="thumb" data-view-photo="' + esc(it.e.photoId) + '" aria-label="View photo"><img data-photo-id="' + esc(it.e.photoId) + '" alt="Photo"></button>' : '') +
        '</div>' +
        '<button class="btn btn-secondary btn-small" data-action="edit-entry" data-kind="' + it.kind + '" data-id="' + esc(it.e.id) + '">Edit</button></div>';
    });
    $('#log-list').innerHTML = html;
    hydratePhotos($('#log-list'));
  }

  /* ---------- rendering: Symptoms ---------- */
  function renderSymptomSummary() {
    var since = Date.now() - 48 * HOUR;
    var html = SYMPTOMS.map(function (s) {
      var list = symptomsSince([s.id], since);
      var last = list.length ? list.reduce(function (a, b) { return new Date(a.time) > new Date(b.time) ? a : b; }) : null;
      return '<div class="sym-summary-row"><span>' + s.emoji + ' ' + esc(s.label) + '</span><span><strong>' + list.length + '×</strong>' +
        (last ? ' <span class="muted">last ' + esc(fmtDayTime(new Date(last.time))) + '</span>' : '') + '</span></div>';
    }).join('');
    $('#symptom-summary').innerHTML = html;
  }

  /* ---------- rendering: Settings ---------- */
  function renderSettings() {
    $('#med-settings').innerHTML = state.meds.map(function (m) {
      var f = function (label, field, type, extra) {
        var v = m[field] == null ? '' : m[field];
        return '<label class="field"><span>' + label + '</span><input type="' + type + '" data-med-field="' + field + '" data-med-id="' + esc(m.id) + '" value="' + esc(v) + '"' + (extra || '') + '></label>';
      };
      return '<details class="med-setting"' + (m.paused ? '' : '') + '><summary>' + esc(m.name) + (m.paused ? ' (paused)' : '') + '</summary>' +
        f('Name', 'name', 'text') +
        f('What it’s for', 'purpose', 'text') +
        f('Dose', 'dose', 'text') +
        f('Hours between doses', 'intervalHours', 'number', ' min="1" max="72" step="0.5" inputmode="decimal"') +
        f('How often (description)', 'schedule', 'text') +
        f('Required doses per 24h (leave blank if all are required; extra doses show as optional)', 'requiredPerDay', 'number', ' min="1" max="12" step="1" inputmode="numeric"') +
        '<label class="field"><span>Notes / vet instructions</span><textarea data-med-field="notes" data-med-id="' + esc(m.id) + '">' + esc(m.notes) + '</textarea></label>' +
        '<label class="check-field"><input type="checkbox" data-med-field="paused" data-med-id="' + esc(m.id) + '"' + (m.paused ? ' checked' : '') + '> Paused</label>' +
        f('Paused note', 'pausedNote', 'text') +
        '<button class="btn btn-danger btn-small" data-action="delete-med" data-id="' + esc(m.id) + '" style="margin-top:12px">Remove medication</button>' +
        '</details>';
    }).join('');
  }

  // Parts that change with time (safe to re-render while the user is typing elsewhere)
  function renderLive() {
    renderVetFlags();
    renderReview();
    renderMeds();
    renderLastPoo();
  }

  function renderToday() {
    renderLive();
    renderFollowups();
    renderNotifyStatus();
  }

  function renderAll() {
    renderToday();
    renderLog();
    renderSymptomSummary();
  }

  /* ---------- tick: clocks & countdowns ---------- */
  function tick() {
    var now = Date.now();
    $('#clock').textContent = fmtTime(new Date(now));
    var needsRender = false;
    document.querySelectorAll('.med[data-med]').forEach(function (card) {
      var med = medById(card.getAttribute('data-med'));
      if (med && medStatus(med, now).state !== card.getAttribute('data-state')) needsRender = true;
    });
    var rc = document.querySelector('[data-review-countdown]');
    if (rc) {
      var t = +rc.getAttribute('data-review-countdown');
      if (now >= t) needsRender = true;
      else rc.textContent = 'in ' + fmtDuration(t - now);
    }
    if (needsRender) { renderLive(); }
    document.querySelectorAll('[data-countdown]').forEach(function (el) {
      el.textContent = fmtDuration(Math.abs(+el.getAttribute('data-countdown') - now));
    });
    checkNotifications(now);
  }

  /* ---------- notifications ---------- */
  var swReg = null;
  function notify(title, body, tag) {
    var opts = { body: body, tag: tag, renotify: true, requireInteraction: true };
    try {
      if (swReg && swReg.showNotification) { swReg.showNotification(title, opts); return; }
      new Notification(title, opts);
    } catch (e) {
      console.warn('Notification failed', e);
    }
  }

  function checkNotifications(now) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var changed = false;
    state.meds.forEach(function (med) {
      var st = medStatus(med, now);
      if (st.state !== 'overdue' && st.state !== 'optional') return;
      var key = med.id + '@' + st.next;
      if (state.notified[key]) return;
      // Don't fire for doses that were due a long time ago (e.g. reopening the app days later) more than once.
      state.notified[key] = true;
      changed = true;
      notify('💊 ' + med.name + (st.state === 'optional' ? ' — optional dose' : ' is due'),
        med.dose + '. Due ' + fmtDayTime(new Date(st.next)) + '. Tap “Given now” once given.', 'dose-' + med.id);
    });
    if (changed) {
      // keep the notified map small
      var keys = Object.keys(state.notified);
      if (keys.length > 200) keys.slice(0, keys.length - 200).forEach(function (k) { delete state.notified[k]; });
      save();
    }
  }

  $('#btn-notify').addEventListener('click', function () {
    if (!('Notification' in window)) return;
    var p = Notification.requestPermission(function () { renderNotifyStatus(); });
    if (p && p.then) p.then(function (res) {
      renderNotifyStatus();
      if (res === 'granted') notify('Portia Meds', 'Notifications are on. Keep the app open so reminders can fire.', 'test');
    });
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').then(function (reg) { swReg = reg; }).catch(function (e) {
      console.warn('Service worker registration failed', e);
    });
  }

  /* ---------- export / import ---------- */
  function exportData() {
    var data = JSON.parse(JSON.stringify(state));
    data.exportedAt = new Date().toISOString();
    data.app = 'portia-meds';
    var ids = state.symptoms.filter(function (s) { return s.photoId; }).map(function (s) { return s.photoId; });
    if (!ids.length) { finishExport(data); return; }
    toast('Preparing export with photos…');
    photoEntries().then(function (all) {
      var photos = {};
      return Promise.all(ids.map(function (id) {
        if (!all[id]) return null;
        return blobToDataURL(all[id]).then(function (u) { photos[id] = u; });
      })).then(function () { data.photos = photos; finishExport(data); });
    }).catch(function () {
      alert('Photos could not be read, so the export will contain the log only.');
      finishExport(data);
    });
  }
  function finishExport(data) {
    var json = JSON.stringify(data, null, 2);
    var name = 'portia-meds-' + toDateInput(new Date()) + '-' + pad(new Date().getHours()) + pad(new Date().getMinutes()) + '.json';
    var blob = new Blob([json], { type: 'application/json' });
    try {
      var file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Portia Meds log' }).catch(function (e) {
          if (e && e.name !== 'AbortError') download(blob, name);
        });
        return;
      }
    } catch (e) { /* fall through to download */ }
    download(blob, name);
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    toast('Exported ' + name);
  }

  function mergeById(local, incoming, preferNewer) {
    var map = {};
    local.forEach(function (x) { map[x.id] = x; });
    incoming.forEach(function (x) {
      if (!x || !x.id) return;
      var cur = map[x.id];
      if (!cur) { map[x.id] = x; local.push(x); return; }
      if (preferNewer && x.updatedAt && (!cur.updatedAt || x.updatedAt > cur.updatedAt)) {
        var idx = local.indexOf(cur);
        local[idx] = x; map[x.id] = x;
      }
    });
    return local;
  }

  function importFile(input, mode) {
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { alert('That file is not valid JSON.'); return; }
      if (!data || !Array.isArray(data.doses) || !Array.isArray(data.meds)) { alert('That does not look like a Portia Meds export.'); return; }
      var incoming = normalise(data);
      var photos = (data.photos && typeof data.photos === 'object') ? data.photos : {};
      var storePhotos = function () {
        Object.keys(photos).forEach(function (id) {
          var blob = dataURLToBlob(photos[id]);
          if (!blob) return;
          getPhoto(id).then(function (existing) {
            if (!existing || mode === 'replace') return putPhoto(id, blob).then(function () { renderLog(); });
          }).catch(function () {});
        });
      };
      if (mode === 'replace') {
        if (!confirm('Replace ALL data on this device with the file? This cannot be undone.')) return;
        state = incoming;
        clearPhotos().catch(function () {}).then(storePhotos);
      } else {
        storePhotos();
        var before = state.doses.length + state.symptoms.length;
        mergeById(state.doses, incoming.doses, true);
        mergeById(state.symptoms, incoming.symptoms, true);
        mergeById(state.meds, incoming.meds, true);
        mergeById(state.followups, incoming.followups, true);
        state.reviewDone = state.reviewDone || incoming.reviewDone;
        var added = state.doses.length + state.symptoms.length - before;
        toast('Merged — ' + added + ' new entr' + (added === 1 ? 'y' : 'ies') + ' added');
      }
      save();
      renderAll();
      renderSettings();
      if (mode === 'replace') toast('Data replaced from file');
    };
    reader.readAsText(file);
  }

  $('#btn-export').addEventListener('click', exportData);
  $('#import-merge').addEventListener('change', function (e) { importFile(e.target, 'merge'); });
  $('#import-replace').addEventListener('change', function (e) { importFile(e.target, 'replace'); });

  $('#btn-reset').addEventListener('click', function () {
    if (!confirm('Delete ALL Portia Meds data on this device? Export a backup first if you might need it.')) return;
    if (!confirm('Really delete everything?')) return;
    state = freshState();
    clearPhotos().catch(function () {});
    save(); renderAll(); renderSettings();
    toast('All data deleted');
  });

  /* ---------- event wiring ---------- */
  document.addEventListener('click', function (e) {
    var sym = e.target.closest('[data-symptom]');
    if (sym) { logSymptom(sym.getAttribute('data-symptom')); return; }
    var ph = e.target.closest('[data-view-photo]');
    if (ph) { viewPhoto(ph.getAttribute('data-view-photo')); return; }
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    switch (btn.getAttribute('data-action')) {
      case 'given': givenNow(id); break;
      case 'earlier': givenEarlier(id); break;
      case 'edit-last': editEntry('dose', id); break;
      case 'edit-entry': editEntry(btn.getAttribute('data-kind'), id); break;
      case 'review-done': state.reviewDone = true; save(); renderToday(); break;
      case 'review-undo': state.reviewDone = false; save(); renderToday(); break;
      case 'delete-med':
        var med = medById(id);
        if (med && confirm('Remove ' + med.name + '? Its logged doses stay in the history.')) {
          state.meds.splice(state.meds.indexOf(med), 1);
          save(); renderSettings(); renderAll();
        }
        break;
    }
  });

  // Follow-up edits
  document.addEventListener('change', function (e) {
    var t = e.target;
    var fid = t.getAttribute('data-fu-done') || t.getAttribute('data-fu-date');
    if (fid) {
      var fu = state.followups.filter(function (f) { return f.id === fid; })[0];
      if (!fu) return;
      if (t.hasAttribute('data-fu-done')) fu.done = t.checked;
      else if (t.value) fu.date = t.value;
      fu.updatedAt = new Date().toISOString();
      save(); renderFollowups();
      return;
    }
    var field = t.getAttribute('data-med-field');
    if (field) {
      var med = medById(t.getAttribute('data-med-id'));
      if (!med) return;
      if (field === 'paused') med.paused = t.checked;
      else if (field === 'intervalHours') med.intervalHours = Math.max(0.5, parseFloat(t.value) || 8);
      else if (field === 'requiredPerDay') med.requiredPerDay = t.value ? Math.max(1, parseInt(t.value, 10)) : null;
      else med[field] = t.value.trim();
      med.updatedAt = new Date().toISOString();
      save(); renderAll();
      if (field === 'paused' || field === 'name') renderSettings();
      toast('Saved');
    }
  });

  $('#btn-add-med').addEventListener('click', function () {
    var m = {
      id: 'med-' + uid(), name: 'New medication', purpose: '', dose: '', intervalHours: 8,
      schedule: '', requiredPerDay: null, notes: '', paused: false, pausedNote: '', updatedAt: new Date().toISOString()
    };
    state.meds.push(m);
    save(); renderSettings(); renderAll();
    var all = document.querySelectorAll('.med-setting');
    var last = all[all.length - 1];
    if (last) { last.open = true; last.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });

  $('#log-filter').addEventListener('change', renderLog);

  // Tabs
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var view = tab.getAttribute('data-view');
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
      document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
      if (view === 'settings') renderSettings();
      else renderAll();
      window.scrollTo(0, 0);
    });
  });

  // Sync between tabs / reopen
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) { state = load(); renderAll(); renderSettings(); }
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { renderAll(); tick(); }
  });

  /* ---------- init ---------- */
  // Ask the browser not to evict our data (log + photos) when space is low.
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  $('#symptom-buttons').innerHTML = symptomButtonsHtml();
  $('#symptom-buttons-today').innerHTML = symptomButtonsHtml();
  save();
  renderAll();
  renderSettings();
  tick();
  setInterval(tick, 1000);
  setInterval(renderLive, 60 * 1000); // refresh relative times
})();
