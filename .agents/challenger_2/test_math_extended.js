// Extended geodesic math test script

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

console.log("=== EXTENDED GEODESIC MATH TESTS ===");

// Micro Polygon (1m x 1m approx: lat 12.9716, 0.000009 deg approx 1m)
console.log("\n1. Micro Polygon (1 meter x 1 meter box):");
const microBoxCCW = [
  [77.594600, 12.971600],
  [77.594609, 12.971600],
  [77.594609, 12.971609],
  [77.594600, 12.971609]
];
console.log("Area 1m x 1m (CCW):", calculateGeodesicArea(microBoxCCW), "formatted:", formatArea(calculateGeodesicArea(microBoxCCW)));

// Self intersecting figure 8
console.log("\n2. Self-intersecting Figure-8 Polygon:");
const figure8 = [
  [77.5900, 12.9700],
  [77.6000, 12.9800],
  [77.5900, 12.9800],
  [77.6000, 12.9700]
];
console.log("Area (Figure 8):", calculateGeodesicArea(figure8), "formatted:", formatArea(calculateGeodesicArea(figure8)));

// Duplicate closing vertex passed (e.g. 4 points where 4th equals 1st)
console.log("\n3. Polygon passed with duplicate closing vertex (4 points, p1=p4):");
const closedSquare = [
  [77.5900, 12.9700],
  [77.6000, 12.9700],
  [77.6000, 12.9800],
  [77.5900, 12.9800],
  [77.5900, 12.9700] // duplicate start point
];
console.log("Area (Closed 5-vertex polygon):", calculateGeodesicArea(closedSquare), "formatted:", formatArea(calculateGeodesicArea(closedSquare)));

// Extreme latitude (North Pole / South Pole)
console.log("\n4. Extreme Latitude (89.9° N):");
const polarTriangle = [
  [0, 89.9],
  [90, 89.9],
  [180, 89.9]
];
console.log("Distance polar:", calculateTotalPathDistance(polarTriangle));
console.log("Area polar:", calculateGeodesicArea(polarTriangle), "formatted:", formatArea(calculateGeodesicArea(polarTriangle)));
