import { sizeCanvas, token } from "#/shared/chart.js";

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

	update(values) {
		this.values = values;
		this.value.textContent = values.length ? this.format(values.at(-1)) : "—";
		const change = (values.at(-1) ?? 0) - (values.at(-61) ?? values[0] ?? 0);
		this.delta.hidden = change === 0;
		this.delta.textContent = `${change > 0 ? "+" : "−"}${this.format(Math.abs(change))} / 1 min`;
		this.delta.className = `delta ${change > 0 ? "is-up" : "is-down"}`;
		this.draw();
	}

	draw() {
		const { context, width, height } = sizeCanvas(this.canvas);
		if (this.values.length < 2) return;
		const min = Math.min(...this.values);
		const range = Math.max(...this.values) - min || 1;
		const accent = token("--base-color-accent-rgb");
		const points = this.values.map((value, index) => [index / (this.values.length - 1) * width, height - 4 - (value - min) / range * (height - 8)]);
		const gradient = context.createLinearGradient(0, 0, 0, height);
		gradient.addColorStop(0, `rgba(${accent}, 0.35)`);
		gradient.addColorStop(1, `rgba(${accent}, 0)`);
		context.beginPath();
		context.moveTo(0, height);
		for (const [pointX, pointY] of points) context.lineTo(pointX, pointY);
		context.lineTo(width, height);
		context.closePath();
		context.fillStyle = gradient;
		context.fill();
		context.beginPath();
		points.forEach(([pointX, pointY], index) => index === 0 ? context.moveTo(pointX, pointY) : context.lineTo(pointX, pointY));
		context.strokeStyle = token("--base-color-accent");
		context.lineWidth = 1.5;
		context.stroke();
	}
}