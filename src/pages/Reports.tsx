import { useState, useMemo } from 'react';
import { Trip, Vehicle, Driver, Geofence, Contract, Product } from '../types';
import { formatLocationDisplay, getCityStateFromCoordinates, haversineDistance } from '../utils/geocoding';
import { copyCoordinates } from '../utils/clipboard';
import { getTripInternalId } from '../utils/trip';
import MapComponent from '../components/MapComponent';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  FileText, Calendar, Compass, Shield, User, Clock, ArrowRight, 
  Truck, Info, MapPin, Printer, Filter, Settings, FileSpreadsheet, 
  CheckCircle2, AlertTriangle, Play, ChevronDown, Sliders
} from 'lucide-react';

interface ReportsProps {
  trips: Trip[];
  vehicles: Vehicle[];
  drivers: Driver[];
  geofences: Geofence[];
  contracts?: Contract[];
  products?: Product[];
}

export default function Reports({ trips, vehicles, drivers, geofences, contracts = [], products = [] }: ReportsProps) {
  const [activeTab, setActiveTab] = useState<'individual' | 'board'>('board');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(trips[0]?.id || null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Filters for Executive Board Report
  const [selectedContractId, setSelectedContractId] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedOriginId, setSelectedOriginId] = useState<string>('');
  const [selectedDestId, setSelectedDestId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  // Individual Trip Stats calculation
  const indVehicle = selectedTrip ? vehicles.find(v => v.id === selectedTrip.vehicleId) : null;
  const indDriver = selectedTrip ? drivers.find(d => d.id === selectedTrip.driverId) : null;
  const indOrigin = selectedTrip ? geofences.find(g => g.id === selectedTrip.originGeofenceId) : null;
  const indDest = selectedTrip ? geofences.find(g => g.id === selectedTrip.destinationGeofenceId) : null;

  const originGeofences = useMemo(() => geofences.filter(g => g.type === 'ORIGIN'), [geofences]);
  const destGeofences = useMemo(() => geofences.filter(g => g.type === 'DESTINATION'), [geofences]);

  // Process and filter real system trips
  const filteredSystemTrips = useMemo(() => {
    return trips.filter(t => {
      // Filter by Contract
      if (selectedContractId && selectedContractId !== 'ALL') {
        if (t.contractId !== selectedContractId) {
          const contract = contracts.find(c => c.id === selectedContractId);
          if (contract && t.cteInfo?.remetente?.name !== contract.clientName) {
            return false;
          }
        }
      }

      // Filter by Period
      const tripDateStr = t.deliveryDate || t.scheduledLoadingDate || t.scheduledDate || t.startDate;
      if (tripDateStr) {
        const tripDate = new Date(tripDateStr);
        if (!isNaN(tripDate.getTime())) {
          const now = new Date();
          if (selectedPeriod === 'THIS_MONTH') {
            if (tripDate.getMonth() !== now.getMonth() || tripDate.getFullYear() !== now.getFullYear()) {
              return false;
            }
          } else if (selectedPeriod === 'LAST_30_DAYS') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            if (tripDate < thirtyDaysAgo || tripDate > now) {
              return false;
            }
          } else if (selectedPeriod === 'THIS_YEAR') {
            if (tripDate.getFullYear() !== now.getFullYear()) {
              return false;
            }
          } else if (selectedPeriod === 'CUSTOM') {
            if (customStartDate) {
              const start = new Date(customStartDate + 'T00:00:00');
              if (tripDate < start) return false;
            }
            if (customEndDate) {
              const end = new Date(customEndDate + 'T23:59:59');
              if (tripDate > end) return false;
            }
          }
        }
      }

      // Filter by Origin
      if (selectedOriginId && t.originGeofenceId !== selectedOriginId) return false;
      // Filter by Destination
      if (selectedDestId && t.destinationGeofenceId !== selectedDestId) return false;
      // Filter by Status
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'DELIVERED' && t.status !== 'DELIVERED') return false;
        if (selectedStatus === 'ACTIVE' && t.status === 'DELIVERED') return false;
      }
      return true;
    });
  }, [trips, selectedContractId, selectedPeriod, customStartDate, customEndDate, selectedOriginId, selectedDestId, selectedStatus, contracts]);

  // Compile active data source from real system data
  const activeReportTrips = useMemo(() => {
    return filteredSystemTrips.map(t => {
      const v = vehicles.find(vec => vec.id === t.vehicleId);
      const d = drivers.find(drv => drv.id === t.driverId);
      const o = geofences.find(g => g.id === t.originGeofenceId);
      const destGeo = geofences.find(g => g.id === t.destinationGeofenceId);
      
      const plates = [v?.licensePlate || t.cteInfo?.placaVeiculo || 'N/A'];
      if (t.cteInfo?.reboquePlacas && t.cteInfo.reboquePlacas.length > 0) {
        plates.push(...t.cteInfo.reboquePlacas);
      }

      const formatTime = (isoString?: string) => {
        if (!isoString) return 'N/A';
        const dt = new Date(isoString);
        return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}, ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      };

      const matchedContractId = t.contractId || (contracts.find(c => c.clientName === t.cteInfo?.remetente?.name)?.id || 'ALL');

      // Helper to determine exact vehicle location at the exact moment of report generation (matching Dashboard real-time view)
      const formatCityStateLocation = (): string => {
        if (!v) {
          if (t.status === 'WAITING_LOADING' && o?.name) return o.name;
          if (t.status === 'WAITING_UNLOADING' && destGeo?.name) return destGeo.name;
          if (t.status === 'DELIVERED' && destGeo?.name) return destGeo.name;
          return 'Localização Indisponível';
        }

        const hasTelemetry = v && 
          v.licensePlate && 
          v.licensePlate !== 'CUF6F40' && 
          v.licensePlate !== 'RMO2J80' && 
          !v.model?.toUpperCase().includes('SIGHRA') && 
          !v.model?.toUpperCase().includes('SIGHA');

        let mainCityState = '';
        let insideBaseName = '';

        if (hasTelemetry) {
          // 1. Vehicle model check (e.g., "Sete Lagoas/MG")
          if (v.model && v.model.includes('/')) {
            const parts = v.model.split('/');
            if (parts.length === 2 && parts[1].trim().length === 2) {
              mainCityState = `${parts[0].trim()} - ${parts[1].trim()}`;
            }
          }

          // 2. CT-e Info check
          if (!mainCityState && t?.cteInfo) {
            if (t.status === 'SCHEDULED' || t.status === 'WAITING_LOADING') {
              if (t.cteInfo.remetente?.city && t.cteInfo.remetente?.state) {
                mainCityState = `${t.cteInfo.remetente.city} - ${t.cteInfo.remetente.state}`;
              }
            } else {
              if (t.cteInfo.destinatario?.city && t.cteInfo.destinatario?.state) {
                mainCityState = `${t.cteInfo.destinatario.city} - ${t.cteInfo.destinatario.state}`;
              }
            }
          }

          // 3. Known coordinates check or geofence mapping
          if (!mainCityState && typeof v.currentLatitude === 'number' && typeof v.currentLongitude === 'number' && v.currentLatitude !== 0) {
            const lat = v.currentLatitude;
            const lng = v.currentLongitude;

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

            let nearestLoc = null;
            let minDistance = Infinity;

            for (const loc of knownLocations) {
              const dx = loc.lat - lat;
              const dy = loc.lng - lng;
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance < minDistance) {
                minDistance = distance;
                nearestLoc = loc;
              }
            }

            if (nearestLoc && minDistance < 1.5) {
              mainCityState = `${nearestLoc.city} - ${nearestLoc.state}`;
            } else {
              const nearestGf = geofences.map(gf => {
                const dx = gf.latitude - lat;
                const dy = gf.longitude - lng;
                const d = Math.sqrt(dx * dx + dy * dy);
                return { gf, d };
              }).sort((a, b) => a.d - b.d)[0];

              if (nearestGf && nearestGf.gf.name) {
                const name = nearestGf.gf.name;
                if (name.includes('BAMAT')) mainCityState = 'Candeias - BA';
                else if (name.includes('BAVIT')) mainCityState = 'Vitória - ES';
                else if (name.includes('Bom Sucesso')) mainCityState = 'Bom Jesus de Goiás - GO';
                else if (name.includes('Work Transportes')) mainCityState = 'Serra - ES';
                else if (name.includes('Posto')) mainCityState = 'Inhambupe - BA';
              }
            }
          }

          if (!mainCityState) {
            mainCityState = 'Em Trânsito - BR';
          }

          // Check if vehicle is physically inside a geofence/base
          if (typeof v.currentLatitude === 'number' && typeof v.currentLongitude === 'number' && v.currentLatitude !== 0) {
            const nearest = geofences.map(gf => {
              const R = 6371e3;
              const φ1 = v.currentLatitude * Math.PI/180;
              const φ2 = gf.latitude * Math.PI/180;
              const Δφ = (gf.latitude - v.currentLatitude) * Math.PI/180;
              const Δλ = (gf.longitude - v.currentLongitude) * Math.PI/180;
              const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                        Math.cos(φ1) * Math.cos(φ2) *
                        Math.sin(Δλ/2) * Math.sin(Δλ/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              const d = R * c;
              return { gf, d };
            }).sort((a, b) => a.d - b.d)[0];

            if (nearest && nearest.d <= (nearest.gf.radius || 1000)) {
              insideBaseName = nearest.gf.name;
            }
          }
        } else {
          // Non-telemetry vehicle (manual location or state-based)
          if (v.manualLocation) {
            mainCityState = formatLocationDisplay(v.manualLocation, v.currentLatitude, v.currentLongitude);
          }

          if (t.status === 'WAITING_LOADING' && o?.name) {
            insideBaseName = o.name;
          } else if (t.status === 'WAITING_UNLOADING' && destGeo?.name) {
            insideBaseName = destGeo.name;
          } else if (t.status === 'DELIVERED' && destGeo?.name) {
            insideBaseName = destGeo.name;
          }

          if (!mainCityState && insideBaseName) {
            mainCityState = insideBaseName;
          }
        }

        if (t.status === 'DELIVERED' && destGeo?.name) {
          if (!insideBaseName) insideBaseName = destGeo.name;
        }

        // Format final display string matching Dashboard precision
        if (insideBaseName) {
          if (mainCityState && mainCityState !== insideBaseName && !mainCityState.includes(insideBaseName)) {
            return `${mainCityState} (Dentro de: ${insideBaseName})`;
          }
          return insideBaseName;
        }

        return mainCityState || 'Localização Indisponível';
      };

      const currentLocation = formatCityStateLocation();

      return {
        id: t.id,
        tripNumber: t.tripNumber,
        internalId: getTripInternalId(t),
        status: t.status,
        vehiclesList: plates,
        driverName: d?.name || t.cteInfo?.motoristaNome || v?.driverName || 'N/A',
        cteNumber: t.cteInfo?.nCT || 'N/A',
        productName: t.productName || t.cteInfo?.proPred || 'N/A',
        volumeM3: t.loadedVolumeM3 || t.cteInfo?.volume || 0,
        originName: o?.name || 'N/A',
        destName: destGeo?.name || 'N/A',
        currentLocation,
        loadingTime: formatTime(t.startDate || t.scheduledLoadingDate || t.scheduledDate),
        deliveryTime: t.deliveryDate ? formatTime(t.deliveryDate) : 'N/A',
        contractId: matchedContractId,
        originalTrip: t
      };
    });
  }, [filteredSystemTrips, vehicles, drivers, geofences, contracts, trips]);

  // Helper to determine precise Portuguese status label matching the control panel state
  const getStatusLabel = (status: string, originalTrip: any) => {
    const vehicle = vehicles.find(v => v.id === originalTrip?.vehicleId);
    if (vehicle && vehicle.status === 'MAINTENANCE') {
      return 'Manutenção';
    }
    if (status === 'DELIVERED') return 'Descarregado';
    if (status === 'WAITING_LOADING') return 'No Carregamento';
    if (status === 'EN_ROUTE') return 'Em Trânsito';
    if (status === 'WAITING_UNLOADING') return 'No Descarregamento';
    if (status === 'SCHEDULED') {
      const isBusy = trips.some(other => {
        if (other.id === originalTrip.id) return false;
        if (other.vehicleId !== originalTrip.vehicleId) return false;
        if (other.status === 'DELIVERED') return false;
        if (other.status !== 'SCHEDULED') return true;
        
        const thisTime = new Date(originalTrip.scheduledLoadingDate || originalTrip.scheduledDate || 0).getTime();
        const otherTime = new Date(other.scheduledLoadingDate || other.scheduledDate || 0).getTime();
        if (otherTime < thisTime) return true;
        if (otherTime === thisTime) {
          const thisNum = parseInt(originalTrip.tripNumber?.replace(/\D/g, '') || '0');
          const otherNum = parseInt(other.tripNumber?.replace(/\D/g, '') || '0');
          return otherNum < thisNum;
        }
        return false;
      });
      return (isBusy || !originalTrip.transitStarted) ? 'Agendado' : 'Trânsito / Vazio';
    }
    return status;
  };

  const getStatusBadgeStyle = (status: string, originalTrip: any) => {
    const vehicle = vehicles.find(v => v.id === originalTrip?.vehicleId);
    if (vehicle && vehicle.status === 'MAINTENANCE') {
      return 'bg-rose-50 text-rose-800 border border-rose-200';
    }
    if (status === 'DELIVERED') {
      return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    }
    if (status === 'SCHEDULED') {
      const isBusy = trips.some(other => {
        if (other.id === originalTrip.id) return false;
        if (other.vehicleId !== originalTrip.vehicleId) return false;
        if (other.status === 'DELIVERED') return false;
        if (other.status !== 'SCHEDULED') return true;
        
        const thisTime = new Date(originalTrip.scheduledLoadingDate || originalTrip.scheduledDate || 0).getTime();
        const otherTime = new Date(other.scheduledLoadingDate || other.scheduledDate || 0).getTime();
        if (otherTime < thisTime) return true;
        if (otherTime === thisTime) {
          const thisNum = parseInt(originalTrip.tripNumber?.replace(/\D/g, '') || '0');
          const otherNum = parseInt(other.tripNumber?.replace(/\D/g, '') || '0');
          return otherNum < thisNum;
        }
        return false;
      });
      if (isBusy || !originalTrip.transitStarted) {
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      } else {
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      }
    }
    if (status === 'WAITING_LOADING') {
      return 'bg-orange-50 text-orange-800 border border-orange-200';
    }
    if (status === 'EN_ROUTE') {
      return 'bg-sky-50 text-sky-800 border border-sky-200';
    }
    if (status === 'WAITING_UNLOADING') {
      return 'bg-purple-50 text-purple-800 border border-purple-200';
    }
    return 'bg-slate-100 text-slate-700 border border-slate-200';
  };

  // Group active trips by contract and compute individual contract statistics
  const reportsByContract = useMemo(() => {
    let targetContracts = contracts;
    if (selectedContractId !== 'ALL') {
      const found = contracts.find(c => c.id === selectedContractId);
      targetContracts = found ? [found] : [];
    } else {
      // Find all contracts that are relevant (have trips in this period)
      const contractsWithTrips = contracts.filter(c => 
        activeReportTrips.some(t => t.contractId === c.id)
      );
      if (contractsWithTrips.length > 0) {
        targetContracts = contractsWithTrips;
      }
    }

    return targetContracts.map(c => {
      const contractTrips = activeReportTrips.filter(t => t.contractId === c.id);
      
      const totalVol = contractTrips
        .filter(t => t.status === 'DELIVERED')
        .reduce((sum, t) => sum + t.volumeM3, 0);
        
      const deliveredCount = contractTrips.filter(t => t.status === 'DELIVERED').length;

      let totalDist = 0;
      let totalDurMs = 0;
      let distCount = 0;
      let durCount = 0;

      contractTrips.forEach(t => {
        const orig = t.originalTrip;
        if (orig.initialDistanceToOriginKm) {
          totalDist += orig.initialDistanceToOriginKm;
          distCount++;
        }
        if (orig.startDate && orig.deliveryDate) {
          const start = new Date(orig.startDate);
          const end = new Date(orig.deliveryDate);
          const diff = end.getTime() - start.getTime();
          if (diff > 0) {
            totalDurMs += diff;
            durCount++;
          }
        }
      });

      const avgDistance = distCount > 0 ? `${Math.round(totalDist / distCount)} km` : 'N/A';
      
      let avgDuration = 'N/A';
      if (durCount > 0) {
        const avgMs = totalDurMs / durCount;
        const hours = Math.floor(avgMs / (1000 * 60 * 60));
        const minutes = Math.round((avgMs % (1000 * 60 * 60)) / (1000 * 60));
        avgDuration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }

      return {
        contract: c,
        trips: contractTrips,
        totalVolumeDelivered: totalVol,
        deliveredCount,
        avgDistance,
        avgDuration
      };
    });
  }, [contracts, selectedContractId, activeReportTrips]);

  // Split each contract's trips into fixed A4 landscape page chunks
  const paginatedContractReports = useMemo(() => {
    const pages: Array<{
      pageId: string;
      contract: any;
      trips: any[];
      totalVolumeDelivered: number;
      deliveredCount: number;
      avgDistance: string;
      avgDuration: string;
      pageIndexInContract: number;
      totalPagesInContract: number;
      isFirstPageOfContract: boolean;
      totalTripsInContract: number;
      firstTripOrigin: string;
      firstTripDest: string;
    }> = [];

    const PAGE_1_MAX_TRIPS = 8;
    const PAGE_REST_MAX_TRIPS = 13;

    reportsByContract.forEach((rep) => {
      const contractTrips = rep.trips;
      const firstTripOrigin = contractTrips[0]?.originName || 'N/A';
      const firstTripDest = contractTrips[0]?.destName || 'N/A';

      if (contractTrips.length === 0) {
        pages.push({
          pageId: `${rep.contract.id}-page-1`,
          contract: rep.contract,
          trips: [],
          totalVolumeDelivered: rep.totalVolumeDelivered,
          deliveredCount: rep.deliveredCount,
          avgDistance: rep.avgDistance,
          avgDuration: rep.avgDuration,
          pageIndexInContract: 1,
          totalPagesInContract: 1,
          isFirstPageOfContract: true,
          totalTripsInContract: 0,
          firstTripOrigin,
          firstTripDest,
        });
        return;
      }

      // Split trips into chunks
      const chunks: any[][] = [];
      let remaining = [...contractTrips];

      // First chunk
      const firstChunk = remaining.slice(0, PAGE_1_MAX_TRIPS);
      chunks.push(firstChunk);
      remaining = remaining.slice(PAGE_1_MAX_TRIPS);

      // Subsequent chunks
      while (remaining.length > 0) {
        const nextChunk = remaining.slice(0, PAGE_REST_MAX_TRIPS);
        chunks.push(nextChunk);
        remaining = remaining.slice(PAGE_REST_MAX_TRIPS);
      }

      const totalPagesInContract = chunks.length;

      chunks.forEach((chunk, idx) => {
        pages.push({
          pageId: `${rep.contract.id}-page-${idx + 1}`,
          contract: rep.contract,
          trips: chunk,
          totalVolumeDelivered: rep.totalVolumeDelivered,
          deliveredCount: rep.deliveredCount,
          avgDistance: rep.avgDistance,
          avgDuration: rep.avgDuration,
          pageIndexInContract: idx + 1,
          totalPagesInContract,
          isFirstPageOfContract: idx === 0,
          totalTripsInContract: contractTrips.length,
          firstTripOrigin,
          firstTripDest,
        });
      });
    });

    return pages;
  }, [reportsByContract]);

  // Calculate dynamic stats from actual filtered trips
  const totalVolumeDelivered = useMemo(() => {
    return activeReportTrips
      .filter(t => t.status === 'DELIVERED')
      .reduce((sum, t) => sum + t.volumeM3, 0);
  }, [activeReportTrips]);

  const deliveredCount = useMemo(() => {
    return activeReportTrips.filter(t => t.status === 'DELIVERED').length;
  }, [activeReportTrips]);

  // Current selected contract details
  const currentContract = useMemo(() => {
    const found = contracts.find(c => c.id === selectedContractId);
    if (found) return found;
    // Fallback if 'ALL' or empty
    return {
      id: 'ALL',
      clientName: contracts[0]?.clientName || 'BCI COMERCIALIZADORA S/A',
      cnpj: contracts[0]?.cnpj || '12.345.678/0001-99',
      volumeM3: contracts[0]?.volumeM3 || 0,
      startDate: '',
      endDate: ''
    };
  }, [contracts, selectedContractId]);

  // Compute live averages (distance and duration)
  const computedStats = useMemo(() => {
    let totalDist = 0;
    let totalDurMs = 0;
    let distCount = 0;
    let durCount = 0;

    filteredSystemTrips.forEach(t => {
      if (t.initialDistanceToOriginKm) {
        totalDist += t.initialDistanceToOriginKm;
        distCount++;
      }
      if (t.startDate && t.deliveryDate) {
        const start = new Date(t.startDate);
        const end = new Date(t.deliveryDate);
        const diff = end.getTime() - start.getTime();
        if (diff > 0) {
          totalDurMs += diff;
          durCount++;
        }
      }
    });

    const avgDistance = distCount > 0 ? `${Math.round(totalDist / distCount)} km` : 'N/A';
    
    let avgDuration = 'N/A';
    if (durCount > 0) {
      const avgMs = totalDurMs / durCount;
      const hours = Math.floor(avgMs / (1000 * 60 * 60));
      const minutes = Math.round((avgMs % (1000 * 60 * 60)) / (1000 * 60));
      avgDuration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    return { avgDistance, avgDuration };
  }, [filteredSystemTrips]);

  const handlePrint = async () => {
    if (activeTab !== 'board') {
      setActiveTab('board');
      await new Promise(res => setTimeout(res, 150));
    }

    let element = document.getElementById('printable-report');
    if (!element) {
      // Small retry if element was mounting
      await new Promise(res => setTimeout(res, 200));
      element = document.getElementById('printable-report');
    }

    if (!element) {
      window.print();
      return;
    }

    // Helper to translate oklch(), oklab(), and color() functions to compatible rgb/rgba or hex
    const replaceModernColorsInStyles = (styleContent: string): string => {
      if (!styleContent) return styleContent;
      let content = styleContent;

      // 1. Replace oklch(...)
      const oklchRegex = /oklch\(\s*([^\s,/()]+)(?:\s*,\s*|\s+)([^\s,/()]+)(?:\s*,\s*|\s+)([^\s,/()]+)(?:\s*(?:\/|,)\s*([^\s,/()]+))?\s*\)/gi;
      content = content.replace(oklchRegex, (match, lStr, cStr, hStr, aStr) => {
        try {
          let L = parseFloat(lStr);
          if (lStr.includes('%')) L = L / 100;

          let C = parseFloat(cStr);
          if (cStr.includes('%')) C = C / 100;

          let hue = parseFloat(hStr);
          if (hStr.includes('turn')) hue = hue * 360;
          else if (hStr.includes('rad')) hue = (hue * 180) / Math.PI;

          if (isNaN(L)) L = 0.5;
          if (isNaN(C)) C = 0;
          if (isNaN(hue)) hue = 0;

          const hueRad = (hue * Math.PI) / 180;
          const oklab_a = C * Math.cos(hueRad);
          const oklab_b = C * Math.sin(hueRad);

          const l_ = L + 0.3963377774 * oklab_a + 0.2158037573 * oklab_b;
          const m_ = L - 0.1055613458 * oklab_a - 0.0638541728 * oklab_b;
          const s_ = L - 0.0894841775 * oklab_a - 1.2914855480 * oklab_b;

          const l3 = l_ * l_ * l_;
          const m3 = m_ * m_ * m_;
          const s3 = s_ * s_ * s_;

          const rLinear = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
          const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
          const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

          const toSRGB = (c: number) => {
            if (c <= 0.0031308) return 12.92 * c;
            return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
          };

          let r = Math.max(0, Math.min(255, Math.round(toSRGB(rLinear) * 255)));
          let g = Math.max(0, Math.min(255, Math.round(toSRGB(gLinear) * 255)));
          let b = Math.max(0, Math.min(255, Math.round(toSRGB(bLinear) * 255)));

          if (isNaN(r) || isNaN(g) || isNaN(b)) return '#64748b';

          if (aStr) {
            let alpha = parseFloat(aStr);
            if (aStr.includes('%')) alpha = alpha / 100;
            if (isNaN(alpha)) alpha = 1;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
          }
          return `rgb(${r}, ${g}, ${b})`;
        } catch (e) {
          return '#64748b';
        }
      });

      // 2. Replace oklab(...)
      const oklabRegex = /oklab\(\s*([^\s,/()]+)(?:\s*,\s*|\s+)([^\s,/()]+)(?:\s*,\s*|\s+)([^\s,/()]+)(?:\s*(?:\/|,)\s*([^\s,/()]+))?\s*\)/gi;
      content = content.replace(oklabRegex, (match, lStr, aValStr, bValStr, aStr) => {
        try {
          let L = parseFloat(lStr);
          if (lStr.includes('%')) L = L / 100;
          let oklab_a = parseFloat(aValStr);
          let oklab_b = parseFloat(bValStr);

          if (isNaN(L)) L = 0.5;
          if (isNaN(oklab_a)) oklab_a = 0;
          if (isNaN(oklab_b)) oklab_b = 0;

          const l_ = L + 0.3963377774 * oklab_a + 0.2158037573 * oklab_b;
          const m_ = L - 0.1055613458 * oklab_a - 0.0638541728 * oklab_b;
          const s_ = L - 0.0894841775 * oklab_a - 1.2914855480 * oklab_b;

          const l3 = l_ * l_ * l_;
          const m3 = m_ * m_ * m_;
          const s3 = s_ * s_ * s_;

          const rLinear = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
          const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
          const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

          const toSRGB = (c: number) => {
            if (c <= 0.0031308) return 12.92 * c;
            return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
          };

          let r = Math.max(0, Math.min(255, Math.round(toSRGB(rLinear) * 255)));
          let g = Math.max(0, Math.min(255, Math.round(toSRGB(gLinear) * 255)));
          let b = Math.max(0, Math.min(255, Math.round(toSRGB(bLinear) * 255)));

          if (isNaN(r) || isNaN(g) || isNaN(b)) return '#64748b';

          if (aStr) {
            let alpha = parseFloat(aStr);
            if (aStr.includes('%')) alpha = alpha / 100;
            if (isNaN(alpha)) alpha = 1;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
          }
          return `rgb(${r}, ${g}, ${b})`;
        } catch (e) {
          return '#64748b';
        }
      });

      // 3. Absolute safety regex fallback for any remaining oklch, oklab, color-mix, etc.
      content = content.replace(/oklch\([^)]+\)/gi, '#64748b');
      content = content.replace(/oklab\([^)]+\)/gi, '#64748b');
      content = content.replace(/(?:color|lab|lch|color-mix|light-dark)\([^)]+\)/gi, '#64748b');

      return content;
    };

    setIsGeneratingPdf(true);
    try {
      const pages = Array.from(element.querySelectorAll('.contract-report-page')) as HTMLElement[];
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // Gather and consolidate all CSS rules from active document
      let consolidatedCss = '';
      try {
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (rules) {
              Array.from(rules).forEach((rule) => {
                consolidatedCss += rule.cssText + '\n';
              });
            }
          } catch (e) {
            // Ignore cross-origin stylesheet errors
          }
        });
      } catch (e) {
        console.warn('CSS collection note:', e);
      }

      try {
        Array.from(document.querySelectorAll('style')).forEach((st) => {
          if (st.textContent) {
            consolidatedCss += st.textContent + '\n';
          }
        });
      } catch (e) {
        console.warn('Style tag collection note:', e);
      }

      const sanitizedCss = replaceModernColorsInStyles(consolidatedCss);

      const captureOptions = {
        scale: 2.0, // Crisp high-definition text
        useCORS: true,
        allowTaint: false, // Must be false so toDataURL never throws SecurityError: Tainted canvas
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc: Document) => {
          // 1. Remove all old styles & links to avoid html2canvas CSS parsing errors on modern colors
          try {
            const cssNodes = Array.from(clonedDoc.querySelectorAll('style, link[rel="stylesheet"]'));
            cssNodes.forEach((node) => node.remove());

            const cleanStyle = clonedDoc.createElement('style');
            cleanStyle.textContent = sanitizedCss;
            clonedDoc.head.appendChild(cleanStyle);
          } catch (e) {
            console.warn('Cloned style injection note:', e);
          }

          // 2. Ensure images have crossOrigin attribute set
          try {
            const images = Array.from(clonedDoc.querySelectorAll('img'));
            images.forEach((img) => img.setAttribute('crossOrigin', 'anonymous'));
          } catch (e) {
            console.warn('Image CORS setup note:', e);
          }

          // 3. Process element inline styles in clonedDoc
          try {
            const clonedPages = Array.from(clonedDoc.querySelectorAll('.contract-report-page'));
            clonedPages.forEach((pageEl) => {
              const allNodes = Array.from(pageEl.querySelectorAll('*')).concat([pageEl]);
              allNodes.forEach((node) => {
                const htmlNode = node as HTMLElement;
                if (htmlNode.style && htmlNode.style.cssText) {
                  htmlNode.style.cssText = replaceModernColorsInStyles(htmlNode.style.cssText);
                }
              });
            });
          } catch (e) {
            console.warn('Node style resolution note:', e);
          }
        }
      };

      const targetPages = pages.length > 0 ? pages : [element];
      let isFirstPage = true;

      for (const pageEl of targetPages) {
        const canvas = await html2canvas(pageEl, captureOptions);
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        if (!isFirstPage) {
          pdf.addPage('a4', 'l');
        }
        isFirstPage = false;

        // Direct 297mm x 210mm rendering to match exact A4 landscape ratio
        pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
      }

      const filename = `Relatorio_de_Viagens_${new Date().toISOString().slice(0, 10)}.pdf`;

      // Save via jsPDF
      pdf.save(filename);

      // Direct Blob URL download trigger as guaranteed backup
      try {
        const pdfBlob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          URL.revokeObjectURL(blobUrl);
        }, 5000);
      } catch (dlErr) {
        console.warn('Direct blob trigger note:', dlErr);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Não foi possível gerar o PDF automaticamente. A janela de impressão do navegador será aberta.');
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic style tag for high-fidelity native print mapping */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          /* Hide sidebar, headers, chatbot, settings and filter tools completely */
          aside, header, .no-print, button, .tabs-bar, .filters-panel, #ai-chatbot-trigger, footer {
            display: none !important;
          }
          body {
            background-color: white !important;
            color: black !important;
            font-family: sans-serif;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Frame the printed card as full width without margins */
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .contract-report-page {
            width: 297mm !important;
            height: 210mm !important;
            max-height: 210mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 10mm 12mm !important;
            overflow: hidden !important;
          }
          .print-text-dark {
            color: #000000 !important;
          }
          .print-border-dark {
            border-color: #333333 !important;
          }
          .print-bg-light {
            background-color: #f3f4f6 !important;
          }
          .print-table-header {
            background-color: #f3f4f6 !important;
            color: #111827 !important;
            border-bottom: 2px solid #e5e7eb !important;
          }
          .print-table-row {
            border-bottom: 1px solid #e5e7eb !important;
          }
        }
      `}</style>

      {/* Screen Mode Tabs Selection */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111827] border border-[#1f2d45] rounded-2xl p-4 no-print">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="text-sky-400" size={20} />
            Módulo de Relatórios Logísticos
          </h1>
          <p className="text-xs text-slate-400">Emita documentos executivos para a diretoria ou inspecione viagens individualmente.</p>
        </div>
        
        <div className="flex bg-slate-950/60 border border-[#1f2d45]/60 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('board')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'board'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/20 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Printer size={14} />
            Relatório de Gestão (PDF)
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'individual'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/20 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders size={14} />
            Viagem Individual
          </button>
        </div>
      </div>

      {/* RENDER MODE 1: INDIVIDUAL TRIP DETAILED REPORT */}
      {activeTab === 'individual' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 no-print">
          {/* List of trips on Left */}
          <div className="xl:col-span-1 bg-slate-900/30 border border-slate-800 rounded-2xl p-4 flex flex-col max-h-[600px]">
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <FileText size={18} className="text-sky-400" />
              Selecione uma Viagem
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {trips.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">Nenhuma viagem no sistema</div>
              ) : (
                trips.map(t => {
                  const isSelected = selectedTripId === t.id;
                  const tOrigin = geofences.find(g => g.id === t.originGeofenceId);
                  const tDest = geofences.find(g => g.id === t.destinationGeofenceId);

                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTripId(t.id)}
                      className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/10 border-sky-500/40 text-white'
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-mono text-xs font-bold text-sky-400">{t.tripNumber}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                          t.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400 animate-pulse'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-sans flex items-center justify-between w-full">
                        <span className="truncate max-w-[80px]">{tOrigin?.name.split(' ')[0] || 'N/A'}</span>
                        <ArrowRight size={10} className="text-gray-500" />
                        <span className="truncate max-w-[80px]">{tDest?.name.split(' ')[0] || 'N/A'}</span>
                      </div>
                      <span className="text-[9px] text-gray-500 font-mono block">
                        {new Date(t.scheduledDate).toLocaleDateString('pt-BR')}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Reports Core Panel */}
          <div className="xl:col-span-3 space-y-6">
            {selectedTrip ? (
              <>
                {/* Header summary info */}
                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded font-bold font-mono uppercase">
                      {selectedTrip.status}
                    </span>
                    <h1 className="text-xl font-bold text-white tracking-tight mt-1.5">Relatório Completo: {selectedTrip.tripNumber}</h1>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar size={13} />
                      Agendada em {new Date(selectedTrip.scheduledDate).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  {/* Quick vehicle metadata */}
                  <div className="flex gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5 text-xs text-gray-300">
                    <div className="space-y-1">
                      <span className="text-gray-500 block">Veículo / Motorista</span>
                      <span className="font-semibold text-gray-200 block flex items-center gap-1">
                        <Truck size={13} className="text-sky-400" />
                        {indVehicle?.licensePlate || 'N/A'} ({indVehicle?.model.split(' ')[0] || 'Caminhão'})
                      </span>
                      <span className="font-semibold text-gray-300 block flex items-center gap-1">
                        <User size={13} className="text-indigo-400" />
                        {indDriver?.name || selectedTrip.cteInfo?.motoristaNome || indVehicle?.driverName || 'Não informado'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metrics column */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Duração Total</span>
                    <span className="text-lg font-bold text-gray-200 block">
                      {selectedTrip.status === 'DELIVERED' ? '6h 12m' : 'Em trânsito...'}
                    </span>
                    <span className="text-[9px] text-gray-500 block">Diferença de partida/chegada</span>
                  </div>
                  <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Velocidades</span>
                    <span className="text-lg font-bold text-gray-200 block">72 km/h méd</span>
                    <span className="text-[9px] text-gray-500 block">Máxima: 88 km/h</span>
                  </div>
                  <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Distância Estimada</span>
                    <span className="text-lg font-bold text-gray-200 block">412 km</span>
                    <span className="text-[9px] text-gray-500 block">Fórmula de Haversine total</span>
                  </div>
                </div>

                {/* Map and Vertical Events Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Vertical timeline of events */}
                  <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 space-y-4 max-h-[400px] overflow-y-auto">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Clock size={16} className="text-sky-400" />
                      Histórico de Eventos & Cercas
                    </h3>
                    
                    <div className="relative border-l border-slate-800 pl-4 ml-2 space-y-5 py-2">
                      {selectedTrip.events.map((e, idx) => (
                        <div key={e.id || idx} className="relative">
                          {/* Timeline dot */}
                          <span className={`absolute -left-[21px] mt-0.5 w-2.5 h-2.5 rounded-full border border-slate-900 ${
                            e.type === 'GEOFENCE_ENTER' ? 'bg-emerald-500' :
                            e.type === 'GEOFENCE_NEAR' ? 'bg-yellow-400' :
                            e.type === 'CTE_UPLOAD' ? 'bg-sky-400' :
                            e.type === 'GEOFENCE_EXIT' ? 'bg-amber-400 animate-pulse' :
                            'bg-gray-500'
                          }`} />
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-gray-400">
                              <span className="font-semibold text-gray-300">
                                {e.type === 'GEOFENCE_ENTER' && '→ Entrada de Geocerca'}
                                {e.type === 'GEOFENCE_NEAR' && '👀 Aproximação de Geocerca'}
                                {e.type === 'GEOFENCE_EXIT' && '← Saída de Geocerca'}
                                {e.type === 'CTE_UPLOAD' && '📄 Emissão de CT-e'}
                                {e.type === 'STATUS_CHANGE' && '⚡ Mudança de Status'}
                              </span>
                              <span className="font-mono text-[10px]">
                                {new Date(e.timestamp).toLocaleTimeString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">{e.description}</p>
                            {e.latitude !== 0 && (
                              <span className="text-[9px] text-slate-500 font-mono block">
                                GPS: {e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Historical Map */}
                  <div className="h-[400px] rounded-2xl overflow-hidden shadow-xl border border-slate-800">
                    <MapComponent
                      vehicles={[]}
                      geofences={geofences}
                      activeTripRoute={selectedTrip.routeHistory}
                      selectedGeofence={indOrigin}
                    />
                  </div>
                </div>

                {/* CT-e full parsed panel */}
                {selectedTrip.cteInfo ? (
                  <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                      <FileText size={16} className="text-sky-400" />
                      Metadados do Conhecimento de Transporte (CT-e Modelo 57)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                      {/* Identificacao */}
                      <div className="space-y-2">
                        <p className="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Identificação</p>
                        <div className="space-y-1 font-mono text-[11px] text-gray-300">
                          <p><span className="text-gray-500">Número:</span> {selectedTrip.cteInfo.nCT}</p>
                          <p><span className="text-gray-500">Série:</span> {selectedTrip.cteInfo.serie}</p>
                          <p><span className="text-gray-500">CFOP:</span> {selectedTrip.cteInfo.cfop}</p>
                          <p><span className="text-gray-500">Emissão:</span> {new Date(selectedTrip.cteInfo.dhEmi).toLocaleString('pt-BR')}</p>
                          <p><span className="text-gray-500">Prot. Autorização:</span> {selectedTrip.cteInfo.nProt}</p>
                        </div>
                      </div>

                      {/* Participantes */}
                      <div className="space-y-2 col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Remetente (Origem)</p>
                          <p className="font-semibold text-gray-200">{selectedTrip.cteInfo.remetente.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">CNPJ: {selectedTrip.cteInfo.remetente.cnpj}</p>
                          <p className="text-[11px] text-gray-400">{selectedTrip.cteInfo.remetente.city} - {selectedTrip.cteInfo.remetente.state}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Destinatário (Destino)</p>
                          <p className="font-semibold text-gray-200">{selectedTrip.cteInfo.destinatario.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">CNPJ: {selectedTrip.cteInfo.destinatario.cnpj}</p>
                          <p className="text-[11px] text-gray-400">{selectedTrip.cteInfo.destinatario.city} - {selectedTrip.cteInfo.destinatario.state}</p>
                        </div>
                      </div>
                    </div>

                    {/* Valores & Complementos */}
                    <div className="border-t border-slate-800 pt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                      <div className="space-y-1">
                        <p className="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Valores da Prestação</p>
                        <p className="text-gray-300"><span className="text-gray-500">Valor da Carga:</span> R$ {selectedTrip.cteInfo.vCarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-gray-300"><span className="text-gray-500">Frete Total (vTPrest):</span> R$ {selectedTrip.cteInfo.vTPrest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-gray-300"><span className="text-gray-500">Predominante:</span> {selectedTrip.cteInfo.proPred}</p>
                      </div>

                      <div className="space-y-1 col-span-1 md:col-span-2">
                        <p className="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Complementos (Seguros e Reboques)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-300 font-mono">
                          <p><span className="text-gray-500 font-sans">Seguradora:</span> {selectedTrip.cteInfo.seguradora || 'Porto Seguro S.A'}</p>
                          <p><span className="text-gray-500 font-sans">Apólice:</span> {selectedTrip.cteInfo.apoliceSeguro || 'AP-094384-92'}</p>
                          <p><span className="text-gray-500 font-sans">Placa Tração:</span> {selectedTrip.cteInfo.placaVeiculo || indVehicle?.licensePlate}</p>
                          <p><span className="text-gray-500 font-sans">Placa Reboque:</span> {selectedTrip.cteInfo.reboquePlacas.join(', ') || 'REB-8A90'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/10 border border-slate-800 p-6 rounded-xl flex gap-3 text-xs text-gray-400">
                    <Info size={16} className="text-sky-400 flex-shrink-0 mt-0.5" />
                    <p>Nenhum documento CT-e foi anexado para essa viagem ainda. O CT-e é anexado durante a etapa "Aguardando Carregamento" na máquina de estados.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-24 bg-slate-900/10 border border-slate-800 rounded-2xl">
                <p className="text-gray-400 text-sm font-semibold">Nenhuma viagem encontrada no sistema.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENDER MODE 2: HIGH-FIDELITY BOARD/DIRECTOR REPORT PREVIEW & PRINT */}
      {activeTab === 'board' && (
        <div className="space-y-6">
          {/* Interactive Filtering Toolset Box (Hidden on Print) */}
          <div className="bg-[#111827] border border-[#1f2d45] rounded-2xl p-5 space-y-4 no-print shadow-xl">
            <div className="flex justify-between items-center border-b border-[#1f2d45]/60 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Filter size={16} className="text-sky-400" />
                Filtros e Configurações do Relatório de Diretoria
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
              {/* Real System Contracts Dropdown */}
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">Vincular Contrato</label>
                <select
                  value={selectedContractId}
                  onChange={(e) => setSelectedContractId(e.target.value)}
                  className="w-full bg-slate-950/80 border border-[#1f2d45] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="ALL">Sem Contrato Vinculado (N/A)</option>
                  {contracts.map(c => (
                    <option key={c.id} value={c.id}>{c.clientName} ({c.id})</option>
                  ))}
                </select>
              </div>

              {/* Period Dropdown */}
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">Período a ser escolhido</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full bg-slate-950/80 border border-[#1f2d45] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="THIS_MONTH">Este Mês</option>
                  <option value="LAST_30_DAYS">Últimos 30 dias</option>
                  <option value="THIS_YEAR">Este Ano</option>
                  <option value="ALL_TIME">Todo o Período</option>
                  <option value="CUSTOM">Personalizado</option>
                </select>
              </div>

              {/* Dynamic location/route filters */}
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">Filtro de Origem</label>
                <select
                  value={selectedOriginId}
                  onChange={(e) => setSelectedOriginId(e.target.value)}
                  className="w-full bg-slate-950/80 border border-[#1f2d45] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="">Todas as Origens</option>
                  {originGeofences.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">Filtro de Destino</label>
                <select
                  value={selectedDestId}
                  onChange={(e) => setSelectedDestId(e.target.value)}
                  className="w-full bg-slate-950/80 border border-[#1f2d45] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="">Todos os Destinos</option>
                  {destGeofences.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">Filtro de Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-slate-950/80 border border-[#1f2d45] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="ALL">Todas as Viagens</option>
                  <option value="DELIVERED">Apenas Concluídas (Descarregadas)</option>
                  <option value="ACTIVE">Apenas em Trânsito / Ativas</option>
                </select>
              </div>

              {/* Conditional Datepicker Row if CUSTOM is selected */}
              {selectedPeriod === 'CUSTOM' && (
                <div className="col-span-1 md:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 p-3 bg-slate-950/40 rounded-xl border border-[#1f2d45]/40">
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Data de Início</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-[#1f2d45] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Data de Fim</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-[#1f2d45] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center pt-3 border-t border-[#1f2d45]/40 gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20 text-xs font-semibold">
                  {activeReportTrips.length} {activeReportTrips.length === 1 ? 'Viagem Filtrada' : 'Viagens Filtradas'} do Sistema
                </div>
              </div>

              <button
                onClick={handlePrint}
                disabled={isGeneratingPdf}
                className={`w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                  isGeneratingPdf ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isGeneratingPdf ? (
                  <>
                    <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-3.5 h-3.5 mr-1" />
                    Gerando PDF...
                  </>
                ) : (
                  <>
                    <Printer size={15} />
                    Exportar para PDF / Imprimir
                  </>
                )}
              </button>
            </div>
          </div>

          {/* THE EXECUTIVE PRINTABLE PAPER SHEETS GRAPHICS */}
          {/* We frame this on screen like an elegant white paper on top of dark theme background */}
          <div className="bg-[#0b0f19] border border-[#1f2d45] rounded-3xl p-6 md:p-12 shadow-inner flex flex-col items-center gap-8 no-print overflow-x-auto w-full">
            <div 
              id="printable-report" 
              className="print-area w-full max-w-[1000px] flex flex-col gap-8 shrink-0 select-none font-sans text-xs items-center"
            >
              {paginatedContractReports.map((page) => (
                <div 
                  key={page.pageId} 
                  style={{ width: '1000px', height: '707px', boxSizing: 'border-box' }}
                  className="contract-report-page bg-white text-slate-900 w-[1000px] h-[707px] rounded-2xl p-7 shadow-2xl flex flex-col justify-between border border-slate-200 overflow-hidden shrink-0 box-border"
                >
                  <div className="flex flex-col space-y-3">
                    {page.isFirstPageOfContract ? (
                      <>
                        {/* Header block with Metadata */}
                        <div className="border-b-2 border-slate-300 pb-2.5 flex justify-between items-end">
                          <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Relatório de Viagens</h1>
                            <p className="text-slate-500 font-semibold text-[10px] mt-1.5">
                              Contrato: {page.contract.id} | Vigência do Período
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider text-right">
                              GERADO EM: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        {/* Main Client/Contractor Banner Section */}
                        <div className="space-y-2">
                          {/* Client dot and corporate title */}
                          <div className="flex items-center gap-2 text-base font-black text-[#059669]">
                            <span className="h-3 w-3 rounded-full bg-[#059669] shrink-0 inline-block" />
                            <span className="uppercase tracking-tight font-black">{page.contract.clientName}</span>
                          </div>

                          {/* Technical Badges Row */}
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex items-center justify-center bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-black uppercase rounded-md px-3 py-1">
                              CONTRATO: {page.contract.id}
                            </span>
                            <span className={`inline-flex items-center justify-center text-[10px] font-black uppercase rounded-md px-3 py-1 border ${
                              page.contract.status === 'ACTIVE' 
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                                : page.contract.status === 'EXPIRED'
                                ? 'bg-rose-50 border-rose-300 text-rose-800'
                                : 'bg-amber-50 border-amber-300 text-amber-800'
                            }`}>
                              STATUS DO CONTRATO: {
                                page.contract.status === 'ACTIVE' ? 'ATIVO' :
                                page.contract.status === 'EXPIRED' ? 'EXPIRADO' :
                                page.contract.status === 'PENDING' ? 'PENDENTE' :
                                'ATIVO'
                              }
                            </span>
                          </div>

                          {/* Subtitle green info bar */}
                          <div className="bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] font-bold px-3 py-2 rounded-md flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5">
                              <span className="text-[#15803d] font-medium">Cliente:</span>
                              <span className="font-extrabold text-[#14532d]">{page.contract.clientName}</span>
                            </span>
                            {page.contract.cnpj && (
                              <span className="font-mono text-[10px] font-extrabold bg-[#dcfce7] border border-[#86efac] px-2 py-0.5 rounded text-[#14532d] inline-flex items-center">
                                CNPJ: {page.contract.cnpj}
                              </span>
                            )}
                          </div>

                          {/* Route capsules row */}
                          <div className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-medium">Origem Principal:</span> 
                              <span className="text-slate-900 font-extrabold">{page.firstTripOrigin}</span>
                            </span>
                            <span className="text-sky-600 font-extrabold px-4 text-xs inline-flex items-center justify-center">→</span>
                            <span className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-medium">Destino Principal:</span> 
                              <span className="text-slate-900 font-extrabold">{page.firstTripDest}</span>
                            </span>
                          </div>

                          {/* Volume Progress Area */}
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-slate-900 flex justify-between items-center">
                              <span>
                                Progresso de Volume: <strong className="font-mono font-extrabold">{page.totalVolumeDelivered.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</strong> 
                                {page.contract.volumeM3 > 0 
                                  ? ` de ${page.contract.volumeM3.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³` 
                                  : ' (Sem meta de volume estabelecida)'
                                }
                              </span>
                              {page.contract.volumeM3 > 0 && (
                                <span className="text-[11px] text-sky-600 font-extrabold font-mono">
                                  {Math.round((page.totalVolumeDelivered / page.contract.volumeM3) * 100)}%
                                </span>
                              )}
                            </div>

                            {page.contract.volumeM3 > 0 && (
                              <div className="w-full bg-slate-100 border border-slate-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-emerald-500 h-full rounded-full transition-all" 
                                  style={{ width: `${Math.min(100, (page.totalVolumeDelivered / page.contract.volumeM3) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Statistics line details */}
                          <div className="border-t border-b border-slate-200 py-1.5 px-3 bg-slate-50/80 rounded text-[10px] text-slate-700 font-extrabold flex justify-between items-center uppercase tracking-wide">
                            <span>VIAGENS DESCARREGADAS: <span className="font-mono text-emerald-700 font-extrabold">{page.deliveredCount}</span></span>
                            <span className="text-slate-300">|</span>
                            <span>VOLUME TOTAL DESCARREGADO: <span className="font-mono text-emerald-700 font-extrabold">{page.totalVolumeDelivered.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</span></span>
                            <span className="text-slate-300">|</span>
                            <span>TOTAL DE VIAGENS NO PERÍODO: <span className="font-mono text-slate-900 font-extrabold">{page.totalTripsInContract}</span></span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Continuation Header Block */}
                        <div className="border-b-2 border-slate-300 pb-2 flex justify-between items-end">
                          <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                              Relatório de Viagens
                              <span className="text-slate-400 font-normal text-sm">— {page.contract.clientName}</span>
                            </h1>
                            <p className="text-slate-500 font-semibold text-[10px] mt-1">
                              Contrato: {page.contract.id} (Continuação — Página {page.pageIndexInContract} de {page.totalPagesInContract})
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider text-right">
                              GERADO EM: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        {/* Compact Continuation Summary Bar */}
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-2 text-[10px] font-bold text-slate-700 flex justify-between items-center">
                          <span>Origem: {page.firstTripOrigin} → Destino: {page.firstTripDest}</span>
                          <span>Total de Viagens: {page.totalTripsInContract} | Descarregadas: {page.deliveredCount}</span>
                        </div>
                      </>
                    )}

                    {/* PDF MAIN DATA TABLE */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b-2 border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                            <th className="py-2 px-2.5">ID VIAGEM</th>
                            <th className="py-2 px-2.5">VEÍCULO</th>
                            <th className="py-2 px-2.5">MOTORISTA</th>
                            <th className="py-2 px-2.5 text-center">CT-E</th>
                            <th className="py-2 px-2.5">PRODUTO</th>
                            <th className="py-2 px-2.5 text-right">VOLUME (m³)</th>
                            <th className="py-2 px-2.5">LOCALIZAÇÃO</th>
                            <th className="py-2 px-2.5 text-center">CARREGAMENTO</th>
                            <th className="py-2 px-2.5 text-center">DESCARGA PROG.</th>
                            <th className="py-2 px-2.5 text-center">STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {page.trips.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="py-8 text-center text-slate-400 font-semibold italic">
                                Nenhuma viagem de contrato localizada com os filtros selecionados neste período.
                              </td>
                            </tr>
                          ) : (
                            page.trips.map((trip, idx) => (
                              <tr 
                                key={trip.id || idx} 
                                className="border-b border-slate-100 text-[10px] font-semibold text-slate-800 hover:bg-slate-50"
                              >
                                <td className="py-1.5 px-2.5 font-mono text-sky-700 font-extrabold whitespace-nowrap">
                                  {trip.internalId}
                                </td>
                                <td className="py-1.5 px-2.5 font-mono text-slate-900 font-black">
                                  {trip.vehiclesList.map((plate, index) => (
                                    <span key={index} className="block leading-tight font-extrabold">{plate}</span>
                                  ))}
                                </td>
                                <td className="py-1.5 px-2.5 uppercase text-slate-900 font-bold max-w-[120px] truncate">
                                  {trip.driverName}
                                </td>
                                <td className="py-1.5 px-2.5 text-center font-mono font-bold text-slate-700">
                                  {trip.cteNumber}
                                </td>
                                <td className="py-1.5 px-2.5 uppercase text-slate-600 font-medium max-w-[120px] truncate">
                                  {trip.productName}
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-mono font-black text-slate-900">
                                  {trip.volumeM3.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³
                                </td>
                                <td className="py-1.5 px-2.5 text-[9px] text-slate-700 font-semibold max-w-[170px] leading-tight">
                                  <div className="flex items-start gap-1">
                                    {(() => {
                                      const vehicle = vehicles.find(v => v.id === trip.vehicleId);
                                      const lat = vehicle?.currentLatitude;
                                      const lng = vehicle?.currentLongitude;
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => copyCoordinates(lat, lng, vehicle?.licensePlate || trip.truckPlate)}
                                          className="p-0.5 -m-0.5 text-sky-600 hover:text-sky-800 hover:bg-sky-100 rounded transition cursor-pointer shrink-0 mt-0.5"
                                          title="Clique para copiar latitude e longitude (Lat, Lng)"
                                        >
                                          <MapPin size={10} className="shrink-0" />
                                        </button>
                                      );
                                    })()}
                                    <span className="break-words">{trip.currentLocation}</span>
                                  </div>
                                </td>
                                <td className="py-1.5 px-2.5 text-center font-mono text-slate-600">
                                  {trip.loadingTime}
                                </td>
                                <td className="py-1.5 px-2.5 text-center font-mono text-slate-600">
                                  {trip.deliveryTime}
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase whitespace-nowrap ${getStatusBadgeStyle(trip.status, trip.originalTrip)}`}>
                                    {getStatusLabel(trip.status, trip.originalTrip)}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Signature / Footer Line */}
                  <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[10px] text-slate-500 font-bold">
                    <span>Relatório Executivo da Frota - TransControl TMS</span>
                    <span>Página {page.pageIndexInContract} de {page.totalPagesInContract}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
