import * as THREE from 'three';

/**
 * Placeholder project data. In a real app this would come from a CMS/API; here
 * we generate canvas textures from it so the build needs zero image assets.
 */
const PROJECTS = [
  { title: 'Aurora', tag: 'Brand Site', color: '#6ea8fe' },
  { title: 'Nimbus', tag: 'Dashboard', color: '#7ee0c5' },
  { title: 'Vertex', tag: '3D Config', color: '#ffb86b' },
  { title: 'Lumen', tag: 'Marketing', color: '#b58cff' },
  { title: 'Cobalt', tag: 'E‑commerce', color: '#ff7a9c' },
  { title: 'Strata', tag: 'Docs Portal', color: '#84d0ff' },
  { title: 'Ember', tag: 'Landing', color: '#ff9b6b' },
  { title: 'Quartz', tag: 'Portfolio', color: '#9af0a8' },
];

const PANEL_SPACING = 6.5; // distance between panels along -Z
const FIRST_PANEL_Z = -4; // z of the first panel
const PANEL_W = 3.2;
const PANEL_H = 2.0;
const CORRIDOR_HALF_WIDTH = 3.4;

/**
 * Draw a placeholder "card" onto an offscreen canvas and wrap it in a texture.
 * @returns {THREE.CanvasTexture}
 */
function makePanelTexture({ title, tag, color }, index) {
  const w = 512;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Background gradient.
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#11151d');
  grad.addColorStop(1, '#1b2230');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Accent bar.
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, 10);

  // Index chip.
  ctx.fillStyle = color;
  ctx.font = '600 26px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(String(index + 1).padStart(2, '0'), 36, 70);

  // Tag.
  ctx.fillStyle = '#9aa4b2';
  ctx.font = '500 22px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(tag.toUpperCase(), 36, 210);

  // Title.
  ctx.fillStyle = '#f4f6fb';
  ctx.font = '700 64px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(title, 36, 160);

  // Decorative frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Build the gallery: floor, side walls, and the panels. Returns the group plus
 * layout metadata the scroll controller uses to size its travel.
 *
 * @param {THREE.Scene} scene
 * @returns {{ group: THREE.Group, panels: THREE.Mesh[], startZ: number, endZ: number }}
 */
export function createGallery(scene) {
  const group = new THREE.Group();

  const corridorLength = FIRST_PANEL_Z - (PROJECTS.length - 1) * PANEL_SPACING - 8;

  // --- Floor -------------------------------------------------------------
  const floorGeo = new THREE.PlaneGeometry(CORRIDOR_HALF_WIDTH * 2 + 1, Math.abs(corridorLength) + 30);
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#0e1218',
    roughness: 0.85,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = corridorLength / 2 + 5;
  floor.receiveShadow = true;
  group.add(floor);

  // --- Side walls --------------------------------------------------------
  const wallGeo = new THREE.PlaneGeometry(Math.abs(corridorLength) + 30, 6);
  const wallMat = new THREE.MeshStandardMaterial({
    color: '#0c0f15',
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-CORRIDOR_HALF_WIDTH - 0.4, 3, corridorLength / 2 + 5);
  leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.x = CORRIDOR_HALF_WIDTH + 0.4;
  group.add(rightWall);

  // --- Panels ------------------------------------------------------------
  const panels = [];
  const panelGeo = new THREE.PlaneGeometry(PANEL_W, PANEL_H);
  const frameGeo = new THREE.BoxGeometry(PANEL_W + 0.25, PANEL_H + 0.25, 0.12);
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#161b24',
    roughness: 0.6,
    metalness: 0.3,
  });

  PROJECTS.forEach((project, i) => {
    const z = FIRST_PANEL_Z - i * PANEL_SPACING;
    const onLeft = i % 2 === 0;
    const x = onLeft ? -CORRIDOR_HALF_WIDTH + 0.05 : CORRIDOR_HALF_WIDTH - 0.05;
    const facing = onLeft ? Math.PI / 2 : -Math.PI / 2;

    const panelGroup = new THREE.Group();
    panelGroup.position.set(x, 2.1, z);
    panelGroup.rotation.y = facing;

    // Frame behind the artwork.
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -0.07;
    frame.castShadow = true;
    panelGroup.add(frame);

    // Artwork plane with the generated texture.
    const texture = makePanelTexture(project, i);
    const panelMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.5,
      metalness: 0.0,
      emissive: new THREE.Color(project.color).multiplyScalar(0.04),
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.castShadow = true;
    panelGroup.add(panel);

    group.add(panelGroup);
    panels.push(panel);
  });

  scene.add(group);

  // Camera travel range: from the entrance to just past the last panel.
  const startZ = 8;
  const endZ = FIRST_PANEL_Z - (PROJECTS.length - 1) * PANEL_SPACING - 4;

  return { group, panels, startZ, endZ };
}
