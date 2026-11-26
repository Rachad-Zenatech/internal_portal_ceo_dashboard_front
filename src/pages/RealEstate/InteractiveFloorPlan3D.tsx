import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchRealEstateFloorplanBlob } from "@/hooks/useRealEstate";
import type { WallMeshData } from "@/types/realEstate";

interface InteractiveFloorPlan3DProps {
  projectId: string;
  cacheKey: string;
  wallMesh: WallMeshData;
  heightClass?: string;
}

export default function InteractiveFloorPlan3D({
  projectId,
  cacheKey,
  wallMesh,
  heightClass = "h-[460px]",
}: InteractiveFloorPlan3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wallsGroupRef = useRef<THREE.Group | null>(null);
  const resetCamRef = useRef<(() => void) | null>(null);
  const [wallScale, setWallScale] = useState(1.0);
  const [floorUrl, setFloorUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let objUrl = "";
    fetchRealEstateFloorplanBlob(projectId)
      .then((blob) => {
        if (!alive) return;
        objUrl = URL.createObjectURL(blob);
        setFloorUrl(objUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [projectId, cacheKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const aspect = Math.max(0.25, Math.min(4.0, wallMesh.aspect || 1.4));
    const width = aspect >= 1 ? 10 : 10 * aspect;
    const depth = aspect >= 1 ? 10 / aspect : 10;
    const wallH = Math.max(0.45, Math.min(2.0, (wallMesh.wall_height || 0.14) * Math.min(width, depth) * 1.15));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / Math.max(1, el.clientHeight), 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(el.clientWidth, Math.max(1, el.clientHeight));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.innerHTML = "";
    el.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.78);
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 0.9);
    keyLight.position.set(10, 18, 9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.35);
    fillLight.position.set(-10, 10, -8);
    scene.add(ambient, keyLight, fillLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI * 0.49;

    // Default centered top-down view matching the 2D floor plan framing
    const setDefaultCam = () => {
      const fovRad = THREE.MathUtils.degToRad(camera.fov);
      const viewAspect = el.clientWidth / Math.max(1, el.clientHeight);
      const fitHeight = (depth * 0.56) / Math.tan(fovRad / 2);
      const fitWidth = (width * 0.56) / (Math.tan(fovRad / 2) * viewAspect);
      const camY = Math.max(fitHeight, fitWidth, 6);
      camera.position.set(0, camY, 0.001);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    setDefaultCam();
    resetCamRef.current = setDefaultCam;

    // 1. Exact 1:1 2D Floor Plan Slab
    const slabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.02 });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 });
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.22, depth),
      [sideMat, sideMat, slabMat, sideMat, sideMat, sideMat]
    );
    slab.position.set(0, -0.11, 0);
    slab.receiveShadow = true;
    scene.add(slab);

    if (floorUrl) {
      new THREE.TextureLoader().load(floorUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        slabMat.map = tex;
        slabMat.needsUpdate = true;
      });
    }

    // 2. Pixel-Exact Extruded 3D Walls from OpenCV Contour Polygons
    const wallsGroup = new THREE.Group();
    const wallSideMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72, metalness: 0.04 });
    const wallCapMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.08 });

    for (const poly of wallMesh.polygons || []) {
      if (!poly.outer || poly.outer.length < 3) continue;
      const shape = new THREE.Shape();
      poly.outer.forEach(([nx, ny], i) => {
        const x = (nx - 0.5) * width;
        const y = (0.5 - ny) * depth;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });
      shape.closePath();

      for (const hole of poly.holes || []) {
        if (hole.length < 3) continue;
        const path = new THREE.Path();
        hole.forEach(([nx, ny], i) => {
          const x = (nx - 0.5) * width;
          const y = (0.5 - ny) * depth;
          if (i === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        });
        path.closePath();
        shape.holes.push(path);
      }

      const geo = new THREE.ExtrudeGeometry(shape, { depth: wallH, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, [wallCapMat, wallSideMat]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallsGroup.add(mesh);
    }
    scene.add(wallsGroup);
    wallsGroupRef.current = wallsGroup;

    // 3. Rotate/drag ONLY when pointer starts on the floor plan area (ignore empty side margins)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitsFloorPlan = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects([slab, wallsGroup], true).length > 0;
    };

    let isDraggingModel = false;
    const onPointerDown = (e: PointerEvent) => {
      if (!hitsFloorPlan(e.clientX, e.clientY)) {
        e.stopImmediatePropagation();
        return;
      }
      isDraggingModel = true;
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (isDraggingModel) return;
      renderer.domElement.style.cursor = hitsFloorPlan(e.clientX, e.clientY) ? "grab" : "default";
    };
    const onPointerUp = () => {
      isDraggingModel = false;
      renderer.domElement.style.cursor = "default";
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown, { capture: true });
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    const onResize = () => {
      if (!el) return;
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, Math.max(1, el.clientHeight));
    };
    window.addEventListener("resize", onResize);

    let rafId = 0;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown, { capture: true });
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
    };
  }, [wallMesh, floorUrl]);

  useEffect(() => {
    if (wallsGroupRef.current) {
      wallsGroupRef.current.scale.y = wallScale;
    }
  }, [wallScale]);

  return (
    <div className="relative rounded-lg border border-border overflow-hidden bg-slate-100">
      <div ref={containerRef} className={`w-full ${heightClass}`} />
      <div className="absolute top-2.5 right-2.5 flex items-center gap-2 rounded-md bg-background/90 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur border border-border">
        <span className="text-muted-foreground">Wall Height</span>
        <input
          type="range"
          min={0.3}
          max={2.0}
          step={0.1}
          value={wallScale}
          onChange={(e) => setWallScale(Number(e.target.value))}
          className="w-20 accent-primary cursor-pointer"
        />
        <Button size="sm" variant="ghost" onClick={() => resetCamRef.current?.()} className="h-6 px-1.5 text-xs gap-1 cursor-pointer">
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </div>
      <div className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-md bg-slate-900/75 px-2.5 py-1 text-[11px] text-white">
        Drag on floor plan to rotate 360° · Scroll to zoom · Right-drag to pan
      </div>
    </div>
  );
}
