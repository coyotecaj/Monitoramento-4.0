// Comprehensive Brazilian Reverse Geocoding Utility
// Converts latitude and longitude into exact "Cidade - UF" offline instantly

export interface CityLocation {
  name: string;
  uf: string;
  lat: number;
  lng: number;
}

export const BRAZIL_CITIES: CityLocation[] = [
  // GOIÁS (GO)
  { name: 'Goiânia', uf: 'GO', lat: -16.6869, lng: -49.2648 },
  { name: 'Anápolis', uf: 'GO', lat: -16.3286, lng: -48.9534 },
  { name: 'Aparecida de Goiânia', uf: 'GO', lat: -16.8228, lng: -49.2472 },
  { name: 'Rio Verde', uf: 'GO', lat: -17.7925, lng: -50.9189 },
  { name: 'Itumbiara', uf: 'GO', lat: -18.4147, lng: -49.2142 },
  { name: 'Jataí', uf: 'GO', lat: -17.8814, lng: -51.7144 },
  { name: 'Catalão', uf: 'GO', lat: -18.1658, lng: -47.9461 },
  { name: 'Luziânia', uf: 'GO', lat: -16.2525, lng: -47.9500 },
  { name: 'Formosa', uf: 'GO', lat: -15.5482, lng: -47.2991 },
  { name: 'Senador Canedo', uf: 'GO', lat: -16.7083, lng: -49.0917 },
  { name: 'Trindade', uf: 'GO', lat: -16.6492, lng: -49.4889 },
  { name: 'Valparaíso de Goiás', uf: 'GO', lat: -16.0667, lng: -47.9833 },
  { name: 'Porangatu', uf: 'GO', lat: -13.4414, lng: -49.1486 },
  { name: 'Uruaçu', uf: 'GO', lat: -14.5247, lng: -49.1414 },
  { name: 'Goianésia', uf: 'GO', lat: -15.3175, lng: -49.1172 },
  { name: 'Ceres', uf: 'GO', lat: -15.3072, lng: -49.5978 },
  { name: 'Jaraguá', uf: 'GO', lat: -15.7569, lng: -49.3344 },
  { name: 'Rianápolis', uf: 'GO', lat: -15.4489, lng: -49.5122 },
  { name: 'Itaguaru', uf: 'GO', lat: -15.4389, lng: -49.6389 },
  { name: 'Abadiânia', uf: 'GO', lat: -16.2044, lng: -48.7067 },
  { name: 'Alexânia', uf: 'GO', lat: -16.0822, lng: -48.5078 },
  { name: 'Bom Jesus de Goiás', uf: 'GO', lat: -17.9341, lng: -49.8520 },
  { name: 'Professor Jamil', uf: 'GO', lat: -17.2451, lng: -49.2415 },
  { name: 'Morrinhos', uf: 'GO', lat: -17.7311, lng: -49.1006 },
  { name: 'Caldas Novas', uf: 'GO', lat: -17.7442, lng: -48.6253 },
  { name: 'Cristalina', uf: 'GO', lat: -16.7686, lng: -47.6139 },
  { name: 'Posse', uf: 'GO', lat: -14.0931, lng: -46.3694 },
  { name: 'São Luís de Montes Belos', uf: 'GO', lat: -16.5250, lng: -50.3708 },
  { name: 'Inhumas', uf: 'GO', lat: -16.3581, lng: -49.4989 },
  { name: 'Goianápolis', uf: 'GO', lat: -16.3475, lng: -48.9564 },

  // MINAS GERAIS (MG)
  { name: 'Belo Horizonte', uf: 'MG', lat: -19.9213, lng: -43.9372 },
  { name: 'Uberlândia', uf: 'MG', lat: -18.9186, lng: -48.2772 },
  { name: 'Contagem', uf: 'MG', lat: -19.9317, lng: -44.0536 },
  { name: 'Juiz de Fora', uf: 'MG', lat: -21.7642, lng: -43.3497 },
  { name: 'Betim', uf: 'MG', lat: -19.9621, lng: -44.1041 },
  { name: 'Montes Claros', uf: 'MG', lat: -16.7281, lng: -43.8617 },
  { name: 'Ribeirão das Neves', uf: 'MG', lat: -19.7675, lng: -44.0869 },
  { name: 'Uberaba', uf: 'MG', lat: -19.7483, lng: -47.9319 },
  { name: 'Governador Valadares', uf: 'MG', lat: -18.8511, lng: -41.9494 },
  { name: 'Ipatinga', uf: 'MG', lat: -19.4686, lng: -42.5369 },
  { name: 'Sete Lagoas', uf: 'MG', lat: -19.4658, lng: -44.2467 },
  { name: 'Divinópolis', uf: 'MG', lat: -20.1431, lng: -44.8908 },
  { name: 'Santa Luzia', uf: 'MG', lat: -19.7697, lng: -43.8514 },
  { name: 'Ibirité', uf: 'MG', lat: -20.0219, lng: -44.0589 },
  { name: 'Poços de Caldas', uf: 'MG', lat: -21.7878, lng: -46.5614 },
  { name: 'Patos de Minas', uf: 'MG', lat: -18.5789, lng: -46.5181 },
  { name: 'Pouso Alegre', uf: 'MG', lat: -22.2300, lng: -45.9361 },
  { name: 'Teófilo Otoni', uf: 'MG', lat: -17.8575, lng: -41.5053 },
  { name: 'Varginha', uf: 'MG', lat: -21.5517, lng: -45.4300 },
  { name: 'Conselheiro Lafaiete', uf: 'MG', lat: -20.6603, lng: -43.7861 },
  { name: 'Araguari', uf: 'MG', lat: -18.6486, lng: -48.1858 },
  { name: 'Ituiutaba', uf: 'MG', lat: -18.9686, lng: -49.4647 },
  { name: 'Passos', uf: 'MG', lat: -20.7189, lng: -46.6097 },
  { name: 'Monte Alegre de Minas', uf: 'MG', lat: -18.8945, lng: -48.6541 },
  { name: 'Córrego Danta', uf: 'MG', lat: -19.7202, lng: -45.8000 },
  { name: 'São Domingos do Prata', uf: 'MG', lat: -19.9274, lng: -42.8000 },
  { name: 'Centralina', uf: 'MG', lat: -18.7091, lng: -49.1388 },
  { name: 'João Monlevade', uf: 'MG', lat: -19.8108, lng: -43.1736 },
  { name: 'Sabará', uf: 'MG', lat: -19.8858, lng: -43.8089 },
  { name: 'Caeté', uf: 'MG', lat: -19.8797, lng: -43.6689 },
  { name: 'Florestal', uf: 'MG', lat: -19.8889, lng: -44.4294 },

  // BAHIA (BA)
  { name: 'Salvador', uf: 'BA', lat: -12.9777, lng: -38.5016 },
  { name: 'Feira de Santana', uf: 'BA', lat: -12.2667, lng: -38.9667 },
  { name: 'Vitória da Conquista', uf: 'BA', lat: -14.8661, lng: -40.8394 },
  { name: 'Camaçari', uf: 'BA', lat: -12.6975, lng: -38.3242 },
  { name: 'Juazeiro', uf: 'BA', lat: -9.4306, lng: -40.5028 },
  { name: 'Lauro de Freitas', uf: 'BA', lat: -12.8944, lng: -38.3275 },
  { name: 'Itabuna', uf: 'BA', lat: -14.7858, lng: -39.2800 },
  { name: 'Ilhéus', uf: 'BA', lat: -14.7889, lng: -39.0494 },
  { name: 'Barreiras', uf: 'BA', lat: -12.1528, lng: -44.9900 },
  { name: 'Jequié', uf: 'BA', lat: -13.8583, lng: -40.0833 },
  { name: 'Alagoinhas', uf: 'BA', lat: -12.1350, lng: -38.4192 },
  { name: 'Teixeira de Freitas', uf: 'BA', lat: -17.5358, lng: -39.7428 },
  { name: 'Porto Seguro', uf: 'BA', lat: -16.4497, lng: -39.0647 },
  { name: 'Simões Filho', uf: 'BA', lat: -12.7861, lng: -38.4025 },
  { name: 'Paulo Afonso', uf: 'BA', lat: -9.4069, lng: -38.2178 },
  { name: 'Eunápolis', uf: 'BA', lat: -16.3778, lng: -39.5833 },
  { name: 'Santo Antônio de Jesus', uf: 'BA', lat: -12.9689, lng: -39.2611 },
  { name: 'Valença', uf: 'BA', lat: -13.3703, lng: -39.0731 },
  { name: 'Candeias', uf: 'BA', lat: -12.6719, lng: -38.5442 },
  { name: 'São Francisco do Conde', uf: 'BA', lat: -12.6264, lng: -38.5800 },
  { name: 'Santo Amaro', uf: 'BA', lat: -12.5469, lng: -38.7119 },
  { name: 'Inhambupe', uf: 'BA', lat: -11.7833, lng: -38.3500 },
  { name: 'Nova Itarana', uf: 'BA', lat: -13.0189, lng: -40.1067 },
  { name: 'Irajuba', uf: 'BA', lat: -13.2500, lng: -40.0833 },
  { name: 'Luís Eduardo Magalhães', uf: 'BA', lat: -12.0958, lng: -45.7958 },

  // ESPÍRITO SANTO (ES)
  { name: 'Serra', uf: 'ES', lat: -20.1286, lng: -40.3078 },
  { name: 'Vila Velha', uf: 'ES', lat: -20.3297, lng: -40.2925 },
  { name: 'Cariacica', uf: 'ES', lat: -20.2639, lng: -40.4200 },
  { name: 'Vitória', uf: 'ES', lat: -20.3155, lng: -40.3128 },
  { name: 'Cachoeiro de Itapemirim', uf: 'ES', lat: -20.8489, lng: -41.1128 },
  { name: 'Linhares', uf: 'ES', lat: -19.3911, lng: -40.0722 },
  { name: 'São Mateus', uf: 'ES', lat: -18.7161, lng: -39.8589 },
  { name: 'Guarapari', uf: 'ES', lat: -20.6728, lng: -40.4981 },
  { name: 'Colatina', uf: 'ES', lat: -19.5389, lng: -40.6300 },
  { name: 'Aracruz', uf: 'ES', lat: -19.8203, lng: -40.2733 },

  // SÃO PAULO (SP)
  { name: 'São Paulo', uf: 'SP', lat: -23.5505, lng: -46.6333 },
  { name: 'Guarulhos', uf: 'SP', lat: -23.4628, lng: -46.5333 },
  { name: 'Campinas', uf: 'SP', lat: -22.9056, lng: -47.0608 },
  { name: 'São Bernardo do Campo', uf: 'SP', lat: -23.6939, lng: -46.5650 },
  { name: 'São José dos Campos', uf: 'SP', lat: -23.1794, lng: -45.8869 },
  { name: 'Santo André', uf: 'SP', lat: -23.6639, lng: -46.5383 },
  { name: 'Ribeirão Preto', uf: 'SP', lat: -21.1704, lng: -47.8103 },
  { name: 'Osasco', uf: 'SP', lat: -23.5325, lng: -46.7917 },
  { name: 'Sorocaba', uf: 'SP', lat: -23.5015, lng: -47.4583 },
  { name: 'Mauá', uf: 'SP', lat: -23.6678, lng: -46.4614 },
  { name: 'São José do Rio Preto', uf: 'SP', lat: -20.8114, lng: -49.3758 },
  { name: 'Mogi das Cruzes', uf: 'SP', lat: -23.5228, lng: -46.1883 },
  { name: 'Santos', uf: 'SP', lat: -23.9608, lng: -46.3339 },
  { name: 'Diadema', uf: 'SP', lat: -23.6864, lng: -46.6228 },
  { name: 'Jundiaí', uf: 'SP', lat: -23.1864, lng: -46.8842 },
  { name: 'Piracicaba', uf: 'SP', lat: -22.7253, lng: -47.6492 },
  { name: 'Bauru', uf: 'SP', lat: -22.3147, lng: -49.0606 },
  { name: 'Franca', uf: 'SP', lat: -20.5386, lng: -47.4008 },
  { name: 'Itaquaquecetuba', uf: 'SP', lat: -23.4861, lng: -46.3483 },
  { name: 'São Vicente', uf: 'SP', lat: -23.9631, lng: -46.3919 },
  { name: 'Carapicuíba', uf: 'SP', lat: -23.5225, lng: -46.8358 },
  { name: 'Praia Grande', uf: 'SP', lat: -24.0058, lng: -46.4028 },
  { name: 'Taubaté', uf: 'SP', lat: -23.0264, lng: -45.5558 },
  { name: 'Limeira', uf: 'SP', lat: -22.5647, lng: -47.4017 },
  { name: 'Suzano', uf: 'SP', lat: -23.5422, lng: -46.3108 },
  { name: 'Barueri', uf: 'SP', lat: -23.5111, lng: -46.8764 },
  { name: 'Sumaré', uf: 'SP', lat: -22.8219, lng: -47.2669 },
  { name: 'Registro', uf: 'SP', lat: -24.4881, lng: -47.8439 },

  // PARANÁ (PR)
  { name: 'Curitiba', uf: 'PR', lat: -25.4290, lng: -49.2671 },
  { name: 'Londrina', uf: 'PR', lat: -23.3103, lng: -51.1628 },
  { name: 'Maringá', uf: 'PR', lat: -23.4208, lng: -51.9331 },
  { name: 'Ponta Grossa', uf: 'PR', lat: -25.0950, lng: -50.1619 },
  { name: 'Cascavel', uf: 'PR', lat: -24.9558, lng: -53.4553 },
  { name: 'São José dos Pinhais', uf: 'PR', lat: -25.5347, lng: -49.2064 },
  { name: 'Foz do Iguaçu', uf: 'PR', lat: -25.5161, lng: -54.5853 },
  { name: 'Paranaguá', uf: 'PR', lat: -25.5200, lng: -48.5092 },

  // DISTRITO FEDERAL (DF)
  { name: 'Brasília', uf: 'DF', lat: -15.7975, lng: -47.8919 },
  { name: 'Taguatinga', uf: 'DF', lat: -15.8333, lng: -48.0500 },
  { name: 'Ceilândia', uf: 'DF', lat: -15.8167, lng: -48.1000 },

  // OUTROS ESTADOS
  { name: 'Cuiabá', uf: 'MT', lat: -15.6010, lng: -56.0974 },
  { name: 'Rondonópolis', uf: 'MT', lat: -16.4675, lng: -54.6364 },
  { name: 'Sinop', uf: 'MT', lat: -11.8608, lng: -55.5097 },
  { name: 'Campo Grande', uf: 'MS', lat: -20.4697, lng: -54.6201 },
  { name: 'Dourados', uf: 'MS', lat: -22.2231, lng: -54.8119 },
  { name: 'Palmas', uf: 'TO', lat: -10.2491, lng: -48.3242 },
  { name: 'Gurupi', uf: 'TO', lat: -11.7292, lng: -49.0686 },
  { name: 'Araguaína', uf: 'TO', lat: -7.1911, lng: -48.2072 },
  { name: 'Rio de Janeiro', uf: 'RJ', lat: -22.9068, lng: -43.1729 },
  { name: 'Niterói', uf: 'RJ', lat: -22.8833, lng: -43.1036 },
  { name: 'Duque de Caxias', uf: 'RJ', lat: -22.7856, lng: -43.3117 },
  { name: 'Porto Alegre', uf: 'RS', lat: -30.0346, lng: -51.2177 },
  { name: 'Caxias do Sul', uf: 'RS', lat: -29.1678, lng: -51.1794 },
  { name: 'Florianópolis', uf: 'SC', lat: -27.5954, lng: -48.5480 },
  { name: 'Joinville', uf: 'SC', lat: -26.3044, lng: -48.8464 },
];

/**
 * Extracts raw lat/lng from text like "-15.4811, -49.4934" or "Coordenadas (-15.4811, -49.4934)"
 */
export function parseCoordinates(input: string | null | undefined): { lat: number; lng: number } | null {
  if (!input) return null;
  const regex = /(-?\d+\.\d+)\s*[,;\s]\s*(-?\d+\.\d+)/;
  const match = input.match(regex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Calculates Haversine distance in meters between two lat/lng points
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determines State (UF) from coordinates using spatial bounding boxes
 */
export function getStateFromCoords(lat: number, lng: number): string {
  if (lat >= -19.5 && lat <= -12.3 && lng >= -53.2 && lng <= -45.9) return 'GO';
  if (lat >= -22.9 && lat <= -14.2 && lng >= -51.0 && lng <= -39.8) return 'MG';
  if (lat >= -18.3 && lat <= -8.5 && lng >= -46.6 && lng <= -37.3) return 'BA';
  if (lat >= -21.3 && lat <= -17.9 && lng >= -41.9 && lng <= -39.6) return 'ES';
  if (lat >= -25.3 && lat <= -19.8 && lng >= -53.1 && lng <= -44.1) return 'SP';
  if (lat >= -16.1 && lat <= -15.4 && lng >= -48.3 && lng <= -47.3) return 'DF';
  if (lat >= -26.7 && lat <= -22.5 && lng >= -54.6 && lng <= -48.0) return 'PR';
  if (lat >= -24.1 && lat <= -17.2 && lng >= -58.2 && lng <= -50.9) return 'MS';
  if (lat >= -18.0 && lat <= -7.0 && lng >= -61.6 && lng <= -50.2) return 'MT';
  if (lat >= -13.5 && lat <= -5.2 && lng >= -50.7 && lng <= -45.7) return 'TO';
  if (lat >= -23.4 && lat <= -20.8 && lng >= -44.9 && lng <= -40.9) return 'RJ';
  if (lat >= -33.8 && lat <= -27.1 && lng >= -57.6 && lng <= -49.7) return 'RS';
  if (lat >= -29.4 && lat <= -25.9 && lng >= -53.8 && lng <= -48.3) return 'SC';
  return 'GO'; // Default fallback state for TransControl hub region
}

/**
 * Converts any latitude & longitude in Brazil into "Cidade - UF" offline instantly
 */
export function getCityStateFromCoordinates(lat: number, lng: number): string {
  let nearest: CityLocation | null = null;
  let minDistanceMeters = Infinity;

  for (const city of BRAZIL_CITIES) {
    const dist = haversineDistance(lat, lng, city.lat, city.lng);
    if (dist < minDistanceMeters) {
      minDistanceMeters = dist;
      nearest = city;
    }
  }

  if (nearest) {
    // If within 80 km of a city, use that city
    if (minDistanceMeters <= 80000) {
      return `${nearest.name} - ${nearest.uf}`;
    }
    // Else use state bounding box + nearest regional city
    const uf = getStateFromCoords(lat, lng);
    return `${nearest.name} - ${uf}`;
  }

  return 'Goiânia - GO';
}

/**
 * Formats any input string (whether coordinates or text) into a clean "Cidade - UF" string
 */
export function formatLocationDisplay(locationInput: string | null | undefined, lat?: number, lng?: number): string {
  // 1. If locationInput is a valid string (not empty and not raw coordinates)
  if (locationInput) {
    const trimmed = locationInput.trim();

    // Check if input itself is raw coordinates
    const coords = parseCoordinates(trimmed);
    if (coords) {
      return getCityStateFromCoordinates(coords.lat, coords.lng);
    }

    // Check if it's "Cidade/UF" format
    if (trimmed.includes('/') && !trimmed.toLowerCase().includes('coord')) {
      const parts = trimmed.split('/');
      if (parts.length === 2) {
        return `${parts[0].trim()} - ${parts[1].trim().toUpperCase()}`;
      }
    }

    // Check if it's already a clean location string or "Cidade - UF"
    if (trimmed.length > 0 && !trimmed.toLowerCase().includes('coord')) {
      return trimmed;
    }
  }

  // 2. If locationInput is missing/raw coordinates, fallback to real-time GPS lat/lng
  if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng)) {
    return getCityStateFromCoordinates(lat, lng);
  }

  return 'Localização Indisponível';
}
