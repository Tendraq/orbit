import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Joins CSS class names safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// "My Org Name" -> "my-org-name"
export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
