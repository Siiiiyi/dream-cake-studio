import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleCreamStroke, finishCreamStroke, CAKE_OFFSET, CAKE_TOP, MAX_FROST_POINTS } from './frosting.js';
import { footprint, isValidPosition, MAX_TOPPINGS, TOP_RADIUS } from './design.js';
import { aimRay, surfaceContact } from './surface.js';

export default function SurfaceInteraction(props) {
  const { gl, camera } = useThree();
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const canvas = gl.domElement, raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let gesture = null, frame = 0, pending = null;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(CAKE_TOP + CAKE_OFFSET));
    function aim(event) {
      const rect = canvas.getBoundingClientRect();
      aimRay(raycaster, pointer, event, rect, camera);
    }
    function hitSurface(event) {
      aim(event);
      const targets = [latest.current.surfaceRef.current, latest.current.frostRef.current].filter(Boolean);
      return surfaceContact(raycaster, targets);
    }
    function dragContact(event) {
      const contact = hitSurface(event);
      if (contact) return contact;
      const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      return point ? { x: point.x, z: point.z } : null;
    }
    function hitItem(event) {
      aim(event);
      const hit = raycaster.intersectObjects([...latest.current.toppingRefs.current.values()], true)[0];
      let node = hit?.object;
      while (node && !node.userData.toppingId) node = node.parent;
      return latest.current.items.find(item => item.id === node?.userData.toppingId);
    }
    function append(contact, time = performance.now()) {
      if (!contact) { gesture.last = null; return; }
      const paint = { x: contact.paintX ?? contact.x, z: contact.paintZ ?? contact.z };
      const sampled = sampleCreamStroke(gesture.last, paint, { remaining: gesture.remaining, elapsed: time - gesture.lastTime, previousAngle: gesture.angle, travelled: gesture.travelled });
      const { points } = sampled;
      const room = MAX_FROST_POINTS - gesture.existing - gesture.stroke.points.length;
      if (points.length && room > 0) {
        gesture.stroke = { ...gesture.stroke, points: [...gesture.stroke.points, ...points.slice(0, room)] };
        gesture.remaining = sampled.remaining; gesture.travelled = sampled.travelled; gesture.angle = sampled.angle; gesture.lastTime = time;
        latest.current.onDraft(gesture.stroke); gesture.last = paint;
      } else if (room <= 0 && !gesture.limited) {
        gesture.limited = true; latest.current.onNotice('奶油已经很丰盈了，可以撤销笔触或重置后继续。');
      }
    }
    function preview(event) {
      const p = latest.current, contact = hitSurface(event);
      if (p.mode !== 'place' || !p.pendingType || !contact) { p.onGhost(null); return; }
      const candidate = { type: p.pendingType, scale: 1, x: contact.x, z: contact.z };
      p.onGhost({ ...candidate, valid: p.items.length < MAX_TOPPINGS && isValidPosition(candidate, p.items) });
    }
    function update(event) {
      if (!gesture) { preview(event); return; }
      if (gesture.pointerId !== event.pointerId) return;
      const contact = gesture.kind === 'drag' ? dragContact(event) : hitSurface(event);
      if (gesture.kind === 'frost') append(contact, event.timeStamp);
      if (gesture.kind === 'drag' && contact) {
        const candidate = { ...gesture.item, x: contact.x + gesture.offset.x, z: contact.z + gesture.offset.z };
        const max = TOP_RADIUS - footprint(candidate), distance = Math.hypot(candidate.x, candidate.z);
        if (distance > max) { candidate.x *= max / distance; candidate.z *= max / distance; }
        const valid = isValidPosition(candidate, latest.current.items);
        if (valid) gesture.lastValid = candidate;
        latest.current.onDrag({ ...gesture.lastValid, valid });
      }
      if (gesture.kind === 'place') preview(event);
    }
    function flush() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (pending) { const event = pending; pending = null; update(event); }
    }
    function end(cancelled = false) {
      if (!gesture) return;
      flush();
      const saved = gesture; gesture = null;
      if (!cancelled) {
        if (saved.kind === 'frost' && saved.stroke.points.length) latest.current.onStroke(finishCreamStroke(saved.stroke));
        if (saved.kind === 'drag' && (saved.lastValid.x !== saved.item.x || saved.lastValid.z !== saved.item.z)) latest.current.onDrop(saved.item.id, { x: saved.lastValid.x, z: saved.lastValid.z });
      }
      latest.current.onDraft(null); latest.current.onDrag(null);
      if (latest.current.controlsRef.current) latest.current.controlsRef.current.enabled = true;
      canvas.style.cursor = '';
      if (canvas.hasPointerCapture(saved.pointerId)) canvas.releasePointerCapture(saved.pointerId);
    }
    function down(event) {
      const p = latest.current;
      if (gesture || p.mode === 'orbit' || event.button !== 0 || event.isPrimary === false) return;
      let contact = hitSurface(event);
      const item = p.mode !== 'frost' ? hitItem(event) : null;
      if (item && !contact) contact = dragContact(event);
      if (p.mode === 'frost' && contact) {
        gesture = { kind: 'frost', pointerId: event.pointerId, stroke: { id: crypto.randomUUID(), color: p.creamColor, points: [] }, last: null, remaining: 1, travelled: 0, angle: null, lastTime: event.timeStamp, existing: p.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) };
        append(contact, event.timeStamp);
      } else if (item && contact) {
        gesture = { kind: 'drag', pointerId: event.pointerId, item, lastValid: item, offset: { x: item.x - contact.x, z: item.z - contact.z } };
        p.onSelect(item.id); p.onGhost(null); canvas.style.cursor = 'grabbing';
      } else if (p.mode === 'place' && contact) {
        gesture = { kind: 'place', pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY };
        preview(event);
      } else { if (p.mode === 'select') p.onSelect(null); return; }
      event.preventDefault(); event.stopImmediatePropagation();
      if (p.controlsRef.current) p.controlsRef.current.enabled = false;
      canvas.setPointerCapture(event.pointerId);
    }
    function move(event) {
      if (gesture && gesture.pointerId !== event.pointerId) return;
      if (gesture) { event.preventDefault(); event.stopImmediatePropagation(); }
      pending = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId, timeStamp: event.timeStamp };
      if (!frame) frame = requestAnimationFrame(flush);
    }
    function up(event) {
      if (gesture?.pointerId !== event.pointerId) return;
      event.preventDefault(); event.stopImmediatePropagation(); flush();
      if (gesture.kind === 'place' && (gesture.pointerType === 'touch' || gesture.pointerType === 'pen' || Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 10)) {
        const contact = hitSurface(event);
        if (contact) latest.current.onPlace(latest.current.pendingType, contact);
        latest.current.onGhost(null);
      }
      end();
    }
    function cancel(event) { if (gesture?.pointerId === event.pointerId) end(true); }
    function key(event) { if (event.key === 'Escape') { end(true); latest.current.onCancelTool(); latest.current.onGhost(null); } }
    function leave() { if (!gesture) { flush(); latest.current.onGhost(null); } }
    function blur() { end(true); latest.current.onGhost(null); }
    canvas.addEventListener('pointerdown', down, true); canvas.addEventListener('pointermove', move, true);
    canvas.addEventListener('pointerup', up, true); canvas.addEventListener('pointercancel', cancel, true);
    canvas.addEventListener('lostpointercapture', cancel); canvas.addEventListener('pointerleave', leave);
    window.addEventListener('keydown', key); window.addEventListener('blur', blur);
    return () => {
      end(true); if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move, true);
      canvas.removeEventListener('pointerup', up, true); canvas.removeEventListener('pointercancel', cancel, true);
      canvas.removeEventListener('lostpointercapture', cancel); canvas.removeEventListener('pointerleave', leave);
      window.removeEventListener('keydown', key); window.removeEventListener('blur', blur);
    };
  }, [gl, camera]);
  return null;
}
