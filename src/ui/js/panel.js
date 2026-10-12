import { clock } from "./format.js";
import { niceStep, sizeCanvas, token } from "./chart.js";

const tooltip = document.getElementById("tooltip");

const fitPeak = values => {
	const sorted = values.filter(value => value > 0).sort((a, b) => a - b);
	if (sorted.length === 0) return 1e-9;
	const max = sorted.at(-1);
	const usual = sorted[Math.floor((sorted.length - 1) * 0.98)];
	return usual > 0 && max > usual * 1.5 ? usual * 1.2 : max;
}

export class Panel {
	constructor({ title, subtitle, unit, columns, note, kind = "bars" }) {
		this.kind = kind;
		this.unit = unit;
		this.columns = columns;
		this.sort = { column: columns.find(column => column.isDefaultSort)?.key ?? columns[0].key, isDescending: true };
		this.hidden = new Set();
		this.hoverIndex = null;
		this.highlight = null;
		this.data = null;

		this.element = document.createElement("section");
		this.element.className = "panel";
		this.element.innerHTML = `<div class="panel-head"><div class="panel-title"></div><div class="panel-subtitle"></div></div><div class="panel-body"><div class="chart"><canvas></canvas></div><div class="legend"><table><thead><tr><th></th></tr></thead><tbody></tbody></table></div></div>`;
		this.element.querySelector(".panel-title").textContent = title;
		this.element.querySelector(".panel-subtitle").textContent = subtitle ?? "";

		if (note) {
			const paragraph = document.createElement("p");
			paragraph.className = "note";
			paragraph.textContent = note;
			this.element.append(paragraph);
		}

		this.canvas = this.element.querySelector("canvas");
		this.body = this.element.querySelector("tbody");

		const headRow = this.element.querySelector("thead tr");
		for (const column of columns) {
			const header = document.createElement("th");
			header.dataset.key = column.key;
			header.addEventListener("click", () => {
				this.sort = { column: column.key, isDescending: this.sort.column === column.key ? !this.sort.isDescending : true }
				this.render();
			});
			headRow.append(header);
		}

		this.canvas.addEventListener("mousemove", event => this.hover(event));
		this.canvas.addEventListener("mouseleave", () => {
			this.hoverIndex = null;
			tooltip.hidden = true;
			this.draw();
		});
		new ResizeObserver(() => this.draw()).observe(this.canvas);
	}

	update(data) {
		this.data = data;
		this.render();
	}

	render() {
		if (!this.data) return;
		for (const header of this.element.querySelectorAll("th[data-key]")) {
			const column = this.columns.find(item => item.key === header.dataset.key);
			header.textContent = column.label + (this.sort.column === column.key ? (this.sort.isDescending ? " ▾" : " ▴") : "");
		}

		const rows = [...this.data.series].sort((a, b) => {
			const difference = (a.stats[this.sort.column] ?? 0) - (b.stats[this.sort.column] ?? 0);
			return this.sort.isDescending ? -difference : difference;
		});

		this.body.replaceChildren(...rows.map(series => {
			const row = document.createElement("tr");
			if (this.hidden.has(series.key)) row.className = "hidden";
			const name = document.createElement("td");
			const swatch = document.createElement("span");
			swatch.className = "swatch";
			swatch.style.background = series.color;
			name.append(swatch, series.name);
			name.title = series.name;
			row.append(name);
			for (const column of this.columns) {
				const cell = document.createElement("td");
				const value = series.stats[column.key] ?? 0;
				cell.textContent = column.format(value);
				if (column.isGrowthWarning && value > 0) cell.className = "grows";
				row.append(cell);
			}
			row.addEventListener("mouseenter", () => {
				this.highlight = series.key;
				this.draw();
			});
			row.addEventListener("mouseleave", () => {
				this.highlight = null;
				this.draw();
			});
			row.addEventListener("click", () => {
				if (this.hidden.has(series.key)) this.hidden.delete(series.key);
				else this.hidden.add(series.key);
				this.render();
			});
			return row;
		}));
		this.draw();
	}

	visibleSeries() {
		return this.data ? this.data.series.filter(series => !this.hidden.has(series.key)) : [];
	}

	draw() {
		const { context, width, height } = sizeCanvas(this.canvas);
		if (!this.data || this.data.times.length === 0) return;
		const series = this.visibleSeries();
		const count = this.data.times.length;
		const totals = Array.from({ length: count }, (_, index) => series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0));
		const isStacked = this.kind === "bars";
		const heights = isStacked ? totals : series.flatMap(item => item.values.map(value => value ?? 0));
		const peak = fitPeak(heights);
		const step = niceStep(peak, 4);
		const top = Math.ceil(peak / step) * step;

		context.font = `11px ${token("--font-family-body")}`;
		const labels = [];
		for (let value = 0; value <= top + step / 2; value += step) labels.push(value);
		const left = Math.max(...labels.map(value => context.measureText(this.unit(value)).width)) + 10;
		const bottom = height - 18;
		const plotWidth = width - left - 4;
		const plotHeight = bottom - 6;
		const y = value => bottom - value / top * plotHeight;
		const slot = plotWidth / count;
		const x = index => left + slot * index + slot / 2;
		this.geometry = { left, slot, count };

		context.strokeStyle = token("--base-color-border-light");
		context.fillStyle = token("--base-color-text-muted");
		context.lineWidth = 1;
		context.textBaseline = "middle";
		context.textAlign = "right";
		for (const value of labels) {
			const lineY = Math.round(y(value)) + 0.5;
			context.beginPath();
			context.moveTo(left, lineY);
			context.lineTo(width - 4, lineY);
			context.stroke();
			context.fillText(this.unit(value), left - 6, lineY);
		}
		context.textAlign = "center";
		context.textBaseline = "alphabetic";
		const timeEvery = Math.max(1, Math.round(count / Math.max(2, Math.floor(plotWidth / 90))));
		for (let index = 0; index < count; index += timeEvery) {
			const lineX = Math.round(x(index)) + 0.5;
			context.beginPath();
			context.moveTo(lineX, 6);
			context.lineTo(lineX, bottom);
			context.stroke();
			context.fillText(clock(this.data.times[index]), lineX, height - 4);
		}

		context.save();
		context.beginPath();
		context.rect(left, 6, plotWidth, plotHeight);
		context.clip();
		if (isStacked) {
			const barWidth = Math.max(1, slot * 0.8);
			const base = new Array(count).fill(0);
			for (const item of series) {
				context.globalAlpha = this.highlight && this.highlight !== item.key ? 0.25 : 1;
				context.fillStyle = item.color;
				for (let index = 0; index < count; index++) {
					const value = item.values[index] ?? 0;
					if (value <= 0) continue;
					const from = y(base[index]);
					const to = y(base[index] + value);
					context.fillRect(x(index) - barWidth / 2, to, barWidth, Math.max(1, from - to));
					base[index] += value;
				}
			}
		} else {
			context.lineWidth = 1.5;
			for (const item of series) {
				context.globalAlpha = this.highlight && this.highlight !== item.key ? 0.25 : 1;
				context.strokeStyle = item.color;
				context.beginPath();
				item.values.forEach((value, index) => {
					if (index === 0) context.moveTo(x(index), y(value ?? 0));
					else context.lineTo(x(index), y(value ?? 0));
				});
				context.stroke();
			}
		}
		context.restore();

		context.globalAlpha = 1;
		const peaks = isStacked ? totals : Array.from({ length: count }, (_, index) => Math.max(0, ...series.map(item => item.values[index] ?? 0)));
		context.font = `600 10px ${token("--font-family-body")}`;
		context.textAlign = "center";
		context.textBaseline = "top";
		let labelEnd = -Infinity;
		peaks.forEach((value, index) => {
			if (value <= top) return;
			context.fillStyle = token("--base-color-danger");
			context.fillRect(x(index) - Math.max(1, slot * 0.4), 6, Math.max(2, slot * 0.8), 2);
			const label = this.unit(value);
			const labelWidth = context.measureText(label).width + 8;
			const labelX = Math.min(Math.max(x(index), left + labelWidth / 2), width - 4 - labelWidth / 2);
			if (labelX - labelWidth / 2 < labelEnd) return;
			labelEnd = labelX + labelWidth / 2;
			context.fillStyle = `rgba(${token("--base-color-bg-secondary-rgb")}, 0.85)`;
			context.fillRect(labelX - labelWidth / 2, 10, labelWidth, 14);
			context.fillStyle = token("--base-color-text-primary");
			context.fillText(label, labelX, 12);
		});
		if (this.hoverIndex !== null && this.hoverIndex < count) {
			context.strokeStyle = token("--base-color-text-muted");
			context.setLineDash([3, 3]);
			context.beginPath();
			context.moveTo(Math.round(x(this.hoverIndex)) + 0.5, 6);
			context.lineTo(Math.round(x(this.hoverIndex)) + 0.5, bottom);
			context.stroke();
			context.setLineDash([]);
		}
	}

	hover(event) {
		if (!this.data || !this.geometry) return;
		const rect = this.canvas.getBoundingClientRect();
		const index = Math.floor((event.clientX - rect.left - this.geometry.left) / this.geometry.slot);
		if (index < 0 || index >= this.geometry.count) {
			this.hoverIndex = null;
			tooltip.hidden = true;
			this.draw();
			return;
		}

		this.hoverIndex = index;
		this.draw();

		const rows = this.visibleSeries()
			.map(series => ({ series, value: series.values[index] ?? 0 }))
			.filter(item => item.value !== 0)
			.sort((a, b) => b.value - a.value)
			.slice(0, 12);
		const time = document.createElement("div");
		time.className = "tooltip-time";
		time.textContent = clock(this.data.times[index]);
		tooltip.replaceChildren(time, ...rows.map(({ series, value }) => {
			const line = document.createElement("div");
			line.className = "tooltip-row";
			const name = document.createElement("span");
			const swatch = document.createElement("span");
			swatch.className = "swatch";
			swatch.style.background = series.color;
			name.append(swatch, series.name);
			const amount = document.createElement("span");
			amount.textContent = this.unit(value);
			line.append(name, amount);
			return line;
		}));
		tooltip.hidden = false;
		tooltip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - tooltip.offsetWidth - 8)}px`;
		tooltip.style.top = `${Math.min(event.clientY + 14, window.innerHeight - tooltip.offsetHeight - 8)}px`;
	}
}