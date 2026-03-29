import { writable } from "svelte/store";

export const selectedYear = writable<number | null>(null);
export const selectedState = writable<string | null>(null);

export const selectedVis3Mode = writable<"overall" | "sex" | "race" | "county">("overall");
export const selectedAgeGroup = writable<"35+" | "35-64" | "65+">("35+");