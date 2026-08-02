// Standalone SearchPanel logic test script

// Mock data similar to SearchPanel
const mockWards = [
  { id: 'w1', name: 'Ward 1', zone: 'East', code: 'W01', population: 50000, lat: 12.97, lng: 77.59 }
];

const mockIncidents = [
  { id: 'inc1', title: 'Pothole on Main St', severity: 'high', address: '123 Main St', wardName: 'Ward 1', lat: 12.97, lng: 77.59 },
  { id: 'inc2', title: undefined, severity: 'low', address: null, wardName: 'Ward 2', lat: 12.98, lng: 77.60 } // Dirty / incomplete data
];

const HOSPITALS_LIST = [
  { id: 'h1', name: 'City Hospital', beds: 100, lat: 12.97, lng: 77.59 }
];

const IOT_SENSORS_DATA = [
  { id: 's1', name: 'AQI Sensor 1', type: 'aqi', status: 'active', lat: 12.97, lng: 77.59 }
];

const LANDMARK_PRESETS = [
  { id: 'l1', name: 'Vidhana Soudha', description: 'Govt seat', coordinates: [77.59, 12.97] }
];

function buildSearchIndex(wards, incidents, predictiveRisks) {
  const items = [];
  (wards || []).forEach((w) =>
    items.push({
      id: `ward_${w.id}`,
      title: w.name,
      subtitle: `${w.zone} Zone • Code: ${w.code} • Pop: ${w.population.toLocaleString()}`,
      category: 'ward',
      coordinates: [w.lng, w.lat],
      metadata: w,
    })
  );
  (incidents || []).forEach((inc) =>
    items.push({
      id: `inc_${inc.id}`,
      title: inc.title,
      subtitle: `${inc.severity?.toUpperCase()} Priority • ${inc.address || inc.wardName}`,
      category: 'incident',
      coordinates: [inc.lng, inc.lat],
      metadata: inc,
    })
  );
  (predictiveRisks || []).forEach((rk) =>
    items.push({
      id: `risk_${rk.id}`,
      title: rk.zoneName,
      subtitle: `Failure Prob: ${rk.failureProbabilityScore}% • ${rk.riskType?.replace('_', ' ').toUpperCase()}`,
      category: 'risk',
      coordinates: [rk.lng, rk.lat],
      metadata: rk,
    })
  );
  (IOT_SENSORS_DATA || []).forEach((sns) =>
    items.push({
      id: `iot_${sns.id}`,
      title: sns.name,
      subtitle: `Telemetry Hub (${sns.type?.toUpperCase()}) • Status: ${sns.status?.toUpperCase()}`,
      category: 'sensor',
      coordinates: [sns.lng, sns.lat],
      metadata: sns,
    })
  );
  (HOSPITALS_LIST || []).forEach((hosp) =>
    items.push({
      id: `hosp_${hosp.id}`,
      title: hosp.name,
      subtitle: `Emergency Medical Hub • ${hosp.beds} Beds`,
      category: 'hospital',
      coordinates: [hosp.lng, hosp.lat],
      metadata: hosp,
    })
  );
  (LANDMARK_PRESETS || []).forEach((lm) =>
    items.push({
      id: `poi_${lm.id}`,
      title: lm.name,
      subtitle: lm.description,
      category: 'poi',
      coordinates: lm.coordinates,
      metadata: lm,
    })
  );
  return items;
}

function filterSearchIndex(searchIndex, query) {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  return searchIndex
    .filter(
      (item) =>
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
    )
    .slice(0, 10);
}

// Keyboard Navigation State Machine Test
function simulateKeyboardNav(results, initialIndex, key, isOpen) {
  if (!isOpen || results.length === 0) return { selectedIndex: initialIndex, isOpen, selectedItem: null };

  let selectedIndex = initialIndex;
  let nextIsOpen = isOpen;
  let selectedItem = null;

  if (key === 'ArrowDown') {
    selectedIndex = (selectedIndex + 1) % results.length;
  } else if (key === 'ArrowUp') {
    selectedIndex = (selectedIndex - 1 + results.length) % results.length;
  } else if (key === 'Enter') {
    if (results[selectedIndex]) {
      selectedItem = results[selectedIndex];
      nextIsOpen = false;
    }
  } else if (key === 'Escape') {
    nextIsOpen = false;
  }

  return { selectedIndex, isOpen: nextIsOpen, selectedItem };
}

console.log("=== SEARCH PANEL EDGE CASE TESTS ===");

const index = buildSearchIndex(mockWards, mockIncidents, []);

// 1. Empty Query
console.log("\n1. Empty Query (''):", filterSearchIndex(index, ''));
console.log("   Whitespace Query ('   '):", filterSearchIndex(index, '   '));

// 2. Special Regex Characters
const specialChars = ['[', '*', '?', '\\', '(', ')', '^', '$', '+', '.', '{'];
specialChars.forEach((char) => {
  try {
    const res = filterSearchIndex(index, char);
    console.log(`2. Special char '${char}': found ${res.length} matches. Success.`);
  } catch (err) {
    console.error(`2. Special char '${char}': ERROR`, err.message);
  }
});

// 3. Non-matching search string
const nonMatching = filterSearchIndex(index, 'XYZ_999_NON_EXISTENT');
console.log("\n3. Non-matching search string ('XYZ_999_NON_EXISTENT'):", nonMatching);

// 4. Keyboard Navigation
console.log("\n4. Keyboard Navigation Simulation:");
const results = filterSearchIndex(index, 'Ward');
console.log("Results count:", results.length);
let state = { selectedIndex: 0, isOpen: true, selectedItem: null };

// ArrowDown
state = { ...state, ...simulateKeyboardNav(results, state.selectedIndex, 'ArrowDown', state.isOpen) };
console.log("Press ArrowDown -> selectedIndex:", state.selectedIndex);

// ArrowDown again
state = { ...state, ...simulateKeyboardNav(results, state.selectedIndex, 'ArrowDown', state.isOpen) };
console.log("Press ArrowDown -> selectedIndex:", state.selectedIndex);

// ArrowUp
state = { ...state, ...simulateKeyboardNav(results, state.selectedIndex, 'ArrowUp', state.isOpen) };
console.log("Press ArrowUp -> selectedIndex:", state.selectedIndex);

// Enter
state = { ...state, ...simulateKeyboardNav(results, state.selectedIndex, 'Enter', state.isOpen) };
console.log("Press Enter -> isOpen:", state.isOpen, "selectedItem:", state.selectedItem?.title);

// Escape
state = { selectedIndex: 0, isOpen: true, selectedItem: null };
state = { ...state, ...simulateKeyboardNav(results, state.selectedIndex, 'Escape', state.isOpen) };
console.log("Press Escape -> isOpen:", state.isOpen);

// 5. Test null title handling in SearchPanel.tsx original code
console.log("\n5. Testing original SearchPanel.tsx item.title.toLowerCase() when title is undefined:");
try {
  const badItem = { title: undefined, subtitle: 'sub', category: 'ward' };
  const q = 'test';
  const match = badItem.title.toLowerCase().includes(q);
  console.log("Match:", match);
} catch (e) {
  console.log("CRASH CONFIRMED on undefined title:", e.message);
}
