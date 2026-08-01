import React, { useState } from 'react';
import { Geofence, GeofenceType, GeofenceIcon, GeofenceShape, Coordinate } from '../types';
import MapComponent from '../components/MapComponent';
import { Plus, Trash2, Navigation, Edit2, Hexagon, Circle, Undo2, RotateCcw, ShieldCheck } from 'lucide-react';
import { getPolygonCentroid, getPolygonBoundingRadius } from '../utils/geometry';
import { copyCoordinates } from '../utils/clipboard';

interface GeofencesProps {
  geofences: Geofence[];
  onCreateGeofence: (data: {
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    type: GeofenceType;
    icon?: GeofenceIcon;
    shapeType?: GeofenceShape;
    polygonCoordinates?: Coordinate[];
  }) => void;
  onUpdateGeofence: (
    id: string,
    data: {
      name?: string;
      latitude?: number;
      longitude?: number;
      radius?: number;
      type?: GeofenceType;
      icon?: GeofenceIcon;
      shapeType?: GeofenceShape;
      polygonCoordinates?: Coordinate[];
    }
  ) => void;
  onDeleteGeofence: (id: string) => void;
}

export default function Geofences({
  geofences,
  onCreateGeofence,
  onUpdateGeofence,
  onDeleteGeofence,
}: GeofencesProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState(-23.5505);
  const [longitude, setLongitude] = useState(-46.6333);
  const [radius, setRadius] = useState(500);
  const [type, setType] = useState<GeofenceType>('ORIGIN');
  const [icon, setIcon] = useState<GeofenceIcon>('FLAG');
  const [shapeType, setShapeType] = useState<GeofenceShape>('CIRCLE');
  const [polygonPoints, setPolygonPoints] = useState<Coordinate[]>([]);
  const [selectedGeofence, setSelectedGeofence] = useState<Geofence | null>(null);

  // Capture map click coordinates for single point OR polygon vertex
  const handleMapClick = (lat: number, lng: number) => {
    const roundLat = parseFloat(lat.toFixed(6));
    const roundLng = parseFloat(lng.toFixed(6));

    if (shapeType === 'POLYGON') {
      const newPts = [...polygonPoints, { latitude: roundLat, longitude: roundLng }];
      setPolygonPoints(newPts);
      const center = getPolygonCentroid(newPts);
      setLatitude(parseFloat(center.latitude.toFixed(6)));
      setLongitude(parseFloat(center.longitude.toFixed(6)));
      setRadius(getPolygonBoundingRadius(center, newPts));
    } else {
      setLatitude(roundLat);
      setLongitude(roundLng);
    }
  };

  const handleUndoPolygonPoint = () => {
    if (polygonPoints.length === 0) return;
    const newPts = polygonPoints.slice(0, -1);
    setPolygonPoints(newPts);
    if (newPts.length > 0) {
      const center = getPolygonCentroid(newPts);
      setLatitude(parseFloat(center.latitude.toFixed(6)));
      setLongitude(parseFloat(center.longitude.toFixed(6)));
      setRadius(getPolygonBoundingRadius(center, newPts));
    }
  };

  const handleClearPolygonPoints = () => {
    setPolygonPoints([]);
  };

  const handleGeofenceDragEnd = (id: string, lat: number, lng: number) => {
    if (id === 'DRAFT_GEOFENCE' || id === editingId) {
      setLatitude(parseFloat(lat.toFixed(6)));
      setLongitude(parseFloat(lng.toFixed(6)));
    } else {
      onUpdateGeofence(id, { latitude: lat, longitude: lng });
    }
  };

  const handleEditClick = (gf: Geofence, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(gf.id);
    setName(gf.name);
    setLatitude(gf.latitude);
    setLongitude(gf.longitude);
    setRadius(gf.radius);
    setType(gf.type);
    setIcon(gf.icon || 'FLAG');
    setShapeType(gf.shapeType || 'CIRCLE');
    setPolygonPoints(gf.polygonCoordinates || []);
    setSelectedGeofence(gf);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setShapeType('CIRCLE');
    setPolygonPoints([]);
    setSelectedGeofence(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (shapeType === 'POLYGON' && polygonPoints.length < 3) {
      alert('Para desenhar uma geocerca livre (polígono), clique no mapa para adicionar pelo menos 3 vértices.');
      return;
    }

    let finalLat = latitude;
    let finalLng = longitude;
    let finalRadius = radius;

    if (shapeType === 'POLYGON' && polygonPoints.length >= 3) {
      const centroid = getPolygonCentroid(polygonPoints);
      finalLat = parseFloat(centroid.latitude.toFixed(6));
      finalLng = parseFloat(centroid.longitude.toFixed(6));
      finalRadius = getPolygonBoundingRadius(centroid, polygonPoints);
    }

    if (editingId) {
      onUpdateGeofence(editingId, {
        name,
        latitude: finalLat,
        longitude: finalLng,
        radius: finalRadius,
        type,
        icon,
        shapeType,
        polygonCoordinates: shapeType === 'POLYGON' ? polygonPoints : undefined,
      });
      handleCancelEdit();
    } else {
      onCreateGeofence({
        name,
        latitude: finalLat,
        longitude: finalLng,
        radius: finalRadius,
        type,
        icon,
        shapeType,
        polygonCoordinates: shapeType === 'POLYGON' ? polygonPoints : undefined,
      });
      setName('');
      setPolygonPoints([]);
    }
  };

  const mapGeofences = [...geofences];
  // Add draft geofence preview if shape is CIRCLE or editing
  if (shapeType === 'CIRCLE') {
    if (!editingId && name.trim()) {
      mapGeofences.push({
        id: 'DRAFT_GEOFENCE',
        name: name + ' (Rascunho)',
        latitude,
        longitude,
        radius,
        type,
        icon,
        shapeType: 'CIRCLE',
      });
    } else if (!editingId && !name.trim()) {
      mapGeofences.push({
        id: 'DRAFT_GEOFENCE',
        name: 'Nova Cerca (Arraste para ajustar)',
        latitude,
        longitude,
        radius,
        type,
        icon,
        shapeType: 'CIRCLE',
      });
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Geofence Form & List */}
      <div className="space-y-4 xl:col-span-1">
        {/* Registration Form */}
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Plus size={15} className="text-sky-400" />
            {editingId ? 'Editar Geocerca' : 'Nova Geocerca Eletrônica'}
          </h2>
          <p className="text-[10px] text-slate-400 leading-snug">
            Dica: Clique no mapa para mover o ponto, ou arraste o ícone da cerca no mapa para um melhor ajuste.
          </p>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            {/* Shape selector switch */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Formato da Geocerca</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShapeType('CIRCLE');
                    setPolygonPoints([]);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                    shapeType === 'CIRCLE'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'bg-[#0a0e1a] border-[#1f2d45] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Circle size={13} />
                  Raio Circular
                </button>
                <button
                  type="button"
                  onClick={() => setShapeType('POLYGON')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                    shapeType === 'POLYGON'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'bg-[#0a0e1a] border-[#1f2d45] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Hexagon size={13} />
                  Desenho Livre
                </button>
              </div>
            </div>

            {/* Polygon Drawing Controls */}
            {shapeType === 'POLYGON' && (
              <div className="bg-sky-950/40 border border-sky-800/50 rounded-lg p-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-sky-300 font-bold text-[11px]">
                  <span className="flex items-center gap-1">
                    <Hexagon size={13} className="text-sky-400 animate-pulse" />
                    Vértices do Polígono: {polygonPoints.length}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {polygonPoints.length >= 3 ? '✓ Válido (≥3)' : 'Necessita ≥3 pontos'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-tight">
                  Clique no mapa para marcar cada vértice do formato desejado. O polígono será fechado automaticamente.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleUndoPolygonPoint}
                    disabled={polygonPoints.length === 0}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-[10px] font-semibold py-1 rounded border border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Undo2 size={11} />
                    Desfazer Ponto
                  </button>
                  <button
                    type="button"
                    onClick={handleClearPolygonPoints}
                    disabled={polygonPoints.length === 0}
                    className="flex-1 bg-rose-950/40 hover:bg-rose-900/50 disabled:opacity-40 text-rose-300 text-[10px] font-semibold py-1 rounded border border-rose-800/40 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={11} />
                    Limpar Desenho
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Nome da Cerca</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: CD Porto Alegre (Destino)"
                required
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={e => setLatitude(parseFloat(e.target.value))}
                  required
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={e => setLongitude(parseFloat(e.target.value))}
                  required
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Tipo de Cerca</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as GeofenceType)}
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 cursor-pointer"
              >
                <option value="ORIGIN">Origem (Carregamento)</option>
                <option value="DESTINATION">Destino (Descarregamento)</option>
                <option value="WAYPOINT">Parada / Ponto de Controle</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Ícone no Mapa</label>
              <select
                value={icon}
                onChange={e => setIcon(e.target.value as GeofenceIcon)}
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 cursor-pointer"
              >
                <option value="FLAG">Padrão (Bandeira)</option>
                <option value="FUEL_BASE">Base de Coleta de Combustível</option>
                <option value="TRANSPORT_BASE">Base da Transportadora</option>
                <option value="GAS_STATION">Posto de Gasolina</option>
              </select>
            </div>

            {shapeType === 'CIRCLE' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Raio ({radius}m)</label>
                </div>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  step="50"
                  value={radius}
                  onChange={e => setRadius(parseInt(e.target.value))}
                  className="w-full accent-sky-500 h-1 bg-[#0a0e1a] rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[8px] text-slate-500 mt-0.5 font-mono">
                  <span>100m</span>
                  <span>2.5km</span>
                  <span>5km</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-sky-600 hover:bg-sky-500 transition text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} />
                {editingId ? 'Salvar Edição' : 'Criar Geocerca'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-slate-700 hover:bg-slate-600 transition text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Geofences List Table */}
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Cercas Ativas ({geofences.length})</h2>
          
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            {geofences.map(gf => (
              <div
                key={gf.id}
                onClick={() => setSelectedGeofence(gf)}
                className={`p-2 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                  selectedGeofence?.id === gf.id
                    ? 'bg-sky-400/10 border-sky-400/40 text-white'
                    : 'bg-[#0a0e1a]/50 border-[#1f2d45]/60 hover:border-[#1f2d45] hover:bg-[#1a2236]/40 text-slate-300'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      gf.type === 'ORIGIN' ? 'bg-emerald-500' :
                      gf.type === 'DESTINATION' ? 'bg-blue-500' :
                      'bg-amber-500'
                    }`} />
                    <span className="font-bold text-xs">{gf.name}</span>
                    <span className={`text-[8px] font-semibold px-1.5 py-0.2 rounded border ${
                      gf.shapeType === 'POLYGON'
                        ? 'bg-purple-950/50 text-purple-300 border-purple-800/40'
                        : 'bg-sky-950/50 text-sky-300 border-sky-800/40'
                    }`}>
                      {gf.shapeType === 'POLYGON' ? 'Polígono Livre' : 'Círculo'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 block font-mono leading-none">
                    Lat: {gf.latitude.toFixed(4)}, Lng: {gf.longitude.toFixed(4)} • {gf.shapeType === 'POLYGON' ? `${gf.polygonCoordinates?.length || 0} vértices` : `${gf.radius}m`}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyCoordinates(gf.latitude, gf.longitude, gf.name);
                    }}
                    className="p-1 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded transition cursor-pointer"
                    title="Copiar Latitude e Longitude"
                  >
                    <Navigation size={12} />
                  </button>
                  <button
                    onClick={(e) => handleEditClick(gf, e)}
                    className="p-1 text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 rounded transition cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGeofence(gf.id);
                      if (selectedGeofence?.id === gf.id) setSelectedGeofence(null);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Map Column */}
      <div className="xl:col-span-2 h-[450px] xl:h-auto rounded-xl overflow-hidden relative shadow-2xl border border-[#1f2d45]">
        <MapComponent
          vehicles={[]}
          geofences={mapGeofences}
          selectedGeofence={selectedGeofence || mapGeofences.find(g => g.id === 'DRAFT_GEOFENCE')}
          onMapClick={handleMapClick}
          onGeofenceDragEnd={handleGeofenceDragEnd}
          onSelectGeofence={setSelectedGeofence}
          interactive={true}
          drawingPolygonPoints={polygonPoints}
          isDrawingPolygon={shapeType === 'POLYGON'}
        />
        <div className="absolute top-3 left-3 bg-[#111827]/95 border border-[#1f2d45] px-3 py-2 rounded-lg z-[1000] text-[10px] font-sans text-slate-300 max-w-xs backdrop-blur-md shadow-xl">
          <p className="font-bold text-white flex items-center gap-1 mb-1 uppercase tracking-wider text-[9px]">
            <Navigation size={11} className="text-sky-400 animate-pulse" />
            Clique de Coordenadas
          </p>
          <p className="text-[9px] text-slate-400 leading-snug">
            Dê um clique em qualquer rodovia ou localidade do mapa para preencher instantaneamente as coordenadas de Latitude e Longitude do formulário.
          </p>
        </div>
      </div>
    </div>
  );
}
