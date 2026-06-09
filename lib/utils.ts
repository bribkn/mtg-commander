import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getEdhrecSlug(name: string): string {
  // If the card is double-faced (e.g. "Esika, God of the Tree // The Prismatic Bridge"), 
  // EDHREC only uses the front face name.
  const frontFace = name.split('//')[0].trim();
  
  return frontFace
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s-]/g, "")    // Strip punctuation, keep spaces and hyphens
    .trim()
    .replace(/\s+/g, "-")           // Convert spaces to hyphens
    .replace(/-+/g, "-");           // Deduplicate consecutive hyphens
}

export function getEdhrecUrl(commanderName: string): string {
  return `https://edhrec.com/commanders/${getEdhrecSlug(commanderName)}`;
}
