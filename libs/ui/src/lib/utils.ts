import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Joins class names and resolves Tailwind conflicts, so a caller's
// `className="px-8"` beats a component's built-in `px-4` instead of both applying.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
