# VocalTouch prototype

Two static pages that talk to each other over the internet:

| Page | Open it on | What it is |
|---|---|---|
| `tablet/` | the iPad / tablet | The VocalTouch device simulator (keycaps + Bluetooth LED). The speaker pairs with this device. |
| `phone/`  | the caregiver's phone | The caregiver app. Receives key presses and Bluetooth connect / disconnect alerts from the tablet. |

```
vocaltouch/
├── link.js        shared realtime link (used by both pages)
├── tablet/index.html
└── phone/         index.html, script.js, *.css
```

## Deploy to GitHub Pages

1. Put the contents of this folder at the root of a repo (keep the folder structure).
2. Repo **Settings → Pages → Build and deployment**: *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. After a minute your pages are at:
   - `https://<user>.github.io/<repo>/tablet/`
   - `https://<user>.github.io/<repo>/phone/`

Both pages must be served over HTTPS (GitHub Pages does this) and need internet access.

## Pairing

The two pages find each other through a shared **room id**. The default is in `link.js` (`defaultRoom`).
To use a private one without touching code, open both pages with the same id:

```
.../tablet/#room=my-demo-4821
.../phone/#room=my-demo-4821
```

(6-64 letters, digits, `-` or `_`.) If you do this, bookmark those URLs.

## Using it

- **Tablet**: tap a keycap (or press 1-9, 0 on a keyboard) and the request appears on the phone.
- **Tablet**: tap the green LED on the top bezel to disconnect / reconnect the Bluetooth speaker. The phone gets a red banner on disconnect and a green banner on reconnect, and its Settings → Bluetooth shows the live status. A dropped speaker auto-reconnects after 5 s.
- **Tablet "Demo" button** (top right): language, day/night, red error state, volume, test key #6.
- The chip next to it shows whether the phone is linked; the phone shows whether the tablet is linked.

## Good to know

- The link uses a **public MQTT broker** (`broker.hivemq.com`, set in `link.js`). It needs no account, but it isn't private: anyone who knows or guesses the room id could read or send messages. Fine for demo phrases; not for real patient data.
- Requests are not queued: if the phone is offline when a key is pressed, it won't see that press later.
- Browsers can't read the real Bluetooth speaker state (iOS Safari can't at all), so the Bluetooth link is simulated by the LED / Demo button. Detecting a real speaker needs a native iPad app.
