import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import * as satellite from 'satellite.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
const controls = new OrbitControls(camera, renderer.domElement);
const sun = new THREE.DirectionalLight(0xFFFFFF, 3);
const textureLoader = new THREE.TextureLoader();

// Standard gravitational parameter of Earth
const mu = 3.986004418e14;
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
const epochInput = document.getElementById('epochInput');
const setOrbitButton = document.getElementById('setOrbitButton');

const timeStepInput = document.getElementById('timeStepInput');
const timeStepUnitSelect = document.getElementById('timeStepUnit');
const setTimeStepButton = document.getElementById('setTimeStepButton');
const timeBetweenInput = document.getElementById('timeBetweenInput');
const timeBetweenUnitSelect = document.getElementById('timeBetweenUnit');
const setTimeBetweenButton = document.getElementById('setTimeBetweenButton');
const simulationDateValue = document.getElementById('simulationDateValue');
const pauseResumeButton = document.getElementById('pauseResumeButton');
const timeDirectionSelect = document.getElementById('timeDirection');

const latitudeValue = document.getElementById('latitudeValue');
const longitudeValue = document.getElementById('longitudeValue');
const altitudeValue = document.getElementById('altitudeValue');
const epochValue = document.getElementById('epochValue');
const semiMajorAxisValue = document.getElementById('semiMajorAxisValue');
const eccentricityValue = document.getElementById('eccentricityValue');
const inclinationValue = document.getElementById('inclinationValue');
const raanValue = document.getElementById('raanValue');
const argPerigeeValue = document.getElementById('argPerigeeValue');
const meanMotionValue = document.getElementById('meanMotionValue');
const meanAnomalyValue = document.getElementById('meanAnomalyValue');
const trueAnomalyValue = document.getElementById('trueAnomalyValue');

let eciGroup; // Earth-Centered Inertial (ECI) coordinate system
let pqwGroup; // Perifocal coordinate system (PQW)
let eciAxes; // Arrows to visualize the ECI axes
let pqwAxes; // Arrows to visualize the PQW axes
let earthMesh;
let starSphere;
let constellationSphere;
let equatorialPlaneMesh;
let eclipticMesh;
let orbitShapeMesh;
let orbitalPlaneMesh;
let inclinationArcMesh;
let raanArcMesh;
let argPerigeeArcMesh;
let satelliteMesh;

// True if user has defined custom orbit, false if propagating with TLE data
let customOrbit = false;

let customSemiMajorAxis;
let customEccentricity;
let customInclination = 0;
let customRaan = 0;
let customArgPerigee = 0;
let customTrueAnomaly;
let customEpoch;
let customMeanMotion;
let customMeanAnomalyAtEpoch;

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
let epoch;
let date;
let orbitPoints;
let orbitPointsIndex;
let paused = true;
let propagateForward = true;
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
        const tle = 'ISS (ZARYA)             \n1 25544U 98067A   26040.56801308  .00009074  00000+0  17540-3 0  9992\n2 25544  51.6311 211.3720 0011129  80.8535 279.3711 15.48504497551972\n';

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
        epoch = new Date(Date.UTC(satrec.epochyr < 57 ? 2000 + satrec.epochyr : 1900 + satrec.epochyr, 0, 0));
        epoch.setTime(epoch.getTime() + (satrec.epochdays * 1000 * 60 * 60 * 24));
        epochValue.textContent = epoch.toUTCString();
        semiMajorAxisValue.textContent = (Math.cbrt(mu / ((satrec.no / 60) ** 2)) / 1000).toFixed(3) + ' km';
        eccentricityValue.textContent = satrec.ecco.toFixed(5);
        inclinationValue.textContent = satellite.radiansToDegrees(satrec.inclo).toFixed(3) + '°';
        raanValue.textContent = satellite.radiansToDegrees(satrec.nodeo).toFixed(3) + '°';
        argPerigeeValue.textContent = satellite.radiansToDegrees(satrec.argpo).toFixed(3) + '°';
        meanMotionValue.textContent = satrec.no.toFixed(3) + ' rad/min';
        meanAnomalyValue.textContent = satellite.radiansToDegrees(satrec.mo).toFixed(3) + '°';

        // date = new Date(); // Current date for debugging
        date = new Date(epoch);
        positionAndVelocity = satellite.propagate(satrec, date);

        trueAnomalyValue.textContent = (calculateTleTrueAnomaly(positionAndVelocity) * 180 / Math.PI).toFixed(3) + '°';

        eciGroup.add(satelliteMesh);
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
        customOrbit = false;
        paused = false;
        pauseResumeButton.textContent = 'Pause';
    } catch (error) {
        alert(error.message);
        console.error(`Caught error while fetching TLE: ${error}`);
    }
});

function calculateTleTrueAnomaly(positionAndVelocity) {
    const r = new THREE.Vector3(positionAndVelocity.position.x, positionAndVelocity.position.y, positionAndVelocity.position.z);
    const v = new THREE.Vector3(positionAndVelocity.velocity.x, positionAndVelocity.velocity.y, positionAndVelocity.velocity.z);
    const e = r.clone().multiplyScalar(((v.length() ** 2) / (mu / 1e9)) - (1 / r.length())).addScaledVector(v, -r.dot(v) / (mu / 1e9));
    let trueAnomaly = Math.acos(e.dot(r) / (e.length() * r.length()));
    if (r.dot(v) < 0) trueAnomaly = (2 * Math.PI) - trueAnomaly;
    return trueAnomaly;
}

setOrbitButton.addEventListener('click', () => {
    customSemiMajorAxis = semiMajorAxisInput.valueAsNumber || 7000;
    semiMajorAxisValue.textContent = customSemiMajorAxis + ' km';

    customEccentricity = eccentricityInput.valueAsNumber || 0;
    eccentricityValue.textContent = customEccentricity.toFixed(5);

    customInclination = inclinationInput.valueAsNumber || 0;
    inclinationValue.textContent = customInclination.toFixed(3) + '°';
    customInclination = customInclination * Math.PI / 180;

    customRaan = raanInput.valueAsNumber || 0;
    raanValue.textContent = customRaan.toFixed(3) + '°';
    customRaan = customRaan * Math.PI / 180;

    customArgPerigee = argPerigeeInput.valueAsNumber || 0;
    argPerigeeValue.textContent = customArgPerigee.toFixed(3) + '°';
    customArgPerigee = customArgPerigee * Math.PI / 180;

    customTrueAnomaly = trueAnomalyInput.valueAsNumber || 0;
    trueAnomalyValue.textContent = customTrueAnomaly.toFixed(3) + '°';
    customTrueAnomaly = customTrueAnomaly * Math.PI / 180;

    customEpoch = epochInput.value ? new Date(epochInput.value + 'Z') : new Date();
    epochValue.textContent = customEpoch.toUTCString();
    date = new Date(customEpoch);

    // Calculate mean motion now for subsequent calculations of mean anomaly
    customMeanMotion = Math.sqrt(mu / ((customSemiMajorAxis * 1000) ** 3));
    meanMotionValue.textContent = customMeanMotion.toFixed(3) + ' rad/sec';

    // Calculate mean anomaly at epoch using eccentricity and true anomaly
    const E = Math.atan2(
        Math.sqrt(1 - (customEccentricity ** 2)) * Math.sin(customTrueAnomaly),
        customEccentricity + Math.cos(customTrueAnomaly)
    );
    customMeanAnomalyAtEpoch = E - (customEccentricity * Math.sin(E));
    if (customMeanAnomalyAtEpoch < 0) customMeanAnomalyAtEpoch += (2 * Math.PI);
    meanAnomalyValue.textContent = (customMeanAnomalyAtEpoch * 180 / Math.PI).toFixed(3) + '°';

    pqwGroup.add(satelliteMesh);

    // Update Simulation Controls panel
    simulationDateValue.textContent = date.toUTCString();
    customOrbit = true;
    paused = false;
    pauseResumeButton.textContent = 'Pause';
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

timeDirectionSelect.addEventListener('change', () => {
    propagateForward = timeDirectionSelect.value === 'Forward';
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

function rotatePqwGroup() {
    const rotationI = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), customInclination);
    const rotationRaan = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), customRaan);
    const rotationArgPerigee = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), customArgPerigee);

    const rotation = rotationRaan.multiply(rotationI).multiply(rotationArgPerigee);

    pqwGroup.quaternion.copy(rotation);
}

function updateInclination() {
    let i = parseFloat(inclinationInput.value);
    if (isNaN(i) || i < 0 || i > 180) i = 0;
    customInclination = i * Math.PI / 180;
    rotatePqwGroup();

    inclinationArcMesh.geometry.dispose();
    inclinationArcMesh.geometry = new THREE.RingGeometry(7.0, 7.2, 32, 1, 0, customInclination);
    inclinationArcMesh.rotation.set(0, customRaan + (Math.PI / 2), 0);
}

function updateRaan() {
    let raan = parseFloat(raanInput.value);
    if (isNaN(raan) || raan < 0 || raan > 359.99) raan = 0;
    customRaan = raan * Math.PI / 180;
    rotatePqwGroup();

    raanArcMesh.geometry.dispose();
    raanArcMesh.geometry = new THREE.RingGeometry(7.0, 7.2, 32, 1, 0, customRaan);

    inclinationArcMesh.rotation.set(0, customRaan + (Math.PI / 2), 0);
}

function updateArgPerigee() {
    let argPerigee = parseFloat(argPerigeeInput.value);
    if (isNaN(argPerigee) || argPerigee < 0 || argPerigee > 359.99) argPerigee = 0;
    customArgPerigee = argPerigee * Math.PI / 180;
    rotatePqwGroup();

    argPerigeeArcMesh.geometry.dispose();
    argPerigeeArcMesh.geometry = new THREE.RingGeometry(7.0, 7.2, 32, 1, 0, customArgPerigee);
}

function updateOrbitData(position, gmst) {
    const geodetic = satellite.eciToGeodetic(position, gmst);
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

    let signedTimeStep = propagateForward ? timeStep : (timeStep * -1);

    // Propagate orbit if not paused and the update interval has passed
    if (!paused && time - lastUpdate >= updateIntervalMs) {

        // Update Earth's rotation and Sun's position
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

        if (customOrbit) {
            // Propagate with the custom orbital elements defined by the user

            // Calculate Mean Anomaly (M)
            const deltaT = (date - customEpoch) / 1000;
            let M = (customMeanAnomalyAtEpoch + (customMeanMotion * deltaT)) % (2 * Math.PI);
            if (M < 0) M += (2 * Math.PI);

            // Solve for Eccentric Anomaly (E) with Newton-Raphson method
            let E = M; // Initialize to M
            const e = customEccentricity;
            for (let i = 0; i < 10; i++) {
                /*

                Kepler's equation: M = E - (e * sin(E))
                f(E) = E - (e * sin(E)) - M = 0
                f'(E) = 1 - (e * cos(E)) = 0
                E_(i+1) = E_(i) - f(E_(i))/f'(E_(i))

                */
                
                let newE = E - (E - (e * Math.sin(E)) - M) / (1 - (e * Math.cos(E)));

                if (Math.abs(newE - E) < 0.001) {
                    E = newE;
                    break;
                }

                E = newE;
            }

            // Calculate position in Perifocal coordinate system using E
            let x = customSemiMajorAxis * (Math.cos(E) - e);
            let y = customSemiMajorAxis * Math.sqrt(1 - (e ** 2)) * Math.sin(E);
            satelliteMesh.position.set(x / 1000, 0, -y / 1000);

            // Update geodetic coordinates panel
            const position = new THREE.Vector3(x / 1000, 0, -y / 1000);
            position.applyQuaternion(pqwGroup.quaternion);
            updateOrbitData({x: position.x * 1000, y: -position.z * 1000, z: position.y * 1000}, gmst);

            // Update orbital elements panel
            meanAnomalyValue.textContent = (M * 180 / Math.PI).toFixed(3) + '°';
            let trueAnomaly = 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E / 2));
            if (trueAnomaly < 0) trueAnomaly += (2 * Math.PI);
            trueAnomalyValue.textContent = (trueAnomaly * 180 / Math.PI).toFixed(3) + '°';
        } else if (satrec) {
            // Propagate with TLE data if it exists

            positionAndVelocity = satellite.propagate(satrec, date);

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

            // Update geodetic coordinates and orbital elements panels
            updateOrbitData(positionAndVelocity.position, gmst);
            const deltaT = (date - epoch) / 60000;
            let M = (satrec.mo + (satrec.no * deltaT)) % (2 * Math.PI);
            if (M < 0) M += (2 * Math.PI);
            meanAnomalyValue.textContent = (M * 180 / Math.PI).toFixed(3) + '°';
            trueAnomalyValue.textContent = (calculateTleTrueAnomaly(positionAndVelocity) * 180 / Math.PI).toFixed(3) + '°';
        }

        // Update simulated time and lastUpdate variable
        lastUpdate = time;
        switch (timeStepUnit) {
            case milliseconds:
                date.setMilliseconds(date.getMilliseconds() + signedTimeStep);
                break;
            case seconds:
                date.setSeconds(date.getSeconds() + signedTimeStep);
                break;
            case minutes:
                date.setMinutes(date.getMinutes() + signedTimeStep);
                break;
            case hours:
                date.setHours(date.getHours() + signedTimeStep);
                break;
            default:
                console.log('Invalid time step unit. Setting to seconds...');
                timeStepUnit = seconds;
                date.setSeconds(date.getSeconds() + signedTimeStep);
                break;
        }
        simulationDateValue.textContent = date.toUTCString();
    }

    renderer.render(scene, camera);
}

function initialize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    camera.position.set(15, 0, -15);
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
    
    const exrLoader = new EXRLoader();
    exrLoader.load('./assets/textures/starmap_2020_4k.exr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const starMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide,
        });

        const constellationTexture = textureLoader.load('./assets/textures/constellation_figures_8k.jpg');
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
    updateOrbitShapeMesh();
    orbitalPlaneMesh = new THREE.GridHelper(30, 30, 0x00FFFF, 0x00FFFF);
    orbitalPlaneMesh.material.transparent = true;
    orbitalPlaneMesh.material.opacity = 0.4;
    orbitalPlaneMesh.visible = false;
    pqwGroup.add(orbitalPlaneMesh);
    semiMajorAxisInput.addEventListener('input', updateOrbitShapeMesh);
    eccentricityInput.addEventListener('input', updateOrbitShapeMesh);
    inclinationInput.addEventListener('input', updateInclination);
    raanInput.addEventListener('input', updateRaan);
    argPerigeeInput.addEventListener('input', updateArgPerigee);
    rotatePqwGroup();

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

            switch (button.id) {
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
                case 'constellationsVisibilityButton':
                    constellationSphere.visible = visible;
                    break;
            }
        });
    });

    renderer.setAnimationLoop(animate);
}


initialize();