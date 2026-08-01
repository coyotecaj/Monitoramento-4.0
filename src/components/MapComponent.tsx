import { useState, useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary, MapControl, ControlPosition } from '@vis.gl/react-google-maps';
import L from 'leaflet';
import { Vehicle, Geofence, Coordinate, Trip } from '../types';
import { copyCoordinates } from '../utils/clipboard';
import { Flag, Droplet, Building2, Fuel, MapPin, Package, Navigation, CheckCircle2, Bell, Play, AlertTriangle, ExternalLink, Layers, RefreshCw, Megaphone } from 'lucide-react';

export const PRECONFIGURED_GOOGLE_MAPS_KEY = 'AIzaSyCoM-MbWKq5gsf0pWgcc6Cj4BShCslqXcE';

// Detect fallback Google Maps API Key from environment variables
const getEnvApiKey = () => {
  const env = (import.meta as any).env || {};
  return (
    env.VITE_GOOGLE_MAPS_API_KEY ||
    env.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    env.VITE_GOOGLE_MAPS_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_API_KEY ||
    PRECONFIGURED_GOOGLE_MAPS_KEY
  );
};

// Compact modern high-tech map style
const DARK_MAP_STYLE = [
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#74869a' }] },
  { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#0b111e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#162030' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] }
];

// ---------------------------------------------------------
// Custom Map Circle Component
// ---------------------------------------------------------
interface CircleProps extends google.maps.CircleOptions {
  center: google.maps.LatLngLiteral;
  radius: number;
  onClick?: () => void;
}

function MapCircle({ center, radius, onClick, ...options }: CircleProps) {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map) return;

    const circle = new google.maps.Circle({
      map,
      center,
      radius,
      ...options,
    });

    circleRef.current = circle;

    let clickListener: google.maps.MapsEventListener | null = null;
    if (onClick) {
      clickListener = circle.addListener('click', () => {
        onClick();
      });
    }

    return () => {
      if (clickListener) {
        clickListener.remove();
      }
      circle.setMap(null);
    };
  }, [map]);

  // Update circle values reactively without redrawing
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setCenter(center);
    }
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setOptions(options);
    }
  }, [options.strokeColor, options.fillColor, options.strokeWeight, options.fillOpacity]);

  return null;
}

// ---------------------------------------------------------
// Custom Map Polygon Component
// ---------------------------------------------------------
interface MapPolygonProps {
  paths: google.maps.LatLngLiteral[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  fillColor?: string;
  fillOpacity?: number;
  onClick?: () => void;
}

function MapPolygon({ paths, strokeColor = '#0ea5e9', strokeOpacity = 0.8, strokeWeight = 2, fillColor = '#0ea5e9', fillOpacity = 0.2, onClick }: MapPolygonProps) {
  const map = useMap();
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map) return;

    const polygon = new google.maps.Polygon({
      map,
      paths,
      strokeColor,
      strokeOpacity,
      strokeWeight,
      fillColor,
      fillOpacity,
    });

    polygonRef.current = polygon;

    let clickListener: google.maps.MapsEventListener | null = null;
    if (onClick) {
      clickListener = polygon.addListener('click', () => {
        onClick();
      });
    }

    return () => {
      if (clickListener) {
        clickListener.remove();
      }
      polygon.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    if (polygonRef.current) {
      polygonRef.current.setPaths(paths);
    }
  }, [paths]);

  useEffect(() => {
    if (polygonRef.current) {
      polygonRef.current.setOptions({ strokeColor, strokeOpacity, strokeWeight, fillColor, fillOpacity });
    }
  }, [strokeColor, strokeOpacity, strokeWeight, fillColor, fillOpacity]);

  return null;
}

// ---------------------------------------------------------
// Custom Map Polyline Component
// ---------------------------------------------------------
function MapPolyline({ path, strokeColor = '#0ea5e9', strokeWeight = 4, strokeOpacity = 0.8, animated = false }: {
  path: google.maps.LatLngLiteral[];
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
  animated?: boolean;
}) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;

    const polylineOptions: google.maps.PolylineOptions = {
      map,
      path,
      strokeColor,
      strokeWeight,
      strokeOpacity,
    };

    if (animated) {
      polylineOptions.icons = [
        {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 3.5,
            fillColor: strokeColor,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
          },
          offset: '0px',
          repeat: '40px',
        }
      ];
    }

    const polyline = new google.maps.Polyline(polylineOptions);
    polylineRef.current = polyline;

    let animationFrameId: number;
    let count = 0;

    if (animated) {
      const animate = () => {
        count = (count + 1.2) % 40;
        const icons = polyline.get('icons');
        if (icons && icons[0]) {
          icons[0].offset = count + 'px';
          polyline.set('icons', icons);
        }
        animationFrameId = requestAnimationFrame(animate);
      };
      
      const timeoutId = setTimeout(animate, 100);

      return () => {
        clearTimeout(timeoutId);
        cancelAnimationFrame(animationFrameId);
        polyline.setMap(null);
      };
    }

    return () => {
      polyline.setMap(null);
    };
  }, [map, strokeColor, strokeWeight, strokeOpacity, animated]);

  useEffect(() => {
    if (polylineRef.current) {
      polylineRef.current.setPath(path);
    }
  }, [path]);

  return null;
}

// ---------------------------------------------------------
// Custom Map Street-Following Polyline Component
// ---------------------------------------------------------
function StreetRoute({ path, strokeColor = "#38bdf8", strokeWeight = 5, animated = false }: { 
  path: google.maps.LatLngLiteral[];
  strokeColor?: string;
  strokeWeight?: number;
  animated?: boolean;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const [streetPath, setStreetPath] = useState<google.maps.LatLngLiteral[]>([]);
  const prevPathRef = useRef<google.maps.LatLngLiteral[]>([]);

  useEffect(() => {
    if (!map || !routesLib || path.length < 2) {
      setStreetPath(path);
      return;
    }

    // Check if path actually changed (deep comparison of lat/lng)
    const isSame = path.length === prevPathRef.current.length && path.every((pt, i) => 
      pt.lat === prevPathRef.current[i].lat && pt.lng === prevPathRef.current[i].lng
    );
    if (isSame && streetPath.length > 0) return;
    prevPathRef.current = path;

    const directionsService = new google.maps.DirectionsService();
    const origin = path[0];
    const destination = path[path.length - 1];
    
    // Downsample intermediate coordinates to at most 20 waypoints to respect Google Maps limit (max 25 waypoints)
    let rawWaypoints = path.slice(1, -1);
    if (rawWaypoints.length > 20) {
      const sampled: google.maps.LatLngLiteral[] = [];
      const step = (rawWaypoints.length - 1) / 19;
      for (let i = 0; i < 20; i++) {
        const idx = Math.round(i * step);
        if (rawWaypoints[idx]) {
          sampled.push(rawWaypoints[idx]);
        }
      }
      rawWaypoints = sampled;
    }

    const waypoints = rawWaypoints.map(pt => ({
      location: new google.maps.LatLng(pt.lat, pt.lng),
      stopover: false
    }));

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result && result.routes[0]) {
          const route = result.routes[0];
          const pts: google.maps.LatLngLiteral[] = [];
          
          // Use high-resolution step paths for perfect road snapping at high zoom levels
          if (route.legs && route.legs.length > 0) {
            route.legs.forEach(leg => {
              if (leg.steps && leg.steps.length > 0) {
                leg.steps.forEach(step => {
                  if (step.path && step.path.length > 0) {
                    step.path.forEach(latLng => {
                      const last = pts[pts.length - 1];
                      if (!last || Math.abs(last.lat - latLng.lat()) > 0.00001 || Math.abs(last.lng - latLng.lng()) > 0.00001) {
                        pts.push({ lat: latLng.lat(), lng: latLng.lng() });
                      }
                    });
                  }
                });
              }
            });
          }

          // Fallback to overview_path if detailed path is somehow empty
          if (pts.length === 0 && route.overview_path) {
            route.overview_path.forEach(latLng => {
              pts.push({ lat: latLng.lat(), lng: latLng.lng() });
            });
          }

          setStreetPath(pts);
        } else {
          console.warn("Directions request failed with status:", status);
          // Fallback to direct lines if Route computation fails
          setStreetPath(path);
        }
      }
    );
  }, [map, routesLib, path]);

  if (streetPath.length === 0) return null;

  return (
    <MapPolyline 
      path={streetPath} 
      strokeColor={strokeColor} 
      strokeWeight={strokeWeight} 
      strokeOpacity={0.9} 
      animated={animated}
    />
  );
}

// ---------------------------------------------------------
// Map Controller for Centering, Alert Zooming & Position Restoring
// ---------------------------------------------------------
function MapController({
  vehicles,
  selectedVehicle,
  selectedGeofence,
  autoCenter,
  activeTripRoute,
  activeAlert,
}: {
  vehicles: Vehicle[];
  selectedVehicle?: Vehicle | null;
  selectedGeofence?: Geofence | null;
  autoCenter: boolean;
  activeTripRoute?: Coordinate[];
  activeAlert?: {
    id: string;
    time: string;
    message: string;
    type: 'near' | 'inside' | 'exit' | 'maintenance' | 'announcement';
    plate: string;
  } | null;
}) {
  const map = useMap();
  const lastTargetIdRef = useRef<string | null>(null);

  // Save previous map state before selecting a vehicle
  const previousCenterRef = useRef<google.maps.LatLng | null>(null);
  const previousZoomRef = useRef<number | null>(null);

  // Save previous map state before an alert zoom
  const alertPreCenterRef = useRef<google.maps.LatLng | null>(null);
  const alertPreZoomRef = useRef<number | null>(null);
  const lastAlertIdRef = useRef<string | null>(null);

  // 1. Alert Zoom & Restore Logic
  useEffect(() => {
    if (!map) return;

    if (activeAlert) {
      if (activeAlert.id !== lastAlertIdRef.current) {
        lastAlertIdRef.current = activeAlert.id;

        // Save map position prior to alert zoom if not already saved
        if (!alertPreCenterRef.current) {
          alertPreCenterRef.current = map.getCenter() || null;
          alertPreZoomRef.current = map.getZoom() ?? null;
        }

        // Clean plate for matching (e.g. "SFC1A91" or "SFC 1A91")
        const alertPlateClean = activeAlert.plate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        // Find vehicle corresponding to alert
        const alertVehicle = vehicles.find(v => 
          v.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === alertPlateClean
        );

        if (alertVehicle) {
          map.panTo({ lat: alertVehicle.currentLatitude, lng: alertVehicle.currentLongitude });
          map.setZoom(16);
        }
      }
    } else {
      // Alert dismissed or ended - restore previous position
      if (lastAlertIdRef.current) {
        lastAlertIdRef.current = null;
        if (alertPreCenterRef.current && alertPreZoomRef.current !== null) {
          map.panTo(alertPreCenterRef.current);
          map.setZoom(alertPreZoomRef.current);
          alertPreCenterRef.current = null;
          alertPreZoomRef.current = null;
        }
      }
    }
  }, [map, activeAlert, vehicles]);

  // 2. Selected Vehicle / Geofence Panning & Restore Logic
  useEffect(() => {
    if (!map) return;

    // Do not override if an alert is currently active
    if (activeAlert) return;

    const currentTargetId = selectedVehicle 
      ? `v-${selectedVehicle.id}` 
      : (selectedGeofence ? `g-${selectedGeofence.id}` : null);

    const targetChanged = currentTargetId !== lastTargetIdRef.current;
    
    // Save or restore position when selected vehicle changes
    if (targetChanged) {
      if (selectedVehicle) {
        // Save map center/zoom before focusing on selected vehicle
        if (!previousCenterRef.current) {
          previousCenterRef.current = map.getCenter() || null;
          previousZoomRef.current = map.getZoom() ?? null;
        }
      } else {
        // Restoring state if vehicle deselected and we had a saved state
        if (!selectedGeofence && previousCenterRef.current && previousZoomRef.current !== null) {
          map.panTo(previousCenterRef.current);
          map.setZoom(previousZoomRef.current);
          previousCenterRef.current = null;
          previousZoomRef.current = null;
        }
      }
      lastTargetIdRef.current = currentTargetId;
    }

    if (autoCenter || targetChanged) {
      if (selectedVehicle) {
        map.panTo({ lat: selectedVehicle.currentLatitude, lng: selectedVehicle.currentLongitude });
        if (targetChanged) {
          map.setZoom(16);
        }
      } else if (selectedGeofence) {
        map.panTo({ lat: selectedGeofence.latitude, lng: selectedGeofence.longitude });
        if (targetChanged) {
          map.setZoom(14);
        }
      }
    }
  }, [map, selectedVehicle, selectedGeofence, autoCenter, activeAlert]);

  return null;
}

// ---------------------------------------------------------
// Leaflet OpenStreetMap Fallback Component
// ---------------------------------------------------------
function LeafletFallbackMap({
  vehicles,
  geofences,
  activeTripRoute,
  selectedVehicle,
  selectedGeofence,
  onMapClick,
  onSelectGeofence,
  interactive = false,
  drawingPolygonPoints
}: MapComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let map = mapRef.current;
    if (!map) {
      map = L.map(containerRef.current, {
        center: [-24.1000, -48.1000],
        zoom: 7,
        zoomControl: true
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
    }

    // Remove existing layers
    map.eachLayer(layer => {
      if ((layer as any)._url === undefined) {
        map.removeLayer(layer);
      }
    });

    // Add Geofences
    geofences.forEach(gf => {
      const color = gf.type === 'ORIGIN' ? '#10b981' : gf.type === 'DESTINATION' ? '#3b82f6' : '#f59e0b';
      let layer: L.Layer;

      if (gf.shapeType === 'POLYGON' && gf.polygonCoordinates && gf.polygonCoordinates.length >= 3) {
        layer = L.polygon(gf.polygonCoordinates.map(c => [c.latitude, c.longitude]), {
          color: color,
          fillColor: color,
          fillOpacity: 0.25,
          weight: 2
        }).addTo(map);
      } else {
        layer = L.circle([gf.latitude, gf.longitude], {
          radius: gf.radius,
          color: color,
          fillColor: color,
          fillOpacity: 0.25,
          weight: 2
        }).addTo(map);
      }

      layer.bindPopup(`
        <div style="font-family: sans-serif; font-size: 11px; padding: 2px;">
          <b style="font-size: 12px; color: #0284c7;">📍 ${gf.name}</b><br/>
          <b>Tipo:</b> ${gf.type === 'ORIGIN' ? 'Origem (Carregamento)' : gf.type === 'DESTINATION' ? 'Destino (Descarregamento)' : 'Ponto de Controle'}<br/>
          <b>Formato:</b> ${gf.shapeType === 'POLYGON' ? 'Polígono Livre' : `Circular (${gf.radius}m)`}
        </div>
      `);

      if (onSelectGeofence) {
        layer.on('click', () => onSelectGeofence(gf));
      }
    });

    // Drawing polygon preview in Leaflet
    if (drawingPolygonPoints && drawingPolygonPoints.length > 0) {
      if (drawingPolygonPoints.length >= 3) {
        L.polygon(drawingPolygonPoints.map(c => [c.latitude, c.longitude]), {
          color: '#38bdf8',
          fillColor: '#0284c7',
          fillOpacity: 0.3,
          weight: 3
        }).addTo(map);
      } else {
        L.polyline(drawingPolygonPoints.map(c => [c.latitude, c.longitude]), {
          color: '#38bdf8',
          weight: 3
        }).addTo(map);
      }
      drawingPolygonPoints.forEach((pt, idx) => {
        L.circleMarker([pt.latitude, pt.longitude], {
          radius: 6,
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.9,
          weight: 2
        }).addTo(map).bindTooltip(`Vértice ${idx + 1}`, { permanent: true, direction: 'top' });
      });
    }

    // Add Vehicles
    vehicles.forEach(v => {
      const color = v.status === 'MAINTENANCE' ? '#facc15' : v.speed > 0 ? '#10b981' : '#ef4444';
      const marker = L.circleMarker([v.currentLatitude, v.currentLongitude], {
        radius: 10,
        color: '#020617',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 11px; padding: 2px;">
          <b style="font-size: 12px; color: #0284c7;">🚛 ${v.licensePlate}</b><br/>
          <b>Modelo:</b> ${v.model}<br/>
          <b>Velocidade:</b> ${v.speed} km/h<br/>
          <b>Motorista:</b> ${v.driverName || 'Não informado'}<br/>
          <b>Status:</b> ${v.status === 'AVAILABLE' ? 'DISPONÍVEL' : v.status === 'EN_ROUTE' ? 'EM VIAGEM' : v.status === 'MAINTENANCE' ? 'EM MANUTENÇÃO' : v.status}
        </div>
      `);
    });

    // Active Route Polyline
    if (activeTripRoute && activeTripRoute.length >= 2) {
      const coords: [number, number][] = activeTripRoute.map(r => [r.latitude, r.longitude]);
      const polyline = L.polyline(coords, { color: '#0ea5e9', weight: 4, opacity: 0.85 }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    } else if (selectedVehicle) {
      map.setView([selectedVehicle.currentLatitude, selectedVehicle.currentLongitude], 14, { animate: true });
    } else if (selectedGeofence) {
      map.setView([selectedGeofence.latitude, selectedGeofence.longitude], 13, { animate: true });
    }

    if (interactive && onMapClick) {
      map.off('click');
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }
  }, [vehicles, geofences, activeTripRoute, selectedVehicle, selectedGeofence, interactive, onMapClick, onSelectGeofence, drawingPolygonPoints]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full min-h-[350px] rounded-xl overflow-hidden" />;
}

// ---------------------------------------------------------
// Main MapComponent
// ---------------------------------------------------------
interface MapComponentProps {
  vehicles: Vehicle[];
  geofences: Geofence[];
  trips?: Trip[];
  selectedVehicle?: Vehicle | null;
  selectedGeofence?: Geofence | null;
  activeTripRoute?: Coordinate[];
  activeTripDestination?: Coordinate;
  activeTripVehicle?: Vehicle;
  onMapClick?: (lat: number, lng: number) => void;
  onSelectGeofence?: (geofence: Geofence | null) => void;
  onGeofenceDragEnd?: (id: string, lat: number, lng: number) => void;
  interactive?: boolean;
  drawingPolygonPoints?: Coordinate[];
  isDrawingPolygon?: boolean;
}

export default function MapComponent({
  vehicles,
  geofences,
  trips = [],
  selectedVehicle,
  selectedGeofence,
  activeTripRoute,
  activeTripDestination,
  activeTripVehicle,
  onMapClick,
  onSelectGeofence,
  onGeofenceDragEnd,
  interactive = false,
  drawingPolygonPoints,
  isDrawingPolygon = false,
}: MapComponentProps) {
  const [isMapsActive, setIsMapsActive] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('google_maps_active') === 'true' : false;
  });
  const [mapsKey, setMapsKey] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('google_maps_api_key') : '';
    return saved || getEnvApiKey();
  });
  const [mapError, setMapError] = useState<string | null>(null);
  const [useFallbackMap, setUseFallbackMap] = useState<boolean>(false);

  useEffect(() => {
    // Listen for Google Maps authentication, key, or billing failures
    const handleGmAuthFailure = () => {
      console.warn("Google Maps auth/key/billing failure detected via gm_authFailure");
      setMapError("InvalidKeyMapError");
      setUseFallbackMap(true);
    };

    const handleWindowError = (event: ErrorEvent) => {
      const msg = event.message || '';
      if (msg.includes('InvalidKeyMapError')) {
        setMapError('InvalidKeyMapError');
        setUseFallbackMap(true);
      } else if (msg.includes('BillingNotEnabledMapError')) {
        setMapError('BillingNotEnabledMapError');
        setUseFallbackMap(true);
      } else if (msg.includes('Google Maps JavaScript API error')) {
        setMapError('GoogleMapsApiError');
        setUseFallbackMap(true);
      }
    };

    (window as any).gm_authFailure = handleGmAuthFailure;
    window.addEventListener('error', handleWindowError);

    return () => {
      if ((window as any).gm_authFailure === handleGmAuthFailure) {
        delete (window as any).gm_authFailure;
      }
      window.removeEventListener('error', handleWindowError);
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const active = localStorage.getItem('google_maps_active') === 'true';
      const saved = localStorage.getItem('google_maps_api_key') || '';
      setIsMapsActive(active);
      setMapsKey(saved || getEnvApiKey());
    };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const hasValidKey = Boolean(mapsKey) && mapsKey !== 'YOUR_API_KEY' && mapsKey.trim() !== '';

  const [clickedPos, setClickedPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [infoWindowVehicle, setInfoWindowVehicle] = useState<Vehicle | null>(null);
  const [infoWindowGeofence, setInfoWindowGeofence] = useState<Geofence | null>(null);
  const [localSelectedGeofence, setLocalSelectedGeofence] = useState<Geofence | null>(null);

  const activeSelectedGeofence = selectedGeofence !== undefined ? selectedGeofence : localSelectedGeofence;

  const [autoCenter, setAutoCenter] = useState(true);

  const [activeAlert, setActiveAlert] = useState<{
    id: string;
    time: string;
    message: string;
    type: 'near' | 'inside' | 'exit' | 'maintenance' | 'announcement';
    plate: string;
  } | null>(null);

  useEffect(() => {
    const handleActiveAlertChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveAlert(customEvent.detail);
    };

    window.addEventListener('active-voice-alert-change', handleActiveAlertChange);
    
    // Request current active alert state on mount
    window.dispatchEvent(new CustomEvent('request-active-voice-alert'));

    return () => {
      window.removeEventListener('active-voice-alert-change', handleActiveAlertChange);
    };
  }, []);

  const handleDismissAlert = () => {
    window.dispatchEvent(new CustomEvent('dismiss-active-voice-alert'));
    setActiveAlert(null);
  };

  const handleRepeatAlert = (msg: string) => {
    window.dispatchEvent(new CustomEvent('repeat-active-voice-alert', { detail: { message: msg } }));
  };

  // Track coordinates selection on map click
  const handleMapClickInternal = (e: any) => {
    if (!interactive || !onMapClick) return;
    const lat = e.detail.latLng?.lat;
    const lng = e.detail.latLng?.lng;
    if (lat !== undefined && lng !== undefined) {
      onMapClick(lat, lng);
      setClickedPos({ lat, lng });
      copyCoordinates(lat, lng, 'Ponto no Mapa');
    }
  };

  const handleGeofenceClick = (gf: Geofence) => {
    setInfoWindowGeofence(gf);
    setInfoWindowVehicle(null);
    if (onSelectGeofence) {
      onSelectGeofence(gf);
    } else {
      setLocalSelectedGeofence(gf === localSelectedGeofence ? null : gf);
    }
  };

  const handleVehicleClick = (v: Vehicle) => {
    userClosedVehicleIdRef.current = null;
    setInfoWindowVehicle(v);
    setInfoWindowGeofence(null);
  };

  // Track selected vehicle id and whether user manually closed its InfoWindow
  const prevSelectedVehicleIdRef = useRef<string | null>(null);
  const userClosedVehicleIdRef = useRef<string | null>(null);

  // Automatically open InfoWindow when a vehicle is selected from the list, or clear it if none selected
  useEffect(() => {
    const currentId = selectedVehicle?.id || null;
    if (currentId !== prevSelectedVehicleIdRef.current) {
      // Vehicle selection changed
      prevSelectedVehicleIdRef.current = currentId;
      userClosedVehicleIdRef.current = null;
      if (selectedVehicle) {
        setInfoWindowVehicle(selectedVehicle);
        setInfoWindowGeofence(null);
      } else {
        setInfoWindowVehicle(null);
      }
    } else if (selectedVehicle) {
      // Same vehicle, e.g. telemetry tick or re-render
      if (userClosedVehicleIdRef.current === selectedVehicle.id) {
        // User explicitly closed this info window; keep it closed!
      } else {
        // Keep updated telemetry data inside InfoWindow if it's currently open
        setInfoWindowVehicle(prev => prev ? selectedVehicle : null);
      }
    } else {
      setInfoWindowVehicle(null);
    }
  }, [selectedVehicle]);

  const vehiclesToRender = vehicles;

  // 1. Render Splash screen if Google Maps API Key is missing
  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center min-h-[350px] w-full h-full bg-[#0a0e1a] border border-[#1f2d45] rounded-xl text-slate-300 p-6">
        <div className="text-center max-w-md space-y-4">
          <div className="w-12 h-12 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider">Chave do Google Maps Necessária</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Para ativar o mapa em tempo real por satélite e geolocalização de precisão, insira sua chave do Google Maps.
          </p>
          <div className="text-left bg-[#111827] border border-[#1f2d45] rounded-lg p-3.5 space-y-2 text-[11px] leading-relaxed">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <span className="w-4 h-4 bg-sky-500/10 border border-sky-500/30 rounded-full flex items-center justify-center text-[10px] text-sky-400">1</span>
              <span>Inserir chave diretamente no painel:</span>
            </p>
            <p className="text-slate-400 pl-5">
              Vá para a aba de <strong>Configurações</strong> e insira sua chave do Google Maps na seção correspondente.
            </p>
            
            <p className="font-semibold text-white flex items-center gap-1.5 pt-1.5">
              <span className="w-4 h-4 bg-sky-500/10 border border-sky-500/30 rounded-full flex items-center justify-center text-[10px] text-sky-400">2</span>
              <span>Alternativa via Segredos do AI Studio:</span>
            </p>
            <p className="text-slate-400 pl-5 leading-relaxed">
              Você também pode adicionar uma variável de ambiente <code>GOOGLE_MAPS_PLATFORM_KEY</code> nas configurações do AI Studio (ícone de engrenagem no canto superior direito).
            </p>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            O mapa é ativado imediatamente após salvar a chave de API sem necessidade de recarregar.
          </p>
        </div>
      </div>
    );
  }

  // Determine active trip for full rotograma route path calculation
  const activeTripForRoute = (() => {
    if (selectedVehicle) {
      return trips.find(t => t.vehicleId === selectedVehicle.id && t.status !== 'DELIVERED');
    }
    if (activeTripVehicle) {
      return trips.find(t => t.vehicleId === activeTripVehicle.id && t.status !== 'DELIVERED');
    }
    return undefined;
  })();

  const { completedRoutePath, remainingRoutePath, fullRoutePath } = (() => {
    if (activeTripForRoute) {
      const originGf = geofences.find(g => g.id === (activeTripForRoute.originGeofenceId || (activeTripForRoute as any).originId));
      const destGf = geofences.find(g => g.id === (activeTripForRoute.destinationGeofenceId || (activeTripForRoute as any).destinationId));
      const v = vehicles.find(v => v.id === activeTripForRoute.vehicleId) || selectedVehicle || activeTripVehicle;

      const completedPts: google.maps.LatLngLiteral[] = [];
      const remainingPts: google.maps.LatLngLiteral[] = [];

      const isNotLoadedYet = activeTripForRoute.status === 'SCHEDULED' || activeTripForRoute.status === 'WAITING_LOADING';

      if (isNotLoadedYet) {
        // Driver hasn't loaded at origin yet -> Remaining route: Vehicle -> Origin -> Destination
        if (v) remainingPts.push({ lat: v.currentLatitude, lng: v.currentLongitude });
        if (originGf) remainingPts.push({ lat: originGf.latitude, lng: originGf.longitude });
        if (destGf) remainingPts.push({ lat: destGf.latitude, lng: destGf.longitude });
      } else {
        // Driver is loaded and en route or at destination
        // 1. Completed Path (Origin -> Current Vehicle Position)
        if (originGf) completedPts.push({ lat: originGf.latitude, lng: originGf.longitude });
        if (v) completedPts.push({ lat: v.currentLatitude, lng: v.currentLongitude });

        // 2. Remaining Path (Current Vehicle Position -> Destination)
        if (v) remainingPts.push({ lat: v.currentLatitude, lng: v.currentLongitude });
        if (destGf) remainingPts.push({ lat: destGf.latitude, lng: destGf.longitude });
      }

      const full = [...completedPts];
      remainingPts.forEach(pt => {
        const last = full[full.length - 1];
        if (!last || Math.abs(last.lat - pt.lat) > 0.0001 || Math.abs(last.lng - pt.lng) > 0.0001) {
          full.push(pt);
        }
      });

      return {
        completedRoutePath: completedPts.length >= 2 ? completedPts : [],
        remainingRoutePath: remainingPts.length >= 2 ? remainingPts : [],
        fullRoutePath: full
      };
    }

    // Fallback if activeTripForRoute not found but props are passed
    if (activeTripRoute && activeTripRoute.length > 0) {
      const pts = activeTripRoute.map(r => ({ lat: r.latitude, lng: r.longitude }));
      const remainingPts: google.maps.LatLngLiteral[] = [];

      if (pts.length > 0 && activeTripDestination) {
        const lastPt = pts[pts.length - 1];
        remainingPts.push(lastPt);
        remainingPts.push({ lat: activeTripDestination.latitude, lng: activeTripDestination.longitude });
      }

      return {
        completedRoutePath: pts.length >= 2 ? pts : [],
        remainingRoutePath: remainingPts.length >= 2 ? remainingPts : [],
        fullRoutePath: [...pts, ...(activeTripDestination ? [{ lat: activeTripDestination.latitude, lng: activeTripDestination.longitude }] : [])]
      };
    }

    return { completedRoutePath: [], remainingRoutePath: [], fullRoutePath: [] };
  })();

  return (
    <div className="relative w-full h-full min-h-[300px] border border-slate-800 rounded-xl bg-[#0a0e1a] flex flex-col overflow-hidden">
      <div className="flex-1 w-full h-full rounded-xl overflow-hidden shadow-2xl relative min-h-[350px]">
        {(!isMapsActive || useFallbackMap) ? (
          <LeafletFallbackMap
            vehicles={vehicles}
            geofences={geofences}
            trips={trips}
            selectedVehicle={selectedVehicle}
            selectedGeofence={selectedGeofence}
            activeTripRoute={fullRoutePath.map(p => ({ latitude: p.lat, longitude: p.lng }))}
            activeTripDestination={activeTripDestination}
            activeTripVehicle={activeTripVehicle}
            onMapClick={onMapClick}
            onSelectGeofence={onSelectGeofence}
            interactive={interactive}
            drawingPolygonPoints={drawingPolygonPoints}
          />
        ) : (
          <APIProvider apiKey={mapsKey} version="weekly">
          <Map
            defaultCenter={{ lat: -24.1000, lng: -48.1000 }}
            defaultZoom={7}
            mapId="DEMO_MAP_ID"
            onClick={handleMapClickInternal}
            onDragstart={() => setAutoCenter(false)}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
            gestureHandling="greedy"
            disableDefaultUI={false}
            styles={DARK_MAP_STYLE}
          >
            {/* Map Controller for transition panning */}
            <MapController
              vehicles={vehicles}
              selectedVehicle={selectedVehicle}
              selectedGeofence={activeSelectedGeofence}
              autoCenter={autoCenter}
              activeTripRoute={activeTripRoute}
              activeAlert={activeAlert}
            />

            {/* Render Click Pin for coordinate selection feedback */}
            {clickedPos && interactive && (
              <AdvancedMarker position={clickedPos}>
                <div className="relative flex items-center justify-center" style={{ width: '24px', height: '24px' }}>
                  <div className="absolute w-6 h-6 rounded-full bg-rose-500/30 border border-rose-500 animate-ping" />
                  <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow-md flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                </div>
              </AdvancedMarker>
            )}

            {/* Render completed route path (Origem -> Veículo) in Cyan */}
            {completedRoutePath.length >= 2 && (
              <StreetRoute path={completedRoutePath} strokeColor="#0ea5e9" strokeWeight={5} animated={true} />
            )}

            {/* Render remaining route path (Veículo -> Destino) in Orange */}
            {remainingRoutePath.length >= 2 && (
              <StreetRoute path={remainingRoutePath} strokeColor="#f97316" strokeWeight={5} animated={true} />
            )}

            {/* Render active polygon drawing preview */}
            {drawingPolygonPoints && drawingPolygonPoints.length > 0 && (
              <>
                {drawingPolygonPoints.length >= 3 ? (
                  <MapPolygon
                    paths={drawingPolygonPoints.map(c => ({ lat: c.latitude, lng: c.longitude }))}
                    strokeColor="#38bdf8"
                    strokeOpacity={0.9}
                    strokeWeight={3}
                    fillColor="#0284c7"
                    fillOpacity={0.25}
                  />
                ) : (
                  <MapPolyline
                    path={drawingPolygonPoints.map(c => ({ lat: c.latitude, lng: c.longitude }))}
                    strokeColor="#38bdf8"
                    strokeWeight={3}
                    strokeOpacity={0.9}
                  />
                )}

                {/* Render numbered vertex markers for polygon drawing */}
                {drawingPolygonPoints.map((pt, idx) => (
                  <AdvancedMarker
                    key={`draw-pt-${idx}`}
                    position={{ lat: pt.latitude, lng: pt.longitude }}
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white font-extrabold text-[10px] font-mono border-2 border-slate-950 shadow-xl animate-pulse">
                      {idx + 1}
                    </div>
                  </AdvancedMarker>
                ))}
              </>
            )}

            {/* Render Geofences as reactive Circles/Polygons and center Marker Pins */}
            {geofences.map(gf => {
              let color = '#3b82f6'; // Destination / Blue
              if (gf.type === 'ORIGIN') color = '#10b981'; // Green
              else if (gf.type === 'WAYPOINT') color = '#f59e0b'; // Amber

              const isSelected = activeSelectedGeofence?.id === gf.id;
              const isPolygon = gf.shapeType === 'POLYGON' && gf.polygonCoordinates && gf.polygonCoordinates.length >= 3;

              return (
                <div key={`gf-group-${gf.id}`}>
                  {/* The interactive Circle or Polygon visual boundaries */}
                  {isPolygon ? (
                    <MapPolygon
                      paths={gf.polygonCoordinates!.map(c => ({ lat: c.latitude, lng: c.longitude }))}
                      strokeColor={color}
                      strokeOpacity={0.8}
                      strokeWeight={isSelected ? 4 : 2}
                      fillColor={color}
                      fillOpacity={isSelected ? 0.35 : 0.15}
                      onClick={() => handleGeofenceClick(gf)}
                    />
                  ) : (
                    <MapCircle
                      center={{ lat: gf.latitude, lng: gf.longitude }}
                      radius={gf.radius}
                      strokeColor={color}
                      strokeOpacity={0.8}
                      strokeWeight={isSelected ? 4 : 2}
                      fillColor={color}
                      fillOpacity={isSelected ? 0.35 : 0.15}
                      onClick={() => handleGeofenceClick(gf)}
                    />
                  )}

                  {/* High contrast marker center with label */}
                  <AdvancedMarker
                    position={{ lat: gf.latitude, lng: gf.longitude }}
                    onClick={() => handleGeofenceClick(gf)}
                    draggable={interactive}
                    onDragEnd={(e) => {
                      if (onGeofenceDragEnd && e.latLng) {
                        onGeofenceDragEnd(gf.id, e.latLng.lat(), e.latLng.lng());
                      }
                    }}
                  >
                    <div className="flex flex-col items-center justify-center cursor-pointer select-none group">
                      {/* Hexagon / modern concentric glowing rings */}
                      <div className="relative flex items-center justify-center w-8 h-8">
                        {/* Outer pulsing beacon ring */}
                        <div className="absolute w-7 h-7 rounded-full opacity-35 animate-ping" style={{ backgroundColor: color }} />
                        
                        {/* Core vector badge */}
                        <div className="relative p-1.5 rounded-xl bg-slate-950/95 border border-slate-800 shadow-xl group-hover:border-sky-500/50 transition-all flex items-center justify-center" style={{ color: color }}>
                          {/* Modern icon representations based on Geofence Icon or Type */}
                          {gf.icon === 'FUEL_BASE' ? (
                            <Droplet size={14} className="opacity-90" />
                          ) : gf.icon === 'TRANSPORT_BASE' ? (
                            <Building2 size={14} className="opacity-90" />
                          ) : gf.icon === 'GAS_STATION' ? (
                            <Fuel size={14} className="opacity-90" />
                          ) : gf.icon === 'FLAG' ? (
                            <Flag size={14} className="opacity-90" />
                          ) : gf.type === 'ORIGIN' ? (
                            <Package size={14} className="opacity-90" />
                          ) : gf.type === 'DESTINATION' ? (
                            <MapPin size={14} className="opacity-90" />
                          ) : (
                            <Navigation size={14} className="opacity-90" />
                          )}
                        </div>
                      </div>

                      {/* Futuristic Glass Label Pill */}
                      <div className="bg-slate-950/90 text-[8px] font-bold font-mono tracking-wider text-slate-200 px-1.5 py-0.5 rounded border border-slate-800/80 mt-0.5 whitespace-nowrap shadow-xl max-w-[100px] truncate group-hover:border-sky-500/35 transition-colors">
                        {gf.name}
                      </div>
                    </div>
                  </AdvancedMarker>
                </div>
              );
            })}

            {/* Render Vehicles with dynamic status and orientation heading */}
            {vehiclesToRender.map(v => {
              const isIgnitionOn = v.speed > 0;
              let statusColor = isIgnitionOn ? '#10b981' : '#ef4444'; // Green for ON (speed > 0), Red for OFF (speed === 0)
              if (v.status === 'MAINTENANCE') {
                statusColor = '#facc15'; // Yellow/Amber for Maintenance
              }

              return (
                <AdvancedMarker
                  key={`vehicle-${v.id}`}
                  position={{ lat: v.currentLatitude, lng: v.currentLongitude }}
                  onClick={() => handleVehicleClick(v)}
                >
                  <div className="relative flex flex-col items-center justify-center cursor-pointer group" style={{ width: '64px', height: '64px' }}>
                    {/* Glowing pulse ring indicator */}
                    <span 
                      className={`absolute inline-flex rounded-full opacity-60 ${
                        v.speed > 0 ? 'animate-ping' : 'animate-pulse'
                      }`} 
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: `${statusColor}40`
                      }}
                    />

                    {/* Radar sweep dotted ring for active moving vehicles */}
                    {v.speed > 0 && (
                      <div 
                        className="absolute w-11 h-11 rounded-full border border-dashed opacity-40 animate-[spin_6s_linear_infinite]"
                        style={{ borderColor: statusColor }}
                      />
                    )}

                    {/* Futuristic glassmorphic directional pointer vessel */}
                    <div
                      style={{
                        transform: `rotate(${v.direction}deg)`,
                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        borderColor: `${statusColor}50`,
                        boxShadow: `0 4px 20px ${statusColor}15`
                      }}
                      className="flex items-center justify-center p-1 rounded-xl bg-slate-950/95 border shadow-2xl backdrop-blur-md transition-all group-hover:scale-110"
                    >
                      {/* Premium top-down vector illustration of a Fuel Tanker Truck */}
                      <svg 
                        viewBox="0 0 24 24" 
                        className="w-8 h-8 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                        style={{ color: statusColor }}
                        fill="currentColor"
                      >
                        {/* Cab wheels */}
                        <rect x="5.5" y="3" width="1.2" height="2" rx="0.4" fill="#090d16" />
                        <rect x="17.3" y="3" width="1.2" height="2" rx="0.4" fill="#090d16" />
                        
                        {/* Trailer dual axle wheels */}
                        <rect x="5.5" y="13.5" width="1.2" height="2" rx="0.4" fill="#090d16" />
                        <rect x="17.3" y="13.5" width="1.2" height="2" rx="0.4" fill="#090d16" />
                        <rect x="5.5" y="16" width="1.2" height="2" rx="0.4" fill="#090d16" />
                        <rect x="17.3" y="16" width="1.2" height="2" rx="0.4" fill="#090d16" />
                        
                        {/* Truck Cab (Cabina) */}
                        <rect x="7" y="1" width="10" height="5.5" rx="1.5" fill="currentColor" />
                        
                        {/* Windshield & Cabin Details */}
                        <path d="M8.5 2h7l.5 1.5h-8z" fill="#020617" />
                        <rect x="9" y="4" width="6" height="1" rx="0.2" fill="#020617" opacity="0.4" />
                        
                        {/* Side Mirrors */}
                        <rect x="6" y="2.5" width="1" height="1.2" rx="0.2" fill="currentColor" />
                        <rect x="17" y="2.5" width="1" height="1.2" rx="0.2" fill="currentColor" />
                        
                        {/* Coupling Pivot Bridge (Quinta Roda) */}
                        <rect x="11.2" y="6" width="1.6" height="2" fill="#475569" />
                        
                        {/* Fuel Tank (Tanque de Combustível) */}
                        <rect x="6.5" y="7.5" width="11" height="11.5" rx="3" fill="currentColor" />
                        
                        {/* Safety Catwalk (Passarela antiderrapante do tanque) */}
                        <rect x="10.5" y="8.5" width="3" height="9.5" rx="0.5" fill="#020617" opacity="0.35" />
                        
                        {/* Loading Hatches (Tampas de enchimento) */}
                        <circle cx="12" cy="10" r="0.9" fill="#1e293b" />
                        <circle cx="12" cy="13.2" r="0.9" fill="#1e293b" />
                        <circle cx="12" cy="16.5" r="0.9" fill="#1e293b" />
                        
                        {/* Inflammable Liquid Class 3 Hazard Diamond (Placa de Perigo) */}
                        <polygon points="12,18.5 13.5,20 12,21.5 10.5,20" fill="#ef4444" />
                        {/* Hazard Flame symbol representation */}
                        <circle cx="12" cy="20" r="0.4" fill="#facc15" />
                      </svg>
                    </div>

                    {/* Neon tiny dot representing current online status */}
                    <div 
                      className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full border border-slate-950"
                      style={{ backgroundColor: statusColor }}
                    />

                    {/* Modern telemetry text badge */}
                    <div className="absolute -bottom-6 flex items-center gap-1 bg-slate-950/95 border border-slate-800 rounded px-1 py-0.5 whitespace-nowrap shadow-xl z-10 font-mono text-[8px] tracking-wider group-hover:border-sky-500/50 transition-colors">
                      <span className="font-bold text-slate-200">
                        {v.licensePlate}
                      </span>
                      {v.speed > 0 && (
                        <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-0.5 rounded-sm">
                          {v.speed}km/h
                        </span>
                      )}
                    </div>
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* Vehicle Info Window */}
            {infoWindowVehicle && (() => {
              const activeTripForVehicle = trips?.find(
                t => t.vehicleId === infoWindowVehicle.id && t.status !== 'DELIVERED'
              );

              // Helper Haversine Distance (in km)
              const getHaversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
                const R = 6371; // Earth's radius in km
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLng = (lng2 - lng1) * Math.PI / 180;
                const a =
                  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
              };

              let distToOriginText = null;
              let distToDestText = null;

              if (activeTripForVehicle) {
                const originGeofence = geofences.find(
                  g => g.id === (activeTripForVehicle.originGeofenceId || (activeTripForVehicle as any).originId)
                );
                const destGeofence = geofences.find(
                  g => g.id === (activeTripForVehicle.destinationGeofenceId || (activeTripForVehicle as any).destinationId)
                );

                if (originGeofence) {
                  const distToOrigin = getHaversineDistance(
                    infoWindowVehicle.currentLatitude,
                    infoWindowVehicle.currentLongitude,
                    originGeofence.latitude,
                    originGeofence.longitude
                  );
                  distToOriginText = {
                    name: originGeofence.name,
                    distance: distToOrigin
                  };
                }

                if (destGeofence) {
                  const distToDest = getHaversineDistance(
                    infoWindowVehicle.currentLatitude,
                    infoWindowVehicle.currentLongitude,
                    destGeofence.latitude,
                    destGeofence.longitude
                  );
                  distToDestText = {
                    name: destGeofence.name,
                    distance: distToDest
                  };
                }
              }

              return (
                <InfoWindow
                  position={{ lat: infoWindowVehicle.currentLatitude, lng: infoWindowVehicle.currentLongitude }}
                  onCloseClick={() => {
                    if (infoWindowVehicle) {
                      userClosedVehicleIdRef.current = infoWindowVehicle.id;
                    }
                    setInfoWindowVehicle(null);
                  }}
                >
                  <div className="font-sans text-xs text-slate-800 p-1 bg-white min-w-[180px]">
                    <div className="flex items-center justify-between border-b border-slate-150 pb-1 mb-1.5 gap-4">
                      <span className="font-bold text-sky-600 font-mono text-[11px]">{infoWindowVehicle.licensePlate}</span>
                      <span className="px-1 text-[8px] rounded font-extrabold bg-slate-100 text-slate-700 uppercase">
                        {infoWindowVehicle.status === 'AVAILABLE' ? 'DISPONÍVEL' :
                         infoWindowVehicle.status === 'EN_ROUTE' ? 'EM VIAGEM' :
                         infoWindowVehicle.status === 'ALERT' ? 'ALERTA' :
                         infoWindowVehicle.status === 'BLOCKED' ? 'BLOQUEADO' :
                         infoWindowVehicle.status === 'MAINTENANCE' ? 'EM MANUTENÇÃO' : infoWindowVehicle.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-slate-700 text-[11px]">
                      {infoWindowVehicle.status === 'MAINTENANCE' ? (
                        <>
                          <p><span className="text-slate-400 font-semibold">Status:</span> <span className="text-amber-500 font-bold">Oficina / Manutenção</span></p>
                          {infoWindowVehicle.maintenanceReason && (
                            <p><span className="text-slate-400 font-semibold">Motivo:</span> {infoWindowVehicle.maintenanceReason}</p>
                          )}
                          <p>
                            <span className="text-slate-400 font-semibold">Previsão:</span>{' '}
                            <span className="font-semibold text-blue-600">
                              {infoWindowVehicle.maintenanceExpectedDate 
                                ? new Date(infoWindowVehicle.maintenanceExpectedDate).toLocaleDateString('pt-BR') 
                                : 'Em aberto (Não definida)'}
                            </span>
                          </p>
                        </>
                      ) : (
                        <>
                          <p>
                            <span className="text-slate-400 font-semibold">Local:</span>{' '}
                            {infoWindowVehicle.model?.startsWith('Caminhão (') && infoWindowVehicle.model?.endsWith(')') 
                              ? infoWindowVehicle.model.slice(10, -1) 
                              : infoWindowVehicle.model}
                          </p>
                          <p><span className="text-slate-400 font-semibold">Velocidade:</span> {infoWindowVehicle.speed} km/h</p>
                          <p>
                            <span className="text-slate-400 font-semibold">Ignição:</span>{' '}
                            <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                              infoWindowVehicle.speed > 0 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-rose-100 text-rose-700'
                            }`}>
                              {infoWindowVehicle.speed > 0 ? 'LIGADA' : 'DESLIGADA'}
                            </span>
                          </p>
                        </>
                      )}
                      <p><span className="text-slate-400 font-semibold">Motorista:</span> {infoWindowVehicle.driverName || 'Não vinculado'}</p>

                      {/* Distance to Origin / Destination */}
                      {activeTripForVehicle && (distToOriginText || distToDestText) && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">KM Restantes ({activeTripForVehicle.tripNumber})</p>
                          {distToOriginText && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-slate-400 truncate max-w-[100px]" title={`Origem: ${distToOriginText.name}`}>📍 Origem:</span>
                              <span className="font-bold text-emerald-600 shrink-0 font-mono text-[10px]">{distToOriginText.distance.toFixed(1)} km</span>
                            </div>
                          )}
                          {distToDestText && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-slate-400 truncate max-w-[100px]" title={`Destino: ${distToDestText.name}`}>🏁 Destino:</span>
                              <span className="font-bold text-blue-600 shrink-0 font-mono text-[10px]">{distToDestText.distance.toFixed(1)} km</span>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-[9px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-100">
                        {new Date(infoWindowVehicle.telemetryTime).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </InfoWindow>
              );
            })()}

            {/* Geofence Info Window */}
            {infoWindowGeofence && (
              <InfoWindow
                position={{ lat: infoWindowGeofence.latitude, lng: infoWindowGeofence.longitude }}
                onCloseClick={() => setInfoWindowGeofence(null)}
              >
                <div className="font-sans text-xs text-slate-800 p-1 bg-white min-w-[160px]">
                  <div className="flex items-center gap-1.5 border-b border-slate-150 pb-1 mb-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      infoWindowGeofence.type === 'ORIGIN' ? 'bg-emerald-500' :
                      infoWindowGeofence.type === 'DESTINATION' ? 'bg-blue-500' :
                      'bg-amber-500'
                    }`} />
                    <span className="font-bold text-slate-900 text-[11px]">{infoWindowGeofence.name}</span>
                  </div>
                  <div className="space-y-1 text-slate-700 text-[11px]">
                    <p>
                      <span className="text-slate-400 font-semibold">Tipo:</span>{' '}
                      {infoWindowGeofence.type === 'ORIGIN' ? 'Origem (Carregamento)' :
                       infoWindowGeofence.type === 'DESTINATION' ? 'Destino (Descarregamento)' :
                       'Parada / Ponto de Controle'}
                    </p>
                    <p>
                      <span className="text-slate-400 font-semibold">Raio:</span> {infoWindowGeofence.radius}m
                    </p>
                    <p className="text-[9px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-100">
                      Lat: {infoWindowGeofence.latitude.toFixed(6)}, Lng: {infoWindowGeofence.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Custom controls mounted directly on the Map to be visible in fullscreen mode */}
            <MapControl position={ControlPosition.LEFT_TOP}>
              <div className="m-2 flex flex-col gap-2 items-start pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setAutoCenter(prev => !prev)}
                  className={`text-[9px] font-bold border rounded px-2.5 py-1.5 shadow-lg flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer ${
                    autoCenter 
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 hover:bg-sky-500/30' 
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                  }`}
                  title="Alternar auto-centralização no veículo selecionado"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${autoCenter ? 'bg-sky-400 animate-pulse' : 'bg-amber-400'}`} />
                  {autoCenter ? 'ACOMPANHAMENTO: ATIVO' : 'ACOMPANHAMENTO: PAUSADO'}
                </button>
              </div>
            </MapControl>

            <MapControl position={ControlPosition.RIGHT_TOP}>
              <div className="m-2 flex flex-col gap-2 items-end pointer-events-auto">
                <div className="bg-[#0a0e1a]/95 text-[10px] font-mono text-sky-400 border border-slate-700/80 px-2.5 py-1.5 rounded shadow-lg flex items-center gap-1.5 backdrop-blur-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                  GOOGLE MAPS TELEMETRIA REALTIME
                </div>

                {/* Real-time Alert Overlay on Map */}
                {activeAlert && (
                  <div 
                    id="map-active-voice-alert-toast" 
                    className="max-w-[calc(100vw-32px)] sm:max-w-sm bg-slate-950/95 border border-rose-500/40 rounded-xl p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        activeAlert.type === 'inside' 
                          ? 'bg-rose-500/15 text-rose-400' 
                          : activeAlert.type === 'exit' 
                            ? 'bg-amber-500/15 text-amber-400' 
                            : activeAlert.type === 'maintenance'
                              ? 'bg-red-500/15 text-red-400'
                              : activeAlert.type === 'announcement'
                                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                                : 'bg-sky-500/15 text-sky-400'
                      }`}>
                        {activeAlert.type === 'inside' ? (
                          <CheckCircle2 size={16} className="animate-bounce" />
                        ) : activeAlert.type === 'exit' ? (
                          <Navigation size={16} />
                        ) : activeAlert.type === 'maintenance' ? (
                          <AlertTriangle size={16} className="animate-pulse" />
                        ) : activeAlert.type === 'announcement' ? (
                          <Megaphone size={16} className="animate-pulse text-sky-400" />
                        ) : (
                          <Bell size={16} className="animate-pulse" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-slate-400 truncate">
                            {activeAlert.type === 'inside' && 'Cerca Eletrônica: ENTRADA'}
                            {activeAlert.type === 'exit' && 'Cerca Eletrônica: SAÍDA'}
                            {activeAlert.type === 'near' && 'Cerca Eletrônica: APROXIMAÇÃO'}
                            {activeAlert.type === 'maintenance' && 'Oficina: MANUTENÇÃO'}
                            {activeAlert.type === 'announcement' && 'Central: TRANSPORTE / AVISO'}
                          </span>
                          <span className="text-[8px] font-mono text-slate-500 shrink-0">{activeAlert.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-100 font-semibold leading-relaxed break-words">
                          {activeAlert.message.replace(/Placa ([A-Z0-9 ]+),/gi, `Placa ${activeAlert.plate},`)}
                        </p>

                        <div className="flex items-center justify-between pt-1.5">
                          <button
                            type="button"
                            onClick={() => handleRepeatAlert(activeAlert.message)}
                            className="flex items-center gap-1 text-[9px] font-mono font-bold text-sky-400 hover:text-sky-300 uppercase cursor-pointer"
                          >
                            <Play size={9} /> Repetir Voz
                          </button>

                          <button
                            type="button"
                            onClick={handleDismissAlert}
                            className="text-[9px] font-mono text-rose-400 hover:text-rose-300 font-bold uppercase cursor-pointer"
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </MapControl>
          </Map>
        </APIProvider>
        )}
      </div>
    </div>
  );
}
