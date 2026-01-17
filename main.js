import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as satellite from 'satellite.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
const controls = new OrbitControls(camera, renderer.domElement);
const sun = new THREE.DirectionalLight(0xFFFFFF, 3);
const textureLoader = new THREE.TextureLoader();

const starCount = 10000;
const maxOrbitPoints = 400;

const tleOrbitTab = document.getElementById('tleOrbitTab');
const tleOrbitTabContent = document.getElementById('tleOrbitTabContent');
const customOrbitTab = document.getElementById('customOrbitTab');
const customOrbitTabContent = document.getElementById('customOrbitTabContent');

const noradIdInput = document.getElementById('noradIdInput');
const fetchTleButton = document.getElementById('fetchTleButton');

const semiMajorAxisInput = document.getElementById('semiMajorAxisInput');
const eccentricityInput = document.getElementById('eccentricityInput');
const inclinationInput = document.getElementById('inclinationInput');
const raanInput = document.getElementById('raanInput');
const argPerigeeInput = document.getElementById('argPerigeeInput');
const trueAnomalyInput = document.getElementById('trueAnomalyInput');
const setOrbitButton = document.getElementById('setOrbitButton');

const timeStepInput = document.getElementById('timeStepInput');
const timeStepUnitSelect = document.getElementById('timeStepUnit');
const setTimeStepButton = document.getElementById('setTimeStepButton');
const timeBetweenInput = document.getElementById('timeBetweenInput');
const timeBetweenUnitSelect = document.getElementById('timeBetweenUnit');
const setTimeBetweenButton = document.getElementById('setTimeBetweenButton');
const simulationDateValue = document.getElementById('simulationDateValue');
const pauseResumeButton = document.getElementById('pauseResumeButton');

const latitudeValue = document.getElementById('latitudeValue');
const longitudeValue = document.getElementById('longitudeValue');
const altitudeValue = document.getElementById('altitudeValue');
const epochValue = document.getElementById('epochValue');
const inclinationValue = document.getElementById('inclinationValue');
const raanValue = document.getElementById('raanValue');
const eccentricityValue = document.getElementById('eccentricityValue');
const argPerigeeValue = document.getElementById('argPerigeeValue');
const meanAnomalyValue = document.getElementById('meanAnomalyValue');
const meanMotionValue = document.getElementById('meanMotionValue');

let eciGroup; // Earth-Centered Inertial (ECI) coordinate system
let pqwGroup; // Perifocal coordinate system (PQW)
let eciAxes; // Arrows to visualize the ECI axes
let pqwAxes; // Arrows to visualize the PQW axes
let earthMesh;
let equatorialPlaneMesh;
let eclipticMesh;
let orbitShapeMesh;
let stars;
let satelliteMesh;
let count = 0;

// True if user has defined custom orbit, false if propagating with TLE data
let customOrbit = false;

let customSemiMajorAxis;
let customEccentricity;
let customInclination;
let customRaan;
let customArgPerigee;
let customTrueAnomaly;

const milliseconds = 0;
const seconds = 1;
const minutes = 2;
const hours = 3;
let timeStep = 30; // 30 seconds by default
let timeStepUnit = seconds;
let timeBetween = 250; // 250 milliseconds by default
let timeBetweenUnit = milliseconds;
let updateIntervalMs = 250; // The time between updates in milliseconds

let satrec;
let positionAndVelocity;
let date;
let orbitPoints;
let orbitPointsIndex;
let paused = true;
let lastUpdate = 0;

tleOrbitTab.addEventListener('click', () => {
    // Switch to this tab if it is not already selected
    if (!tleOrbitTab.classList.contains('selected') && tleOrbitTabContent.classList.contains('hidden')) {
        tleOrbitTab.classList.add('selected');
        customOrbitTab.classList.remove('selected');
        tleOrbitTabContent.classList.remove('hidden');
        customOrbitTabContent.classList.add('hidden');
    }
});

customOrbitTab.addEventListener('click', () => {
    // Switch to this tab if it is not already selected
    if (!customOrbitTab.classList.contains('selected') && customOrbitTabContent.classList.contains('hidden')) {
        customOrbitTab.classList.add('selected');
        tleOrbitTab.classList.remove('selected');
        customOrbitTabContent.classList.remove('hidden');
        tleOrbitTabContent.classList.add('hidden');
    }
});

async function fetchTle(noradId) {
    const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error when sending request to fetch TLE: ${response.status}`);
    }

    return response.text();
}

fetchTleButton.addEventListener('click', async () => {
    const noradId = noradIdInput.value.trim();
    if (!noradId || isNaN(noradId) || noradId.length > 9) {
        alert(`Unable to fetch TLE for ${noradId} since it is not a 1-9 digit number`);
        return;
    }
    console.log('Fetching TLE for NORAD ID:', noradId);
    try {
        // const tle = await fetchTle(noradId);
        // console.log(tle);

        // Hard-coded TLE data to reduce requests during development
        const tle = 'ISS (ZARYA)             \n1 25544U 98067A   25361.56640462  .00014449  00000+0  26180-3 0  9991\n2 25544  51.6320  69.0472 0003237 310.8255  49.2453 15.49876615545155\n';

        const tleLines = tle.split('\n');
        if (tleLines.length != 4) {
            alert('Invalid TLE data (not 4 lines long)');
            console.error(`Error: TLE data is not 4 lines: \n${tle}`);
            return;
        }
        const tleLine1 = tleLines[1];
        const tleLine2 = tleLines[2];
        satrec = satellite.twoline2satrec(tleLine1, tleLine2);
        
        // Update orbital elements
        inclinationValue.textContent = satellite.radiansToDegrees(satrec.inclo).toFixed(3) + '°';
        raanValue.textContent = satellite.radiansToDegrees(satrec.nodeo).toFixed(3) + '°';
        eccentricityValue.textContent = satrec.ecco.toFixed(5);
        argPerigeeValue.textContent = satellite.radiansToDegrees(satrec.argpo).toFixed(3) + '°';
        meanAnomalyValue.textContent = satellite.radiansToDegrees(satrec.mo).toFixed(3) + '°';
        meanMotionValue.textContent = satrec.no.toFixed(3) + ' rad/min';
        const epoch = new Date(Date.UTC(satrec.epochyr < 57 ? 2000 + satrec.epochyr : 1900 + satrec.epochyr, 0, 0));
        epoch.setTime(epoch.getTime() + (satrec.epochdays * 1000 * 60 * 60 * 24));
        epochValue.textContent = epoch.toUTCString();

        // date = new Date();
        date = epoch;
        positionAndVelocity = satellite.propagate(satrec, date);
        // Dividing by 1,000 since each unit represents 1,000 km
        satelliteMesh.position.set(
            positionAndVelocity.position.x / 1000,
            positionAndVelocity.position.z / 1000,
            -positionAndVelocity.position.y / 1000
        ); // x, z, -y to match Three JS' coordinate system
        
        if (orbitPoints) {
            const orbitPointsPositions = new Float32Array(maxOrbitPoints * 3);
            orbitPoints.geometry.setAttribute('position', new THREE.BufferAttribute(orbitPointsPositions, 3));
        }
        orbitPointsIndex = 0;

        // Update Simulation Controls panel
        simulationDateValue.textContent = date.toUTCString();
        paused = false;
    } catch (error) {
        alert(error.message);
        console.error(`Caught error while fetching TLE: ${error}`);
    }
});

setOrbitButton.addEventListener('click', () => {
    customSemiMajorAxis = semiMajorAxisInput.valueAsNumber;
    customEccentricity = eccentricityInput.valueAsNumber;
    customInclination = inclinationInput.valueAsNumber;
    customRaan = raanInput.valueAsNumber;
    customArgPerigee = argPerigeeInput.valueAsNumber;
    customTrueAnomaly = trueAnomalyInput.valueAsNumber;

    customOrbit = true;
});

setTimeStepButton.addEventListener('click', () => {
    const value = timeStepInput.valueAsNumber;
    if (isNaN(value)) {
        alert("Error: The time step must be a valid number and can't be blank.")
        return;
    }
    timeStep = value;
    switch (timeStepUnitSelect.value) {
        case 'milliseconds':
            timeStepUnit = milliseconds;
            break;
        case 'seconds':
            timeStepUnit = seconds;
            break;
        case 'minutes':
            timeStepUnit = minutes;
            break;
        case 'hours':
            timeStepUnit = hours;
            break;
        default:
            console.log('Invalid time step unit. Setting to seconds...');
            timeStepUnit = seconds;
            break;
    }
});

setTimeBetweenButton.addEventListener('click', () => {
    const value = timeBetweenInput.valueAsNumber;
    if (isNaN(value)) {
        alert("Error: The time between updates must be a valid number and can't be blank.")
        return;
    }
    timeBetween = value;
    switch (timeBetweenUnitSelect.value) {
        case 'milliseconds':
            timeBetweenUnit = milliseconds;
            updateIntervalMs = timeBetween;
            break;
        case 'seconds':
            timeBetweenUnit = seconds;
            updateIntervalMs = timeBetween * 1000;
            break;
        default:
            console.log('Invalid time between updates unit. Setting to milliseconds...');
            timeBetweenUnit = milliseconds;
            break;
    }
});

pauseResumeButton.addEventListener('click', () => {
    paused = !paused;
    pauseResumeButton.textContent = paused ? 'Propagate' : 'Pause';
});

function createOrbitShapeMesh() {
    const numSegments = 128;
    const shapeGeometry = new THREE.BufferGeometry();
    const shapePositions = new Float32Array((numSegments + 1) * 3);
    shapeGeometry.setAttribute('position', new THREE.BufferAttribute(shapePositions, 3));
    const shapeMaterial = new THREE.LineBasicMaterial({color: 0x00FFFF});
    orbitShapeMesh = new THREE.LineLoop(shapeGeometry, shapeMaterial);
    return orbitShapeMesh;
}

function updateOrbitShapeMesh() {
    let a = parseFloat(semiMajorAxisInput.value);
    if (isNaN(a) || a < 0) a = 7000;

    let e = parseFloat(eccentricityInput.value);
    if (isNaN(e) || e < 0 || e >= 1) e = 0;

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

function rotateOrbitShapeMesh() {
    let i = parseFloat(inclinationInput.value);
    if (isNaN(i) || i < 0 || i > 180) i = 0;

    let raan = parseFloat(raanInput.value);
    if (isNaN(raan) || raan < 0 || raan > 359.99) raan = 0;

    let argPerigee = parseFloat(argPerigeeInput.value);
    if (isNaN(argPerigee) || argPerigee < 0 || argPerigee > 359.99) argPerigee = 0;

    i = i * Math.PI / 180;
    raan = raan * Math.PI / 180;
    argPerigee = argPerigee * Math.PI / 180;

    const rotationI = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), i);
    const rotationRaan = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), raan);
    const rotationArgPerigee = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), argPerigee);

    const rotation = rotationRaan.multiply(rotationI).multiply(rotationArgPerigee);

    pqwGroup.quaternion.copy(rotation);
}

function createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 4);
    const starColorTargets = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
        const r = THREE.MathUtils.randFloat(200, 500);
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
        size: 2.5,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        map: starTexture
    });

    return new THREE.Points(starGeometry, starMaterial);
}

function updateOrbitData(positionAndVelocity, gmst) {
    const geodetic = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
    const latitude = satellite.degreesLat(geodetic.latitude);
    const longitude = satellite.degreesLong(geodetic.longitude);
    const altitude = geodetic.height;

    latitudeValue.textContent = latitude.toFixed(5) + '°';
    longitudeValue.textContent = longitude.toFixed(5) + '°';
    altitudeValue.textContent = altitude.toFixed(2) + ' km';
}

function animate(time) {
    // Update controls because enableDamping is true
    controls.update();

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

    // Propagate orbit if not paused
    if (!paused) {
        if (customOrbit) {
            // Propagate with the custom orbital elements defined by the user


        } else if (satrec && time - lastUpdate >= updateIntervalMs) {
            // Propagate with TLE data if it exists and the update interval has passed

            lastUpdate = time;
            switch (timeStepUnit) {
                case milliseconds:
                    date.setMilliseconds(date.getMilliseconds() + timeStep);
                    break;
                case seconds:
                    date.setSeconds(date.getSeconds() + timeStep);
                    break;
                case minutes:
                    date.setMinutes(date.getMinutes() + timeStep);
                    break;
                case hours:
                    date.setHours(date.getHours() + timeStep);
                    break;
                default:
                    console.log('Invalid time step unit. Setting to seconds...');
                    timeStepUnit = seconds;
                    date.setSeconds(date.getSeconds() + timeStep);
                    break;
            }
            simulationDateValue.textContent = date.toUTCString();

            const gmst = satellite.gstime(date);
            earthMesh.rotation.y = gmst;

            const jday = satellite.jday(date);
            const sunPos = satellite.sunPos(jday);
            const sunPositionScalar = 100; // Render the sun far enough away to look realistic
            const sunPosition = new THREE.Vector3(
                sunPos.rsun[0], // x
                sunPos.rsun[2], // z
                -sunPos.rsun[1] // -y
            );
            sunPosition.multiplyScalar(sunPositionScalar);
            sun.position.set(sunPosition.x, sunPosition.y, sunPosition.z);

            positionAndVelocity = satellite.propagate(satrec, date);

            updateOrbitData(positionAndVelocity, gmst);

            // Dividing by 1,000 since each unit represents 1,000 km
            const x = positionAndVelocity.position.x / 1000;
            const y = positionAndVelocity.position.y / 1000;
            const z = positionAndVelocity.position.z / 1000;
            satelliteMesh.position.set(x, z, -y); // x, z, -y to match Three JS' coordinate system

            const orbitPointsPositionAttribute = orbitPoints.geometry.getAttribute('position');
            const orbitPointsPositions = orbitPointsPositionAttribute.array;
            orbitPointsPositions[orbitPointsIndex * 3] = x;
            orbitPointsPositions[orbitPointsIndex * 3 + 1] = z;
            orbitPointsPositions[orbitPointsIndex * 3 + 2] = -y;
            orbitPointsPositionAttribute.needsUpdate = true;

            orbitPointsIndex = (orbitPointsIndex + 1) % maxOrbitPoints;
        }
    }

    // Update count for animation tests
    count++;

    renderer.render(scene, camera);
}

function initialize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    camera.position.z = 15;
    controls.enableDamping = true;
    controls.minDistance = 7;
    controls.maxDistance = 50;
    controls.update;

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
        map: textureLoader.load('./assets/textures/earth_color_map.png'),
        bumpMap: textureLoader.load('./assets/textures/earth_topography_map.jpg'),
        bumpScale: 0.03,
    });
    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    eciGroup.add(earthMesh);

    stars = createStars();
    scene.add(stars);

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
    equatorialPlaneMesh.visible = false;
    eciGroup.add(equatorialPlaneMesh);
    
    eclipticMesh = new THREE.GridHelper(30, 30, 0x0000FF, 0x0000FF);
    eclipticMesh.visible = false;
    scene.add(eclipticMesh);

    orbitShapeMesh = createOrbitShapeMesh();
    orbitShapeMesh.visible = false;
    pqwGroup.add(orbitShapeMesh);
    updateOrbitShapeMesh();
    semiMajorAxisInput.addEventListener('input', updateOrbitShapeMesh);
    eccentricityInput.addEventListener('input', updateOrbitShapeMesh);
    inclinationInput.addEventListener('input', rotateOrbitShapeMesh);
    raanInput.addEventListener('input', rotateOrbitShapeMesh);
    argPerigeeInput.addEventListener('input', rotateOrbitShapeMesh);
    rotateOrbitShapeMesh();

    eciAxes = new THREE.Group();
    const eciX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 10, 0xff0000, 0.5, 0.5);
    eciAxes.add(eciX);
    const eciY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 10, 0x00ff00, 0.5, 0.5);
    eciAxes.add(eciY);
    const eciZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 10, 0x0000ff, 0.5, 0.5);
    eciAxes.add(eciZ);
    eciAxes.visible = false;
    eciGroup.add(eciAxes);

    pqwAxes = new THREE.Group();
    const perifocalP = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 11, 0xffaaaa, 0.5, 0.5);
    pqwAxes.add(perifocalP);
    const perifocalQ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 11, 0xaaaaff, 0.5, 0.5);
    pqwAxes.add(perifocalQ);
    const perifocalW = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 11, 0xaaffaa, 0.5, 0.5);
    pqwAxes.add(perifocalW);
    pqwAxes.visible = false;
    pqwGroup.add(pqwAxes);

    const collapsiblePanels = document.querySelectorAll('.panelHeader.collapsible');
    collapsiblePanels.forEach(panelHeader => {
        panelHeader.addEventListener('click', () => {
            panelHeader.classList.toggle('closed');

            const panelContent = panelHeader.nextElementSibling;
            if (panelContent && panelContent.classList.contains('panelContent')) {
                panelContent.classList.toggle('closed');
            }
        });
    });

    const visibilityButtons = document.querySelectorAll('.visibilityButton');
    visibilityButtons.forEach(button => {
        button.addEventListener('click', () => {
            const visible = button.classList.toggle('visible');
            button.textContent = visible ? '⊙' : '✕';

            switch (button.id) {
                case 'earthVisibilityButton':
                    earthMesh.visible = visible;
                    break;
                case 'equatorialPlaneVisibilityButton':
                    equatorialPlaneMesh.visible = visible;
                    break;
                case 'eclipticVisibilityButton':
                    eclipticMesh.visible = visible;
                    break;
                case 'orbitShapeVisibilityButton':
                    orbitShapeMesh.visible = visible;
                    break;
                case 'eciVisibilityButton':
                    eciAxes.visible = visible;
                    break;
                case 'pqwVisibilityButton':
                    pqwAxes.visible = visible;
                    break;
            }
        });
    });

    renderer.setAnimationLoop(animate);
}


initialize();