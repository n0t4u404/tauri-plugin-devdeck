import { clock } from "#/shared/format.js";
import { drawDot, drawGrid, fitPeak, niceStep, sizeCanvas, token, traceCurve, verticalFill, withAlpha } from "#/shared/chart.js";

const tooltip = document.getElementById("tooltip");

export class Panel {
	constructor({ title, subtitle, unit, columns, note, kind = "areas" }) {
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
		const isStacked = this.kind !== "lines";
		const tops = [];
		const totals = new Array(count).fill(0);
		if (isStacked) {
			for (const item of series) {
				tops.push(totals.map((total, index) => total + (item.values[index] ?? 0)));
				tops.at(-1).forEach((value, index) => totals[index] = value);
			}
		}
		const heights = isStacked ? totals : series.flatMap(item => item.values.map(value => value ?? 0));
		const peak = fitPeak(heights);
		const step = niceStep(peak, 4);
		const top = Math.ceil(peak / step) * step;

		context.font = `11px ${token("--font-family-body")}`;
		const labels = [];
		for (let value = 0; value <= top + step / 2; value += step) labels.push(value);
		const left = Math.max(...labels.map(value => context.measureText(this.unit(value)).width)) + 16;
		const right = width - 6;
		const plotTop = 14;
		const bottom = height - 24;
		const plotWidth = right - left;
		const y = value => bottom - Math.min(value, top * 1.04) / top * (bottom - plotTop);
		const isBars = this.kind === "bars";
		const slot = plotWidth / count;
		const x = isBars ? index => left + slot * index + slot / 2 : index => left + (count === 1 ? plotWidth : index / (count - 1) * plotWidth);
		this.geometry = { left, plotWidth, count, isBars, x };

		drawGrid(context, { left, right, y, labels, unit: this.unit });
		context.textAlign = "center";
		context.textBaseline = "alphabetic";
		const timeEvery = Math.max(1, Math.round(count / Math.max(2, Math.floor(plotWidth / 110))));
		for (let index = 0; index < count; index += timeEvery) context.fillText(clock(this.data.times[index]), x(index), height - 4);

		const dim = item => this.highlight && this.highlight !== item.key ? 0.18 : 1;
		context.save();
		context.beginPath();
		context.rect(left, 0, plotWidth, bottom + 1);
		context.clip();
		if (this.kind === "areas") {
			series.forEach((item, order) => {
				const upper = tops[order].map((value, index) => [x(index), y(value)]);
				const lower = (tops[order - 1] ?? new Array(count).fill(0)).map((value, index) => [x(index), y(value)]).reverse();
				context.globalAlpha = dim(item);
				context.beginPath();
				traceCurve(context, upper);
				traceCurve(context, lower, { isContinuing: true });
				context.closePath();
				context.fillStyle = verticalFill(context, item.color, plotTop, bottom, 0.55, 0.12);
				context.fill();
				context.beginPath();
				traceCurve(context, upper);
				context.strokeStyle = item.color;
				context.lineWidth = 1.5;
				context.stroke();
			});
		} else if (isBars) {
			const barWidth = Math.max(2, Math.min(10, slot * 0.6));
			const base = new Array(count).fill(0);
			for (const item of series) {
				context.globalAlpha = dim(item);
				context.fillStyle = item.color;
				for (let index = 0; index < count; index++) {
					const value = item.values[index] ?? 0;
					if (value <= 0) continue;
					const from = y(base[index]);
					const to = y(base[index] + value);
					context.beginPath();
					context.roundRect(x(index) - barWidth / 2, to, barWidth, Math.max(2, from - to - 1), barWidth / 2);
					context.fill();
					base[index] += value;
				}
			}
		} else {
			for (const item of series) {
				const points = item.values.map((value, index) => [x(index), y(value ?? 0)]);
				context.globalAlpha = dim(item);
				context.beginPath();
				traceCurve(context, points);
				context.lineTo(points.at(-1)[0], bottom);
				context.lineTo(points[0][0], bottom);
				context.closePath();
				context.fillStyle = verticalFill(context, item.color, plotTop, bottom, 0.16, 0);
				context.fill();
				context.beginPath();
				traceCurve(context, points);
				context.shadowColor = withAlpha(item.color, 0.55);
				context.shadowBlur = 10;
				context.strokeStyle = item.color;
				context.lineWidth = 2;
				context.stroke();
				context.shadowBlur = 0;
			}
		}
		context.restore();
		context.globalAlpha = 1;

		const peaks = isStacked ? totals : Array.from({ length: count }, (_, index) => Math.max(0, ...series.map(item => item.values[index] ?? 0)));
		context.font = `600 10px ${token("--font-family-body")}`;
		context.textAlign = "center";
		context.textBaseline = "middle";
		let labelEnd = -Infinity;
		peaks.forEach((value, index) => {
			if (value <= top) return;
			const label = `▲ ${this.unit(value)}`;
			const labelWidth = context.measureText(label).width + 12;
			const labelX = Math.min(Math.max(x(index), left + labelWidth / 2), right - labelWidth / 2);
			if (labelX - labelWidth / 2 < labelEnd + 4) return;
			labelEnd = labelX + labelWidth / 2;
			context.beginPath();
			context.roundRect(labelX - labelWidth / 2, 0, labelWidth, 16, 8);
			context.fillStyle = withAlpha(token("--base-color-danger"), 0.16);
			context.fill();
			context.fillStyle = token("--base-color-danger");
			context.fillText(label, labelX, 8.5);
		});

		if (this.hoverIndex !== null && this.hoverIndex < count) {
			const hoverX = Math.round(x(this.hoverIndex)) + 0.5;
			const line = context.createLinearGradient(0, plotTop, 0, bottom);
			line.addColorStop(0, withAlpha(token("--base-color-text-primary"), 0));
			line.addColorStop(0.5, withAlpha(token("--base-color-text-primary"), 0.35));
			line.addColorStop(1, withAlpha(token("--base-color-text-primary"), 0));
			context.strokeStyle = line;
			context.lineWidth = 1;
			context.beginPath();
			context.moveTo(hoverX, plotTop);
			context.lineTo(hoverX, bottom);
			context.stroke();
			if (!isBars) {
				series.forEach((item, order) => {
					const value = isStacked ? tops[order][this.hoverIndex] : item.values[this.hoverIndex];
					if (value === null || value === undefined || (isStacked && !item.values[this.hoverIndex])) return;
					drawDot(context, x(this.hoverIndex), y(value), item.color);
				});
			}
		}
	}

	hover(event) {
		if (!this.data || !this.geometry) return;
		const rect = this.canvas.getBoundingClientRect();
		const { left, plotWidth, count, isBars } = this.geometry;
		const offset = (event.clientX - rect.left - left) / plotWidth;
		const index = isBars ? Math.floor(offset * count) : Math.round(offset * (count - 1));
		if (index < 0 || index >= count) {
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