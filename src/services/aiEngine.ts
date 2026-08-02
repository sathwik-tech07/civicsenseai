import type { Incident, IncidentType, IncidentSeverity, XAIFactors, SmartResourceRecommendation } from '../types';

export class AIEngine {
  /**
   * Calculates the Explainable AI (XAI) Priority Score (0 - 100)
   * based on mathematical weights for hospital proximity, traffic, severity, duplicate count, etc.
   */
  static calculatePriorityScore(params: {
    severity: IncidentSeverity;
    hospitalProximityMeters: number;
    roadClassification: string;
    duplicateCount: number;
    dailyTraffic: number;
    cvConfidence: number;
  }): { score: number; factors: XAIFactors } {
    let score = 30; // base score

    // 1. Severity weight
    if (params.severity === 'critical') score += 30;
    else if (params.severity === 'high') score += 20;
    else if (params.severity === 'medium') score += 10;
    else score += 5;

    // 2. Hospital / Emergency proximity weight
    if (params.hospitalProximityMeters <= 150) {
      score += 22; // High priority boost for hospital corridor!
    } else if (params.hospitalProximityMeters <= 500) {
      score += 12;
    } else if (params.hospitalProximityMeters <= 1000) {
      score += 6;
    }

    // 3. Road Classification weight
    if (params.roadClassification.toLowerCase().includes('arterial') || params.roadClassification.toLowerCase().includes('emergency')) {
      score += 15;
    } else if (params.roadClassification.toLowerCase().includes('collector') || params.roadClassification.toLowerCase().includes('commercial')) {
      score += 10;
    } else {
      score += 5;
    }

    // 4. Duplicate complaint volume weight
    const duplicateBonus = Math.min(15, params.duplicateCount * 1.2);
    score += duplicateBonus;

    // 5. Daily traffic volume weight
    if (params.dailyTraffic >= 15000) {
      score += 12;
    } else if (params.dailyTraffic >= 10000) {
      score += 8;
    } else if (params.dailyTraffic >= 5000) {
      score += 4;
    }

    // Cap score at 99
    const finalScore = Math.min(99, Math.round(score));

    const factors: XAIFactors = {
      cvConfidence: params.cvConfidence,
      cvModel: 'YOLOv11x Defect Segmenter & RT-DETR',
      hospitalProximityMeters: params.hospitalProximityMeters,
      hospitalName: params.hospitalProximityMeters <= 200 ? 'City General Government Hospital' : 'District Specialty Health Center',
      roadClassification: params.roadClassification,
      duplicateComplaintsCount: params.duplicateCount,
      estimatedDailyTraffic: params.dailyTraffic,
      historicalFailureRate: Math.min(95, Math.max(40, Math.round(finalScore * 0.85))),
      weatherRiskFactor: 'High Vulnerability to Monsoon Rainfall Surface Damage',
    };

    return { score: finalScore, factors };
  }

  /**
   * Computer Vision Image Analysis Simulation (YOLOv11 + SAM)
   */
  static analyzeImage(_fileOrUrl: string, typeHint?: IncidentType): {
    detectedType: IncidentType;
    confidence: number;
    severity: IncidentSeverity;
    boundingBox: { x: number; y: number; width: number; height: number; label: string };
    detectedFeatures: string[];
  } {
    const type = typeHint || 'pothole';
    const confidence = parseFloat((95 + Math.random() * 4.5).toFixed(1));

    let severity: IncidentSeverity = 'high';
    let features: string[] = [];
    let boxLabel = '';

    switch (type) {
      case 'pothole':
        severity = 'critical';
        features = ['Pothole Depth > 18cm', 'Edge Crack Propagation', 'Sub-base Aggregate Displacement'];
        boxLabel = `Pothole Defect [YOLOv11: ${confidence}%]`;
        break;
      case 'garbage':
        severity = 'medium';
        features = ['Unsorted Organic Waste', 'Sidewalk Encroachment', 'Vector Attraction Risk'];
        boxLabel = `Garbage Overflow [YOLOv11: ${confidence}%]`;
        break;
      case 'drainage':
        severity = 'high';
        features = ['Stormwater Channel Clogging', 'Silt Accumulation > 60%', 'Backwater Risk'];
        boxLabel = `Drain Blockage [RT-DETR: ${confidence}%]`;
        break;
      case 'water_leak':
        severity = 'critical';
        features = ['Main Pressure Release', 'Road Surface Erosion', 'Subsurface Cavity Risk'];
        boxLabel = `Water Pipe Burst [SAM: ${confidence}%]`;
        break;
      case 'streetlight':
        severity = 'low';
        features = ['No Luminance Output', 'Physical Fixture Intact', 'Circuit Breaker Fault'];
        boxLabel = `Outage Fixture [Vision AI: ${confidence}%]`;
        break;
      default:
        severity = 'high';
        features = ['Structural Anomaly', 'Public Safety Hazard'];
        boxLabel = `Defect Detected [YOLOv11: ${confidence}%]`;
    }

    return {
      detectedType: type,
      confidence,
      severity,
      boundingBox: { x: 22, y: 28, width: 56, height: 48, label: boxLabel },
      detectedFeatures: features,
    };
  }

  /**
   * Multilingual Speech-to-Text & Intent Extraction (Whisper Model Simulation)
   */
  static parseVoiceCommand(transcript: string, language: string = 'en'): {
    extractedType: IncidentType;
    extractedLocation: string;
    extractedSeverity: IncidentSeverity;
    summary: string;
  } {
    const lower = transcript.toLowerCase();
    let extractedType: IncidentType = 'pothole';

    if (lower.includes('garbage') || lower.includes('trash') || lower.includes(' कचरा ') || lower.includes('कचरा')) {
      extractedType = 'garbage';
    } else if (lower.includes('drain') || lower.includes('water overflow') || lower.includes('नाली')) {
      extractedType = 'drainage';
    } else if (lower.includes('pipe') || lower.includes('leak') || lower.includes('पानी')) {
      extractedType = 'water_leak';
    } else if (lower.includes('light') || lower.includes('dark') || lower.includes('लाइट')) {
      extractedType = 'streetlight';
    } else if (lower.includes('collapse') || lower.includes('sinkhole')) {
      extractedType = 'road_collapse';
    }

    let extractedLocation = 'Victoria Road, Near Hospital Stand';
    if (lower.includes('bus stand')) extractedLocation = 'Central Bus Stand Junction';
    if (lower.includes('market')) extractedLocation = 'Heritage Market Square';
    if (lower.includes('station')) extractedLocation = 'Metro Railway Station Gate 2';

    return {
      extractedType,
      extractedLocation,
      extractedSeverity: extractedType === 'pothole' || extractedType === 'road_collapse' ? 'critical' : 'high',
      summary: `Voice report parsed [${language.toUpperCase()}]: ${transcript}`,
    };
  }

  /**
   * Smart Budget & Resource Optimization Allocator
   */
  static optimizeResourceAllocation(incident: Incident): SmartResourceRecommendation {
    const isCritical = incident.severity === 'critical';
    
    const repairCost = incident.estimatedRepairCost || (isCritical ? 4800 : 1800);
    const earlySavings = incident.savedEarlyIntervention || (repairCost * 4.5);

    let crewName = 'Rapid Asphalt Response Team Alpha';
    let vehicleName = 'Heavy Asphalt Milling & Paver #04';
    let equipmentNeeded = ['Infrared Surface Recycler', 'Vibratory Asphalt Roller', 'Traffic Cones & Laser Level'];
    let materialsRequired = 'Hot Mix Asphalt (HMA-Grade 3) - 1.8 Tons';

    if (incident.type === 'drainage') {
      crewName = 'Hydraulic Drain De-silting Unit #2';
      vehicleName = 'Suction Vacuum Jetting Truck #09';
      equipmentNeeded = ['High-Pressure Hydro Jetter', 'Heavy De-sludging Submersible Pump'];
      materialsRequired = 'Pre-cast Concrete Drain Slab Liners - 4 Units';
    } else if (incident.type === 'garbage') {
      crewName = 'Sanitation Logistics Crew C';
      vehicleName = 'Compactor Waste Carrier #14';
      equipmentNeeded = ['Hydraulic Bin Lifter', 'Industrial Disinfectant Fogger'];
      materialsRequired = 'Bio-Enzymatic Deodorizer Spray - 50 Liters';
    } else if (incident.type === 'water_leak') {
      crewName = 'Water Works Emergency Squad';
      vehicleName = 'Excavator & Trenching Rig #01';
      equipmentNeeded = ['Acoustic Leak Detector', 'Electrofusion Pipe Welder'];
      materialsRequired = 'Ductile Iron Pipe 600mm - 12 Meters';
    }

    return {
      incidentId: incident.id,
      crewName,
      vehicleName,
      equipmentNeeded,
      materialsRequired,
      priorityDispatchRoute: `Hospital Emergency Bypass -> ${incident.address}`,
      estimatedLaborHours: isCritical ? 4 : 2,
      estimatedTotalCost: repairCost,
      earlyInterventionSavings: earlySavings,
    };
  }

  /**
   * Predictive Maintenance Risk Engine (XGBoost / LightGBM Simulation)
   */
  static calculatePredictiveRisk(params: {
    roadAgeYears: number;
    heavyTrafficVolume: number;
    rainfallForecastMm: number;
    pastRepairs: number;
  }): { probabilityScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; estimatedCost: number; savings: number } {
    let score = (params.roadAgeYears * 5.5) + (params.heavyTrafficVolume / 500) + (params.rainfallForecastMm * 0.4) + (params.pastRepairs * 3);
    score = Math.min(98, Math.max(15, Math.round(score)));

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
    if (score >= 85) riskLevel = 'CRITICAL';
    else if (score >= 70) riskLevel = 'HIGH';
    else if (score >= 45) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    const estimatedCost = Math.round(score * 215);
    const savings = Math.round(estimatedCost * 4.8);

    return {
      probabilityScore: score,
      riskLevel,
      estimatedCost,
      savings,
    };
  }
}
