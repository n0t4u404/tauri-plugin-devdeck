# tauri-plugin-devdeck

A developer deck for [Tauri 2](https://tauri.app) apps: a separate window that shows, live, how much memory and CPU
every process of your app uses, which resources your page creates and never releases, and how chatty your IPC is —
plus a recorder to capture a session and study it on a timeline.

Built to answer questions like *"why does the app take 6 GB after a night on this screen?"* without guessing.

> **Status:** early. **Monitor** and **Recording** are ready. Planned: **Controls** (put the app into any state for
> previews) and **Capture** (screenshots and animated WebP of a window).

## Quick start

1. Add the plugin, in debug builds only — see [Install](#install).
2. Start it in your frontend, in development only:

   ```ts
   import { startDevdeck } from "tauri-plugin-devdeck";

   if (import.meta.env.DEV) startDevdeck();
   ```

3. Run the app and press **Ctrl+Alt+M** — or open the deck from your own code with `openDevdeck()` (see
   [Options](#options)).

## Install

**Rust** — `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri-plugin-devdeck = { git = "https://github.com/n0t4u404/tauri-plugin-devdeck", branch = "main" }
```

**JavaScript:**

```sh
npm i github:n0t4u404/tauri-plugin-devdeck#main
```

**Register** the plugin, in debug builds only:

```rust
let builder = tauri::Builder::default();

#[cfg(debug_assertions)]
let builder = builder.plugin(tauri_plugin_devdeck::init());
```

**Allow** it for the window that calls it, in a capability (`src-tauri/capabilities/*.json`):

```json
"permissions": ["core:default", "devdeck:default"]
```

`devdeck:default` allows two commands: `open` (open the deck window) and `report` (send the page report).

## Monitor

The **Monitor** tab updates every second and keeps the last 5 minutes.

| Panel | What it shows |
|---|---|
| **Memory** | Memory of your app and every child process, stacked. |
| **CPU** | CPU of every process, in % of one core: 100% means one core is fully busy. |
| **JS heap · Elements · Tokio tasks** | The page's JS heap, the number of DOM elements, live tokio tasks in Rust. |
| **Resources** | Your own counters made with `devGauge`: created minus released. |
| **Calls and events** | Your own counters made with `devTotal` / `devEvent`, per second. |

- Processes are your app and all of its children: web view processes and anything you start yourself (a game,
  a server). Web view processes are labelled by role where the platform allows it (see [Platforms](#platforms)).
- Sort a legend by clicking a column. Click a row to hide it, hover it to highlight it on the chart.
- A spike far above the usual level is drawn as a red `▲ value` mark at the top, so it doesn't flatten the rest of
  the chart.
- In **Resources**, the **1 min** column turns red when a counter grew over the last minute. A number that only
  grows is a leak: WebGL contexts, blob URLs, subscriptions, timers, open sockets.

The top bar shows total memory, CPU, the number of processes and uptime.

Every sample is also appended to `devdeck.jsonl` in the app log folder (`app_log_dir`), so a long session can be
analysed later. The file is cleared when the deck opens, and again once it passes 4 MB.

## Recording

Press **Record**, do what you want to measure, then **Stop**.

- Samples are taken every 250 ms, up to 10 minutes, and saved to `devdeck-recordings/` in the app log folder as
  `recording-<date>-<time>.devdeck.json`.
- The deck then opens the **Recording** tab: a Performance-style timeline with CPU and memory stacked per process,
  JS heap, elements, resources and calls.
- Zoom with the wheel, drag to pan, double-click to reset, or pick a range on the overview strip. Click a track name
  to collapse it.
- The summary under the timeline counts only the selected range: average and max CPU per process, memory at its
  start and end, what grew, and how many calls happened.
- Older recordings stay in the list, so you can open one from before a fix and compare. **Show in folder** opens the
  recordings folder.

### The `devdeck:recording` event

The plugin emits `devdeck:recording` to the app: `true` when a recording starts, `false` when it stops (also when the
deck window is closed mid-recording). Use it to switch off anything that would skew the numbers — for example, close
an open web inspector, which keeps every request and log line in memory:

```rust
use tauri::Listener;

app.listen_any("devdeck:recording", move |event| {
    let is_recording = event.payload() == "true";
    // e.g. close the DevTools of every window while recording
});
```

## Counters

```ts
import { devEvent, devGauge, devTotal } from "tauri-plugin-devdeck";

const renderer = new WebGLRenderer();
devGauge("WebGL contexts", 1);
// …
renderer.dispose();
devGauge("WebGL contexts", -1);

devTotal(`invoke ${command}`);
devTotal("bytes received", chunk.length);

listen("friends:list", event => devEvent("event friends:list", event.payload));
```

| Function | What it does | Shown in |
|---|---|---|
| `devGauge(name, delta)` | Adds `delta` to a value that goes up and down. | **Resources** |
| `devTotal(name, amount = 1)` | Adds to a running total. | **Calls and events**, per second |
| `devEvent(name, payload?)` | Counts like `devTotal(name)`, and also counts `<name> · same` when the payload equals the previous one. | **Calls and events** |

If `<name>` and `<name> · same` grow at the same rate, the sender keeps sending data that didn't change. Payloads are
compared as JSON, so use `devEvent` for events with small payloads.

Before `startDevdeck()` is called — and in release builds, where you don't call it — the counters do nothing, so they
are safe to leave in your code.

## Options

```ts
const stop = startDevdeck({
	hotkey: "Ctrl+Shift+D",  // default: "Ctrl+Alt+M"; false — no built-in hotkey
	reportIntervalMs: 2000   // how often the page sends its report, default: 1000
});
```

- `startDevdeck()` returns a function that stops it. A second call while it runs does nothing.
- `openDevdeck()` opens (or focuses) the deck window from code, e.g. from a button or your own shortcut.

### Hotkey

- Written as modifiers and a key joined with `+`: `Ctrl`, `Alt`, `Shift`, `Meta` (⊞ on Windows, ⌘ on macOS) and a
  letter or digit — `"Ctrl+Alt+M"`, `"Meta+Shift+D"`. Case doesn't matter. The modifiers must match exactly:
  `Ctrl+Alt+M` does not fire on `Ctrl+Alt+Shift+M`.
- The key is matched by its **position**, not by the character it types (`KeyboardEvent.code`), so it works in any
  keyboard layout — `M` is the same key in Cyrillic or AZERTY.
- **AltGr is ignored.** On Windows, AltGr arrives as Ctrl+Alt, and in many layouts AltGr + letter types a character
  (`ą`, `ś`, `€`…). Without this check, typing such a character in any input would open the deck.
- Pick a combination your OS doesn't take first: shortcuts the system handles (on GNOME, for example,
  `Ctrl+Alt+D` shows the desktop) never reach the page.
- **`hotkey: false`** turns the built-in hotkey off — for apps that already have their own shortcut handling and
  call `openDevdeck()` from it:

  ```ts
  startDevdeck({ hotkey: false });

  window.addEventListener("keydown", event => {
  	if (event.ctrlKey && event.altKey && event.code === "KeyA") void openDevdeck();
  });
  ```

Window size, on the Rust side:

```rust
#[cfg(debug_assertions)]
let builder = builder.plugin(
	tauri_plugin_devdeck::Builder::new()
		.size(1280.0, 900.0)     // when it opens, default: 1120 × 820
		.min_size(720.0, 500.0)  // default: 640 × 480
		.build()
);
```

`init()` is `Builder::new().build()`.

## Platforms

Works wherever Tauri 2 runs. What differs is how much the web view tells about itself:

| | Linux (WebKitGTK) | Windows (WebView2) | macOS (WKWebView) |
|---|---|---|---|
| Web view process roles | page, network, GPU | browser, page, GPU, network, storage, audio, utility | by process name |
| JS heap | shown as unavailable | yes | shown as unavailable |

- **JS heap** needs `performance.memory`, which exists only in Chromium-based web views. On WebKit the tile says
  *Not available in this web view* instead of showing a misleading 0.
- **Linux:** only real processes are counted. Threads, which the OS lists under `/proc` like processes (each with the
  whole process's memory), are skipped.
- **macOS:** WebKit content processes are started by the system, not as children of your app, so they may not appear
  in the process list.

## Reading the numbers right

- **Close the web inspector while measuring.** An open DevTools/inspector keeps every request and console line and
  runs in its own process (on Linux, with its own network process too). It can grow to gigabytes and look like your
  app. Close it, or close it automatically with the [`devdeck:recording`](#the-devdeckrecording-event) event.
- **The deck window is a page too.** It adds one more web view process; that memory is not your app's.
- **Web view processes are per page.** To tell which is which, look at when a process appeared and how it reacts to
  what you do: open a page and that page's process grows.

## How it works

The deck window doesn't use your frontend or its bundler. Its page is embedded in the plugin and served over the
`devdeck://` protocol, so it works with any framework and adds nothing to your bundle.

- The Rust side samples processes with [`sysinfo`](https://crates.io/crates/sysinfo), only while the deck window is
  open: every second, or every 250 ms while recording.
- The page side (`startDevdeck`) sends a small report — heap, element count, counters — every `reportIntervalMs`.

## License

MIT © n0t4u404

The deck page uses the [Inter](https://github.com/rsms/inter) font, © The Inter Project Authors, licensed under the
SIL Open Font License 1.1. See [`src/ui/fonts/OFL.txt`](src/ui/fonts/OFL.txt).
