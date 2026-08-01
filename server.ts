import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, disableNetwork, enableNetwork, onSnapshot, setLogLevel } from 'firebase/firestore';
import { Vehicle, Driver, Geofence, Trip, TripStatus, VehicleStatus, Coordinate, TripEvent, Product, Contract, MaintenanceRecord, CteInfo } from './src/types';
import { getCityStateFromCoordinates, parseCoordinates, BRAZIL_CITIES, formatLocationDisplay } from './src/utils/geocoding';

// Simple in-memory database
let vehicles: Vehicle[] = [
  {
    id: 'v1',
    licensePlate: 'BRA3S45',
    model: 'Scania R 450 (Caminhão Trator)',
    currentLatitude: -22.9056,
    currentLongitude: -47.0608,
    direction: 45,
    speed: 0,
    status: 'AVAILABLE',
    driverId: null,
    driverName: null,
    telemetryTime: new Date().toISOString(),
    stoppedSince: new Date(Date.now() - 35 * 60 * 1000).toISOString() // 35 min stopped for demonstration / orientation
  },
  {
    id: 'v2',
    licensePlate: 'JKS2F19',
    model: 'Volvo FH 540 (Caminhão Trator)',
    currentLatitude: -23.5505,
    currentLongitude: -46.6333,
    direction: 180,
    speed: 0,
    status: 'AVAILABLE',
    driverId: null,
    driverName: null,
    telemetryTime: new Date().toISOString(),
    stoppedSince: new Date(Date.now() - 14 * 60 * 1000).toISOString() // 14 min stopped
  },
  {
    id: 'v3',
    licensePlate: 'REB-8A90',
    model: 'Mercedes-Benz Actros (Caminhão Trator)',
    currentLatitude: -25.4290,
    currentLongitude: -49.2671,
    direction: 270,
    speed: 0,
    status: 'BLOCKED',
    driverId: null,
    driverName: null,
    telemetryTime: new Date().toISOString(),
    stoppedSince: new Date(Date.now() - 42 * 60 * 1000).toISOString() // 42 min stopped for demonstration
  }
];

let drivers: Driver[] = [
  {
    id: 'd1',
    name: 'João Silva de Souza',
    cpf: '123.456.789-00',
    phone: '(11) 98765-4321',
    status: 'AVAILABLE',
    licenseNumber: 'CNH-E 123456789'
  },
  {
    id: 'd2',
    name: 'Carlos Eduardo dos Santos',
    cpf: '987.654.321-11',
    phone: '(41) 99888-7766',
    status: 'AVAILABLE',
    licenseNumber: 'CNH-E 987654321'
  },
  {
    id: 'd3',
    name: 'Ana Paula Rodrigues',
    cpf: '456.789.123-22',
    phone: '(19) 97777-6655',
    status: 'AVAILABLE',
    licenseNumber: 'CNH-D 456789123'
  }
];

let geofences: Geofence[] = [];

let products: Product[] = [
  { id: 'p1', name: 'Alimentos Perecíveis', code: 'PROD-001', description: 'Produtos alimentares refrigerados ou secos' },
  { id: 'p2', name: 'Combustível / Inflamáveis', code: 'PROD-002', description: 'Combustível líquido e derivados de petróleo' },
  { id: 'p3', name: 'Grãos e Agronegócio', code: 'PROD-003', description: 'Carga de soja, milho e outros grãos a granel' },
  { id: 'p4', name: 'Eletrônicos de Alto Valor', code: 'PROD-004', description: 'Equipamentos eletrônicos com escolta armada' },
  { id: 'p5', name: 'Carga Geral', code: 'PROD-005', description: 'Diversas mercadorias industriais paletizadas' }
];

let contracts: Contract[] = [
  {
    id: 'c1',
    clientName: 'Distribuidora Petróleo Brasil',
    cnpj: '12.345.678/0001-99',
    volumeM3: 1500,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'ACTIVE'
  }
];

let maintenanceRecords: MaintenanceRecord[] = [];

let trips: Trip[] = [];
let rotograms: any[] = [];

// In-memory simulation variables
interface SimulatedTripPath {
  tripId: string;
  points: Coordinate[];
  currentIndex: number;
}
let simulatedTripPaths: SimulatedTripPath[] = [];
let waitingLoadingTicks: Record<string, number> = {};

// Server-wide Integration Settings and Sascar Synchronization state
let demoMode = false;
let sascarUser = 'WORKGR';
let sascarPass = 'sascar';
let lastSyncError: string | null = null;
let lastSyncTime: string | null = null;
let sascarSyncInterval: NodeJS.Timeout | null = null;
let activeSyncMethod: string | null = null;
let sascarIdToPlateMap = new Map<string, string>();
let sascarDriverIdToNameMap = new Map<string, string>();
let sascarVehicleIdToDriverIdMap = new Map<string, string>();
let isSyncing = false;
let manualDriverNamesMap = new Map<string, string | null>();

let sseClients: any[] = [];

const CACHE_FILE_PATH = path.join(process.cwd(), 'data_cache.json');

// Initialize Firebase Client SDK using credentials/environment configuration
let db: any = null;

function initializeFirebase() {
  try {
    setLogLevel('silent');
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const firebaseApp = initializeApp(config);
      
      db = getFirestore(firebaseApp, config.firestoreDatabaseId);
        
      console.log('[Firebase] Client SDK inicializado com sucesso. Database ID:', config.firestoreDatabaseId || '(default)');
      
      if (isFirestoreQuotaExceeded && Date.now() < firestoreQuotaExceededUntil) {
        console.warn('[Firebase] Inicializando com rede Firestore desabilitada (limite de quota excedido ativo).');
        disableNetwork(db).catch(netErr => {
          console.error('[Firebase] Erro ao desativar rede do Firestore no início:', netErr);
        });
      } else {
        setupFirestoreListeners();
      }
    } else {
      console.warn('[Firebase] Configuração firebase-applet-config.json não encontrada.');
    }
  } catch (err) {
    console.error('[Firebase] Erro ao inicializar o Client SDK:', err);
  }
}

let lastDatabaseUpdateTime = 0;

function setupFirestoreListeners() {
  if (!db) return;

  console.log('[Firebase] Ativando listeners em tempo real para sincronização multi-instância...');

  onSnapshot(doc(db, 'state', 'data'), (snapshot) => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();
    if (!data) return;

    const incomingUpdateTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    
    // Skip if the incoming data is older or equal to our last local write timestamp
    if (incomingUpdateTime <= lastDatabaseUpdateTime) {
      return;
    }

    console.log(`[Firebase Listener] Novo estado recebido de outra instância (timestamp: ${data.updatedAt}). Sincronizando...`);

    lastDatabaseUpdateTime = incomingUpdateTime;

    // Set skipFirestoreSave to true while updating local memory, so that saving to disk cache
    // does not write back to Firestore.
    const wasSkip = skipFirestoreSave;
    skipFirestoreSave = true;

    try {
      if (data.lastSyncTime !== undefined) {
        lastSyncTime = data.lastSyncTime;
      }
      if (data.activeSyncMethod !== undefined) {
        activeSyncMethod = data.activeSyncMethod;
      }
      if (Array.isArray(data.vehicles)) {
        vehicles = data.vehicles;
      }
      if (Array.isArray(data.drivers)) {
        drivers = data.drivers;
      }
      if (Array.isArray(data.geofences)) {
        geofences = data.geofences;
      }
      if (Array.isArray(data.trips)) {
        trips = data.trips;
      }
      if (Array.isArray(data.products)) {
        products = data.products;
      }
      if (Array.isArray(data.contracts)) {
        contracts = data.contracts;
      }
      if (Array.isArray(data.maintenanceRecords)) {
        maintenanceRecords = data.maintenanceRecords;
      }
      if (Array.isArray(data.rotograms)) {
        rotograms = data.rotograms;
      }

      // Sync and broadcast updates locally
      saveDatabaseToDisk(false);
      broadcastVehicles(false);
      broadcastTrips(false);
      broadcastDrivers(false);
      broadcastGeofences(false);
      broadcastProducts(false);
      broadcastContracts(false);

    } catch (err) {
      console.error('[Firebase Listener] Erro ao aplicar estado recebido:', err);
    } finally {
      skipFirestoreSave = wasSkip;
    }
  });
}

let saveFirestoreTimeout: NodeJS.Timeout | null = null;
let isSavingToFirestore = false;
let hasPendingFirestoreSave = false;
let isFirestoreQuotaExceeded = false;
let firestoreQuotaExceededUntil = 0;

async function ensureFirestoreNetwork() {
  if (!db) return false;
  if (isFirestoreQuotaExceeded) {
    if (Date.now() >= firestoreQuotaExceededUntil) {
      console.log('[Firebase] Período de restrição de quota expirado. Reativando rede do Firestore...');
      try {
        await enableNetwork(db);
        isFirestoreQuotaExceeded = false;
        firestoreQuotaExceededUntil = 0;
        console.log('[Firebase] Rede do Firestore reativada com sucesso.');
        return true;
      } catch (netErr) {
        console.error('[Firebase] Erro ao reativar rede do Firestore:', netErr);
        firestoreQuotaExceededUntil = Date.now() + 15 * 60 * 1000;
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

async function handleQuotaExceeded(err: any) {
  if (isFirestoreQuotaExceeded) return;
  isFirestoreQuotaExceeded = true;
  firestoreQuotaExceededUntil = Date.now() + 24 * 60 * 60 * 1000; // 24 hours cool-down
  console.warn('[Firebase] Quota de gravação/leitura do Firestore esgotada. Desativando rede do Firestore e mantendo operação offline com cache local.');
  if (saveFirestoreTimeout) {
    clearTimeout(saveFirestoreTimeout);
    saveFirestoreTimeout = null;
  }
  hasPendingFirestoreSave = false;
  try {
    if (db) {
      await disableNetwork(db);
      console.log('[Firebase] Rede do Firestore desativada com sucesso.');
    }
  } catch (netErr) {
    console.error('[Firebase] Erro ao desativar rede do Firestore:', netErr);
  }
  try {
    saveDatabaseToDisk(false);
  } catch (diskErr) {
    console.error('[Firebase] Erro ao persistir estado de quota no disco:', diskErr);
  }
}

async function saveDatabaseToFirestore() {
  if (!db) return;
  
  const networkReady = await ensureFirestoreNetwork();
  if (!networkReady) return;
  
  if (isFirestoreQuotaExceeded && Date.now() < firestoreQuotaExceededUntil) {
    return;
  }
  try {
    console.log('[Firebase] Sincronizando base de dados consolidada com o Firestore...');
    
    // 1. Settings doc
    const settingsData = {
      demoMode,
      sascarUser,
      sascarPass,
      lastSyncTime,
      activeSyncMethod,
      sascarIdToPlateMap: Object.fromEntries(sascarIdToPlateMap),
      sascarDriverIdToNameMap: Object.fromEntries(sascarDriverIdToNameMap),
      sascarVehicleIdToDriverIdMap: Object.fromEntries(sascarVehicleIdToDriverIdMap),
      manualDriverNamesMap: Object.fromEntries(manualDriverNamesMap),
    };
    const cleanedSettingsData = JSON.parse(JSON.stringify(settingsData));
    await setDoc(doc(db, 'settings', 'global'), cleanedSettingsData);

    // 2. Save state data (vehicles, drivers, geofences, trips, products, contracts, maintenanceRecords) consolidated in a single document
    const nowIso = new Date().toISOString();
    lastDatabaseUpdateTime = new Date(nowIso).getTime();

    const stateData = {
      vehicles,
      drivers,
      geofences,
      products,
      trips,
      contracts,
      maintenanceRecords,
      rotograms,
      lastSyncTime,
      activeSyncMethod,
      updatedAt: nowIso
    };
    // Strip undefined values which Firestore rejects
    const cleanedStateData = JSON.parse(JSON.stringify(stateData));
    await setDoc(doc(db, 'state', 'data'), cleanedStateData);

    // Reset quota flag upon success
    if (isFirestoreQuotaExceeded) {
      isFirestoreQuotaExceeded = false;
      firestoreQuotaExceededUntil = 0;
    }
    console.log('[Firebase] Banco de dados Firestore consolidado atualizado com sucesso. Consumido: 2 gravações.');
  } catch (err: any) {
    const errMsg = String(err?.message || err || '');
    const errCode = String(err?.code || '');
    if (
      errMsg.includes('RESOURCE_EXHAUSTED') || 
      errCode === 'resource-exhausted' ||
      errCode === '8' ||
      errMsg.includes('Quota limit exceeded') ||
      errMsg.includes('Quota exceeded') ||
      errMsg.includes('quota')
    ) {
      await handleQuotaExceeded(err);
    } else {
      console.error('[Firebase] Erro ao sincronizar para o Firestore:', err);
    }
  }
}

let lastFirestoreSaveTime = 0;

function queueFirestoreSave(immediate = false) {
  if (!db) return;
  
  if (isFirestoreQuotaExceeded && Date.now() < firestoreQuotaExceededUntil) {
    return;
  }
  
  if (isSavingToFirestore) {
    hasPendingFirestoreSave = true;
    return;
  }
  
  const minInterval = immediate ? 2000 : 30000;
  const elapsed = Date.now() - lastFirestoreSaveTime;
  const delay = Math.max(immediate ? 500 : 10000, minInterval - elapsed);
  
  if (saveFirestoreTimeout) {
    if (immediate) {
      clearTimeout(saveFirestoreTimeout);
      saveFirestoreTimeout = null;
    } else {
      return;
    }
  }
  
  saveFirestoreTimeout = setTimeout(async () => {
    saveFirestoreTimeout = null;
    if (isFirestoreQuotaExceeded && Date.now() < firestoreQuotaExceededUntil) {
      return;
    }
    isSavingToFirestore = true;
    hasPendingFirestoreSave = false;
    
    try {
      await saveDatabaseToFirestore();
      lastFirestoreSaveTime = Date.now();
    } catch (err) {
      console.error('[Firebase] Erro na gravação agendada do Firestore:', err);
    } finally {
      isSavingToFirestore = false;
      if (hasPendingFirestoreSave && !isFirestoreQuotaExceeded) {
        queueFirestoreSave(false);
      }
    }
  }, delay);
}

async function loadDatabaseFromFirestore() {
  if (!db) {
    console.log('[Firebase] Firestore não disponível para carregar.');
    return false;
  }
  
  // Try to re-enable network if cooling period passed
  await ensureFirestoreNetwork();
  
  if (isFirestoreQuotaExceeded && Date.now() < firestoreQuotaExceededUntil) {
    console.log('[Firebase] Sincronização em nuvem temporariamente suspensa devido ao esgotamento de quota.');
    return false;
  }
  try {
    console.log('[Firebase] Carregando dados persistentes do Firestore...');
    skipFirestoreSave = true;
    
    // Load settings
    const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      if (data) {
        if (data.demoMode !== undefined) demoMode = data.demoMode;
        if (data.sascarUser !== undefined) sascarUser = data.sascarUser;
        if (data.sascarPass !== undefined) sascarPass = data.sascarPass;
        if (data.lastSyncTime !== undefined) lastSyncTime = data.lastSyncTime;
        if (data.activeSyncMethod !== undefined) activeSyncMethod = data.activeSyncMethod;
        
        if (data.sascarIdToPlateMap) {
          sascarIdToPlateMap = new Map(Object.entries(data.sascarIdToPlateMap));
        }
        if (data.sascarDriverIdToNameMap) {
          sascarDriverIdToNameMap = new Map(Object.entries(data.sascarDriverIdToNameMap));
        }
        if (data.sascarVehicleIdToDriverIdMap) {
          sascarVehicleIdToDriverIdMap = new Map(Object.entries(data.sascarVehicleIdToDriverIdMap));
        }
        if (data.manualDriverNamesMap) {
          manualDriverNamesMap = new Map(Object.entries(data.manualDriverNamesMap));
        }
      }
    }

    // Load consolidated state
    const stateDoc = await getDoc(doc(db, 'state', 'data'));
    if (stateDoc.exists()) {
      const data = stateDoc.data();
      if (data) {
        if (data.updatedAt) {
          lastDatabaseUpdateTime = new Date(data.updatedAt).getTime();
        }
        // Load vehicles
        if (Array.isArray(data.vehicles)) {
          vehicles = data.vehicles;
        }

        // Load drivers
        if (Array.isArray(data.drivers)) {
          drivers = data.drivers;
        }

        // Load geofences
        if (Array.isArray(data.geofences)) {
          geofences = data.geofences;
        }

        // Load trips
        if (Array.isArray(data.trips)) {
          trips = data.trips;
        }

        // Load products
        if (Array.isArray(data.products)) {
          products = data.products;
        }

        // Load contracts
        if (Array.isArray(data.contracts)) {
          contracts = data.contracts;
        }

        // Load maintenanceRecords
        if (Array.isArray(data.maintenanceRecords)) {
          maintenanceRecords = data.maintenanceRecords;
        }

        // Load rotograms
        if (Array.isArray(data.rotograms)) {
          rotograms = data.rotograms;
        }
      }
      autoResolveRawCoordinates();
    } else {
      console.log('[Firebase] Semeando estado consolidado inicial...');
      skipFirestoreSave = false;
      await saveDatabaseToFirestore();
    }

    skipFirestoreSave = false;
    saveDatabaseToDisk(false);

    console.log(`[Firebase] Sincronização concluída. Veículos: ${vehicles.length}, Motoristas: ${drivers.length}, Cercas: ${geofences.length}, Viagens: ${trips.length}`);
    return true;
  } catch (err: any) {
    skipFirestoreSave = false;
    const errMsg = err?.message || '';
    const errCode = err?.code || '';
    if (
      errMsg.includes('RESOURCE_EXHAUSTED') || 
      errCode === 'resource-exhausted' ||
      errMsg.includes('Quota limit exceeded') ||
      errMsg.includes('Quota exceeded')
    ) {
      await handleQuotaExceeded(err);
    } else {
      console.error('[Firebase] Erro ao carregar do Firestore:', err);
    }
    return false;
  }
}

let skipFirestoreSave = false;

function saveDatabaseToDisk(immediate = false) {
  try {
    // Sync stoppedSince based on speed (not cumulative, reset when moving, start fresh when stopped)
    vehicles.forEach(v => {
      if (v.speed > 0) {
        if (v.stoppedSince !== null) {
          v.stoppedSince = null;
        }
      } else {
        if (!v.stoppedSince) {
          v.stoppedSince = new Date().toISOString();
        }
      }
    });

    const data = {
      vehicles,
      drivers,
      geofences,
      products,
      trips,
      contracts,
      maintenanceRecords,
      rotograms,
      demoMode,
      sascarUser,
      sascarPass,
      lastSyncTime,
      activeSyncMethod,
      sascarIdToPlateMap: Array.from(sascarIdToPlateMap.entries()),
      sascarDriverIdToNameMap: Array.from(sascarDriverIdToNameMap.entries()),
      sascarVehicleIdToDriverIdMap: Array.from(sascarVehicleIdToDriverIdMap.entries()),
      manualDriverNamesMap: Array.from(manualDriverNamesMap.entries()),
      isFirestoreQuotaExceeded,
      firestoreQuotaExceededUntil,
    };
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log('[Cache] Base de dados persistida com sucesso no disco.');
    
    // Only queue save to Firestore if we have active clients OR if it is an immediate manual save
    if (!skipFirestoreSave && (immediate || (sseClients && sseClients.length > 0))) {
      lastDatabaseUpdateTime = Date.now(); // Mark this local timestamp immediately to block stale incoming Firestore snapshots
      queueFirestoreSave(immediate);
    }
  } catch (err) {
    console.error('[Cache] Erro ao salvar base de dados no disco:', err);
  }
}

  // Lazy-loaded Gemini AI client creation
  let aiInstance: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('A chave de API do Gemini (GEMINI_API_KEY) não está configurada nos segredos do sistema.');
    }
    if (!aiInstance) {
      aiInstance = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiInstance;
  }

  const BRAZIL_STATES: Record<string, string> = {
    'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amapa': 'AP', 'amazonas': 'AM',
    'bahia': 'BA', 'ceará': 'CE', 'ceara': 'CE', 'distrito federal': 'DF',
    'espírito santo': 'ES', 'espirito santo': 'ES', 'goiás': 'GO', 'goias': 'GO',
    'maranhão': 'MA', 'maranhao': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
    'minas gerais': 'MG', 'pará': 'PA', 'para': 'PA', 'paraíba': 'PB', 'paraiba': 'PB',
    'paraná': 'PR', 'parana': 'PR', 'pernambuco': 'PE', 'piauí': 'PI', 'piaui': 'PI',
    'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
    'rondônia': 'RO', 'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
    'são paulo': 'SP', 'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO'
  };

  async function resolveLocationToCoordinates(input: string): Promise<{ lat: number; lng: number; address: string } | null> {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Try to parse directly as coordinates
    const coords = parseCoordinates(trimmed);
    if (coords) {
      const address = await reverseGeocode(coords.lat, coords.lng);
      return { lat: coords.lat, lng: coords.lng, address };
    }

    // 2. Check if text matches a known Brazilian city name directly
    const matchedCity = BRAZIL_CITIES.find(c =>
      trimmed.toLowerCase().includes(c.name.toLowerCase()) ||
      c.name.toLowerCase().includes(trimmed.toLowerCase())
    );
    if (matchedCity) {
      return {
        lat: matchedCity.lat,
        lng: matchedCity.lng,
        address: `${matchedCity.name} - ${matchedCity.uf}`
      };
    }

    // 3. Fallback: use Gemini if text is a complex location string (e.g. "Posto X, Rodovia BR-153")
    try {
      const client = getGeminiClient();
      const prompt = `Você é um resolvedor de geolocalização preciso para o Brasil.
A partir do texto de localização fornecido: "${trimmed}"
Retorne APENAS um objeto JSON válido (sem markdown, sem blocos de código \`\`\`json) com a seguinte estrutura de dados exata:
{
  "lat": <latitude como número decimal>,
  "lng": <longitude como número decimal>,
  "address": "<Nome da Cidade> - <UF>"
}
Se for impossível identificar a cidade, retorne null.`;

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text?.trim() || '';
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      if (cleanJson && cleanJson !== 'null') {
        const parsed = JSON.parse(cleanJson);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          if (parsed.lat >= -90 && parsed.lat <= 90 && parsed.lng >= -180 && parsed.lng <= 180) {
            return {
              lat: parsed.lat,
              lng: parsed.lng,
              address: parsed.address || trimmed
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Gemini Geocode Resolution Warning]:', err);
    }

    return null;
  }

  async function reverseGeocode(lat: number, lng: number): Promise<string> {
    // 1. Check if it matches a known geofence first (guarantees exact name for yards/posts)
    if (geofences && geofences.length > 0) {
      const nearestGf = geofences.map(gf => {
        const d = haversineDistance(lat, lng, gf.latitude, gf.longitude);
        return { gf, d };
      }).sort((a, b) => a.d - b.d)[0];

      if (nearestGf && nearestGf.d < 500) { // Within 500 meters
        const name = nearestGf.gf.name;
        if (name.includes('BAMAT')) return 'Candeias - BA';
        if (name.includes('BAVIT')) return 'Vitória - ES';
        if (name.includes('Bom Sucesso')) return 'Bom Jesus de Goiás - GO';
        if (name.includes('Work Transportes')) return 'Serra - ES';
        if (name.includes('Posto')) return 'Inhambupe - BA';
      }
    }

    // 2. High-precision offline spatial lookup (instant, 100% reliable)
    return getCityStateFromCoordinates(lat, lng);
  }

  async function autoResolveRawCoordinates() {
    let changed = false;
    for (const v of vehicles) {
      const isRaw = !v.manualLocation ||
        v.manualLocation.startsWith('Coordenadas (') ||
        v.manualLocation.toLowerCase().includes('coordenadas') ||
        v.manualLocation.toLowerCase().includes('coord') ||
        !v.manualLocation.includes('-');

      const coords = (v.manualLocation ? parseCoordinates(v.manualLocation) : null) ||
        (v.currentLatitude && v.currentLongitude ? { lat: v.currentLatitude, lng: v.currentLongitude } : null);

      if (coords) {
        const locName = await reverseGeocode(coords.lat, coords.lng);
        if (locName && !locName.startsWith('Coordenadas (') && locName.includes('-')) {
          if (v.manualLocation !== locName) {
            console.log(`[AutoGeocode] Atualizado veículo ${v.licensePlate} (${v.id}): ${v.manualLocation} -> ${locName}`);
            v.manualLocation = locName;
            v.manualLocationUpdatedAt = new Date().toISOString();
            changed = true;
          }
        }
      }
    }
    if (changed) {
      saveDatabaseToDisk(true);
      broadcastVehicles();
    }
  }

function loadDatabaseFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const rawData = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      const data = JSON.parse(rawData);
      
      if (data.vehicles && Array.isArray(data.vehicles)) {
        vehicles = data.vehicles;
        // Sanitize stoppedSince state when loading from cache
        const nowMs = Date.now();
        vehicles.forEach(v => {
          if (v.speed > 0) {
            v.stoppedSince = null;
          } else if (v.stoppedSince) {
            const elapsedHours = (nowMs - new Date(v.stoppedSince).getTime()) / 3600000;
            if (elapsedHours > 12) {
              // Stale cache from a previous day's session: refresh to recent stopped state (15 min ago)
              v.stoppedSince = new Date(nowMs - 15 * 60 * 1000).toISOString();
            }
          } else {
            v.stoppedSince = new Date().toISOString();
          }
        });
      }
      if (data.drivers && Array.isArray(data.drivers)) {
        drivers = data.drivers;
      }
      if (data.geofences && Array.isArray(data.geofences)) {
        geofences = data.geofences;
      }
      if (data.products && Array.isArray(data.products)) {
        products = data.products;
      }
      if (data.trips && Array.isArray(data.trips)) {
        trips = data.trips;
        // Sanitize active trips that were incorrectly flagged as exited origin without having entered
        trips.forEach(t => {
          if (t.status !== 'DELIVERED') {
            t.hasExitedOrigin = false;
            if (t.events) {
              t.events = t.events.filter(e => e.type !== 'WAITING_CTE_CONCLUDE');
            }
          }
        });
      }
      if (data.contracts && Array.isArray(data.contracts)) {
        contracts = data.contracts;
      }
      if (data.maintenanceRecords && Array.isArray(data.maintenanceRecords)) {
        maintenanceRecords = data.maintenanceRecords;
      }
      if (data.rotograms && Array.isArray(data.rotograms)) {
        rotograms = data.rotograms;
      }
      if (data.demoMode !== undefined) demoMode = data.demoMode;
      if (data.sascarUser !== undefined) sascarUser = data.sascarUser;
      if (data.sascarPass !== undefined) sascarPass = data.sascarPass;
      if (data.lastSyncTime !== undefined) lastSyncTime = data.lastSyncTime;
      if (data.activeSyncMethod !== undefined) activeSyncMethod = data.activeSyncMethod;

      if (data.sascarIdToPlateMap) {
        sascarIdToPlateMap = new Map(data.sascarIdToPlateMap);
      }
      if (data.sascarDriverIdToNameMap) {
        sascarDriverIdToNameMap = new Map(data.sascarDriverIdToNameMap);
      }
      if (data.sascarVehicleIdToDriverIdMap) {
        sascarVehicleIdToDriverIdMap = new Map(data.sascarVehicleIdToDriverIdMap);
      }
      if (data.manualDriverNamesMap) {
        manualDriverNamesMap = new Map(data.manualDriverNamesMap);
      }
      if (data.isFirestoreQuotaExceeded !== undefined) {
        isFirestoreQuotaExceeded = data.isFirestoreQuotaExceeded;
      }
      if (data.firestoreQuotaExceededUntil !== undefined) {
        firestoreQuotaExceededUntil = data.firestoreQuotaExceededUntil;
      }
      
      autoResolveRawCoordinates();
      
      console.log(`[Cache] Base de dados carregada com sucesso do disco (Cota excedida do Firestore: ${isFirestoreQuotaExceeded}). Veículos: ${vehicles.length}, Motoristas: ${drivers.length}, Cercas: ${geofences.length}, Viagens: ${trips.length}`);
    } else {
      console.log('[Cache] Nenhum arquivo de cache encontrado. Inicializando com estado padrão.');
    }
  } catch (err) {
    console.error('[Cache] Erro ao carregar base de dados do disco:', err);
  }
}

function broadcastSSE(event: string, data: any) {
  for (const client of sseClients) {
    try {
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // client connection might be broken
    }
  }
}

function broadcastVehicles(immediate = true) {
  saveDatabaseToDisk(immediate);
  const dataToSend = demoMode 
    ? vehicles 
    : vehicles.filter(v => {
        if (v.id.startsWith('real_')) return true;
        return !['v1', 'v2', 'v3'].includes(v.id);
      });
  broadcastSSE('vehicles', dataToSend);
}

function broadcastDrivers(immediate = true) {
  saveDatabaseToDisk(immediate);
  const dataToSend = demoMode
    ? drivers
    : drivers.filter(d => d.id.startsWith('real_') || !['d1', 'd2', 'd3'].includes(d.id));
  broadcastSSE('drivers', dataToSend);
}

function broadcastGeofences(immediate = true) {
  saveDatabaseToDisk(immediate);
  broadcastSSE('geofences', geofences);
}

function broadcastProducts(immediate = true) {
  saveDatabaseToDisk(immediate);
  broadcastSSE('products', products);
}

function broadcastContracts(immediate = true) {
  saveDatabaseToDisk(immediate);
  broadcastSSE('contracts', contracts);
}

function broadcastTrips(immediate = true) {
  saveDatabaseToDisk(immediate);
  const dataToSend = demoMode
    ? trips
    : trips.filter(t => t.id !== 't1');
  broadcastSSE('trips', dataToSend);
}

function broadcastSettings(immediate = true) {
  saveDatabaseToDisk(immediate);
  broadcastSSE('settings', {
    demoMode,
    sascarUser,
    sascarPass: sascarPass ? '••••••••' : '',
    lastSyncError,
    lastSyncTime
  });
}

function parseReturnElement(returnText: string): any {
  returnText = returnText.trim();
  // Standardize non-standard minus signs (U+2212) to standard ASCII hyphens (-) in both XML and JSON payloads
  returnText = returnText.replace(/\u2212/g, '-');

  if (returnText.startsWith('{') || returnText.startsWith('[')) {
    try {
      return JSON.parse(returnText);
    } catch (e) {
      // not JSON
    }
  }
  
  // Try parsing as simple flat XML tags
  const obj: Record<string, any> = {};
  const tagRegex = /<([^>]+)>([\s\S]*?)<\/\1>/g;
  let tagMatch;
  let hasTags = false;
  while ((tagMatch = tagRegex.exec(returnText)) !== null) {
    hasTags = true;
    const key = tagMatch[1];
    let val = tagMatch[2].trim();
    // Normalize negative signs in raw tag values
    val = val.replace(/\u2212/g, '-');
    if (val === 'true') obj[key] = true;
    else if (val === 'false') obj[key] = false;
    else if (val === 'null') obj[key] = null;
    else if (/^-?\d+$/.test(val)) obj[key] = parseInt(val, 10);
    else if (/^-?\d+[\.,]\d+$/.test(val)) obj[key] = parseFloat(val.replace(',', '.'));
    else obj[key] = val;
  }
  
  if (hasTags) {
    return obj;
  }
  return null;
}

async function fetchSascarVehiclesMap() {
  if (!sascarUser || !sascarPass) return;
  try {
    console.log('[Sascar Sync] Fetching vehicle list (obterVeiculos)...');
    const SASCAR_URL = 'https://sasintegra.sascar.com.br/SasIntegra/SasIntegraWSService';
    const method = 'obterVeiculos';
    const soapBody = `
      <soapenv:Envelope
        xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
        xmlns:web="http://webservice.web.integracao.sascar.com.br/">
        <soapenv:Header/>
        <soapenv:Body>
          <web:${method}>
            <usuario>${sascarUser}</usuario>
            <senha>${sascarPass}</senha>
            <quantidade>1000</quantidade>
          </web:${method}>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(SASCAR_URL, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': `"${method}"`,
        },
        body: soapBody,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.log(`[Sascar Sync] Failed to fetch vehicles list: HTTP ${response.status}`);
      return;
    }

    const xmlText = await response.text();
    const returnRegex = /<return>([\s\S]*?)<\/return>/g;
    let match;
    let count = 0;
    while ((match = returnRegex.exec(xmlText)) !== null) {
      const item = parseReturnElement(match[1].trim());
      if (item && item.idVeiculo && item.placa) {
        let cleanPlate = String(item.placa).toUpperCase().trim();
        // Remove suffixes like "-1", "-2" representing trailer or equipment indexes
        if (cleanPlate.includes('-')) {
          const parts = cleanPlate.split('-');
          if (parts.length > 1 && parts[parts.length - 1].length === 1) {
            cleanPlate = parts.slice(0, -1).join('-');
          }
        }
        sascarIdToPlateMap.set(String(item.idVeiculo), cleanPlate);

        // Deduced or parsed model description
        let modelName = item.descricao || item.description || '';
        if (!modelName) {
          if (item.idEquipamentoDesc) {
            modelName = item.idEquipamentoDesc;
          } else {
            modelName = 'Veículo Sascar';
          }
        }

        // Try to find assigned driver from cache maps
        const driverId = sascarVehicleIdToDriverIdMap.get(String(item.idVeiculo)) || null;
        const driverName = driverId ? sascarDriverIdToNameMap.get(driverId) || null : null;

        // Check if this vehicle is already in our in-memory global array
        const existingVehicleIndex = vehicles.findIndex(v => v.licensePlate.toUpperCase().trim() === cleanPlate);
        if (existingVehicleIndex >= 0) {
          // Update model and preserve actual coordinates/telemetry data
          vehicles[existingVehicleIndex] = {
            ...vehicles[existingVehicleIndex],
            model: modelName,
            driverId: driverId || vehicles[existingVehicleIndex].driverId,
            driverName: driverName || vehicles[existingVehicleIndex].driverName,
          };
        } else {
          // Initialize with default coordinate (e.g. CD Campinas area so they are in Brazil)
          vehicles.push({
            id: 'real_' + item.idVeiculo,
            licensePlate: cleanPlate,
            model: modelName,
            currentLatitude: -22.9056,
            currentLongitude: -47.0608,
            direction: 0,
            speed: 0,
            status: 'AVAILABLE',
            driverId: driverId,
            driverName: driverName,
            telemetryTime: new Date().toISOString()
          });
        }

        count++;
      }
    }
    console.log(`[Sascar Sync] Loaded and synchronized ${count} vehicle mappings into fleet database.`);
  } catch (err: any) {
    console.error('[Sascar Sync] Error building vehicles list:', err);
  }
}

async function fetchSascarDriversMap() {
  if (!sascarUser || !sascarPass) return;
  try {
    console.log('[Sascar Sync] Fetching driver list (obterMotoristas)...');
    const SASCAR_URL = 'https://sasintegra.sascar.com.br/SasIntegra/SasIntegraWSService';
    const method = 'obterMotoristas';
    const soapBody = `
      <soapenv:Envelope
        xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
        xmlns:web="http://webservice.web.integracao.sascar.com.br/">
        <soapenv:Header/>
        <soapenv:Body>
          <web:${method}>
            <usuario>${sascarUser}</usuario>
            <senha>${sascarPass}</senha>
            <quantidade>1000</quantidade>
          </web:${method}>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(SASCAR_URL, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': `"${method}"`,
        },
        body: soapBody,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.log(`[Sascar Sync] Failed to fetch drivers list: HTTP ${response.status}`);
      return;
    }

    const xmlText = await response.text();
    const returnRegex = /<return>([\s\S]*?)<\/return>/g;
    let match;
    let count = 0;
    while ((match = returnRegex.exec(xmlText)) !== null) {
      const item = parseReturnElement(match[1].trim());
      if (item && item.idMotorista && item.nome) {
        sascarDriverIdToNameMap.set(String(item.idMotorista), String(item.nome).trim());
        count++;

        // Also ensure driver exists in global drivers array
        const driverIdStr = String(item.idMotorista);
        const driverNameStr = String(item.nome).trim();
        const driverExists = drivers.find(d => d.id === driverIdStr || d.name.toUpperCase().trim() === driverNameStr.toUpperCase());
        if (!driverExists) {
          drivers.push({
            id: driverIdStr,
            name: driverNameStr,
            cpf: 'Sincronizado',
            phone: item.telefone || item.celular || 'Não Cadastrado',
            status: 'AVAILABLE',
            licenseNumber: 'Sascar Sync'
          });
        }
      }
    }
    console.log(`[Sascar Sync] Loaded and synchronized ${count} drivers from Sascar.`);
  } catch (err: any) {
    console.error('[Sascar Sync] Error building drivers list:', err);
  }
}

async function fetchSascarDriverVehicleAssignments() {
  if (!sascarUser || !sascarPass) return;
  try {
    console.log('[Sascar Sync] Fetching driver assignments (obterMotoristasVeiculos)...');
    const SASCAR_URL = 'https://sasintegra.sascar.com.br/SasIntegra/SasIntegraWSService';
    const method = 'obterMotoristasVeiculos';
    const soapBody = `
      <soapenv:Envelope
        xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
        xmlns:web="http://webservice.web.integracao.sascar.com.br/">
        <soapenv:Header/>
        <soapenv:Body>
          <web:${method}>
            <usuario>${sascarUser}</usuario>
            <senha>${sascarPass}</senha>
            <quantidade>1000</quantidade>
          </web:${method}>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(SASCAR_URL, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': `"${method}"`,
        },
        body: soapBody,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.log(`[Sascar Sync] Failed to fetch assignments: HTTP ${response.status}`);
      return;
    }

    const xmlText = await response.text();
    const returnRegex = /<return>([\s\S]*?)<\/return>/g;
    let match;
    let count = 0;
    while ((match = returnRegex.exec(xmlText)) !== null) {
      const item = parseReturnElement(match[1].trim());
      if (item && item.idVeiculo && item.idMotorista) {
        sascarVehicleIdToDriverIdMap.set(String(item.idVeiculo), String(item.idMotorista));
        count++;
      }
    }
    console.log(`[Sascar Sync] Loaded ${count} driver assignments from Sascar.`);
  } catch (err: any) {
    console.error('[Sascar Sync] Error fetching driver assignments:', err);
  }
}

async function runPositionSync() {
  if (demoMode || !sascarUser || !sascarPass) return;

  // Add a small randomized delay (jitter) of up to 4 seconds to prevent different container
  // instances from querying Sascar at the exact same millisecond.
  const jitter = Math.floor(Math.random() * 4000);
  await new Promise(r => setTimeout(r, jitter));

  // Prevent multiple active container instances from simultaneously querying Sascar
  // and triggering single active connection failures.
  const now = Date.now();
  const lastSyncMs = lastSyncTime ? new Date(lastSyncTime).getTime() : 0;
  if (now - lastSyncMs < 10000) {
    console.log(`[Sascar Sync] Sincronização pulada (após jitter de ${jitter}ms): Outra instância sincronizou recentemente.`);
    return;
  }

  if (isSyncing) {
    console.log('[Sascar Sync] Sync is already in progress. Skipping concurrent execution.');
    return;
  }

  isSyncing = true;
  let telemetryChanged = false;
  try {
    // Ensure we have the driver map and driver-to-vehicle assignments loaded with stagger delays
    if (sascarDriverIdToNameMap.size === 0) {
      await fetchSascarDriversMap();
      await new Promise(r => setTimeout(r, 1500));
    }
    if (sascarVehicleIdToDriverIdMap.size === 0) {
      await fetchSascarDriverVehicleAssignments();
      await new Promise(r => setTimeout(r, 1500));
    }
    // Ensure we have the vehicle-to-plaque map loaded
    if (sascarIdToPlateMap.size === 0) {
      await fetchSascarVehiclesMap();
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log('--- SASCAR SYNC: Polling telemetry ---');
    
    const candidates = activeSyncMethod 
      ? [activeSyncMethod]
      : [
          'obterPacotePosicoesMotorista',
          'obterPacotePosicoes',
          'obterPacotePosicoesMotoristaJSON',
          'obterPacotePosicoesJSON',
          'getPositionsPacketJSON',
          'getPositionPacketWithLicensePlateJSON'
        ];

    let xmlText = '';
    let status = 500;
    let lastAttemptError = '';
    let successfulMethod: string | null = null;

    for (let i = 0; i < candidates.length; i++) {
      const method = candidates[i];
      if (i > 0) {
        // Pause between candidate retries to prevent connection collisions on Sascar
        await new Promise(r => setTimeout(r, 1500));
      }

      const isEnglish = method.startsWith('get');
      const userTag = isEnglish ? 'user' : 'usuario';
      const passTag = isEnglish ? 'password' : 'senha';
      const qtyTag = isEnglish ? 'quantity' : 'quantidade';

      const soapBody = `
        <soapenv:Envelope
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
          xmlns:web="http://webservice.web.integracao.sascar.com.br/">
          <soapenv:Header/>
          <soapenv:Body>
            <web:${method}>
              <${userTag}>${sascarUser}</${userTag}>
              <${passTag}>${sascarPass}</${passTag}>
              <${qtyTag}>250</${qtyTag}>
            </web:${method}>
          </soapenv:Body>
        </soapenv:Envelope>
      `;

      const SASCAR_URL = 'https://sasintegra.sascar.com.br/SasIntegra/SasIntegraWSService';
      
      let retryCount = 0;
      const maxRetries = 3;
      let attemptSuccess = false;

      while (retryCount <= maxRetries) {
        if (retryCount > 0) {
          const backoff = 3000 + Math.floor(Math.random() * 4000); // 3 to 7 seconds delay
          console.log(`[Sascar Sync] Connection restriction detected. Retrying method ${method} (attempt ${retryCount}/${maxRetries}) in ${backoff}ms...`);
          await new Promise(r => setTimeout(r, backoff));
        }

        try {
          console.log(`[Sascar Sync] Attempting with method: ${method} (try #${retryCount})`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          let response;
          try {
            response = await fetch(SASCAR_URL, {
              signal: controller.signal,
              method: 'POST',
              headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': `"${method}"`,
              },
              body: soapBody,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          xmlText = await response.text();
          status = response.status;

          // Check if there's any SOAP Fault / Access restriction in the response
          const hasFault = xmlText.includes('<faultstring>') || xmlText.includes('<soapenv:Fault>') || xmlText.includes('<S:Fault>');
          
          if (response.ok && !hasFault) {
            attemptSuccess = true;
            break; // Success! Exit retry loop
          } else {
            const faultMatch = /<faultstring>([\s\S]*?)<\/faultstring>/.exec(xmlText);
            const err = faultMatch ? faultMatch[1].trim().replace(/Atencao:\s*/gi, '') : `HTTP ${status}`;
            lastAttemptError = err;
            console.log(`[Sascar Sync] Method ${method} attempt ${retryCount} failed: ${err}`);

            // Only retry if it is an active connection lock/concurrency error
            const isConnectionLock = err.includes('conexão em execução') || 
                                     err.includes('1 conexo em execucao') || 
                                     err.includes('1 conexão em execucao') ||
                                     err.includes('incrementar acesso');
            
            if (isConnectionLock) {
              retryCount++;
            } else {
              break; // Other error (e.g. invalid credentials or malformed XML), do not retry
            }
          }
        } catch (e: any) {
          const isAbort = e.name === 'AbortError' || (e.message && e.message.toLowerCase().includes('abort'));
          lastAttemptError = isAbort
            ? 'Tempo limite de resposta do servidor Sascar excedido (Timeout de 30s)'
            : (e.message || 'Erro de conexão na sincronização Sascar');
          console.log(`[Sascar Sync] Method ${method} attempt ${retryCount} threw: ${lastAttemptError}`);
          
          // Network errors or timeouts should also retry
          retryCount++;
        }
      }

      if (attemptSuccess) {
        successfulMethod = method;
        break; // Success! Exit candidates loop
      }
    }

    if (!successfulMethod) {
      lastSyncError = lastAttemptError || 'Todas as tentativas de conexão SOAP falharam.';
      console.log(`[Sascar Sync] Sync failed: ${lastSyncError}`);
      return;
    }

    // Persist the working method for subsequent sync runs
    activeSyncMethod = successfulMethod;
    console.log(`[Sascar Sync] Successfully synced using method: ${activeSyncMethod}`);

    // Sync was successful
    lastSyncError = null;
    lastSyncTime = new Date().toISOString();

    const returns: string[] = [];
    const regex = /<return>([\s\S]*?)<\/return>/g;
    let match;
    while ((match = regex.exec(xmlText)) !== null) {
      returns.push(match[1].trim());
    }

    if (returns.length === 0) {
      console.log('[Sascar Sync] Sync complete. No new telemetry packets.');
      return;
    }

function parseSascarDateToIso(rawDate: any): string {
  if (!rawDate) return new Date().toISOString();
  const str = String(rawDate).replace(/\u2212/g, '-').trim();
  if (!str) return new Date().toISOString();

  // If already standard ISO with timezone suffix
  if (str.includes('Z') || (str.includes('T') && (str.includes('+') || str.indexOf('-', 10) > 0))) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Handle DD/MM/YYYY HH:mm:ss (Brasília local time UTC-3)
  const brFormatMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(str);
  if (brFormatMatch) {
    const day = parseInt(brFormatMatch[1], 10);
    const month = parseInt(brFormatMatch[2], 10) - 1;
    const year = parseInt(brFormatMatch[3], 10);
    const hour = parseInt(brFormatMatch[4], 10);
    const minute = parseInt(brFormatMatch[5], 10);
    const second = parseInt(brFormatMatch[6], 10);
    // Convert Brasília local time (UTC-3) to UTC timestamp (add 3 hours)
    const utcMs = Date.UTC(year, month, day, hour + 3, minute, second);
    return new Date(utcMs).toISOString();
  }

  // Handle YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss (Brasília local time UTC-3)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(str);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const hour = parseInt(isoMatch[4], 10);
    const minute = parseInt(isoMatch[5], 10);
    const second = parseInt(isoMatch[6], 10);
    // Convert Brasília local time (UTC-3) to UTC timestamp (add 3 hours)
    const utcMs = Date.UTC(year, month, day, hour + 3, minute, second);
    return new Date(utcMs).toISOString();
  }

  const fallback = new Date(str.replace(' ', 'T'));
  if (!isNaN(fallback.getTime())) return fallback.toISOString();

  return new Date().toISOString();
}

    console.log(`[Sascar Sync] Received ${returns.length} vehicle packets.`);

    // Pre-parse and sort telemetry packets from oldest to newest to ensure chronological order
    const parsedPackets = returns.map(itemStr => {
      try {
        const item = parseReturnElement(itemStr);
        if (!item) return null;

        const rawDate = item.positionDateUtc || item.dataPosicao || item.dataPacote;
        const telemetryIso = parseSascarDateToIso(rawDate);
        return { item, telemetryIso, itemStr };
      } catch (e) {
        return null;
      }
    }).filter((p): p is { item: any; telemetryIso: string; itemStr: string } => p !== null);

    // Sort chronologically: oldest first, so newest is processed last and overrides previous ones
    parsedPackets.sort((a, b) => new Date(a.telemetryIso).getTime() - new Date(b.telemetryIso).getTime());

    parsedPackets.forEach(({ item, telemetryIso, itemStr }) => {
      try {
        // Normalize property names from English/Portuguese JSON or flat XML
        const vehicleId = item.vehicleId || item.idVeiculo;
        let plateRaw = item.licensePlate || item.placa || item.veiplaca;

        if (!plateRaw && vehicleId) {
          // Resolve plaque using our map cached from obterVeiculos
          plateRaw = sascarIdToPlateMap.get(String(vehicleId));
        }

        if (!plateRaw || !vehicleId) return;

        let plate = String(plateRaw).toUpperCase().trim();
        // Remove suffixes like "-1", "-2" representing trailer or equipment indexes
        if (plate.includes('-')) {
          const parts = plate.split('-');
          if (parts.length > 1 && parts[parts.length - 1].length === 1) {
            plate = parts.slice(0, -1).join('-');
          }
        }

        const existingIndex = vehicles.findIndex(v => v.licensePlate.toUpperCase().trim() === plate);

        const existingVehicle = existingIndex >= 0 ? vehicles[existingIndex] : null;

        const speed = parseInt(item.speed !== undefined ? item.speed : item.velocidade) || 0;
        const isBlocked = item.blocking === 1 || item.bloqueio === 1;
        const isMaintenance = existingVehicle && existingVehicle.status === 'MAINTENANCE';
        const statusVal: VehicleStatus = isMaintenance
          ? 'MAINTENANCE'
          : (isBlocked ? 'BLOCKED' : (speed > 0 ? 'EN_ROUTE' : 'AVAILABLE'));

        const driverId = item.driverId || item.idMotorista;
        const driverName = item.driverName || item.nomeMotorista;

        const cachedDriverId = sascarVehicleIdToDriverIdMap.get(String(vehicleId)) || null;
        const cachedDriverName = cachedDriverId ? sascarDriverIdToNameMap.get(cachedDriverId) || null : null;

        // Check for manual driver overrides first so they aren't overwritten by telemetry updates
        const overrideId = existingVehicle ? manualDriverNamesMap.get(existingVehicle.id) : undefined;
        const overridePlate = manualDriverNamesMap.get(plate);
        const hasManualOverride = overrideId !== undefined || overridePlate !== undefined;
        const overriddenDriverName = overrideId !== undefined ? overrideId : (overridePlate !== undefined ? overridePlate : null);

        const finalDriverId = hasManualOverride ? (existingVehicle ? existingVehicle.driverId : null) : (driverId ? String(driverId) : (cachedDriverId ? String(cachedDriverId) : (existingVehicle ? existingVehicle.driverId : null)));
        const finalDriverName = hasManualOverride ? overriddenDriverName : (driverName ? String(driverName) : (cachedDriverName ? String(cachedDriverName) : (existingVehicle ? existingVehicle.driverName : null)));

        // Enrich model name with city and state info if available
        let modelName = item.description || item.descricao || '';
        if (!modelName) {
          if (item.cidade) {
            modelName = `${item.cidade}/${item.uf || 'BR'}`;
          } else {
            modelName = existingVehicle ? existingVehicle.model : 'Veículo Sascar';
          }
        }

        let latRaw = item.latitude !== undefined ? item.latitude : item.lat;
        let lngRaw = item.longitude !== undefined ? item.longitude : (item.lng !== undefined ? item.lng : item.lon);
        
        // Handle Brazilian comma decimals
        if (typeof latRaw === 'string') latRaw = latRaw.replace(',', '.');
        if (typeof lngRaw === 'string') lngRaw = lngRaw.replace(',', '.');

        const lat = parseFloat(latRaw);
        const lng = parseFloat(lngRaw);

        // Fallback to existing coordinates or CD Campinas
        const prevLat = existingVehicle ? existingVehicle.currentLatitude : -22.9056;
        const prevLng = existingVehicle ? existingVehicle.currentLongitude : -47.0608;

        const finalLat = (!isNaN(lat) && lat !== 0) ? lat : prevLat;
        const finalLng = (!isNaN(lng) && lng !== 0) ? lng : prevLng;

        let stoppedSinceVal: string | null = null;
        if (speed === 0) {
          if (existingVehicle && existingVehicle.speed === 0 && existingVehicle.stoppedSince) {
            stoppedSinceVal = existingVehicle.stoppedSince;
          } else {
            stoppedSinceVal = telemetryIso || new Date().toISOString();
          }
        } else {
          stoppedSinceVal = null;
        }

        const mappedVehicle: Vehicle = {
          id: existingVehicle ? existingVehicle.id : 'real_' + vehicleId,
          licensePlate: plate,
          model: modelName,
          currentLatitude: finalLat,
          currentLongitude: finalLng,
          direction: parseInt(item.direction !== undefined ? item.direction : item.direcao) || 0,
          speed: speed,
          status: statusVal,
          driverId: finalDriverId,
          driverName: finalDriverName,
          telemetryTime: telemetryIso,
          stoppedSince: stoppedSinceVal,
          maintenanceReason: existingVehicle ? existingVehicle.maintenanceReason : null,
          maintenanceExpectedDate: existingVehicle ? existingVehicle.maintenanceExpectedDate : null,
          maintenanceStartDate: existingVehicle ? existingVehicle.maintenanceStartDate : null
        };

        if (existingIndex >= 0) {
          const existingVehicle = vehicles[existingIndex];
          const existingTime = existingVehicle.telemetryTime ? new Date(existingVehicle.telemetryTime).getTime() : 0;
          const incomingTime = new Date(telemetryIso).getTime();

          // Only update vehicle state if the incoming packet is newer or equal
          if (incomingTime >= existingTime) {
            const hasLatChanged = Math.abs((existingVehicle.currentLatitude || 0) - finalLat) > 0.00001;
            const hasLngChanged = Math.abs((existingVehicle.currentLongitude || 0) - finalLng) > 0.00001;
            const hasSpeedChanged = existingVehicle.speed !== speed;
            const hasStatusChanged = existingVehicle.status !== statusVal;
            const hasDriverChanged = existingVehicle.driverId !== finalDriverId;

            if (hasLatChanged || hasLngChanged || hasSpeedChanged || hasStatusChanged || hasDriverChanged) {
              telemetryChanged = true;
            }

            vehicles[existingIndex] = {
              ...vehicles[existingIndex],
              ...mappedVehicle
            };
          }
        } else {
          vehicles.push(mappedVehicle);
          telemetryChanged = true;
        }

        // Track real-time GPS coordinate into active trip route history
        if (finalLat !== 0 && finalLng !== 0) {
          const activeTrip = trips.find(t => t.vehicleId === mappedVehicle.id && t.status !== 'DELIVERED');
          if (activeTrip) {
            if (!Array.isArray(activeTrip.routeHistory)) activeTrip.routeHistory = [];
            const lastPt = activeTrip.routeHistory[activeTrip.routeHistory.length - 1];
            if (!lastPt || Math.abs(lastPt.latitude - finalLat) > 0.0001 || Math.abs(lastPt.longitude - finalLng) > 0.0001) {
              activeTrip.routeHistory.push({ latitude: finalLat, longitude: finalLng });
            }
          }
        }

        // Update driver info if present
        if (driverName && driverId) {
          const driverIdStr = String(driverId);
          const driverExists = drivers.find(d => d.id === driverIdStr || d.name.toUpperCase().trim() === String(driverName).toUpperCase().trim());
          if (!driverExists) {
            drivers.push({
              id: driverIdStr,
              name: String(driverName),
              cpf: 'Sincronizado',
              phone: '',
              status: speed > 0 ? 'EN_ROUTE' : 'AVAILABLE',
              licenseNumber: 'Sascar Sync'
            });
          } else {
            driverExists.status = speed > 0 ? 'EN_ROUTE' : 'AVAILABLE';
          }
        }
      } catch (err) {
        console.error('[Sascar Sync] Error parsing vehicle packet:', err);
      }
    });
  } catch (err: any) {
    console.error('[Sascar Sync] Unexpected error:', err);
    lastSyncError = err.message || 'Erro inesperado na sincronização.';
  } finally {
    isSyncing = false;
    evaluateGeofences();
    if (telemetryChanged) {
      console.log('[Sascar Sync] Telemetry changed. Persisting to disk and cloud...');
      saveDatabaseToDisk(true);
    }
    broadcastVehicles(false);
    broadcastDrivers(false);
    broadcastSettings(false);
  }
}

function startSascarSync() {
  if (sascarSyncInterval) {
    clearInterval(sascarSyncInterval);
    sascarSyncInterval = null;
  }

  // Trigger once immediately in background on startup
  runPositionSync().catch(err => {
    console.error('[Sascar Sync] Initial sync run failed:', err);
  });

  // Poll Sascar telemetry every 15 seconds to respect Sascar single active connection rules
  sascarSyncInterval = setInterval(async () => {
    await runPositionSync();
  }, 15000);
}

// Haversine formula
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ray-casting algorithm to test if point is inside polygon
function isPointInPolygon(lat: number, lng: number, polygon: { latitude: number; longitude: number }[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const x = lng;
  const y = lat;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Bearing formula for rotated markers
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  const brng = Math.atan2(y, x) * (180 / Math.PI);
  return (brng + 360) % 360;
}

// Route interpolation between start and end
function interpolateRoute(start: Coordinate, end: Coordinate, steps = 30): Coordinate[] {
  const route: Coordinate[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Add minor curve so it looks like highway curves instead of direct line
    const jitterFactor = Math.sin(t * Math.PI) * 0.08; // Curve offset
    const lat = start.latitude + (end.latitude - start.latitude) * t + jitterFactor * 0.2;
    const lng = start.longitude + (end.longitude - start.longitude) * t - jitterFactor * 0.1;
    route.push({ latitude: lat, longitude: lng });
  }
  return route;
}

// Start simulation for a trip
function initSimulation(trip: Trip) {
  const origin = geofences.find(g => g.id === trip.originGeofenceId);
  const dest = geofences.find(g => g.id === trip.destinationGeofenceId);
  if (!origin || !dest) return;

  // Generate simulated coordinates
  const steps = 120;
  const points = interpolateRoute(
    { latitude: origin.latitude, longitude: origin.longitude },
    { latitude: dest.latitude, longitude: dest.longitude },
    steps
  );

  // Clear existing simulation for this trip
  simulatedTripPaths = simulatedTripPaths.filter(p => p.tripId !== trip.id);
  simulatedTripPaths.push({
    tripId: trip.id,
    points,
    currentIndex: 0
  });

  // Preserve vehicle's exact location without setting artificial retroactive coordinates
  const vehicle = vehicles.find(v => v.id === trip.vehicleId);
  if (vehicle && vehicle.status !== 'MAINTENANCE') {
    if (trip.transitStarted) {
      vehicle.status = 'EN_ROUTE';
    } else {
      vehicle.speed = 0;
    }
  }
}

// Server background tick simulation
function createFallbackCteInfo(trip: Trip, customVolume?: number, customFrete?: number): CteInfo {
  const vehicle = vehicles.find(v => v.id === trip.vehicleId);
  const driver = drivers.find(d => d.id === trip.driverId);
  const plate = vehicle?.licensePlate || 'WORK-1000';
  const driverName = driver?.name || vehicle?.driverName || 'Motorista Titular';
  const vol = customVolume !== undefined ? customVolume : (trip.loadedVolumeM3 || 45);
  const frete = customFrete !== undefined ? customFrete : 0;

  return {
    nCT: 'CTE-' + (trip.internalId || trip.id).replace(/\D/g, '').padStart(6, '0'),
    serie: '1',
    chCTe: '322607' + Date.now() + '1001',
    nProt: '132260' + Date.now(),
    dhEmi: new Date().toISOString(),
    cfop: '6353',
    emitente: { name: 'Work Transportes LTDA', cnpj: '12.345.678/0001-90', city: 'Serra', state: 'ES' },
    remetente: { name: 'Work Transportes', cnpj: '12.345.678/0001-90', city: 'Serra', state: 'ES' },
    destinatario: { name: 'Cliente Final', cnpj: '98.765.432/0001-10', city: 'Vitoria', state: 'ES' },
    vTPrest: frete,
    vRec: frete,
    vCarga: vol * 1500,
    proPred: trip.productName || 'Carga Geral',
    motoristaNome: driverName,
    placaVeiculo: plate,
    reboquePlacas: [],
    apoliceSeguro: 'AP-8849201',
    seguradora: 'Pampa Seguros',
    volume: vol,
    valorFrete: frete
  };
}

let vehicleGeofenceStates: Record<string, Record<string, 'INSIDE' | 'NEAR' | 'OUTSIDE'>> = {};

function evaluateGeofences() {
  const NEAR_THRESHOLD_METERS = 2000; // 2km radius to be considered "near"
  let changed = false;

  trips.forEach(trip => {
    if (trip.status === 'DELIVERED') return;

    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
    if (!vehicle) return;

    const origin = geofences.find(g => g.id === trip.originGeofenceId);
    const dest = geofences.find(g => g.id === trip.destinationGeofenceId);

    if (!origin || !dest) return;

    // Calculate current distances
    const distOrigin = haversineDistance(
      vehicle.currentLatitude, vehicle.currentLongitude,
      origin.latitude, origin.longitude
    );

    const distDest = haversineDistance(
      vehicle.currentLatitude, vehicle.currentLongitude,
      dest.latitude, dest.longitude
    );

    const isInsideOrigin = origin.shapeType === 'POLYGON' && origin.polygonCoordinates && origin.polygonCoordinates.length >= 3
      ? isPointInPolygon(vehicle.currentLatitude, vehicle.currentLongitude, origin.polygonCoordinates)
      : distOrigin <= origin.radius;

    const isInsideDest = dest.shapeType === 'POLYGON' && dest.polygonCoordinates && dest.polygonCoordinates.length >= 3
      ? isPointInPolygon(vehicle.currentLatitude, vehicle.currentLongitude, dest.polygonCoordinates)
      : distDest <= dest.radius;

    // Detect 8% route completion for empty transit automatically (only if SCHEDULED and not yet started transit)
    if (trip.status === 'SCHEDULED' && !trip.transitStarted && vehicle.status !== 'MAINTENANCE') {
      const currentDistanceKm = distOrigin / 1000;
      const initialDistance = trip.initialDistanceToOriginKm || currentDistanceKm;
      
      if (initialDistance > 0.2 && currentDistanceKm <= initialDistance * 0.92) {
        trip.transitStarted = true;
        if (demoMode) {
          vehicle.status = 'EN_ROUTE';
        }
        
        trip.events.push({
          id: 'e_auto_transit_' + Date.now(),
          timestamp: new Date().toISOString(),
          type: 'STATUS_CHANGE',
          description: `Identificação de Movimento: Veículo rodou mais de 8% da rota até a origem (Faltam ${currentDistanceKm.toFixed(2)} km). Iniciando Trânsito / Vazio automaticamente.`,
          latitude: vehicle.currentLatitude,
          longitude: vehicle.currentLongitude
        });
        changed = true;
      }
    }

    // 1. Check Entry to Origin -> WAITING_LOADING (No Carregamento)
    if (isInsideOrigin) {
      if (!trip.hasEnteredOrigin) {
        trip.hasEnteredOrigin = true;
        changed = true;
      }
      if (trip.status === 'SCHEDULED') {
        trip.status = 'WAITING_LOADING';
        if (['v1', 'v2', 'v3'].includes(vehicle.id)) {
          vehicle.speed = 0;
        }
        if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'AVAILABLE';
        
        trip.events.push({
          id: 'e_auto_loading_' + Date.now() + Math.floor(Math.random() * 1000),
          timestamp: new Date().toISOString(),
          type: 'STATUS_CHANGE',
          description: `Veículo ${vehicle.licensePlate} chegou na origem (${origin.name}) para CARREGAMENTO.`,
          latitude: vehicle.currentLatitude,
          longitude: vehicle.currentLongitude
        });
        changed = true;
      }
    }

    // 2. Check Exit from Origin (NO CARREGAMENTO) -> Avança para Em Trânsito (EN_ROUTE)
    const hasExitedOrigin = trip.hasEnteredOrigin === true && distOrigin > (origin.radius + 300);
    if (hasExitedOrigin && trip.status === 'WAITING_LOADING') {
      trip.hasExitedOrigin = true;
      trip.status = 'EN_ROUTE';
      if (!trip.startDate) {
        trip.startDate = new Date().toISOString();
      }
      if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'EN_ROUTE';

      trip.events.push({
        id: 'evt_exit_origin_transit_' + Date.now(),
        timestamp: new Date().toISOString(),
        type: 'GEOFENCE_EXIT',
        description: `Saída do Carregamento: Veículo ${vehicle.licensePlate} saiu da cerca eletrônica de carregamento (${origin.name}). Viagem em trânsito para o destino.`,
        latitude: vehicle.currentLatitude,
        longitude: vehicle.currentLongitude
      });
      changed = true;
    }

    // 3. Check Entry to Destination -> WAITING_UNLOADING (No Descarregamento)
    if (isInsideDest) {
      if (!trip.hasEnteredDest) {
        trip.hasEnteredDest = true;
        changed = true;
      }
      if (trip.status === 'EN_ROUTE' || trip.status === 'WAITING_LOADING' || trip.status === 'SCHEDULED') {
        trip.status = 'WAITING_UNLOADING';
        if (['v1', 'v2', 'v3'].includes(vehicle.id)) {
          vehicle.speed = 0;
        }
        if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'AVAILABLE';
        
        trip.events.push({
          id: 'e_auto_unloading_' + Date.now() + Math.floor(Math.random() * 1000),
          timestamp: new Date().toISOString(),
          type: 'STATUS_CHANGE',
          description: `Veículo ${vehicle.licensePlate} chegou ao destino (${dest.name}) para DESCARREGAMENTO.`,
          latitude: vehicle.currentLatitude,
          longitude: vehicle.currentLongitude
        });
        changed = true;
      }
    }

    // 4. Check Exit from Destination (Aguardando confirmação manual no status)
    const hasExitedDest = (trip.hasEnteredDest === true || isInsideDest) && distDest > (dest.radius + 300);
    if (hasExitedDest && trip.status === 'WAITING_UNLOADING') {
      if (!trip.hasExitedDest) {
        trip.hasExitedDest = true;
        trip.events.push({
          id: 'evt_exit_dest_' + Date.now(),
          timestamp: new Date().toISOString(),
          type: 'GEOFENCE_EXIT',
          description: `Saída do Destino: O veículo ${vehicle.licensePlate} saiu da cerca eletrônica de destino (${dest.name}). Aguardando confirmação de descarregamento no quadro de viagens.`,
          latitude: vehicle.currentLatitude,
          longitude: vehicle.currentLongitude
        });
        changed = true;
      }
    }

    // Update enter/exit/near states tracking for notifications
    if (!vehicleGeofenceStates[vehicle.id]) {
      vehicleGeofenceStates[vehicle.id] = {};
    }
    const state = vehicleGeofenceStates[vehicle.id];

    [origin, dest].forEach(gf => {
      const dist = gf.id === origin.id ? distOrigin : distDest;
      const wasInside = state[gf.id] === 'INSIDE';
      const wasNear = state[gf.id] === 'NEAR';

      const isInside = gf.shapeType === 'POLYGON' && gf.polygonCoordinates && gf.polygonCoordinates.length >= 3
        ? isPointInPolygon(vehicle.currentLatitude, vehicle.currentLongitude, gf.polygonCoordinates)
        : dist <= gf.radius;

      let currentState: 'INSIDE' | 'NEAR' | 'OUTSIDE' = 'OUTSIDE';
      if (isInside) {
        currentState = 'INSIDE';
      } else if (dist <= gf.radius + NEAR_THRESHOLD_METERS) {
        currentState = 'NEAR';
      }

      if (currentState === 'NEAR' && !wasNear && !wasInside) {
        trip.events.push({
          id: 'evt_geofence_near_' + Date.now() + Math.floor(Math.random() * 1000),
          timestamp: new Date().toISOString(),
          type: 'GEOFENCE_NEAR',
          description: `Alerta de Proximidade: Veículo ${vehicle.licensePlate} está a menos de 2km da geocerca: ${gf.name} (Distância exata: ${Math.round(dist)}m).`,
          latitude: vehicle.currentLatitude,
          longitude: vehicle.currentLongitude
        });
        changed = true;
      }

      state[gf.id] = currentState;
    });
  });

  if (changed) {
    saveDatabaseToDisk(true);
    broadcastTrips();
    broadcastVehicles();
  }
}

setInterval(() => {
  if (!demoMode) return; // Skip simulated movements when in Real Production Mode
  
  // Let's loop through active trips and update them
  trips.forEach(trip => {
    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
    const driver = drivers.find(d => d.id === trip.driverId);
    const origin = geofences.find(g => g.id === trip.originGeofenceId);
    const dest = geofences.find(g => g.id === trip.destinationGeofenceId);

    if (!vehicle || !origin || !dest) return;

    // Never modify coordinates for real vehicles - preserve exact real-time telemetry location
    if (vehicle.id.startsWith('real_') || !['v1', 'v2', 'v3'].includes(vehicle.id)) return;

    if (trip.status === 'SCHEDULED') {
      // Check if this vehicle is currently busy in an active prior trip
      const busy = trips.some(t => {
        if (t.id === trip.id) return false;
        if (t.vehicleId !== trip.vehicleId) return false;
        if (t.status === 'DELIVERED') return false;
        if (t.status !== 'SCHEDULED') return true;
        
        const thisTime = new Date(trip.scheduledLoadingDate || trip.scheduledDate || 0).getTime();
        const otherTime = new Date(t.scheduledLoadingDate || t.scheduledDate || 0).getTime();
        if (otherTime < thisTime) return true;
        if (otherTime === thisTime) {
          const thisNum = parseInt(trip.tripNumber?.replace(/\D/g, '') || '0');
          const otherNum = parseInt(t.tripNumber?.replace(/\D/g, '') || '0');
          return otherNum < thisNum;
        }
        return false;
      });

      if (busy) {
        // Vehicle is busy on a prior active trip. Delayempty transit simulation.
        return;
      }

      if (!trip.transitStarted) {
        // Vehicle is scheduled but transit hasn't started yet. Keep speed 0.
        vehicle.speed = 0;
        return;
      }

      // Vehicle moves towards Origin geofence
      const distToOrigin = haversineDistance(
        vehicle.currentLatitude, vehicle.currentLongitude,
        origin.latitude, origin.longitude
      );

      if (distToOrigin > origin.radius) {
        // Slowly glide towards origin
        if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'EN_ROUTE';
        vehicle.speed = 60;
        const speedFactor = 0.0006; // glide rate per second
        const diffLat = origin.latitude - vehicle.currentLatitude;
        const diffLng = origin.longitude - vehicle.currentLongitude;
        vehicle.direction = calculateBearing(
          vehicle.currentLatitude, vehicle.currentLongitude,
          origin.latitude, origin.longitude
        );
        vehicle.currentLatitude += diffLat * speedFactor;
        vehicle.currentLongitude += diffLng * speedFactor;
        vehicle.telemetryTime = new Date().toISOString();
        vehicle.manualLocation = getCityStateFromCoordinates(vehicle.currentLatitude, vehicle.currentLongitude);
      } else {
        // Enters origin geofence! Transition to WAITING_LOADING
        trip.status = 'WAITING_LOADING';
        vehicle.speed = 0;
        if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'AVAILABLE';
        trip.events.push({
          id: 'e_enter_orig_' + Date.now(),
          timestamp: new Date().toISOString(),
          type: 'GEOFENCE_ENTER',
          description: `Veículo ${vehicle.licensePlate} chegou na origem (${origin.name}) para CARREGAMENTO.`,
          latitude: vehicle.currentLatitude,
          longitude: vehicle.currentLongitude
        });
      }
    }

    else if (trip.status === 'WAITING_LOADING') {
      // Stay parked at Origin indefinitely until CT-e is filled out
      vehicle.speed = 0;
      vehicle.currentLatitude = origin.latitude;
      vehicle.currentLongitude = origin.longitude;
      vehicle.manualLocation = getCityStateFromCoordinates(origin.latitude, origin.longitude);

      if (trip.cteInfo) {
        trip.status = 'EN_ROUTE';
        trip.startDate = new Date().toISOString();
        if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'EN_ROUTE';
        vehicle.speed = 80;
        
        trip.events.push({
          id: 'e_route_start_cte_' + Date.now(),
          timestamp: new Date().toISOString(),
          type: 'STATUS_CHANGE',
          description: `Liberação do Carregamento: CT-e emitido. Veículo ${vehicle.licensePlate} liberado para trânsito até o destino.`,
          latitude: vehicle.currentLatitude,
          longitude: vehicle.currentLongitude
        });
        delete waitingLoadingTicks[trip.id];
        broadcastTrips();
        broadcastVehicles();
      }
    }

    else if (trip.status === 'EN_ROUTE') {
      // Moves from Origin to Dest
      let pathSim = simulatedTripPaths.find(p => p.tripId === trip.id);
      if (!pathSim) {
        // If path does not exist, recreate it
        initSimulation(trip);
        pathSim = simulatedTripPaths.find(p => p.tripId === trip.id);
      }

      if (pathSim) {
        if (pathSim.currentIndex < pathSim.points.length - 1) {
          pathSim.currentIndex += 1;
          const nextPt = pathSim.points[pathSim.currentIndex];
          const prevPt = pathSim.points[pathSim.currentIndex - 1];

          if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'EN_ROUTE';
          vehicle.speed = 80 + Math.floor(Math.random() * 10); // Random cruising speed
          vehicle.direction = calculateBearing(prevPt.latitude, prevPt.longitude, nextPt.latitude, nextPt.longitude);
          vehicle.currentLatitude = nextPt.latitude;
          vehicle.currentLongitude = nextPt.longitude;
          vehicle.telemetryTime = new Date().toISOString();
          vehicle.manualLocation = getCityStateFromCoordinates(nextPt.latitude, nextPt.longitude);

          // Save point to historical route
          trip.routeHistory.push({ latitude: nextPt.latitude, longitude: nextPt.longitude });
        } else {
          // Reached destination!
          trip.status = 'WAITING_UNLOADING';
          vehicle.speed = 0;
          if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'AVAILABLE';
          vehicle.currentLatitude = dest.latitude;
          vehicle.currentLongitude = dest.longitude;
          vehicle.manualLocation = getCityStateFromCoordinates(dest.latitude, dest.longitude);
          trip.events.push({
            id: 'e_enter_dest_' + Date.now(),
            timestamp: new Date().toISOString(),
            type: 'GEOFENCE_ENTER',
            description: `Veículo ${vehicle.licensePlate} chegou ao destino (${dest.name}) para DESCARREGAMENTO.`,
            latitude: vehicle.currentLatitude,
            longitude: vehicle.currentLongitude
          });
        }
      }
    }

    else if (trip.status === 'WAITING_UNLOADING') {
      // Simulamos a saída física do veículo da geocerca de destino após algum tempo
      if (Math.random() < 0.05) {
        const offsetInDegrees = (dest.radius + 300) / 111320; // Fora do raio da geocerca
        vehicle.currentLatitude = dest.latitude + offsetInDegrees * 1.15;
        vehicle.currentLongitude = dest.longitude + offsetInDegrees * 1.15;
        vehicle.speed = 35; // Veículo se deslocando para fora
        vehicle.telemetryTime = new Date().toISOString();
        vehicle.manualLocation = getCityStateFromCoordinates(vehicle.currentLatitude, vehicle.currentLongitude);
        
        // No mesmo ciclo, evaluateGeofences() detectará a saída (GEOFENCE_EXIT)
        // e mudará automaticamente o status da viagem para DELIVERED (Concluída).
      }
    }
  });

  // Broadcast updated states to all connected SSE clients (using false to indicate background/non-immediate save)
  evaluateGeofences();
  broadcastVehicles(false);
  broadcastTrips(false);
  broadcastDrivers(false);
}, 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Load last known cached database state from local disk to guarantee immediate data presence
  loadDatabaseFromDisk();

  // Initialize Firebase Client SDK sequentially after disk cache is read
  initializeFirebase();

  // Load from Firestore synchronously (awaited) to ensure durable, cross-device persistence before accepting requests
  try {
    console.log('[Firebase] Realizando carregamento inicial crítico do Firestore...');
    await loadDatabaseFromFirestore();
    console.log('[Firebase] Carregamento inicial do Firestore concluído.');
  } catch (err) {
    console.error('[Firebase] Erro na sincronização pré-boot do Firestore:', err);
  }

  // Start background Sascar real-time synchronization
  startSascarSync();

  // API Endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/map-proxy', async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL é obrigatória.' });
      }
      
      // Security check: must start with Google Static Map, Yandex Static Map URL, OpenStreetMap Tiles, or CartoDB tiles
      if (!url.startsWith('https://maps.googleapis.com/') && 
          !url.startsWith('https://static-maps.yandex.ru/') && 
          !url.startsWith('https://tile.openstreetmap.org/') &&
          !url.startsWith('https://basemaps.cartocdn.com/') &&
          !url.startsWith('https://a.basemaps.cartocdn.com/') &&
          !url.startsWith('https://b.basemaps.cartocdn.com/') &&
          !url.startsWith('https://c.basemaps.cartocdn.com/') &&
          !url.startsWith('https://d.basemaps.cartocdn.com/')) {
        return res.status(403).json({ error: 'Domínio não permitido.' });
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TransControl-Rotogram-Generator/1.0 (coyotecaj@gmail.com)'
        }
      });
      if (!response.ok) {
        throw new Error(`API de mapa respondeu com status ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/png';
      
      res.json({ dataUrl: `data:${contentType};base64,${base64}` });
    } catch (err: any) {
      console.error('Erro no proxy de mapa:', err);
      res.status(500).json({ error: err.message || 'Erro ao obter imagem do mapa.' });
    }
  });

  app.get('/api/geocode', async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Parâmetro q é obrigatório.' });
      }

      const query = q.trim();
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Brazil')}&format=json&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TransControl-Rotogram-Generator/1.0 (coyotecaj@gmail.com)'
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim returned status ${response.status}`);
      }

      const data = await response.json();
      if (data && data.length > 0) {
        const item = data[0];
        return res.json({
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          display_name: item.display_name
        });
      }

      res.status(404).json({ error: 'Localização não encontrada.' });
    } catch (err: any) {
      console.error('Erro na geocodificação offline/OSM:', err);
      res.status(500).json({ error: err.message || 'Erro ao processar geocodificação.' });
    }
  });

  app.post('/api/announce', (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem inválida.' });
    }
    broadcastSSE('announcement', {
      id: 'ann_' + Date.now() + Math.random().toString(36).substr(2, 5),
      message,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true });
  });

  // Server-Sent Events stream for high-performance, real-time updates
  app.get('/api/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('\n'); // establish initial keep-alive comment/new-line

    // Send current baseline state immediately to client
    const realVehicles = demoMode 
      ? vehicles 
      : vehicles.filter(v => v.id.startsWith('real_') || !['v1', 'v2', 'v3'].includes(v.id));
    
    const realDrivers = demoMode
      ? drivers
      : drivers.filter(d => d.id.startsWith('real_') || !['d1', 'd2', 'd3'].includes(d.id));

    const realTrips = demoMode
      ? trips
      : trips.filter(t => t.id !== 't1');

    res.write(`event: vehicles\ndata: ${JSON.stringify(realVehicles)}\n\n`);
    res.write(`event: drivers\ndata: ${JSON.stringify(realDrivers)}\n\n`);
    res.write(`event: geofences\ndata: ${JSON.stringify(geofences)}\n\n`);
    res.write(`event: products\ndata: ${JSON.stringify(products)}\n\n`);
    res.write(`event: contracts\ndata: ${JSON.stringify(contracts)}\n\n`);
    res.write(`event: trips\ndata: ${JSON.stringify(realTrips)}\n\n`);
    res.write(`event: settings\ndata: ${JSON.stringify({
      demoMode,
      sascarUser,
      sascarPass: sascarPass ? '••••••••' : '',
      lastSyncError,
      lastSyncTime
    })}\n\n`);

    sseClients.push(res);

    // Keep connection alive with periodic keep-alive comments
    const keepAliveInterval = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAliveInterval);
      sseClients = sseClients.filter(client => client !== res);
    });
  });

  // Get vehicles
  app.get('/api/vehicles', async (req, res) => {
    if (!demoMode) {
      const now = new Date().getTime();
      const lastSync = lastSyncTime ? new Date(lastSyncTime).getTime() : 0;
      // Trigger an immediate sync in background if the data is older than 5 seconds
      if (now - lastSync > 5000) {
        runPositionSync().catch(console.error);
      }
      const realVehicles = vehicles.filter(v => {
        if (v.id.startsWith('real_')) return true;
        return !['v1', 'v2', 'v3'].includes(v.id);
      });
      return res.json(realVehicles);
    }
    res.json(vehicles);
  });

  // Block or unblock vehicle
  app.post('/api/vehicles/:id/block', (req, res) => {
    const { id } = req.params;
    const { block } = req.body;
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return res.status(404).json({ error: 'Veículo não encontrado.' });
    
    vehicle.status = block ? 'BLOCKED' : 'AVAILABLE';
    vehicle.speed = 0;
    vehicle.telemetryTime = new Date().toISOString();
    saveDatabaseToDisk(true);
    broadcastVehicles();
    res.json(vehicle);
  });

  // Toggle map visibility
  app.patch('/api/vehicles/:id/visibility', (req, res) => {
    const { id } = req.params;
    const { visibleOnMap } = req.body;
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return res.status(404).json({ error: 'Veículo não encontrado.' });
    
    vehicle.visibleOnMap = visibleOnMap;
    saveDatabaseToDisk(true);
    broadcastVehicles();
    res.json(vehicle);
  });

  // Update driver name manually
  app.patch('/api/vehicles/:id/driverName', (req, res) => {
    const { id } = req.params;
    const { driverName } = req.body;
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return res.status(404).json({ error: 'Veículo não encontrado.' });
    
    vehicle.driverName = driverName;
    
    // Save to manual driver name mapping
    manualDriverNamesMap.set(vehicle.id, driverName);
    manualDriverNamesMap.set(vehicle.licensePlate.toUpperCase().trim(), driverName);
    
    saveDatabaseToDisk(true);
    broadcastVehicles();
    res.json(vehicle);
  });

  // Update manual location
  app.patch('/api/vehicles/:id/manual-location', async (req, res) => {
    const { id } = req.params;
    const { manualLocation } = req.body;
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return res.status(404).json({ error: 'Veículo não encontrado.' });
    
    if (!manualLocation || manualLocation.trim() === '') {
      vehicle.manualLocation = null;
      vehicle.manualLocationUpdatedAt = null;
    } else {
      const resolved = await resolveLocationToCoordinates(manualLocation);
      if (resolved) {
        vehicle.currentLatitude = resolved.lat;
        vehicle.currentLongitude = resolved.lng;
        vehicle.telemetryTime = new Date().toISOString();
        vehicle.manualLocation = resolved.address;
        vehicle.manualLocationUpdatedAt = new Date().toISOString();
      } else {
        // Fallback: If AI or parser fails, just keep the last coords but store the text
        vehicle.manualLocation = manualLocation;
        vehicle.manualLocationUpdatedAt = new Date().toISOString();
      }
    }
    
    // Save state
    try {
      saveDatabaseToDisk(true);
    } catch (diskErr) {
      console.error('[Disk save error]:', diskErr);
    }

    // Run geofence evaluation instantly to update trip/vehicle statuses
    evaluateGeofences();

    broadcastVehicles();
    res.json(vehicle);
  });

  // Create vehicle
  app.post('/api/vehicles', (req, res) => {
    const { licensePlate, model } = req.body;
    if (!licensePlate || !model) {
      return res.status(400).json({ error: 'Placa e Modelo são obrigatórios.' });
    }
    const newVehicle: Vehicle = {
      id: 'v_' + Date.now(),
      licensePlate,
      model,
      currentLatitude: -23.5505 + (Math.random() - 0.5) * 2.0, // Near SP
      currentLongitude: -46.6333 + (Math.random() - 0.5) * 2.0,
      direction: Math.floor(Math.random() * 360),
      speed: 0,
      status: 'AVAILABLE',
      driverId: null,
      driverName: null,
      telemetryTime: new Date().toISOString()
    };
    vehicles.push(newVehicle);
    saveDatabaseToDisk(true);
    broadcastVehicles();
    res.status(201).json(newVehicle);
  });

  // Edit vehicle
  app.put('/api/vehicles/:id', (req, res) => {
    const { id } = req.params;
    const { licensePlate, model } = req.body;
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return res.status(404).json({ error: 'Veículo não encontrado.' });
    if (!licensePlate || !model) {
      return res.status(400).json({ error: 'Placa e Modelo são obrigatórios.' });
    }
    vehicle.licensePlate = licensePlate;
    vehicle.model = model;
    saveDatabaseToDisk(true);
    broadcastVehicles();
    res.json(vehicle);
  });

  // Delete vehicle
  app.delete('/api/vehicles/:id', (req, res) => {
    const { id } = req.params;
    vehicles = vehicles.filter(v => v.id !== id);
    saveDatabaseToDisk(true);
    broadcastVehicles();
    res.json({ success: true });
  });

  // Update vehicle maintenance status
  app.post('/api/vehicles/:id/maintenance', (req, res) => {
    const { id } = req.params;
    const { inMaintenance, maintenanceReason, maintenanceExpectedDate } = req.body;
    let vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) {
      vehicle = vehicles.find(v => v.licensePlate.toUpperCase().trim() === id.toUpperCase().trim());
    }
    if (!vehicle) return res.status(404).json({ error: 'Veículo não encontrado.' });

    if (inMaintenance) {
      vehicle.status = 'MAINTENANCE';
      vehicle.maintenanceReason = maintenanceReason || null;
      vehicle.maintenanceExpectedDate = maintenanceExpectedDate || null;
      vehicle.maintenanceStartDate = new Date().toISOString();
      vehicle.speed = 0; // speed is 0 when parked for maintenance

      // Store in MaintenanceRecords history
      maintenanceRecords.push({
        id: 'm_' + Date.now(),
        vehicleId: vehicle.id,
        date: vehicle.maintenanceStartDate,
        description: maintenanceReason || 'Manutenção registrada sem motivo especificado',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
      });
    } else {
      const activeTrip = trips.find(t => t.vehicleId === vehicle!.id && t.status !== 'DELIVERED');
      if (activeTrip && activeTrip.status === 'EN_ROUTE') {
        vehicle.status = 'EN_ROUTE';
      } else {
        vehicle.status = 'AVAILABLE';
      }
      vehicle.maintenanceReason = null;
      vehicle.maintenanceExpectedDate = null;
      vehicle.maintenanceStartDate = null;

      // Close all active maintenance records for this vehicle
      maintenanceRecords.forEach(r => {
        if ((r.vehicleId === vehicle!.id || r.vehicleId === vehicle!.licensePlate) && r.status === 'IN_PROGRESS') {
          r.status = 'COMPLETED';
          r.releaseDate = new Date().toISOString();
        }
      });
    }

    saveDatabaseToDisk(true); // Always persist updated state to disk & Firestore
    broadcastVehicles();
    res.json(vehicle);
  });

  // Get maintenance records history
  app.get('/api/maintenance', (req, res) => {
    res.json(maintenanceRecords);
  });

  // Get drivers
  app.get('/api/drivers', (req, res) => {
    if (!demoMode) {
      const realDrivers = drivers.filter(d => d.id.startsWith('real_') || !['d1', 'd2', 'd3'].includes(d.id));
      return res.json(realDrivers);
    }
    res.json(drivers);
  });

  // Create driver
  app.post('/api/drivers', (req, res) => {
    const { name, cpf, phone, licenseNumber } = req.body;
    if (!name || !cpf) {
      return res.status(400).json({ error: 'Nome e CPF são obrigatórios.' });
    }
    const newDriver: Driver = {
      id: 'd_' + Date.now(),
      name,
      cpf,
      phone: phone || '',
      status: 'AVAILABLE',
      licenseNumber: licenseNumber || 'CNH-D'
    };
    drivers.push(newDriver);
    saveDatabaseToDisk(true);
    broadcastDrivers();
    res.status(201).json(newDriver);
  });

  // Edit driver
  app.put('/api/drivers/:id', (req, res) => {
    const { id } = req.params;
    const { name, cpf, phone, licenseNumber, status } = req.body;
    const driver = drivers.find(d => d.id === id);
    if (!driver) return res.status(404).json({ error: 'Motorista não encontrado.' });

    if (name) {
      const oldName = driver.name;
      driver.name = name;
      // Update driver name in vehicles linked to this driver
      vehicles.forEach(v => {
        if (v.driverId === id || v.driverName === oldName) {
          v.driverName = name;
        }
      });
      // Update driver name in active trips cteInfo if applicable
      trips.forEach(t => {
        if (t.driverId === id && t.cteInfo) {
          t.cteInfo.motoristaNome = name;
        }
      });
    }
    if (cpf !== undefined) driver.cpf = cpf;
    if (phone !== undefined) driver.phone = phone;
    if (licenseNumber !== undefined) driver.licenseNumber = licenseNumber;
    if (status !== undefined) driver.status = status;

    saveDatabaseToDisk(true);
    broadcastDrivers();
    broadcastVehicles();
    broadcastTrips();
    res.json(driver);
  });

  // Get geofences
  app.get('/api/geofences', (req, res) => {
    res.json(geofences);
  });

  // Create geofence
  app.post('/api/geofences', (req, res) => {
    const { name, latitude, longitude, radius, type, icon, shapeType, polygonCoordinates } = req.body;
    if (!name || latitude === undefined || longitude === undefined || radius === undefined || !type) {
      return res.status(400).json({ error: 'Todos os campos de Geocerca são obrigatórios.' });
    }
    const newGeofence: Geofence = {
      id: 'g_' + Date.now(),
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius: parseInt(radius),
      type,
      icon,
      shapeType: shapeType || 'CIRCLE',
      polygonCoordinates: Array.isArray(polygonCoordinates) ? polygonCoordinates : undefined
    };
    geofences.push(newGeofence);
    saveDatabaseToDisk(true);
    broadcastGeofences();
    res.status(201).json(newGeofence);
  });

  // Update geofence
  app.put('/api/geofences/:id', (req, res) => {
    const { id } = req.params;
    const { name, latitude, longitude, radius, type, icon, shapeType, polygonCoordinates } = req.body;
    const geofence = geofences.find(g => g.id === id);
    if (!geofence) return res.status(404).json({ error: 'Geocerca não encontrada.' });
    
    if (name !== undefined) geofence.name = name;
    if (latitude !== undefined) geofence.latitude = parseFloat(latitude);
    if (longitude !== undefined) geofence.longitude = parseFloat(longitude);
    if (radius !== undefined) geofence.radius = parseInt(radius);
    if (type !== undefined) geofence.type = type;
    if (icon !== undefined) geofence.icon = icon;
    if (shapeType !== undefined) geofence.shapeType = shapeType;
    if (polygonCoordinates !== undefined) geofence.polygonCoordinates = polygonCoordinates;

    saveDatabaseToDisk(true);
    broadcastGeofences();
    res.json(geofence);
  });

  // Delete geofence
  app.delete('/api/geofences/:id', (req, res) => {
    const { id } = req.params;
    geofences = geofences.filter(g => g.id !== id);
    saveDatabaseToDisk(true);
    broadcastGeofences();
    res.json({ success: true });
  });

  // Get products
  app.get('/api/products', (req, res) => {
    res.json(products);
  });

  // Create product
  app.post('/api/products', (req, res) => {
    const { name, code, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'O nome do produto é obrigatório.' });
    }
    const newProduct: Product = {
      id: 'p_' + Date.now(),
      name,
      code: code || ('PROD-' + (100 + products.length)),
      description: description || ''
    };
    products.push(newProduct);
    saveDatabaseToDisk(true);
    broadcastProducts();
    res.status(201).json(newProduct);
  });

  // Update product
  app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { name, code, description } = req.body;
    const product = products.find(p => p.id === id);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    if (name) product.name = name;
    if (code !== undefined) product.code = code;
    if (description !== undefined) product.description = description;

    // Update product names in active trips
    trips.forEach(t => {
      if (t.productId === id) {
        t.productName = product.name;
      }
    });

    saveDatabaseToDisk(true);
    broadcastProducts();
    broadcastTrips();
    res.json(product);
  });

  // Delete product
  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    products = products.filter(p => p.id !== id);
    saveDatabaseToDisk(true);
    broadcastProducts();
    res.json({ success: true });
  });

  // Get contracts
  app.get('/api/contracts', (req, res) => {
    res.json(contracts);
  });

  // Create contract
  app.post('/api/contracts', (req, res) => {
    const { clientName, cnpj, volumeM3, startDate, endDate, status } = req.body;
    if (!clientName || !cnpj || volumeM3 === undefined || !startDate || !endDate) {
      return res.status(400).json({ error: 'Nome do cliente, CNPJ, volume, data de início e data de término são obrigatórios.' });
    }
    const newContract: Contract = {
      id: 'c_' + Date.now(),
      clientName,
      cnpj,
      volumeM3: Number(volumeM3),
      startDate,
      endDate,
      status: status || 'ACTIVE'
    };
    contracts.push(newContract);
    saveDatabaseToDisk(true);
    broadcastContracts();
    res.status(201).json(newContract);
  });

  // Update contract
  app.put('/api/contracts/:id', (req, res) => {
    const { id } = req.params;
    const { clientName, cnpj, volumeM3, startDate, endDate, status } = req.body;
    const contract = contracts.find(c => c.id === id);
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado.' });
    
    if (clientName) contract.clientName = clientName;
    if (cnpj) contract.cnpj = cnpj;
    if (volumeM3 !== undefined) contract.volumeM3 = Number(volumeM3);
    if (startDate) contract.startDate = startDate;
    if (endDate) contract.endDate = endDate;
    if (status) contract.status = status;

    saveDatabaseToDisk(true);
    broadcastContracts();
    res.json(contract);
  });

  // Delete contract
  app.delete('/api/contracts/:id', (req, res) => {
    const { id } = req.params;
    contracts = contracts.filter(c => c.id !== id);
    saveDatabaseToDisk(true);
    broadcastContracts();
    res.json({ success: true });
  });

  // Get rotogramas
  app.get('/api/rotogramas', (req, res) => {
    res.json(rotograms);
  });

  // Save manual/generated rotograma
  app.post('/api/rotogramas', (req, res) => {
    const rotograma = req.body;
    if (!rotograma.origem || !rotograma.destino) {
      return res.status(400).json({ error: 'Origem e destino são obrigatórios.' });
    }
    
    // Check if it already exists to overwrite, or create a new one
    const id = rotograma.id || 'r_' + Date.now();
    const existingIndex = rotograms.findIndex(r => r.id === id);
    
    const newRotograma = {
      ...rotograma,
      id,
      criado_em: rotograma.criado_em || new Date().toISOString()
    };
    
    if (existingIndex > -1) {
      rotograms[existingIndex] = newRotograma;
    } else {
      rotograms.push(newRotograma);
    }
    
    saveDatabaseToDisk(true);
    res.status(201).json(newRotograma);
  });

  // Delete rotograma
  app.delete('/api/rotogramas/:id', (req, res) => {
    const { id } = req.params;
    rotograms = rotograms.filter(r => r.id !== id);
    saveDatabaseToDisk(true);
    res.json({ success: true });
  });

  // Generate rotograma with Gemini
  app.post('/api/rotogramas/generate', async (req, res) => {
    try {
      const {
        origem,
        destino,
        tipoVeiculo,
        tipoCarga,
        dataSaida,
        pesoCarga,
        taraVeiculo,
        configuracaoEixos,
        rodagemEixos,
        restricoes,
        historicoRiscos
      } = req.body;

      if (!origem || !destino) {
        return res.status(400).json({ error: 'Origem e destino são obrigatórios.' });
      }

      const client = getGeminiClient();

      const userPrompt = `
Você é um especialista em gestão de risco e segurança viária para transporte de cargas terrestres de uma transportadora brasileira.
Gere um rotograma de segurança viária operacional detalhado e calculo de eixos com base nas seguintes informações de entrada:

- Origem: "${origem}"
- Destino: "${destino}"
- Tipo de Veículo: "${tipoVeiculo || 'Não especificado (assuma veículo típico)'}"
- Tipo de Carga: "${tipoCarga || 'Carga Seca Geral'}"
- Data/Horário Previsto de Saída: "${dataSaida || 'Imediato'}"
- Peso da Carga: ${pesoCarga ? pesoCarga + ' kg' : 'Não informado (assuma peso típico para o tipo de veículo)'}
- Tara do Veículo: ${taraVeiculo ? taraVeiculo + ' kg' : 'Não informado (assuma tara típica)'}
- Configuração de Eixos do Veículo: "${configuracaoEixos || 'Não informado (assuma típico)'}"
- Tipo de Rodagem/Suspensão: "${rodagemEixos || 'Mecânica com rodagem dupla padrão'}"
- Outras Restrições do Veículo: "${restricoes || 'Nenhuma'}"
- Histórico de Riscos ou Notas: "${historicoRiscos || 'Nenhum'}"

INSTRUÇÕES DO ROTOGRAMA:
- Um rotograma visa à segurança, prevenção de acidentes e proteção.
- Identifique de 5 a 10 pontos críticos sequenciais e reais ao longo da rota entre a origem e destino (por exemplo, km ou localizações de referência de rodovias federais como BR-116, BR-381, BR-101, BR-050 etc., adequados para o trajeto informado).
- Cada ponto DEVE ser categorizado em uma de cinco opções: "risco", "apoio", "infraestrutura", "sinal", ou "roubo".
- Ordene sempre os pontos por sequência do trajeto.
- Seja específico, acionável e defensivo (ex: "Reduzir velocidade para 40km/h 300m antes", "Zerar sinal e reportar na entrada").

REGRAS DA LEI DA BALANÇA (CÁLCULO DE EIXOS):
- Calcule o Peso Bruto Total (PBT) estimado (tara + peso da carga).
- Estime a distribuição do peso nos eixos/conjunto de eixos com base na configuração selecionada.
- Verifique se a distribuição ultrapassa os limites legais:
  * Eixo isolado simples (rodagem simples, ex: direcional): até 6.000 kg (6 t)
  * Eixo isolado com rodagem dupla: até 10.000 kg (10 t)
  * Conjunto tandem duplo (rodagem dupla): até 17.000 kg (17 t)
  * Conjunto tandem triplo (rodagem dupla): até 25.500 kg (25.5 t)
  (Considere tolerâncias brasileiras: 5% no PBT, 12,5% por eixo/conjunto para multas).
- Determine se os eixos estão sobrecarregados, indicando o excesso se houver.
- Forneça uma recomendação clara se ultrapassar (ex: "necessário conjunto tandem triplo adicional" ou "reduzir carga em X kg").
- Informe o número total de eixos tarifáveis para o pedágio.
- Identifique se alguma ponte na rota tem restrição de peso inferior ao PBT calculado.

O retorno deve conter:
1. "resumo_motorista": Texto corrido e muito claro, direto e curto para leitura rápida do motorista antes de sair, listando os pontos mais importantes, limites de velocidade recomendados e recomendações gerais de segurança.
2. Todo o objeto JSON estruturado solicitado.
`;

      const rotogramaSchema = {
        type: Type.OBJECT,
        properties: {
          origem: { type: Type.STRING },
          destino: { type: Type.STRING },
          distancia_km: { type: Type.NUMBER },
          tempo_estimado_horas: { type: Type.NUMBER },
          nivel_risco_geral: { type: Type.STRING },
          resumo: { type: Type.STRING },
          pontos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ordem: { type: Type.INTEGER },
                categoria: { type: Type.STRING },
                localizacao: { type: Type.STRING },
                km_aproximado: { type: Type.NUMBER, nullable: true },
                descricao: { type: Type.STRING },
                velocidade_maxima_recomendada: { type: Type.NUMBER, nullable: true },
                instrucao: { type: Type.STRING },
                raio_alerta_metros: { type: Type.INTEGER }
              },
              required: ["ordem", "categoria", "localizacao", "descricao", "instrucao"]
            }
          },
          contatos_emergencia: {
            type: Type.OBJECT,
            properties: {
              gerenciadora_risco: { type: Type.STRING },
              transportadora: { type: Type.STRING },
              prf: { type: Type.STRING },
              resgate: { type: Type.STRING },
              guincho: { type: Type.STRING }
            },
            required: ["gerenciadora_risco", "transportadora", "prf", "resgate", "guincho"]
          },
          calculo_eixos: {
            type: Type.OBJECT,
            properties: {
              configuracao_veiculo: { type: Type.STRING },
              tara_kg: { type: Type.NUMBER, nullable: true },
              peso_carga_kg: { type: Type.NUMBER, nullable: true },
              peso_bruto_total_kg: { type: Type.NUMBER, nullable: true },
              eixos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    identificacao: { type: Type.STRING },
                    tipo: { type: Type.STRING },
                    peso_estimado_kg: { type: Type.NUMBER, nullable: true },
                    limite_legal_kg: { type: Type.NUMBER, nullable: true },
                    status: { type: Type.STRING }
                  },
                  required: ["identificacao", "tipo", "status"]
                }
              },
              excesso_total_kg: { type: Type.NUMBER },
              configuracao_minima_sugerida: { type: Type.STRING },
              necessita_aet: { type: Type.BOOLEAN },
              eixos_tarifaveis_pedagio: { type: Type.INTEGER, nullable: true },
              alerta: { type: Type.STRING }
            },
            required: ["configuracao_veiculo", "tara_kg", "peso_carga_kg", "peso_bruto_total_kg", "eixos", "excesso_total_kg", "configuracao_minima_sugerida", "necessita_aet"]
          },
          resumo_motorista: { type: Type.STRING }
        },
        required: [
          "origem", "destino", "distancia_km", "tempo_estimado_horas", "nivel_risco_geral",
          "resumo", "pontos", "contatos_emergencia", "calculo_eixos", "resumo_motorista"
        ]
      };

      const response = await client.models.generateContent({
        model: "gemini-3.6-flash",
        contents: userPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: rotogramaSchema,
          temperature: 0.2
        }
      });

      const parsedResponse = JSON.parse(response.text || '{}');
      res.json(parsedResponse);
    } catch (error: any) {
      console.warn('[Gemini Rotograma Generator] Fallback Triggered due to API issue:', error.message || error);
      
      try {
        const {
          origem,
          destino,
          tipoVeiculo = 'carreta_3eixos',
          tipoCarga = 'carga_seca',
          dataSaida,
          pesoCarga,
          taraVeiculo,
          configuracaoEixos,
          rodagemEixos,
          restricoes,
          historicoRiscos
        } = req.body;

        let pCarga = pesoCarga ? Number(pesoCarga) : 0;
        let tVeh = taraVeiculo ? Number(taraVeiculo) : 0;

        if (pCarga <= 0) {
          if (tipoVeiculo === 'van_carga') pCarga = 1500;
          else if (tipoVeiculo === 'truck_3eixos') pCarga = 13000;
          else if (tipoVeiculo === 'carreta_3eixos') pCarga = 25000;
          else if (tipoVeiculo === 'bitrem_7eixos') pCarga = 37000;
          else if (tipoVeiculo === 'bitrem_9eixos') pCarga = 50000;
          else pCarga = 20000;
        }

        if (tVeh <= 0) {
          if (tipoVeiculo === 'van_carga') tVeh = 2300;
          else if (tipoVeiculo === 'truck_3eixos') tVeh = 8500;
          else if (tipoVeiculo === 'carreta_3eixos') tVeh = 15000;
          else if (tipoVeiculo === 'bitrem_7eixos') tVeh = 20000;
          else if (tipoVeiculo === 'bitrem_9eixos') tVeh = 24000;
          else tVeh = 12000;
        }

        const pbt = pCarga + tVeh;

        let eixosList: any[] = [];
        let excessoTotal = 0;
        let eixosTarifaveis = 2;
        let configSugerida = '';
        let necessitaAet = false;

        if (tipoVeiculo === 'van_carga') {
          eixosTarifaveis = 2;
          configSugerida = 'Furgão ou Caminhão Semileve';
          const pesoDir = Math.round(pbt * 0.45);
          const pesoTras = Math.round(pbt * 0.55);
          
          eixosList = [
            {
              identificacao: 'Eixo Direcional Dianteiro (Eixo 1)',
              tipo: 'isolado_simples',
              peso_estimado_kg: pesoDir,
              limite_legal_kg: 6000,
              status: pesoDir > 6000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Eixo Traseiro Simples (Eixo 2)',
              tipo: 'isolado_simples',
              peso_estimado_kg: pesoTras,
              limite_legal_kg: 6000,
              status: pesoTras > 6000 ? 'excedido' : 'dentro_do_limite'
            }
          ];
        } else if (tipoVeiculo === 'truck_3eixos') {
          eixosTarifaveis = 3;
          configSugerida = 'Caminhão Rígido 6x2 (Truck)';
          const pesoDir = Math.round(pbt * 0.28);
          const pesoTracao = Math.round(pbt * 0.72);
          
          eixosList = [
            {
              identificacao: 'Eixo Direcional Dianteiro (Eixo 1)',
              tipo: 'isolado_simples',
              peso_estimado_kg: pesoDir,
              limite_legal_kg: 6000,
              status: pesoDir > 6000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Conjunto Tandem Duplo Traseiro (Eixos 2 e 3)',
              tipo: 'tandem_duplo',
              peso_estimado_kg: pesoTracao,
              limite_legal_kg: 17000,
              status: pesoTracao > 17000 ? 'excedido' : 'dentro_do_limite'
            }
          ];
        } else if (tipoVeiculo === 'bitrem_7eixos') {
          eixosTarifaveis = 7;
          configSugerida = 'Bitrem Articulado 7 Eixos (3 conjuntos tandem duplo)';
          const pesoDir = Math.round(pbt * 0.10);
          const pesoCavalo = Math.round(pbt * 0.30);
          const pesoSemi1 = Math.round(pbt * 0.30);
          const pesoSemi2 = Math.round(pbt * 0.30);
          
          eixosList = [
            {
              identificacao: 'Eixo Direcional Dianteiro (Eixo 1)',
              tipo: 'isolado_simples',
              peso_estimado_kg: pesoDir,
              limite_legal_kg: 6000,
              status: pesoDir > 6000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Conjunto Tandem Duplo Tração (Eixos 2 e 3)',
              tipo: 'tandem_duplo',
              peso_estimado_kg: pesoCavalo,
              limite_legal_kg: 17000,
              status: pesoCavalo > 17000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Conjunto Tandem Duplo Semi-reboque 1 (Eixos 4 e 5)',
              tipo: 'tandem_duplo',
              peso_estimado_kg: pesoSemi1,
              limite_legal_kg: 17000,
              status: pesoSemi1 > 17000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Conjunto Tandem Duplo Semi-reboque 2 (Eixos 6 e 7)',
              tipo: 'tandem_duplo',
              peso_estimado_kg: pesoSemi2,
              limite_legal_kg: 17000,
              status: pesoSemi2 > 17000 ? 'excedido' : 'dentro_do_limite'
            }
          ];
        } else if (tipoVeiculo === 'bitrem_9eixos') {
          eixosTarifaveis = 9;
          configSugerida = 'Rodotrem Articulado 9 Eixos';
          const pesoDir = Math.round(pbt * 0.08);
          const pesoCavalo = Math.round(pbt * 0.23);
          const pesoSemi1 = Math.round(pbt * 0.23);
          const pesoDolly = Math.round(pbt * 0.23);
          const pesoSemi2 = Math.round(pbt * 0.23);
          
          eixosList = [
            {
              identificacao: 'Eixo Direcional Dianteiro (Eixo 1)',
              tipo: 'isolado_simples',
              peso_estimado_kg: pesoDir,
              limite_legal_kg: 6000,
              status: pesoDir > 6000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Conjunto Tandem Duplo Tração (Eixos 2 e 3)',
              tipo: 'tandem_duplo',
              peso_estimado_kg: pesoCavalo,
              limite_legal_kg: 17000,
              status: pesoCavalo > 17000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Conjunto Tandem Duplo Semi-reboque 1 (Eixos 4 e 5)',
              tipo: 'tandem_duplo',
              peso_estimado_kg: pesoSemi1,
              limite_legal_kg: 17000,
              status: pesoSemi1 > 17000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Conjunto Tandem Duplo Dolly (Eixos 6 e 7)',
              tipo: 'tandem_duplo',
              peso_estimado_kg: pesoDolly,
              limite_legal_kg: 17000,
              status: pesoDolly > 17000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Conjunto Tandem Duplo Semi-reboque 2 (Eixos 8 e 9)',
              tipo: 'tandem_duplo',
              peso_estimado_kg: pesoSemi2,
              limite_legal_kg: 17000,
              status: pesoSemi2 > 17000 ? 'excedido' : 'dentro_do_limite'
            }
          ];
        } else {
          eixosTarifaveis = 5;
          configSugerida = 'Cavalo Mecânico 4x2 + Semi-reboque de 3 eixos';
          const pesoDir = Math.round(pbt * 0.15);
          const pesoTracao = Math.round(pbt * 0.35);
          const pesoTraseiro = Math.round(pbt * 0.50);
          
          eixosList = [
            {
              identificacao: 'Eixo Direcional Dianteiro (Eixo 1)',
              tipo: 'isolado_simples',
              peso_estimado_kg: pesoDir,
              limite_legal_kg: 6000,
              status: pesoDir > 6000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Conjunto Tração Cavalo (Eixos 2 e 3)',
              tipo: 'tandem_duplo',
              peso_estimado_kg: pesoTracao,
              limite_legal_kg: 17000,
              status: pesoTracao > 17000 ? 'excedido' : 'dentro_do_limite'
            },
            {
              identificacao: 'Conjunto Traseiro Semi-reboque (Eixos 4, 5 e 6)',
              tipo: 'tandem_triplo',
              peso_estimado_kg: pesoTraseiro,
              limite_legal_kg: 25500,
              status: pesoTraseiro > 25500 ? 'excedido' : 'dentro_do_limite'
            }
          ];
        }

        eixosList.forEach(e => {
          if (e.peso_estimado_kg > e.limite_legal_kg) {
            excessoTotal += (e.peso_estimado_kg - e.limite_legal_kg);
          }
        });

        necessitaAet = pbt > 45000 || excessoTotal > 0;
        let alertaBalanca = excessoTotal > 0 
          ? `Distribuição excede os limites legais por eixos do CONTRAN em ${excessoTotal.toLocaleString('pt-BR')} kg. Recomenda-se remanejamento da carga ou troca de conjunto.`
          : `Pesagem e distribuição em conformidade com as regras do CONTRAN (tolerância de 5% no PBT respeitada).`;

        const dist = 320 + Math.round(Math.random() * 450);
        const tempo = Math.round((dist / 75) * 10) / 10;
        const nivelRisco = tipoCarga === 'alto_valor' || tipoCarga === 'produtos_perigosos' ? 'alto' : 'medio';

        const p1_descr = `Início do trajeto em ${origem}. Verificação de amarração de carga e aferição de pressão de pneus nos primeiros km.`;
        const p2_descr = `Trecho sinuoso de rodovia de pista simples. Atenção a curvas fechadas e declives pronunciados onde o uso do freio motor é obrigatório.`;
        const p3_descr = `Posto da Polícia Rodoviária Federal (PRF). Parada obrigatória se solicitado ou fiscalização da Lei da Balança ativa por sensores.`;
        const p4_descr = `Área urbana / Entroncamento rodoviário. Velocidade controlada por radares fixos. Alto índice de pedestres e ciclistas na faixa de domínio.`;
        const p5_descr = `Ponto de apoio seguro / Posto de combustível homologado. Recomendado para pernoite ou descanso do motorista obedecendo a Lei do Motorista.`;

        const pontos = [
          {
            ordem: 1,
            categoria: 'infraestrutura',
            localizacao: `Saída de ${origem}`,
            km_aproximado: 0,
            descricao: p1_descr,
            velocidade_maxima_recomendada: 40,
            instrucao: 'Verificar checklist pré-viagem, travas da carga e documentação fiscal (CT-e/MDF-e).',
            raio_alerta_metros: 500
          },
          {
            ordem: 2,
            categoria: 'risco',
            localizacao: 'Rodovia Principal - KM 48',
            km_aproximado: 48,
            descricao: p2_descr,
            velocidade_maxima_recomendada: 60,
            instrucao: 'Acionar freio motor e manter distância segura de seguimento (mínimo 50m do veículo à frente).',
            raio_alerta_metros: 1000
          },
          {
            ordem: 3,
            categoria: 'apoio',
            localizacao: 'Posto de Pesagem e PRF - KM 102',
            km_aproximado: 102,
            descricao: p3_descr,
            velocidade_maxima_recomendada: 30,
            instrucao: 'Passar na balança se aberta. Portar notas fiscais e relatórios de distribuição de peso por eixos.',
            raio_alerta_metros: 800
          },
          {
            ordem: 4,
            categoria: 'sinal',
            localizacao: 'Trecho de Serra / Vale - KM 180',
            km_aproximado: 180,
            descricao: 'Zonas de sombra com perda total ou parcial de sinal de satélite/GPRS das antenas principais.',
            velocidade_maxima_recomendada: null,
            instrucao: 'Avisar a central de monitoramento antes de adentrar a área de sombra. Ativar espelhamento ou redundância.',
            raio_alerta_metros: 2500
          },
          {
            ordem: 5,
            categoria: tipoCarga === 'alto_valor' ? 'roubo' : 'risco',
            localizacao: 'Entroncamento Metropolitano - KM 245',
            km_aproximado: 245,
            descricao: tipoCarga === 'alto_valor' 
              ? 'Alto índice de sinistralidade e roubo de carga nesta área periférica.'
              : p4_descr,
            velocidade_maxima_recomendada: 50,
            instrucao: 'Proibido realizar paradas não programadas neste trecho. Manter vidros fechados e portas travadas.',
            raio_alerta_metros: 1200
          },
          {
            ordem: 6,
            categoria: 'apoio',
            localizacao: 'Posto Rota Segura - KM 290',
            km_aproximado: 290,
            descricao: p5_descr,
            velocidade_maxima_recomendada: null,
            instrucao: 'Ponto homologado para descanso. Realizar checklist visual dos eixos e travas de carga.',
            raio_alerta_metros: 500
          },
          {
            ordem: 7,
            categoria: 'infraestrutura',
            localizacao: `Entrada em ${destino}`,
            km_aproximado: dist,
            descricao: `Chegada ao destino final em ${destino}. Rotas urbanas locais possuem restrição de circulação para veículos pesados em horários de pico.`,
            velocidade_maxima_recomendada: 40,
            instrucao: 'Verificar restrições da Zona de Máxima Restrição de Circulação (ZMRC) local e agendar descarga.',
            raio_alerta_metros: 1000
          }
        ];

        const motoristaText = `Atenção motorista. Viagem programada de ${origem} para ${destino}, distância de ${dist} quilômetros. O veículo ${tipoVeiculo.replace('_', ' ')} está transportando ${tipoCarga.replace('_', ' ')} com peso bruto total estimado de ${(pbt/1000).toFixed(1)} toneladas. ${excessoTotal > 0 ? `Aviso importante: Há excesso de peso estimado de ${excessoTotal} quilos nos eixos. Dirija com cuidado redobrado.` : 'Peso nos limites regulamentares.'} Siga o rotograma com atenção especial para as curvas na rodovia no quilômetro 48 e evite paradas no quilômetro 245. Faça paradas somente nos postos homologados. Boa viagem!`;

        const fallbackData = {
          origem,
          destino,
          distancia_km: dist,
          tempo_estimado_horas: tempo,
          nivel_risco_geral: nivelRisco,
          resumo: `Análise viária e de pesagem automatizada gerada localmente para a rota entre ${origem} e ${destino}. Risco geral estimado como ${nivelRisco.toUpperCase()} devido ao tipo de carga e condições viárias brasileiras.`,
          pontos,
          contatos_emergencia: {
            gerenciadora_risco: 'Buonny Gestão de Riscos (0800 771 9000)',
            transportadora: 'Central de Monitoramento Expresso S/A (Ramal 401)',
            prf: 'Polícia Rodoviária Federal (191)',
            resgate: 'Atendimento Médico Rodovias Federais (192 / Concessionária)',
            guincho: 'Auto Socorro Pesado 24h (0800 555 1212)'
          },
          calculo_eixos: {
            configuracao_veiculo: configuracaoEixos || (tipoVeiculo === 'carreta_3eixos' ? 'Cavalo Mecânico 4x2 + Semi-reboque de 3 eixos juntas' : configSugerida),
            tara_kg: tVeh,
            peso_carga_kg: pCarga,
            peso_bruto_total_kg: pbt,
            eixos: eixosList,
            excesso_total_kg: excessoTotal,
            configuracao_minima_sugerida: configSugerida,
            necessita_aet: necessitaAet,
            eixos_tarifaveis_pedagio: eixosTarifaveis,
            alerta: alertaBalanca
          },
          resumo_motorista: motoristaText
        };

        res.json(fallbackData);
      } catch (fallbackError: any) {
        console.error('[Gemini Fallback Error]:', fallbackError);
        res.status(500).json({ error: 'Erro crítico na geração local de rotograma de risco.' });
      }
    }
  });

  // Ensure all trips have a unique wt-xxxxx internal ID
  function ensureTripInternalIds() {
    const existingNums = new Set<number>();
    trips.forEach(t => {
      if (t.internalId) {
        const match = t.internalId.match(/\d+/);
        if (match) existingNums.add(parseInt(match[0], 10));
      }
    });

    let counter = 10001;
    trips.forEach(t => {
      if (!t.internalId) {
        while (existingNums.has(counter)) {
          counter++;
        }
        t.internalId = `wt-${String(counter).padStart(5, '0')}`;
        existingNums.add(counter);
        counter++;
      }
    });
  }

  // Get trips
  app.get('/api/trips', (req, res) => {
    ensureTripInternalIds();
    if (!demoMode) {
      const realTrips = trips.filter(t => t.id !== 't1');
      return res.json(realTrips);
    }
    res.json(trips);
  });

  // Create trip
  app.post('/api/trips', (req, res) => {
    const { vehicleId, driverId, originGeofenceId, destinationGeofenceId, scheduledLoadingDate, productId, contractId, loadedVolumeM3 } = req.body;
    if (!vehicleId || !driverId || !originGeofenceId || !destinationGeofenceId) {
      return res.status(400).json({ error: 'Todos os campos de associação da Viagem são obrigatórios.' });
    }

    const vehicle = vehicles.find(v => v.id === vehicleId);
    const driver = drivers.find(d => d.id === driverId);
    const origin = geofences.find(g => g.id === originGeofenceId);
    const dest = geofences.find(g => g.id === destinationGeofenceId);

    if (!vehicle || !driver || !origin || !dest) {
      return res.status(404).json({ error: 'Veículo, Motorista, Origem ou Destino não encontrado.' });
    }

    let pName = '';
    if (productId) {
      const prod = products.find(p => p.id === productId);
      if (prod) pName = prod.name;
    }

    const isMaintenance = vehicle.status === 'MAINTENANCE';

    // Set statuses
    vehicle.driverId = driver.id;
    vehicle.driverName = driver.name;
    
    if (!isMaintenance) {
      vehicle.status = 'EN_ROUTE';
      driver.status = 'EN_ROUTE';
    }
    
    vehicle.speed = 0; // Stationary initially

    // Store trip assignment as a manual override to avoid telemetry resets
    manualDriverNamesMap.set(vehicle.id, driver.name);
    manualDriverNamesMap.set(vehicle.licensePlate.toUpperCase().trim(), driver.name);

    const initialDistance = haversineDistance(
      vehicle.currentLatitude, vehicle.currentLongitude,
      origin.latitude, origin.longitude
    ) / 1000;
    
    // Do not auto-start transit if in maintenance
    const transitStarted = !isMaintenance && (initialDistance <= (origin.radius / 1000));

    ensureTripInternalIds();
    let maxNum = 10000;
    trips.forEach(t => {
      if (t.internalId) {
        const match = t.internalId.match(/\d+/);
        if (match) {
          const val = parseInt(match[0], 10);
          if (val > maxNum) maxNum = val;
        }
      }
    });
    const generatedInternalId = `wt-${String(maxNum + 1).padStart(5, '0')}`;

    const newTrip: Trip = {
      id: 't_' + Date.now(),
      tripNumber: 'TRIP-' + (1000 + trips.length),
      internalId: generatedInternalId,
      status: 'SCHEDULED',
      vehicleId,
      driverId,
      originGeofenceId,
      destinationGeofenceId,
      cteInfo: null,
      events: [
        {
          id: 'e_init_' + Date.now(),
          timestamp: new Date().toISOString(),
          type: 'STATUS_CHANGE',
          description: `Viagem criada de ${origin.name} para ${dest.name}. Motorista: ${driver.name}, Veículo: ${vehicle.licensePlate}.`,
          latitude: vehicle.currentLatitude,
          longitude: vehicle.currentLongitude
        }
      ],
      routeHistory: [
        { latitude: vehicle.currentLatitude, longitude: vehicle.currentLongitude }
      ],
      scheduledDate: new Date().toISOString(),
      scheduledLoadingDate: scheduledLoadingDate || new Date().toISOString(),
      transitStarted,
      initialDistanceToOriginKm: initialDistance,
      productId: productId || undefined,
      productName: pName || undefined,
      contractId: contractId || undefined,
      loadedVolumeM3: loadedVolumeM3 !== undefined ? Number(loadedVolumeM3) : undefined
    };

    trips.unshift(newTrip);

    // Initialize path simulation
    initSimulation(newTrip);

    saveDatabaseToDisk(true);
    broadcastTrips();
    broadcastVehicles();
    broadcastDrivers();

    res.status(201).json(newTrip);
  });

  // Edit trip
  app.put('/api/trips/:id', (req, res) => {
    const { id } = req.params;
    const { vehicleId, driverId, originGeofenceId, destinationGeofenceId, scheduledLoadingDate, productId, contractId, loadedVolumeM3 } = req.body;
    const trip = trips.find(t => t.id === id);
    if (!trip) return res.status(404).json({ error: 'Viagem não encontrada.' });

    const vehicle = vehicles.find(v => v.id === vehicleId);
    const driver = drivers.find(d => d.id === driverId);
    const origin = geofences.find(g => g.id === originGeofenceId);
    const dest = geofences.find(g => g.id === destinationGeofenceId);

    if (vehicleId && !vehicle) return res.status(404).json({ error: 'Veículo não encontrado.' });
    if (driverId && !driver) return res.status(404).json({ error: 'Motorista não encontrado.' });
    if (originGeofenceId && !origin) return res.status(404).json({ error: 'Geocerca origem não encontrada.' });
    if (destinationGeofenceId && !dest) return res.status(404).json({ error: 'Geocerca destino não encontrada.' });

    if (vehicleId) {
      trip.vehicleId = vehicleId;
    }
    if (driverId) {
      trip.driverId = driverId;
      if (driver) {
        if (trip.cteInfo) {
          trip.cteInfo.motoristaNome = driver.name;
        }
        const activeVehicle = vehicles.find(v => v.id === trip.vehicleId);
        if (activeVehicle) {
          activeVehicle.driverId = driver.id;
          activeVehicle.driverName = driver.name;
        }
      }
    }
    if (originGeofenceId) trip.originGeofenceId = originGeofenceId;
    if (destinationGeofenceId) trip.destinationGeofenceId = destinationGeofenceId;
    if (scheduledLoadingDate) trip.scheduledLoadingDate = scheduledLoadingDate;
    
    if (productId !== undefined) {
      trip.productId = productId || undefined;
      if (productId) {
        const prod = products.find(p => p.id === productId);
        trip.productName = prod ? prod.name : undefined;
      } else {
        trip.productName = undefined;
      }
    }

    if (contractId !== undefined) {
      trip.contractId = contractId || undefined;
    }
    
    if (loadedVolumeM3 !== undefined) {
      trip.loadedVolumeM3 = loadedVolumeM3 !== null ? Number(loadedVolumeM3) : undefined;
    }

    saveDatabaseToDisk(true);
    broadcastTrips();
    broadcastVehicles();
    broadcastDrivers();
    res.json(trip);
  });

  // Delete trip
  app.delete('/api/trips/:id', (req, res) => {
    const { id } = req.params;
    trips = trips.filter(t => t.id !== id);
    saveDatabaseToDisk(true);
    broadcastTrips();
    res.json({ success: true });
  });

  // Reset trip for demo
  app.post('/api/trips/:id/reset', (req, res) => {
    const { id } = req.params;
    const trip = trips.find(t => t.id === id);
    if (!trip) return res.status(404).json({ error: 'Viagem não encontrada.' });

    // Clear loading ticks
    delete waitingLoadingTicks[id];

    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
    const origin = geofences.find(g => g.id === trip.originGeofenceId);
    if (vehicle && origin) {
      vehicle.currentLatitude = origin.latitude + 0.012;
      vehicle.currentLongitude = origin.longitude + 0.012;
      vehicle.speed = 0;
      if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'EN_ROUTE';
    }

    const initialDistance = vehicle && origin ? haversineDistance(
      vehicle.currentLatitude, vehicle.currentLongitude,
      origin.latitude, origin.longitude
    ) / 1000 : 0;

    trip.status = 'SCHEDULED';
    trip.cteInfo = null;
    trip.transitStarted = false;
    trip.initialDistanceToOriginKm = initialDistance;
    trip.events = [
      {
        id: 'e_reset_' + Date.now(),
        timestamp: new Date().toISOString(),
        type: 'STATUS_CHANGE',
        description: 'Simulação reiniciada para status Agendada.',
        latitude: vehicle ? vehicle.currentLatitude : origin ? origin.latitude : 0,
        longitude: vehicle ? vehicle.currentLongitude : origin ? origin.longitude : 0
      }
    ];
    trip.routeHistory = vehicle ? [{ latitude: vehicle.currentLatitude, longitude: vehicle.currentLongitude }] : [];
    trip.startDate = undefined;
    trip.deliveryDate = undefined;

    saveDatabaseToDisk(true);
    broadcastTrips();
    broadcastVehicles();
    res.json(trip);
  });

  // Attach CT-e (Document parsing completion)
  app.post('/api/trips/:id/cte', (req, res) => {
    const { id } = req.params;
    const { cteInfo } = req.body;

    if (!cteInfo) {
      return res.status(400).json({ error: 'Dados do CT-e são necessários.' });
    }

    const trip = trips.find(t => t.id === id);
    if (!trip) return res.status(404).json({ error: 'Viagem não encontrada.' });

    // Clear loading ticks
    delete waitingLoadingTicks[id];

    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
    const driver = drivers.find(d => d.id === trip.driverId);
    const origin = geofences.find(g => g.id === trip.originGeofenceId);

    trip.cteInfo = cteInfo;
    if (cteInfo.volume && (!trip.loadedVolumeM3 || trip.loadedVolumeM3 === 0)) {
      trip.loadedVolumeM3 = Number(cteInfo.volume);
    }

    // Attaching CT-e during SCHEDULED or WAITING_LOADING transitions trip to EN_ROUTE (Em Trânsito)
    if (trip.status === 'SCHEDULED' || trip.status === 'WAITING_LOADING') {
      trip.status = 'EN_ROUTE';
      if (!trip.startDate) trip.startDate = new Date().toISOString();
      if (vehicle && vehicle.status !== 'MAINTENANCE') {
        vehicle.status = 'EN_ROUTE';
        vehicle.speed = 75;
      }
    }
    trip.events.push({
      id: 'e_cte_attached_' + Date.now(),
      timestamp: new Date().toISOString(),
      type: 'CTE_UPLOAD',
      description: `CT-e Nº ${cteInfo.nCT} emitido com sucesso e vinculado à viagem. Carga: ${cteInfo.proPred} (R$ ${cteInfo.vCarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
      latitude: vehicle ? vehicle.currentLatitude : origin ? origin.latitude : 0,
      longitude: vehicle ? vehicle.currentLongitude : origin ? origin.longitude : 0
    });

    saveDatabaseToDisk(true);
    broadcastTrips();
    broadcastVehicles();
    broadcastDrivers();
    res.json(trip);
  });

  // Manual Status Update
  app.post('/api/trips/:id/update-status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const trip = trips.find(t => t.id === id);
    if (!trip) return res.status(404).json({ error: 'Viagem não encontrada.' });

    if (status === 'DELIVERED' && !trip.cteInfo) {
      if (req.body.cteInfo) {
        trip.cteInfo = req.body.cteInfo;
      } else {
        const vol = req.body.volume ? Number(req.body.volume) : undefined;
        const frete = req.body.vTPrest ? Number(req.body.vTPrest) : undefined;
        trip.cteInfo = createFallbackCteInfo(trip, vol, frete);
      }
    }

    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
    const driver = drivers.find(d => d.id === trip.driverId);

    if (status === 'START_TRANSIT') {
      if (vehicle && vehicle.status === 'MAINTENANCE') {
        return res.status(400).json({ error: 'Não é possível iniciar o trânsito. O veículo encontra-se em manutenção e precisa ser liberado primeiro.' });
      }
      trip.transitStarted = true;
      if (vehicle) {
        const origin = geofences.find(g => g.id === trip.originGeofenceId);
        if (origin && demoMode) {
          vehicle.currentLatitude = origin.latitude + 0.015;
          vehicle.currentLongitude = origin.longitude + 0.015;
        }
        vehicle.status = 'EN_ROUTE';
        vehicle.speed = 45;
      }
      trip.events.push({
        id: 'e_manual_transit_' + Date.now(),
        timestamp: new Date().toISOString(),
        type: 'STATUS_CHANGE',
        description: 'Trânsito / Vazio iniciado manualmente pelo usuário.',
        latitude: vehicle ? vehicle.currentLatitude : 0,
        longitude: vehicle ? vehicle.currentLongitude : 0
      });
    } else {
      trip.status = status as TripStatus;
      if (status === 'SCHEDULED') {
        trip.transitStarted = false;
        if (vehicle) {
          if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'AVAILABLE';
          vehicle.speed = 0;
        }
      } else if (status === 'DELIVERED') {
        trip.deliveryDate = new Date().toISOString();
        if (vehicle) {
          if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'AVAILABLE';
          vehicle.speed = 0;
        }
        if (driver) {
          driver.status = 'AVAILABLE';
        }
      } else if (status === 'EN_ROUTE') {
        if (!trip.startDate) trip.startDate = new Date().toISOString();
        trip.hasExitedDest = false;
        trip.hasEnteredDest = false;
        if (vehicle) {
          if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'EN_ROUTE';
          vehicle.speed = 80;
        }
        const pathSim = simulatedTripPaths.find(p => p.tripId === trip.id);
        if (pathSim && pathSim.points.length > 0) {
          pathSim.currentIndex = Math.max(0, pathSim.points.length - 15);
        }
      } else if (status === 'WAITING_LOADING') {
        if (vehicle) {
          if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'AVAILABLE';
          vehicle.speed = 0;
          const origin = geofences.find(g => g.id === trip.originGeofenceId);
          if (origin) {
            vehicle.currentLatitude = origin.latitude;
            vehicle.currentLongitude = origin.longitude;
            try {
              const locName = await reverseGeocode(origin.latitude, origin.longitude);
              if (locName) {
                vehicle.manualLocation = locName;
              } else {
                vehicle.manualLocation = origin.name;
              }
            } catch (err) {
              vehicle.manualLocation = origin.name;
            }
            vehicle.manualLocationUpdatedAt = new Date().toISOString();
            vehicle.telemetryTime = new Date().toISOString();
          }
        }
      } else if (status === 'WAITING_UNLOADING') {
        if (vehicle) {
          if (vehicle.status !== 'MAINTENANCE') vehicle.status = 'AVAILABLE';
          vehicle.speed = 0;
          const dest = geofences.find(g => g.id === trip.destinationGeofenceId);
          if (dest) {
            vehicle.currentLatitude = dest.latitude;
            vehicle.currentLongitude = dest.longitude;
            try {
              const locName = await reverseGeocode(dest.latitude, dest.longitude);
              if (locName) {
                vehicle.manualLocation = locName;
              } else {
                vehicle.manualLocation = dest.name;
              }
            } catch (err) {
              vehicle.manualLocation = dest.name;
            }
            vehicle.manualLocationUpdatedAt = new Date().toISOString();
            vehicle.telemetryTime = new Date().toISOString();
          }
        }
      }

function translateStatusToPt(st: string): string {
  switch (st) {
    case 'SCHEDULED': return 'Agendado';
    case 'START_TRANSIT': return 'Trânsito / Vazio';
    case 'WAITING_LOADING': return 'No Carregamento';
    case 'EN_ROUTE': return 'Em Trânsito';
    case 'WAITING_UNLOADING': return 'No Descarregamento';
    case 'DELIVERED': return 'Concluído';
    case 'CANCELLED': return 'Cancelado';
    case 'AVAILABLE': return 'Disponível';
    case 'MAINTENANCE': return 'Em Manutenção';
    case 'BLOCKED': return 'Bloqueado';
    case 'ALERT': return 'Com Alerta';
    default: return st;
  }
}

      trip.events.push({
        id: 'e_manual_' + Date.now(),
        timestamp: new Date().toISOString(),
        type: 'STATUS_CHANGE',
        description: `Alteração manual de status para: ${translateStatusToPt(status)}`,
        latitude: vehicle ? vehicle.currentLatitude : 0,
        longitude: vehicle ? vehicle.currentLongitude : 0
      });
    }

    saveDatabaseToDisk(true);
    broadcastTrips();
    broadcastVehicles();
    broadcastDrivers();
    res.json(trip);
  });

  // Database Cloud Synchronization Endpoints
  app.get('/api/database/cloud-status', async (req, res) => {
    if (!db) {
      return res.json({
        success: false,
        message: 'Serviço do Firestore não inicializado ou indisponível.'
      });
    }

    try {
      const stateDoc = await getDoc(doc(db, 'state', 'data'));
      const exists = stateDoc.exists();
      let cloudData: any = null;
      if (exists) {
        cloudData = stateDoc.data();
      }

      res.json({
        success: true,
        cloud: {
          exists,
          updatedAt: cloudData?.updatedAt || null,
          counts: {
            vehicles: Array.isArray(cloudData?.vehicles) ? cloudData.vehicles.length : 0,
            drivers: Array.isArray(cloudData?.drivers) ? cloudData.drivers.length : 0,
            geofences: Array.isArray(cloudData?.geofences) ? cloudData.geofences.length : 0,
            trips: Array.isArray(cloudData?.trips) ? cloudData.trips.length : 0,
            products: Array.isArray(cloudData?.products) ? cloudData.products.length : 0,
            contracts: Array.isArray(cloudData?.contracts) ? cloudData.contracts.length : 0,
            maintenanceRecords: Array.isArray(cloudData?.maintenanceRecords) ? cloudData.maintenanceRecords.length : 0,
          }
        },
        local: {
          counts: {
            vehicles: vehicles.length,
            drivers: drivers.length,
            geofences: geofences.length,
            trips: trips.length,
            products: products.length,
            contracts: contracts.length,
            maintenanceRecords: maintenanceRecords.length,
          }
        }
      });
    } catch (err: any) {
      res.json({
        success: false,
        error: err?.message || String(err)
      });
    }
  });

  app.post('/api/database/sync-from-cloud', async (req, res) => {
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Serviço do Firestore não inicializado ou indisponível.'
      });
    }

    try {
      console.log('[API] Iniciando sincronização manual da nuvem (versão publicada) para local (versão em construção)...');
      const success = await loadDatabaseFromFirestore();
      if (success) {
        skipFirestoreSave = true;
        try {
          saveDatabaseToDisk(true);
        } finally {
          skipFirestoreSave = false;
        }

        console.log('[API] Sincronização manual concluída com sucesso. Transmitindo atualizações...');
        broadcastVehicles();
        broadcastDrivers();
        broadcastGeofences();
        broadcastProducts();
        broadcastContracts();
        broadcastTrips();
        broadcastSettings();

        res.json({
          success: true,
          message: 'Banco de dados sincronizado com sucesso da versão publicada para a versão em construção!'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Falha ao ler os dados do Firestore ou limite de quota atingido.'
        });
      }
    } catch (err: any) {
      console.error('[API] Erro ao sincronizar a partir da nuvem:', err);
      res.status(500).json({
        success: false,
        error: err?.message || String(err)
      });
    }
  });

  // Server Integration Settings GET/POST endpoints
  app.get('/api/settings', (req, res) => {
    res.json({
      demoMode,
      sascarUser,
      sascarPass: sascarPass ? '••••••••' : '',
      lastSyncError,
      lastSyncTime
    });
  });

  app.post('/api/settings', (req, res) => {
    const { demoMode: newDemo, sascarUser: newUser, sascarPass: newPass } = req.body;
    let modeChanged = false;
    let credentialsChanged = false;

    if (newDemo !== undefined) {
      if (demoMode !== newDemo) {
        demoMode = newDemo;
        modeChanged = true;
      }
    }
    if (newUser !== undefined) {
      if (sascarUser !== newUser) {
        sascarUser = newUser;
        credentialsChanged = true;
      }
    }
    if (newPass !== undefined && newPass !== '••••••••') {
      if (sascarPass !== newPass) {
        sascarPass = newPass;
        credentialsChanged = true;
      }
    }

    // If transitioned to production or changed credentials under production, sync immediately
    if ((!demoMode && modeChanged) || (credentialsChanged && !demoMode)) {
      console.log('[Settings] Resetting active SOAP sync method and plate/driver cache maps...');
      activeSyncMethod = null;
      sascarIdToPlateMap.clear();
      sascarDriverIdToNameMap.clear();
      sascarVehicleIdToDriverIdMap.clear();
      
      // Trigger background sync instantly without waiting 15 seconds
      runPositionSync().catch(err => {
        console.error('[Settings] Instant background sync failed:', err);
      });
    }

    // Broadcast settings and state updates for the new mode immediately
    saveDatabaseToDisk(true);
    broadcastSettings();
    broadcastVehicles();
    broadcastDrivers();
    broadcastTrips();

    res.json({
      success: true,
      demoMode,
      sascarUser,
      sascarPass: sascarPass ? '••••••••' : '',
      lastSyncError,
      lastSyncTime
    });
  });

  // Proxy Sascar SOAP
  app.post('/api/sascar-soap', async (req, res) => {
    const { method, params } = req.body;
    
    const resolvedParams = { ...params };
    
    // Resolve password masking or empty credentials with server values
    if (resolvedParams.senha === '••••••••' || !resolvedParams.senha) {
      resolvedParams.senha = sascarPass;
    }
    if (resolvedParams.password === '••••••••' || !resolvedParams.password) {
      resolvedParams.password = sascarPass;
    }
    if (!resolvedParams.usuario && sascarUser) {
      resolvedParams.usuario = sascarUser;
    }
    if (!resolvedParams.user && sascarUser) {
      resolvedParams.user = sascarUser;
    }

    const paramsXml = Object.entries(resolvedParams)
      .map(([k, v]) => `<${k}>${v}</${k}>`)
      .join('\n');

    // Use correct namespace based on method as per Sascar Integration Manual
    const ns = method === 'obterGrupoAtuadores' 
      ? 'http://ws.integra.sascar.com.br/' 
      : 'http://webservice.web.integracao.sascar.com.br/';

    const soapBody = `
      <soapenv:Envelope
        xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
        xmlns:web="${ns}">
        <soapenv:Header/>
        <soapenv:Body>
          <web:${method}>
            ${paramsXml}
          </web:${method}>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const SASCAR_URL = 'https://sasintegra.sascar.com.br/SasIntegra/SasIntegraWSService';

    try {
      const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(SASCAR_URL, {
          signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': `"${method}"`,
        },
        body: soapBody,
      });


      const xmlText = await response.text();

      // Check if there is a SOAP Fault
      const faultMatch = /<faultstring>([\s\S]*?)<\/faultstring>/.exec(xmlText);
      if (faultMatch) {
        return res.status(400).json({ error: faultMatch[1].trim().replace(/Atencao:\s*/gi, '') });
      }

      // Parse SOAP XML return blocks into JSON structures
      const returns: any[] = [];
      const returnRegex = /<return>([\s\S]*?)<\/return>/g;
      let match;
      while ((match = returnRegex.exec(xmlText)) !== null) {
        const content = match[1].trim();
        if (content.startsWith('{') || content.startsWith('[')) {
          try {
            returns.push(JSON.parse(content));
          } catch (e) {
            returns.push(content);
          }
        } else if (content.startsWith('<')) {
          const obj: Record<string, any> = {};
          const tagRegex = /<([^>]+)>([\s\S]*?)<\/\1>/g;
          let tagMatch;
          let hasTags = false;
          while ((tagMatch = tagRegex.exec(content)) !== null) {
            hasTags = true;
            const key = tagMatch[1];
            const val = tagMatch[2].trim();
            if (val === 'true') obj[key] = true;
            else if (val === 'false') obj[key] = false;
            else if (val === 'null') obj[key] = null;
            else if (/^\d+$/.test(val)) obj[key] = parseInt(val, 10);
            else if (/^\d+\.\d+$/.test(val)) obj[key] = parseFloat(val);
            else obj[key] = val;
          }
          returns.push(hasTags ? obj : content);
        } else {
          returns.push(content);
        }
      }

      return res.status(response.status).json({ data: returns });
    } catch (error: any) {
      // In Demo/Mock Mode or on failure, return a clean mocked JSON answer
      const mockResult = {
        data: [{
          status: 'OK',
          message: 'Simulado com sucesso no ambiente TransControl',
          timestamp: new Date().toISOString()
        }]
      };
      return res.status(200).json(mockResult);
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Nenhuma mensagem enviada.' });
      }

      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role !== 'user') {
        return res.status(400).json({ error: 'A última mensagem deve ser do usuário.' });
      }

      const client = getGeminiClient();

      const totalVehiclesCount = vehicles.length;
      const availableVehiclesCount = vehicles.filter(v => v.status === 'AVAILABLE').length;
      const enRouteVehiclesCount = vehicles.filter(v => v.status === 'EN_ROUTE').length;
      const blockedVehiclesCount = vehicles.filter(v => v.status === 'BLOCKED').length;

      const totalDriversCount = drivers.length;
      const availableDriversCount = drivers.filter(d => d.status === 'AVAILABLE').length;
      const onTripDriversCount = drivers.filter(d => d.status === 'EN_ROUTE').length;

      const totalTripsCount = trips.length;
      const activeTripsCount = trips.filter(t => t.status === 'EN_ROUTE' || t.status === 'SCHEDULED').length;
      const completedTripsCount = trips.filter(t => t.status === 'DELIVERED').length;

      const systemInstruction = `Você é o TransControl AI, o assistente inteligente da Work Transportes.
Sua principal função é ajudar o usuário a obter informações em tempo real sobre a localização dos veículos, status dos motoristas, andamento de viagens, cercas eletrônicas e relatórios analíticos estruturados.

DADOS RESUMIDOS DA FROTA (ESTATÍSTICAS EM TEMPO REAL):
- Total de Veículos: ${totalVehiclesCount} (${availableVehiclesCount} Disponíveis, ${enRouteVehiclesCount} Em Rota, ${blockedVehiclesCount} Bloqueados)
- Total de Motoristas: ${totalDriversCount} (${availableDriversCount} Disponíveis, ${onTripDriversCount} Em Viagem)
- Total de Viagens: ${totalTripsCount} (${activeTripsCount} Ativas/Agendadas, ${completedTripsCount} Concluídas/Entregues)

DADOS DETALHADOS EM TEMPO REAL DO SISTEMA:
- Veículos cadastrados:
${JSON.stringify(vehicles.map(v => ({
  id: v.id,
  placa: v.licensePlate,
  modelo: v.model,
  latitude: v.currentLatitude,
  longitude: v.currentLongitude,
  direcao: v.direction,
  velocidade: v.speed,
  status: v.status,
  motoristaId: v.driverId,
  motoristaNome: v.driverName,
  ultimaAtualizacao: v.telemetryTime,
  visivelNoMapa: v.visibleOnMap
})), null, 2)}

- Motoristas cadastrados:
${JSON.stringify(drivers, null, 2)}

- Viagens cadastradas:
${JSON.stringify(trips.map(t => {
  const v = vehicles.find(vec => vec.id === t.vehicleId);
  const d = drivers.find(drv => drv.id === t.driverId);
  return {
    id: t.id,
    numeroViagem: t.tripNumber,
    status: t.status,
    veiculoId: t.vehicleId,
    motoristaId: t.driverId,
    motoristaNome: d?.name || t.cteInfo?.motoristaNome || v?.driverName || '',
    placaVeiculo: t.cteInfo?.placaVeiculo || v?.licensePlate || '',
    cercaOrigemId: t.originGeofenceId,
    cercaDestinoId: t.destinationGeofenceId,
    eventoUltimo: t.events?.[t.events.length - 1]
  };
}), null, 2)}

- Cercas eletrônicas (Geofences):
${JSON.stringify(geofences, null, 2)}

DIRETRIZES DE RESPOSTA:
1. Responda em Português do Brasil com um tom profissional, amigável, prestativo e focado em logística.
2. Quando perguntado sobre a localização de um motorista ou veículo, forneça os detalhes mais precisos possíveis (coordenadas, velocidade atual, se está parado ou em movimento, motorista atribuído e placa). Se houver uma cerca eletrônica cadastrada que coincida ou seja muito próxima das coordenadas, mencione-a!
3. Se o usuário pedir um relatório, organize as informações em tabelas Markdown elegantes ou listas ordenadas com marcadores para maior legibilidade.
4. Se o usuário perguntar algo fora do escopo do sistema de transportes, responda educadamente explicando que você é especializado no monitoramento da TransControl e recomende retornar ao assunto de logística de frota.
5. Se for perguntado sobre como acelerar a localização (como na solicitação anterior), explique que o sistema agora usa conexões de alta performance em tempo real via Server-Sent Events (SSE) para obter atualizações instantâneas de telemetria sem atraso de polling.
6. Não invente dados. Use sempre e somente os dados reais fornecidos acima. Se um motorista não estiver em viagem ou não tiver veículo atribuído, informe isso claramente.`;

      const history = messages.slice(0, -1).map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const chat = client.chats.create({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction: systemInstruction,
        },
        history: history
      });

      const response = await chat.sendMessage({ message: lastMessage.content });
      return res.json({ text: response.text });
    } catch (error: any) {
      console.error('[Gemini AI Chat Error]:', error);
      const isApiKeyMissing = error.message && error.message.includes('GEMINI_API_KEY');
      return res.status(500).json({ 
        error: isApiKeyMissing 
          ? 'Chave do Gemini ausente. Configure GEMINI_API_KEY no menu Configurações (ícone de engrenagem) ou na barra de ferramentas do AI Studio.' 
          : 'Ocorreu um erro ao processar sua solicitação com a inteligência artificial: ' + (error.message || error) 
      });
    }
  });

  // Vite middleware setup for development, static fallback for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer();
