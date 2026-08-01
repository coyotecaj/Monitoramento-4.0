import { useState, useEffect } from 'react';
import {
  fetchVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  blockVehicle,
  toggleVehicleVisibility,
  updateDriverName,
  fetchDrivers,
  createDriver,
  updateDriver,
  fetchGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  fetchTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  resetTrip,
  uploadCteToTrip,
  updateTripStatus,
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchContracts,
  createContract,
  updateContract,
  deleteContract,
  updateVehicleMaintenance,
} from './services/api';
import { Vehicle, Driver, Geofence, Trip, GeofenceType, CteInfo, Coordinate, Product, Contract } from './types';

// Page Imports
import Dashboard from './pages/Dashboard';
import MapMonitoring from './pages/MapMonitoring';
import Geofences from './pages/Geofences';
import Trips from './pages/Trips';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Products from './pages/Products';
import Contracts from './pages/Contracts';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Maintenance from './pages/Maintenance';
import Rotograma from './pages/Rotograma';
import AIChatBot from './components/AIChatBot';
import VoiceAlertManager from './components/VoiceAlertManager';
import ToastContainer from './components/ToastContainer';
import MapComponent from './components/MapComponent';

// Icons
import {
  LayoutDashboard,
  Map,
  Hexagon,
  Milestone,
  Truck,
  Users,
  FileBarChart2,
  Settings as SettingsIcon,
  Radio,
  Activity,
  Menu,
  X,
  Compass,
  Info,
  CheckCircle,
  TrendingUp,
  Clock,
  Shield,
  Layers,
  ArrowRight,
  FileText,
  Package,
  MapPin,
  Building2,
  Flag,
  Fuel,
  Droplet,
  Navigation,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('sidebar_collapsed') === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Core Data State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedRouteVehicleId, setSelectedRouteVehicleId] = useState<string | null>(null);
  const [openRotogramaTrip, setOpenRotogramaTrip] = useState<Trip | null>(null);

  // Helper Haversine Distance (in km)
  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
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
  
  // Loading and Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all initial data
  const loadAllData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [vData, dData, gData, pData, cData, tData] = await Promise.all([
        fetchVehicles(),
        fetchDrivers(),
        fetchGeofences(),
        fetchProducts(),
        fetchContracts(),
        fetchTrips(),
      ]);
      setVehicles(vData);
      setDrivers(dData);
      setGeofences(gData);
      setProducts(pData);
      setContracts(cData);
      setTrips(tData);
      setError(null);
    } catch (err: any) {
      console.error('Error loading TMS data:', err);
      setError('Falha ao sincronizar dados com o backend. Verifique se o servidor está ativo.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch to load baseline data and dismiss the initial loading screen quickly
    loadAllData(true);

    // Establish Server-Sent Events connection for real-time updates without polling
    const eventSource = new EventSource('/api/stream');

    eventSource.addEventListener('vehicles', (event) => {
      try {
        const data = JSON.parse(event.data);
        setVehicles(data);
        setError(null);
      } catch (err) {
        console.error('Error parsing SSE vehicles:', err);
      }
    });

    eventSource.addEventListener('drivers', (event) => {
      try {
        const data = JSON.parse(event.data);
        setDrivers(data);
        setError(null);
      } catch (err) {
        console.error('Error parsing SSE drivers:', err);
      }
    });

    eventSource.addEventListener('geofences', (event) => {
      try {
        const data = JSON.parse(event.data);
        setGeofences(data);
        setError(null);
      } catch (err) {
        console.error('Error parsing SSE geofences:', err);
      }
    });

    eventSource.addEventListener('products', (event) => {
      try {
        const data = JSON.parse(event.data);
        setProducts(data);
        setError(null);
      } catch (err) {
        console.error('Error parsing SSE products:', err);
      }
    });

    eventSource.addEventListener('contracts', (event) => {
      try {
        const data = JSON.parse(event.data);
        setContracts(data);
        setError(null);
      } catch (err) {
        console.error('Error parsing SSE contracts:', err);
      }
    });

    eventSource.addEventListener('trips', (event) => {
      try {
        const data = JSON.parse(event.data);
        setTrips(data);
        setError(null);
      } catch (err) {
        console.error('Error parsing SSE trips:', err);
      }
    });

    eventSource.addEventListener('announcement', (event) => {
      try {
        const data = JSON.parse(event.data);
        const customEvent = new CustomEvent('broadcast-announcement-received', { detail: data });
        window.dispatchEvent(customEvent);
      } catch (err) {
        console.error('Error parsing SSE announcement:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.warn('Conexão SSE perdida. Tentando reconectar automaticamente...', err);
    };

    // Fast backup polling (every 1.5s) for instant high-precision vehicle position updates
    const fastPollInterval = setInterval(async () => {
      try {
        const freshVehicles = await fetchVehicles();
        if (Array.isArray(freshVehicles) && freshVehicles.length > 0) {
          setVehicles(freshVehicles);
        }
      } catch (e) {
        // Silent catch for background fast poll
      }
    }, 1500);

    return () => {
      eventSource.close();
      clearInterval(fastPollInterval);
    };
  }, []);

  // API Call Handlers
  const handleCreateVehicle = async (data: { licensePlate: string; model: string }) => {
    try {
      await createVehicle(data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar veículo.');
    }
  };

  const handleUpdateVehicle = async (id: string, data: { licensePlate: string; model: string }) => {
    try {
      await updateVehicle(id, data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar veículo.');
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    try {
      await deleteVehicle(id);
      await loadAllData(false);
    } catch (err: any) {
      console.error('Erro ao deletar veículo:', err);
    }
  };

  const handleBlockVehicle = async (id: string, block: boolean) => {
    try {
      await blockVehicle(id, block);
      await loadAllData(false);
    } catch (err: any) {
      alert('Erro ao enviar sinal de bloqueio.');
    }
  };

  const handleToggleVehicleVisibility = async (id: string, visibleOnMap: boolean) => {
    try {
      await toggleVehicleVisibility(id, visibleOnMap);
      await loadAllData(false);
    } catch (err: any) {
      alert('Erro ao alterar visibilidade.');
    }
  };

  const handleUpdateVehicleMaintenance = async (
    id: string,
    data: {
      inMaintenance: boolean;
      maintenanceReason?: string | null;
      maintenanceExpectedDate?: string | null;
    }
  ) => {
    try {
      await updateVehicleMaintenance(id, data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar manutenção do veículo.');
      throw err;
    }
  };

  const handleUpdateDriverName = async (id: string, driverName: string | null) => {
    try {
      await updateDriverName(id, driverName);
      await loadAllData(false);
    } catch (err: any) {
      alert('Erro ao atualizar motorista do veículo.');
    }
  };

  const handleCreateDriver = async (data: { name: string; cpf: string; phone?: string; licenseNumber?: string }) => {
    try {
      await createDriver(data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar motorista.');
    }
  };

  const handleUpdateDriver = async (id: string, data: { name?: string; cpf?: string; phone?: string; licenseNumber?: string }) => {
    try {
      await updateDriver(id, data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar motorista.');
    }
  };

  const handleCreateGeofence = async (data: { name: string; latitude: number; longitude: number; radius: number; type: GeofenceType; icon?: import('./types').GeofenceIcon; shapeType?: import('./types').GeofenceShape; polygonCoordinates?: import('./types').Coordinate[] }) => {
    try {
      await createGeofence(data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar geocerca.');
    }
  };

  const handleUpdateGeofence = async (id: string, data: { name?: string; latitude?: number; longitude?: number; radius?: number; type?: import('./types').GeofenceType; icon?: import('./types').GeofenceIcon; shapeType?: import('./types').GeofenceShape; polygonCoordinates?: import('./types').Coordinate[] }) => {
    try {
      await updateGeofence(id, data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar geocerca.');
    }
  };

  const handleDeleteGeofence = async (id: string) => {
    try {
      await deleteGeofence(id);
      await loadAllData(false);
    } catch (err: any) {
      alert('Erro ao deletar geocerca.');
    }
  };

  const handleCreateProduct = async (data: { name: string; code?: string; description?: string }) => {
    try {
      await createProduct(data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar produto.');
    }
  };

  const handleUpdateProduct = async (id: string, data: { name?: string; code?: string; description?: string }) => {
    try {
      await updateProduct(id, data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar produto.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct(id);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao deletar produto.');
    }
  };

  const handleCreateContract = async (data: { clientName: string; cnpj: string; volumeM3: number; startDate: string; endDate: string; status?: string }) => {
    try {
      await createContract(data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar contrato.');
    }
  };

  const handleUpdateContract = async (id: string, data: { clientName?: string; cnpj?: string; volumeM3?: number; startDate?: string; endDate?: string; status?: string }) => {
    try {
      await updateContract(id, data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar contrato.');
    }
  };

  const handleDeleteContract = async (id: string) => {
    try {
      await deleteContract(id);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao remover contrato.');
    }
  };

  const handleCreateTrip = async (data: { vehicleId: string; driverId: string; originGeofenceId: string; destinationGeofenceId: string; scheduledLoadingDate?: string; productId?: string }) => {
    try {
      await createTrip(data);
      await loadAllData(false);
      setCurrentPage('trips'); // Navigate to trips board to monitor
    } catch (err: any) {
      alert(err.message || 'Erro ao agendar viagem.');
    }
  };

  const handleUpdateTrip = async (id: string, data: { vehicleId?: string; driverId?: string; originGeofenceId?: string; destinationGeofenceId?: string; scheduledLoadingDate?: string; productId?: string; contractId?: string; loadedVolumeM3?: number }) => {
    try {
      await updateTrip(id, data);
      await loadAllData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar viagem.');
    }
  };

  const handleDeleteTrip = async (id: string) => {
    try {
      await deleteTrip(id);
      await loadAllData(false);
    } catch (err: any) {
      console.error('Erro ao deletar viagem:', err);
    }
  };

  const handleResetTrip = async (id: string) => {
    try {
      await resetTrip(id);
      await loadAllData(false);
    } catch (err: any) {
      alert('Erro ao reiniciar simulação.');
    }
  };

  const handleUploadCte = async (tripId: string, cteInfo: CteInfo) => {
    try {
      await uploadCteToTrip(tripId, cteInfo);
      await loadAllData(false);
    } catch (err: any) {
      alert('Erro ao anexar CT-e.');
    }
  };

  const handleUpdateStatus = async (tripId: string, status: string) => {
    try {
      await updateTripStatus(tripId, status);
      await loadAllData(false);
    } catch (err: any) {
      alert('Erro ao atualizar status.');
    }
  };

  // Get active trip path for drawing on map
  const activeTrip = selectedRouteVehicleId
    ? trips.find(t => t.vehicleId === selectedRouteVehicleId && ['WAITING_LOADING', 'EN_ROUTE', 'WAITING_UNLOADING'].includes(t.status))
    : undefined;
  const activeTripRoute = activeTrip ? activeTrip.routeHistory : undefined;
  let activeTripDestination: Coordinate | undefined = undefined;
  let activeTripVehicle: Vehicle | undefined = undefined;
  if (activeTrip) {
    activeTripVehicle = vehicles.find(v => v.id === activeTrip.vehicleId);
    if (activeTrip.status === 'WAITING_LOADING') {
      const g = geofences.find(g => g.id === activeTrip.originId);
      if (g) activeTripDestination = { latitude: g.latitude, longitude: g.longitude };
    } else {
      const g = geofences.find(g => g.id === activeTrip.destinationId);
      if (g) activeTripDestination = { latitude: g.latitude, longitude: g.longitude };
    }
  }

  const handleToggleRoute = (vehicleId: string) => {
    setSelectedRouteVehicleId(prev => (prev === vehicleId ? null : vehicleId));
    setCurrentPage('map'); // Navigate to map when clicking route
  };

  // Navigation Items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', label: 'Mapa & Monitoramento', icon: Map },
    { id: 'geofences', label: 'Geocercas', icon: Hexagon },
    { id: 'trips', label: 'Viagens & Rotas', icon: Milestone },
    { id: 'rotograma', label: 'Rotograma de Risco', icon: Shield },
    { id: 'vehicles', label: 'Veículos', icon: Truck },
    { id: 'maintenance', label: 'Oficina / Manutenção', icon: Wrench },
    { id: 'drivers', label: 'Motoristas', icon: Users },
    { id: 'products', label: 'Produtos', icon: Package },
    { id: 'contracts', label: 'Contrato', icon: FileText },
    { id: 'reports', label: 'Relatórios', icon: FileBarChart2 },
    { id: 'settings', label: 'Configurações', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100 flex flex-col md:flex-row font-sans selection:bg-sky-500/35">
      <ToastContainer />
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-[#1f2d45] z-50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-400">
            <Activity size={18} className="animate-pulse" />
          </div>
          <span className="font-extrabold text-sm tracking-wider text-white">TRANSCONTROL</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-gray-400 hover:text-white transition focus:outline-none"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 bg-[#111827] border-r border-[#1f2d45] flex flex-col z-40 transition-all duration-300 ease-in-out md:static md:h-screen
        ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
        ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header Logo & Collapse Toggle */}
        <div className={`hidden md:flex items-center ${isSidebarCollapsed ? 'justify-center flex-col py-5 px-2 gap-3' : 'justify-between px-5 py-5'} border-b border-[#1f2d45] transition-all`}>
          <div className={`flex items-center gap-3 overflow-hidden ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400 flex-shrink-0">
              <Activity size={20} className="animate-pulse" />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <span className="font-black text-base tracking-wider text-white block truncate">TRANSCONTROL</span>
                <span className="text-[10px] text-sky-400 font-mono tracking-widest block uppercase truncate">Telemetry TMS</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className={`flex-1 ${isSidebarCollapsed ? 'px-2 py-4' : 'px-3 py-6'} space-y-1.5 overflow-y-auto`}>
          {navItems.map(item => {
            const isSelected = currentPage === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  setIsMobileMenuOpen(false);
                }}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3.5 px-3.5 py-2.5'} rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer group relative
                  ${isSelected
                    ? 'bg-sky-400/10 border border-sky-400/20 text-sky-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                    : 'text-slate-400 hover:bg-[#1a2236]/60 hover:text-slate-200 border border-transparent'
                  }
                `}
              >
                <Icon size={isSidebarCollapsed ? 18 : 16} className={`flex-shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={`p-4 border-t border-[#1f2d45] bg-[#0a0e1a]/50 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
          {isSidebarCollapsed ? (
            <div title="SASCAR INTEGRADO LIVE" className="p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-emerald-400 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-[10px] font-mono text-emerald-400 whitespace-nowrap overflow-hidden">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
              <span className="truncate">SASCAR INTEGRADO LIVE</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-h-0 bg-[#0a0e1a] md:h-screen overflow-y-auto p-4 md:p-6 lg:p-8">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <Radio size={40} className="text-sky-400 animate-spin" />
            <p className="text-sm text-gray-400 font-medium font-mono">Conectando ao terminal de frotas...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
            <span className="p-4 bg-rose-500/10 text-rose-500 rounded-full border border-rose-500/20 animate-bounce">
              <Activity size={32} />
            </span>
            <h3 className="text-lg font-bold text-white">Falha de Conexão</h3>
            <p className="text-sm text-gray-400 max-w-sm leading-relaxed">{error}</p>
            <button
              onClick={() => loadAllData(true)}
              className="mt-2 bg-sky-500 hover:bg-sky-600 transition text-white text-xs font-semibold px-4 py-2 rounded-lg"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 animate-fade-in duration-300">
            {currentPage === 'dashboard' && (
              <Dashboard
                vehicles={vehicles}
                drivers={drivers}
                geofences={geofences}
                trips={trips}
                contracts={contracts}
                onNavigate={setCurrentPage}
                onResetTrip={handleResetTrip}
                onOpenRotograma={setOpenRotogramaTrip}
                onUpdateStatus={handleUpdateStatus}
                onUploadCte={handleUploadCte}
              />
            )}
            {currentPage === 'map' && (
              <MapMonitoring
                vehicles={vehicles}
                geofences={geofences}
                trips={trips}
                activeTripRoute={activeTripRoute}
                activeTripDestination={activeTripDestination}
                activeTripVehicle={activeTripVehicle}
                onBlockVehicle={handleBlockVehicle}
              />
            )}
            {currentPage === 'geofences' && (
              <Geofences
                geofences={geofences}
                onCreateGeofence={handleCreateGeofence}
                onUpdateGeofence={handleUpdateGeofence}
                onDeleteGeofence={handleDeleteGeofence}
              />
            )}
            {currentPage === 'trips' && (
              <Trips
                trips={trips}
                vehicles={vehicles}
                drivers={drivers}
                geofences={geofences}
                products={products}
                contracts={contracts}
                onCreateTrip={handleCreateTrip}
                onUpdateTrip={handleUpdateTrip}
                onDeleteTrip={handleDeleteTrip}
                onUploadCte={handleUploadCte}
                onResetTrip={handleResetTrip}
                onUpdateStatus={handleUpdateStatus}
                onToggleRoute={handleToggleRoute}
                selectedRouteVehicleId={selectedRouteVehicleId}
                openRotogramaTrip={openRotogramaTrip}
                onOpenRotograma={setOpenRotogramaTrip}
              />
            )}
            {currentPage === 'vehicles' && (
              <Vehicles
                vehicles={vehicles}
                onCreateVehicle={handleCreateVehicle}
                onUpdateVehicle={handleUpdateVehicle}
                onDeleteVehicle={handleDeleteVehicle}
                onToggleVisibility={handleToggleVehicleVisibility}
                onUpdateDriverName={handleUpdateDriverName}
                onToggleRoute={handleToggleRoute}
                selectedRouteVehicleId={selectedRouteVehicleId}
                trips={trips}
                onOpenRotograma={setOpenRotogramaTrip}
              />
            )}
            {currentPage === 'maintenance' && (
              <Maintenance
                vehicles={vehicles}
                onUpdateVehicleMaintenance={handleUpdateVehicleMaintenance}
                onNavigate={setCurrentPage}
              />
            )}
            {currentPage === 'drivers' && (
              <Drivers
                drivers={drivers}
                onCreateDriver={handleCreateDriver}
                onUpdateDriver={handleUpdateDriver}
              />
            )}
            {currentPage === 'products' && (
              <Products
                products={products}
                onCreateProduct={handleCreateProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
              />
            )}
            {currentPage === 'contracts' && (
              <Contracts
                contracts={contracts}
                trips={trips}
                onCreateContract={handleCreateContract}
                onUpdateContract={handleUpdateContract}
                onDeleteContract={handleDeleteContract}
              />
            )}
            {currentPage === 'rotograma' && (
              <Rotograma />
            )}
            {currentPage === 'reports' && (
              <Reports
                trips={trips}
                vehicles={vehicles}
                drivers={drivers}
                geofences={geofences}
                contracts={contracts}
                products={products}
              />
            )}
            {currentPage === 'settings' && <Settings />}
          </div>
        )}
      </main>

      {/* Global Rotograma Modal Overlay */}
      {openRotogramaTrip && (() => {
        const trip = openRotogramaTrip;
        const vehicle = vehicles.find(v => v.id === trip.vehicleId);
        const driver = drivers.find(d => d.id === trip.driverId);
        const origin = geofences.find(g => g.id === trip.originGeofenceId);
        const dest = geofences.find(g => g.id === trip.destinationGeofenceId);

        // Path connecting Vehicle -> Origin (if applicable) -> Destination
        const rotogramaPath: Coordinate[] = [];
        if (vehicle) {
          rotogramaPath.push({ latitude: vehicle.currentLatitude, longitude: vehicle.currentLongitude });
        }
        
        // If the trip hasn't reached the origin yet, route through the origin
        if (origin && (trip.status === 'SCHEDULED' || trip.status === 'WAITING_LOADING')) {
          rotogramaPath.push({ latitude: origin.latitude, longitude: origin.longitude });
        }
        
        // Destination is always the final target
        if (dest) {
          rotogramaPath.push({ latitude: dest.latitude, longitude: dest.longitude });
        }

        // Active Trip Geofences (Origin & Destination)
        const tripGeofences = geofences.filter(
          g => g.id === trip.originGeofenceId || g.id === trip.destinationGeofenceId
        );

        // Calculate direct route details
        let routeDistance = 0;
        if (vehicle && dest) {
          const vehicleToDestDist = haversineDistance(
            vehicle.currentLatitude,
            vehicle.currentLongitude,
            dest.latitude,
            dest.longitude
          );

          if (origin && (trip.status === 'SCHEDULED' || trip.status === 'WAITING_LOADING')) {
            const vehicleToOriginDist = haversineDistance(
              vehicle.currentLatitude,
              vehicle.currentLongitude,
              origin.latitude,
              origin.longitude
            );
            const originToDestDist = haversineDistance(
              origin.latitude,
              origin.longitude,
              dest.latitude,
              dest.longitude
            );
            routeDistance = vehicleToOriginDist + originToDestDist;
          } else {
            routeDistance = vehicleToDestDist;
          }
        }

        // Estimated travel duration in minutes at avg speed of 80km/h
        const routeDurationMins = routeDistance > 0 ? Math.round((routeDistance / 80) * 60) : 0;

        return (
          <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-[#0b1329] border border-[#1f2d45] rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col my-8">
              {/* Header */}
              <div className="bg-[#111c3a] px-6 py-4 border-b border-[#1f2d45] flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Compass className="text-sky-400 w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Rotograma de Viagem Operacional</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Calculado pelo Sistema de Telemetria e Geoprocessamento • {trip.tripNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpenRotogramaTrip(null)}
                  className="p-1 hover:bg-[#1a2c5b] text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Split Layout */}
              <div className="p-6 overflow-y-auto max-h-[80vh]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Interactive Google Map */}
                  <div className="lg:col-span-7 flex flex-col space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Map size={13} className="text-sky-400" />
                      Visualização do Trajeto no Google Maps
                    </span>
                    <div className="w-full h-[320px] lg:h-[480px] rounded-xl overflow-hidden border border-[#1f2d45] relative shadow-lg">
                      <MapComponent
                        vehicles={vehicle ? [vehicle] : []}
                        geofences={tripGeofences}
                        selectedVehicle={vehicle}
                        activeTripRoute={rotogramaPath}
                      />
                    </div>
                  </div>

                  {/* Right Column: Operational Info & Guidelines */}
                  <div className="lg:col-span-5 space-y-5">
                    {/* Trip info cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Caminhão</span>
                        <span className="font-bold text-slate-200 block text-xs mt-0.5">{vehicle?.licensePlate || 'Não Vinculado'}</span>
                        <span className="text-[8px] text-slate-400 font-mono">{vehicle?.model || 'Desconhecido'}</span>
                      </div>
                      <div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Motorista</span>
                        <span className="font-bold text-slate-200 block text-xs mt-0.5 truncate">{driver?.name || 'Não Vinculado'}</span>
                        <span className="text-[8px] text-slate-400 font-mono">CPF: {driver?.cpf || 'Desconhecido'}</span>
                      </div>
                      <div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Origem</span>
                        <span className="font-bold text-slate-200 block text-xs mt-0.5 truncate">{origin?.name || 'N/A'}</span>
                        <span className="text-[8px] text-slate-400 font-mono">Raio: {origin?.radius}m</span>
                      </div>
                      <div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Destino</span>
                        <span className="font-bold text-slate-200 block text-xs mt-0.5 truncate">{dest?.name || 'N/A'}</span>
                        <span className="text-[8px] text-slate-400 font-mono">Raio: {dest?.radius}m</span>
                      </div>
                    </div>

                    {/* Routing calculation stats */}
                    <div className="bg-[#111827]/50 border border-[#1f2d45] rounded-xl p-4 space-y-3">
                      <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={13} />
                        Resultado do Cálculo de Rota Logística
                      </span>
                      
                      <div className="grid grid-cols-1 gap-2.5">
                        <div className="flex items-center gap-2.5 bg-[#0a0e1a]/60 p-2.5 rounded-lg border border-[#1f2d45]/40">
                          <TrendingUp className="text-emerald-400 w-5 h-5 flex-shrink-0" />
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase font-bold">Distância Restante</span>
                            <span className="font-mono text-xs font-bold text-slate-200 block mt-0.5">{routeDistance.toFixed(2)} km</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 bg-[#0a0e1a]/60 p-2.5 rounded-lg border border-[#1f2d45]/40">
                          <Clock className="text-sky-400 w-5 h-5 flex-shrink-0" />
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase font-bold">Tempo Restante (ETA)</span>
                            <span className="font-mono text-xs font-bold text-slate-200 block mt-0.5">
                              {routeDurationMins >= 60 ? `${Math.floor(routeDurationMins / 60)}h ${routeDurationMins % 60}min` : `${routeDurationMins} min`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 bg-[#0a0e1a]/60 p-2.5 rounded-lg border border-[#1f2d45]/40">
                          <Activity className="text-amber-500 w-5 h-5 flex-shrink-0" />
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase font-bold">Velocidade Atual</span>
                            <span className="font-mono text-xs font-bold text-slate-200 block mt-0.5">
                              {vehicle ? `${vehicle.speed} km/h` : '0 km/h'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 bg-[#0a0e1a]/60 p-2.5 rounded-lg border border-[#1f2d45]/40">
                          <Shield className="text-sky-500 w-5 h-5 flex-shrink-0" />
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase font-bold">Velocidade Alvo Segura</span>
                            <span className="font-mono text-xs font-bold text-slate-200 block mt-0.5">80 km/h</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vertical timeline checkpoints */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Passo a Passo & Instruções de Segurança</span>
                      
                      <div className="relative border-l border-[#1f2d45] ml-3 pl-5 space-y-4 text-xs">
                        {/* Step 1 */}
                        <div className="relative">
                          <div className="absolute -left-[26px] top-1 bg-amber-500 text-[#020617] rounded-full w-3 h-3 flex items-center justify-center ring-4 ring-[#0b1329]" />
                          <div className="space-y-1 bg-[#111c3a]/40 p-3 rounded-lg border border-[#1f2d45]/40">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">Passo 1: Trânsito / Vazio (Aproximação)</span>
                              <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded uppercase font-bold">Vazio</span>
                            </div>
                            <p className="text-slate-400 text-[10px] leading-snug">
                              O veículo inicia o deslocamento em direção à geocerca de origem (<span className="text-slate-300 font-semibold">{origin?.name}</span>). Monitoramento constante do tempo de chegada contra a janela agendada de carregamento.
                            </p>
                            <div className="flex gap-2 text-[8px] font-mono text-slate-400">
                              <span>Velocidade Máxima: 80 km/h</span>
                              <span>•</span>
                              <span>Alerta de fadiga ativo</span>
                            </div>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="relative">
                          <div className="absolute -left-[26px] top-1 bg-orange-500 text-[#020617] rounded-full w-3 h-3 flex items-center justify-center ring-4 ring-[#0b1329]" />
                          <div className="space-y-1 bg-[#111c3a]/40 p-3 rounded-lg border border-[#1f2d45]/40">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">Passo 2: No Carregamento (Origem)</span>
                              <span className="text-[8px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded uppercase font-bold">Geocerca</span>
                            </div>
                            <p className="text-slate-400 text-[10px] leading-snug">
                              Entrada no pátio do cliente. O status muda para <span className="text-slate-300 font-semibold">"Aguardando Carregamento"</span>. Requer o upload obrigatório do XML do CT-e correspondente para autorização de saída.
                            </p>
                            <div className="flex gap-2 text-[8px] font-mono text-slate-400">
                              <span>Velocidade Interna: 30 km/h</span>
                              <span>•</span>
                              <span>Regras de EPI obrigatórias</span>
                            </div>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div className="relative">
                          <div className="absolute -left-[26px] top-1 bg-sky-500 text-[#020617] rounded-full w-3 h-3 flex items-center justify-center ring-4 ring-[#0b1329]" />
                          <div className="space-y-1 bg-[#111c3a]/40 p-3 rounded-lg border border-[#1f2d45]/40">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">Passo 3: Em Trânsito (Carregado)</span>
                              <span className="text-[8px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded uppercase font-bold">Rota</span>
                            </div>
                            <p className="text-slate-400 text-[10px] leading-snug">
                              Veículo carregado e liberado. Telemetria GPS acompanha o trajeto ponto a ponto, enviando logs automáticos de velocidade, telemetria Sascar e conformidade de trajeto.
                            </p>
                            <div className="flex gap-2 text-[8px] font-mono text-slate-400">
                              <span>Velocidade Máxima: 80 km/h</span>
                              <span>•</span>
                              <span>Pancadas de freio monitoradas</span>
                            </div>
                          </div>
                        </div>

                        {/* Step 4 */}
                        <div className="relative">
                          <div className="absolute -left-[26px] top-1 bg-purple-500 text-[#020617] rounded-full w-3 h-3 flex items-center justify-center ring-4 ring-[#0b1329]" />
                          <div className="space-y-1 bg-[#111c3a]/40 p-3 rounded-lg border border-[#1f2d45]/40">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">Passo 4: No Descarregamento (Destino)</span>
                              <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded uppercase font-bold">Entrega</span>
                            </div>
                            <p className="text-slate-400 text-[10px] leading-snug">
                              Entrada no pátio do destinatário (<span className="text-slate-300 font-semibold">{dest?.name}</span>). Conferência física da mercadoria e processo de descarga ativa o botão "Concluir Viagem".
                            </p>
                            <div className="flex gap-2 text-[8px] font-mono text-slate-400">
                              <span>Velocidade Interna: 30 km/h</span>
                              <span>•</span>
                              <span>Estacionamento seguro</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#111c3a] px-6 py-3 border-t border-[#1f2d45] flex justify-end gap-2 flex-shrink-0">
                <button
                  onClick={() => setOpenRotogramaTrip(null)}
                  className="bg-sky-600 hover:bg-sky-500 transition text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle size={13} />
                  Entendido, Fechar Rotograma
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <AIChatBot />
      <VoiceAlertManager vehicles={vehicles} geofences={geofences} trips={trips} />
    </div>
  );
}
