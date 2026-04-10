import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
const controls = new OrbitControls(camera, renderer.domElement);
const sun = new THREE.DirectionalLight(0xFFFFFF, 3);
const textureLoader = new THREE.TextureLoader();

const maxOrbitPoints = 400;

let satelliteMesh, orbitPoints, orbitPointsIndex;

let eciGroup; // Earth-Centered Inertial (ECI) coordinate system
let pqwGroup; // Perifocal coordinate system (PQW)
let eciAxes; // Arrows to visualize the ECI axes
let pqwAxes; // Arrows to visualize the PQW axes

let earthMesh, starSphere, constellationSphere;
let equatorialPlaneMesh, eclipticMesh, orbitShapeMesh, orbitalPlaneMesh;
let inclinationArcMesh, raanArcMesh, argPerigeeArcMesh;
let ascendingNodeMesh, descendingNodeMesh, nodesLineMesh;

export function setMode(newMode) {
    if (newMode === 'tle') {
        pqwGroup.remove(satelliteMesh);
        eciGroup.add(satelliteMesh);
    } else {
        eciGroup.remove(satelliteMesh);
        pqwGroup.add(satelliteMesh);
    }
}

export function setSatellitePosition(x, y, z) {
    satelliteMesh.position.set(x, y, z);
}

export function addOrbitPoint(x, y, z) {
    const orbitPointsPositionAttribute = orbitPoints.geometry.getAttribute('position');
    const orbitPointsPositions = orbitPointsPositionAttribute.array;
    orbitPointsPositions[orbitPointsIndex * 3] = x;
    orbitPointsPositions[orbitPointsIndex * 3 + 1] = z;
    orbitPointsPositions[orbitPointsIndex * 3 + 2] = -y;
    orbitPointsPositionAttribute.needsUpdate = true;

    orbitPointsIndex = (orbitPointsIndex + 1) % maxOrbitPoints;
}

export function clearOrbitPoints() {
    if (orbitPoints) {
        const orbitPointsPositions = new Float32Array(maxOrbitPoints * 3);
        orbitPoints.geometry.setAttribute('position', new THREE.BufferAttribute(orbitPointsPositions, 3));
    }
    orbitPointsIndex = 0;
}

function createOrbitShapeMesh() {
    const numSegments = 128;
    const shapeGeometry = new THREE.BufferGeometry();
    const shapePositions = new Float32Array((numSegments + 1) * 3);
    shapeGeometry.setAttribute('position', new THREE.BufferAttribute(shapePositions, 3));
    const shapeMaterial = new THREE.LineBasicMaterial({color: 0x00FFFF});
    orbitShapeMesh = new THREE.LineLoop(shapeGeometry, shapeMaterial);
    return orbitShapeMesh;
}

export function updateOrbitShapeMesh(a, e) {
    const positionAttribute = orbitShapeMesh.geometry.getAttribute('position');
    const positions = positionAttribute.array;
    const numSegments = 128;
    for (let i = 0; i <= numSegments; i++) {
        const theta = 2 * Math.PI * (i / numSegments);

        let r = (a * (1 - (e * e))) / (1 + (e * Math.cos(theta)));
        r /= 1000; // Convert from kilometers to units

        positions[i * 3] = r * Math.cos(theta);
        positions[(i * 3) + 1] = 0;
        positions[(i * 3) + 2] = r * Math.sin(theta);
    }
    
    positionAttribute.needsUpdate = true;
}

function rotatePqwGroup(inclination, raan, argPerigee) {
    const rotationInclination = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), inclination);
    const rotationRaan = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), raan);
    const rotationArgPerigee = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), argPerigee);
    pqwGroup.quaternion.copy(rotationRaan.multiply(rotationInclination).multiply(rotationArgPerigee));
}

export function convertPQWToECI(position) {
    return position.applyQuaternion(pqwGroup.quaternion);
}

export function updateInclination(inclination, raan, argPerigee) {
    rotatePqwGroup(inclination, raan, argPerigee);
    inclinationArcMesh.geometry.dispose();
    inclinationArcMesh.geometry = new THREE.RingGeometry(7.0, 7.2, 32, 1, 0, inclination);
    inclinationArcMesh.rotation.set(0, raan + (Math.PI / 2), 0);
}

export function updateRaan(inclination, raan, argPerigee) {
    rotatePqwGroup(inclination, raan, argPerigee);
    raanArcMesh.geometry.dispose();
    raanArcMesh.geometry = new THREE.RingGeometry(7.0, 7.2, 32, 1, 0, raan);
    inclinationArcMesh.rotation.set(0, raan + (Math.PI / 2), 0);
}

export function updateArgPerigee(inclination, raan, argPerigee) {
    rotatePqwGroup(inclination, raan, argPerigee);
    argPerigeeArcMesh.geometry.dispose();
    argPerigeeArcMesh.geometry = new THREE.RingGeometry(7.0, 7.2, 32, 1, 0, argPerigee);
}

export function updateNodes(a, e, inclination, raan, argPerigee) {
    if (isNaN(inclination) || isNaN(raan) || inclination === 0) return;

    const h = new THREE.Vector3(
        Math.sin(inclination) * Math.sin(raan),
        Math.cos(inclination),
        Math.sin(inclination) * Math.cos(raan)
    );

    const K = new THREE.Vector3(0, 1, 0);
    const N = new THREE.Vector3().crossVectors(K, h).normalize();

    const r_ascending = (a * (1 - e ** 2)) / (1 + e * Math.cos(-argPerigee));
    const r_descending = (a * (1 - e ** 2)) / (1 + e * Math.cos(-argPerigee + Math.PI));

    // Dividing by 1,000 since each unit represents 1,000 km
    const r_ascending_scene = r_ascending / 1000;
    const r_descending_scene = r_descending / 1000;

    const ascendingPoint = N.clone().multiplyScalar(r_ascending_scene);
    const descendingPoint = N.clone().multiplyScalar(-r_descending_scene);
    ascendingNodeMesh.position.copy(ascendingPoint);
    descendingNodeMesh.position.copy(descendingPoint);

    const lineDirection = new THREE.Vector3().subVectors(descendingPoint, ascendingPoint);
    const lineLength = lineDirection.length();
    if (lineLength > 0) {
        // Position the line to be centered at the midpoint of the ascending and descending nodes
        nodesLineMesh.position.copy(ascendingPoint.clone().add(descendingPoint).multiplyScalar(0.5));

        // Rotate the line to point in the direction of the line of nodes
        nodesLineMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), lineDirection.normalize());

        // Scale the line to connect the ascending and descending nodes
        nodesLineMesh.scale.set(1, lineLength, 1);
    }
}

export function updateEarthRotation(gmst) {
    earthMesh.rotation.y = gmst;
}

export function updateSunPosition(sunPos) {
    const sunPositionScalar = 100; // Render the sun far enough away to look realistic
    const position = new THREE.Vector3(
        sunPos.rsun[0], // x
        sunPos.rsun[2], // z
        -sunPos.rsun[1] // -y
    );
    position.multiplyScalar(sunPositionScalar);
    sun.position.set(position.x, position.y, position.z);
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
}

export function setVisibility(buttonId, visible) {
    switch (buttonId) {
        case 'earthVisibilityButton':
            earthMesh.visible = visible;
            break;
        case 'orbitShapeVisibilityButton':
            orbitShapeMesh.visible = visible;
            break;
        case 'equatorialPlaneVisibilityButton':
            equatorialPlaneMesh.visible = visible;
            break;
        case 'eclipticVisibilityButton':
            eclipticMesh.visible = visible;
            break;
        case 'orbitalPlaneVisibilityButton':
            orbitalPlaneMesh.visible = visible;
            break;
        case 'eciVisibilityButton':
            eciAxes.visible = visible;
            break;
        case 'pqwVisibilityButton':
            pqwAxes.visible = visible;
            break;
        case 'inclinationVisibilityButton':
            inclinationArcMesh.visible = visible;
            break;
        case 'raanVisibilityButton':
            raanArcMesh.visible = visible;
            break;
        case 'argPerigeeVisibilityButton':
            argPerigeeArcMesh.visible = visible;
            break;
        case 'nodesVisibilityButton':
            ascendingNodeMesh.visible = visible;
            descendingNodeMesh.visible = visible;
            nodesLineMesh.visible = visible;
            break;
        case 'constellationsVisibilityButton':
            constellationSphere.visible = visible;
            break;
    }
}

export function updateControls() {
    controls.update();
}

export function startAnimationLoop(animate) {
    renderer.setAnimationLoop(animate);
}

export function render() {
    renderer.render(scene, camera);
}

export function initializeScene() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    window.addEventListener('resize', onWindowResize);

    camera.position.set(15, 0, -15);
    controls.enableDamping = true;
    controls.minDistance = 7;
    controls.maxDistance = 50;
    controls.update();

    // Ambient light to allow some visibility for where the sun doesn't hit the Earth
    const ambientLight = new THREE.AmbientLight(0x404040, 2.0);
    scene.add(ambientLight);

    // Create a group for the Earth-Centered Inertial (ECI) coordinate system
    eciGroup = new THREE.Group();
    eciGroup.rotation.z = -23.4 * Math.PI / 180; // Earth's axial tilt
    scene.add(eciGroup);

    // Create a group for the Perifocal coordinate system (PQW)
    pqwGroup = new THREE.Group();
    eciGroup.add(pqwGroup);

    // Set an arbitrary initial position for the sun
    sun.position.set(100, 0, 0);
    eciGroup.add(sun);

    // Letting each unit be 1,000 km, we get a radius of 6.378 units since Earth's radius is 6,378 km
    const earthGeometry = new THREE.SphereGeometry(6.378, 64, 32);
    const earthMaterial = new THREE.MeshPhongMaterial({
        map: textureLoader.load(new URL('../assets/textures/earth_color_map.png', import.meta.url).href),
        bumpMap: textureLoader.load(new URL('../assets/textures/earth_topography_map.jpg', import.meta.url).href),
        bumpScale: 0.03,
    });
    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    eciGroup.add(earthMesh);
    
    const exrLoader = new EXRLoader();
    exrLoader.load(new URL('../assets/textures/starmap_2020_4k.exr', import.meta.url).href, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const starMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide,
        });

        const constellationTexture = textureLoader.load(new URL('../assets/textures/constellation_figures_8k.jpg', import.meta.url).href);
        constellationTexture.mapping = THREE.EquirectangularReflectionMapping;
        const constellationMaterial = new THREE.MeshBasicMaterial({
            blending: THREE.AdditiveBlending,
            map: constellationTexture,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.5,
        });

        const celestialSphereGeometry = new THREE.SphereGeometry(500, 64, 64);
        starSphere = new THREE.Mesh(celestialSphereGeometry, starMaterial);
        constellationSphere = new THREE.Mesh(celestialSphereGeometry, constellationMaterial);
        constellationSphere.visible = false;
        const celestialSphereGroup = new THREE.Group();
        celestialSphereGroup.add(starSphere);
        celestialSphereGroup.add(constellationSphere);
        celestialSphereGroup.rotation.z = -23.4 * Math.PI / 180; // Earth's axial tilt
        scene.add(celestialSphereGroup);
    });

    const nodeGeometry = new THREE.SphereGeometry(0.2, 12, 12);
    const ascendingNodeMaterial = new THREE.MeshBasicMaterial({color: 0x00FF00});
    const descendingNodeMaterial = new THREE.MeshBasicMaterial({color: 0xFF0000});
    ascendingNodeMesh = new THREE.Mesh(nodeGeometry, ascendingNodeMaterial);
    descendingNodeMesh = new THREE.Mesh(nodeGeometry, descendingNodeMaterial);
    
    // Outer glow for nodes to be visually distinct
    const nodeOuterGeometry = new THREE.SphereGeometry(0.32, 16, 16);
    ascendingNodeMesh.add(new THREE.Mesh(
        nodeOuterGeometry,
        new THREE.MeshBasicMaterial({color: 0x00FF00, transparent: true, opacity: 0.28})
    ));
    descendingNodeMesh.add(new THREE.Mesh(
        nodeOuterGeometry,
        new THREE.MeshBasicMaterial({color: 0xFF0000, transparent: true, opacity: 0.28})
    ));
    ascendingNodeMesh.visible = false;
    descendingNodeMesh.visible = false;

    eciGroup.add(ascendingNodeMesh);
    eciGroup.add(descendingNodeMesh);
    nodesLineMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 1, 16),
        new THREE.MeshBasicMaterial({color: 0xFFFFFF, transparent: true, opacity: 0.9})
    );
    nodesLineMesh.visible = false;
    eciGroup.add(nodesLineMesh);

    const satelliteGeoemtry = new THREE.SphereGeometry(0.15, 8, 8);
    const satelliteMaterial = new THREE.MeshBasicMaterial({color: 0xFFFFFF});
    satelliteMesh = new THREE.Mesh(satelliteGeoemtry, satelliteMaterial);
    eciGroup.add(satelliteMesh);

    const orbitPointsGeometry = new THREE.BufferGeometry();
    const orbitPointsMaterial = new THREE.PointsMaterial({
        size: 0.08,
        color: new THREE.Color(0x0000FF)
    });
    const orbitPointsPositions = new Float32Array(maxOrbitPoints * 3);
    orbitPointsGeometry.setAttribute('position', new THREE.BufferAttribute(orbitPointsPositions, 3));
    orbitPoints = new THREE.Points(orbitPointsGeometry, orbitPointsMaterial);
    eciGroup.add(orbitPoints);

    equatorialPlaneMesh = new THREE.GridHelper(30, 30, 0x888888);
    equatorialPlaneMesh.material.transparent = true;
    equatorialPlaneMesh.material.opacity = 0.8;
    equatorialPlaneMesh.visible = false;
    eciGroup.add(equatorialPlaneMesh);
    
    eclipticMesh = new THREE.GridHelper(30, 30, 0x0000FF, 0x0000FF);
    eclipticMesh.material.transparent = true;
    eclipticMesh.material.opacity = 0.4;
    eclipticMesh.visible = false;
    scene.add(eclipticMesh);

    orbitShapeMesh = createOrbitShapeMesh();
    orbitShapeMesh.visible = false;
    pqwGroup.add(orbitShapeMesh);
    updateOrbitShapeMesh(6500, 0);
    orbitalPlaneMesh = new THREE.GridHelper(30, 30, 0x00FFFF, 0x00FFFF);
    orbitalPlaneMesh.material.transparent = true;
    orbitalPlaneMesh.material.opacity = 0.4;
    orbitalPlaneMesh.visible = false;
    pqwGroup.add(orbitalPlaneMesh);

    rotatePqwGroup(0, 0, 0);

    const inclinationArcGeometry = new THREE.RingGeometry(7.0, 7.2, 32, 1, 0, 0);
    const inclinationArcMaterial = new THREE.MeshBasicMaterial({
        color: 0x00FFFF,
        opacity: 0.75,
        side: THREE.DoubleSide,
        transparent: true,
    });
    inclinationArcMesh = new THREE.Mesh(inclinationArcGeometry, inclinationArcMaterial);
    inclinationArcMesh.visible = false;
    eciGroup.add(inclinationArcMesh);
    
    const raanArcGeometry = new THREE.RingGeometry(7.0, 7.2, 32, 1, 0, 0);
    const raanArcMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFF00,
        opacity: 0.75,
        side: THREE.DoubleSide,
        transparent: true,
    });
    raanArcMesh = new THREE.Mesh(raanArcGeometry, raanArcMaterial);
    raanArcMesh.rotation.x = -Math.PI / 2;
    raanArcMesh.visible = false;
    eciGroup.add(raanArcMesh);

    const argPerigeeArcGeometry = new THREE.RingGeometry(7.0, 7.2, 32, 1, 0, 0);
    const argPerigeeArcMaterial = new THREE.MeshBasicMaterial({
        color: 0xFF00FF,
        opacity: 0.75,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide,
        transparent: true,
    });
    argPerigeeArcMesh = new THREE.Mesh(argPerigeeArcGeometry, argPerigeeArcMaterial);
    argPerigeeArcMesh.rotation.x = Math.PI / 2;
    argPerigeeArcMesh.visible = false;
    pqwGroup.add(argPerigeeArcMesh);

    eciAxes = new THREE.Group();
    const eciX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 10, 0xff0000, 0.5, 0.5);
    eciAxes.add(eciX);
    const eciY = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), 10, 0x00ff00, 0.5, 0.5);
    eciAxes.add(eciY);
    const eciZ = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 10, 0x0000ff, 0.5, 0.5);
    eciAxes.add(eciZ);
    eciAxes.visible = false;
    eciGroup.add(eciAxes);

    pqwAxes = new THREE.Group();
    const perifocalP = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 11, 0xffaaaa, 0.5, 0.5);
    pqwAxes.add(perifocalP);
    const perifocalQ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), 11, 0xaaffaa, 0.5, 0.5);
    pqwAxes.add(perifocalQ);
    const perifocalW = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 11, 0xaaaaff, 0.5, 0.5);
    pqwAxes.add(perifocalW);
    pqwAxes.visible = false;
    pqwGroup.add(pqwAxes);
}