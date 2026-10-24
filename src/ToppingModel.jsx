import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { chocolateColors, STRAWBERRY_MODEL_SCALE } from './catalog.js';
import { colorFruitGeometry, makeBerryGeometry, makeFruitGrain, makeStandingStrawberryGeometry, STRAWBERRY_SEAT_HEIGHT, strawberrySeeds } from './fruitSurface.js';

function FruitSkin({ kind, color = '#ffffff' }) {
  const grain = useMemo(makeFruitGrain, []);
  useEffect(() => () => grain.dispose(), [grain]);
  return <meshPhysicalMaterial vertexColors color={color} metalness={0} roughness={kind === 'blueberry' ? 0.88 : kind === 'cherry' ? 0.47 : kind === 'strawberry' ? 0.4 : 0.65} clearcoat={kind === 'cherry' ? 0.13 : kind === 'strawberry' ? 0.065 : 0.035} clearcoatRoughness={0.62} bumpMap={grain} bumpScale={kind === 'blueberry' ? 0.0025 : kind === 'strawberry' ? 0.0009 : 0.0015} />;
}

function useOwnedGeometry(factory) {
  const geometry = useMemo(factory, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function Ball({ position, scale = 1, color, roughness = 0.45 }) {
  return <mesh position={position} scale={scale} castShadow receiveShadow><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color={color} roughness={roughness} /></mesh>;
}

function StrawberrySeeds({ seeds }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const matrix = new THREE.Object3D();
    for (let i = 0; i < seeds.length; i++) {
      const { point, normal, size, tilt } = seeds[i];
      matrix.position.copy(point).addScaledVector(normal, -0.0032);
      matrix.lookAt(point.clone().add(normal)); matrix.rotateZ(tilt); matrix.scale.set(0.0055 * size, 0.0108 * size, 0.0032 * size);
      matrix.updateMatrix(); ref.current.setMatrixAt(i, matrix.matrix);
      ref.current.setColorAt(i, new THREE.Color().setRGB(0.91 + 0.08 * size, 0.88 + 0.1 * Math.sin(i * 2.1), 0.8 + 0.12 * Math.cos(i * 1.7)));
    }
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.instanceColor.needsUpdate = true;
  }, [seeds]);
  return <instancedMesh ref={ref} args={[null, null, seeds.length]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#c5aa69" roughness={0.7} metalness={0} /></instancedMesh>;
}

function Strawberry() {
  const seeds = useMemo(strawberrySeeds, []);
  const geometry = useOwnedGeometry(() => makeStandingStrawberryGeometry(seeds));
  return <group scale={STRAWBERRY_MODEL_SCALE}><group position-y={STRAWBERRY_SEAT_HEIGHT} rotation-x={Math.PI}><mesh geometry={geometry} castShadow receiveShadow><FruitSkin kind="strawberry" /></mesh><StrawberrySeeds seeds={seeds} /></group></group>;
}

function Blueberry() {
  const geometry = useOwnedGeometry(() => makeBerryGeometry('blueberry'));
  return <group><mesh geometry={geometry} castShadow receiveShadow><FruitSkin kind="blueberry" /></mesh><Ball position={[0, 0.246, 0]} scale={[0.022, 0.005, 0.022]} color="#30354b" roughness={0.96} />{Array.from({ length: 5 }, (_, i) => <group key={i} position={[Math.cos(i * Math.PI * 0.4) * 0.027, 0.257, Math.sin(i * Math.PI * 0.4) * 0.027]} rotation-y={-i * Math.PI * 0.4}><mesh scale={[0.025, 0.006, 0.01]} rotation-z={0.22}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#5b627c" roughness={0.95} /></mesh></group>)}</group>;
}

function Cherry() {
  const geometry = useOwnedGeometry(() => makeBerryGeometry('cherry'));
  const curve = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.28, 0), new THREE.Vector3(0.03, 0.5, 0), new THREE.Vector3(0.14, 0.67, 0.025)]), []);
  return <group><mesh geometry={geometry} castShadow receiveShadow><FruitSkin kind="cherry" /></mesh><mesh castShadow><tubeGeometry args={[curve, 16, 0.009, 8, false]} /><meshStandardMaterial color="#657446" roughness={0.88} /></mesh><mesh position={[0.13, 0.58, 0.02]} rotation-z={-0.6} scale={[0.09, 0.014, 0.035]}><sphereGeometry args={[1, 16, 8]} /><meshStandardMaterial color="#71834f" roughness={0.9} /></mesh></group>;
}

function Raspberry() {
  const ref = useRef();
  const geometry = useOwnedGeometry(() => makeBerryGeometry('raspberry'));
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D(); let index = 0;
    const counts = [9, 10, 9, 7, 4], radii = [0.095, 0.132, 0.124, 0.093, 0.044];
    for (let row = 0; row < counts.length; row++) for (let i = 0; i < counts[row]; i++) {
      const a = i / counts[row] * Math.PI * 2 + row * 0.37;
      const r = radii[row] * (1 + 0.04 * Math.sin(i * 8));
      dummy.position.set(Math.cos(a) * r, 0.055 + row * 0.059 + Math.sin(i * 3) * 0.003, Math.sin(a) * r);
      dummy.scale.set(0.061, 0.056 + Math.sin(i * 7) * 0.003, 0.058);
      dummy.rotation.set(row * 0.3, a, 0.1); dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
      ref.current.setColorAt(index, new THREE.Color().setScalar(0.88 + 0.12 * (0.5 + 0.5 * Math.sin(index * 2.4)))); index++;
    }
    ref.current.instanceMatrix.needsUpdate = true; ref.current.instanceColor.needsUpdate = true;
  }, []);
  return <instancedMesh ref={ref} args={[geometry, null, 39]} castShadow receiveShadow><FruitSkin kind="raspberry" /></instancedMesh>;
}

function Orange() {
  const peel = useOwnedGeometry(() => colorFruitGeometry(new THREE.CylinderGeometry(0.27, 0.268, 0.07, 64, 1, false, Math.PI / 2, Math.PI), 'orange'));
  return <group rotation={[0.14, 0, -0.15]} position-y={0.045}><mesh geometry={peel} rotation-x={Math.PI / 2} castShadow><FruitSkin kind="orange" /></mesh>{[-1, 1].map(side => <group key={side}><mesh position-z={side * 0.04}><circleGeometry args={[0.242, 40, 0, Math.PI]} /><meshStandardMaterial color="#f6e4b6" roughness={0.83} side={THREE.DoubleSide} /></mesh>{Array.from({ length: 7 }, (_, i) => <OrangeSegment key={i} index={i} side={side} />)}</group>)}</group>;
}

function OrangeSegment({ index, side }) {
  const geometry = useOwnedGeometry(() => colorFruitGeometry(new THREE.CircleGeometry(0.218, 20, index * Math.PI / 7 + 0.025, Math.PI / 7 - 0.05), 'orange'));
  return <mesh geometry={geometry} position-z={side * 0.043} rotation-y={side < 0 ? Math.PI : 0} receiveShadow><FruitSkin kind="orange" /></mesh>;
}

function Rosette({ color, small }) {
  const geometry = useMemo(() => {
    const positions = [], indices = [], rows = 26, sides = 48;
    for (let j = 0; j <= rows; j++) {
      const t = j / rows, radius = 0.21 * Math.pow(1 - t, 0.72) * Math.min(1, t * 8 + 0.55);
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * Math.PI * 2, r = radius * (1 + 0.2 * Math.cos(8 * (a - t * 2.1)));
        positions.push(Math.cos(a) * r + t * t * 0.055, t * 0.33, Math.sin(a) * r);
        if (j < rows && i < sides) {
          const n = j * (sides + 1) + i;
          indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
        }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} scale={small ? [0.49, 0.43, 0.49] : 1} castShadow receiveShadow><meshStandardMaterial color={color || '#fff2dc'} roughness={0.54} side={THREE.DoubleSide} /></mesh>;
}

function Chocolate() {
  return <group position-y={0.22} rotation={[0.08, 0.3, -0.2]}><mesh castShadow><boxGeometry args={[0.3, 0.42, 0.045]} /><meshStandardMaterial color={chocolateColors.body} roughness={0.34} /></mesh>{[-1, 1].map(i => <mesh key={i} position={[i * 0.071, 0, 0.026]}><boxGeometry args={[0.125, 0.38, 0.025]} /><meshStandardMaterial color={chocolateColors.face} roughness={0.4} /></mesh>)}<mesh position={[0, 0, 0.045]}><boxGeometry args={[0.3, 0.01, 0.005]} /><meshStandardMaterial color={chocolateColors.groove} /></mesh></group>;
}

function Candle() {
  return <group><mesh position-y={0.3} castShadow><cylinderGeometry args={[0.045, 0.045, 0.6, 20]} /><meshStandardMaterial color="#98a88b" roughness={0.45} /></mesh>{[0.1, 0.22, 0.34, 0.46].map(y => <mesh key={y} position-y={y} rotation-x={Math.PI / 2}><torusGeometry args={[0.045, 0.009, 5, 20]} /><meshStandardMaterial color="#f7ead0" /></mesh>)}<mesh position-y={0.63}><cylinderGeometry args={[0.005, 0.005, 0.07, 6]} /><meshStandardMaterial color="#4b3c31" /></mesh><mesh position-y={0.72} scale={[0.038, 0.08, 0.038]}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#ffcb76" emissive="#ffb74d" emissiveIntensity={0.7} /></mesh></group>;
}

export function ToppingModel({ type, color, small }) {
  if (type === 'strawberry') return <Strawberry />;
  if (type === 'blueberry') return <Blueberry />;
  if (type === 'cherry') return <Cherry />;
  if (type === 'raspberry') return <Raspberry />;
  if (type === 'orange') return <Orange />;
  if (type === 'rosette') return <Rosette {...{ color, small }} />;
  if (type === 'chocolate') return <Chocolate />;
  if (type === 'candle') return <Candle />;
  if (type === 'pearls') return <group>{[[0, 0.06, 0], [0.11, 0.045, 0.04], [-0.07, 0.04, 0.08], [0.04, 0.035, -0.1]].map((position, i) => <Ball key={i} position={position} scale={0.04 + (i === 0 ? 0.014 : 0)} color={i % 2 ? '#e4cb99' : '#fff0dc'} roughness={0.2} />)}</group>;
  return null;
}
