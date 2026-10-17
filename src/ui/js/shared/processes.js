const KIND_NAMES = {
	"app": "App (Rust)",
	"webview:browser": "WebView2 — browser",
	"webview:renderer": "WebView2 — page",
	"webview:gpu": "WebView2 — GPU",
	"webview:network": "WebView2 — network",
	"webview:storage": "WebView2 — storage",
	"webview:audio": "WebView2 — audio",
	"webview:utility": "WebView2 — utility",
	"webview:crashpad-handler": "WebView2 — crashpad",
	"webkit:web": "WebKit — page",
	"webkit:network": "WebKit — network",
	"webkit:gpu": "WebKit — GPU"
}

export const processName = process => `${KIND_NAMES[process.kind] ?? process.kind} · ${process.pid}`;