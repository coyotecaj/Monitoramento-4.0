import { useState, useMemo, useEffect } from 'react';
import { Vehicle, Geofence, Coordinate, Trip } from '../types';
import MapComponent from '../components/MapComponent';
import { Truck, Navigation, Shield, AlertTriangle, Radio, HelpCircle, Compass, ShieldAlert, Search } from 'lucide-react';

interface MapMonitoringProps {
  vehicles: Vehicle[];
  geofences: Geofence[];
  trips: Trip[];
  activeTripRoute?: Coordinate[];
  activeTripDestination?: Coordinate;
  activeTripVehicle?: Vehicle;
  onBlockVehicle: (id: string, block: boolean) => void;
}

export default function MapMonitoring({
  vehicles,
  geofences,
  trips,
  activeTripRoute,
  activeTripDestination,
  activeTripVehicle,
  onBlockVehicle,
}: MapMonitoringProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active_trips' | 'maintenance'>('all');

  // Filter out vehicles that the user chose to hide on the map
  const visibleVehicles = vehicles.filter(v => v.visibleOnMap !== false);

  const filteredByStatusVehicles = useMemo(() => {
    return visibleVehicles.filter(v => {
      if (filterType === 'all') return true;
      if (filterType === 'maintenance') return v.status === 'MAINTENANCE';
      if (filterType === 'active_trips') {
        const hasActiveTrip = trips?.some(t => t.vehicleId === v.id && t.status !== 'DELIVERED');
        return hasActiveTrip;
      }
      return true;
    });
  }, [visibleVehicles, filterType, trips]);

  const filteredVehicles = useMemo(() => {
    if (!searchTerm) return filteredByStatusVehicles;
    const lower = searchTerm.toLowerCase();
    return filteredByStatusVehicles.filter(v => 
      v.licensePlate.toLowerCase().includes(lower) || 
      (v.driverName && v.driverName.toLowerCase().includes(lower))
    );
  }, [filteredByStatusVehicles, searchTerm]);

  // Clear selected vehicle if it gets filtered out
  useEffect(() => {
    if (selectedVehicle && !filteredVehicles.some(v => v.id === selectedVehicle.id)) {
      setSelectedVehicle(null);
    }
  }, [filteredVehicles, selectedVehicle]);

  // Find active trip ONLY when a driver card / vehicle is selected
  const activeTripForSelected = selectedVehicle
    ? trips?.find(t => t.vehicleId === selectedVehicle.id && t.status !== 'DELIVERED')
    : null;

  const currentRouteToRender = selectedVehicle
    ? activeTripForSelected?.routeHistory
    : activeTripRoute;

  const currentDestinationToRender = selectedVehicle
    ? (() => {
        if (!activeTripForSelected) return undefined;
        const destId = activeTripForSelected.destinationGeofenceId || (activeTripForSelected as any).destinationId;
        const g = geofences.find(gf => gf.id === destId);
        return g ? { latitude: g.latitude, longitude: g.longitude } : undefined;
      })()
    : activeTripDestination;

  // Stats
  const activeSigs = filteredVehicles.filter(v => v.speed > 0).length;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-150px)] min-h-[480px]">
      {/* Left Column: Vehicles Sidebar */}
      <div className="w-full lg:w-80 flex flex-col bg-[#111827] border border-[#1f2d45] rounded-xl p-3 overflow-hidden h-full">
        <div className="border-b border-[#1f2d45] pb-2 mb-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Radio className="text-sky-400 animate-pulse" size={15} />
            Monitoramento Sascar
          </h2>
          
          {/* Search Input */}
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
            <input
              type="text"
              placeholder="Buscar por placa ou motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
            />
          </div>

          <div className="flex justify-between items-center mt-3">
            <p className="text-[10px] text-slate-400">Total de frotas: {filteredVehicles.length}</p>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
              {activeSigs} Transmitindo
            </span>
          </div>
          {/* Interactive filter buttons replacing the static legend */}
          <div className="mt-3 pt-2.5 border-t border-[#1f2d45]/40">
            <p className="text-[9px] uppercase tracking-wider text-slate-500 font-mono font-bold mb-1.5">Filtros de Exibição:</p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`py-1.5 px-1 rounded-lg text-[9px] font-mono font-bold uppercase transition-all duration-200 text-center border cursor-pointer flex items-center justify-center gap-1 ${
                  filterType === 'all'
                    ? 'bg-sky-500/10 border-sky-400/50 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.15)]'
                    : 'bg-[#1a2236]/20 border-[#1f2d45]/60 hover:border-slate-500/40 text-slate-400 hover:bg-[#1a2236]/40'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFilterType('active_trips')}
                className={`py-1.5 px-1 rounded-lg text-[9px] font-mono font-bold uppercase transition-all duration-200 text-center border cursor-pointer flex items-center justify-center gap-1 ${
                  filterType === 'active_trips'
                    ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.15)]'
                    : 'bg-[#1a2236]/20 border-[#1f2d45]/60 hover:border-slate-500/40 text-slate-400 hover:bg-[#1a2236]/40'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                Viagens
              </button>
              <button
                type="button"
                onClick={() => setFilterType('maintenance')}
                className={`py-1.5 px-1 rounded-lg text-[9px] font-mono font-bold uppercase transition-all duration-200 text-center border cursor-pointer flex items-center justify-center gap-1 ${
                  filterType === 'maintenance'
                    ? 'bg-yellow-500/10 border-yellow-400/50 text-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.15)]'
                    : 'bg-[#1a2236]/20 border-[#1f2d45]/60 hover:border-slate-500/40 text-slate-400 hover:bg-[#1a2236]/40'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                Oficina
              </button>
            </div>
          </div>
        </div>

        {/* Vehicles list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredVehicles.map(v => {
            const isSelected = selectedVehicle?.id === v.id;
            const isIgnitionOn = v.speed > 0;
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVehicle(isSelected ? null : v)}
                className={`w-full text-left p-2 rounded-lg border transition flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-sky-400/10 border-sky-400/40 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                    : 'bg-[#1a2236]/30 border-[#1f2d45]/60 hover:border-[#1f2d45] hover:bg-[#1a2236]/50 text-slate-300'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <span className="font-mono font-bold text-xs truncate" title={v.driverName ? `${v.licensePlate} - ${v.driverName}` : v.licensePlate}>
                      {v.licensePlate}{v.driverName ? ` - ${v.driverName.split(' ').slice(0, 2).join(' ')}` : ''}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      v.status === 'MAINTENANCE' ? 'bg-yellow-400' :
                      isIgnitionOn ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                    }`} />
                  </div>
                  <span className="text-[9px] text-slate-400 block truncate max-w-[140px]">
                    {v.model?.startsWith('Caminhão (') && v.model?.endsWith(')') 
                      ? v.model.slice(10, -1) 
                      : v.model}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-mono font-bold">{v.speed} km/h</span>
                  <span className="block text-[8px] text-slate-500 font-mono">{v.direction}° {v.direction > 315 || v.direction < 45 ? 'N' : v.direction < 135 ? 'E' : v.direction < 225 ? 'S' : 'O'}</span>
                </div>
              </button>
            );
          })}
        </div>


      </div>

      {/* Right Column: Dynamic Leaflet Map */}
      <div className="flex-1 rounded-xl overflow-hidden shadow-2xl relative border border-[#1f2d45]">
        <MapComponent
          vehicles={filteredVehicles}
          geofences={geofences}
          trips={trips}
          selectedVehicle={selectedVehicle}
          activeTripRoute={currentRouteToRender}
          activeTripDestination={currentDestinationToRender}
          activeTripVehicle={selectedVehicle || activeTripVehicle}
        />
        
        {/* Float Map Guide */}
        <div className="absolute bottom-3 left-3 bg-[#111827]/95 border border-[#1f2d45] px-3 py-2 rounded-lg z-[1000] text-[10px] font-sans text-slate-300 max-w-xs backdrop-blur-md">
          <p className="font-bold text-white mb-1.5 uppercase tracking-wider text-[9px]">Legendas</p>
          <div className="grid grid-cols-2 gap-1.5 text-[9px]">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>G. Origem</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>G. Destino</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Waypoint</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span>Manutenção</span>
            </div>
            <div className="flex items-center gap-1">
              <Compass size={10} className="text-sky-400" />
              <span>Caminhão</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
