import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getEdhrecUrl(commanderName: string): string {
  // If the card is double-faced (e.g. "Esika, God of the Tree // The Prismatic Bridge"), 
  // EDHREC only uses the front face name.
  const frontFace = commanderName.split('//')[0].trim();
  
  const normalized = frontFace
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s-]/g, "")    // Strip punctuation, keep spaces and hyphens
    .trim()
    .replace(/\s+/g, "-")           // Convert spaces to hyphens
    .replace(/-+/g, "-");           // Deduplicate consecutive hyphens
    
  return `https://edhrec.com/commanders/${normalized}`;
}
