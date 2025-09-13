import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

camera.position.z = 5;
controls.update;

const light = new THREE.DirectionalLight(0xFFFFFF, 3);
light.position.set(1, 2, 7);
scene.add(light);

const sphereGeometry = new THREE.SphereGeometry(1, 64, 32);
const textureLoader = new THREE.TextureLoader();
const sphereMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load('./assets/textures/earth_color_map.png'),
    bumpMap: textureLoader.load('./assets/textures/earth_topography_map.png'),
    bumpScale: 0.03,
});
const earthMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(earthMesh);

const starCount = 10000;
const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 4);
const starColorTargets = new Float32Array(starCount);
for (let i = 0; i < starCount; i++) {
    const r = THREE.MathUtils.randFloat(100, 250);
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.PI * Math.random();
    starPositions[(i * 3)] = r * Math.sin(theta) * Math.cos(phi);     // x
    starPositions[(i * 3) + 1] = r * Math.cos(theta);                 // y
    starPositions[(i * 3) + 2] = r * Math.sin(theta) * Math.sin(phi); // z

    starColors[(i * 4)] = 1.0;
    starColors[(i * 4) + 1] = 1.0;
    starColors[(i * 4) + 2] = 1.0;
    starColors[(i * 4) + 3] = Math.random();

    starColorTargets[i] = Math.random();
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 4));

const canvas = document.createElement('canvas');
canvas.width = 64;
canvas.height = 64;
const context = canvas.getContext('2d');
const gradient = context.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 0,
    canvas.width / 2, canvas.height / 2, canvas.width / 2
);
gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
gradient.addColorStop(0.2, 'rgba(255, 255, 255, 1)');
gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
context.fillStyle = gradient;
context.fillRect(0, 0, canvas.width, canvas.height);
const starTexture = new THREE.CanvasTexture(canvas);

const starMaterial = new THREE.PointsMaterial({
    size: 1.25,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    map: starTexture
});

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

const orbitEllipse = new THREE.EllipseCurve(0, 0, 1.5, 1.5, 0, 2 * Math.PI, false, 0);
const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitEllipse.getPoints(100));
orbitGeometry.rotateX(Math.PI / 6);
orbitGeometry.rotateY(Math.PI / 6);
const orbitMaterial = new THREE.LineBasicMaterial({color: 0x00FF00});
const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
const orbitPoints = orbit.geometry.getAttribute('position').array;
scene.add(orbit);

const satelliteGeoemtry = new THREE.SphereGeometry(0.05, 8, 8);
const satelliteMaterial = new THREE.MeshBasicMaterial({color: 0xFFFFFF});
const satelliteMesh = new THREE.Mesh(satelliteGeoemtry, satelliteMaterial);
satelliteMesh.position.set(orbitPoints[0], orbitPoints[1], orbitPoints[2]);
scene.add(satelliteMesh);

const pointGeometry = new THREE.SphereGeometry(0.01, 3, 2);
const pointMaterial = new THREE.MeshBasicMaterial({color: 0x0000FF});
for (let i = 0; i < orbitPoints.length; i += 3) {
    const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
    pointMesh.position.set(orbitPoints[i], orbitPoints[i + 1], orbitPoints[i + 2]);
    scene.add(pointMesh);
}

var orbitPointsIndex = 3;
var count = 1; // Initialized to 1 instead of 0 to prevent immediately updating the position (it was already set)
function animate() {
    // Update controls because enableDamping is true
    controls.update();

    // Simulate movement of light for testing initial animate loop
    light.position.set(1 + (count * 0.05), 2 + (count * 0.01), 7 + (count * 0.01));

    // Initial testing for animating orbits
    if (count % 10 == 0) {
        if (orbitPointsIndex > orbitPoints.length - 2) {
            orbitPointsIndex = 0;
        }
        satelliteMesh.position.set(orbitPoints[orbitPointsIndex], orbitPoints[orbitPointsIndex + 1], orbitPoints[orbitPointsIndex + 2])
        orbitPointsIndex += 3;
    }

    // Initial testing for animating stars
    if (count % 20 == 0) {
        const starColorsAttribute = stars.geometry.getAttribute('color');
        const starColorsArray = starColorsAttribute.array;
        const numStarsToAnimate = Math.floor(starCount * 0.4);
        for (let i = 0; i < numStarsToAnimate; i++) {
            const starIndex = Math.floor(starCount * Math.random()) * 4;
            var alpha = starColorsArray[starIndex + 3];
            var deltaAlpha = (Math.random() * 0.2);
            if (Math.random() >= 0.5) {
                alpha += deltaAlpha;
            } else {
                alpha -= deltaAlpha;
            }
            if (alpha < 0.0) {
                alpha = 0.0;
            } else if (alpha > 1.0) {
                alpha = 1.0;
            }
            starColorsArray[starIndex + 3] = alpha;
        }
        starColorsAttribute.needsUpdate = true;
    }

    // Update count for animation tests
    count++;

    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);