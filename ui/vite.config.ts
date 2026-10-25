import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const FONT_LICENSE = readFileSync(new URL("./OFL.txt", import.meta.url), "utf8").trim();

const fontLicense = (): Plugin => ({
	name: "devdeck-font-license",
	transformIndexHtml: {
		order: "post",
		handler: html => html.replace("<!DOCTYPE html>", `<!DOCTYPE html>\n<!--\nThis page embeds the Inter font (https://github.com/rsms/inter).\n\n${FONT_LICENSE}\n-->`)
	}
});

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	base: "./",
	plugins: [react(), fontLicense(), viteSingleFile()],
	resolve: {
		alias: [{ find: /^#\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) }]
	},
	build: {
		outDir: fileURLToPath(new URL("../src/ui-dist", import.meta.url)),
		emptyOutDir: true,
		assetsInlineLimit: Number.MAX_SAFE_INTEGER,
		chunkSizeWarningLimit: 4096
	}
});