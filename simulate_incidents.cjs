const http = require('http');

const sampleIncidents = [
  {
    title: 'CRITICAL: Water Main Burst',
    type: 'water_leak',
    severity: 'critical',
    status: 'reported',
    ward_id: 'w-4',
    ward_name: 'Ward 4 - Metro Health Corridor',
    lat: 12.9735,
    lng: 77.5965,
    address: 'Near City Hospital, MG Road',
    priority_score: 98,
    estimated_repair_cost: 150000,
    saved_early_intervention: 450000,
    photo_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?q=80&w=800',
    assigned_crew: 'Unassigned'
  },
  {
    title: 'HIGH: Pothole Cluster',
    type: 'pothole',
    severity: 'high',
    status: 'reported',
    ward_id: 'w-2',
    ward_name: 'Ward 2 - Industrial Hub',
    lat: 12.9800,
    lng: 77.6000,
    address: 'Sector 4, Industrial Layout',
    priority_score: 85,
    estimated_repair_cost: 45000,
    saved_early_intervention: 120000,
    photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=800',
    assigned_crew: 'Unassigned'
  },
  {
    title: 'MEDIUM: Broken Streetlight',
    type: 'broken_streetlight',
    severity: 'medium',
    status: 'reported',
    ward_id: 'w-1',
    ward_name: 'Ward 1 - Central Business District',
    lat: 12.9750,
    lng: 77.5900,
    address: 'Commercial Street',
    priority_score: 65,
    estimated_repair_cost: 12000,
    saved_early_intervention: 0,
    photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=800',
    assigned_crew: 'Unassigned'
  }
];

async function postIncident(incident) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(incident);
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/incidents/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[+] Successfully generated incident: ${incident.title}`);
          resolve(body);
        } else {
          console.error(`[-] Failed to generate incident. Status: ${res.statusCode} - ${body}`);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`[-] Error connecting to backend (is FastAPI running?): ${error.message}`);
      resolve(null);
    });

    req.write(data);
    req.end();
  });
}

async function runLoop() {
  console.log('Starting Live Telemetry Simulator (Looping 3 times, every 6 seconds)...\n');
  console.log('NOTE: Open the application in your browser. You should see these incidents pop up automatically due to the 5-second React Query polling.\n');

  for (let i = 0; i < 3; i++) {
    console.log(`\n--- Loop Iteration ${i + 1} / 3 ---`);
    await postIncident(sampleIncidents[i % sampleIncidents.length]);
    
    if (i < 2) {
      console.log('Waiting 6 seconds before next dispatch...\n');
      await new Promise(r => setTimeout(r, 6000));
    }
  }

  console.log('\nSimulation complete!');
}

runLoop();
