# tauri-plugin-devdeck

A developer deck for [Tauri 2](https://tauri.app) apps: a separate window that shows, live, how much memory and CPU
every process of your app uses, and which resources your page creates and never releases.

Built to answer questions like *"why does the app take 6 GB after a night on this screen?"* without guessing.

> Status: early. The **Monitor** is ready. Planned: **Recording** (a Performance-style timeline you can save and
> compare), **Controls** (put the app into any state for previews) and **Capture** (screenshots and animated WebP of
> a window).

## What it shows

- **Memory and CPU of every process**: your app and all of its child processes. On Windows each WebView2 process is
  labelled by role (page, GPU, browser, network, …), so you can see whether the page or the GPU process grows. Child
  processes you start (a game, a server) show up too. CPU is in % of one core: 100% means one core is fully busy.
- **Page**: JS heap, elements on the page, live tokio tasks.
- **Resources** (created minus released): your own counters, made with `devGauge`. A number that only grows is a
  leak: WebGL contexts, blob URLs, subscriptions, timers, open sockets. The **1 min** column turns red when it grows.
- **Calls and events**: your own counters per second, made with `devTotal`. Use them for IPC calls, events and
  requests.

Every panel shows the last 5 minutes. Sort the legend by clicking a column. Click a row to hide it, or hover it to
highlight it on the chart.

Every sample is also appended to `devdeck.jsonl` in the app log folder (`app_log_dir`), so a long session can be
analysed later. The file is cleared when the deck opens, and again once it passes 4 MB.

## Install

Rust side:

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-devdeck = { git = "https://github.com/n0t4u404/tauri-plugin-devdeck" }
```

JavaScript side:

```sh
npm i github:n0t4u404/tauri-plugin-devdeck
```

Register the plugin, in debug builds only:

```rust
let builder = tauri::Builder::default();

#[cfg(debug_assertions)]
let builder = builder.plugin(tauri_plugin_devdeck::init());
```

Allow it for the window that calls it, in a capability:

```json
"permissions": ["core:default", "devdeck:default"]
```

## Use

Start it once, as early as possible, in development only:

```ts
import { startDevdeck } from "tauri-plugin-devdeck";

if (import.meta.env.DEV) startDevdeck();
```

Press **Ctrl+Alt+M** to open the deck, or call `openDevdeck()`.

```ts
startDevdeck({
	hotkey: "Ctrl+Shift+D",  // default: "Ctrl+Alt+M"
	reportIntervalMs: 2000   // how often the page sends its report, default: 1000
});
```

`startDevdeck()` returns a function that stops it.

### Counters

```ts
import { devGauge, devTotal } from "tauri-plugin-devdeck";

const renderer = new WebGLRenderer();
devGauge("WebGL contexts", 1);
// …
renderer.dispose();
devGauge("WebGL contexts", -1);

devTotal(`invoke ${command}`);
devTotal("bytes received", chunk.length);
```

- `devGauge(name, delta)`: adds `delta` to a value that goes up and down. Shown as lines in **Resources**.
- `devTotal(name, amount = 1)`: adds to a running total. Shown per second in **Calls and events**.

Before `startDevdeck()` is called (and in release builds, where you don't call it) the counters do nothing, so they
are safe to leave in your code.

### Window size

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

## How it works

The deck window doesn't use your frontend or its bundler. Its page lives inside the plugin and is served over the
`devdeck://` protocol, so it works with any framework and adds nothing to your bundle. Sampling runs only while the
deck window is open.

## Platforms

Works wherever Tauri runs. WebView2 process roles are Windows-only. On macOS and Linux (WebKit) processes are shown
by name. The JS heap needs `performance.memory`, which exists only in Chromium-based webviews (WebView2).

## License

MIT © n0t4u404

The deck page uses the [Inter](https://github.com/rsms/inter) font, © The Inter Project Authors, licensed under the
SIL Open Font License 1.1. See [`src/ui/fonts/OFL.txt`](src/ui/fonts/OFL.txt).
