import { useState, useMemo } from 'react';
import { Vehicle, Driver, Geofence, Trip, Contract, CteInfo } from '../types';
import {
  Truck,
  Users,
  MapPin,
  Navigation,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Play,
  RefreshCw,
  Check,
  X,
  Calendar,
  Compass,
  Building2,
  Flag,
  Filter,
  Layers,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { updateVehicleManualLocation } from '../services/api';
import { formatLocationDisplay } from '../utils/geocoding';
import { copyCoordinates } from '../utils/clipboard';
import CteModal from '../components/CteModal';
import { VehicleSpeedCell } from '../components/VehicleSpeedCell';
import { getTripInternalId } from '../utils/trip';

interface DashboardProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  geofences: Geofence[];
  trips: Trip[];
  contracts?: Contract[];
  onNavigate: (page: string) => void;
  onResetTrip: (id: string) => void;
  onOpenRotograma?: (trip: Trip) => void;
  onUpdateStatus?: (tripId: string, status: string) => Promise<void>;
  onUploadCte?: (tripId: string, cteInfo: CteInfo) => void | Promise<void>;
}

export default function Dashboard({
  vehicles,
  drivers,
  geofences,
  trips,
  contracts = [],
  onNavigate,
  onResetTrip,
  onOpenRotograma,
  onUpdateStatus,
  onUploadCte,
}: DashboardProps) {
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [tempLocation, setTempLocation] = useState<string>('');
  const [isSavingLocation, setIsSavingLocation] = useState<boolean>(false);
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [cteModalTrip, setCteModalTrip] = useState<Trip | null>(null);
  const [unloadedChoice, setUnloadedChoice] = useState<Record<string, 'SIM' | 'NAO' | null>>({});

  const visibleVehicles = useMemo(() => vehicles.filter(v => v.visibleOnMap !== false), [vehicles]);

  const activeTripsList = trips.filter(
    t => t.status !== 'DELIVERED' && vehicles.find(v => v.id === t.vehicleId)?.visibleOnMap !== false
  );
  const filteredActiveTripsList = activeTripsList.filter(t => {
    if (!selectedContractId) return true;
    return t.contractId === selectedContractId;
  });

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);
  const [stoppedAlertFilterActive, setStoppedAlertFilterActive] = useState<boolean>(false);

  const handleSaveManualLocation = async (vehicleId: string) => {
    setIsSavingLocation(true);
    try {
      await updateVehicleManualLocation(vehicleId, tempLocation.trim());
      setEditingVehicleId(null);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar localização manual.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Helper to determine status key of a trip
  const getTripStatusKey = (trip: Trip): string => {
    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
    if (vehicle && vehicle.status === 'MAINTENANCE') {
      return 'MAINTENANCE';
    }
    if (trip.status === 'SCHEDULED') {
      return trip.transitStarted ? 'START_TRANSIT' : 'SCHEDULED';
    }
    return trip.status;
  };

  // Map each vehicle to its current active stage
  const vehicleStageMap = useMemo(() => {
    const map = new Map<string, string>();
    visibleVehicles.forEach(v => {
      const activeTrip = trips.find(
        t => t.vehicleId === v.id && t.status !== 'DELIVERED' && (!selectedContractId || t.contractId === selectedContractId)
      );
      if (!activeTrip) {
        map.set(v.id, 'AVAILABLE');
      } else {
        map.set(v.id, getTripStatusKey(activeTrip));
      }
    });
    return map;
  }, [visibleVehicles, trips, selectedContractId]);

  // Counts per status stage
  const stageCounts = useMemo(() => {
    const counts = {
      SCHEDULED: 0,
      START_TRANSIT: 0,
      WAITING_LOADING: 0,
      EN_ROUTE: 0,
      WAITING_UNLOADING: 0,
      AVAILABLE: 0,
    };
    visibleVehicles.forEach(v => {
      const stage = vehicleStageMap.get(v.id) || 'AVAILABLE';
      if (stage in counts) {
        counts[stage as keyof typeof counts]++;
      }
    });
    return counts;
  }, [visibleVehicles, vehicleStageMap]);

  // Status cards configuration
  const statusCards = useMemo(() => [
    {
      id: 'SCHEDULED',
      title: '1. AGENDADO',
      subtitle: 'Aguardando Início',
      count: stageCounts.SCHEDULED,
      bgClass: 'bg-[#111827] border-[#1f2d45] hover:border-indigo-500/50',
      activeClass: 'bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]',
      badgeClass: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
      icon: Calendar,
    },
    {
      id: 'START_TRANSIT',
      title: '1. TRÂNSITO / VAZIO',
      subtitle: 'Indo Carregar',
      count: stageCounts.START_TRANSIT,
      bgClass: 'bg-[#111827] border-[#1f2d45] hover:border-amber-500/50',
      activeClass: 'bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/40 shadow-[0_0_15px_rgba(251,191,36,0.25)]',
      badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      icon: Compass,
    },
    {
      id: 'WAITING_LOADING',
      title: '2. NO CARREGAMENTO',
      subtitle: 'Carga na Origem',
      count: stageCounts.WAITING_LOADING,
      bgClass: 'bg-[#111827] border-[#1f2d45] hover:border-orange-500/50',
      activeClass: 'bg-orange-950/50 border-orange-500 ring-2 ring-orange-500/40 shadow-[0_0_15px_rgba(251,146,60,0.25)]',
      badgeClass: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
      icon: Building2,
    },
    {
      id: 'EN_ROUTE',
      title: '3. EM TRÂNSITO',
      subtitle: 'Viagem em Andamento',
      count: stageCounts.EN_ROUTE,
      bgClass: 'bg-[#111827] border-[#1f2d45] hover:border-sky-500/50',
      activeClass: 'bg-sky-950/50 border-sky-500 ring-2 ring-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.25)]',
      badgeClass: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
      icon: Truck,
    },
    {
      id: 'WAITING_UNLOADING',
      title: '4. NO DESCARREGAMENTO',
      subtitle: 'Descarga no Destino',
      count: stageCounts.WAITING_UNLOADING,
      bgClass: 'bg-[#111827] border-[#1f2d45] hover:border-purple-500/50',
      activeClass: 'bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/40 shadow-[0_0_15px_rgba(192,132,252,0.25)]',
      badgeClass: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
      icon: Flag,
    },
    {
      id: 'AVAILABLE',
      title: '5. DISPONÍVEL / LIVRE',
      subtitle: 'Sem Viagem Ativa',
      count: stageCounts.AVAILABLE,
      bgClass: 'bg-[#111827] border-[#1f2d45] hover:border-emerald-500/50',
      activeClass: 'bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/40 shadow-[0_0_15px_rgba(52,211,153,0.25)]',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      icon: CheckCircle2,
    },
  ], [stageCounts]);

  type SortColumn = 'internalId' | 'cte' | 'plate' | 'driver' | 'speed' | 'location' | 'status' | 'route';
  type SortDirection = 'asc' | 'desc';

  const isSascarVehicle = (vehicle?: Vehicle): boolean => {
    if (!vehicle || !vehicle.licensePlate) return false;
    const plate = vehicle.licensePlate;
    const model = vehicle.model?.toUpperCase() || '';
    if (plate === 'CUF6F40' || plate === 'RMO2J80') return false;
    if (model.includes('SIGHRA') || model.includes('SIGHA')) return false;
    return true;
  };

  // Vehicles with active trips stopped for > 30 mins (Control Tower Alert)
  const stoppedAlertVehicleIds = useMemo(() => {
    const stoppedOver30 = visibleVehicles.filter(v => {
      if (v.speed > 0) return false;

      // Only show vehicles that currently have an active trip (not delivered)
      const activeTrip = trips.find(
        t => t.vehicleId === v.id && t.status !== 'DELIVERED'
      );
      if (!activeTrip) return false;

      if (selectedContractId && activeTrip.contractId !== selectedContractId) return false;

      // Must have telemetry (not missing Sascar API where speed is '-')
      const hasTelemetry = isSascarVehicle(v);
      if (!hasTelemetry) return false;

      const startTime = v.stoppedSince
        ? new Date(v.stoppedSince).getTime()
        : Date.now();
      const mins = (Date.now() - startTime) / 60000;
      return mins >= 30;
    });

    return new Set(stoppedOver30.map(v => v.id));
  }, [vehicles, trips, selectedContractId, geofences]);

  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  // Filtered trips list based on contract and selected status stage
  const activeFilteredTrips = useMemo(() => {
    let list = trips.filter(t => t.status !== 'DELIVERED');
    if (selectedContractId) {
      list = list.filter(t => t.contractId === selectedContractId);
    }
    if (selectedStatusFilter && selectedStatusFilter !== 'AVAILABLE') {
      list = list.filter(t => getTripStatusKey(t) === selectedStatusFilter);
    }
    if (stoppedAlertFilterActive) {
      list = list.filter(t => stoppedAlertVehicleIds.has(t.vehicleId));
    }
    return list;
  }, [trips, selectedContractId, selectedStatusFilter, stoppedAlertFilterActive, stoppedAlertVehicleIds]);

  // Sorted active filtered trips list
  const sortedActiveFilteredTrips = useMemo(() => {
    if (!sortColumn) return activeFilteredTrips;

    const list = [...activeFilteredTrips];
    list.sort((a, b) => {
      const vehicleA = vehicles.find(v => v.id === a.vehicleId);
      const vehicleB = vehicles.find(v => v.id === b.vehicleId);
      const driverA = drivers.find(d => d.id === a.driverId);
      const driverB = drivers.find(d => d.id === b.driverId);

      let valA: any = '';
      let valB: any = '';

      switch (sortColumn) {
        case 'internalId':
          valA = getTripInternalId(a);
          valB = getTripInternalId(b);
          break;
        case 'cte':
          valA = a.cteInfo?.nCT || (a.cteInfo ? '1' : '0');
          valB = b.cteInfo?.nCT || (b.cteInfo ? '1' : '0');
          break;
        case 'plate':
          valA = vehicleA?.licensePlate || '';
          valB = vehicleB?.licensePlate || '';
          break;
        case 'driver': {
          const nameA = driverA?.name || a.cteInfo?.motoristaNome || vehicleA?.driverName || '';
          const nameB = driverB?.name || b.cteInfo?.motoristaNome || vehicleB?.driverName || '';
          valA = nameA;
          valB = nameB;
          break;
        }
        case 'speed': {
          const hasTelA = isSascarVehicle(vehicleA);
          const hasTelB = isSascarVehicle(vehicleB);

          if (hasTelA && !hasTelB) return -1;
          if (!hasTelA && hasTelB) return 1;
          if (!hasTelA && !hasTelB) return 0;

          valA = vehicleA?.speed || 0;
          valB = vehicleB?.speed || 0;
          break;
        }
        case 'location': {
          const locA = vehicleA ? formatLocationDisplay(vehicleA.manualLocation, vehicleA.currentLatitude, vehicleA.currentLongitude) : '';
          const locB = vehicleB ? formatLocationDisplay(vehicleB.manualLocation, vehicleB.currentLatitude, vehicleB.currentLongitude) : '';
          valA = locA;
          valB = locB;
          break;
        }
        case 'status': {
          const statusOrder: Record<string, number> = {
            SCHEDULED: 1,
            START_TRANSIT: 2,
            WAITING_LOADING: 3,
            EN_ROUTE: 4,
            WAITING_UNLOADING: 5,
            DELIVERED: 6,
          };
          valA = statusOrder[getTripStatusKey(a)] || 99;
          valB = statusOrder[getTripStatusKey(b)] || 99;
          break;
        }
        case 'route': {
          const origA = geofences.find(g => g.id === a.originGeofenceId)?.name || '';
          const destA = geofences.find(g => g.id === a.destinationGeofenceId)?.name || '';
          const origB = geofences.find(g => g.id === b.originGeofenceId)?.name || '';
          const destB = geofences.find(g => g.id === b.destinationGeofenceId)?.name || '';
          valA = `${origA} ${destA}`;
          valB = `${origB} ${destB}`;
          break;
        }
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc'
        ? strA.localeCompare(strB, 'pt-BR')
        : strB.localeCompare(strA, 'pt-BR');
    });

    return list;
  }, [activeFilteredTrips, sortColumn, sortDirection, vehicles, drivers, geofences]);

  const renderSortHeader = (label: string, col: SortColumn, alignRight = false) => {
    const isSorted = sortColumn === col;
    return (
      <th className={`pb-2 ${alignRight ? 'text-right' : 'pr-2'}`}>
        <button
          type="button"
          onClick={() => handleSort(col)}
          className={`inline-flex items-center gap-1 hover:text-sky-300 transition-colors cursor-pointer select-none py-1 px-1.5 rounded hover:bg-[#1a2236] ${alignRight ? 'ml-auto' : ''} ${isSorted ? 'text-sky-400 font-extrabold bg-sky-500/10 border border-sky-500/20' : 'text-slate-400'}`}
          title={`Ordenar por ${label} (${isSorted ? (sortDirection === 'asc' ? 'Crescente ↑' : 'Decrescente ↓') : 'Clique para ordenar'})`}
        >
          <span>{label}</span>
          {isSorted ? (
            sortDirection === 'asc' ? (
              <ArrowUp size={12} className="text-sky-400 shrink-0" />
            ) : (
              <ArrowDown size={12} className="text-sky-400 shrink-0" />
            )
          ) : (
            <ArrowUpDown size={12} className="text-slate-500 hover:text-slate-300 shrink-0 opacity-60" />
          )}
        </button>
      </th>
    );
  };

  // Vehicles available list when 'AVAILABLE' status card is clicked
  const availableVehiclesList = useMemo(() => {
    if (selectedStatusFilter !== 'AVAILABLE') return [];
    return visibleVehicles.filter(v => vehicleStageMap.get(v.id) === 'AVAILABLE');
  }, [visibleVehicles, vehicleStageMap, selectedStatusFilter]);

  const currentFilterTitle = useMemo(() => {
    if (!selectedStatusFilter) return null;
    const card = statusCards.find(c => c.id === selectedStatusFilter);
    return card ? card.title : null;
  }, [selectedStatusFilter, statusCards]);

  // Render helpers
  const renderLocationCell = (trip: Trip, vehicle: Vehicle | undefined, hasTelemetry: boolean | undefined) => {
    if (hasTelemetry && vehicle) {
      return (
        <div className="flex flex-col">
          <span className="text-slate-200 flex items-center gap-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                let lat = vehicle.currentLatitude;
                let lng = vehicle.currentLongitude;
                if ((!lat || !lng || (lat === 0 && lng === 0)) && trip) {
                  const gf = geofences.find(g => g.id === trip.destinationGeofenceId || g.id === trip.originGeofenceId);
                  if (gf) { lat = gf.latitude; lng = gf.longitude; }
                }
                copyCoordinates(lat, lng, vehicle.licensePlate || vehicle.model);
              }}
              className="p-1 -m-1 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 rounded transition cursor-pointer flex items-center justify-center shrink-0"
              title="Clique para copiar latitude e longitude (Lat, Lng)"
            >
              <MapPin size={11} className="shrink-0" />
            </button>
            {(() => {
              if (vehicle.model && vehicle.model.includes('/')) {
                const parts = vehicle.model.split('/');
                if (parts.length === 2 && parts[1].trim().length === 2) {
                  return `${parts[0].trim()} - ${parts[1].trim()}`;
                }
              }

              if (trip?.cteInfo) {
                if (trip.status === 'SCHEDULED' || trip.status === 'WAITING_LOADING') {
                  if (trip.cteInfo.remetente?.city && trip.cteInfo.remetente?.state) {
                    return `${trip.cteInfo.remetente.city} - ${trip.cteInfo.remetente.state}`;
                  }
                } else {
                  if (trip.cteInfo.destinatario?.city && trip.cteInfo.destinatario?.state) {
                    return `${trip.cteInfo.destinatario.city} - ${trip.cteInfo.destinatario.state}`;
                  }
                }
              }

              const lat = vehicle.currentLatitude;
              const lng = vehicle.currentLongitude;

              const knownLocations = [
                { lat: -22.9056, lng: -47.0608, city: 'Campinas', state: 'SP' },
                { lat: -23.5505, lng: -46.6333, city: 'São Paulo', state: 'SP' },
                { lat: -25.4290, lng: -49.2671, city: 'Curitiba', state: 'PR' },
                { lat: -24.3772, lng: -47.1047, city: 'Registro', state: 'SP' },
                { lat: -19.9561, lng: -44.1037, city: 'Betim', state: 'MG' },
                { lat: -19.8408, lng: -43.3214, city: 'João Monlevade', state: 'MG' },
                { lat: -17.9341, lng: -49.8520, city: 'Bom Jesus de Goiás', state: 'GO' },
                { lat: -19.7494, lng: -43.6256, city: 'Caeté', state: 'MG' },
                { lat: -18.7091, lng: -49.1388, city: 'Centralina', state: 'MG' },
                { lat: -16.5897, lng: -49.1946, city: 'Goiânia', state: 'GO' },
                { lat: -19.9559, lng: -44.1076, city: 'Contagem', state: 'MG' },
                { lat: -12.7052, lng: -38.5810, city: 'Candeias', state: 'BA' },
                { lat: -20.2587, lng: -40.2518, city: 'Vitória', state: 'ES' },
                { lat: -20.2126, lng: -40.2576, city: 'Serra', state: 'ES' },
              ];

              let nearest = null;
              let minDistance = Infinity;

              for (const loc of knownLocations) {
                const dx = loc.lat - lat;
                const dy = loc.lng - lng;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                  minDistance = distance;
                  nearest = loc;
                }
              }

              if (nearest && minDistance < 1.5) {
                return `${nearest.city} - ${nearest.state}`;
              }

              const nearestGf = geofences.map(gf => {
                const dx = gf.latitude - lat;
                const dy = gf.longitude - lng;
                const d = Math.sqrt(dx * dx + dy * dy);
                return { gf, d };
              }).sort((a, b) => a.d - b.d)[0];

              if (nearestGf && nearestGf.gf.name) {
                const name = nearestGf.gf.name;
                if (name.includes('BAMAT')) return 'Candeias - BA';
                if (name.includes('BAVIT')) return 'Vitória - ES';
                if (name.includes('Bom Sucesso')) return 'Bom Jesus de Goiás - GO';
                if (name.includes('Work Transportes')) return 'Serra - ES';
                if (name.includes('Posto')) return 'Inhambupe - BA';
              }

              return 'Em Trânsito - BR';
            })()}
          </span>
          {(() => {
            const nearest = geofences.map(gf => {
              const R = 6371e3;
              const φ1 = vehicle.currentLatitude * Math.PI/180;
              const φ2 = gf.latitude * Math.PI/180;
              const Δφ = (gf.latitude - vehicle.currentLatitude) * Math.PI/180;
              const Δλ = (gf.longitude - vehicle.currentLongitude) * Math.PI/180;
              const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                        Math.cos(φ1) * Math.cos(φ2) *
                        Math.sin(Δλ/2) * Math.sin(Δλ/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              const d = R * c;
              return { gf, d };
            }).sort((a, b) => a.d - b.d)[0];

            if (nearest && nearest.d < (nearest.gf.radius + 1000)) {
              if (nearest.d <= nearest.gf.radius) {
                return (
                  <span className="text-[9px] text-emerald-400 font-bold mt-0.5 flex items-center gap-0.5">
                    Dentro de: {nearest.gf.name}
                  </span>
                );
              }
              return (
                <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                  Próx. a {nearest.gf.name} ({Math.round(nearest.d)}m)
                </span>
              );
            }
            return null;
          })()}
        </div>
      );
    }

    if (!vehicle) return <span className="text-slate-500 font-mono">-</span>;

    if (editingVehicleId === vehicle.id) {
      return (
        <div className="flex items-center gap-1.5 -ml-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            placeholder="Lat, Lng ou Cidade - UF"
            value={tempLocation}
            onChange={(e) => setTempLocation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveManualLocation(vehicle.id);
              } else if (e.key === 'Escape') {
                setEditingVehicleId(null);
              }
            }}
            className="bg-[#1a2236] text-white text-[11px] px-2 py-1 rounded border border-sky-500/50 focus:border-sky-500 focus:outline-none w-44 font-semibold"
            autoFocus
            disabled={isSavingLocation}
          />
          <button
            onClick={() => handleSaveManualLocation(vehicle.id)}
            disabled={isSavingLocation}
            className="p-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded transition cursor-pointer"
            title="Salvar"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => setEditingVehicleId(null)}
            disabled={isSavingLocation}
            className="p-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded transition cursor-pointer"
            title="Cancelar"
          >
            <X size={12} />
          </button>
        </div>
      );
    }

    return (
      <div 
        onClick={() => {
          setEditingVehicleId(vehicle.id);
          setTempLocation(vehicle.manualLocation || '');
        }}
        className="group flex flex-col cursor-pointer hover:bg-slate-800/50 p-1.5 -ml-1.5 rounded transition duration-200 border border-transparent hover:border-slate-700/50 max-w-[180px]"
        title="Clique para editar a localização manualmente"
      >
        {vehicle.manualLocation ? (
          <div className="flex flex-col">
            <span className="text-slate-200 flex items-center gap-1 text-[11px] font-semibold">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyCoordinates(vehicle.currentLatitude, vehicle.currentLongitude, vehicle.licensePlate);
                }}
                className="p-1 -m-1 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 rounded transition cursor-pointer flex items-center justify-center shrink-0"
                title="Clique para copiar latitude e longitude (Lat, Lng)"
              >
                <MapPin size={11} className="shrink-0" />
              </button>
              {formatLocationDisplay(vehicle.manualLocation, vehicle.currentLatitude, vehicle.currentLongitude)}
            </span>
            {(() => {
              let geofenceText = '';
              if (trip.status === 'WAITING_LOADING') {
                const gf = geofences.find(g => g.id === trip.originGeofenceId);
                if (gf) geofenceText = `Dentro de: ${gf.name}`;
              } else if (trip.status === 'WAITING_UNLOADING') {
                const gf = geofences.find(g => g.id === trip.destinationGeofenceId);
                if (gf) geofenceText = `Dentro de: ${gf.name}`;
              }

              if (vehicle.manualLocationUpdatedAt) {
                try {
                  const updatedAt = new Date(vehicle.manualLocationUpdatedAt).getTime();
                  const now = Date.now();
                  const isExpired = now - updatedAt > 60 * 60 * 1000;

                  if (isExpired) {
                    return (
                      <div className="flex flex-col">
                        <span className="text-[9px] text-rose-400 font-semibold block mt-0.5 ml-3.5 animate-pulse">
                          Atualizar localização
                        </span>
                        {geofenceText && (
                          <span className="text-[9px] text-emerald-400 font-bold block mt-0.5 ml-3.5">
                            {geofenceText}
                          </span>
                        )}
                      </div>
                    );
                  } else {
                    const d = new Date(vehicle.manualLocationUpdatedAt);
                    const time = d.toLocaleTimeString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <div className="flex flex-col">
                        <span className="text-[9px] text-emerald-400 font-semibold block mt-0.5 ml-3.5">
                          Adicionado manualmente às {time}
                        </span>
                        {geofenceText && (
                          <span className="text-[9px] text-emerald-400 font-bold block mt-0.5 ml-3.5">
                            {geofenceText}
                          </span>
                        )}
                      </div>
                    );
                  }
                } catch (e) {
                  // fallback
                }
              }
              return (
                <div className="flex flex-col">
                  <span className="text-[9px] text-emerald-400 font-semibold block mt-0.5 ml-3.5">
                    Adicionado manualmente
                  </span>
                  {geofenceText && (
                    <span className="text-[9px] text-emerald-400 font-bold block mt-0.5 ml-3.5">
                      {geofenceText}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="font-mono">-</span>
            <span className="text-[9px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
              (Clique para adicionar)
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderStatusBadge = (trip: Trip, hasTelemetry: boolean | undefined) => {
    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
    if (vehicle && vehicle.status === 'MAINTENANCE') {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border uppercase bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse"
          title="Veículo registrado em Oficina / Manutenção"
        >
          MANUTENÇÃO
        </span>
      );
    }

    if (trip.status === 'WAITING_UNLOADING' && trip.hasExitedDest) {
      const choice = unloadedChoice[trip.id];
      const hasCte = Boolean(trip.cteInfo);

      return (
        <div className="bg-[#18112e] border border-purple-500/50 p-2 rounded-xl flex flex-col gap-1.5 shadow-xl animate-fade-in text-left min-w-[185px] max-w-[210px] my-0.5">
          <div className="flex items-center gap-1 text-purple-300 font-bold text-[9px] uppercase tracking-wider">
            <AlertCircle size={12} className="text-purple-400 shrink-0 animate-pulse" />
            <span>Saída de Destino</span>
          </div>
          <p className="text-[11px] font-bold text-white leading-tight">Descarregado com sucesso?</p>
          
          <div className="flex items-center gap-1 bg-[#0a0e1a] p-1 rounded-lg border border-[#1f2d45]">
            <button
              type="button"
              onClick={() => setUnloadedChoice(prev => ({ ...prev, [trip.id]: 'SIM' }))}
              className={`flex-1 py-1 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                choice === 'SIM'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-slate-700/60'
              }`}
            >
              <Check size={11} />
              SIM
            </button>
            
            <button
              type="button"
              onClick={async () => {
                setUnloadedChoice(prev => ({ ...prev, [trip.id]: null }));
                if (onUpdateStatus) {
                  await onUpdateStatus(trip.id, 'EN_ROUTE');
                }
              }}
              className={`flex-1 py-1 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                choice === 'NAO'
                  ? 'bg-rose-600 text-white shadow'
                  : 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700/60'
              }`}
              title="Reabrir viagem no status Em Trânsito"
            >
              <X size={11} />
              NÃO
            </button>
          </div>

          {choice === 'SIM' && (
            <div className="flex flex-col gap-1 mt-0.5 animate-fade-in">
              {hasCte ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (onUpdateStatus) {
                      await onUpdateStatus(trip.id, 'DELIVERED');
                    }
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 shadow-md cursor-pointer"
                >
                  <Check size={12} />
                  CONCLUIR VIAGEM
                </button>
              ) : (
                <div className="flex flex-col gap-1 bg-amber-500/10 border border-amber-500/30 p-1.5 rounded-lg text-left">
                  <button
                    type="button"
                    disabled
                    className="w-full bg-slate-800 text-slate-500 border border-slate-700/60 text-[10px] font-bold py-1 px-2 rounded-lg flex items-center justify-center gap-1 cursor-not-allowed opacity-60"
                    title="Necessário preencher o CT-e para concluir"
                  >
                    <Check size={12} />
                    CONCLUIR (Bloqueado)
                  </button>
                  <div className="flex items-center justify-between text-[9px] text-amber-300 font-medium pt-0.5">
                    <span>⚠️ Requer CT-e</span>
                    <button
                      type="button"
                      onClick={() => setCteModalTrip(trip)}
                      className="text-sky-400 hover:underline font-bold ml-1 cursor-pointer"
                    >
                      Lançar CT-e
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (!hasTelemetry) {
      return (
        <div className="relative inline-block">
          <select
            value={trip.status === 'SCHEDULED' && trip.transitStarted ? 'START_TRANSIT' : trip.status}
            onChange={async (e) => {
              const val = e.target.value;
              if (val === 'DELIVERED' && !trip.cteInfo) {
                alert('Não é permitido concluir a viagem sem registrar o CT-e, Volume e Valor do Frete.');
                return;
              }
              if (onUpdateStatus) {
                try {
                  await onUpdateStatus(trip.id, val);
                } catch (err: any) {
                  alert('Erro ao atualizar status.');
                }
              }
            }}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase bg-[#0f172a] focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer pr-4 appearance-none ${
              trip.status === 'DELIVERED'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
                : trip.status === 'SCHEDULED'
                ? !trip.transitStarted
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/25'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/25'
                : trip.status === 'WAITING_LOADING'
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/25'
                : trip.status === 'EN_ROUTE'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/25'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/25'
            }`}
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 4px center',
              backgroundSize: '8px',
            }}
            title="Clique para alterar o status manualmente"
          >
            <option value="SCHEDULED" className="bg-[#111827] text-indigo-400 font-bold text-[10px]">1. Agendado</option>
            <option value="START_TRANSIT" className="bg-[#111827] text-amber-400 font-bold text-[10px]">1. Trânsito / Vazio</option>
            <option value="WAITING_LOADING" className="bg-[#111827] text-orange-400 font-bold text-[10px]">2. No Carregamento</option>
            <option value="EN_ROUTE" className="bg-[#111827] text-sky-400 font-bold text-[10px]">3. Em Trânsito</option>
            <option value="WAITING_UNLOADING" className="bg-[#111827] text-purple-400 font-bold text-[10px]">4. No Descarregamento</option>
            <option value="DELIVERED" className="bg-[#111827] text-emerald-400 font-bold text-[10px]">5. Concluída</option>
          </select>
        </div>
      );
    }

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
          trip.status === 'DELIVERED'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : trip.status === 'SCHEDULED'
            ? !trip.transitStarted
              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            : trip.status === 'WAITING_LOADING'
            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse'
            : trip.status === 'EN_ROUTE'
            ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 animate-pulse'
            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
        }`}
      >
        {trip.status === 'SCHEDULED'
          ? !trip.transitStarted
            ? 'Agendado'
            : 'Trânsito / Vazio'
          : trip.status === 'WAITING_LOADING'
          ? 'No Carregamento'
          : trip.status === 'EN_ROUTE'
          ? 'Em Trânsito'
          : trip.status === 'WAITING_UNLOADING'
          ? 'No Descarregamento'
          : 'Concluída'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Control Tower Alert Banner for Stopped Vehicles (> 30 min) in Active Trips */}
      {(() => {
        const stoppedOver30 = vehicles.filter(v => {
          if (v.speed > 0) return false;

          // Only show vehicles that currently have an active trip (not delivered)
          const activeTrip = trips.find(
            t => t.vehicleId === v.id && t.status !== 'DELIVERED'
          );
          if (!activeTrip) return false;

          if (selectedContractId && activeTrip.contractId !== selectedContractId) return false;

          // Must have telemetry (not missing Sascar API where speed is '-')
          const hasTelemetry = isSascarVehicle(v);
          if (!hasTelemetry) return false;

          const startTime = v.stoppedSince
            ? new Date(v.stoppedSince).getTime()
            : Date.now();
          const mins = (Date.now() - startTime) / 60000;
          return mins >= 30;
        });

        if (stoppedOver30.length === 0) return null;

        return (
          <div
            onClick={() => setStoppedAlertFilterActive(prev => !prev)}
            className={`border-2 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-amber-300 text-xs shadow-lg transition-all cursor-pointer select-none hover:scale-[1.005] ${
              stoppedAlertFilterActive
                ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                : 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/15 hover:border-amber-500/60 shadow-amber-950/30'
            }`}
          >
            <div className="flex items-start md:items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400 shrink-0 animate-pulse">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-0.5">
                <p className="font-extrabold uppercase tracking-wide text-amber-300 text-xs flex items-center gap-2 flex-wrap">
                  <span>Alerta Torre de Controle: {stoppedOver30.length} Veículo(s) em Viagem Parado(s) há mais de 30 minutos</span>
                  <span className="bg-amber-500/30 text-amber-200 text-[9px] px-2 py-0.5 rounded-full border border-amber-400/40 font-mono shrink-0">
                    Ação Necessária
                  </span>
                  {stoppedAlertFilterActive && (
                    <span className="bg-amber-400 text-amber-950 text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide shrink-0">
                      Filtro Ativo
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-amber-200/90 leading-snug">
                  <strong className="text-white">Placa(s):</strong> {stoppedOver30.map(v => {
                    const activeTrip = trips.find(t => t.vehicleId === v.id && t.status !== 'DELIVERED');
                    const driverName = v.driverName || activeTrip?.cteInfo?.motoristaNome || drivers.find(d => d.id === activeTrip?.driverId || d.id === v.driverId)?.name || 'Sem Motorista';
                    return `${v.licensePlate} (${driverName})`;
                  }).join(', ')}. Favor entrar em contato para verificar o motivo da paralisação prolongada.
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shrink-0 font-bold text-[10px] uppercase tracking-wider transition-all self-end md:self-auto ${
              stoppedAlertFilterActive
                ? 'bg-amber-400 text-amber-950 border-amber-300 shadow-md shadow-amber-500/10'
                : 'bg-amber-500/20 text-amber-300 border-amber-400/30 hover:bg-amber-500/30'
            }`}>
              <span>
                {stoppedAlertFilterActive ? 'Mostrar Todos' : 'Filtrar Lista'}
              </span>
              <Filter size={13} className={stoppedAlertFilterActive ? 'fill-amber-950' : ''} />
            </div>
          </div>
        );
      })()}

      {/* Workflow Status Stage Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {statusCards.map(card => {
          const IconComponent = card.icon;
          const isSelected = selectedStatusFilter === card.id;

          return (
            <button
              key={card.id}
              onClick={() => {
                if (selectedStatusFilter === card.id) {
                  setSelectedStatusFilter(null);
                } else {
                  setSelectedStatusFilter(card.id);
                }
              }}
              className={`text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                isSelected
                  ? card.activeClass
                  : `${card.bgClass} hover:scale-[1.02]`
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-sky-400 rounded-bl shadow-sm animate-pulse" />
              )}
              
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-300 truncate">
                    {card.title}
                  </span>
                  <div className={`p-1.5 rounded-lg shrink-0 ${card.badgeClass}`}>
                    <IconComponent size={13} />
                  </div>
                </div>
                <span className="text-2xl font-black block tracking-tight text-white my-0.5">
                  {card.count}
                </span>
              </div>

              <div className="mt-2 pt-1.5 border-t border-[#1f2d45]/60 flex items-center justify-between gap-1">
                <span className="text-[9px] text-slate-400 font-medium truncate">
                  {card.subtitle}
                </span>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${card.badgeClass}`}>
                  {card.count === 1 ? '1 veíc' : `${card.count} veícs`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Container: Trips & Vehicles Table */}
      <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1f2d45]/40 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
              {selectedStatusFilter || stoppedAlertFilterActive ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-300">Filtros Ativos:</span>
                  {selectedStatusFilter && (
                    <span className="text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded border border-sky-500/20 text-xs font-bold">
                      Etapa: {currentFilterTitle}
                    </span>
                  )}
                  {stoppedAlertFilterActive && (
                    <span className="text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 text-xs font-bold">
                      Alerta Torre de Controle
                    </span>
                  )}
                </div>
              ) : (
                'Viagens Ativas em Tempo Real'
              )}
            </h2>
            {selectedStatusFilter || stoppedAlertFilterActive ? (
              <button
                onClick={() => {
                  setSelectedStatusFilter(null);
                  setStoppedAlertFilterActive(false);
                }}
                className="flex items-center gap-1 text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded font-bold hover:bg-rose-500/20 transition cursor-pointer"
                title="Limpar todos os filtros"
              >
                <X size={12} />
                Limpar Filtro
              </button>
            ) : (
              <span className="text-[10px] text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/10">
                Simulador Online
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filtrar Contrato:</span>
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              className="bg-[#1a2236] text-white text-xs px-3 py-1.5 rounded-lg border border-[#1f2d45] focus:border-sky-500 focus:outline-none font-medium transition cursor-pointer max-w-[240px] truncate"
            >
              <option value="">Todos os Contratos</option>
              {contracts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.clientName} {c.status === 'ACTIVE' ? '(Ativo)' : c.status === 'EXPIRED' ? '(Expirado)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedStatusFilter === 'AVAILABLE' ? (
          availableVehiclesList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-[#1f2d45] rounded-xl">
              <CheckCircle2 className="text-emerald-500 w-8 h-8 mb-2" />
              <p className="text-xs font-semibold text-slate-300">Nenhum veículo disponível no momento</p>
              <p className="text-[10px] text-slate-500 max-w-xs mt-1">Todos os veículos da frota estão atualmente em viagens ativas.</p>
              <button
                onClick={() => setSelectedStatusFilter(null)}
                className="mt-3 bg-[#1a2236] hover:bg-slate-800 text-slate-300 border border-[#1f2d45] text-[10px] font-bold px-3 py-1.5 rounded cursor-pointer transition-colors"
              >
                Limpar Filtro
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Available Vehicles Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#1f2d45] text-slate-400 uppercase tracking-wider text-[9px] font-bold">
                      <th className="pb-2 pr-2">Status</th>
                      <th className="pb-2 pr-2">Caminhão / Placa</th>
                      <th className="pb-2 pr-2">Motorista</th>
                      <th className="pb-2 pr-2">Velocidade</th>
                      <th className="pb-2 pr-2">Localização Útil</th>
                      <th className="pb-2 pr-2">Etapa do Fluxo</th>
                      <th className="pb-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2d45]/40">
                    {availableVehiclesList.map(vehicle => {
                      const driver = drivers.find(d => d.id === vehicle.driverId);
                      const driverName = vehicle.driverName || driver?.name || 'Não atribuído';
                      return (
                        <tr key={vehicle.id} className="hover:bg-[#1a2236]/30 transition-colors">
                          <td className="py-2.5 font-mono text-emerald-400 font-bold text-[10px]">LIVRE</td>
                          <td className="py-2.5 pr-2">
                            <span className="block font-semibold text-slate-200">{vehicle.licensePlate}</span>
                            <span className="block text-[10px] text-slate-400">{vehicle.model}</span>
                          </td>
                          <td className="py-2.5 text-slate-300 pr-2">{driverName}</td>
                          <td className="py-2.5 text-slate-300 pr-2">{vehicle.speed ? `${vehicle.speed} km/h` : '0 km/h'}</td>
                          <td className="py-2.5 text-slate-300 pr-2">
                            <div className="flex flex-col">
                              <span className="text-slate-200 flex items-center gap-1 text-[11px] font-semibold">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyCoordinates(vehicle.currentLatitude, vehicle.currentLongitude, vehicle.licensePlate);
                                  }}
                                  className="p-1 -m-1 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded transition cursor-pointer flex items-center justify-center shrink-0"
                                  title="Clique para copiar latitude e longitude (Lat, Lng)"
                                >
                                  <MapPin size={11} className="shrink-0" />
                                </button>
                                {formatLocationDisplay(vehicle.manualLocation, vehicle.currentLatitude, vehicle.currentLongitude)}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              5. Disponível
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => onNavigate('trips')}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold px-2.5 py-1 rounded transition cursor-pointer"
                            >
                              Criar Viagem
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Available Vehicles View */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {availableVehiclesList.map(vehicle => {
                  const driver = drivers.find(d => d.id === vehicle.driverId);
                  const driverName = vehicle.driverName || driver?.name || 'Não atribuído';
                  return (
                    <div key={vehicle.id} className="bg-[#162032] border border-[#1f2d45] rounded-xl p-3.5 space-y-3 shadow-md hover:border-slate-700 transition">
                      <div className="flex items-center justify-between gap-2 border-b border-[#1f2d45]/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                            LIVRE
                          </span>
                          <span className="font-extrabold text-sm text-slate-100 tracking-wide">
                            {vehicle.licensePlate}
                          </span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          5. Disponível
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Motorista</span>
                          <span className="text-slate-200 font-semibold block truncate">{driverName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Modelo</span>
                          <span className="text-slate-200 font-semibold block truncate">{vehicle.model}</span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-[#1f2d45]/30">
                          <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Localização</span>
                          <span className="text-slate-200 flex items-center gap-1 text-[11px] font-semibold">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyCoordinates(vehicle.currentLatitude, vehicle.currentLongitude, vehicle.licensePlate);
                              }}
                              className="p-1 -m-1 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded transition cursor-pointer flex items-center justify-center shrink-0"
                              title="Clique para copiar latitude e longitude (Lat, Lng)"
                            >
                              <MapPin size={11} className="shrink-0" />
                            </button>
                            {formatLocationDisplay(vehicle.manualLocation, vehicle.currentLatitude, vehicle.currentLongitude)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#1f2d45]/60 gap-2">
                        <button
                          onClick={() => onNavigate('trips')}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition cursor-pointer text-center"
                        >
                          Criar Viagem para este Veículo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : activeFilteredTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-[#1f2d45] rounded-xl">
            <AlertTriangle className="text-amber-500 w-8 h-8 mb-2 animate-pulse" />
            <p className="text-xs font-semibold text-slate-300">
              {selectedStatusFilter
                ? `Nenhum veículo na etapa (${currentFilterTitle})`
                : 'Nenhum veículo ativo para os filtros selecionados'}
            </p>
            <p className="text-[10px] text-slate-500 max-w-xs mt-1">
              Não há viagens em andamento nesta etapa no momento.
            </p>
            {selectedStatusFilter && (
              <button
                onClick={() => setSelectedStatusFilter(null)}
                className="mt-3 bg-[#1a2236] hover:bg-slate-800 text-slate-300 border border-[#1f2d45] text-[10px] font-bold px-3 py-1.5 rounded cursor-pointer transition-colors"
              >
                Limpar Filtro
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1f2d45] text-slate-400 uppercase tracking-wider text-[9px] font-bold">
                    {renderSortHeader('ID Viagem', 'internalId')}
                    {renderSortHeader('CT-e / Ações', 'cte')}
                    {renderSortHeader('Caminhão / Placa', 'plate')}
                    {renderSortHeader('Motorista', 'driver')}
                    {renderSortHeader('Velocidade', 'speed')}
                    {renderSortHeader('Localização', 'location')}
                    {renderSortHeader('Status do Fluxo', 'status')}
                    {renderSortHeader('Rota', 'route', true)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2d45]/40">
                  {sortedActiveFilteredTrips.map(trip => {
                    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
                    const driver = drivers.find(d => d.id === trip.driverId);
                    const hasTelemetry = isSascarVehicle(vehicle);

                    const driverName = (() => {
                      const name = driver?.name || trip.cteInfo?.motoristaNome || vehicle?.driverName || 'Não informado';
                      const parts = name.split(' ');
                      if (parts.length > 1) {
                        return `${parts[0]} ${parts[parts.length - 1]}`;
                      }
                      return name;
                    })();

                    return (
                      <tr key={trip.id} className="hover:bg-[#1a2236]/30 transition-colors">
                        <td className="py-2.5 pr-2">
                          <span className="font-mono font-bold text-xs text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-1 rounded inline-block shadow-sm">
                            {getTripInternalId(trip)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2">
                          {!trip.cteInfo ? (
                            trip.status !== 'SCHEDULED' ? (
                              <button
                                onClick={() => setCteModalTrip(trip)}
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold px-2 py-1 rounded transition cursor-pointer flex items-center gap-1 shadow-sm animate-pulse"
                              >
                                <FileText size={11} />
                                Preencher CT-e
                              </button>
                            ) : (
                              <button
                                disabled
                                title="O CT-e só fica disponível para preenchimento a partir do status No Carregamento"
                                className="bg-slate-800/40 text-slate-500 border border-slate-700/40 text-[9px] font-semibold px-2 py-1 rounded cursor-not-allowed flex items-center gap-1 opacity-50"
                              >
                                <FileText size={11} />
                                Preencher CT-e
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => setCteModalTrip(trip)}
                              title={`CT-e nº ${trip.cteInfo.nCT} (Clique para ver/editar)`}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold px-2 py-1 rounded transition cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              <FileText size={11} />
                              CT-e {trip.cteInfo.nCT}
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 pr-2">
                          <span className="block font-semibold text-slate-200">{vehicle?.licensePlate || 'N/A'}</span>
                        </td>
                        <td className="py-2.5 text-slate-300 pr-2">
                          {driverName}
                        </td>
                        <td className="py-2.5 text-slate-300 pr-2">
                          <VehicleSpeedCell
                            vehicle={vehicle}
                            hasTelemetry={hasTelemetry}
                          />
                        </td>
                        <td className="py-2.5 text-slate-300 pr-2">
                          {renderLocationCell(trip, vehicle, hasTelemetry)}
                        </td>
                        <td className="py-2.5 pr-2">
                          {renderStatusBadge(trip, hasTelemetry)}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              if (onOpenRotograma) {
                                onOpenRotograma(trip);
                              } else {
                                onNavigate('map');
                              }
                            }}
                            className="bg-[#1a2236] hover:bg-slate-800 text-slate-300 border border-[#1f2d45] text-[9px] font-bold px-2.5 py-1 rounded transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <Navigation size={11} className="text-sky-400" />
                            Ver Rota no Mapa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {sortedActiveFilteredTrips.map(trip => {
                const vehicle = vehicles.find(v => v.id === trip.vehicleId);
                const driver = drivers.find(d => d.id === trip.driverId);
                const hasTelemetry = isSascarVehicle(vehicle);

                const driverName = (() => {
                  const name = driver?.name || trip.cteInfo?.motoristaNome || vehicle?.driverName || 'Não informado';
                  const parts = name.split(' ');
                  if (parts.length > 1) {
                    return `${parts[0]} ${parts[parts.length - 1]}`;
                  }
                  return name;
                })();

                return (
                  <div key={trip.id} className="bg-[#162032] border border-[#1f2d45] rounded-xl p-3.5 space-y-3 shadow-md hover:border-slate-700 transition">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#1f2d45]/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded">
                          {getTripInternalId(trip)}
                        </span>
                        <span className="font-extrabold text-sm text-slate-100 tracking-wide">
                          {vehicle?.licensePlate || 'N/A'}
                        </span>
                      </div>
                      {renderStatusBadge(trip, hasTelemetry)}
                    </div>

                    {/* Body */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Motorista</span>
                        <span className="text-slate-200 font-semibold block truncate">
                          {driverName}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Velocidade</span>
                        <VehicleSpeedCell
                          vehicle={vehicle}
                          hasTelemetry={hasTelemetry}
                        />
                      </div>

                      <div className="col-span-2 pt-1 border-t border-[#1f2d45]/30">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Localização</span>
                        {renderLocationCell(trip, vehicle, hasTelemetry)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#1f2d45]/60 gap-2">
                      {!trip.cteInfo ? (
                        trip.status !== 'SCHEDULED' ? (
                          <button
                            onClick={() => setCteModalTrip(trip)}
                            className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold py-1.5 px-3 rounded-lg transition cursor-pointer text-center flex items-center justify-center gap-1.5 animate-pulse"
                          >
                            <FileText size={14} />
                            Preencher CT-e
                          </button>
                        ) : (
                          <button
                            disabled
                            title="O CT-e só fica disponível para preenchimento a partir do status No Carregamento"
                            className="flex-1 bg-slate-800/40 text-slate-500 border border-slate-700/40 text-xs font-semibold py-1.5 px-3 rounded-lg cursor-not-allowed text-center flex items-center justify-center gap-1.5 opacity-50"
                          >
                            <FileText size={14} />
                            Preencher CT-e
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => setCteModalTrip(trip)}
                          title={`CT-e nº ${trip.cteInfo.nCT} (Clique para ver/editar)`}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold py-1.5 px-3 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <FileText size={13} />
                          CT-e {trip.cteInfo.nCT}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (onOpenRotograma) {
                            onOpenRotograma(trip);
                          } else {
                            onNavigate('map');
                          }
                        }}
                        className="flex-1 bg-[#1a2236] hover:bg-slate-800 text-slate-200 border border-[#1f2d45] text-xs font-bold py-1.5 px-3 rounded-lg transition cursor-pointer text-center flex items-center justify-center gap-1.5"
                      >
                        <Navigation size={13} className="text-sky-400" />
                        Ver Rota
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* CT-e Popup Modal */}
      <CteModal
        isOpen={Boolean(cteModalTrip)}
        onClose={() => setCteModalTrip(null)}
        trip={cteModalTrip}
        vehicles={vehicles}
        drivers={drivers}
        geofences={geofences}
        onUploadCte={async (tripId, cteData) => {
          if (onUploadCte) {
            await onUploadCte(tripId, cteData);
          }
        }}
      />
    </div>
  );
}
