import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ToppingModel } from './ToppingModel.jsx';
import Frosting, { CakePaintSurface } from './Frosting.jsx';
import SurfaceInteraction from './SurfaceInteraction.jsx';
import { toppingHeight } from './frosting.js';

function RoundCylinder({ radius, height, color, y, roughness = 0.7, map }) {
  const points = useMemo(() => {
    const bevel = Math.min(0.07, height / 3);
    const p = [new THREE.Vector2(0, -height / 2)];
    for (let i = 0; i <= 8; i++) {
      const a = -Math.PI / 2 + (i / 8) * Math.PI / 2;
      p.push(new THREE.Vector2(radius - bevel + Math.cos(a) * bevel, -height / 2 + bevel + Math.sin(a) * bevel));
    }
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI / 2;
      p.push(new THREE.Vector2(radius - bevel + Math.cos(a) * bevel, height / 2 - bevel + Math.sin(a) * bevel));
    }
    p.push(new THREE.Vector2(0, height / 2));
    return p;
  }, [radius, height]);
  return <mesh position-y={y} castShadow receiveShadow><latheGeometry args={[points, 112]} /><meshStandardMaterial color={color} roughness={roughness} bumpMap={map} bumpScale={0.018} /></mesh>;
}

function makeCrumbTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  let seed = 17;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = seed % 100 < 17 ? 95 + seed % 50 : 190 + seed % 65;
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 2); texture.needsUpdate = true;
  return texture;
}

function Cake({ baseColor, creamColor, items, selected, finished, strokes, surfaceRef, frostRef, toppingRefs, drag, ghost }) {
  const crumb = useMemo(makeCrumbTexture, []);
  useEffect(() => () => crumb.dispose(), [crumb]);
  return <group position-y={-0.8}>
    <RoundCylinder radius={0.85} height={0.14} y={-0.33} color="#ede9e1" roughness={0.2} />
    <mesh position-y={-0.26} castShadow><latheGeometry args={[[new THREE.Vector2(0.65, 0), new THREE.Vector2(0.46, 0.08), new THREE.Vector2(0.25, 0.25), new THREE.Vector2(0.23, 0.78), new THREE.Vector2(0.42, 1)], 80]} /><meshStandardMaterial color="#f1eee6" roughness={0.22} /></mesh>
    <RoundCylinder radius={1.92} height={0.15} y={0.8} color="#fffdf9" roughness={0.2} />
    <RoundCylinder radius={1.8} height={0.035} y={0.89} color="#eee9e0" roughness={0.3} />
    <RoundCylinder radius={1.5} height={0.5} y={1.15} color={baseColor} map={crumb} />
    <RoundCylinder radius={1.51} height={0.15} y={1.455} color="#fff2dc" />
    <RoundCylinder radius={1.5} height={0.51} y={1.78} color={baseColor} map={crumb} />
    <CakePaintSurface surfaceRef={surfaceRef} />
    <Frosting strokes={strokes} surfaceRef={frostRef} />
    {Array.from({ length: 42 }, (_, i) => {
      const a = i / 42 * Math.PI * 2;
      return <group key={i} position={[Math.cos(a) * 1.48, 0.98, Math.sin(a) * 1.48]} rotation-y={-a}><ToppingModel type="rosette" color="#fff2dc" small /></group>;
    })}
    {items.map(original => {
      const item = drag?.id === original.id ? drag : original;
      return <PlacedTopping key={item.id} item={item} y={toppingHeight(item, strokes)} selected={!finished && selected === item.id} creamColor={creamColor} toppingRefs={toppingRefs} />;
    })}
    {ghost && !finished && <GhostTopping ghost={ghost} y={toppingHeight(ghost, strokes)} creamColor={creamColor} />}
  </group>;
}

function PlacedTopping({ item, y, selected, creamColor, toppingRefs }) {
  const ref = useRef();
  const target = useMemo(() => new THREE.Vector3(item.scale, item.scale, item.scale), [item.scale]);
  useFrame((_, delta) => { ref.current?.scale.lerp(target, Math.min(1, delta * 12)); });
  return <group ref={node => { if (node) toppingRefs.current.set(item.id, node); else toppingRefs.current.delete(item.id); }} userData={{ toppingId: item.id }} position={[item.x, y, item.z]}>
    {selected && <mesh raycast={() => null} rotation-x={-Math.PI / 2} position-y={0.008}><ringGeometry args={[0.27 * item.scale, 0.29 * item.scale, 48]} /><meshBasicMaterial color={item.valid === false ? '#b85f53' : '#8a9c7a'} transparent opacity={0.8} side={THREE.DoubleSide} /></mesh>}
    <group ref={ref} scale={0.01} rotation-y={item.rotation || 0}>
      <ToppingModel type={item.type} color={creamColor} />
    </group>
  </group>;
}

function GhostTopping({ ghost, y, creamColor }) {
  const ref = useRef();
  useEffect(() => { ref.current?.traverse(node => { if (node.isMesh) { node.raycast = () => null; node.castShadow = false; node.material.transparent = true; node.material.opacity = 0.42; node.material.depthWrite = false; } }); }, [ghost.type]);
  return <group position={[ghost.x, y, ghost.z]}>
    <group ref={ref} key={ghost.type}><ToppingModel type={ghost.type} color={creamColor} /></group>
    <mesh raycast={() => null} rotation-x={-Math.PI / 2} position-y={0.005}><ringGeometry args={[0.255, 0.275, 48]} /><meshBasicMaterial color={ghost.valid ? '#7e9468' : '#b85f53'} transparent opacity={0.75} side={THREE.DoubleSide} /></mesh>
  </group>;
}

function SceneBridge({ onReady, view, resetView, controlsRef }) {
  const { gl, scene, camera, invalidate } = useThree();
  const controls = controlsRef;
  useEffect(() => {
    onReady(() => {
      const size = gl.getSize(new THREE.Vector2());
      const pixelRatio = gl.getPixelRatio();
      const factor = 2000 / Math.max(size.x, size.y);
      const image = document.createElement('canvas');
      image.width = Math.round(size.x * factor); image.height = Math.round(size.y * factor);
      // Render again at export resolution so phone-sized previews still produce sharp images.
      try {
        gl.setPixelRatio(1); gl.setSize(image.width, image.height, false);
        gl.render(scene, camera);
        image.getContext('2d').drawImage(gl.domElement, 0, 0);
      } finally {
        gl.setPixelRatio(pixelRatio); gl.setSize(size.x, size.y, false);
        gl.render(scene, camera);
      }
      return image;
    });
  }, [gl, scene, camera, onReady]);
  useEffect(() => {
    camera.position.set(...(view === 'top' ? [0.1, 8.8, 0.1] : [4.6, 3.8, 6.4]));
    controls.current?.target.set(0, 0.55, 0);
    controls.current?.update(); invalidate();
  }, [view, resetView, camera, invalidate]);
  return <OrbitControls ref={controls} target={[0, 0.55, 0]} enablePan={false} enableDamping dampingFactor={0.08} minDistance={5.7} maxDistance={10} minPolarAngle={0.025} maxPolarAngle={Math.PI / 2.25} />;
}

class SceneErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-fallback">3D 画面暂时无法加载，请开启浏览器硬件加速后刷新页面。</div> : this.props.children; }
}

export default function CakeScene({ baseColor, creamColor, items = [], selected, onSelect, onReady, view, resetView, finished, strokes = [], mode = 'select', onStroke, pendingType, onPlace, onDrop, onCancelTool, onNotice }) {
  const surfaceRef = useRef(), frostRef = useRef(), controlsRef = useRef();
  const [draft, setDraft] = useState(null);
  const toppingRefs = useRef(new Map());
  const [drag, setDrag] = useState(null), [ghost, setGhost] = useState(null);
  useEffect(() => { setGhost(null); }, [mode, pendingType, finished]);
  const visibleStrokes = useMemo(() => draft ? [...strokes, draft] : strokes, [strokes, draft]);
  useEffect(() => () => { document.body.style.cursor = ''; }, [items]);
  return <SceneErrorBoundary><Canvas shadows dpr={[1, 2]} camera={{ position: [4.6, 3.8, 6.4], fov: 32 }} gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }} onPointerMissed={() => onSelect(null)} fallback={<div className="scene-fallback">你的浏览器暂不支持 3D，请使用开启硬件加速的 Chrome 或 Safari。</div>}>
    <ambientLight intensity={0.7} />
    <hemisphereLight args={['#fff8f0', '#d5c5b4', 1.1]} />
    <directionalLight position={[-3.5, 7, 5]} intensity={2.15} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.00015} shadow-normalBias={0.016} shadow-radius={3} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} />
    <directionalLight position={[4, 3, -3]} intensity={0.8} color="#fff4e5" />
    <Cake {...{ baseColor, creamColor, items, selected, finished, surfaceRef, frostRef, toppingRefs, drag }} ghost={mode === 'place' ? ghost : null} strokes={visibleStrokes} />
    <SurfaceInteraction {...{ mode, creamColor, strokes, surfaceRef, frostRef, controlsRef, toppingRefs, items, pendingType, onStroke, onSelect, onPlace, onDrop, onCancelTool, onNotice }} onDraft={setDraft} onDrag={setDrag} onGhost={setGhost} />
    <ContactShadows position={[0, -1.21, 0]} opacity={0.28} scale={12} blur={2.8} far={5} resolution={512} color="#887265" />
    <SceneBridge {...{ onReady, view, resetView, controlsRef }} />
  </Canvas></SceneErrorBoundary>;
}
