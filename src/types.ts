export type VehicleStatus = 'AVAILABLE' | 'EN_ROUTE' | 'ALERT' | 'BLOCKED' | 'MAINTENANCE';
export type DriverStatus = 'AVAILABLE' | 'EN_ROUTE' | 'INACTIVE';
export type GeofenceType = 'ORIGIN' | 'DESTINATION' | 'WAYPOINT';
export type TripStatus = 'SCHEDULED' | 'WAITING_LOADING' | 'EN_ROUTE' | 'WAITING_UNLOADING' | 'DELIVERED';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Vehicle {
  id: string;
  licensePlate: string;
  model: string;
  currentLatitude: number;
  currentLongitude: number;
  direction: number; // 0 to 359 degrees
  speed: number; // km/h
  status: VehicleStatus;
  driverId: string | null;
  driverName: string | null;
  telemetryTime: string;
  visibleOnMap?: boolean;
  maintenanceExpectedDate?: string | null;
  maintenanceReason?: string | null;
  maintenanceStartDate?: string | null;
  manualLocation?: string | null;
  manualLocationUpdatedAt?: string | null;
  stoppedSince?: string | null;
}

export interface Driver {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  status: DriverStatus;
  licenseNumber: string;
}

export type GeofenceIcon = 'FLAG' | 'FUEL_BASE' | 'TRANSPORT_BASE' | 'GAS_STATION';
export type GeofenceShape = 'CIRCLE' | 'POLYGON';

export interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  type: GeofenceType;
  icon?: GeofenceIcon;
  shapeType?: GeofenceShape;
  polygonCoordinates?: Coordinate[];
}

export interface Participant {
  cnpj: string;
  name: string;
  ie?: string;
  address?: string;
  city: string;
  state: string;
}

export interface CteInfo {
  nCT: string;
  serie: string;
  chCTe: string;
  nProt: string;
  dhEmi: string;
  cfop: string;
  emitente: Participant;
  remetente: Participant;
  destinatario: Participant;
  vTPrest: number;
  vRec: number;
  vCarga: number;
  proPred: string;
  motoristaNome: string;
  placaVeiculo: string;
  reboquePlacas: string[];
  apoliceSeguro: string;
  seguradora: string;
  volume?: number;
  valorFrete?: number;
}

export interface TripEvent {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  latitude: number;
  longitude: number;
}

export interface Trip {
  id: string;
  tripNumber: string;
  internalId?: string;
  status: TripStatus;
  vehicleId: string;
  driverId: string;
  originGeofenceId: string;
  destinationGeofenceId: string;
  cteInfo: CteInfo | null;
  events: TripEvent[];
  routeHistory: Coordinate[];
  scheduledDate: string;
  scheduledLoadingDate?: string;
  startDate?: string;
  deliveryDate?: string;
  transitStarted?: boolean;
  hasExitedOrigin?: boolean;
  hasEnteredOrigin?: boolean;
  hasEnteredDest?: boolean;
  hasExitedDest?: boolean;
  initialDistanceToOriginKm?: number;
  productId?: string;
  productName?: string;
  contractId?: string;
  loadedVolumeM3?: number;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string;
  description: string;
  status: string;
  createdAt: string;
  releaseDate?: string | null;
}

export interface Product {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface SascarCredentials {
  usuario: string;
  senha: string;
}

export interface Contract {
  id: string;
  clientName: string;
  cnpj: string;
  volumeM3: number;
  startDate: string;
  endDate: string;
  status?: 'ACTIVE' | 'EXPIRED' | 'PENDING';
}

export interface RotogramPonto {
  ordem: number;
  categoria: 'risco' | 'apoio' | 'infraestrutura' | 'sinal' | 'roubo';
  localizacao: string;
  km_aproximado: number | null;
  descricao: string;
  velocidade_maxima_recomendada: number | null;
  instrucao: string;
  raio_alerta_metros?: number;
}

export interface RotogramEixo {
  identificacao: string;
  tipo: 'isolado_simples' | 'isolado_duplo' | 'tandem_duplo' | 'tandem_triplo';
  peso_estimado_kg: number | null;
  limite_legal_kg: number | null;
  status: 'dentro_do_limite' | 'excedido';
}

export interface RotogramContatos {
  gerenciadora_risco: string;
  transportadora: string;
  prf: string;
  resgate: string;
  guincho: string;
}

export interface RotogramCalculoEixos {
  configuracao_veiculo: string;
  tara_kg: number | null;
  peso_carga_kg: number | null;
  peso_bruto_total_kg: number | null;
  eixos: RotogramEixo[];
  excesso_total_kg: number;
  configuracao_minima_sugerida: string;
  necessita_aet: boolean;
  eixos_tarifaveis_pedagio: number | null;
  alerta: string;
}

export interface Rotograma {
  id: string;
  origem: string;
  destino: string;
  distancia_km: number;
  tempo_estimado_horas: number;
  nivel_risco_geral: 'baixo' | 'medio' | 'alto';
  resumo: string;
  pontos: RotogramPonto[];
  contatos_emergencia: RotogramContatos;
  calculo_eixos: RotogramCalculoEixos;
  tipo_veiculo: string;
  tipo_carga: string;
  data_saida: string;
  criado_em: string;
  resumo_motorista: string;
}

