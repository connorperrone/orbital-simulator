// Time to live for TLE data in cache
const tleCacheTtl = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

async function fetchTle(noradId) {
    const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error when sending request to fetch TLE: ${response.status}`);
    }

    return response.text();
}

// Fetches TLE data for the given NORAD ID or returns cached data if it has been fetched within the last 2 hours
export async function getTLE(noradId) {
    const now = Date.now();
    const key = `tle_cache_${noradId}`;
    const cached = localStorage.getItem(key);
    if (cached) {
        const { tle, fetchedAt } = JSON.parse(cached);
        if (now - fetchedAt < tleCacheTtl) {
            const minutesAgo = Math.round((now - fetchedAt) / 60000);
            return { tle, fromCache: true, minutesAgo };
        }
    }

    const tle = await fetchTle(noradId);
    localStorage.setItem(key, JSON.stringify({ tle, fetchedAt: now }));
    return { tle, fromCache: false };
}