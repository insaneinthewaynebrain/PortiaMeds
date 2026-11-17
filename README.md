# Poorly Pet

A small, private medication and activity tracker for a poorly pet (originally built for Portia the cat after her vet visit), so every dose is given on time and nothing gets missed.

> The repository is still called `PortiaMeds`, and the app keeps its storage under the old internal names. That's deliberate: changing the web address or storage names would make existing logs disappear from the phone.

It's a static site: plain HTML, CSS and vanilla JavaScript. There's no build step and no frameworks. It runs on GitHub Pages and is designed for iPhone.

**Live app:** https://insaneinthewaynebrain.github.io/PortiaMeds/

Designed for iPhone, and also lays out in columns on wider screens such as an unfolded foldable, a tablet or landscape. Pinch and double-tap zoom are turned off so taps don't zoom the page.

## Features

- **Call vet** button in the header and a large **Call** button on the Today screen. The vet's name and number are editable in Settings (default: Avondale, Warwick, 01926 400 255).
- **Call the vet if…** checklist at the top: not pooing, blood in wee, straining to wee with nothing passing. The app also flags these automatically when the matching symptoms are logged, or when no poo has been logged for 48 hours.
- **Medication cards** show the dose, last dose, next dose due and a live countdown.
  - **✅ Given now** logs the current time. The next dose is due 8 hours later (configurable).
  - **🕑 Given at another time** is for doses logged late. **✏️ Edit last dose** fixes mistakes.
  - It warns you if you try to log a dose again too soon, which helps when two people are giving meds.
  - **Overdue** doses are highlighted in red, with a banner and a tab badge.
  - Lactulose warnings: "STOP if diarrhoea" and "can increase to 1 ml if no poo by day 2".
  - Gabapentin: once 2 doses have been given in 24 hours, the third shows as *optional* (only if she's still straining).
  - Metacam is shown as **PAUSED**: "Stopped by vet for 24–48 hours, ask before restarting".
- **Dose picker** on each medication tile: choose 0.1–3.0 ml, then **Given now**. It remembers the last dose given for each medication separately (0.5 ml the first time) and shows the vet's dose beside it, turning amber if they differ. The amount is saved with every dose and shown in the history and PDF.
- **Visual check** (the Check button): how she looks, from Very tired (1) to Energetic & happy (5), plus optional Hiding / Playful / Grooming well.
- **Trends** tab: a daily wellbeing score (0–100) for 7 or 30 days, an Improving / Steady / Declining label, and a colour-coded timeline of food, water, wee, poo, vomit and doses. Tap a day to see how its score was made up. The score combines the visual check (35%), eating (20%), drinking (15%), wee (15%) and poo (15%), minus 10 points per vomit. Going longer than the alert limit without a wee (default 12 h) or poo (default 48 h) lowers the score and shades the day red; both limits can be changed on the Trends tab. The charts are plain SVG drawn by the app, so they work offline.
- **Activities** with six buttons, each opening a quick form with a note (poo, wee and vomit can also have a **photo**):
  - **Pooed**: solid or diarrhoea (default solid), blood or not (default no blood), on her own or needed help.
  - **Weed**: small, medium or large, blood or not (default no blood), on her own or needed help.
  - **Vomited**: photo and note.
  - **Ate food**: wet, dry or both, on her own or needed help.
  - **Drank water**: small, medium or large, on her own or needed help.
  - Blood in poo or wee raises the "call the vet" alert. Diarrhoea triggers the "stop lactulose" warning.
  - Entries logged with older versions of the app (e.g. "Strained", "Ate well") still show in the log as they were.
  - Add or replace a photo on any entry from the Log (tap **Edit**). Tap a thumbnail to see it full size.
- **48-hour review reminder**, counted from the first logged dose: "If pooing normally and no blood in wee, ask vet about stopping medication."
- **Follow-up reminders** with editable dates: a urine sample in about 2 weeks and repeat bloods in 3–4 months.
- **Log / history** of every dose and symptom, grouped by day, with editable times and notes.
- **Settings** to edit medications (name, dose, interval, notes, paused) or add and remove them.
- **Browser notifications** when a dose becomes due.
- **PDF for the vet**: on the Log tab (or in Settings), tap **Create PDF for the vet**, pick the period and whether to include photos, then share it (Mail, Messages, Save to Files). The PDF lists the medications at the top, then the log as a simple timeline, oldest first, with photos next to their entries.
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
| `vendor/jspdf.umd.min.js` | [jsPDF](https://github.com/parallax/jsPDF) 2.5.2 (MIT), used to make the vet PDF. Loaded only when a PDF is created. |
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
