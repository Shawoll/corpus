# Offline use and installing

Corpus works without a connection after the first visit, and it can be added to a phone's home screen or installed as a desktop app. There is still no build step: two small files do it.

## How it works

- **`sw.js`**, the service worker, answers every same-origin request **from the network first**, and stores each answer in a cache called `corpus`. With no network, or when the network takes longer than 3 seconds to start answering, it uses the stored copy instead (and the network still refreshes it in the background).
- Because every answer from the network refreshes the copy, **edits show up on the next visit** with nothing to bump: no version number and no list of files to keep up to date.
- **`js/offline.js`** registers the worker once the page has loaded. On the first visit the page loads before the worker exists, so it then hands over everything it has fetched (the page, scripts, styles, fonts, data and drawings) into the cache.
- **`manifest.webmanifest`** gives the name, colours and icons (`assets/icons/`) used when someone installs the app. iOS uses `apple-touch-icon` from `index.html`.

## What is saved

By default, what someone has opened: the first visit saves the app, the data and the default drawings; the realistic drawings and each 3D model are saved the first time they are shown.

**Settings → Offline → Save for offline** fetches the rest ahead: every drawing in every style, three.js, every 3D model and the skin, and every language's files, about 6 MB. The size in the button comes from `OFFLINE_MB` in `js/main.js`: update it if the models or drawings grow a lot. The section tells you when everything is saved. It doesn't appear where service workers aren't available (a `file://` page, or plain `http` other than `localhost`).

## Working on the site

On `localhost` the worker runs too, but since it goes to the network first, a reload picks up your edits. If something ever looks stale, reload again, or clear the site's data in the browser's developer tools (Application → Storage).

To test offline: open the site, use **Save for offline**, stop the local server and reload.

## Changing it

- New files need nothing: they are cached when they are first fetched.
- Keep `sw.js` at the repository root, so its scope covers the whole site.
- If you change the caching strategy, change the cache name in both `sw.js` and `js/offline.js` (`CACHE`) and delete the old cache in the worker's `activate` handler.
