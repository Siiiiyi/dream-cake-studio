import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeFrostingGeometry } from './frostingGeometry.js';

export function CakePaintSurface({ surfaceRef }) {
  const geometry = useMemo(() => makeFrostingGeometry([], 161, true), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh ref={surfaceRef} geometry={geometry} userData={{ frostingSurface: true }}><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} /></mesh>;
}

export default function Frosting({ strokes, surfaceRef }) {
  const narrow = useThree(state => state.size.width < 600);
  const geometry = useMemo(() => makeFrostingGeometry(strokes, narrow ? 129 : 161), [strokes, narrow]);
  const grain = useMemo(() => {
    const size = 128, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const value = Math.round(155 + 14 * Math.sin(x * 0.42 + 0.8 * Math.sin(y * 0.12)) + 5 * Math.sin(x * 1.7 + y * 0.21));
      data.set([value, value, value, 255], (y * size + x) * 4);
    }
    const texture = new THREE.DataTexture(data, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => grain.dispose(), [grain]);
  return <mesh ref={surfaceRef} geometry={geometry} userData={{ frostingSurface: true }} castShadow receiveShadow>
    <meshPhysicalMaterial color="#ffffff" vertexColors transparent={false} opacity={1} depthWrite alphaTest={0} roughness={0.38} metalness={0} clearcoat={0.055} clearcoatRoughness={0.5} sheen={0} specularIntensity={0.32} bumpMap={grain} bumpScale={0.0006} />
  </mesh>;
}
