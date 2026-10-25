import { useEffect, useState } from "react";

export const getJson = async <T,>(path: string): Promise<T> => {
	const response = await fetch(path, { cache: "no-store" });
	if (!response.ok) throw new Error(await response.text());
	return response.json() as Promise<T>;
}

export const post = async <T,>(path: string, body?: string): Promise<T> => {
	const response = await fetch(path, { method: "POST", body });
	if (!response.ok) throw new Error(await response.text());
	return response.json() as Promise<T>;
}

export const usePolling = <T,>(path: string, intervalMs: number) => {
	const [data, setData] = useState<T | null>(null);

	useEffect(() => {
		let timer = 0;
		let isActive = true;
		const tick = async () => {
			try {
				const next = await getJson<T>(path);
				if (isActive) setData(next);
			} catch (error) {
				console.error("[devdeck]", error);
			}
			if (isActive) timer = window.setTimeout(tick, intervalMs);
		}
		void tick();
		return () => {
			isActive = false;
			window.clearTimeout(timer);
		}
	}, [path, intervalMs]);

	return data;
}