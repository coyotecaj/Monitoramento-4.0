import React, { useState, useMemo } from 'react';
import { Vehicle, Driver, Geofence, Trip, Coordinate, CteInfo, Product, Contract } from '../types';
import MapComponent from '../components/MapComponent';
import { VehicleSpeedCell } from '../components/VehicleSpeedCell';
import { getTripInternalId } from '../utils/trip';
import { copyCoordinates } from '../utils/clipboard';
import {
  Play,
  ArrowRight,
  Upload,
  AlertCircle,
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
  Layers,
  Clock,
  MapPin,
  Compass,
  Shield,
  X,
  Calendar,
  TrendingUp,
  Navigation,
  Info,
  Map,
  Edit2,
  Trash2,
  Package,
  ChevronDown,
  ChevronUp,
  Wrench,
  History,
  Search,
  DollarSign,
  RotateCcw,
  CheckCircle2,
  Eye,
  Filter,
  Truck,
  LayoutList,
  Grid,
  Maximize2,
  Minimize2,
  Plus
} from 'lucide-react';

const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth radius in km
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
};

interface TripsProps {
  trips: Trip[];
  vehicles: Vehicle[];
  drivers: Driver[];
  geofences: Geofence[];
  products: Product[];
  contracts?: Contract[];
  onCreateTrip: (data: {
    vehicleId: string;
    driverId: string;
    originGeofenceId: string;
    destinationGeofenceId: string;
    scheduledLoadingDate?: string;
    productId?: string;
    contractId?: string;
    loadedVolumeM3?: number;
  }) => void;
  onUpdateTrip?: (
    id: string,
    data: {
      vehicleId?: string;
      driverId?: string;
      originGeofenceId?: string;
      destinationGeofenceId?: string;
      scheduledLoadingDate?: string;
      productId?: string;
      contractId?: string;
      loadedVolumeM3?: number;
    }
  ) => void;
  onDeleteTrip?: (id: string) => void;
  onUploadCte: (tripId: string, cteInfo: CteInfo) => void;
  onResetTrip: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onToggleRoute?: (id: string) => void;
  selectedRouteVehicleId?: string | null;
  openRotogramaTrip: Trip | null;
  onOpenRotograma: (trip: Trip | null) => void;
}

function TripCteFormCard({
  trip,
  origin,
  dest,
  driver,
  vehicle,
  onUploadCte,
}: {
  trip: Trip;
  origin?: Geofence;
  dest?: Geofence;
  driver?: Driver;
  vehicle?: Vehicle;
  onUploadCte: (tripId: string, cteData: CteInfo) => void;
}) {
  const [cteInput, setCteInput] = useState('');
  const [volumeInput, setVolumeInput] = useState('');
  const [freteInput, setFreteInput] = useState('');
  const [xmlError, setXmlError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cteInput.trim() || !volumeInput.trim() || !freteInput.trim()) {
      setXmlError('Por favor, preencha todas as informações obrigatórias.');
      return;
    }

    const parseBrazilianFloat = (val: string): number => {
      let cleaned = val.replace(/R\$/gi, '').trim();
      if (cleaned.includes('.') && cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(',', '.');
      }
      cleaned = cleaned.replace(/[^\d.]/g, '');
      return parseFloat(cleaned);
    };

    const vVolume = parseFloat(volumeInput.replace(',', '.'));
    const vFrete = parseBrazilianFloat(freteInput);

    if (isNaN(vVolume) || vVolume <= 0) {
      setXmlError('Por favor, insira um volume válido e maior que zero.');
      return;
    }
    if (isNaN(vFrete) || vFrete <= 0) {
      setXmlError('Por favor, insira um valor do frete válido e maior que zero.');
      return;
    }

    const manualCteData: CteInfo = {
      nCT: cteInput.trim(),
      serie: '1',
      chCTe: '35' + Math.floor(1000000000000 + Math.random() * 9000000000000).toString(),
      nProt: '135' + Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      dhEmi: new Date().toISOString(),
      cfop: '5352',
      emitente: {
        cnpj: '00123456000189',
        name: origin?.name || 'EMITENTE LTDA',
        city: 'Campinas',
        state: 'SP'
      },
      remetente: {
        cnpj: '44555666000100',
        name: origin?.name || 'REMETENTE LTDA',
        city: 'Campinas',
        state: 'SP'
      },
      destinatario: {
        cnpj: '77888999000188',
        name: dest?.name || 'DESTINATARIO LTDA',
        city: 'Curitiba',
        state: 'PR'
      },
      vTPrest: vFrete,
      vRec: vFrete,
      vCarga: vFrete,
      proPred: 'Carga Geral',
      motoristaNome: driver?.name || 'Motorista',
      placaVeiculo: vehicle?.licensePlate || 'TRA-0000',
      reboquePlacas: ['REB-8A90'],
      apoliceSeguro: 'APL-98234-82',
      seguradora: 'Porto Seguro',
      volume: vVolume,
      valorFrete: vFrete
    };

    onUploadCte(trip.id, manualCteData);
    setXmlError(null);
  };

  const handleSimulate = () => {
    setCteInput(Math.floor(100000 + Math.random() * 900000).toString());
    setVolumeInput((Math.floor(15 + Math.random() * 50)).toString());
    setFreteInput((Math.floor(2500 + Math.random() * 3000)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setXmlError(null);
  };

  return (
    <div className="bg-orange-500/10 border-2 border-orange-500/40 p-3.5 rounded-xl space-y-3 shadow-lg shadow-orange-950/20">
      <div className="flex gap-2.5 items-start text-orange-400">
        <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-orange-400 animate-pulse" />
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="font-extrabold text-xs text-orange-300 uppercase tracking-wide">
              Informações Pendentes ({trip.status === 'WAITING_LOADING' ? 'Status 2: Carrega' : 'CT-e Pendente'})
            </p>
            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
              Aguardando Preenchimento
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            Informe o número do CT-e, Volume e Valor do Frete abaixo para registrar os dados de carregamento.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#0a0e1a] p-3 rounded-lg border border-[#1f2d45] space-y-3">
        <div>
          <label className="block text-[10px] text-slate-300 uppercase font-bold tracking-wider mb-1">
            Número do CT-e *
          </label>
          <input
            type="text"
            required
            value={cteInput}
            onChange={e => setCteInput(e.target.value)}
            placeholder="Ex: 482394"
            className="w-full bg-[#111827] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500/60 font-mono transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[10px] text-slate-300 uppercase font-bold tracking-wider mb-1">
              Volume (m³) *
            </label>
            <input
              type="text"
              required
              value={volumeInput}
              onChange={e => setVolumeInput(e.target.value)}
              placeholder="Ex: 35"
              className="w-full bg-[#111827] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500/60 font-mono transition"
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-300 uppercase font-bold tracking-wider mb-1">
              Valor Frete (R$) *
            </label>
            <input
              type="text"
              required
              value={freteInput}
              onChange={e => setFreteInput(e.target.value)}
              placeholder="Ex: 29769,86"
              className="w-full bg-[#111827] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500/60 font-mono transition"
            />
          </div>
        </div>

        {xmlError && (
          <p className="text-[10px] text-rose-400 font-bold flex items-center gap-1.5 bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
            <AlertCircle size={12} className="shrink-0" />
            {xmlError}
          </p>
        )}

        <div className="flex justify-between items-center pt-2 gap-2 border-t border-[#1f2d45]/60">
          <button
            type="button"
            onClick={handleSimulate}
            className="text-[10px] text-sky-400 hover:text-sky-300 font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
          >
            Preencher Simulação
          </button>

          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 transition text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/30"
          >
            <CheckCircle size={13} />
            Salvar Dados de CT-e
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Trips({
  trips,
  vehicles,
  drivers,
  geofences,
  products,
  contracts = [],
  onCreateTrip,
  onUpdateTrip,
  onDeleteTrip,
  onUploadCte,
  onResetTrip,
  onUpdateStatus,
  onToggleRoute,
  selectedRouteVehicleId,
  openRotogramaTrip,
  onOpenRotograma
}: TripsProps) {
  // New Trip Creation State
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [originGeofenceId, setOriginGeofenceId] = useState('');
  const [destinationGeofenceId, setDestinationGeofenceId] = useState('');
  const [productId, setProductId] = useState('');
  const [contractId, setContractId] = useState('');
  const [loadedVolumeM3, setLoadedVolumeM3] = useState('');
  const [scheduledLoadingDate, setScheduledLoadingDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // Inline Editing State
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editVehicleId, setEditVehicleId] = useState('');
  const [editDriverId, setEditDriverId] = useState('');
  const [editOriginGeofenceId, setEditOriginGeofenceId] = useState('');
  const [editDestinationGeofenceId, setEditDestinationGeofenceId] = useState('');
  const [editProductId, setEditProductId] = useState('');
  const [editContractId, setEditContractId] = useState('');
  const [editLoadedVolumeM3, setEditLoadedVolumeM3] = useState('');
  const [editScheduledLoadingDate, setEditScheduledLoadingDate] = useState('');

  // Accordion Expand State
  const [expandedStatusTrips, setExpandedStatusTrips] = useState<Record<string, boolean>>({});

  // Completion Modal State
  const [completingTripId, setCompletingTripId] = useState<string | null>(null);
  const [completionVolumeM3, setCompletionVolumeM3] = useState('');

  // Descarregado com Sucesso? Prompt selection state
  const [unloadedChoice, setUnloadedChoice] = useState<Record<string, 'SIM' | 'NAO' | null>>({});

  const renderUnloadedPrompt = (trip: Trip) => {
    const choice = unloadedChoice[trip.id];
    const hasCte = Boolean(trip.cteInfo);

    return (
      <div className="bg-[#18112e] border border-purple-500/50 p-2.5 rounded-xl flex flex-col gap-2 shadow-xl animate-fade-in my-1 text-left w-full max-w-xs">
        <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[10px] uppercase tracking-wider">
          <AlertCircle size={13} className="text-purple-400 shrink-0 animate-pulse" />
          <span>Saída do Destino Detectada</span>
        </div>
        <p className="text-xs font-bold text-white leading-tight">Descarregado com sucesso?</p>
        
        <div className="flex items-center gap-2 bg-[#0a0e1a] p-1.5 rounded-lg border border-[#1f2d45]">
          <button
            type="button"
            onClick={() => setUnloadedChoice(prev => ({ ...prev, [trip.id]: 'SIM' }))}
            className={`flex-1 py-1 px-2.5 rounded text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
              choice === 'SIM'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-slate-700/60'
            }`}
          >
            <CheckCircle size={13} />
            SIM
          </button>
          
          <button
            type="button"
            onClick={() => {
              setUnloadedChoice(prev => ({ ...prev, [trip.id]: null }));
              onUpdateStatus(trip.id, 'EN_ROUTE');
            }}
            className={`flex-1 py-1 px-2.5 rounded text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
              choice === 'NAO'
                ? 'bg-rose-600 text-white shadow'
                : 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700/60'
            }`}
            title="Reabrir viagem no status Em Trânsito"
          >
            <XCircle size={13} />
            NÃO
          </button>
        </div>

        {choice === 'SIM' && (
          <div className="flex flex-col gap-1.5 mt-1 animate-fade-in">
            {hasCte ? (
              <button
                type="button"
                onClick={() => {
                  setCompletingTripId(trip.id);
                  setCompletionVolumeM3(trip.cteInfo?.volume?.toString() || trip.loadedVolumeM3?.toString() || '');
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <CheckCircle size={14} />
                CONCLUIR
              </button>
            ) : (
              <div className="flex flex-col gap-1 bg-amber-500/10 border border-amber-500/30 p-2 rounded-lg text-left">
                <button
                  type="button"
                  disabled
                  className="w-full bg-slate-800 text-slate-500 border border-slate-700/60 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
                  title="Necessário preencher o CT-e para concluir"
                >
                  <CheckCircle size={14} />
                  CONCLUIR (Bloqueado)
                </button>
                <div className="flex items-center justify-between text-[10px] text-amber-300 font-medium pt-0.5">
                  <span>⚠️ Requer CT-e preenchido.</span>
                  <a
                    href={`#cte-card-${trip.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(`cte-card-${trip.id}`) || document.getElementById(`cte-card-compact-${trip.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-sky-400 hover:underline font-bold ml-1 cursor-pointer"
                  >
                    Lançar CT-e
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Operational Control Board vs Completed Trips History Tab
  const [boardTab, setBoardTab] = useState<'active' | 'history'>('active');
  const [historySearch, setHistorySearch] = useState('');
  const [historyContractId, setHistoryContractId] = useState('ALL');

  // Active Trips Filtering & Compact Layout States
  const [activeSearch, setActiveSearch] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'compact' | 'cards'>('compact');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const originGeofences = geofences.filter(g => g.type === 'ORIGIN');
  const destGeofences = geofences.filter(g => g.type === 'DESTINATION');

  // Filtered lists
  const visibleVehicles = useMemo(() => vehicles.filter(v => v.visibleOnMap !== false), [vehicles]);
  const activeTrips = trips.filter(t => t.status !== 'DELIVERED' && vehicles.find(v => v.id === t.vehicleId)?.visibleOnMap !== false);
  const rawCompletedTrips = trips.filter(t => t.status === 'DELIVERED');

  const filteredActiveTrips = activeTrips.filter(t => {
    // Status filter
    if (activeStatusFilter !== 'ALL') {
      if (activeStatusFilter === 'CTE_PENDING') {
        if (t.cteInfo || t.status === 'SCHEDULED') return false;
      } else if (t.status !== activeStatusFilter) {
        return false;
      }
    }
    // Search query filter
    if (activeSearch.trim()) {
      const q = activeSearch.toLowerCase().trim();
      const vehicle = vehicles.find(v => v.id === t.vehicleId);
      const driver = drivers.find(d => d.id === t.driverId);
      const origin = geofences.find(g => g.id === t.originGeofenceId);
      const dest = geofences.find(g => g.id === t.destinationGeofenceId);
      const internalId = getTripInternalId(t).toLowerCase();
      const cteNum = t.cteInfo?.nCT?.toLowerCase() || '';

      const matchPlate = vehicle?.licensePlate?.toLowerCase().includes(q);
      const matchDriver = driver?.name?.toLowerCase().includes(q);
      const matchOrigin = origin?.name?.toLowerCase().includes(q);
      const matchDest = dest?.name?.toLowerCase().includes(q);

      if (!internalId.includes(q) && !cteNum.includes(q) && !matchPlate && !matchDriver && !matchOrigin && !matchDest) {
        return false;
      }
    }
    return true;
  });

  const filteredCompletedTrips = rawCompletedTrips.filter(t => {
    // Contract filter
    if (historyContractId !== 'ALL' && t.contractId !== historyContractId) {
      return false;
    }
    // Search query filter
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      const vehicle = vehicles.find(v => v.id === t.vehicleId);
      const driver = drivers.find(d => d.id === t.driverId);
      const origin = geofences.find(g => g.id === t.originGeofenceId);
      const dest = geofences.find(g => g.id === t.destinationGeofenceId);
      const internalId = getTripInternalId(t).toLowerCase();
      const cteNum = t.cteInfo?.nCT?.toLowerCase() || '';

      const matchPlate = vehicle?.licensePlate?.toLowerCase().includes(q);
      const matchDriver = driver?.name?.toLowerCase().includes(q);
      const matchOrigin = origin?.name?.toLowerCase().includes(q);
      const matchDest = dest?.name?.toLowerCase().includes(q);

      if (!internalId.includes(q) && !cteNum.includes(q) && !matchPlate && !matchDriver && !matchOrigin && !matchDest) {
        return false;
      }
    }
    return true;
  });

  // Completed trips KPI totals
  const totalCompletedVolume = rawCompletedTrips.reduce(
    (acc, t) => acc + (t.loadedVolumeM3 || t.cteInfo?.volume || 0),
    0
  );
  const totalCompletedFrete = rawCompletedTrips.reduce(
    (acc, t) => acc + (t.cteInfo?.vTPrest || 0),
    0
  );

  // Vehicles/Drivers helpers
  const isVehicleBusy = (tripToIgnore?: Trip) => {
    // Check if vehicle has another non-DELIVERED trip running
    return (t: Trip) => {
      if (tripToIgnore && t.id === tripToIgnore.id) return false;
      return t.status !== 'DELIVERED';
    };
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !driverId || !originGeofenceId || !destinationGeofenceId) {
      alert('Preencha os campos obrigatórios (Caminhão, Motorista, Origem e Destino).');
      return;
    }

    const selectedVehicle = vehicles.find(v => v.id === vehicleId);
    if (selectedVehicle?.status === 'MAINTENANCE') {
      alert('Não é possível agendar viagem para um veículo que está em manutenção.');
      return;
    }

    onCreateTrip({
      vehicleId,
      driverId,
      originGeofenceId,
      destinationGeofenceId,
      scheduledLoadingDate,
      productId: productId || undefined,
      contractId: contractId || undefined,
      loadedVolumeM3: loadedVolumeM3 ? Number(loadedVolumeM3) : undefined
    });

    // Reset Form
    setVehicleId('');
    setDriverId('');
    setOriginGeofenceId('');
    setDestinationGeofenceId('');
    setProductId('');
    setContractId('');
    setLoadedVolumeM3('');

    // Close Modal
    setIsScheduleModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d45] pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            type="button"
            onClick={() => setIsScheduleModalOpen(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-sky-600/25 transition flex items-center justify-center gap-2 cursor-pointer border border-sky-400/30 shrink-0"
            title="Agendar Nova Rota de Transporte"
          >
            <Calendar size={16} />
            <span>Agendar Nova Rota</span>
          </button>

          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Compass className="text-sky-400" size={24} />
              Gestão Operacional de Roteamento e Viagens
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Controle automatizado de status, aproximação em geocercas, telemetria Sascar e rotograma operacional.
            </p>
          </div>
        </div>
      </div>

      {/* Main Full-Width Operational Board Container */}
      <div className="space-y-4">
        {/* Top Bar with Tabs and Schedule Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2d45] pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-sky-600/20"
            >
              <Plus size={15} />
              <span>Agendar Nova Rota</span>
            </button>

            <button
              type="button"
              onClick={() => setBoardTab('active')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                boardTab === 'active'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                  : 'bg-[#0a0e1a] text-slate-400 hover:text-white border border-[#1f2d45]'
              }`}
            >
              <Play size={14} className="fill-current" />
              <span>Quadro Operacional (Ativas)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  boardTab === 'active' ? 'bg-sky-500/30 text-white' : 'bg-[#1f2d45] text-slate-300'
                }`}
              >
                {activeTrips.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBoardTab('history')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                boardTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-[#0a0e1a] text-slate-400 hover:text-white border border-[#1f2d45]'
              }`}
            >
              <History size={14} />
              <span>Histórico de Concluídas</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  boardTab === 'history' ? 'bg-emerald-500/30 text-white' : 'bg-[#1f2d45] text-slate-300'
                }`}
              >
                {rawCompletedTrips.length}
              </span>
            </button>
          </div>
        </div>

          {/* Filter & View Toolbar for Active Trips */}
          {boardTab === 'active' && (
            <div className="bg-[#111827] border border-[#1f2d45] p-2.5 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={activeSearch}
                    onChange={e => setActiveSearch(e.target.value)}
                    placeholder="Buscar por placa, motorista, rota..."
                    className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                  />
                  {activeSearch && (
                    <button onClick={() => setActiveSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5">
                  <Filter size={13} className="text-slate-400 shrink-0" />
                  <select
                    value={activeStatusFilter}
                    onChange={e => setActiveStatusFilter(e.target.value)}
                    className="bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500/50"
                  >
                    <option value="ALL">Todos os Status ({activeTrips.length})</option>
                    <option value="SCHEDULED">1. Agendados / Trânsito-Vazio</option>
                    <option value="WAITING_LOADING">2. No Carregamento</option>
                    <option value="EN_ROUTE">3. Em Trânsito</option>
                    <option value="WAITING_UNLOADING">4. No Descarregamento</option>
                    <option value="CTE_PENDING">⚠️ CT-e Pendente</option>
                  </select>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-[#0a0e1a] border border-[#1f2d45] p-1 rounded-lg self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('compact')}
                  className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'compact'
                      ? 'bg-sky-600 text-white shadow shadow-sky-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Visão Compacta (Tabela Operacional) - Ideal para gerenciar muitos caminhões"
                >
                  <LayoutList size={14} />
                  <span>Visão Compacta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-sky-600 text-white shadow shadow-sky-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Visão em Cards"
                >
                  <Grid size={14} />
                  <span>Cards</span>
                </button>
              </div>
            </div>
          )}

          {boardTab === 'active' && (
            <>
              {filteredActiveTrips.length === 0 ? (
                <div className="text-center py-16 bg-[#111827] border border-[#1f2d45] rounded-xl">
                  <CheckCircle className="text-sky-500/40 w-10 h-10 mx-auto mb-2" />
                  <p className="text-slate-300 text-xs font-semibold">
                    {activeTrips.length === 0
                      ? 'Nenhuma viagem ativa ou agendada'
                      : 'Nenhuma viagem encontrada com os filtros selecionados'}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-1">
                    {activeTrips.length === 0
                      ? 'Utilize o formulário de agendamento para iniciar uma nova rota.'
                      : 'Tente alterar a busca por placa, motorista ou filtro de status.'}
                  </p>
                </div>
              ) : viewMode === 'compact' ? (
                /* Compact High-Density Table View */
                <div className="bg-[#111827] border border-[#1f2d45] rounded-xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#0a0e1a] border-b border-[#1f2d45] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Viagem / Status</th>
                          <th className="py-2.5 px-3">Caminhão / Motorista</th>
                          <th className="py-2.5 px-3">Rota & Produto</th>
                          <th className="py-2.5 px-3">Telemetria (GPS)</th>
                          <th className="py-2.5 px-3 min-w-[240px]">Etapa Operacional</th>
                          <th className="py-2.5 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1f2d45]/60">
                        {filteredActiveTrips.map(trip => {
                          const vehicle = vehicles.find(v => v.id === trip.vehicleId);
                          const driver = drivers.find(d => d.id === trip.driverId);
                          const origin = geofences.find(g => g.id === trip.originGeofenceId);
                          const dest = geofences.find(g => g.id === trip.destinationGeofenceId);
                          const isExpanded = !!expandedStatusTrips[trip.id];
                          const isCtePending = !trip.cteInfo && trip.status !== 'SCHEDULED';

                          const countdown = (() => {
                            const scheduledStr = trip.scheduledLoadingDate || trip.scheduledDate;
                            if (!scheduledStr) return null;
                            const diffMs = new Date(scheduledStr).getTime() - Date.now();
                            const dateFormatted = new Date(scheduledStr).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            });

                            if (diffMs <= 0) {
                              return {
                                text: `${dateFormatted} (Atrasado)`,
                                urgent: true
                              };
                            }
                            const diffMins = Math.floor(diffMs / 60000);
                            const h = Math.floor(diffMins / 60);
                            const m = diffMins % 60;
                            return {
                              text: `${dateFormatted} (em ${h > 0 ? `${h}h ` : ''}${m}m)`,
                              urgent: false
                            };
                          })();

                          return (
                            <React.Fragment key={trip.id}>
                              <tr className={`hover:bg-[#1f2d45]/30 transition ${isCtePending ? 'bg-orange-500/5' : ''}`}>
                                {/* Viagem / Status */}
                                <td className="py-2.5 px-3 align-top">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 rounded w-fit">
                                      {getTripInternalId(trip)}
                                    </span>
                                    {trip.status === 'WAITING_UNLOADING' && trip.hasExitedDest ? (
                                      renderUnloadedPrompt(trip)
                                    ) : (
                                      <div className="flex flex-wrap items-center gap-1">
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${
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
                                        {isCtePending && (
                                          <span className="text-[9px] bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded px-1 py-0.5 font-bold uppercase animate-pulse">
                                            CT-e Pendente
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Caminhão / Motorista */}
                                <td className="py-2.5 px-3 align-top">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-white text-xs flex items-center gap-1">
                                      <Truck size={12} className="text-sky-400 shrink-0" />
                                      {vehicle?.licensePlate || 'N/A'}
                                    </span>
                                    <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={driver?.name}>
                                      {driver?.name || 'Sem motorista'}
                                    </span>
                                    {vehicle?.status === 'MAINTENANCE' && (
                                      <span className="text-[9px] text-red-400 font-bold flex items-center gap-1 mt-0.5">
                                        <Wrench size={10} /> Em Manutenção
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Rota & Produto */}
                                <td className="py-2.5 px-3 align-top">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-200">
                                      <span className="truncate max-w-[90px]" title={origin?.name}>{origin?.name || 'Origem'}</span>
                                      <ArrowRight size={10} className="text-slate-500 shrink-0" />
                                      <span className="truncate max-w-[90px]" title={dest?.name}>{dest?.name || 'Destino'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[9px] flex-wrap">
                                      {trip.productName && (
                                        <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1 py-0.2 rounded font-bold">
                                          {trip.productName}
                                        </span>
                                      )}
                                      {trip.loadedVolumeM3 && (
                                        <span className="text-slate-400 font-mono">({trip.loadedVolumeM3}m³)</span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Telemetria (GPS) */}
                                <td className="py-2.5 px-3 align-top">
                                  <VehicleSpeedCell
                                    vehicle={vehicle}
                                    hasTelemetry={!!vehicle}
                                    showLocationSubtitle={true}
                                  />
                                </td>

                                {/* Etapa Operacional */}
                                <td className="py-2.5 px-3 align-top">
                                  {vehicle && vehicle.status !== 'MAINTENANCE' ? (
                                    <div className="space-y-1">
                                      <div className="grid grid-cols-5 gap-0.5 text-center text-[8px] font-semibold">
                                        {/* Step 1 */}
                                        <div
                                          onClick={() => {
                                            if (trip.status === 'SCHEDULED' && !trip.transitStarted) {
                                              onUpdateStatus(trip.id, 'START_TRANSIT');
                                            } else {
                                              onUpdateStatus(trip.id, 'SCHEDULED');
                                            }
                                          }}
                                          className={`p-1 rounded border transition leading-tight cursor-pointer hover:bg-indigo-500/20 ${
                                            trip.status === 'SCHEDULED'
                                              ? !trip.transitStarted
                                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-bold'
                                                : 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                                              : 'bg-[#0a0e1a]/60 border-[#1f2d45]/60 text-slate-500'
                                          }`}
                                          title="1. Agendado / Trânsito-Vazio"
                                        >
                                          {!trip.transitStarted ? '1. Agend' : '1. Vazio'}
                                        </div>

                                        {/* Step 2 */}
                                        <div
                                          onClick={() => onUpdateStatus(trip.id, 'WAITING_LOADING')}
                                          className={`p-1 rounded border transition leading-tight cursor-pointer hover:bg-orange-500/20 ${
                                            trip.status === 'WAITING_LOADING'
                                              ? 'bg-orange-500/20 border-orange-500/40 text-orange-300 font-bold'
                                              : 'bg-[#0a0e1a]/60 border-[#1f2d45]/60 text-slate-500'
                                          }`}
                                          title="2. No Carregamento"
                                        >
                                          2. Carrega
                                        </div>

                                        {/* Step 3 */}
                                        <div
                                          onClick={() => onUpdateStatus(trip.id, 'EN_ROUTE')}
                                          className={`p-1 rounded border transition leading-tight cursor-pointer hover:bg-sky-500/20 ${
                                            trip.status === 'EN_ROUTE'
                                              ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 font-bold animate-pulse'
                                              : 'bg-[#0a0e1a]/60 border-[#1f2d45]/60 text-slate-500'
                                          }`}
                                          title="3. Em Trânsito"
                                        >
                                          3. Trânsito
                                        </div>

                                        {/* Step 4 */}
                                        <div
                                          onClick={() => onUpdateStatus(trip.id, 'WAITING_UNLOADING')}
                                          className={`p-1 rounded border transition leading-tight cursor-pointer hover:bg-purple-500/20 ${
                                            trip.status === 'WAITING_UNLOADING'
                                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold'
                                              : 'bg-[#0a0e1a]/60 border-[#1f2d45]/60 text-slate-500'
                                          }`}
                                          title="4. No Descarregamento"
                                        >
                                          4. Descar
                                        </div>

                                        {/* Step 5 */}
                                        <div
                                          onClick={() => {
                                            setCompletingTripId(trip.id);
                                            setCompletionVolumeM3(trip.cteInfo?.volume?.toString() || trip.loadedVolumeM3?.toString() || '');
                                          }}
                                          className={`p-1 rounded border transition leading-tight cursor-pointer ${
                                            !trip.cteInfo
                                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                                              : 'hover:bg-emerald-500/20'
                                          } ${
                                            trip.status === 'DELIVERED'
                                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                                              : 'bg-[#0a0e1a]/60 border-[#1f2d45]/60 text-slate-300'
                                          }`}
                                          title={!trip.cteInfo ? 'Concluir viagem (Volume/CT-e pendente)' : '5. Concluir'}
                                        >
                                          5. Fim
                                        </div>
                                      </div>
                                      {trip.status === 'SCHEDULED' && countdown && (
                                        <p className={`text-[8px] font-mono text-center truncate ${countdown.urgent ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                                          {countdown.text}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-red-400 font-semibold italic">Veículo em Manutenção</span>
                                  )}
                                </td>

                                {/* Ações */}
                                <td className="py-2.5 px-3 align-top text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {/* Rotograma */}
                                    <button
                                      onClick={() => onOpenRotograma(trip)}
                                      className="p-1.5 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white rounded border border-sky-500/20 transition cursor-pointer"
                                      title="Ver Rotograma"
                                    >
                                      <Compass size={13} />
                                    </button>

                                    {/* Editar */}
                                    <button
                                      onClick={() => {
                                        setEditingTripId(editingTripId === trip.id ? null : trip.id);
                                        setEditVehicleId(trip.vehicleId);
                                        setEditDriverId(trip.driverId);
                                        setEditOriginGeofenceId(trip.originGeofenceId);
                                        setEditDestinationGeofenceId(trip.destinationGeofenceId);
                                        setEditProductId(trip.productId || '');
                                        setEditContractId(trip.contractId || '');
                                        setEditLoadedVolumeM3(trip.loadedVolumeM3 ? String(trip.loadedVolumeM3) : '');
                                        setEditScheduledLoadingDate(trip.scheduledLoadingDate || trip.scheduledDate || '');
                                      }}
                                      className="p-1.5 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white rounded border border-sky-500/20 transition cursor-pointer"
                                      title="Editar Viagem"
                                    >
                                      <Edit2 size={13} />
                                    </button>

                                    {/* Excluir */}
                                    <button
                                      onClick={() => onDeleteTrip?.(trip.id)}
                                      className="p-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded border border-rose-500/20 transition cursor-pointer"
                                      title="Excluir Viagem"
                                    >
                                      <Trash2 size={13} />
                                    </button>

                                    {/* Reiniciar */}
                                    <button
                                      onClick={() => onResetTrip(trip.id)}
                                      className="p-1.5 bg-[#1a2236] hover:bg-slate-800 text-slate-300 rounded border border-[#1f2d45] transition cursor-pointer"
                                      title="Reiniciar Status"
                                    >
                                      <RefreshCw size={13} />
                                    </button>

                                    {/* Concluir Viagem */}
                                    <button
                                      disabled={trip.status !== 'WAITING_UNLOADING' || !trip.cteInfo}
                                      onClick={() => {
                                        setCompletingTripId(trip.id);
                                        setCompletionVolumeM3(trip.cteInfo?.volume?.toString() || '');
                                      }}
                                      className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                                        trip.status === 'WAITING_UNLOADING' && trip.cteInfo
                                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow cursor-pointer'
                                          : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-50'
                                      }`}
                                      title={!trip.cteInfo ? 'Requer CT-e' : 'Concluir Viagem'}
                                    >
                                      <CheckCircle size={12} />
                                      <span className="hidden xl:inline">Concluir</span>
                                    </button>

                                    {/* Expand/Collapse Toggle */}
                                    <button
                                      onClick={() => setExpandedStatusTrips(prev => ({ ...prev, [trip.id]: !prev[trip.id] }))}
                                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer ml-1"
                                      title="Expandir/Recolher Detalhes da Rota e CT-e"
                                    >
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded Accordion Row */}
                              {(isExpanded || editingTripId === trip.id) && (
                                <tr className="bg-[#0a0e1a]/95 border-b border-[#1f2d45]">
                                  <td colSpan={6} className="p-3">
                                    {/* Inline Edit Form */}
                                    {editingTripId === trip.id && (
                                      <div className="bg-[#111827] border border-sky-500/30 p-3 rounded-lg mb-3 space-y-2">
                                        <div className="flex items-center justify-between border-b border-[#1f2d45] pb-2">
                                          <span className="font-bold text-sky-400 text-xs flex items-center gap-1">
                                            <Edit2 size={12} /> Editando Viagem {getTripInternalId(trip)}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => {
                                                if (onUpdateTrip) {
                                                  onUpdateTrip(trip.id, {
                                                    vehicleId: editVehicleId,
                                                    driverId: editDriverId,
                                                    originGeofenceId: editOriginGeofenceId,
                                                    destinationGeofenceId: editDestinationGeofenceId,
                                                    scheduledLoadingDate: editScheduledLoadingDate,
                                                    productId: editProductId || undefined,
                                                    contractId: editContractId || undefined,
                                                    loadedVolumeM3: editLoadedVolumeM3 ? Number(editLoadedVolumeM3) : undefined
                                                  });
                                                }
                                                setEditingTripId(null);
                                              }}
                                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                            >
                                              <CheckCircle size={12} /> Salvar Alterações
                                            </button>
                                            <button
                                              onClick={() => setEditingTripId(null)}
                                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold transition cursor-pointer"
                                            >
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
                                          <div>
                                            <label className="text-[10px] text-slate-400 font-bold block">Veículo</label>
                                            <select
                                              value={editVehicleId}
                                              onChange={e => setEditVehicleId(e.target.value)}
                                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded p-1 text-slate-200 mt-0.5"
                                            >
                                              {vehicles.filter(v => v.visibleOnMap !== false || v.id === editVehicleId).map(v => (
                                                <option key={v.id} value={v.id}>{v.licensePlate} - {v.model}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-400 font-bold block">Motorista</label>
                                            <select
                                              value={editDriverId}
                                              onChange={e => setEditDriverId(e.target.value)}
                                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded p-1 text-slate-200 mt-0.5"
                                            >
                                              {drivers.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-indigo-400 font-bold block">Contrato</label>
                                            <select
                                              value={editContractId}
                                              onChange={e => setEditContractId(e.target.value)}
                                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded p-1 text-slate-200 mt-0.5 focus:border-indigo-500 font-semibold"
                                            >
                                              <option value="">Sem Contrato</option>
                                              {contracts.map(c => (
                                                <option key={c.id} value={c.id}>{c.clientName}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-sky-400 font-bold block">Produto</label>
                                            <select
                                              value={editProductId}
                                              onChange={e => setEditProductId(e.target.value)}
                                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded p-1 text-slate-200 mt-0.5 focus:border-sky-500 font-semibold"
                                            >
                                              <option value="">Sem Produto</option>
                                              {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-400 font-bold block">Origem</label>
                                            <select
                                              value={editOriginGeofenceId}
                                              onChange={e => setEditOriginGeofenceId(e.target.value)}
                                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded p-1 text-slate-200 mt-0.5"
                                            >
                                              {originGeofences.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-400 font-bold block">Destino</label>
                                            <select
                                              value={editDestinationGeofenceId}
                                              onChange={e => setEditDestinationGeofenceId(e.target.value)}
                                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded p-1 text-slate-200 mt-0.5"
                                            >
                                              {destGeofences.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-400 font-bold block">Data Carregamento</label>
                                            <input
                                              type="datetime-local"
                                              value={editScheduledLoadingDate}
                                              onChange={e => setEditScheduledLoadingDate(e.target.value)}
                                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded p-1 text-slate-200 mt-0.5 text-xs"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-400 font-bold block">Volume (m³)</label>
                                            <input
                                              type="number"
                                              placeholder="Ex: 35"
                                              value={editLoadedVolumeM3}
                                              onChange={e => setEditLoadedVolumeM3(e.target.value)}
                                              className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded p-1 text-slate-200 mt-0.5 text-xs"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* CT-e Requirement Form */}
                                    {!trip.cteInfo && trip.status !== 'SCHEDULED' && (
                                      <div id={`cte-card-compact-${trip.id}`} className="mb-2">
                                        <TripCteFormCard
                                          trip={trip}
                                          origin={origin}
                                          dest={dest}
                                          driver={driver}
                                          vehicle={vehicle}
                                          onUploadCte={onUploadCte}
                                        />
                                      </div>
                                    )}

                                    {/* Attached CT-e Summary */}
                                    {trip.cteInfo && (
                                      <div className="bg-[#111827] p-2.5 rounded-lg border border-emerald-500/30 flex items-center justify-between text-xs mb-2">
                                        <div className="flex items-center gap-2">
                                          <FileText size={16} className="text-emerald-400" />
                                          <div>
                                            <span className="font-bold text-slate-200">CT-e Nº {trip.cteInfo.nCT} Vinculado</span>
                                            <span className="text-[10px] text-slate-400 block font-mono">Chave: {trip.cteInfo.chCTe}</span>
                                          </div>
                                        </div>
                                        <div className="text-right font-mono text-xs">
                                          <span className="font-bold text-emerald-400">Frete: R$ {trip.cteInfo.vTPrest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                          {trip.cteInfo.volume && <span className="block text-[10px] text-sky-400">Vol: {trip.cteInfo.volume} m³</span>}
                                        </div>
                                      </div>
                                    )}

                                    {/* Distance & ETA Monitoring */}
                                    {((trip.status === 'SCHEDULED' && vehicle && origin) ||
                                      ((trip.status === 'WAITING_LOADING' || trip.status === 'EN_ROUTE') && vehicle && dest)) && (() => {
                                      const targetGeo = trip.status === 'SCHEDULED' ? origin : dest;
                                      if (!targetGeo || !vehicle) return null;
                                      const distanceKm = haversineDistance(
                                        vehicle.currentLatitude,
                                        vehicle.currentLongitude,
                                        targetGeo.latitude,
                                        targetGeo.longitude
                                      );
                                      const speed = vehicle.speed > 5 ? vehicle.speed : 60;
                                      const timeMins = Math.round((distanceKm / speed) * 60);

                                      return (
                                        <div className="border border-sky-500/25 rounded-xl p-2.5 bg-sky-950/20 flex items-center justify-between text-xs">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                                            <Navigation size={12} className="text-sky-400 animate-pulse" />
                                            Aproximação para {targetGeo.name}
                                          </span>
                                          <div className="flex items-center gap-4 font-mono font-bold">
                                            <span className="text-slate-200">Distância: {distanceKm.toFixed(2)} km</span>
                                            <span className="text-sky-300">ETA: {timeMins >= 60 ? `${Math.floor(timeMins / 60)}h ${timeMins % 60}min` : `${timeMins} min`}</span>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Cards View */
                <div className="space-y-4">
                  {filteredActiveTrips.map(trip => {
                    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
                    const driver = drivers.find(d => d.id === trip.driverId);
                    const origin = geofences.find(g => g.id === trip.originGeofenceId);
                    const dest = geofences.find(g => g.id === trip.destinationGeofenceId);

                    const countdown = (() => {
                      const scheduledStr = trip.scheduledLoadingDate || trip.scheduledDate;
                      if (!scheduledStr) return null;
                      const diffMs = new Date(scheduledStr).getTime() - Date.now();
                      const dateFormatted = new Date(scheduledStr).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      if (diffMs <= 0) {
                        return {
                          text: `Agendado para ${dateFormatted} (Início Imediato / Atrasado)`,
                          urgent: true
                        };
                      }
                      const diffMins = Math.floor(diffMs / 60000);
                      const h = Math.floor(diffMins / 60);
                      const m = diffMins % 60;
                      return {
                        text: `Agendado para ${dateFormatted} (Falta ${h > 0 ? `${h}h ` : ''}${m}min)`,
                        urgent: false
                      };
                    })();

                    return (
                      <div key={trip.id} className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3.5">
                        {/* Header Info */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#1f2d45] pb-2 gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded shadow-sm">{getTripInternalId(trip)}</span>
                              {vehicle && vehicle.status === 'MAINTENANCE' ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold border uppercase bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse">
                                  MANUTENÇÃO
                                </span>
                              ) : trip.status === 'WAITING_UNLOADING' && trip.hasExitedDest ? (
                                renderUnloadedPrompt(trip)
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
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
                              )}
                              {trip.status !== 'SCHEDULED' && !trip.cteInfo && (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded px-1.5 py-0.5 font-bold uppercase animate-pulse">
                                  <AlertCircle size={10} />
                                  CT-e Pendente
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                              <span>{origin?.name}</span>
                              <ArrowRight className="text-slate-600" size={10} />
                              <span>{dest?.name}</span>
                              {trip.productName && (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/15 rounded px-1.5 py-0.5 font-bold uppercase ml-1">
                                  <Package size={10} />
                                  {trip.productName}
                                </span>
                              )}
                              {trip.contractId && (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded px-1.5 py-0.5 font-bold uppercase">
                                  <FileText size={10} />
                                  {contracts?.find(c => c.id === trip.contractId)?.clientName || 'Contrato'}
                                  {trip.loadedVolumeM3 ? ` (${trip.loadedVolumeM3}m³)` : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          {editingTripId === trip.id && (
                            <div className="w-full bg-[#182032] border border-sky-500/40 p-3 rounded-lg my-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs shadow-md">
                              <div>
                                <label className="text-[10px] text-indigo-400 font-bold block uppercase tracking-wider">
                                  Contrato
                                </label>
                                <select
                                  value={editContractId}
                                  onChange={e => setEditContractId(e.target.value)}
                                  className="bg-[#0a0e1a] border border-[#1f2d45] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold w-full mt-1"
                                >
                                  <option value="">Sem Contrato</option>
                                  {contracts.map(c => (
                                    <option key={c.id} value={c.id}>
                                      {c.clientName}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] text-sky-400 font-bold block uppercase tracking-wider">
                                  Produto
                                </label>
                                <select
                                  value={editProductId}
                                  onChange={e => setEditProductId(e.target.value)}
                                  className="bg-[#0a0e1a] border border-[#1f2d45] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold w-full mt-1"
                                >
                                  <option value="">Sem Produto</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                                  Origem
                                </label>
                                <select
                                  value={editOriginGeofenceId}
                                  onChange={e => setEditOriginGeofenceId(e.target.value)}
                                  className="bg-[#0a0e1a] border border-[#1f2d45] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold w-full mt-1"
                                >
                                  {originGeofences.map(g => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                                  Destino
                                </label>
                                <select
                                  value={editDestinationGeofenceId}
                                  onChange={e => setEditDestinationGeofenceId(e.target.value)}
                                  className="bg-[#0a0e1a] border border-[#1f2d45] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold w-full mt-1"
                                >
                                  {destGeofences.map(g => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}

                          {/* Control Buttons */}
                          <div className="flex gap-1.5 flex-wrap">
                            {editingTripId === trip.id ? (
                              <>
                                <button
                                  onClick={() => {
                                    if (onUpdateTrip) {
                                      onUpdateTrip(trip.id, {
                                        vehicleId: editVehicleId,
                                        driverId: editDriverId,
                                        originGeofenceId: editOriginGeofenceId,
                                        destinationGeofenceId: editDestinationGeofenceId,
                                        scheduledLoadingDate: editScheduledLoadingDate,
                                        productId: editProductId || undefined,
                                        contractId: editContractId || undefined,
                                        loadedVolumeM3: editLoadedVolumeM3 ? Number(editLoadedVolumeM3) : undefined
                                      });
                                    }
                                    setEditingTripId(null);
                                  }}
                                  className="text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-600 hover:text-white transition px-2.5 py-1 rounded text-emerald-400 border border-emerald-500/25 flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle size={11} />
                                  Salvar
                                </button>
                                <button
                                  onClick={() => setEditingTripId(null)}
                                  className="text-[10px] font-bold bg-rose-500/10 hover:bg-rose-600 hover:text-white transition px-2.5 py-1 rounded text-rose-400 border border-rose-500/25 flex items-center gap-1 cursor-pointer"
                                >
                                  <X size={11} />
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingTripId(trip.id);
                                    setEditVehicleId(trip.vehicleId);
                                    setEditDriverId(trip.driverId);
                                    setEditOriginGeofenceId(trip.originGeofenceId);
                                    setEditDestinationGeofenceId(trip.destinationGeofenceId);
                                    setEditProductId(trip.productId || '');
                                    setEditContractId(trip.contractId || '');
                                    setEditLoadedVolumeM3(trip.loadedVolumeM3 ? String(trip.loadedVolumeM3) : '');
                                    setEditScheduledLoadingDate(trip.scheduledLoadingDate || trip.scheduledDate || '');
                                  }}
                                  className="text-[10px] font-bold bg-sky-500/10 hover:bg-sky-500 hover:text-white transition px-2.5 py-1 rounded text-sky-400 border border-sky-500/25 flex items-center gap-1 cursor-pointer"
                                  title="Editar viagem"
                                >
                                  <Edit2 size={11} />
                                  Editar
                                </button>
                                <button
                                  onClick={() => onDeleteTrip?.(trip.id)}
                                  className="text-[10px] font-bold bg-rose-500/10 hover:bg-rose-600 hover:text-white transition px-2.5 py-1 rounded text-rose-400 border border-rose-500/25 flex items-center gap-1 cursor-pointer"
                                  title="Excluir viagem"
                                >
                                  <Trash2 size={11} />
                                  Excluir
                                </button>
                                <button
                                  onClick={() => onOpenRotograma(trip)}
                                  className="text-[10px] font-bold bg-sky-500/10 hover:bg-sky-500 hover:text-white transition px-2.5 py-1 rounded text-sky-400 border border-sky-500/25 flex items-center gap-1 cursor-pointer"
                                  title="Ver Rotograma"
                                >
                                  <Compass size={11} />
                                  Rotograma
                                </button>
                                <button
                                  onClick={() => onResetTrip(trip.id)}
                                  className="text-[10px] font-bold bg-[#1a2236] hover:bg-slate-800 hover:text-white transition px-2 py-1 rounded text-slate-300 border border-[#1f2d45] flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw size={10} />
                                  Reiniciar
                                </button>

                                {trip.status !== 'DELIVERED' ? (
                                  <button
                                    onClick={() => {
                                      setCompletingTripId(trip.id);
                                      setCompletionVolumeM3(trip.cteInfo?.volume?.toString() || trip.loadedVolumeM3?.toString() || '');
                                    }}
                                    className="text-[10px] font-bold px-3 py-1 rounded transition flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 cursor-pointer"
                                    title="Finalizar e concluir viagem"
                                  >
                                    <CheckCircle size={11} />
                                    Concluir Viagem
                                  </button>
                                ) : (
                                  <div className="text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded text-emerald-400 flex items-center gap-1">
                                    <CheckCircle size={10} />
                                    Concluída
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Drivers / Vehicles Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border-b border-[#1f2d45]/40 pb-2">
                          <div>
                            <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wide">Caminhão</span>
                            {editingTripId === trip.id ? (
                              <select
                                value={editVehicleId}
                                onChange={e => setEditVehicleId(e.target.value)}
                                className="bg-[#0a0e1a] border border-[#1f2d45] rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500/50 font-semibold w-full mt-0.5"
                              >
                                {vehicles.filter(v => v.visibleOnMap !== false || v.id === editVehicleId).map(v => (
                                  <option key={v.id} value={v.id}>
                                    {v.licensePlate} - {v.model}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-bold text-slate-200 block mt-0.5">{vehicle?.licensePlate || 'Não informado'}</span>
                            )}
                          </div>

                          <div>
                            <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wide">Motorista</span>
                            {editingTripId === trip.id ? (
                              <select
                                value={editDriverId}
                                onChange={e => setEditDriverId(e.target.value)}
                                className="bg-[#0a0e1a] border border-[#1f2d45] rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500/50 font-semibold w-full mt-0.5"
                              >
                                {drivers.map(d => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-bold text-slate-200 block mt-0.5">
                                {driver?.name || trip.cteInfo?.motoristaNome || vehicle?.driverName || 'Não informado'}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wide">
                              {editingTripId === trip.id ? 'Data Carregamento' : 'Velocidade / GPS'}
                            </span>
                            {editingTripId === trip.id ? (
                              <input
                                type="datetime-local"
                                value={editScheduledLoadingDate}
                                onChange={e => setEditScheduledLoadingDate(e.target.value)}
                                className="bg-[#0a0e1a] border border-[#1f2d45] rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500/50 font-semibold w-full mt-0.5"
                              />
                            ) : (
                              <VehicleSpeedCell
                                vehicle={vehicle}
                                hasTelemetry={!!vehicle}
                                showLocationSubtitle={true}
                              />
                            )}
                          </div>

                          <div>
                            <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wide">Modelo</span>
                            <span className="font-bold text-slate-200 block mt-0.5">{vehicle?.model || 'Não informado'}</span>
                          </div>
                        </div>

                        {/* Maintenance Banner OR Start Transit Button */}
                        {vehicle?.status === 'MAINTENANCE' ? (
                          <div className="w-full mb-3 bg-red-500/10 border border-red-500/40 text-red-400 text-[10px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-not-allowed">
                            <Wrench size={12} className="text-red-400" />
                            VEÍCULO EM MANUTENÇÃO (AGUARDANDO LIBERAÇÃO)
                          </div>
                        ) : (
                          trip.status === 'SCHEDULED' &&
                          !trip.transitStarted && (
                            <button
                              onClick={() => onUpdateStatus(trip.id, 'START_TRANSIT')}
                              className="w-full mb-3 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-300 text-[10px] font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                              title="Iniciar a viagem para carregamento (Trânsito Vazio) manualmente"
                            >
                              <Play size={12} className="text-amber-400 fill-amber-400/20" />
                              INICIAR VIAGEM (TRÂNSITO VAZIO)
                            </button>
                          )
                        )}

                        {/* Automated State Machine */}
                        {vehicle && vehicle.status !== 'MAINTENANCE' && (
                          <div className="space-y-1.5 bg-[#0a0e1a] p-3 rounded-lg border border-[#1f2d45]/80">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                Máquina de Estados Automatizada
                              </p>
                              {trip.status === 'SCHEDULED' && countdown && (
                                <span
                                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded text-center sm:text-right ${
                                    countdown.urgent
                                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                      : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                  }`}
                                >
                                  {countdown.text}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-5 gap-1 text-center text-[8px] font-semibold">
                              {/* Step 1 */}
                              <div
                                onClick={() => {
                                  if (trip.status === 'SCHEDULED' && !trip.transitStarted) {
                                    onUpdateStatus(trip.id, 'START_TRANSIT');
                                  } else {
                                    onUpdateStatus(trip.id, 'SCHEDULED');
                                  }
                                }}
                                className={`p-1 rounded border transition leading-snug cursor-pointer hover:bg-indigo-500/20 ${
                                  trip.status === 'SCHEDULED'
                                    ? !trip.transitStarted
                                      ? 'bg-[#6366f1]/10 border-[#6366f1]/30 text-[#818cf8] font-bold'
                                      : 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#fbbf24] font-bold'
                                    : 'bg-[#111827]/40 border-[#1f2d45]/60 text-slate-500'
                                }`}
                                title="Mover para Agendado / Trânsito-Vazio"
                              >
                                <span>{!trip.transitStarted ? '1. Agendado' : '1. Trânsito / Vazio'}</span>
                              </div>

                              {/* Step 2 */}
                              <div
                                onClick={() => onUpdateStatus(trip.id, 'WAITING_LOADING')}
                                className={`p-1 rounded border transition leading-snug cursor-pointer hover:bg-orange-500/20 ${
                                  trip.status === 'WAITING_LOADING'
                                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-400 font-bold'
                                    : 'bg-[#111827]/40 border-[#1f2d45]/60 text-slate-500'
                                }`}
                                title="Mover para Carrega"
                              >
                                <span>2. Carrega</span>
                              </div>

                              {/* Step 3 */}
                              <div
                                onClick={() => onUpdateStatus(trip.id, 'EN_ROUTE')}
                                className={`p-1 rounded border transition leading-snug cursor-pointer hover:bg-sky-500/20 ${
                                  trip.status === 'EN_ROUTE'
                                    ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 font-bold animate-pulse'
                                    : 'bg-[#111827]/40 border-[#1f2d45]/60 text-slate-500'
                                }`}
                                title="Mover para Trânsito"
                              >
                                <span>3. Trânsito</span>
                              </div>

                              {/* Step 4 */}
                              <div
                                onClick={() => onUpdateStatus(trip.id, 'WAITING_UNLOADING')}
                                className={`p-1 rounded border transition leading-snug cursor-pointer hover:bg-purple-500/20 ${
                                  trip.status === 'WAITING_UNLOADING'
                                    ? 'bg-purple-500/10 border-purple-500/40 text-purple-400 font-bold'
                                    : 'bg-[#111827]/40 border-[#1f2d45]/60 text-slate-500'
                                }`}
                                title="Mover para Descarrega"
                              >
                                <span>4. Descarrega</span>
                              </div>

                              {/* Step 5 */}
                              <div
                                onClick={() => {
                                  setCompletingTripId(trip.id);
                                  setCompletionVolumeM3(trip.cteInfo?.volume?.toString() || trip.loadedVolumeM3?.toString() || '');
                                }}
                                className={`p-1 rounded border transition leading-snug cursor-pointer ${
                                  !trip.cteInfo
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                                    : 'hover:bg-emerald-500/20'
                                } ${
                                  trip.status === 'DELIVERED'
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold'
                                    : 'bg-[#111827]/40 border-[#1f2d45]/60 text-slate-300'
                                }`}
                                title={!trip.cteInfo ? 'Concluir viagem (Volume/CT-e pendente)' : 'Mover para Concluída'}
                              >
                                <span>5. Concluída</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Expand Distance & ETA Section */}
                        {((trip.status === 'SCHEDULED' && vehicle && origin) ||
                          ((trip.status === 'WAITING_LOADING' || trip.status === 'EN_ROUTE') && vehicle && dest)) && (
                          <div className="space-y-2">
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() =>
                                  setExpandedStatusTrips(prev => ({ ...prev, [trip.id]: !prev[trip.id] }))
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f2d45]/50 hover:bg-[#1f2d45] border border-[#1f2d45] rounded-lg text-[10px] font-bold text-sky-400 uppercase tracking-wider transition-all cursor-pointer"
                              >
                                {expandedStatusTrips[trip.id] ? (
                                  <>
                                    <ChevronUp size={12} className="text-sky-400" />
                                    Ocultar Detalhes de Rota e Monitoramento
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={12} className="text-sky-400" />
                                    Ver Distâncias e ETA (Expandir)
                                  </>
                                )}
                              </button>
                            </div>

                            {expandedStatusTrips[trip.id] && (() => {
                              const targetGeo = trip.status === 'SCHEDULED' ? origin : dest;
                              if (!targetGeo || !vehicle) return null;
                              const distanceKm = haversineDistance(
                                vehicle.currentLatitude,
                                vehicle.currentLongitude,
                                targetGeo.latitude,
                                targetGeo.longitude
                              );
                              const speed = vehicle.speed > 5 ? vehicle.speed : 60;
                              const timeMins = Math.round((distanceKm / speed) * 60);

                              return (
                                <div className="border border-sky-500/25 rounded-xl p-3 bg-sky-950/20 space-y-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                                    <Navigation size={12} className="text-sky-400 animate-pulse" />
                                    Monitoramento para {targetGeo.name}
                                  </span>

                                  <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="bg-[#0a0e1a]/80 p-2 rounded border border-[#1f2d45]/40 flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => copyCoordinates(targetGeo.latitude, targetGeo.longitude, targetGeo.name)}
                                        className="p-1 -m-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded transition cursor-pointer flex-shrink-0"
                                        title="Clique para copiar latitude e longitude (Lat, Lng)"
                                      >
                                        <MapPin size={16} />
                                      </button>
                                      <div>
                                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Distância</span>
                                        <span className="font-mono font-bold text-slate-200 block mt-0.5 text-xs">
                                          {distanceKm.toFixed(2)} km
                                        </span>
                                      </div>
                                    </div>

                                    <div className="bg-[#0a0e1a]/80 p-2 rounded border border-[#1f2d45]/40 flex items-center gap-2">
                                      <Clock size={16} className="text-sky-400 animate-bounce flex-shrink-0" />
                                      <div>
                                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Tempo Estimado (ETA)</span>
                                        <span className="font-mono font-bold text-slate-200 block mt-0.5 text-xs">
                                          {timeMins >= 60 ? `${Math.floor(timeMins / 60)}h ${timeMins % 60}min` : `${timeMins} min`}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* CT-e Requirement Form */}
                        {!trip.cteInfo && trip.status !== 'SCHEDULED' && (
                          <div id={`cte-card-${trip.id}`}>
                            <TripCteFormCard
                              trip={trip}
                              origin={origin}
                              dest={dest}
                              driver={driver}
                              vehicle={vehicle}
                              onUploadCte={onUploadCte}
                            />
                          </div>
                        )}

                        {/* Attached CT-e Summary */}
                        {trip.cteInfo && (
                          <div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60 flex items-center justify-between text-xs gap-4">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded">
                                <FileText size={14} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-200 text-xs">CT-e Nº {trip.cteInfo.nCT} Vinculado</p>
                                <p className="text-[9px] text-slate-400 font-mono">Chave: {trip.cteInfo.chCTe.slice(0, 20)}...</p>
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <span className="block font-bold text-slate-200">
                                Frete: R$ {trip.cteInfo.vTPrest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              {trip.cteInfo.volume !== undefined && (
                                <span className="block text-[10px] text-sky-400 font-bold">Vol: {trip.cteInfo.volume} m³</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {boardTab === 'history' && (
            <div className="space-y-4">
              {/* Completed Trips KPI Summary Widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#111827] border border-[#1f2d45] p-3.5 rounded-xl flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Viagens Realizadas</span>
                    <span className="text-lg font-mono font-bold text-white">{rawCompletedTrips.length}</span>
                  </div>
                </div>

                <div className="bg-[#111827] border border-[#1f2d45] p-3.5 rounded-xl flex items-center gap-3">
                  <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-lg">
                    <Package size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Volume Total Entregue</span>
                    <span className="text-lg font-mono font-bold text-white">{totalCompletedVolume.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m³</span>
                  </div>
                </div>

                <div className="bg-[#111827] border border-[#1f2d45] p-3.5 rounded-xl flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Frete Total Acumulado</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">
                      R$ {totalCompletedFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filters for History */}
              <div className="bg-[#111827] border border-[#1f2d45] p-3 rounded-xl flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Buscar por placa, motorista, CT-e, origem..."
                    className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  {historySearch && (
                    <button
                      onClick={() => setHistorySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter size={14} className="text-slate-400 shrink-0" />
                  <select
                    value={historyContractId}
                    onChange={e => setHistoryContractId(e.target.value)}
                    className="bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 w-full sm:w-auto"
                  >
                    <option value="ALL">Todos os Contratos</option>
                    {contracts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.clientName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* List of Completed Trips */}
              {filteredCompletedTrips.length === 0 ? (
                <div className="text-center py-12 bg-[#111827] border border-[#1f2d45] rounded-xl">
                  <History className="text-slate-600 w-10 h-10 mx-auto mb-2" />
                  <p className="text-slate-300 text-xs font-semibold">Nenhuma viagem concluída encontrada</p>
                  <p className="text-slate-500 text-[10px] mt-1">
                    {historySearch || historyContractId !== 'ALL'
                      ? 'Tente ajustar os filtros de busca acima.'
                      : 'As viagens finalizadas aparecerão aqui após a conclusão no quadro operacional.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCompletedTrips.map(trip => {
                    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
                    const driver = drivers.find(d => d.id === trip.driverId);
                    const origin = geofences.find(g => g.id === trip.originGeofenceId);
                    const dest = geofences.find(g => g.id === trip.destinationGeofenceId);
                    const contract = contracts.find(c => c.id === trip.contractId);
                    const product = products.find(p => p.id === trip.productId);

                    return (
                      <div key={trip.id} className="bg-[#111827] border border-emerald-500/20 rounded-xl p-4 space-y-3 hover:border-emerald-500/40 transition shadow-lg shadow-black/20">
                        {/* Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2d45] pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                              {getTripInternalId(trip)}
                            </span>
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-1">
                              <CheckCircle size={10} />
                              Viagem Concluída
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-mono text-slate-400 block">
                              Finalizado: {trip.deliveryDate ? new Date(trip.deliveryDate).toLocaleString('pt-BR') : 'Recentemente'}
                            </span>
                          </div>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          {/* Truck & Driver */}
                          <div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60 space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-500 block">Veículo & Motorista</span>
                            <div className="flex items-center gap-2 text-slate-200 font-bold">
                              <Truck size={14} className="text-sky-400 shrink-0" />
                              <span>{vehicle?.licensePlate || 'N/A'}</span>
                              <span className="text-[10px] text-slate-400 font-normal">({vehicle?.model || 'Desconhecido'})</span>
                            </div>
                            <p className="text-[11px] text-slate-300 truncate">
                              Motorista: <strong className="text-white">{driver?.name || 'N/A'}</strong>
                            </p>
                          </div>

                          {/* Route & Geofences */}
                          <div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60 space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-500 block">Rota Percorrida</span>
                            <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-[11px]">
                              <MapPin size={12} className="text-emerald-400 shrink-0" />
                              <span className="truncate">{origin?.name || 'Origem'}</span>
                              <ArrowRight size={10} className="text-slate-500 shrink-0" />
                              <span className="truncate">{dest?.name || 'Destino'}</span>
                            </div>
                            {(contract || product) && (
                              <p className="text-[10px] text-slate-400 truncate">
                                {contract?.clientName ? `Cliente: ${contract.clientName}` : ''}
                                {product?.name ? ` | Prod: ${product.name}` : ''}
                              </p>
                            )}
                          </div>

                          {/* CT-e & Volume */}
                          <div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60 space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-500 block">Dados do Carregamento</span>
                            {trip.cteInfo ? (
                              <div>
                                <p className="font-bold text-slate-200 text-xs flex items-center gap-1">
                                  <FileText size={12} className="text-emerald-400" />
                                  CT-e Nº {trip.cteInfo.nCT}
                                </p>
                                <p className="text-[10px] text-emerald-400 font-mono font-bold">
                                  Frete: R$ {trip.cteInfo.vTPrest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                                {trip.cteInfo.volume && (
                                  <p className="text-[10px] text-sky-400 font-mono">Vol CT-e: {trip.cteInfo.volume} m³</p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="text-slate-400 text-[11px]">Sem CT-e emitido</p>
                                {trip.loadedVolumeM3 && (
                                  <p className="text-[10px] text-sky-400 font-mono font-bold">Vol Descarregado: {trip.loadedVolumeM3} m³</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons footer */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1f2d45]/60 text-xs">
                          <button
                            type="button"
                            onClick={() => onOpenRotograma(trip)}
                            className="bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Compass size={13} />
                            Ver Rotograma / Rota Realizada
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onResetTrip(trip.id);
                              }}
                              className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer"
                              title="Reabre a viagem enviando de volta ao quadro operacional"
                            >
                              <RotateCcw size={13} />
                              Reabrir Viagem
                            </button>

                            {onDeleteTrip && (
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteTrip(trip.id);
                                }}
                                className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Excluir histórico de viagem"
                              >
                                <Trash2 size={13} />
                                Excluir
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      {/* Completion Modal Overlay */}
      {completingTripId && (() => {
        const trip = trips.find(t => t.id === completingTripId);
        if (!trip) return null;

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0b1329] border border-[#1f2d45] rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
              <div className="bg-[#111c3a] px-6 py-4 border-b border-[#1f2d45] flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-500/10 p-1.5 rounded text-emerald-400">
                    <CheckCircle size={16} />
                  </div>
                  <h3 className="text-white font-bold tracking-wide">Viagem Concluída com Sucesso</h3>
                </div>
                <button onClick={() => setCompletingTripId(null)} className="text-slate-400 hover:text-white transition cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-300">
                  Por favor, confirme o volume que foi descarregado para atualizar o progresso do contrato vinculado.
                </p>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                    Volume Descarregado (m³)
                  </label>
                  <input
                    type="number"
                    value={completionVolumeM3}
                    onChange={e => setCompletionVolumeM3(e.target.value)}
                    className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>

              <div className="bg-[#111c3a] px-6 py-4 border-t border-[#1f2d45] flex justify-end gap-2">
                <button
                  onClick={() => setCompletingTripId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (onUpdateTrip && completionVolumeM3) {
                      onUpdateTrip(completingTripId, {
                        loadedVolumeM3: Number(completionVolumeM3)
                      });
                    }
                    onUpdateStatus(completingTripId, 'DELIVERED');
                    setCompletingTripId(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 transition text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle size={14} />
                  Confirmado
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Agendar Nova Rota */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl relative animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#1f2d45] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="text-sky-400" size={20} />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Agendar Nova Rota</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#1f2d45] transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              {/* Vehicle Select */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Caminhão (Sascar) *
                </label>
                <select
                  value={vehicleId}
                  onChange={e => setVehicleId(e.target.value)}
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500/50"
                  required
                >
                  <option value="">Selecione um caminhão...</option>
                  {visibleVehicles.map(v => (
                    <option key={v.id} value={v.id} disabled={v.status === 'MAINTENANCE'}>
                      {v.licensePlate} - {v.model} {v.status === 'MAINTENANCE' ? '(EM MANUTENÇÃO)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Driver Select */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Motorista *
                </label>
                <select
                  value={driverId}
                  onChange={e => setDriverId(e.target.value)}
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500/50"
                  required
                >
                  <option value="">Selecione um motorista...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.cpf})
                    </option>
                  ))}
                </select>
              </div>

              {/* Origin & Destination Geofences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Origem (Pátio/Base) *
                  </label>
                  <select
                    value={originGeofenceId}
                    onChange={e => setOriginGeofenceId(e.target.value)}
                    className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500/50"
                    required
                  >
                    <option value="">Origem...</option>
                    {originGeofences.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Destino (Cliente) *
                  </label>
                  <select
                    value={destinationGeofenceId}
                    onChange={e => setDestinationGeofenceId(e.target.value)}
                    className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500/50"
                    required
                  >
                    <option value="">Destino...</option>
                    {destGeofences.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product & Contract */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Produto
                  </label>
                  <select
                    value={productId}
                    onChange={e => setProductId(e.target.value)}
                    className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500/50"
                  >
                    <option value="">Sem Produto</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Contrato
                  </label>
                  <select
                    value={contractId}
                    onChange={e => setContractId(e.target.value)}
                    className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500/50"
                  >
                    <option value="">Sem Contrato</option>
                    {contracts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.clientName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Volume & Scheduled Loading Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Volume Estimado (m³)
                  </label>
                  <input
                    type="number"
                    value={loadedVolumeM3}
                    onChange={e => setLoadedVolumeM3(e.target.value)}
                    placeholder="Ex: 35"
                    className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500/50 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Data/Hora Agendada *
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledLoadingDate}
                    onChange={e => setScheduledLoadingDate(e.target.value)}
                    className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500/50 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#1f2d45]">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer shadow-lg shadow-sky-600/20"
                >
                  <Play size={14} className="fill-white" />
                  Agendar Rota Operacional
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
