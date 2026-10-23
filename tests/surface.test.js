import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { aimRay, surfaceContact } from '../src/surface.js';
import { CAKE_TOP, CAKE_OFFSET } from '../src/frosting.js';

test('screen points map to the cake in desktop, mobile and rotated views', () => {
  for (const rect of [{ left: 330, top: 250, width: 900, height: 500 }, { left: 0, top: 190, width: 390, height: 345 }]) {
    for (const position of [[4.6, 3.8, 6.4], [-5, 4, 3], [0.1, 8.8, 0.1]]) {
      const camera = new THREE.PerspectiveCamera(32, rect.width / rect.height, 0.1, 100);
      camera.position.set(...position); camera.lookAt(0, 0.55, 0); camera.updateMatrixWorld();
      const surface = new THREE.Mesh(new THREE.CircleGeometry(1.43, 80), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      surface.rotation.x = -Math.PI / 2; surface.position.y = CAKE_TOP + CAKE_OFFSET; surface.updateMatrixWorld();
      const expected = new THREE.Vector3(0.45, CAKE_TOP + CAKE_OFFSET, -0.4);
      const ndc = expected.clone().project(camera), raycaster = new THREE.Raycaster();
      aimRay(raycaster, new THREE.Vector2(), { clientX: rect.left + (ndc.x + 1) * rect.width / 2, clientY: rect.top + (1 - ndc.y) * rect.height / 2 }, rect, camera);
      const actual = surfaceContact(raycaster, [surface]);
      assert.ok(Math.abs(actual.x - expected.x) < 0.00001);
      assert.ok(Math.abs(actual.z - expected.z) < 0.00001);
      assert.ok(Math.abs(actual.y - CAKE_TOP) < 0.00001);
      surface.geometry.dispose(); surface.material.dispose();
    }
  }
});

test('the ray chooses raised cream before the cake underneath', () => {
  const surfaces = [0, 0.13].map(height => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = CAKE_TOP + CAKE_OFFSET + height; mesh.updateMatrixWorld(); return mesh;
  });
  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0));
  assert.ok(Math.abs(surfaceContact(raycaster, surfaces).y - CAKE_TOP - 0.13) < 0.00001);
  assert.equal(surfaceContact(new THREE.Raycaster(new THREE.Vector3(4, 5, 0), new THREE.Vector3(0, -1, 0)), surfaces), null);
  for (const mesh of surfaces) { mesh.geometry.dispose(); mesh.material.dispose(); }
});
