export const getJson = async path => {
	const response = await fetch(path, { cache: "no-store" });
	if (!response.ok) throw new Error(await response.text());
	return response.json();
}

export const post = async (path, body) => {
	const response = await fetch(path, { method: "POST", body });
	if (!response.ok) throw new Error(await response.text());
	return response.json();
}