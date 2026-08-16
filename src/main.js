import './styles.css';
import * as satellite from 'satellite.js';
import * as scene from './scene.js';
import { getTLE } from './tle.js';
import { mu, calculateTleMeanAnomaly, calculateTleTrueAnomaly, propagateCustomOrbit } from './orbital-mechanics.js';

const tleOrbitTab = document.getElementById('tleOrbitTab');
const tleOrbitTabContent = document.getElementById('tleOrbitTabContent');
const customOrbitTab = document.getElementById('customOrbitTab');
const customOrbitTabContent = document.getElementById('customOrbitTabContent');

const noradIdInput = document.getElementById('noradIdInput');
const fetchTleButton = document.getElementById('fetchTleButton');
const tleFetchStatus = document.getElementById('tleFetchStatus');

const semiMajorAxisInput = document.getElementById('semiMajorAxisInput');
const eccentricityInput = document.getElementById('eccentricityInput');
const inclinationInput = document.getElementById('inclinationInput');
const raanInput = document.getElementById('raanInput');
const argPerigeeInput = document.getElementById('argPerigeeInput');
const trueAnomalyInput = document.getElementById('trueAnomalyInput');
const epochInput = document.getElementById('epochInput');
const setOrbitButton = document.getElementById('setOrbitButton');

const liveTrackingToggle = document.getElementById('liveTrackingToggle');
const timeStepControls = document.getElementById('timeStepControls');
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

// True if user has defined custom orbit, false if propagating with TLE data
let customOrbit = false;

let tleEpoch;
let tleSemiMajorAxis;
let tleEccentricity;
let tleInclination;
let tleRaan;
let tleArgPerigee;
let tleMeanMotion;
let tleMeanAnomalyAtEpoch;
let tleMeanAnomaly;
let tleTrueAnomaly;

let customEpoch;
let customSemiMajorAxis;
let customEccentricity;
let customInclination = 0;
let customRaan = 0;
let customArgPerigee = 0;
let customMeanMotion;
let customMeanAnomalyAtEpoch;
let customMeanAnomaly;
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
let state;
let date; // Simulation date
let paused = true;
let liveTracking = true;
let propagateForward = true;
let lastUpdate = 0;

let lastTLEUpdate = 0; // Last time TLE data was updated with mean elements
let T = 0; // Orbital period in seconds

function switchOrbitTab(newMode) {
    const switchToTle = (newMode === 'tle');
    tleOrbitTab.classList.toggle('selected', switchToTle);
    customOrbitTab.classList.toggle('selected', !switchToTle);
    tleOrbitTabContent.classList.toggle('hidden', !switchToTle);
    customOrbitTabContent.classList.toggle('hidden', switchToTle);

    customOrbit = !switchToTle;

    if (switchToTle) {
        if (satrec && date) {
            scene.setMode('tle');
            scene.clearOrbitPoints();

            state = satellite.propagate(satrec, date);
            tleSemiMajorAxis = state.meanElements.am * 6378.135; // Convert from Earth radii to kilometers
            tleEccentricity = state.meanElements.em;
            tleInclination = state.meanElements.im;
            tleRaan = state.meanElements.Om;
            tleArgPerigee = state.meanElements.om;
            tleMeanMotion = state.meanElements.nm;
            tleMeanAnomaly = state.meanElements.mm;

            // Dividing by 1,000 since each unit represents 1,000 km
            scene.setSatellitePosition(
                state.position.x / 1000,
                state.position.z / 1000,
                -state.position.y / 1000
            ); // x, z, -y to match Three JS' coordinate system

            scene.updateOrbitShapeMesh(tleSemiMajorAxis ?? 6500, tleEccentricity ?? 0);
            scene.updateInclination(tleInclination ?? 0, tleRaan ?? 0, tleArgPerigee ?? 0);
            scene.updateRaan(tleInclination ?? 0, tleRaan ?? 0, tleArgPerigee ?? 0);
            scene.updateArgPerigee(tleInclination ?? 0, tleRaan ?? 0, tleArgPerigee ?? 0);
            scene.updateNodes(tleSemiMajorAxis, tleEccentricity, tleInclination, tleRaan, tleArgPerigee);

            // Update geodetic coordinates panel
            updateGeodeticCoordinatesPanel(state.position, satellite.gstime(date));

            // Update mean and true anomaly
            tleMeanAnomaly = calculateTleMeanAnomaly(date, tleEpoch, tleMeanAnomalyAtEpoch, tleMeanMotion);
            tleTrueAnomaly = calculateTleTrueAnomaly(state);
            meanAnomalyValue.textContent = (tleMeanAnomaly * 180 / Math.PI).toFixed(3) + '°';
            trueAnomalyValue.textContent = (tleTrueAnomaly * 180 / Math.PI).toFixed(3) + '°';
        }
    } else {
        scene.setMode('custom');
        scene.clearOrbitPoints();

        scene.updateOrbitShapeMesh(customSemiMajorAxis ?? 6500, customEccentricity ?? 0);
        scene.updateInclination(customInclination ?? 0, customRaan ?? 0, customArgPerigee ?? 0);
        scene.updateRaan(customInclination ?? 0, customRaan ?? 0, customArgPerigee ?? 0);
        scene.updateArgPerigee(customInclination ?? 0, customRaan ?? 0, customArgPerigee ?? 0);
        scene.updateNodes(customSemiMajorAxis ?? 6500, customEccentricity ?? 0, customInclination ?? 0, customRaan ?? 0, customArgPerigee ?? 0);

        // If mean motion has been calculated, then a custom orbit was previously defined
        if (customMeanMotion != null) {
            const result = propagateCustomOrbit(date, customEpoch, customMeanAnomalyAtEpoch, customMeanMotion, customEccentricity, customSemiMajorAxis);
            const position = result.position;
            scene.setSatellitePosition(position.x, position.y, position.z);

            // Update geodetic coordinates panel
            const positionECI = scene.convertPQWToECI(position);
            updateGeodeticCoordinatesPanel({x: positionECI.x * 1000, y: -positionECI.z * 1000, z: positionECI.y * 1000}, satellite.gstime(date));
        } else {
            scene.setSatellitePosition(0, 0, 0);
            latitudeValue.textContent = '';
            longitudeValue.textContent = '';
            altitudeValue.textContent = '';
        }
    }

    updateOrbitalElementsPanel(newMode);

    if (date) simulationDateValue.textContent = date.toLocaleString(undefined, { timeZoneName: 'short' });
    paused = !liveTracking || !date;
    pauseResumeButton.textContent = paused ? 'Propagate' : 'Pause';
}
tleOrbitTab.addEventListener('click', () => switchOrbitTab('tle'));
customOrbitTab.addEventListener('click', () => switchOrbitTab('custom'));

fetchTleButton.addEventListener('click', async () => {
    const noradId = noradIdInput.value.trim();
    if (!noradId || isNaN(noradId) || noradId.length > 9) {
        alert(`Unable to fetch TLE for ${noradId} since it is not a 1-9 digit number`);
        return;
    }
    console.log('Fetching TLE for NORAD ID:', noradId);
    try {
        const { tle, fromCache, minutesAgo } = await getTLE(noradId);
        tleFetchStatus.textContent = fromCache
            ? `TLE loaded from cache (fetched ${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago)`
            : 'TLE fetched from Celestrak';

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
        tleSemiMajorAxis = Math.cbrt(mu / ((satrec.no / 60) ** 2)) / 1000;
        tleEccentricity = satrec.ecco;
        tleInclination = satrec.inclo;
        tleRaan = satrec.nodeo;
        tleArgPerigee = satrec.argpo;
        tleMeanMotion = satrec.no;
        tleMeanAnomalyAtEpoch = satrec.mo;
        tleEpoch = new Date(Date.UTC(satrec.epochyr < 57 ? 2000 + satrec.epochyr : 1900 + satrec.epochyr, 0, 0));
        tleEpoch.setTime(tleEpoch.getTime() + (satrec.epochdays * 1000 * 60 * 60 * 24));

        date = new Date(tleEpoch);
        state = satellite.propagate(satrec, date);

        tleMeanAnomaly = calculateTleMeanAnomaly(date, tleEpoch, tleMeanAnomalyAtEpoch, tleMeanMotion);
        tleTrueAnomaly = calculateTleTrueAnomaly(state);

        // Update Earth's rotation and Sun's position
        const gmst = satellite.gstime(date);
        scene.updateEarthRotation(gmst);
        scene.updateSunPosition(satellite.sunPos(satellite.jday(date)));

        // Update UI for orbital elements
        updateOrbitalElementsPanel('tle');

        // Update geodetic coordinates panel
        updateGeodeticCoordinatesPanel(state.position, gmst);

        scene.setMode('tle');
        // Dividing by 1,000 since each unit represents 1,000 km
        scene.setSatellitePosition(
            state.position.x / 1000,
            state.position.z / 1000,
            -state.position.y / 1000
        ); // x, z, -y to match Three JS' coordinate system
        
        scene.clearOrbitPoints();

        customOrbit = false;
        scene.updateOrbitShapeMesh(tleSemiMajorAxis, tleEccentricity);
        scene.updateInclination(tleInclination, tleRaan, tleArgPerigee);
        scene.updateRaan(tleInclination, tleRaan, tleArgPerigee);
        scene.updateArgPerigee(tleInclination, tleRaan, tleArgPerigee);
        scene.updateNodes(tleSemiMajorAxis, tleEccentricity, tleInclination, tleRaan, tleArgPerigee);

        // Update Simulation Controls panel
        simulationDateValue.textContent = date.toLocaleString(undefined, { timeZoneName: 'short' });
        paused = false;
        pauseResumeButton.textContent = 'Pause';
    } catch (error) {
        tleFetchStatus.textContent = '';
        alert(error.message);
        console.error(`Caught error while fetching TLE: ${error}`);
    }
});

setOrbitButton.addEventListener('click', () => {
    parseCustomOrbitValues();

    if (customEpoch === null) customEpoch = new Date();
    date = new Date(customEpoch);
    if (customSemiMajorAxis === null) customSemiMajorAxis = 7000;
    if (customEccentricity === null) customEccentricity = 0;
    if (customInclination === null) customInclination = 0;
    if (customRaan === null) customRaan = 0;
    if (customArgPerigee === null) customArgPerigee = 0;
    if (customTrueAnomaly === null) customTrueAnomaly = 0;

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

    updateOrbitalElementsPanel('custom');

    customOrbit = true;
    scene.updateOrbitShapeMesh(customSemiMajorAxis, customEccentricity);
    scene.updateInclination(customInclination, customRaan, customArgPerigee);
    scene.updateRaan(customInclination, customRaan, customArgPerigee);
    scene.updateArgPerigee(customInclination, customRaan, customArgPerigee);
    scene.updateNodes(customSemiMajorAxis, customEccentricity, customInclination, customRaan, customArgPerigee);

    scene.setMode('custom');

    // Update Earth's rotation and Sun's position
    const gmst = satellite.gstime(date);
    scene.updateEarthRotation(gmst);
    scene.updateSunPosition(satellite.sunPos(satellite.jday(date)));

    // Update Simulation Controls panel
    simulationDateValue.textContent = date.toLocaleString(undefined, { timeZoneName: 'short' });
    paused = false;
    pauseResumeButton.textContent = 'Pause';
});

liveTrackingToggle.addEventListener('change', () => {
    liveTracking = liveTrackingToggle.checked;
    timeStepControls.classList.toggle('hidden', liveTracking);
    timeDirectionSelect.classList.toggle('hidden', liveTracking);
    paused = !liveTracking || !date;
    pauseResumeButton.textContent = paused ? 'Propagate' : 'Pause';
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
    if (!date) return;
    paused = !paused;
    pauseResumeButton.textContent = paused ? 'Propagate' : 'Pause';
});

timeDirectionSelect.addEventListener('change', () => {
    propagateForward = timeDirectionSelect.value === 'Forward';
});

// Parses the custom orbit values and converts degrees to radians or sets to null if invalid
function parseCustomOrbitValues() {
    customEpoch = epochInput.value ? new Date(epochInput.value + 'Z') : null;

    customSemiMajorAxis = semiMajorAxisInput.valueAsNumber;
    if (isNaN(customSemiMajorAxis) || customSemiMajorAxis < 0) customSemiMajorAxis = null;
    customEccentricity = eccentricityInput.valueAsNumber;
    if (isNaN(customEccentricity) || customEccentricity < 0 || customEccentricity >= 1) customEccentricity = null;

    customInclination = inclinationInput.valueAsNumber;
    if (isNaN(customInclination) || customInclination < 0 || customInclination > 180) {
        customInclination = null;
    } else {
        customInclination = customInclination * Math.PI / 180;
    }
    customRaan = raanInput.valueAsNumber;
    if (isNaN(customRaan) || customRaan < 0 || customRaan > 359.99) {
        customRaan = null;
    } else {
        customRaan = customRaan * Math.PI / 180;
    }
    customArgPerigee = argPerigeeInput.valueAsNumber;
    if (isNaN(customArgPerigee) || customArgPerigee < 0 || customArgPerigee > 359.99) {
        customArgPerigee = null;
    } else {
        customArgPerigee = customArgPerigee * Math.PI / 180;
    }
    customTrueAnomaly = trueAnomalyInput.valueAsNumber;
    if (isNaN(customTrueAnomaly) || customTrueAnomaly < 0 || customTrueAnomaly > 359.99) {
        customTrueAnomaly = null;
    } else {
        customTrueAnomaly = customTrueAnomaly * Math.PI / 180;
    }
}

// Updates the orbital elements panel with the current values for the given mode ('tle' or 'custom')
function updateOrbitalElementsPanel(mode) {
    const tleMode = (mode === 'tle');
    const toDegrees = (r) => r != null ? r * 180 / Math.PI : null;

    const epoch = tleMode ? tleEpoch : customEpoch;
    const semiMajorAxis = tleMode ? tleSemiMajorAxis : customSemiMajorAxis;
    const eccentricity = tleMode ? tleEccentricity : customEccentricity;
    const inclination = toDegrees(tleMode ? tleInclination : customInclination);
    const raan = toDegrees(tleMode ? tleRaan : customRaan);
    const argPerigee = toDegrees(tleMode ? tleArgPerigee : customArgPerigee);
    const meanMotion = tleMode ? tleMeanMotion : customMeanMotion;
    const meanAnomaly = toDegrees(tleMode ? tleMeanAnomaly : customMeanAnomaly);
    const trueAnomaly = toDegrees(tleMode ? tleTrueAnomaly : customTrueAnomaly);

    epochValue.textContent = epoch != null ? epoch.toUTCString() : '';
    semiMajorAxisValue.textContent = semiMajorAxis != null ? semiMajorAxis.toFixed(3) + ' km' : '';
    eccentricityValue.textContent = eccentricity != null ? eccentricity.toFixed(5) : '';
    inclinationValue.textContent = inclination != null ? inclination.toFixed(3) + '°' : '';
    raanValue.textContent = raan != null ? raan.toFixed(3) + '°' : '';
    argPerigeeValue.textContent = argPerigee != null ? argPerigee.toFixed(3) + '°' : '';
    meanMotionValue.textContent = meanMotion != null ? meanMotion.toFixed(3) + ' rad/' + (tleMode ? 'min' : 'sec') : '';
    meanAnomalyValue.textContent = meanAnomaly != null ? meanAnomaly.toFixed(3) + '°' : '';
    trueAnomalyValue.textContent = trueAnomaly != null ? trueAnomaly.toFixed(3) + '°' : '';
}

function updateGeodeticCoordinatesPanel(position, gmst) {
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
    scene.updateControls();

    let signedTimeStep = propagateForward ? timeStep : (timeStep * -1);

    // Propagate orbit if not paused and the update interval has passed
    if (!paused && time - lastUpdate >= updateIntervalMs) {

        // Synchronizes date with current time if live tracking is enabled
        if (liveTracking) date = new Date();

        // Update Earth's rotation and Sun's position
        const gmst = satellite.gstime(date);
        scene.updateEarthRotation(gmst);
        scene.updateSunPosition(satellite.sunPos(satellite.jday(date)));

        if (customOrbit) {
            // Propagate with the custom orbital elements defined by the user
            const result = propagateCustomOrbit(date, customEpoch, customMeanAnomalyAtEpoch, customMeanMotion, customEccentricity, customSemiMajorAxis);
            const position = result.position;
            customMeanAnomaly = result.meanAnomaly;
            customTrueAnomaly = result.trueAnomaly;

            // Update satellite position
            scene.setSatellitePosition(position.x, position.y, position.z);

            // Update orbital elements panel
            meanAnomalyValue.textContent = (customMeanAnomaly * 180 / Math.PI).toFixed(3) + '°';
            trueAnomalyValue.textContent = (customTrueAnomaly * 180 / Math.PI).toFixed(3) + '°';

            // Update geodetic coordinates panel
            const positionECI = scene.convertPQWToECI(position);
            updateGeodeticCoordinatesPanel({x: positionECI.x * 1000, y: -positionECI.z * 1000, z: positionECI.y * 1000}, gmst);
        } else if (satrec) {
            // Propagate with TLE data if it exists
            state = satellite.propagate(satrec, date);
            T = 2 * Math.PI * Math.sqrt((tleSemiMajorAxis * 1000) ** 3 / mu);
            // Update TLE data with mean elements every 1/4 of the orbital period T
            // (1/4 is arbitrary based on smoothness of changes with performance considerations)
            if (date.getTime() - lastTLEUpdate >= T / 4 * 1000) {
                tleSemiMajorAxis = state.meanElements.am * 6378.135; // Convert from Earth radii to kilometers
                tleEccentricity = state.meanElements.em;
                tleInclination = state.meanElements.im;
                tleRaan = state.meanElements.Om;
                tleArgPerigee = state.meanElements.om;
                tleMeanMotion = state.meanElements.nm;
                tleMeanAnomaly = state.meanElements.mm;
                scene.updateOrbitShapeMesh(tleSemiMajorAxis, tleEccentricity);
                scene.updateInclination(tleInclination, tleRaan, tleArgPerigee);
                scene.updateRaan(tleInclination, tleRaan, tleArgPerigee);
                scene.updateArgPerigee(tleInclination, tleRaan, tleArgPerigee);
                scene.updateNodes(tleSemiMajorAxis, tleEccentricity, tleInclination, tleRaan, tleArgPerigee);
                updateOrbitalElementsPanel('tle');
                lastTLEUpdate = date.getTime();
            }

            // Dividing by 1,000 since each unit represents 1,000 km
            const x = state.position.x / 1000;
            const y = state.position.y / 1000;
            const z = state.position.z / 1000;
            scene.setSatellitePosition(x, z, -y); // x, z, -y to match Three JS' coordinate system

            scene.addOrbitPoint(x, y, z);

            // Update geodetic coordinates and orbital elements panels
            updateGeodeticCoordinatesPanel(state.position, gmst);
            tleMeanAnomaly = calculateTleMeanAnomaly(date, tleEpoch, tleMeanAnomalyAtEpoch, tleMeanMotion);
            meanAnomalyValue.textContent = (tleMeanAnomaly * 180 / Math.PI).toFixed(3) + '°';
            tleTrueAnomaly = calculateTleTrueAnomaly(state);
            trueAnomalyValue.textContent = (tleTrueAnomaly * 180 / Math.PI).toFixed(3) + '°';
        }

        // Update simulated time and lastUpdate variable
        lastUpdate = time;
        if (!liveTracking) {
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
        }
        simulationDateValue.textContent = date.toLocaleString(undefined, { timeZoneName: 'short' });
    }

    scene.render();
}

function initialize() {
    scene.initializeScene();

    semiMajorAxisInput.addEventListener('input', (event) => {
        let a = parseFloat(event.target.value);
        if (isNaN(a) || a < 0) {
            a = 6500;
        } else {
            customSemiMajorAxis = a;
        }
        scene.updateOrbitShapeMesh(a, customEccentricity ?? 0);
        scene.updateNodes(a, customEccentricity ?? 0, customInclination ?? 0, customRaan ?? 0, customArgPerigee ?? 0);
    });
    eccentricityInput.addEventListener('input', (event) => {
        let e = parseFloat(event.target.value);
        if (isNaN(e) || e < 0 || e >= 1) {
            e = 0;
        } else {
            customEccentricity = e;
        }
        scene.updateOrbitShapeMesh(customSemiMajorAxis ?? 6500, e);
        scene.updateNodes(customSemiMajorAxis ?? 6500, e, customInclination ?? 0, customRaan ?? 0, customArgPerigee ?? 0);
    });
    inclinationInput.addEventListener('input', (event) => {
        let i = parseFloat(event.target.value);
        if (isNaN(i) || i < 0 || i > 180) {
            i = 0;
        } else {
            i = i * Math.PI / 180;
            customInclination = i;
        }
        scene.updateInclination(i, customRaan ?? 0, customArgPerigee ?? 0);
        scene.updateNodes(customSemiMajorAxis ?? 6500, customEccentricity ?? 0, i, customRaan ?? 0, customArgPerigee ?? 0);
    });
    raanInput.addEventListener('input', (event) => {
        let raan = parseFloat(event.target.value);
        if (isNaN(raan) || raan < 0 || raan > 359.99) {
            raan = 0;
        } else {
            raan = raan * Math.PI / 180;
            customRaan = raan;
        }
        scene.updateRaan(customInclination ?? 0, raan, customArgPerigee ?? 0);
        scene.updateNodes(customSemiMajorAxis ?? 6500, customEccentricity ?? 0, customInclination ?? 0, raan, customArgPerigee ?? 0);
    });
    argPerigeeInput.addEventListener('input', (event) => {
        let argPerigee = parseFloat(event.target.value);
        if (isNaN(argPerigee) || argPerigee < 0 || argPerigee > 359.99) {
            argPerigee = 0;
        } else {
            argPerigee = argPerigee * Math.PI / 180;
            customArgPerigee = argPerigee;
        }
        scene.updateArgPerigee(customInclination ?? 0, customRaan ?? 0, argPerigee);
        scene.updateNodes(customSemiMajorAxis ?? 6500, customEccentricity ?? 0, customInclination ?? 0, customRaan ?? 0, argPerigee);
    });

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

            scene.setVisibility(button.id, visible);
        });
    });

    scene.startAnimationLoop(animate);
}

initialize();