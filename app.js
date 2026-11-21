/* Poorly Pet — plain JS, all data in localStorage.
   NOTE: storage names below still say 'portiaMeds' on purpose — changing them would hide existing data. */
(function () {
  'use strict';

  var STORAGE_KEY = 'portiaMeds.v1';
  var HOUR = 3600 * 1000;
  var DAY = 24 * HOUR;
  var SOON_MS = 30 * 60 * 1000; // "due soon" window
  var REVIEW_HOURS = 48;

  // Ids are kept from earlier versions so existing log entries still match.
  // 'legacyLabel' is shown for entries logged before the detail fields existed.
  // 'hidden' types no longer have a button but still display (and count) in the log.
  var SYMPTOMS = [
    { id: 'poo_normal', label: 'Pooed', short: 'Poo', legacyLabel: 'Pooed', emoji: '💩', tone: 'good', photo: true },
    { id: 'wee_normal', label: 'Weed', short: 'Wee', legacyLabel: 'Weed normally', emoji: '🚽', tone: 'good', photo: true },
    { id: 'vomited', label: 'Vomited', short: 'Vomit', emoji: '🤮', tone: 'bad', photo: true },
    { id: 'ate_well', label: 'Ate food', short: 'Food', legacyLabel: 'Ate well', emoji: '🍽️', tone: 'good' },
    { id: 'drank', label: 'Drank water', short: 'Water', emoji: '💧', tone: 'good' },
    { id: 'check', label: 'Visual check', short: 'Check', emoji: '👀', tone: 'good' },
    { id: 'strained', label: 'Strained', emoji: '😣', tone: 'bad', hidden: true },
    { id: 'blood_wee', label: 'Blood in wee', emoji: '🩸', tone: 'bad', hidden: true },
    { id: 'diarrhoea', label: 'Diarrhoea', emoji: '🟤', tone: 'bad', hidden: true },
    { id: 'wee_nothing', label: 'Strained to wee, nothing came', emoji: '🚫', tone: 'bad', hidden: true }
  ];

  // Detail options for each entry type. 'def' is preselected for NEW entries only.
  var HELP_FIELD = { name: 'help', label: 'On her own?', options: [
    { value: 'own', label: 'On her own', text: 'on her own' },
    { value: 'helped', label: 'Needed help', text: 'needed human help' }] };
  var BLOOD_FIELD = { name: 'blood', label: 'Blood', bool: true, def: 'no', options: [
    { value: 'no', label: 'No blood', text: 'no blood' },
    { value: 'yes', label: 'With blood 🩸', text: 'WITH BLOOD', bad: true }] };
  function amountField() {
    return { name: 'amount', label: 'Amount', options: [
      { value: 'Small', label: 'Small', text: 'small amount' },
      { value: 'Medium', label: 'Medium', text: 'medium amount' },
      { value: 'Large', label: 'Large', text: 'large amount' }] };
  }
  var ENTRY_FIELDS = {
    poo_normal: [
      { name: 'consistency', label: 'Type', def: 'Solid', options: [
        { value: 'Solid', label: 'Solid', text: 'solid' },
        { value: 'Diarrhoea', label: 'Diarrhoea', text: 'DIARRHOEA', bad: true }] },
      BLOOD_FIELD, HELP_FIELD],
    wee_normal: [
      { name: 'amount', label: 'Amount', options: [
        { value: 'Small', label: 'Small', text: 'small amount' },
        { value: 'Medium', label: 'Medium', text: 'medium amount' },
        { value: 'Large', label: 'Large', text: 'large amount' }] },
      BLOOD_FIELD, HELP_FIELD],
    ate_well: [
      { name: 'food', label: 'Food', options: [
        { value: 'Wet', label: 'Wet food', text: 'wet food' },
        { value: 'Dry', label: 'Dry food', text: 'dry food' },
        { value: 'Both', label: 'Both', text: 'wet and dry food' }] },
      HELP_FIELD],
    drank: [amountField(), HELP_FIELD],
    // Owner's visual check. 'score' (1-5) feeds the health trend graph. Extras are recorded but not scored.
    check: [
      { name: 'level', label: 'How does she look?', required: true, stack: true, options: [
        { value: 'Very tired', label: 'Very tired', text: 'very tired', score: 1, bad: true },
        { value: 'Low energy', label: 'Low energy', text: 'low energy', score: 2, bad: true },
        { value: 'Normal', label: 'Normal', text: 'normal', score: 3 },
        { value: 'Bright', label: 'Bright', text: 'bright', score: 4 },
        { value: 'Energetic & happy', label: 'Energetic & happy', text: 'energetic & happy', score: 5 }] },
      { name: 'extras', label: 'Also noticed (optional)', multi: true, options: [
        { value: 'Hiding', label: 'Hiding', text: 'hiding', bad: true },
        { value: 'Playful', label: 'Playful', text: 'playful' },
        { value: 'Grooming well', label: 'Grooming well', text: 'grooming well' },
        { value: 'Off her food', label: 'Off her food', text: 'off her food', bad: true }] }
    ]
  };
  function checkScore(e) {
    var o = ENTRY_FIELDS.check[0].options.filter(function (x) { return x.value === e.level; })[0];
    return o ? o.score : null;
  }
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

  function defaultTrend() {
    return { weeGapHours: 24, pooGapHours: 48, v: 2 };
  }
  // The first version saved its untouched default (wee 12h) on the phone. Switch that to the new
  // default once; anything else the user set is kept. Only these two settings are touched, never the log.
  function migrateTrend(t) {
    if (!t || typeof t !== 'object') return defaultTrend();
    var out = {};
    Object.keys(t).forEach(function (k) { out[k] = t[k]; });
    if (!out.v) {
      if (Number(out.weeGapHours) === 12) out.weeGapHours = 24;
      out.v = 2;
    }
    return out;
  }

  function defaultProfile() {
    return { petName: 'Portia', vetName: 'Avondale, Warwick', vetPhone: '01926 400 255' };
  }

  function freshState() {
    return {
      version: 1,
      meds: defaultMeds(),
      doses: [],      // {id, medId, time, dose, note}
      symptoms: [],   // {id, type, time, note}
      followups: defaultFollowups(),
      reviewDone: false,
      notified: {},   // key -> true, to avoid repeat notifications
      profile: defaultProfile(),
      trend: defaultTrend()
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
      notified: (s.notified && typeof s.notified === 'object') ? s.notified : {},
      profile: (s.profile && typeof s.profile === 'object') ? s.profile : defaultProfile(),
      trend: migrateTrend(s.trend)
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

  /* ---------- no future entries ---------- */
  // Logging records what has already happened, so every log time must be now or earlier.
  // (Upcoming doses, the 48-hour review and follow-up dates are schedules, not log entries.)
  var FUTURE_MSG = "You can't log something in the future. Please choose now or an earlier time.";
  function isFuture(localValue) {
    var t = fromLocalInput(localValue);
    return !!t && t.getTime() > Date.now();
  }
  function timeFieldHtml(label, value) {
    return '<label class="field"><span>' + label + '</span><input type="datetime-local" name="time" required data-no-future max="' +
      toLocalInput(new Date()) + '" value="' + value + '"></label>' +
      '<div class="dialog-error hidden" data-future-msg role="alert"></div>';
  }
  // Refresh the max (a dialog may have been open a while), mark the field invalid and show the message.
  function checkNoFuture(input) {
    var bad = isFuture(input.value);
    input.max = toLocalInput(new Date());
    input.setCustomValidity(bad ? FUTURE_MSG : '');
    var box = document.querySelector('#dialog-body [data-future-msg]');
    if (box) { box.textContent = bad ? FUTURE_MSG : ''; box.classList.toggle('hidden', !bad); }
    return !bad;
  }
  function onTimeEdit(ev) {
    if (ev.target.matches && ev.target.matches('input[data-no-future]')) checkNoFuture(ev.target);
  }
  $('#dialog-body').addEventListener('input', onTimeEdit);
  $('#dialog-body').addEventListener('change', onTimeEdit);
  // Runs before the form validates, so a stale max can't let a future time through.
  $('#dialog-ok').addEventListener('click', function () {
    document.querySelectorAll('#dialog-body input[data-no-future]').forEach(checkNoFuture);
  }, true);

  /* ---------- dose logging ---------- */
  // Dose picker: 0.1 - 3.0 ml. The "remembered" dose is simply the last logged dose for that
  // medication (read from the log, so nothing extra is stored). No doses yet -> 0.5 ml.
  var DOSE_OPTIONS = [];
  for (var di = 1; di <= 30; di++) DOSE_OPTIONS.push(di / 10);
  var DEFAULT_DOSE_ML = 0.5;
  var pendingDose = {};   // medId -> amount picked on the tile but not given yet

  function roundDose(a) { return Math.round(a * 10) / 10; }
  function doseAmountOf(d) {
    if (typeof d.amountMl === 'number' && isFinite(d.amountMl)) return d.amountMl;
    var m = /(\d+(?:\.\d+)?)\s*ml/i.exec(d.dose || '');   // older entries: "0.4 ml by mouth"
    return m ? parseFloat(m[1]) : null;
  }
  function defaultDoseFor(medId) {
    var last = lastDose(medId);
    var a = last ? doseAmountOf(last) : null;
    if (a == null) return DEFAULT_DOSE_ML;
    a = roundDose(a);
    return (a >= 0.1 && a <= 3.0) ? a : DEFAULT_DOSE_ML;
  }
  function selectedDose(medId) {
    return pendingDose[medId] != null ? pendingDose[medId] : defaultDoseFor(medId);
  }
  function doseText(med, amt) {
    var m = /^\s*\d+(?:\.\d+)?\s*ml\b(.*)$/i.exec((med && med.dose) || '');
    return amt.toFixed(1) + ' ml' + (m ? m[1] : ' by mouth');
  }
  function doseSelectHtml(attrs, current, firstOption, bare) {
    var h = '<select ' + attrs + '>' + (firstOption || '');
    DOSE_OPTIONS.forEach(function (v) {
      h += '<option value="' + v.toFixed(1) + '"' + (Math.abs(v - current) < 0.001 ? ' selected' : '') + '>' + v.toFixed(1) + (bare ? '' : ' ml') + '</option>';
    });
    return h + '</select>';
  }

  function logDose(medId, time, note, amount) {
    if (time.getTime() > Date.now() + 1000) { alert(FUTURE_MSG); return null; }   // last line of defence
    var med = medById(medId);
    var amt = (typeof amount === 'number' && isFinite(amount)) ? amount : selectedDose(medId);
    var dose = { id: uid(), medId: medId, time: time.toISOString(), dose: doseText(med, amt), amountMl: amt, note: note || '' };
    state.doses.push(dose);
    delete pendingDose[medId];
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
    var dose = logDose(medId, new Date(), '', selectedDose(medId));
    toast(med.name + ' ' + dose.amountMl.toFixed(1) + ' ml logged at ' + fmtTime(new Date(dose.time)), 'Edit', function () { editEntry('dose', dose.id); });
  }

  function givenEarlier(medId) {
    var med = medById(medId);
    var body =
      '<p class="muted">Use this if you gave ' + esc(med.name) + ' earlier and are logging it late.</p>' +
      timeFieldHtml('Time given', toLocalInput(new Date())) +
      '<label class="field"><span>Dose</span>' + doseSelectHtml('name="doseml"', selectedDose(medId)) + '</label>' +
      '<label class="field"><span>Note (optional)</span><textarea name="note" placeholder="e.g. took it with food, spat some out"></textarea></label>';
    openDialog('Log ' + med.name + ' at another time', body, function (rv, dlg) {
      if (rv !== 'ok') return;
      var tval = dlg.querySelector('[name=time]').value;
      var t = fromLocalInput(tval);
      if (!t) return;
      if (isFuture(tval)) { alert(FUTURE_MSG); return; }
      var amt = parseFloat(dlg.querySelector('[name=doseml]').value);
      if (!logDose(medId, t, dlg.querySelector('[name=note]').value.trim(), amt)) return;
      toast(med.name + ' ' + amt.toFixed(1) + ' ml logged for ' + fmtDayTime(t));
    }, 'Log dose');
  }

  function editEntry(kind, id) {
    var list = kind === 'dose' ? state.doses : state.symptoms;
    var entry = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) entry = list[i];
    if (!entry) return;
    if (kind === 'symptom') { symptomDialog(entry.type, entry); return; }
    var title, extra = '', med = null, curDose = null, doseInList = false;
    if (kind === 'dose') {
      med = medById(entry.medId);
      title = 'Edit ' + (med ? med.name : 'dose');
      var raw = doseAmountOf(entry);
      curDose = raw == null ? null : roundDose(raw);
      doseInList = curDose != null && curDose >= 0.1 && curDose <= 3.0;
      // Entries whose dose isn't on the 0.1-3.0 list keep their text unless a new value is picked.
      var keepOpt = doseInList ? '' : '<option value="" selected>' + esc(entry.dose || 'Not recorded') + ' (unchanged)</option>';
      extra = '<label class="field"><span>Dose given</span>' + doseSelectHtml('name="doseml"', doseInList ? curDose : -1, keepOpt) + '</label>';
    } else {
      var sym = SYMPTOM_BY_ID[entry.type];
      title = 'Edit: ' + (sym ? sym.label : entry.type);
    }
    var body =
      timeFieldHtml('Time', toLocalInput(new Date(entry.time))) +
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
      var tv = dlg.querySelector('[name=time]').value;
      if (isFuture(tv)) { alert(FUTURE_MSG); return; }
      var t = fromLocalInput(tv);
      if (t && tv !== toLocalInput(new Date(entry.time))) entry.time = t.toISOString();
      entry.note = dlg.querySelector('[name=note]').value.trim();
      var doseEl = dlg.querySelector('[name=doseml]');
      // Only touch the dose if a different amount was picked (so opening + saving never changes old entries).
      if (doseEl && doseEl.value !== '' && (!doseInList || parseFloat(doseEl.value) !== curDose)) {
        entry.amountMl = parseFloat(doseEl.value);
        entry.dose = doseText(med, entry.amountMl);
      }
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
  function fieldValue(e, f) {
    if (f.bool) return e[f.name] === true ? 'yes' : (e[f.name] === false ? 'no' : '');
    return e[f.name] || '';
  }
  // { label, parts: [{text, bad}] } describing an entry; old entries keep their old wording.
  function entryInfo(e) {
    var sym = SYMPTOM_BY_ID[e.type] || { label: e.type, emoji: '•' };
    var fields = ENTRY_FIELDS[e.type] || [];
    var parts = [];
    fields.forEach(function (f) {
      var vals = f.multi ? (Array.isArray(e[f.name]) ? e[f.name] : []) : [fieldValue(e, f)];
      vals.forEach(function (v) {
        var opt = f.options.filter(function (o) { return o.value === v; })[0];
        if (opt) parts.push({ text: opt.text, bad: !!opt.bad });
      });
    });
    var label = (fields.length && !parts.length && sym.legacyLabel) ? sym.legacyLabel : sym.label;
    return { sym: sym, label: label, parts: parts };
  }
  function symptomTitle(e) {
    var info = entryInfo(e);
    return info.sym.emoji + ' ' + esc(info.label) + (info.parts.length ? ' — ' + info.parts.map(function (p) {
      return p.bad ? '<span class="blood">' + esc(p.text) + '</span>' : esc(p.text);
    }).join(', ') : '');
  }
  function symptomPlain(e) {
    var info = entryInfo(e);
    return info.label + (info.parts.length ? ' - ' + info.parts.map(function (p) { return p.text; }).join(', ') : '');
  }
  function isConcerning(e) {
    if (['blood_wee', 'wee_nothing', 'diarrhoea', 'vomited', 'strained'].indexOf(e.type) !== -1) return true;
    return entryInfo(e).parts.some(function (p) { return p.bad; });
  }
  function isDiarrhoea(e) { return e.type === 'diarrhoea' || (e.type === 'poo_normal' && e.consistency === 'Diarrhoea'); }

  // Radio buttons (one choice) or checkboxes (f.multi), drawn as big tappable buttons.
  function segHtml(name, options, current, f) {
    f = f || {};
    return '<div class="seg' + (f.stack ? ' stack' : '') + (f.multi ? ' multi' : '') + '" role="' + (f.multi ? 'group' : 'radiogroup') + '">' + options.map(function (o) {
      var id = 'seg-' + name + '-' + String(o.value).replace(/[^A-Za-z0-9]+/g, '_');
      var on = f.multi ? (current || []).indexOf(o.value) !== -1 : current === o.value;
      return '<input type="' + (f.multi ? 'checkbox' : 'radio') + '" name="' + name + '" id="' + id + '" value="' + esc(o.value) + '"' +
        (on ? ' checked' : '') + (f.required && !f.multi ? ' required' : '') + '>' +
        '<label for="' + id + '" class="' + (o.bad ? 'bad' : '') + '">' +
        (o.score ? '<span class="seg-score">' + o.score + '</span>' : '') + esc(o.label) + '</label>';
    }).join('') + '</div>';
  }

  // Dialog for logging a new symptom (entry == null) or editing an existing one.
  var pendingPhoto = null; // { blob } new photo chosen, or { remove: true }
  function symptomDialog(type, entry) {
    var isNew = !entry;
    var sym = SYMPTOM_BY_ID[type] || { label: type };
    var fields = ENTRY_FIELDS[type] || [];
    pendingPhoto = null;
    var initialTime = toLocalInput(isNew ? new Date() : new Date(entry.time));
    var body = timeFieldHtml('Time', initialTime);
    fields.forEach(function (f) {
      var current = f.multi ? (isNew ? [] : (entry[f.name] || [])) : (isNew ? (f.def || '') : fieldValue(entry, f));
      body += '<div class="field"><span>' + esc(f.label) + '</span>' + segHtml(f.name, f.options, current, f) + '</div>';
    });
    var hasPhoto = !!(entry && entry.photoId);
    if (sym.photo || hasPhoto) body += '<div class="field"><span>Photo (optional)</span>' +
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
      if (isFuture(timeVal)) { alert(FUTURE_MSG); return; }
      var t = fromLocalInput(timeVal);
      // Only change the stored time if it was edited (keeps the exact original seconds otherwise).
      if (t && timeVal !== initialTime) e.time = t.toISOString();
      e.note = dlg.querySelector('[name=note]').value.trim();
      // Only write fields that were actually chosen, so editing an older entry never adds data to it.
      fields.forEach(function (f) {
        if (f.multi) {
          var picked = [].slice.call(dlg.querySelectorAll('[name=' + f.name + ']:checked')).map(function (x) { return x.value; });
          if (picked.length || Array.isArray(e[f.name])) e[f.name] = picked;
          return;
        }
        var c = dlg.querySelector('[name=' + f.name + ']:checked');
        if (c) e[f.name] = f.bool ? c.value === 'yes' : c.value;
      });
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

  function logSymptom(type) { symptomDialog(type, null); }

  function symptomButtonsHtml(compact) {
    return SYMPTOMS.filter(function (s) { return !s.hidden; }).map(function (s) {
      return '<button class="symptom-btn ' + s.tone + '" data-symptom="' + s.id + '" aria-label="Log: ' + esc(s.label) + '">' +
        '<span class="emoji" aria-hidden="true">' + s.emoji + '</span><span class="sym-label">' + esc(compact && s.short ? s.short : s.label) + '</span></button>';
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
    symptomsSince(['wee_normal', 'poo_normal'], now - DAY).forEach(function (s) {
      if (s.blood === true) flags.push((s.type === 'wee_normal' ? 'Wee' : 'Poo') + ' with blood logged ' + fmtDayTime(new Date(s.time)) + ' — call the vet.');
    });
    var first = firstDoseTime();
    var lastPoo = lastSymptom(['poo_normal', 'diarrhoea']);
    var ref = lastPoo ? new Date(lastPoo.time).getTime() : (first ? first.getTime() : null);
    if (ref && now - ref > 48 * HOUR) {
      flags.push(lastPoo ? 'No poo logged since ' + fmtDayTime(new Date(lastPoo.time)) + ' — call the vet.'
        : 'No poo logged since the first dose (' + fmtDayTime(first) + ') — call the vet.');
    }
    $('#vet-flags').innerHTML = flags.map(function (f) { return '<div class="flag">' + esc(f) + '</div>'; }).join('');
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
      html += '<strong>48-hour review done</strong><span class="muted">' + esc(msg) + '</span>' +
        '<button class="btn btn-secondary btn-small" data-action="review-undo" style="margin-top:8px">Mark as not done</button>';
    } else if (due) {
      html += '<strong>48-hour review is due (since ' + esc(fmtDayTime(reviewAt)) + ')</strong>' + esc(msg) +
        '<button class="btn" data-action="review-done">Done — spoken to vet</button>';
    } else {
      html += '<strong>48-hour review: ' + esc(fmtDayTime(reviewAt)) + '</strong>' +
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
      var diar = symptomsSince(['diarrhoea', 'poo_normal'], now - DAY).filter(isDiarrhoea)
        .sort(function (a, b) { return new Date(a.time) - new Date(b.time); });
      if (diar.length) out.push({ bad: true, text: 'Diarrhoea logged ' + fmtDayTime(new Date(diar[diar.length - 1].time)) + ' — vet said STOP lactulose.' });
      var first = firstDoseTime();
      var poo = lastSymptom(['poo_normal', 'diarrhoea']);
      if (first && now - first.getTime() >= 48 * HOUR && (!poo || new Date(poo.time) < first)) {
        out.push({ bad: false, text: 'No poo logged by day 2 — vet said the dose can be increased to 1 ml (change it in Settings).' });
      }
    }
    if (st.optional && !med.notes) {
      out.push({ bad: false, text: 'Next dose is optional.' });
    }
    return out;
  }

  function statusPill(st) {
    switch (st.state) {
      case 'paused': return '<span class="pill paused">Paused</span>';
      case 'new': return '<span class="pill new">Not started</span>';
      case 'overdue': return '<span class="pill overdue">Overdue</span>';
      case 'optional': return '<span class="pill soon">Optional</span>';
      case 'soon': return '<span class="pill soon">Due soon</span>';
      default: return '<span class="pill ok">On track</span>';
    }
  }

  function fmtShort(ms) {
    var totalMin = Math.floor(Math.abs(ms) / 60000);
    var h = Math.floor(totalMin / 60), m = totalMin % 60;
    if (h > 0) return h + 'h ' + pad(m) + 'm';
    return m + 'm ' + pad(Math.floor(Math.abs(ms) / 1000) % 60) + 's';
  }
  function fmtWhen(d) {
    if (d.toDateString() === new Date().toDateString()) return fmtTime(d);
    return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + fmtTime(d);
  }

  // Compact, side-by-side timer tiles for active medications; paused ones as a single line.
  function renderMeds() {
    var ae = document.activeElement;
    if (ae && ae.classList && ae.classList.contains('dose-select')) return;   // don't close the open picker
    var now = Date.now();
    var tiles = '', paused = '';
    state.meds.forEach(function (med) {
      var st = medStatus(med, now);
      if (med.paused) {
        paused += '<div class="paused-row" data-med="' + esc(med.id) + '" data-state="paused"><strong>' + esc(med.name) + '</strong> ' +
          '<span class="pill paused">Paused</span> <span>' + esc(med.pausedNote || '') + '</span></div>';
        return;
      }
      var h = '<div class="med-tile state-' + st.state + '" data-med="' + esc(med.id) + '" data-state="' + st.state + '">';
      h += '<div class="tile-head"><span class="tile-name">' + esc(med.name) + '</span>' + statusPill(st) + '</div>';
      if (st.state === 'new') {
        h += '<div class="tile-label">Not started</div><div class="tile-meta">Tap “Given now” after the first dose</div>';
      } else {
        h += '<div class="tile-label"><span>' + (st.diff <= 0 ? 'Overdue by' : 'Due in') + '</span><span class="tile-n">' + st.count24 + ' in 24h</span></div>';
        h += '<div class="tile-count" data-countdown="' + st.next + '" data-fmt="short">' + fmtShort(st.diff) + '</div>';
        h += '<div class="tile-meta">Next <strong>' + esc(fmtWhen(new Date(st.next))) + '</strong></div>';
        h += '<div class="tile-meta">Last ' + esc(fmtWhen(new Date(st.lastT))) + (st.last.dose && st.last.dose !== med.dose ? ' (' + esc(st.last.dose) + ')' : '') + '</div>';
      }
      if (med.notes) h += '<div class="tile-note">' + esc(med.notes) + '</div>';
      medWarnings(med, st).forEach(function (w) {
        h += '<div class="tile-warn' + (w.bad ? ' bad' : '') + '">' + esc(w.text) + '</div>';
      });
      var rxM = /^\s*(\d+(?:\.\d+)?)\s*ml/i.exec(med.dose || '');
      var rxMl = rxM ? parseFloat(rxM[1]) : null;
      var curMl = selectedDose(med.id);
      h += '<div class="dose-pick">' +
        doseSelectHtml('class="dose-select" data-id="' + esc(med.id) + '" aria-label="Dose in ml for ' + esc(med.name) + '"', curMl, '', true) +
        '<span class="rx' + (rxMl != null && Math.abs(rxMl - curMl) > 0.001 ? ' diff' : '') + '"' + (rxMl != null ? ' data-ml="' + rxMl + '"' : '') +
        ' title="Vet dose, as set in Settings">ml' + (rxMl != null ? ' · vet ' + rxMl : '') + '</span></div>';
      h += '<button class="btn tile-given" data-action="given" data-id="' + esc(med.id) + '">Given now</button>';
      h += '<div class="tile-links"><button class="link-btn" data-action="earlier" data-id="' + esc(med.id) + '">Earlier time</button>';
      if (st.last) h += '<button class="link-btn" data-action="edit-last" data-id="' + esc(st.last.id) + '">Edit last</button>';
      h += '</div></div>';
      tiles += h;
    });
    $('#med-list').innerHTML = (tiles || paused) ? '<div class="med-grid">' + tiles + '</div>' + paused
      : '<div class="card muted">No medications. Add one in Settings.</div>';

    var overdue = state.meds.filter(function (m) { return medStatus(m, now).state === 'overdue'; });
    var banner = $('#overdue-banner');
    if (!banner) { /* tiles show overdue clearly */ } else if (overdue.length) {
      banner.textContent = 'Overdue: ' + overdue.map(function (m) { return m.name; }).join(', ');
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
    document.querySelector('.tab[data-view=today]').classList.toggle('has-alert', overdue.length > 0);
    document.title = overdue.length ? 'Dose overdue — Poorly Pet' : 'Poorly Pet';
  }

  function renderLastPoo() {
    var poo = lastSymptom(['poo_normal']);
    $('#last-poo').textContent = poo ? 'Last poo: ' + fmtDayTime(new Date(poo.time)) + ' (' + fmtAgo(Date.now() - new Date(poo.time)) + ')'
      : 'No poo logged yet.';
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
      el.textContent = 'Notifications are on. You will be alerted when a dose becomes due (while the app is open).';
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
    var html = SYMPTOMS.filter(function (s) { return !s.hidden || symptomsSince([s.id], since).length; }).map(function (s) {
      var list = symptomsSince([s.id], since);
      var last = list.length ? list.reduce(function (a, b) { return new Date(a.time) > new Date(b.time) ? a : b; }) : null;
      return '<div class="sym-summary-row"><span>' + s.emoji + ' ' + esc(s.label) + '</span><span><strong>' + list.length + '×</strong>' +
        (last ? ' <span class="muted">last ' + esc(fmtDayTime(new Date(last.time))) + '</span>' : '') + '</span></div>';
    }).join('');
    $('#symptom-summary').innerHTML = html;
  }

  /* ---------- rendering: Settings ---------- */
  function syncTrendInputs() {
    var lim = trendLimits();
    document.querySelectorAll('[data-trend-field]').forEach(function (inp) {
      if (document.activeElement !== inp) inp.value = lim[inp.getAttribute('data-trend-field')];
    });
  }

  function renderSettings() {
    syncTrendInputs();
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

  /* ---------- health trends ---------- */
  // A daily wellbeing score (0-100) worked out from the existing log. Nothing is stored for it
  // (only the two alert limits), so old entries are used as they are.
  var TREND = {
    weights: { check: 0.35, eat: 0.20, drink: 0.15, wee: 0.15, poo: 0.15 },
    eatTarget: 3,        // "meal points" that count as a full day (a meal she ate herself = 1, with help = 0.6)
    drinkTarget: 2,      // "drink points" for a full day (small 0.5, medium 0.75, large 1; with help x0.6)
    vomitPenalty: 10,    // points taken off per vomit...
    vomitPenaltyMax: 30, // ...up to this much
    awakeHours: 16,      // eating/drinking targets are scaled down for part-days (today, first day)
    good: 70, fair: 45   // score bands
  };
  var AMOUNT_FACTOR = { Small: 0.5, Medium: 0.75, Large: 1 };
  var LANES = [
    { kind: 'food', label: 'Food' }, { kind: 'water', label: 'Water' }, { kind: 'wee', label: 'Wee' },
    { kind: 'poo', label: 'Poo' }, { kind: 'vomit', label: 'Vomit' }, { kind: 'dose', label: 'Dose' }
  ];
  var trendRange = 7;
  var trendSel = null;   // index of the day picked on the chart (null = latest)

  function trendLimits() {
    var t = state.trend || {};
    var w = Number(t.weeGapHours), p = Number(t.pooGapHours);
    return { wee: w > 0 ? w : 24, poo: p > 0 ? p : 48 };
  }
  // Which timeline lane an activity belongs to. Older entry types still count.
  function eventKind(type) {
    switch (type) {
      case 'ate_well': return 'food';
      case 'drank': return 'water';
      case 'wee_normal': case 'blood_wee': return 'wee';
      case 'poo_normal': case 'diarrhoea': return 'poo';
      case 'vomited': return 'vomit';
      default: return null;
    }
  }
  function helpFactor(e) { return e.help === 'helped' ? 0.6 : 1; }
  // 1 while the gap is comfortably inside the limit, falling to 0 at twice the limit.
  function gapScore(hours, limit) {
    var r = hours / limit;
    if (r <= 0.5) return 1;
    if (r <= 1) return 1 - 0.4 * (r - 0.5) / 0.5;
    if (r < 2) return 0.6 * (2 - r);
    return 0;
  }
  function scoreBand(s) { return s >= TREND.good ? 'good' : (s >= TREND.fair ? 'fair' : 'poor'); }
  var BAND_LABEL = { good: 'Good', fair: 'Fair', poor: 'Poor' };

  function computeTrend(n) {
    var now = Date.now(), lim = trendLimits();
    var first = Infinity, times = {}, events = [];
    LANES.forEach(function (l) { times[l.kind] = []; });
    state.symptoms.forEach(function (s) {
      var t = new Date(s.time).getTime();
      if (isNaN(t)) return;
      if (t < first) first = t;
      var k = eventKind(s.type);
      if (k) { events.push({ kind: k, t: t }); times[k].push(t); }
    });
    state.doses.forEach(function (d) {
      var t = new Date(d.time).getTime();
      if (isNaN(t)) return;
      if (t < first) first = t;
      events.push({ kind: 'dose', t: t }); times.dose.push(t);
    });
    if (first === Infinity) return null;
    Object.keys(times).forEach(function (k) { times[k].sort(function (a, b) { return a - b; }); });

    // Longest stretch without an event inside [ws, we], counting from the last event before ws
    // (or from when tracking began if there wasn't one).
    function longestGap(arr, ws, we) {
      var cursor = first, i = 0, max = 0;
      for (; i < arr.length && arr[i] <= ws; i++) cursor = arr[i];
      for (; i < arr.length && arr[i] <= we; i++) { max = Math.max(max, arr[i] - cursor); cursor = arr[i]; }
      return Math.max(max, we - cursor) / HOUR;
    }
    function gapBands(arr, limH) {
      var out = [], cursor = first;
      function add(a, b) { var st = a + limH * HOUR; if (b > st) out.push([st, b]); }
      arr.forEach(function (t) { if (t <= now) { add(cursor, t); cursor = t; } });
      add(cursor, now);
      return out;
    }

    function scoreDay(dsD, deD) {
      var ds = dsD.getTime(), de = deD.getTime();
      var ws = Math.max(ds, first), we = Math.min(de, now);
      var day = { date: dsD, start: ds, end: de, hasData: false, score: null, warn: false };
      if (we <= ws) return day;
      var winH = (we - ws) / HOUR;
      var p = { checkSum: 0, checkN: 0, eatPts: 0, drinkPts: 0, food: 0, water: 0, wee: 0, poo: 0, vomit: 0, dose: 0, symptoms: 0, tags: [] };
      state.symptoms.forEach(function (s) {
        var t = new Date(s.time).getTime();
        if (!(t >= ds && t < de)) return;
        p.symptoms++;
        if (s.type === 'check' && Array.isArray(s.extras)) s.extras.forEach(function (x) { if (p.tags.indexOf(x) === -1) p.tags.push(x); });
        var sc = s.type === 'check' ? checkScore(s) : null;
        if (sc != null) { p.checkSum += sc; p.checkN++; }
        switch (eventKind(s.type)) {
          case 'food': p.eatPts += helpFactor(s); p.food++; break;
          case 'water': p.drinkPts += (AMOUNT_FACTOR[s.amount] || 0.75) * helpFactor(s); p.water++; break;
          case 'wee': p.wee++; break;
          case 'poo': p.poo++; break;
          case 'vomit': p.vomit++; break;
        }
      });
      state.doses.forEach(function (d) {
        var t = new Date(d.time).getTime();
        if (t >= ds && t < de) p.dose++;
      });
      // Not enough to judge a short part-day with nothing logged (e.g. just after midnight).
      if (winH < 6 && p.symptoms === 0) return day;

      var c = {};
      if (p.checkN) { p.checkAvg = p.checkSum / p.checkN; c.check = (p.checkAvg - 1) / 4; }
      var prog = Math.min(1, Math.max(0.25, winH / TREND.awakeHours));
      if (winH >= 6 || p.eatPts > 0) c.eat = Math.min(1, p.eatPts / (TREND.eatTarget * prog));
      if (winH >= 6 || p.drinkPts > 0) c.drink = Math.min(1, p.drinkPts / (TREND.drinkTarget * prog));
      p.weeGap = longestGap(times.wee, ws, we);
      p.pooGap = longestGap(times.poo, ws, we);
      c.wee = gapScore(p.weeGap, lim.wee);
      c.poo = gapScore(p.pooGap, lim.poo);
      var wsum = 0, tot = 0;
      Object.keys(c).forEach(function (k) { wsum += TREND.weights[k]; tot += TREND.weights[k] * c[k]; });
      p.penalty = Math.min(TREND.vomitPenaltyMax, p.vomit * TREND.vomitPenalty);
      day.score = Math.max(0, Math.min(100, Math.round(tot / wsum * 100 - p.penalty)));
      day.comp = c; day.p = p; day.hasData = true;
      day.weeOver = p.weeGap > lim.wee;
      day.pooOver = p.pooGap > lim.poo;
      day.warn = day.weeOver || day.pooOver;
      return day;
    }

    var t0 = new Date(now), today = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate());
    var days = [];
    for (var i = 0; i < n; i++) {
      var ds = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1 - i));
      var de = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate() + 1);
      days.push(scoreDay(ds, de));
    }
    function lastBefore(arr) { var v = null; arr.forEach(function (t) { if (t <= now) v = t; }); return v; }
    return {
      days: days, events: events, lim: lim, now: now, first: first,
      rs: days[0].start, re: days[n - 1].end,
      bands: { wee: gapBands(times.wee, lim.wee), poo: gapBands(times.poo, lim.poo) },
      lastWee: lastBefore(times.wee), lastPoo: lastBefore(times.poo)
    };
  }

  function fmtHM(ms) {
    var m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60);
    return h > 0 ? h + 'h ' + pad(m % 60) + 'm' : m + 'm';
  }
  function fmtGapH(h) { return fmtHM(h * HOUR); }
  function dayLong(d) { return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }); }
  function dayAxis(d, i, n, cw) {
    if (n <= 7) return cw >= 40 ? d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.getDate() : d.toLocaleDateString([], { weekday: 'short' });
    return ((n - 1 - i) % 5 === 0) ? d.getDate() + ' ' + d.toLocaleDateString([], { month: 'short' }) : '';
  }
  function selectedDayIndex(data) {
    if (trendSel != null && trendSel >= 0 && trendSel < data.days.length) return trendSel;
    for (var i = data.days.length - 1; i >= 0; i--) if (data.days[i].hasData) return i;
    return data.days.length - 1;
  }

  var CH = { L: 40, R: 8 };
  function scoreChartSvg(data, W, sel) {
    var n = data.days.length, T = 10, B = 24, H = 176;
    var pw = W - CH.L - CH.R, ph = H - T - B, cw = pw / n;
    var Y = function (v) { return T + ph * (1 - v / 100); };
    var cx = function (i) { return CH.L + cw * (i + 0.5); };
    var rad = n <= 7 ? 4.5 : 3;
    var s = '<svg class="chart" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Daily wellbeing score, 0 to 100, for the last ' + n + ' days">';
    s += '<rect class="band-poor" x="' + CH.L + '" y="' + Y(TREND.fair) + '" width="' + pw + '" height="' + (Y(0) - Y(TREND.fair)) + '"/>';
    s += '<rect class="band-fair" x="' + CH.L + '" y="' + Y(TREND.good) + '" width="' + pw + '" height="' + (Y(TREND.fair) - Y(TREND.good)) + '"/>';
    s += '<rect class="band-good" x="' + CH.L + '" y="' + Y(100) + '" width="' + pw + '" height="' + (Y(TREND.good) - Y(100)) + '"/>';
    [0, 25, 50, 75, 100].forEach(function (v) {
      s += '<line class="grid" x1="' + CH.L + '" x2="' + (W - CH.R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>';
      s += '<text x="' + (CH.L - 6) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end">' + v + '</text>';
    });
    data.days.forEach(function (d, i) {
      if (d.warn) s += '<rect class="warn-col" x="' + (CH.L + cw * i) + '" y="' + T + '" width="' + cw + '" height="' + ph + '"/>';
    });
    s += '<rect class="sel-col" x="' + (CH.L + cw * sel) + '" y="' + T + '" width="' + cw + '" height="' + ph + '"/>';
    var path = '', pen = false;
    data.days.forEach(function (d, i) {
      if (d.score == null) { pen = false; return; }
      path += (pen ? 'L' : 'M') + cx(i).toFixed(1) + ' ' + Y(d.score).toFixed(1) + ' ';
      pen = true;
    });
    if (path) s += '<path class="score-line" d="' + path + '"/>';
    data.days.forEach(function (d, i) {
      if (d.score == null) return;
      s += '<circle class="dot dot-' + scoreBand(d.score) + (d.warn ? ' dot-warn' : '') + '" cx="' + cx(i).toFixed(1) + '" cy="' + Y(d.score).toFixed(1) + '" r="' + rad + '"/>';
      if (d.warn) s += '<path class="warn-tri" d="M' + (cx(i) - 5) + ' ' + (T + 11) + 'L' + (cx(i) + 5) + ' ' + (T + 11) + 'L' + cx(i) + ' ' + (T + 2) + 'Z"/>';
    });
    data.days.forEach(function (d, i) {
      var lab = dayAxis(d.date, i, n, cw);
      var lastCol = n > 7 && i === n - 1;
      if (lab) s += '<text class="axis" x="' + (lastCol ? W - 2 : cx(i).toFixed(1)) + '" y="' + (H - 7) + '" text-anchor="' + (lastCol ? 'end' : 'middle') + '">' + esc(lab) + '</text>';
      s += '<rect class="hit" data-day="' + i + '" x="' + (CH.L + cw * i) + '" y="' + T + '" width="' + cw + '" height="' + (H - T) + '"><title>' +
        esc(dayLong(d.date) + (d.score != null ? ': ' + d.score + '/100' : ': no score yet')) + '</title></rect>';
    });
    return s + '</svg>';
  }

  function timelineSvg(data, W, sel) {
    var n = data.days.length, T = 6, B = 24, LH = 24;
    var H = T + LANES.length * LH + B, pw = W - CH.L - CH.R, cw = pw / n, span = data.re - data.rs;
    var X = function (t) { return CH.L + (t - data.rs) / span * pw; };
    var laneIdx = {}; LANES.forEach(function (l, i) { laneIdx[l.kind] = i; });
    var rad = n <= 7 ? 4.2 : 2.6;
    var s = '<svg class="chart" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Timeline of food, water, wee, poo, vomit and doses for the last ' + n + ' days">';
    LANES.forEach(function (l, i) {
      var y = T + i * LH;
      s += '<rect class="lane-bg' + (i % 2 ? ' alt' : '') + '" x="' + CH.L + '" y="' + y + '" width="' + pw + '" height="' + LH + '"/>';
      s += '<text x="' + (CH.L - 6) + '" y="' + (y + LH / 2 + 3.5) + '" text-anchor="end">' + l.label + '</text>';
    });
    s += '<rect class="sel-col" x="' + (CH.L + cw * sel) + '" y="' + T + '" width="' + cw + '" height="' + (LANES.length * LH) + '"/>';
    for (var i = 0; i <= n; i++) {
      s += '<line class="grid" x1="' + (CH.L + cw * i) + '" x2="' + (CH.L + cw * i) + '" y1="' + T + '" y2="' + (T + LANES.length * LH) + '"/>';
    }
    ['wee', 'poo'].forEach(function (k) {
      data.bands[k].forEach(function (b) {
        var a = Math.max(b[0], data.rs), z = Math.min(b[1], data.re);
        if (z <= a) return;
        s += '<rect class="gap-band" x="' + X(a).toFixed(1) + '" y="' + (T + laneIdx[k] * LH + 2) + '" width="' + Math.max(1, X(z) - X(a)).toFixed(1) + '" height="' + (LH - 4) + '"/>';
      });
    });
    data.events.forEach(function (ev) {
      if (ev.t < data.rs || ev.t >= data.re) return;
      s += '<circle class="ev ev-' + ev.kind + '" cx="' + X(ev.t).toFixed(1) + '" cy="' + (T + laneIdx[ev.kind] * LH + LH / 2) + '" r="' + rad + '"/>';
    });
    if (data.now >= data.rs && data.now <= data.re) {
      s += '<line class="now-line" x1="' + X(data.now).toFixed(1) + '" x2="' + X(data.now).toFixed(1) + '" y1="' + T + '" y2="' + (T + LANES.length * LH) + '"/>';
    }
    data.days.forEach(function (d, i) {
      var lab = dayAxis(d.date, i, n, cw);
      var lastCol = n > 7 && i === n - 1;
      if (lab) s += '<text class="axis" x="' + (lastCol ? W - 2 : (CH.L + cw * (i + 0.5)).toFixed(1)) + '" y="' + (H - 7) + '" text-anchor="' + (lastCol ? 'end' : 'middle') + '">' + esc(lab) + '</text>';
      s += '<rect class="hit" data-day="' + i + '" x="' + (CH.L + cw * i) + '" y="' + T + '" width="' + cw + '" height="' + (H - T) + '"><title>' + esc(dayLong(d.date)) + '</title></rect>';
    });
    return s + '</svg>';
  }

  function trendSummaryHtml(data) {
    var scored = data.days.filter(function (d) { return d.score != null; });
    var h = '';
    if (!scored.length) {
      h += '<p class="muted">Not enough logged yet to score a day. Log meals, drinks, wees, poos and a visual check and it will appear here.</p>';
    } else {
      var latest = scored[scored.length - 1], band = scoreBand(latest.score);
      var isToday = latest === data.days[data.days.length - 1];
      var k = Math.min(trendRange === 30 ? 7 : 3, Math.floor(scored.length / 2));
      var dir = null;
      if (scored.length >= 4 && k >= 1) {
        var avg = function (a) { return a.reduce(function (x, d) { return x + d.score; }, 0) / a.length; };
        var delta = avg(scored.slice(-k)) - avg(scored.slice(-2 * k, -k));
        dir = { delta: delta, kind: delta >= 5 ? 'up' : (delta <= -5 ? 'down' : 'flat') };
      }
      h += '<div class="trend-top"><div class="score-badge ' + band + '"><span class="score-num">' + latest.score + '</span><span class="score-of">/100</span></div>';
      h += '<div class="trend-meta">';
      if (dir) {
        h += '<div class="trend-dir ' + dir.kind + '">' + (dir.kind === 'up' ? '▲ Improving' : (dir.kind === 'down' ? '▼ Declining' : '▬ Steady')) + '</div>';
        h += '<div class="muted small">' + (dir.delta > 0 ? '+' : '') + Math.round(dir.delta) + ' points vs the previous ' + k + ' days</div>';
      } else {
        h += '<div class="trend-dir flat">Trend needs 4 days of data</div>';
      }
      h += '<div class="muted small">' + (isToday ? 'Today' : esc(dayLong(latest.date))) + ': ' + BAND_LABEL[band] + '</div></div></div>';
    }
    function chip(label, last, limit) {
      var ms = data.now - (last != null ? last : data.first);
      var over = ms > limit * HOUR;
      return '<div class="since-chip' + (over ? ' over' : '') + '"><span>' + label + '</span><strong>' +
        (last != null ? fmtHM(ms) : 'none logged') + '</strong><small>' + (over ? 'over the ' + limit + 'h limit' : 'limit ' + limit + 'h') + '</small></div>';
    }
    h += '<div class="since-row">' + chip('Since last wee', data.lastWee, data.lim.wee) + chip('Since last poo', data.lastPoo, data.lim.poo) + '</div>';
    return h;
  }

  function trendDetailHtml(day, lim) {
    var name = esc(dayLong(day.date));
    if (!day.hasData) return '<p class="muted small"><strong>' + name + '</strong> — nothing to score yet.</p>';
    var p = day.p, c = day.comp, band = scoreBand(day.score);
    var pct = function (v) { return v == null ? '–' : Math.round(v * 100) + '%'; };
    var row = function (label, value, comp, bad) {
      return '<div class="detail-row' + (bad ? ' bad' : '') + '"><span class="dl">' + label + '</span><span class="dv">' + value + '</span><span class="dp">' + pct(comp) + '</span></div>';
    };
    var h = '<div class="detail-head"><strong>' + name + '</strong><span class="band-chip ' + band + '">' + day.score + '/100 · ' + BAND_LABEL[band] + '</span></div>';
    if (day.warn) {
      var w = [];
      if (day.weeOver) w.push('no wee for ' + fmtGapH(p.weeGap) + ' (limit ' + lim.wee + 'h)');
      if (day.pooOver) w.push('no poo for ' + fmtGapH(p.pooGap) + ' (limit ' + lim.poo + 'h)');
      h += '<div class="flag">Over the limit: ' + esc(w.join('; ')) + '</div>';
    }
    h += row('Visual check', p.checkN ? p.checkAvg.toFixed(1) + ' / 5 (' + p.checkN + ' check' + (p.checkN === 1 ? '' : 's') + ')' : 'not logged (left out)', c.check);
    if (p.tags.length) h += '<div class="detail-row"><span class="dl">Tags</span><span class="dv">' + esc(p.tags.join(', ')) + '</span><span class="dp"></span></div>';
    h += row('Eating', p.food + ' logged', c.eat);
    h += row('Drinking', p.water + ' logged', c.drink);
    h += row('Wee', p.wee + ' logged · longest gap ' + fmtGapH(p.weeGap), c.wee, day.weeOver);
    h += row('Poo', p.poo + ' logged · longest gap ' + fmtGapH(p.pooGap), c.poo, day.pooOver);
    h += '<div class="detail-row' + (p.vomit ? ' bad' : '') + '"><span class="dl">Vomiting</span><span class="dv">' + (p.vomit ? p.vomit + ' · −' + p.penalty + ' points' : 'none') + '</span><span class="dp"></span></div>';
    h += '<div class="detail-row"><span class="dl">Doses given</span><span class="dv">' + p.dose + '</span><span class="dp"></span></div>';
    return h;
  }

  function renderTrends() {
    var view = $('#view-trends');
    if (!view || !view.classList.contains('active')) return;
    var data = computeTrend(trendRange);
    document.querySelectorAll('[data-trend-range]').forEach(function (b) {
      b.classList.toggle('active', +b.getAttribute('data-trend-range') === trendRange);
      b.setAttribute('aria-pressed', +b.getAttribute('data-trend-range') === trendRange ? 'true' : 'false');
    });
    var lm = trendLimits();
    var note = $('#trend-limits-note');
    if (note) note.innerHTML = 'Alert limits: no wee for <strong>' + lm.wee + 'h</strong>, no poo for <strong>' + lm.poo + 'h</strong>. ' +
      '<button type="button" class="link-btn inline" data-goto="settings">Change in Settings</button>';
    if (!data) {
      $('#trend-summary').innerHTML = '<p class="muted">Nothing logged yet. Once you log doses and activities, her trend will appear here.</p>';
      $('#trend-chart').innerHTML = ''; $('#trend-detail').innerHTML = ''; $('#timeline-chart').innerHTML = '';
      return;
    }
    var chartHost = $('#trend-chart');
    var W = Math.max(280, Math.floor(chartHost.clientWidth || view.clientWidth - 32 || 340));
    var sel = selectedDayIndex(data);
    $('#trend-summary').innerHTML = trendSummaryHtml(data);
    chartHost.innerHTML = scoreChartSvg(data, W, sel);
    $('#timeline-chart').innerHTML = timelineSvg(data, W, sel);
    $('#trend-detail').innerHTML = trendDetailHtml(data.days[sel], data.lim);
  }

  var trendResizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(trendResizeTimer);
    trendResizeTimer = setTimeout(renderTrends, 150);
  });

  /* ---------- pet & vet details ---------- */
  function telHref(phone) { return 'tel:' + String(phone || '').replace(/[^\d+]/g, ''); }
  function renderProfile() {
    var P = state.profile || defaultProfile();
    document.querySelectorAll('[data-pet-name]').forEach(function (el) { el.textContent = P.petName || ''; });
    document.querySelectorAll('[data-vet-call]').forEach(function (a) {
      a.href = telHref(P.vetPhone);
      a.classList.toggle('hidden', !P.vetPhone);
    });
    document.querySelectorAll('[data-vet-name]').forEach(function (el) { el.textContent = P.vetName || 'the vet'; });
    document.querySelectorAll('[data-vet-phone]').forEach(function (el) { el.textContent = P.vetPhone || ''; });
    document.querySelectorAll('[data-profile-field]').forEach(function (inp) {
      if (document.activeElement !== inp) inp.value = P[inp.getAttribute('data-profile-field')] || '';
    });
  }

  function renderAll() {
    renderProfile();
    renderToday();
    renderLog();
    renderSymptomSummary();
    renderTrends();
  }

  /* ---------- tick: clocks & countdowns ---------- */
  function tick() {
    var now = Date.now();
    $('#clock').textContent = fmtTime(new Date(now));
    var needsRender = false;
    document.querySelectorAll('[data-med][data-state]').forEach(function (card) {
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
      var ms = +el.getAttribute('data-countdown') - now;
      el.textContent = el.getAttribute('data-fmt') === 'short' ? fmtShort(ms) : fmtDuration(Math.abs(ms));
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
      notify(med.name + (st.state === 'optional' ? ' — optional dose' : ' is due'),
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
      if (res === 'granted') notify('Poorly Pet', 'Notifications are on. Keep the app open so reminders can fire.', 'test');
    });
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').then(function (reg) { swReg = reg; }).catch(function (e) {
      console.warn('Service worker registration failed', e);
    });
  }

  /* ---------- PDF report for the vet ---------- */
  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'vendor/jspdf.umd.min.js';
      s.onload = function () { window.jspdf ? resolve(window.jspdf.jsPDF) : reject(new Error('PDF library did not load.')); };
      s.onerror = function () { reject(new Error('Could not load the PDF library. Check your internet connection and try again.')); };
      document.head.appendChild(s);
    });
  }

  // The built-in PDF fonts only cover Latin-1, so swap typographic characters and drop emoji.
  function pt(s) {
    return String(s == null ? '' : s)
      .replace(/[   ]/g, ' ')
      .replace(/[–—]/g, '-')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/…/g, '...')
      .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, '')
      .replace(/ {2,}/g, ' ')
      .trim();
  }
  function pdfDate(d) {
    return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function pdfDateTime(d) { return pdfDate(d) + ' ' + fmtTime(d); }

  function pdfOptionsDialog() {
    var hasPhotos = state.symptoms.some(function (s) { return s.photoId; });
    var body =
      '<p class="muted">Makes a simple PDF timeline (oldest first) of medications and everything logged, to email or message to the vet.</p>' +
      '<label class="field"><span>Period</span><select name="range">' +
      '<option value="all">Everything logged</option><option value="2">Last 2 days</option>' +
      '<option value="3">Last 3 days</option><option value="7">Last 7 days</option><option value="14">Last 14 days</option></select></label>' +
      (hasPhotos ? '<label class="check-field"><input type="checkbox" name="photos" checked> Include photos</label>' : '');
    openDialog('PDF for the vet', body, function (rv, dlg) {
      if (rv !== 'ok') return;
      var range = dlg.querySelector('[name=range]').value;
      var ph = dlg.querySelector('[name=photos]');
      var opts = {
        from: range === 'all' ? 0 : Date.now() - Number(range) * DAY,
        rangeLabel: range === 'all' ? 'Everything logged' : 'Last ' + range + ' days',
        photos: !!(ph && ph.checked)
      };
      toast('Creating PDF…');
      buildPdf(opts).then(showPdfReady).catch(function (err) {
        console.error(err);
        alert('Sorry, the PDF could not be created: ' + (err && err.message ? err.message : err));
      });
    }, 'Create PDF');
  }

  function buildPdf(opts) {
    return loadJsPdf().then(function (JsPDF) {
      var inRange = function (e) { return new Date(e.time).getTime() >= opts.from; };
      var doses = state.doses.filter(inRange);
      var symptoms = state.symptoms.filter(inRange);
      var photoIds = opts.photos ? symptoms.filter(function (s) { return s.photoId; }).map(function (s) { return s.photoId; }) : [];
      var photosP = photoIds.length ? photoEntries().catch(function () { return {}; }) : Promise.resolve({});
      return photosP.then(function (blobs) {
        var urls = {};
        return Promise.all(photoIds.map(function (id) {
          return blobs[id] ? blobToDataURL(blobs[id]).then(function (u) { urls[id] = u; }) : null;
        })).then(function () { return renderPdf(JsPDF, opts, doses, symptoms, urls); });
      });
    });
  }

  // Simple layout: medications at the top, then the log as a timeline, oldest first, photos inline.
  function renderPdf(JsPDF, opts, doses, symptoms, photoData) {
    var doc = new JsPDF({ unit: 'mm', format: 'a4' });
    var M = 15, W = 210 - 2 * M, PAGE_H = 297, BOTTOM = PAGE_H - 16;
    var TIME_W = 24, TX = M + TIME_W, TW = W - TIME_W;
    var y = M;
    var RED = [180, 20, 30], GREY = [105, 105, 118], BLACK = [20, 20, 30];

    function newPage() { doc.addPage(); y = M; }
    function ensure(h) { if (y + h > BOTTOM) { newPage(); return true; } return false; }
    function setFont(style, size, color) {
      doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor.apply(doc, color || BLACK);
    }
    function lines(text, style, size, width) { setFont(style, size); return doc.splitTextToSize(pt(text), width); }
    function lh(size) { return size * 0.43; }

    // Title
    var P = state.profile || defaultProfile();
    setFont('bold', 18); doc.text(pt((P.petName || 'Pet') + ' - medication & activity log'), M, y + 5); y += 7;
    setFont('normal', 10, GREY);
    if (P.vetName || P.vetPhone) { doc.text(pt('Vet: ' + [P.vetName, P.vetPhone].filter(Boolean).join(' - ')), M, y + 3); y += 6; } else { y += 2; }
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* ignore */ }
    setFont('normal', 9, GREY);
    doc.text(pt('Created ' + pdfDateTime(new Date()) + '  |  ' + opts.rangeLabel + '  |  Times are local' + (tz ? ' (' + tz + ')' : '')), M, y); y += 8;

    // Medications
    setFont('bold', 13); doc.text('Medications', M, y); y += 6;
    state.meds.forEach(function (m) {
      var head = m.name + (m.purpose ? ' (' + m.purpose + ')' : '') + ': ' + (m.dose || '') + (m.schedule ? ', ' + m.schedule : '');
      var l1 = lines(head + (m.paused ? '  - PAUSED' : ''), 'bold', 10.5, W);
      var extra = m.paused ? (m.pausedNote || '') : (m.notes || '');
      var l2 = extra ? lines(extra, 'normal', 9.5, W - 4) : [];
      ensure(l1.length * lh(10.5) + l2.length * lh(9.5) + 3);
      setFont('bold', 10.5, m.paused ? GREY : BLACK);
      l1.forEach(function (ln) { y += lh(10.5); doc.text(ln, M, y); });
      setFont('normal', 9.5, GREY);
      l2.forEach(function (ln) { y += lh(9.5); doc.text(ln, M + 4, y); });
      y += 2.5;
    });
    y += 7;

    // Timeline
    var items = doses.map(function (d) { return { kind: 'dose', e: d }; })
      .concat(symptoms.map(function (s) { return { kind: 'symptom', e: s }; }))
      .sort(function (a, b) { return new Date(a.e.time) - new Date(b.e.time); });
    ensure(24);
    setFont('bold', 13); doc.text('Log (oldest first)', M, y); y += 3;
    if (!items.length) { y += 6; setFont('normal', 10, GREY); doc.text('Nothing logged in this period.', M, y); }

    function dayBar(text) {
      y += 4;
      doc.setFillColor(236, 233, 250); doc.rect(M, y, W, 7.5, 'F');
      setFont('bold', 11); doc.text(pt(text), M + 2, y + 5.2);
      y += 9.5;
    }
    var lastDay = '';
    items.forEach(function (it) {
      var e = it.e, d = new Date(e.time);
      var day = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      var title, detail = '', red = false;
      if (it.kind === 'dose') {
        var med = medById(e.medId);
        title = (med ? med.name : e.medId) + ' given' + (e.dose ? ' - ' + e.dose : '');
      } else {
        var info = entryInfo(e);
        title = info.label;
        detail = info.parts.map(function (p) { return p.text; }).join(', ');
        red = isConcerning(e);
      }
      var tl = lines(title, 'bold', 10.5, TW);
      var dl = detail ? lines(detail, 'normal', 10, TW) : [];
      var nl = e.note ? lines('Note: ' + e.note, 'italic', 9.5, TW) : [];
      var textH = tl.length * lh(10.5) + dl.length * lh(10) + nl.length * lh(9.5) + 4;

      var img = null;
      if (it.kind === 'symptom' && e.photoId && photoData[e.photoId]) {
        try {
          var props = doc.getImageProperties(photoData[e.photoId]);
          var s = Math.min(85 / props.width, 75 / props.height);
          img = { url: photoData[e.photoId], w: props.width * s, h: props.height * s };
        } catch (err) { img = null; }
      }
      var blockH = textH + (img ? img.h + 3 : 0);

      if (day !== lastDay) {
        ensure(14 + Math.min(blockH, 40));
        dayBar(day);
        lastDay = day;
      }
      if (y + blockH > BOTTOM) { newPage(); dayBar(day + ' (continued)'); }

      var top = y;
      setFont('bold', 10.5, red ? RED : BLACK);
      doc.text(pt(fmtTime(d)), M + 1, top + lh(10.5));
      tl.forEach(function (ln) { y += lh(10.5); doc.text(ln, TX, y); });
      setFont('normal', 10, red ? RED : BLACK);
      dl.forEach(function (ln) { y += lh(10); doc.text(ln, TX, y); });
      setFont('italic', 9.5, GREY);
      nl.forEach(function (ln) { y += lh(9.5); doc.text(ln, TX, y); });
      y += 2;
      if (img) {
        doc.addImage(img.url, 'JPEG', TX, y, img.w, img.h);
        y += img.h + 2;
      }
      y += 1;
      doc.setDrawColor(225, 223, 236); doc.setLineWidth(0.2); doc.line(TX, y, M + W, y);
      y += 1.5;
    });

    // Footer with page numbers
    var pages = doc.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i);
      setFont('normal', 8, GREY);
      doc.text(pt('Poorly Pet - ' + ((state.profile && state.profile.petName) || 'Pet') + ' medication & activity log'), M, PAGE_H - 8);
      doc.text('Page ' + i + ' of ' + pages, M + W, PAGE_H - 8, { align: 'right' });
    }
    var name = ((state.profile && state.profile.petName) || 'Pet').replace(/[^A-Za-z0-9]+/g, '-') + '-vet-log-' + toDateInput(new Date()) + '.pdf';
    return { blob: doc.output('blob'), name: name, pages: pages };
  }

  var lastPdf = null;
  function showPdfReady(pdf) {
    lastPdf = pdf;
    var canShare = false;
    try {
      canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([pdf.blob], pdf.name, { type: 'application/pdf' })] }));
    } catch (e) { canShare = false; }
    openDialog('PDF ready',
      '<p>' + esc(pdf.name) + ' — ' + pdf.pages + ' page' + (pdf.pages === 1 ? '' : 's') + ', ' + Math.max(1, Math.round(pdf.blob.size / 1024)) + ' KB.</p>' +
      (canShare ? '<button type="button" class="btn btn-big" id="pdf-share">📤 Send / share PDF</button>' : '') +
      '<button type="button" class="btn' + (canShare ? ' btn-secondary' : ' btn-big') + '" id="pdf-open">📄 Open / save PDF</button>' +
      '<p class="note">Sharing lets you pick Mail, Messages, WhatsApp or “Save to Files”.</p>',
      null, 'Done', true);
  }
  $('#dialog-body').addEventListener('click', function (ev) {
    if (!lastPdf) return;
    if (ev.target.closest('#pdf-share')) {
      var file = new File([lastPdf.blob], lastPdf.name, { type: 'application/pdf' });
      navigator.share({ files: [file], title: 'Poorly Pet - vet log' }).catch(function (e) {
        if (e && e.name !== 'AbortError') openPdf();
      });
    } else if (ev.target.closest('#pdf-open')) {
      openPdf();
    }
  });
  function openPdf() {
    var url = URL.createObjectURL(lastPdf.blob);
    var a = document.createElement('a');
    a.href = url; a.download = lastPdf.name; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
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
    var name = 'poorly-pet-' + toDateInput(new Date()) + '-' + pad(new Date().getHours()) + pad(new Date().getMinutes()) + '.json';
    var blob = new Blob([json], { type: 'application/json' });
    try {
      var file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Poorly Pet log' }).catch(function (e) {
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
      if (!data || !Array.isArray(data.doses) || !Array.isArray(data.meds)) { alert('That does not look like a Poorly Pet export.'); return; }
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
  $('#btn-pdf').addEventListener('click', pdfOptionsDialog);
  $('#btn-pdf-settings').addEventListener('click', pdfOptionsDialog);
  $('#import-merge').addEventListener('change', function (e) { importFile(e.target, 'merge'); });
  $('#import-replace').addEventListener('change', function (e) { importFile(e.target, 'replace'); });

  $('#btn-reset').addEventListener('click', function () {
    if (!confirm('Delete ALL Poorly Pet data on this device? Export a backup first if you might need it.')) return;
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
    var go = e.target.closest('[data-goto]');
    if (go) { var tb = document.querySelector('.tab[data-view=' + go.getAttribute('data-goto') + ']'); if (tb) tb.click(); return; }
    var rg = e.target.closest('[data-trend-range]');
    if (rg) { trendRange = +rg.getAttribute('data-trend-range'); trendSel = null; renderTrends(); return; }
    var dayHit = e.target.closest('[data-day]');
    if (dayHit) { trendSel = +dayHit.getAttribute('data-day'); renderTrends(); return; }
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
    var tf = t.getAttribute && t.getAttribute('data-trend-field');
    if (tf) {
      var hrs = parseFloat(t.value);
      if (!(hrs > 0)) { t.value = trendLimits()[tf]; return; }
      if (!state.trend) state.trend = defaultTrend();
      state.trend[tf === 'wee' ? 'weeGapHours' : 'pooGapHours'] = Math.min(240, Math.max(1, hrs));
      save(); renderTrends(); toast('Saved');
      return;
    }
    if (t.classList && t.classList.contains('dose-select')) {
      pendingDose[t.getAttribute('data-id')] = parseFloat(t.value);
      var rx = t.parentNode.querySelector('.rx');   // amber when different from the vet's dose
      if (rx && rx.getAttribute('data-ml')) rx.classList.toggle('diff', Math.abs(parseFloat(rx.getAttribute('data-ml')) - parseFloat(t.value)) > 0.001);
      return;
    }
    var pf = t.getAttribute('data-profile-field');
    if (pf) {
      if (!state.profile) state.profile = defaultProfile();
      state.profile[pf] = t.value.trim();
      save(); renderProfile(); toast('Saved');
      return;
    }
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
      else renderAll();   // also draws the charts when the Trends tab is showing
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
  // No pinch / double-tap zoom (iOS Safari ignores user-scalable=no, so block its gesture events too).
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });
  // Ask the browser not to evict our data (log + photos) when space is low.
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  $('#symptom-buttons').innerHTML = symptomButtonsHtml();
  $('#symptom-buttons-today').innerHTML = symptomButtonsHtml(true);
  save();
  renderAll();
  renderSettings();
  tick();
  setInterval(tick, 1000);
  setInterval(renderLive, 60 * 1000); // refresh relative times
})();
