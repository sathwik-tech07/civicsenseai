// Standalone test script importing math functions from MeasurementTool logic

function calculateBearing(start, end) {
  const startLat = (start[1] * Math.PI) / 180;
  const startLng = (start[0] * Math.PI) / 180;
  const endLat = (end[1] * Math.PI) / 180;
  const endLng = (end[0] * Math.PI) / 180;

  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function calculateGeodesicDistance(coord1, coord2) {
  const R = 6371000; // Earth mean radius in meters
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateTotalPathDistance(points) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateGeodesicDistance(points[i], points[i + 1]);
  }
  return total;
}

function calculateGeodesicArea(coords) {
  if (coords.length < 3) return 0;
  const R = 6371000;
  let totalAngle = 0;

  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % coords.length];
    const p3 = coords[(i + 2) % coords.length];

    const bearing1 = calculateBearing(p2, p1);
    const bearing2 = calculateBearing(p2, p3);
    let angle = bearing2 - bearing1;
    if (angle < 0) angle += 360;

    totalAngle += angle;
  }

  const n = coords.length;
  const sphericalExcess = ((totalAngle - (n - 2) * 180) * Math.PI) / 180;
  const areaM2 = Math.abs(sphericalExcess * R * R);
  return areaM2;
}

function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatArea(sqMeters) {
  if (sqMeters >= 1000000) {
    return `${(sqMeters / 1000000).toFixed(2)} km²`;
  }
  if (sqMeters >= 10000) {
    return `${(sqMeters / 10000).toFixed(2)} ha`;
  }
  return `${Math.round(sqMeters)} m²`;
}

console.log("=== EMPIRICAL GEODESIC MATH TESTS ===");

// 1. Zero points
console.log("1. Zero points:");
console.log("Distance:", calculateTotalPathDistance([]), "formatted:", formatDistance(calculateTotalPathDistance([])));
console.log("Area:", calculateGeodesicArea([]), "formatted:", formatArea(calculateGeodesicArea([])));

// 2. Single point
console.log("\n2. Single point:");
const single = [[77.5946, 12.9716]];
console.log("Distance:", calculateTotalPathDistance(single), "formatted:", formatDistance(calculateTotalPathDistance(single)));
console.log("Area:", calculateGeodesicArea(single), "formatted:", formatArea(calculateGeodesicArea(single)));

// 3. Two points
console.log("\n3. Two points:");
const p2 = [[77.5946, 12.9716], [77.6046, 12.9816]];
console.log("Distance:", calculateTotalPathDistance(p2), "formatted:", formatDistance(calculateTotalPathDistance(p2)));
console.log("Area:", calculateGeodesicArea(p2), "formatted:", formatArea(calculateGeodesicArea(p2)));

// 4. 3+ points (Square approx 1km x 1km in Bengaluru)
console.log("\n4. 3+ points (1km x 1km Square):");
const squareCW = [
  [77.5900, 12.9700],
  [77.5900, 12.9800],
  [77.6000, 12.9800],
  [77.6000, 12.9700]
];
const squareCCW = [
  [77.5900, 12.9700],
  [77.6000, 12.9700],
  [77.6000, 12.9800],
  [77.5900, 12.9800]
];
console.log("Distance (Perimeter CW):", calculateTotalPathDistance(squareCW));
console.log("Area (CW):", calculateGeodesicArea(squareCW), "formatted:", formatArea(calculateGeodesicArea(squareCW)));
console.log("Area (CCW):", calculateGeodesicArea(squareCCW), "formatted:", formatArea(calculateGeodesicArea(squareCCW)));

// 5. Collinear points
console.log("\n5. Collinear points (3 points on a line):");
const collinear = [
  [77.5900, 12.9700],
  [77.5950, 12.9700],
  [77.6000, 12.9700]
];
console.log("Distance:", calculateTotalPathDistance(collinear));
console.log("Area (Collinear):", calculateGeodesicArea(collinear), "formatted:", formatArea(calculateGeodesicArea(collinear)));

// 6. Zero-area polygon (Identical / duplicated vertices)
console.log("\n6. Zero-area polygon (3 identical points):");
const zeroPoly = [
  [77.5900, 12.9700],
  [77.5900, 12.9700],
  [77.5900, 12.9700]
];
console.log("Distance:", calculateTotalPathDistance(zeroPoly));
console.log("Area (ZeroPoly):", calculateGeodesicArea(zeroPoly), "formatted:", formatArea(calculateGeodesicArea(zeroPoly)));

// 7. Negative longitude / latitude
console.log("\n7. Negative Longitude & Latitude (Southern / Western hemisphere e.g. -43.17, -22.90 Rio):");
const negCoordsCW = [
  [-43.1800, -22.9100],
  [-43.1800, -22.9000],
  [-43.1700, -22.9000],
  [-43.1700, -22.9100]
];
console.log("Distance:", calculateTotalPathDistance(negCoordsCW));
console.log("Area:", calculateGeodesicArea(negCoordsCW), "formatted:", formatArea(calculateGeodesicArea(negCoordsCW)));

// 8. Extreme values (NaN, Inf, Antimeridian)
console.log("\n8. Extreme values (Antimeridian crossing e.g. 179.9 to -179.9):");
const antimeridian = [
  [179.9, 0.0],
  [-179.9, 0.0]
];
console.log("Distance across antimeridian:", calculateTotalPathDistance(antimeridian), "formatted:", formatDistance(calculateTotalPathDistance(antimeridian)));

// 9. Floating point NaN / Infinity checks
console.log("\n9. Floating Point checks (Same point distance):");
console.log("Same point distance:", calculateGeodesicDistance([77.59, 12.97], [77.59, 12.97]));
