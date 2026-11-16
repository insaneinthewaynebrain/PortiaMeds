# 🐈 Portia Meds

A small, private medication tracker for Portia the cat after her vet visit, so every dose is given on time and nothing gets missed.

It's a static site: plain HTML, CSS and vanilla JavaScript. There's no build step and no frameworks. It runs on GitHub Pages and is designed for iPhone.

**Live app:** https://insaneinthewaynebrain.github.io/PortiaMeds/

## Features

- **Call the vet if…** checklist at the top: not pooing, blood in wee, straining to wee with nothing passing. The app also flags these automatically when the matching symptoms are logged, or when no poo has been logged for 48 hours.
- **Medication cards** show the dose, last dose, next dose due and a live countdown.
  - **✅ Given now** logs the current time. The next dose is due 8 hours later (configurable).
  - **🕑 Given at another time** is for doses logged late. **✏️ Edit last dose** fixes mistakes.
  - It warns you if you try to log a dose again too soon, which helps when two people are giving meds.
  - **Overdue** doses are highlighted in red, with a banner and a tab badge.
  - Lactulose warnings: "STOP if diarrhoea" and "can increase to 1 ml if no poo by day 2".
  - Gabapentin: once 2 doses have been given in 24 hours, the third shows as *optional* (only if she's still straining).
  - Metacam is shown as **PAUSED**: "Stopped by vet for 24–48 hours, ask before restarting".
- **Symptom tracker** with one tap per symptom: pooed normally, strained, blood in wee, diarrhoea, vomited, ate well, weed, and strained to wee with nothing coming.
  - **Weed** opens a quick form: amount (small / medium / large), blood (defaults to *without blood*), an optional **photo** and a note. A wee with blood also raises the "call the vet" alert.
  - You can add or replace a photo on any symptom entry from the Log (tap **Edit**). Tap a thumbnail to see it full size.
- **48-hour review reminder**, counted from the first logged dose: "If pooing normally and no blood in wee, ask vet about stopping medication."
- **Follow-up reminders** with editable dates: a urine sample in about 2 weeks and repeat bloods in 3–4 months.
- **Log / history** of every dose and symptom, grouped by day, with editable times and notes.
- **Settings** to edit medications (name, dose, interval, notes, paused) or add and remove them.
- **Browser notifications** when a dose becomes due.
- **Export / import JSON** to share the log with someone else (merge or replace).

## ⚠️ Notifications on iPhone

iPhones only show web-app notifications if:

1. You open the site in **Safari**, tap **Share → Add to Home Screen**, and from then on open it **from the Home Screen icon** (iOS 16.4 or later).
2. You tap **Turn on dose notifications** inside the app and allow them.
3. **The app is open.** It has no server, so it can't wake your phone when it's closed.

**Always set a phone alarm as a backup.** Don't rely on notifications alone.

## Sharing the log

Go to Settings → **Export / share log**. On iPhone this opens the share sheet (AirDrop, Messages and so on). On the other phone, open Portia Meds and go to Settings → **Import & merge**.

All data lives only in each phone's browser storage: the log in `localStorage`, and photos separately in IndexedDB so they can't fill up the log's space. Exports include the photos, so files with photos are bigger. Nothing is sent anywhere. Clearing Safari website data deletes it, so export a backup now and then.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `style.css` | Mobile-first styling (supports dark mode) |
| `app.js` | All app logic and storage |
| `sw.js` | Service worker: offline support and notification clicks |
| `manifest.webmanifest`, `icon.svg`, `apple-touch-icon.png` | Home Screen app icon and metadata |

## Run locally

Any static file server works, for example:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

---

This app is a reminder aid only. Always follow your vet's instructions.
