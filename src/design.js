import { toppings } from './catalog.js';

export const MAX_TOPPINGS = 32;
export const TOP_RADIUS = 1.4;

export function footprint(item) {
  return (toppings.find(t => t.id === item.type)?.radius ?? 0.22) * item.scale;
}

export function isValidPosition(item, items) {
  return Math.hypot(item.x, item.z) + footprint(item) <= TOP_RADIUS && items.every(other => other.id === item.id || Math.hypot(item.x - other.x, item.z - other.z) >= (footprint(item) + footprint(other)) * 0.94);
}

export function findPlacement(type, items) {
  if (items.length >= MAX_TOPPINGS) return null;
  const item = { type, scale: 1, x: 0, z: 0 };
  // Try a decorative outer ring before filling the center; avoid overlaps at every size.
  for (let i = 0; i < 360; i++) {
    const ring = i < 16 ? 1.03 : 1.15 * Math.sqrt(((i - 16) % 67) / 67);
    const angle = i * 2.399963 + Math.PI / 6;
    const candidate = { ...item, x: Math.cos(angle) * ring, z: Math.sin(angle) * ring };
    if (isValidPosition(candidate, items)) return candidate;
  }
  return null;
}

export function updateTopping(items, id, patch) {
  const current = items.find(item => item.id === id);
  if (!current) return items;
  const next = { ...current, ...patch, scale: Math.max(0.65, Math.min(1.5, Number(patch.scale ?? current.scale))) };
  if (!Number.isFinite(next.scale) || !Number.isFinite(next.x) || !Number.isFinite(next.z) || !isValidPosition(next, items)) return items;
  return items.map(item => item.id === id ? next : item);
}
