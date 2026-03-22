import { writable } from "svelte/store";

export const selectedYear = writable<number | null>(null);
export const selectedState = writable<string | null>(null);