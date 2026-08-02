from fastapi import APIRouter, Query
from typing import Optional
from app.services.gis_service import GISService

router = APIRouter(prefix="/gis", tags=["GIS & Smart City Intelligence"])

@router.get("/intelligence")
def get_full_gis_intelligence(
    lat: float = Query(..., description="Latitude of selected incident"),
    lng: float = Query(..., description="Longitude of selected incident"),
    incident_type: Optional[str] = Query("pothole"),
    severity: Optional[str] = Query("high"),
    ward_name: Optional[str] = Query("")
):
    """
    Returns complete integrated Smart City Intelligence payload for incident coordinates.
    Includes discoverable Nearby Infrastructure, Live Weather, Traffic Congestion, and Explainable AI Risk.
    """
    return GISService.get_full_intelligence(
        lat=lat,
        lng=lng,
        incident_type=incident_type,
        severity=severity,
        ward_name=ward_name
    )

@router.get("/infrastructure")
def get_nearby_infrastructure(
    lat: float = Query(...),
    lng: float = Query(...)
):
    return GISService.get_nearby_infrastructure(lat, lng)

@router.get("/weather")
def get_live_weather(
    lat: float = Query(...),
    lng: float = Query(...)
):
    return GISService.get_live_weather(lat, lng)

@router.get("/traffic")
def get_traffic_intelligence(
    lat: float = Query(...),
    lng: float = Query(...)
):
    return GISService.get_traffic_intelligence(lat, lng)

@router.get("/risk")
def get_xai_risk(
    lat: float = Query(...),
    lng: float = Query(...),
    incident_type: Optional[str] = Query("pothole"),
    severity: Optional[str] = Query("high"),
    ward_name: Optional[str] = Query("")
):
    return GISService.calculate_xai_risk(lat, lng, incident_type, severity, ward_name)
