import { CAKE_OFFSET, FROST_RADIUS } from './frosting.js';

export function aimRay(raycaster, pointer, event, rect, camera) {
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}

export function surfaceContact(raycaster, targets) {
  const hit = raycaster.intersectObjects(targets.filter(Boolean), false)[0];
  if (!hit) return null;
  const paint = hit.object.userData.frostingSurface && hit.uv ? { paintX: (hit.uv.x * 2 - 1) * FROST_RADIUS, paintZ: (hit.uv.y * 2 - 1) * FROST_RADIUS } : {};
  return { x: hit.point.x, z: hit.point.z, y: hit.point.y - CAKE_OFFSET, ...paint };
}
