import * as THREE from 'three';

// Standard gravitational parameter of Earth
export const mu = 3.986004418e14;

// Calculates the mean anomaly for the given simulation date
export function calculateTleMeanAnomaly(date, tleEpoch, tleMeanAnomalyAtEpoch, tleMeanMotion) {
    const deltaT = (date - tleEpoch) / 60000;
    let M = (tleMeanAnomalyAtEpoch + (tleMeanMotion * deltaT)) % (2 * Math.PI);
    if (M < 0) M += (2 * Math.PI);
    return M;
}

// Calculates the true anomaly for the given state vector
export function calculateTleTrueAnomaly(state) {
    const r = new THREE.Vector3(state.position.x, state.position.y, state.position.z);
    const v = new THREE.Vector3(state.velocity.x, state.velocity.y, state.velocity.z);
    const e = r.clone().multiplyScalar(((v.length() ** 2) / (mu / 1e9)) - (1 / r.length())).addScaledVector(v, -r.dot(v) / (mu / 1e9));
    let trueAnomaly = Math.acos(e.dot(r) / (e.length() * r.length()));
    if (r.dot(v) < 0) trueAnomaly = (2 * Math.PI) - trueAnomaly;
    return trueAnomaly;
}

// Propagates the custom-defined orbit for the given simulation date and returns the position in PQW, mean anomaly, and true anomaly
export function propagateCustomOrbit(date, customEpoch, customMeanAnomalyAtEpoch, customMeanMotion, customEccentricity, customSemiMajorAxis) {
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

    // Calculate true anomaly
    let trueAnomaly = 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E / 2));
    if (trueAnomaly < 0) trueAnomaly += (2 * Math.PI);

    // Calculate position in Perifocal coordinate system using E
    let x = customSemiMajorAxis * (Math.cos(E) - e);
    let y = customSemiMajorAxis * Math.sqrt(1 - (e ** 2)) * Math.sin(E);
    return { position: new THREE.Vector3(x / 1000, 0, -y / 1000), meanAnomaly: M, trueAnomaly: trueAnomaly };
}