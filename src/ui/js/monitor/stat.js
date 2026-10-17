import { drawDot, sizeCanvas, token, traceCurve, verticalFill } from "#/shared/chart.js";

export class Stat {
	constructor(label, format) {
		this.format = format;
		this.element = document.createElement("div");
		this.element.className = "stat";
		this.element.innerHTML = `<div class="stat-label"><span></span><span class="delta" hidden></span></div><div class="stat-value"></div><canvas></canvas>`;
		this.element.querySelector(".stat-label span").textContent = label;
		this.delta = this.element.querySelector(".delta");
		this.value = this.element.querySelector(".stat-value");
		this.canvas = this.element.querySelector("canvas");
		this.values = [];
		new ResizeObserver(() => this.draw()).observe(this.canvas);
	}

	unavailable(reason) {
		this.values = [];
		this.value.textContent = "—";
		this.delta.hidden = false;
		this.delta.textContent = reason;
		this.delta.className = "delta";
		this.draw();
	}

	update(values) {
		this.values = values;
		this.value.textContent = values.length ? this.format(values.at(-1)) : "—";
		const change = (values.at(-1) ?? 0) - (values.at(-61) ?? values[0] ?? 0);
		this.delta.hidden = change === 0;
		this.delta.textContent = `${change > 0 ? "▲" : "▼"} ${this.format(Math.abs(change))} / 1 min`;
		this.delta.className = `delta ${change > 0 ? "is-up" : "is-down"}`;
		this.draw();
	}

	draw() {
		const { context, width, height } = sizeCanvas(this.canvas);
		if (this.values.length < 2) return;
		const min = Math.min(...this.values);
		const range = Math.max(...this.values) - min || 1;
		const accent = token("--base-color-accent");
		const right = width - 10;
		const points = this.values.map((value, index) => [index / (this.values.length - 1) * right, height - 6 - (value - min) / range * (height - 16)]);
		context.beginPath();
		traceCurve(context, points);
		context.lineTo(right, height);
		context.lineTo(0, height);
		context.closePath();
		context.fillStyle = verticalFill(context, accent, 0, height, 0.3, 0);
		context.fill();
		context.beginPath();
		traceCurve(context, points);
		context.shadowColor = accent;
		context.shadowBlur = 8;
		context.strokeStyle = accent;
		context.lineWidth = 2;
		context.stroke();
		context.shadowBlur = 0;
		drawDot(context, ...points.at(-1), accent);
	}
}