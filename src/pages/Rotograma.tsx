import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { 
  Plus, 
  Search, 
  Calendar, 
  MapPin, 
  ShieldAlert, 
  Truck, 
  FileText, 
  Trash2, 
  AlertTriangle, 
  Compass, 
  Clock, 
  Activity, 
  ShieldCheck, 
  User, 
  Wrench, 
  Info, 
  Volume2, 
  PhoneCall, 
  Printer, 
  Layers, 
  Scale, 
  AlertOctagon,
  CornerDownRight,
  Radio,
  Fuel,
  Map,
  X
} from 'lucide-react';
import { Rotograma, RotogramPonto, RotogramEixo } from '../types';
import { BRAZIL_CITIES, parseCoordinates } from '../utils/geocoding';

export default function RotogramaPage() {
  const [rotogramas, setRotogramas] = useState<Rotograma[]>([]);
  const [activeRotograma, setActiveRotograma] = useState<Rotograma | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'view'>('list');

  // Form states
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [tipoVeiculo, setTipoVeiculo] = useState('carreta_3eixos');
  const [tipoCarga, setTipoCarga] = useState('carga_seca');
  const [dataSaida, setDataSaida] = useState('');
  const [pesoCarga, setPesoCarga] = useState('');
  const [taraVeiculo, setTaraVeiculo] = useState('');
  const [configuracaoEixos, setConfiguracaoEixos] = useState('');
  const [rodagemEixos, setRodagemEixos] = useState('dupla');
  const [restricoes, setRestricoes] = useState('');
  const [historicoRiscos, setHistoricoRiscos] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Loading tip cycle
  const [loadingTip, setLoadingTip] = useState(0);
  const tips = [
    'Analisando histórico de sinistros e roubos na rodovia...',
    'Calculando limites de peso por eixo de acordo com resoluções CONTRAN 210/882...',
    'Mapeando geocercas, pontos de parada segura e postos da Polícia Rodoviária Federal...',
    'Identificando áreas de sombra e perda de sinal de telemetria no trajeto...',
    'Avaliando pedágios e calculando quantidade de eixos tarifáveis...'
  ];

  useEffect(() => {
    fetchRotogramas();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (generating) {
      interval = setInterval(() => {
        setLoadingTip((prev) => (prev + 1) % tips.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [generating]);

  const fetchRotogramas = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/rotogramas');
      if (response.ok) {
        const data = await response.json();
        setRotogramas(data);
      }
    } catch (err) {
      console.error('Erro ao buscar rotogramas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origem.trim() || !destino.trim()) return;

    setGenerating(true);
    setGenerationError(null);
    setLoadingTip(0);

    // Default configuration recommendations for calculation
    let targetConfig = configuracaoEixos;
    if (!targetConfig) {
      if (tipoVeiculo === 'carreta_3eixos') targetConfig = 'Cavalo Mecânico 4x2 + Semi-reboque de 3 eixos';
      else if (tipoVeiculo === 'bitrem_7eixos') targetConfig = 'Cavalo Mecânico 6x4 + Bitrem de 7 eixos';
      else if (tipoVeiculo === 'bitrem_9eixos') targetConfig = 'Cavalo Mecânico 6x4 + Bitrem de 9 eixos';
      else if (tipoVeiculo === 'truck_3eixos') targetConfig = 'Caminhão Rígido 6x2 (Truck)';
      else targetConfig = 'Veículo de carga padrão';
    }

    try {
      const res = await fetch('/api/rotogramas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origem,
          destino,
          tipoVeiculo,
          tipoCarga,
          dataSaida,
          pesoCarga: pesoCarga ? Number(pesoCarga) : undefined,
          taraVeiculo: taraVeiculo ? Number(taraVeiculo) : undefined,
          configuracaoEixos: targetConfig,
          rodagemEixos,
          restricoes,
          historicoRiscos
        })
      });

      if (!res.ok) {
        throw new Error('Falha na resposta da IA. Verifique as chaves ou tente novamente.');
      }

      const generatedData: Rotograma = await res.json();
      
      // Save to server
      const saveRes = await fetch('/api/rotogramas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...generatedData,
          tipo_veiculo: tipoVeiculo,
          tipo_carga: tipoCarga,
          data_saida: dataSaida || new Date().toISOString().split('T')[0]
        })
      });

      if (saveRes.ok) {
        const savedRotograma = await saveRes.json();
        setRotogramas(prev => [savedRotograma, ...prev]);
        setActiveRotograma(savedRotograma);
        setViewMode('view');
      } else {
        throw new Error('Erro ao salvar o rotograma gerado no banco de dados.');
      }
    } catch (err: any) {
      setGenerationError(err.message || 'Ocorreu um erro ao processar a geração viária.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja realmente excluir este rotograma?')) return;

    try {
      const res = await fetch(`/api/rotogramas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRotogramas(prev => prev.filter(r => r.id !== id));
        if (activeRotograma?.id === id) {
          setActiveRotograma(null);
          setViewMode('list');
        }
      }
    } catch (err) {
      console.error('Erro ao excluir rotograma:', err);
    }
  };

  const handleTransmitVoice = async (text: string) => {
    try {
      // Direct call to standard announcement voice alerts system
      const res = await fetch('/api/voice/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      if (res.ok) {
        alert('Resumo viário transmitido via aviso de voz com sucesso para toda a central de monitoramento!');
      } else {
        throw new Error('Falha no envio da transmissão');
      }
    } catch (err: any) {
      alert('Erro ao enviar transmissão de rádio: ' + err.message);
    }
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    if (!address) return null;
    
    // 1. Try to parse raw coordinates first
    const directCoords = parseCoordinates(address);
    if (directCoords) return directCoords;

    // 2. Try offline BRAZIL_CITIES match
    const norm = address.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    for (const city of BRAZIL_CITIES) {
      const cityNameNorm = city.name.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      
      if (norm === cityNameNorm || norm.includes(cityNameNorm)) {
        return { lat: city.lat, lng: city.lng };
      }
    }

    // 3. Fallback to Nominatim API through server proxy
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
          return { lat: data.lat, lng: data.lng };
        }
      }
    } catch (err) {
      console.warn("Server geocode failed for:", address, err);
    }

    return null;
  };

  const getStaticMapBase64 = async (rotograma: Rotograma): Promise<string | null> => {
    const isGoogleActive = typeof window !== 'undefined' ? localStorage.getItem('google_maps_active') === 'true' : false;

    // 1. Try Google Static Map first if activated
    if (isGoogleActive) {
      try {
        const savedKey = typeof window !== 'undefined' ? localStorage.getItem('google_maps_api_key') : '';
        const mapsKey = savedKey || 'AIzaSyCoM-MbWKq5gsf0pWgcc6Cj4BShCslqXcE';
        
        let markersQuery = `&markers=color:0x10b981%7Clabel:A%7C${encodeURIComponent(rotograma.origem)}&markers=color:0xef4444%7Clabel:B%7C${encodeURIComponent(rotograma.destino)}`;
        
        // Add up to 3 intermediate risk/alert points as markers if they have a location
        if (rotograma.pontos && rotograma.pontos.length > 0) {
          const mapPoints = rotograma.pontos.filter(p => p.localizacao).slice(0, 3);
          mapPoints.forEach((p, index) => {
            markersQuery += `&markers=color:0xf59e0b%7Clabel:${index + 1}%7C${encodeURIComponent(p.localizacao)}`;
          });
        }

        const url = `https://maps.googleapis.com/maps/api/staticmap?size=600x300&scale=2&maptype=roadmap${markersQuery}&path=color:0x0ea5e9%7Cweight:5%7C${encodeURIComponent(rotograma.origem)}%7C${encodeURIComponent(rotograma.destino)}&key=${mapsKey}`;
        
        const response = await fetch(`/api/map-proxy?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.dataUrl) {
            console.log("Successfully fetched Google Static Map image");
            return data.dataUrl;
          }
        } else {
          console.warn(`Google Static Map proxy returned status ${response.status}. Trying OpenStreetMap fallback...`);
        }
      } catch (googleErr) {
        console.warn("Failed to retrieve Google static map. Trying OpenStreetMap fallback...", googleErr);
      }
    }

    // 2. Fallback to free keyless OpenStreetMap tile rendering onto canvas!
    try {
      const originCoords = await geocodeAddress(rotograma.origem);
      const destCoords = await geocodeAddress(rotograma.destino);
      
      if (!originCoords || !destCoords) {
        console.warn("Could not geocode origin or destination coordinates for OpenStreetMap fallback.");
        return null;
      }

      // Geocode all intermediate points too
      const activePoints = await Promise.all(
        (rotograma.pontos || []).map(async p => {
          const coords = await geocodeAddress(p.localizacao);
          return coords ? { ...p, coords } : null;
        })
      );
      const validActivePoints = activePoints.filter(Boolean) as (RotogramPonto & { coords: { lat: number; lng: number } })[];

      // Gather all coordinates to calculate map boundaries
      const allCoords = [originCoords, ...validActivePoints.map(p => p.coords), destCoords];
      
      const lats = allCoords.map(c => c.lat);
      const lngs = allCoords.map(c => c.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      // Projection helpers
      const lngToTileX = (lng: number, zoom: number): number => {
        return ((lng + 180) / 360) * Math.pow(2, zoom);
      };
      const latToTileY = (lat: number, zoom: number): number => {
        const latRad = (lat * Math.PI) / 180;
        return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
      };

      const width = 600;
      const height = 300;
      const padding = 50;

      // Determine optimal zoom level
      let z = 12;
      for (let testZ = 18; testZ >= 3; testZ--) {
        let fits = true;
        const cx = lngToTileX(centerLng, testZ) * 256;
        const cy = latToTileY(centerLat, testZ) * 256;
        
        for (const c of allCoords) {
          const px = lngToTileX(c.lng, testZ) * 256;
          const py = latToTileY(c.lat, testZ) * 256;
          if (Math.abs(px - cx) > (width / 2 - padding) || Math.abs(py - cy) > (height / 2 - padding)) {
            fits = false;
            break;
          }
        }
        if (fits) {
          z = testZ;
          break;
        }
      }

      // Calculate pixel bounds on the global Mercator grid
      const cx = lngToTileX(centerLng, z) * 256;
      const cy = latToTileY(centerLat, z) * 256;
      const minX = cx - width / 2;
      const maxX = cx + width / 2;
      const minY = cy - height / 2;
      const maxY = cy + height / 2;

      const startTileX = Math.floor(minX / 256);
      const endTileX = Math.floor(maxX / 256);
      const startTileY = Math.floor(minY / 256);
      const endTileY = Math.floor(maxY / 256);

      // Collect tiles to fetch
      const tilesToLoad: { tx: number; ty: number; url: string }[] = [];
      const maxTile = Math.pow(2, z);
      for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
          const safeTx = (tx % maxTile + maxTile) % maxTile;
          const safeTy = Math.max(0, Math.min(maxTile - 1, ty));
          tilesToLoad.push({
            tx,
            ty,
            url: `/api/map-proxy?url=${encodeURIComponent(`https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${safeTx}/${safeTy}.png`)}`
          });
        }
      }

      // Load all tiles
      const loadedTiles = await Promise.all(
        tilesToLoad.map(tile => {
          return new Promise<{ tx: number; ty: number; img: HTMLImageElement | null }>(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve({ tx: tile.tx, ty: tile.ty, img });
            img.onerror = () => resolve({ tx: tile.tx, ty: tile.ty, img: null });
            img.src = tile.url;
          });
        })
      );

      // Create an offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Draw loaded tiles
      for (const { tx, ty, img } of loadedTiles) {
        if (img) {
          const drawX = tx * 256 - minX;
          const drawY = ty * 256 - minY;
          ctx.drawImage(img, drawX, drawY, 256, 256);
        }
      }

      // Try to fetch precise road route from OSRM to get highway curves like Google Maps
      let routePoints: { lat: number; lng: number }[] = [];
      let osrmDistanceKm = 0;
      let osrmDurationHours = 0;
      try {
        const coordsQuery = [
          originCoords,
          ...validActivePoints.map(p => p.coords),
          destCoords
        ].map(c => `${c.lng},${c.lat}`).join(';');
        
        const osrmUrl = `https://router.projectosrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`;
        console.log("Fetching road route from OSRM:", osrmUrl);
        
        const osrmRes = await fetch(osrmUrl);
        if (osrmRes.ok) {
          const osrmData = await osrmRes.json();
          if (osrmData.routes && osrmData.routes[0]) {
            const routeObj = osrmData.routes[0];
            if (routeObj.geometry && routeObj.geometry.coordinates) {
              routePoints = routeObj.geometry.coordinates.map((coord: any) => ({
                lat: coord[1],
                lng: coord[0]
              }));
              console.log(`OSRM successfully returned ${routePoints.length} road path coordinates.`);
            }
            if (routeObj.distance) osrmDistanceKm = routeObj.distance / 1000;
            if (routeObj.duration) osrmDurationHours = routeObj.duration / 3600;
          }
        }
      } catch (osrmErr) {
        console.warn("Failed to fetch road path from OSRM, falling back to straight lines:", osrmErr);
      }

      // Fallback coordinates if OSRM is unavailable or failed
      if (routePoints.length === 0) {
        routePoints = [originCoords, ...validActivePoints.map(p => p.coords), destCoords];
        osrmDistanceKm = rotograma.distancia_km || 0;
        osrmDurationHours = osrmDistanceKm / 80; // approximate at 80 km/h
      }

      // Helper to convert lat/lng to canvas local pixel coordinate
      const getPixelCoords = (lat: number, lng: number) => {
        const px = lngToTileX(lng, z) * 256;
        const py = latToTileY(lat, z) * 256;
        return {
          x: px - minX,
          y: py - minY
        };
      };

      // Draw the Route Path Line (Semi-transparent background route line for glow effect)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)'; // Beautiful royal blue/indigo semi-transparent
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const firstPixel = getPixelCoords(routePoints[0].lat, routePoints[0].lng);
      ctx.moveTo(firstPixel.x, firstPixel.y);
      for (let i = 1; i < routePoints.length; i++) {
        const pixel = getPixelCoords(routePoints[i].lat, routePoints[i].lng);
        ctx.lineTo(pixel.x, pixel.y);
      }
      ctx.stroke();

      // Draw the Route Path Line (Solid inner route line)
      ctx.beginPath();
      ctx.strokeStyle = '#1d4ed8'; // Darker blue solid like Google Maps
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(firstPixel.x, firstPixel.y);
      for (let i = 1; i < routePoints.length; i++) {
        const pixel = getPixelCoords(routePoints[i].lat, routePoints[i].lng);
        ctx.lineTo(pixel.x, pixel.y);
      }
      ctx.stroke();

      // Helper to clean address strings into short city labels
      const getCleanCityLabel = (address: string): string => {
        if (!address) return '';
        const parts = address.split(/[,|-]/);
        if (parts.length > 0) {
          const mainPart = parts[0].trim();
          // If the first part is just a street number, try the second part
          if (/^\d+$/.test(mainPart) && parts.length > 1) {
            return parts[1].trim();
          }
          return mainPart;
        }
        return address;
      };

      // Helper to draw text with white halo for ultra crisp visibility
      const drawTextWithHalo = (text: string, x: number, y: number, fontSize: number = 9, align: 'left' | 'center' | 'right' = 'left') => {
        ctx.save();
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        
        // Draw white outer stroke
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
        
        // Draw actual text in solid dark blue/gray
        ctx.fillStyle = '#1e293b';
        ctx.fillText(text, x, y);
        ctx.restore();
      };

      // Draw Markers
      const drawMarker = (x: number, y: number, label: string, color: string) => {
        // Draw drop shadow
        ctx.beginPath();
        ctx.arc(x, y + 2, 9, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fill();

        // Draw white outer circle
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Draw inner colored circle
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // Draw text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y);
      };

      // Helper to draw a rounded rectangle
      const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };

      // Draw Floating Info Card (like the Google Maps routing box in the user's reference)
      if (osrmDistanceKm > 0) {
        ctx.save();
        const infoX = 15;
        const infoY = 15;
        const infoW = 100;
        const infoH = 38;

        // Draw rounded box shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;

        // Draw rounded rectangle
        ctx.fillStyle = '#ffffff';
        drawRoundRect(infoX, infoY, infoW, infoH, 5);
        ctx.fill();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#cbd5e1'; // slate-300
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw driving emoji 🚗
        ctx.font = '11px sans-serif';
        ctx.fillText('🚗', infoX + 8, infoY + 20);

        // Calculate and format duration
        const hours = Math.floor(osrmDurationHours);
        const mins = Math.round((osrmDurationHours - hours) * 60);
        const durationText = hours > 0 ? `${hours} h ${mins} m` : `${mins} min`;
        const distanceText = `${osrmDistanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km`;

        // Draw duration (bold)
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.fillText(durationText, infoX + 24, infoY + 14);

        // Draw distance
        ctx.font = '8px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(distanceText, infoX + 24, infoY + 26);

        ctx.restore();
      }

      // Draw intermediate risk points first
      validActivePoints.forEach((p, index) => {
        const pixel = getPixelCoords(p.coords.lat, p.coords.lng);
        drawMarker(pixel.x, pixel.y, String(index + 1), '#f59e0b'); // amber-500
        // Draw city name with white halo
        drawTextWithHalo(getCleanCityLabel(p.localizacao), pixel.x + 12, pixel.y);
      });

      // Draw origin (A) and destination (B) on top
      const startPixel = getPixelCoords(originCoords.lat, originCoords.lng);
      const endPixel = getPixelCoords(destCoords.lat, destCoords.lng);
      
      drawMarker(startPixel.x, startPixel.y, 'A', '#10b981'); // emerald-500
      drawTextWithHalo(getCleanCityLabel(rotograma.origem), startPixel.x + 12, startPixel.y);

      drawMarker(endPixel.x, endPixel.y, 'B', '#ef4444'); // red-500
      drawTextWithHalo(getCleanCityLabel(rotograma.destino), endPixel.x + 12, endPixel.y);

      // Export canvas to dataUrl
      const dataUrl = canvas.toDataURL('image/png');
      console.log("Successfully generated high-fidelity client-side fallback OpenStreetMap tile canvas map!");
      return dataUrl;
    } catch (fallbackErr) {
      console.error("Failed to generate client-side fallback OpenStreetMap tile canvas map:", fallbackErr);
    }

    return null;
  };

  const generateRotogramaPDF = async (rotograma: Rotograma) => {
    try {
      setPdfLoading(true);
      
      // Fetch map image
      const mapBase64 = await getStaticMapBase64(rotograma);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      let pageNum = 1;
      let y = 15;

      const drawFooter = (pNum: number) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.setDrawColor(241, 245, 249);
        doc.line(15, 280, 195, 280);
        doc.text(`Relatório de Rotograma de Risco • Gerado em ${new Date().toLocaleString('pt-BR')}`, 15, 285);
        doc.text(`Página ${pNum}`, 195, 285, { align: 'right' });
      };

      const checkNewPage = (neededHeight: number) => {
        if (y + neededHeight > 270) {
          drawFooter(pageNum);
          doc.addPage();
          pageNum++;
          y = 15;
          
          // Draw header on new page
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184); // slate-400
          doc.text(`ROTOGRAMA OPERACIONAL: ${rotograma.origem} -> ${rotograma.destino}`, 15, 12);
          doc.setDrawColor(226, 232, 240);
          doc.line(15, 14, 195, 14);
          y = 20;
        }
      };

      // --- PAGE 1: HEADER & OVERVIEW ---
      // 1. Corporate header bar (Dark Slate Blue)
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(15, y, 180, 24, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("PLANO DE VIAGEM OPERACIONAL & ROTOGRAMA DE RISCO", 20, y + 9);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(186, 230, 253); // sky-200
      doc.text("Monitoramento Viário e Distribuição de Eixos - Lei da Balança", 20, y + 16);
      y += 24;

      // 2. Info Cards (Origem, Destino, Nivel de Risco)
      y += 6;
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(15, y, 180, 22, 'FD');

      // Labels & values
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("ORIGEM / DESTINO", 20, y + 6);
      doc.text("DATA DE VIAGEM", 110, y + 6);
      doc.text("RISCO GERAL", 155, y + 6);

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`${rotograma.origem} a ${rotograma.destino}`, 20, y + 14);
      
      doc.setFontSize(10);
      const dataFormatada = rotograma.data_saida 
        ? new Date(rotograma.data_saida).toLocaleDateString('pt-BR') 
        : new Date().toLocaleDateString('pt-BR');
      doc.text(dataFormatada, 110, y + 14);

      // Risk level indicator badge
      const rGeral = rotograma.nivel_risco_geral ? rotograma.nivel_risco_geral.toUpperCase() : 'MEDIO';
      if (rGeral === 'ALTO') {
        doc.setFillColor(239, 68, 68); // red-500
        doc.setTextColor(255, 255, 255);
      } else if (rGeral === 'MEDIO') {
        doc.setFillColor(245, 158, 11); // amber-500
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setFillColor(34, 197, 94); // green-500
        doc.setTextColor(255, 255, 255);
      }
      doc.rect(155, y + 9, 32, 7, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(rGeral, 171, y + 14, { align: 'center' });
      y += 22;

      // 3. Technical statistics (KPIs)
      y += 6;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      // Grid boxes
      const boxW = 42;
      const boxH = 15;
      const gaps = 4;
      
      const stats = [
        { label: 'DISTÂNCIA', val: `${rotograma.distancia_km} km` },
        { label: 'TEMPO ESTIMADO', val: `${rotograma.tempo_estimado_horas}h` },
        { label: 'VEÍCULO', val: rotograma.tipo_veiculo ? rotograma.tipo_veiculo.replace('_', ' ').toUpperCase() : 'CARRETA' },
        { label: 'CARGA', val: rotograma.tipo_carga ? rotograma.tipo_carga.replace('_', ' ').toUpperCase() : 'SECA' }
      ];

      stats.forEach((st, idx) => {
        const bx = 15 + idx * (boxW + gaps);
        doc.rect(bx, y, boxW, boxH, 'D');
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(st.label, bx + 4, y + 5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42); // slate-900
        let valText = st.val;
        if (valText.length > 18) valText = valText.substring(0, 16) + '...';
        doc.text(valText, bx + 4, y + 11);
      });
      y += 15;

      // 4. Strategic Resumo text
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("1. RESUMO ESTRATÉGICO DA ROTA", 15, y);
      y += 3;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85); // slate-700
      const splitResumo = doc.splitTextToSize(rotograma.resumo || 'Nenhum resumo disponível.', 180);
      doc.text(splitResumo, 15, y + 2);
      y += (splitResumo.length * 4) + 4;

      // 5. Motorista Speech box
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(203, 213, 225); // slate-300
      
      const motoristaText = rotograma.resumo_motorista || 'Atenção motorista: prossiga com atenção.';
      const splitSpeech = doc.splitTextToSize(`" ${motoristaText} "`, 172);
      const speechBoxH = (splitSpeech.length * 4) + 10;
      
      doc.rect(15, y, 180, speechBoxH, 'FD');
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text("INSTRUÇÕES AO MOTORISTA (RÁDIO VOCAL):", 19, y + 5);
      
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(splitSpeech, 19, y + 10);
      y += speechBoxH + 8;

      // 6. Google Maps Route Section
      if (mapBase64) {
        checkNewPage(88);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("2. MAPA OPERACIONAL E VISUALIZAÇÃO DA ROTA", 15, y);
        y += 4;
        
        doc.addImage(mapBase64, 'PNG', 15, y, 180, 75);
        
        // Styled border around map
        doc.setDrawColor(203, 213, 225);
        doc.rect(15, y, 180, 75, 'D');
        
        y += 75 + 8;
      } else {
        // High fidelity schematic fallback map
        checkNewPage(48);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("2. MAPA OPERACIONAL DA ROTA (ESQUEMÁTICO)", 15, y);
        y += 4;

        // Container card
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(15, y, 180, 35, 'FD');

        // Main path line
        doc.setDrawColor(14, 165, 233);
        doc.setLineWidth(1.5);
        doc.line(35, y + 17, 165, y + 17);
        doc.setLineWidth(0.2); // reset

        // Origin node
        doc.setFillColor(34, 197, 94);
        doc.setDrawColor(22, 163, 74);
        doc.circle(35, y + 17, 3, 'FD');
        
        // Destination node
        doc.setFillColor(239, 68, 68);
        doc.setDrawColor(220, 38, 38);
        doc.circle(165, y + 17, 3, 'FD');

        // Node labels
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(rotograma.origem, 35, y + 25, { align: 'center' });
        doc.text(rotograma.destino, 165, y + 25, { align: 'center' });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("PONTO DE ORIGEM (A)", 35, y + 11, { align: 'center' });
        doc.text("PONTO DE DESTINO (B)", 165, y + 11, { align: 'center' });

        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Distância calculada: ${rotograma.distancia_km} km • Rota direta`, 100, y + 15, { align: 'center' });

        y += 35 + 8;
      }

      // 7. Lei da balança overview
      checkNewPage(45);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("3. ANÁLISE DE PESO E LEI DA BALANÇA (CONTRAN)", 15, y);
      y += 4;

      const calc = rotograma.calculo_eixos;
      if (calc) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, y, 180, 28, 'FD');

        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("CONFIGURAÇÃO ESTIMADA DO CONJUNTO:", 19, y + 5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(calc.configuracao_veiculo || 'Não configurada', 19, y + 10);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("PESO DA CARGA (KG):", 19, y + 17);
        doc.text("TARA ESTIMADA (KG):", 65, y + 17);
        doc.text("PESO BRUTO TOTAL (KG):", 110, y + 17);
        doc.text("EIXOS TARIFÁVEIS:", 155, y + 17);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(calc.peso_carga_kg ? calc.peso_carga_kg.toLocaleString('pt-BR') : '0', 19, y + 22);
        doc.text(calc.tara_kg ? calc.tara_kg.toLocaleString('pt-BR') : '0', 65, y + 22);
        doc.text(calc.peso_bruto_total_kg ? calc.peso_bruto_total_kg.toLocaleString('pt-BR') : '0', 110, y + 22);
        doc.text(calc.eixos_tarifaveis_pedagio ? String(calc.eixos_tarifaveis_pedagio) : 'N/A', 155, y + 22);

        y += 28 + 4;
        
        const excesso = calc.excesso_total_kg || 0;
        doc.setFillColor(excesso > 0 ? 254 : 240, excesso > 0 ? 242 : 253, excesso > 0 ? 242 : 244);
        doc.setDrawColor(excesso > 0 ? 252 : 187, excesso > 0 ? 165 : 247, excesso > 0 ? 165 : 208);
        
        const alertMsg = calc.alerta || (excesso > 0 ? 'Excesso de peso detectado nos eixos.' : 'Pesagem dentro dos limites regulamentares.');
        const splitAlert = doc.splitTextToSize(alertMsg, 170);
        const alertBoxH = (splitAlert.length * 4) + 6;

        doc.rect(15, y, 180, alertBoxH, 'FD');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(excesso > 0 ? 185 : 21, excesso > 0 ? 28 : 128, excesso > 0 ? 28 : 61);
        doc.text(splitAlert, 19, y + 4.5);
        
        y += alertBoxH + 8;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Nenhum cálculo de eixos disponível para este plano.", 15, y + 2);
        y += 8;
      }

      // --- PAGE 2 ---
      checkNewPage(45);

      if (calc && calc.eixos && calc.eixos.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("4. DETALHAMENTO DE PESO POR CONJUNTO DE EIXOS", 15, y);
        y += 4;

        doc.setFillColor(241, 245, 249);
        doc.rect(15, y, 180, 7, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text("CONJUNTO / IDENTIFICAÇÃO", 18, y + 4.5);
        doc.text("TIPO", 90, y + 4.5);
        doc.text("PESO ESTIMADO", 122, y + 4.5);
        doc.text("LIMITE LEGAL", 152, y + 4.5);
        doc.text("STATUS", 177, y + 4.5);
        y += 7;

        calc.eixos.forEach((eixo) => {
          checkNewPage(10);
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          
          let ident = eixo.identificacao || 'Eixo';
          if (ident.length > 38) ident = ident.substring(0, 36) + '...';
          doc.text(ident, 18, y + 5);
          
          doc.text(eixo.tipo ? eixo.tipo.toUpperCase() : 'SIMPLES', 90, y + 5);
          doc.text(`${eixo.peso_estimado_kg ? eixo.peso_estimado_kg.toLocaleString('pt-BR') : '0'} kg`, 122, y + 5);
          doc.text(`${eixo.limite_legal_kg ? eixo.limite_legal_kg.toLocaleString('pt-BR') : '0'} kg`, 152, y + 5);
          
          const isExcedido = eixo.status === 'excedido' || (eixo.peso_estimado_kg > eixo.limite_legal_kg);
          if (isExcedido) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(220, 38, 38);
            doc.text("EXCEDIDO", 177, y + 5);
          } else {
            doc.setTextColor(21, 128, 61);
            doc.text("OK", 177, y + 5);
          }
          
          doc.setDrawColor(241, 245, 249);
          doc.line(15, y + 7, 195, y + 7);
          y += 7;
        });
        y += 6;
      }

      // 8. RISK POINTS OF ROTOGRAMA
      checkNewPage(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("5. ROTOGRAMA DE RISCO E PONTOS DE ATENÇÃO NA VIA", 15, y);
      y += 4;

      if (rotograma.pontos && rotograma.pontos.length > 0) {
        doc.setFillColor(15, 23, 42);
        doc.rect(15, y, 180, 7, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text("KM", 18, y + 4.5);
        doc.text("TIPO / CATEGORIA", 32, y + 4.5);
        doc.text("LOCALIZAÇÃO", 65, y + 4.5);
        doc.text("DESCRIÇÃO DO RISCO & INSTRUÇÃO", 112, y + 4.5);
        doc.text("VEL. RECOM.", 175, y + 4.5);
        y += 7;

        const sortedPoints = rotograma.pontos ? [...rotograma.pontos].sort((a, b) => a.ordem - b.ordem) : [];
        sortedPoints.forEach((ponto) => {
          const descrText = ponto.descricao || '';
          const instrText = ponto.instrucao ? `Dir.: ${ponto.instrucao}` : '';
          const fullText = descrText + (instrText ? '\n' + instrText : '');
          
          const splitText = doc.splitTextToSize(fullText, 60);
          const neededRowHeight = Math.max(10, (splitText.length * 3.5) + 4);

          checkNewPage(neededRowHeight);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text(`KM ${ponto.km_aproximado}`, 18, y + 5);

          let catLabel = ponto.categoria ? ponto.categoria.toUpperCase() : 'RISCO';
          if (catLabel === 'ROUBO' || catLabel === 'PERIGO' || catLabel === 'RISCO') {
            doc.setFillColor(254, 242, 242);
            doc.setDrawColor(252, 165, 165);
            doc.rect(32, y + 2, 28, 5, 'FD');
            doc.setFontSize(6.5);
            doc.setTextColor(220, 38, 38);
            doc.text(catLabel, 46, y + 5.5, { align: 'center' });
          } else if (catLabel === 'APOIO' || catLabel === 'POSTO') {
            doc.setFillColor(240, 253, 244);
            doc.setDrawColor(187, 247, 208);
            doc.rect(32, y + 2, 28, 5, 'FD');
            doc.setFontSize(6.5);
            doc.setTextColor(21, 128, 61);
            doc.text(catLabel, 46, y + 5.5, { align: 'center' });
          } else {
            doc.setFillColor(240, 249, 255);
            doc.setDrawColor(186, 230, 253);
            doc.rect(32, y + 2, 28, 5, 'FD');
            doc.setFontSize(6.5);
            doc.setTextColor(2, 132, 199);
            doc.text(catLabel, 46, y + 5.5, { align: 'center' });
          }

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          
          let loc = ponto.localizacao || 'Trecho';
          if (loc.length > 25) loc = loc.substring(0, 23) + '...';
          doc.text(loc, 65, y + 5);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(71, 85, 105);
          
          doc.text(splitText, 112, y + 4.5);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(220, 38, 38);
          doc.text(ponto.velocidade_maxima_recomendada ? `${ponto.velocidade_maxima_recomendada} km/h` : 'N/A', 175, y + 5);

          doc.setDrawColor(241, 245, 249);
          doc.line(15, y + neededRowHeight, 195, y + neededRowHeight);
          
          y += neededRowHeight;
        });
        y += 5;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Nenhum ponto mapeado neste rotograma.", 15, y + 2);
        y += 8;
      }

      // 9. EMERGENCY CONTACTS
      checkNewPage(35);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("6. TELEFONES E CONTATOS ÚTEIS DE EMERGÊNCIA", 15, y);
      y += 4;

      const contatos = rotograma.contatos_emergencia;
      if (contatos) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(15, y, 180, 20, 'FD');

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("GERENCIADORA DE RISCO:", 19, y + 5);
        doc.text("POLÍCIA RODOVIÁRIA FEDERAL:", 78, y + 5);
        doc.text("RESGATE / AMBULÂNCIA:", 135, y + 5);
        
        doc.text("CENTRAL DA TRANSPORTADORA:", 19, y + 14);
        doc.text("SERVIÇO DE REBOQUE / GUINCHO:", 78, y + 14);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(contatos.gerenciadora_risco || 'Buonny (0800 771 9000)', 19, y + 9);
        doc.text(contatos.prf || 'PRF (191)', 78, y + 9);
        doc.text(contatos.resgate || 'Ambulância (192)', 135, y + 9);
        
        doc.text(contatos.transportadora || 'Central Monitoramento S/A', 19, y + 18);
        doc.text(contatos.guincho || 'Auto Socorro 24h', 78, y + 18);

        y += 20;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Nenhum contato cadastrado.", 15, y + 2);
        y += 8;
      }

      drawFooter(pageNum);

      const filename = `Rotograma_Risco_${rotograma.origem}_a_${rotograma.destino}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);

      try {
        const pdfBlob = doc.output('blob');
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
        console.warn('Backup direct download failed:', dlErr);
      }
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Ocorreu um erro ao tentar gerar o PDF do relatório.");
    } finally {
      setPdfLoading(false);
    }
  };

  const filteredRotogramas = rotogramas.filter(r => 
    r.origem.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.destino.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.nivel_risco_geral.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRiskBadgeColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'baixo':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'medio':
      case 'médio':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'alto':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const getPointCategoryStyles = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'risco':
        return {
          icon: AlertTriangle,
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          label: 'Ponto de Risco'
        };
      case 'apoio':
        return {
          icon: Fuel,
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          label: 'Ponto de Apoio'
        };
      case 'infraestrutura':
        return {
          icon: Wrench,
          bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          label: 'Infraestrutura'
        };
      case 'sinal':
        return {
          icon: Radio,
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          label: 'Sombra de Sinal'
        };
      case 'roubo':
        return {
          icon: ShieldAlert,
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          label: 'Alto Risco de Roubo'
        };
      default:
        return {
          icon: Info,
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
          label: 'Informação'
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0e1a] overflow-x-hidden" id="rotograma-page-container">
      {/* Top Banner / Header */}
      <div className="px-6 py-5 bg-[#0f172a]/90 border-b border-slate-800/60 backdrop-blur flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 px-2.5 rounded-full text-xs font-bold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Garantia de Viagem
            </span>
            <span className="p-1 px-2.5 rounded-full text-xs font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Lei da Balança
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Shield className="text-sky-400" size={24} /> Rotogramas de Segurança Viária
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gere mapas de risco operacional detalhados e analise a distribuição de peso por eixos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {viewMode !== 'list' && (
            <button 
              onClick={() => { setViewMode('list'); setActiveRotograma(null); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-lg border border-slate-700 transition flex items-center gap-2"
              id="btn-back-list"
            >
              Voltar para Lista
            </button>
          )}
          {viewMode === 'list' && (
            <button 
              onClick={() => setViewMode('create')}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm rounded-lg shadow-lg shadow-sky-600/15 border border-sky-500/30 transition flex items-center gap-2"
              id="btn-create-new-rotogram"
            >
              <Plus size={16} /> Novo Rotograma
            </button>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* VIEW MODE: LIST OF ROTOGRAMAS */}
        {viewMode === 'list' && (
          <div className="lg:col-span-3 flex flex-col gap-6">
            {/* Search and Filters */}
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar rotogramas por origem ou destino..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 transition"
                  id="rotogram-search-input"
                />
              </div>
              <span className="text-xs text-slate-400 font-semibold bg-slate-900 border border-slate-800/80 px-3 py-1.5 rounded-lg">
                Total Cadastrado: <strong className="text-white">{filteredRotogramas.length}</strong>
              </span>
            </div>

            {/* List Cards Grid */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-semibold">Buscando rotogramas salvos...</p>
              </div>
            ) : filteredRotogramas.length === 0 ? (
              <div className="bg-[#0f172a]/40 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center py-24 px-6 text-center shadow-inner">
                <Compass className="text-slate-600 mb-4 animate-pulse" size={48} />
                <h3 className="text-base font-bold text-slate-300">Nenhum Rotograma Encontrado</h3>
                <p className="text-xs text-slate-500 max-w-md mt-1 mb-6">
                  Nenhum rotograma foi criado ainda para esta transportadora. Utilize nossa IA especializada em segurança viária para analisar e gerar seu primeiro plano.
                </p>
                <button 
                  onClick={() => setViewMode('create')}
                  className="px-5 py-2.5 bg-sky-600/10 text-sky-400 hover:bg-sky-600/20 font-bold text-sm rounded-lg border border-sky-500/30 transition flex items-center gap-2"
                >
                  <Plus size={16} /> Começar Geração
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredRotogramas.map((rot) => (
                  <div 
                    key={rot.id}
                    onClick={() => { setActiveRotograma(rot); setViewMode('view'); }}
                    className="bg-[#0f172a] hover:bg-[#131d33] border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-5 shadow-lg cursor-pointer transition flex flex-col justify-between group h-full"
                    id={`rotogram-card-${rot.id}`}
                  >
                    <div>
                      {/* Badge / Date Header */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className={`px-2 py-1 border text-[10px] font-extrabold tracking-widest uppercase rounded-md ${getRiskBadgeColor(rot.nivel_risco_geral)}`}>
                          Risco {rot.nivel_risco_geral}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                          <Calendar size={10} /> {new Date(rot.criado_em).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      {/* Path */}
                      <div className="space-y-2 mb-5">
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-1.5 flex-shrink-0"></div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block leading-tight uppercase tracking-wider">Origem</span>
                            <span className="text-sm font-bold text-slate-100 line-clamp-1">{rot.origem}</span>
                          </div>
                        </div>
                        <div className="w-0.5 h-4 bg-slate-800 ml-0.75 my-0.5 border-dashed"></div>
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 flex-shrink-0"></div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block leading-tight uppercase tracking-wider">Destino</span>
                            <span className="text-sm font-bold text-slate-100 line-clamp-1">{rot.destino}</span>
                          </div>
                        </div>
                      </div>

                      {/* Brief specs info */}
                      <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/50 rounded-lg border border-slate-900/60 mb-5 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Tipo Veículo</span>
                          <strong className="text-slate-300 font-semibold uppercase">{rot.tipo_veiculo?.replace('_', ' ')}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Tipo Carga</span>
                          <strong className="text-slate-300 font-semibold uppercase">{rot.tipo_carga?.replace('_', ' ')}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-auto">
                      <div className="flex items-center gap-3 text-slate-400 text-xs">
                        <span className="flex items-center gap-1 font-bold">
                          <Compass size={12} className="text-sky-500/80" /> {rot.distancia_km} km
                        </span>
                        <span className="flex items-center gap-1 font-bold">
                          <Clock size={12} className="text-emerald-500/80" /> {rot.tempo_estimado_horas}h
                        </span>
                      </div>
                      <button 
                        onClick={(e) => handleDelete(rot.id, e)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-md border border-rose-500/20 transition opacity-0 group-hover:opacity-100"
                        title="Excluir Rotograma"
                        id={`btn-delete-${rot.id}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW MODE: CREATE NEW ROTOGRAM */}
        {viewMode === 'create' && (
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Form inputs */}
              <div className="lg:col-span-2 bg-[#0f172a] rounded-xl border border-slate-800 p-6 shadow-xl flex flex-col gap-5">
                <div className="border-b border-slate-800/80 pb-3">
                  <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                    <Scale size={18} className="text-sky-400" /> Parâmetros do Rotograma de Risco
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Preencha as informações detalhadas para que a IA analise a rota, calcule distribuição de eixos e recomende pontos de segurança.
                  </p>
                </div>

                {generating ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-sky-400 animate-pulse">
                        <Shield size={22} />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">Analisando Inteligência Viária...</h3>
                      <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
                        {tips[loadingTip]}
                      </p>
                      <div className="w-52 h-1 bg-slate-900 rounded-full overflow-hidden mx-auto">
                        <div className="h-full bg-sky-500 animate-[pulse_1s_infinite] w-3/4"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Origem */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin size={12} className="text-sky-400" /> Origem <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: Porto de Santos - SP ou Coordenadas"
                        value={origem}
                        onChange={(e) => setOrigem(e.target.value)}
                        className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition"
                        id="form-origem-input"
                      />
                    </div>

                    {/* Destino */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin size={12} className="text-rose-500" /> Destino <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: Brasília - DF ou Coordenadas"
                        value={destino}
                        onChange={(e) => setDestino(e.target.value)}
                        className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition"
                        id="form-destino-input"
                      />
                    </div>

                    {/* Tipo de Veículo */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Truck size={12} className="text-slate-400" /> Tipo de Veículo
                      </label>
                      <select 
                        value={tipoVeiculo}
                        onChange={(e) => setTipoVeiculo(e.target.value)}
                        className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 transition"
                        id="form-tipo-veiculo-select"
                      >
                        <option value="truck_3eixos">Caminhão 3 Eixos (Truck)</option>
                        <option value="carreta_3eixos">Carreta 3 Eixos Simples (5 Eixos)</option>
                        <option value="bitrem_7eixos">Bi-trem 7 Eixos</option>
                        <option value="bitrem_9eixos">Bi-trem 9 Eixos (Rodotrem)</option>
                        <option value="van_carga">Van de Carga / VUC</option>
                      </select>
                    </div>

                    {/* Tipo de Carga */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FileText size={12} className="text-slate-400" /> Tipo de Carga
                      </label>
                      <select 
                        value={tipoCarga}
                        onChange={(e) => setTipoCarga(e.target.value)}
                        className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 transition"
                        id="form-tipo-carga-select"
                      >
                        <option value="carga_seca">Carga Seca Geral</option>
                        <option value="granel">Granel Sólido / Líquido</option>
                        <option value="produtos_perigosos">Produtos Perigosos (Hazmat / MOPP)</option>
                        <option value="alto_valor">Alto Valor Agregado (Eletrônicos/Medicamentos)</option>
                        <option value="refrigerada">Carga Refrigerada / Perecíveis</option>
                      </select>
                    </div>

                    {/* Peso da Carga (KG) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Peso da Carga (kg)
                      </label>
                      <input 
                        type="number" 
                        placeholder="Ex: 27000"
                        value={pesoCarga}
                        onChange={(e) => setPesoCarga(e.target.value)}
                        className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition"
                        id="form-peso-carga-input"
                      />
                    </div>

                    {/* Tara do Veículo (KG) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Tara do Veículo (kg)
                      </label>
                      <input 
                        type="number" 
                        placeholder="Ex: 15000"
                        value={taraVeiculo}
                        onChange={(e) => setTaraVeiculo(e.target.value)}
                        className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition"
                        id="form-tara-veiculo-input"
                      />
                    </div>

                    {/* Custom Configuração de Eixos */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Especificação de Eixos (Opcional)
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: Cavalo 6x2 + Carreta 3 eixos juntas"
                        value={configuracaoEixos}
                        onChange={(e) => setConfiguracaoEixos(e.target.value)}
                        className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition"
                        id="form-config-eixos-input"
                      />
                    </div>

                    {/* Rodagem Eixos */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Tipo de Rodagem / Rodas
                      </label>
                      <select 
                        value={rodagemEixos}
                        onChange={(e) => setRodagemEixos(e.target.value)}
                        className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 transition"
                        id="form-rodagem-select"
                      >
                        <option value="dupla">Rodas Duplas por Eixo Traseiro (Standard)</option>
                        <option value="simples">Pneus Super Single (Rodagem Simples)</option>
                        <option value="mista">Misto (Direcional simples, tração dupla)</option>
                      </select>
                    </div>

                    {/* Restrições Conhecidas */}
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Restrições de Gabarito do Veículo (Opcional)
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: Altura máxima de 4.4m, comprimento total de 18.6m"
                        value={restricoes}
                        onChange={(e) => setRestricoes(e.target.value)}
                        className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition"
                        id="form-restricoes-input"
                      />
                    </div>

                    {/* Histórico Riscos */}
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Histórico de Ocorrências ou Observações Adicionais
                      </label>
                      <textarea 
                        placeholder="Ex: Evitar paradas no trecho norte da BR-381 devido a assaltos recentes ocorridos no período noturno."
                        value={historicoRiscos}
                        onChange={(e) => setHistoricoRiscos(e.target.value)}
                        className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 h-20 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 resize-none transition"
                        id="form-historico-input"
                      />
                    </div>

                    {/* Pre-flight Error message */}
                    {generationError && (
                      <div className="md:col-span-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-bold flex items-center gap-2">
                        <AlertOctagon size={16} /> {generationError}
                      </div>
                    )}

                    {/* Submit buttons */}
                    <div className="md:col-span-2 flex items-center justify-end gap-3 mt-4 border-t border-slate-800/80 pt-4">
                      <button 
                        type="button"
                        onClick={() => setViewMode('list')}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-lg border border-slate-700 transition"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm rounded-lg shadow-lg border border-sky-500/30 transition flex items-center gap-2"
                        id="form-submit-btn"
                      >
                        <Compass size={16} /> Gerar com IA Especialista
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Right Column: Expert info and Guidelines card */}
              <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col gap-4">
                <div className="flex items-center gap-3 p-3 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-lg">
                  <ShieldCheck size={24} className="flex-shrink-0 animate-bounce" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">Análise de Risco Especializada</h4>
                    <p className="text-[11px] text-sky-400/80 mt-0.5">
                      Nosso modelo possui o conhecimento de todas as resoluções vigentes do CONTRAN e DNIT.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-slate-800 pb-2">Como Funciona</h3>
                  
                  <div className="flex gap-3">
                    <span className="w-5 h-5 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center text-[10px] font-bold text-sky-400 mt-0.5 flex-shrink-0">1</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong>Rotas de Transporte:</strong> A IA analisa os eixos de tráfego federais e estaduais do Brasil mais comuns para calcular os pontos exatos.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-5 h-5 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center text-[10px] font-bold text-sky-400 mt-0.5 flex-shrink-0">2</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong>Lei da Balança Brasileira:</strong> Verifica a distribuição de peso e acusa sobrecargas, sugerindo adequações de eixos para evitar multas pesadas.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-5 h-5 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center text-[10px] font-bold text-sky-400 mt-0.5 flex-shrink-0">3</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong>Instruções ao Motorista:</strong> Gera rotogramas fáceis de ler que salvam vidas, diminuindo acidentes em declives, curvas perigosas e tombamentos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW MODE: ACTIVE ROTOGRAM REPORT */}
        {viewMode === 'view' && activeRotograma && (
          <div className="lg:col-span-3 flex flex-col gap-6" id="rotograma-report-container">
            {/* Quick Actions Header */}
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400">Rotograma Selecionado:</span>
                <span className="font-extrabold text-white text-sm">
                  {activeRotograma.origem} → {activeRotograma.destino}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleTransmitVoice(activeRotograma.resumo_motorista)}
                  className="px-3.5 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/20 text-xs font-bold flex items-center gap-2 transition"
                  title="Anunciar resumo do motorista no rádio de alertas vocal"
                  id="btn-transmit-voice"
                >
                  <Volume2 size={13} /> Transmitir no Rádio Central
                </button>
                <button 
                  onClick={() => generateRotogramaPDF(activeRotograma)}
                  disabled={pdfLoading}
                  className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 transition ${
                    pdfLoading 
                      ? "bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed" 
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  }`}
                >
                  {pdfLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin"></span>
                      Gerando Relatório...
                    </>
                  ) : (
                    <>
                      <Printer size={13} /> Imprimir Relatório
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Structured Report Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left & Middle Column: Core Risk Data and points list */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                {/* 1. Route Summary card */}
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-6 shadow-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full filter blur-2xl pointer-events-none"></div>
                  
                  <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-sky-400 block uppercase mb-1">Status de Risco Viário</span>
                      <h3 className="text-lg font-black text-white leading-tight uppercase">Plano de Viagem Operacional</h3>
                    </div>
                    <span className={`px-3 py-1 border text-xs font-extrabold tracking-widest uppercase rounded-lg ${getRiskBadgeColor(activeRotograma.nivel_risco_geral)}`}>
                      Risco {activeRotograma.nivel_risco_geral}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Distância Total</span>
                      <strong className="text-lg font-black text-white">{activeRotograma.distancia_km} km</strong>
                    </div>
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Duração Viagem</span>
                      <strong className="text-lg font-black text-white">{activeRotograma.tempo_estimado_horas} horas</strong>
                    </div>
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">PBT Total (Bal.)</span>
                      <strong className="text-lg font-black text-sky-400">
                        {activeRotograma.calculo_eixos.peso_bruto_total_kg ? `${(activeRotograma.calculo_eixos.peso_bruto_total_kg / 1000).toFixed(1)} t` : 'N/D'}
                      </strong>
                    </div>
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Pedágio Estimado</span>
                      <strong className="text-lg font-black text-emerald-400">
                        {activeRotograma.calculo_eixos.eixos_tarifaveis_pedagio ? `${activeRotograma.calculo_eixos.eixos_tarifaveis_pedagio} eixos` : 'N/D'}
                      </strong>
                    </div>
                  </div>

                  {/* Resumo texto */}
                  <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-lg">
                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Info size={13} className="text-sky-400" /> Resumo Estratégico da Rota
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{activeRotograma.resumo}</p>
                  </div>
                </div>

                {/* 2. Driver summary (Resumo do motorista) */}
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-6 shadow-md border-l-4 border-l-indigo-500">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Volume2 size={16} className="text-indigo-400" /> Resumo Vocal (Instruções do Motorista)
                    </h3>
                    <button 
                      onClick={() => handleTransmitVoice(activeRotograma.resumo_motorista)}
                      className="text-[10px] font-bold text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      Ouvir Áudio <CornerDownRight size={10} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/40 p-4 rounded-lg border border-slate-900 font-sans italic">
                    "{activeRotograma.resumo_motorista}"
                  </p>
                </div>

                {/* 3. Detailed timeline path list (pontos) */}
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-6 shadow-md">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-slate-800 pb-3 mb-5 flex items-center gap-2">
                    <Map size={16} className="text-sky-400" /> Pontos Críticos e Planejamento do Trajeto ({activeRotograma.pontos?.length || 0})
                  </h3>

                  <div className="relative border-l border-slate-800 ml-4 space-y-6">
                    {activeRotograma.pontos?.map((ponto, index) => {
                      const style = getPointCategoryStyles(ponto.categoria);
                      const Icon = style.icon;
                      
                      return (
                        <div key={index} className="relative pl-6 group">
                          {/* Circle Icon */}
                          <div className={`absolute -left-3.5 top-0 w-7 h-7 rounded-full border flex items-center justify-center ${style.bg} transition-transform group-hover:scale-110 shadow-lg`}>
                            <Icon size={12} />
                          </div>

                          {/* Content */}
                          <div className="bg-slate-950/40 rounded-lg p-4 border border-slate-900 group-hover:border-slate-800 transition">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                              <div>
                                <span className="text-[10px] font-bold text-slate-500 mr-2">PO-#0{ponto.ordem}</span>
                                <span className="text-sm font-bold text-slate-100">{ponto.localizacao}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                  {ponto.km_aproximado ? `KM ${ponto.km_aproximado}` : 'Ref.'}
                                </span>
                                {ponto.velocidade_maxima_recomendada && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                                    Max {ponto.velocidade_maxima_recomendada} km/h
                                  </span>
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-slate-400 mb-2 leading-relaxed">{ponto.descricao}</p>
                            
                            <div className="p-2.5 bg-slate-900 border-l-2 border-sky-500 text-slate-300 text-xs font-sans rounded-r-md">
                              <strong>Instrução ao Motorista:</strong> {ponto.instrucao}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Scale Law analysis & Emergency Box */}
              <div className="flex flex-col gap-6">
                
                {/* 1. Scale Law Axle Weight calculation card */}
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col gap-4">
                  <div className="border-b border-slate-800 pb-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <Scale size={16} className="text-sky-400" /> Distribuição por Eixo (Lei da Balança)
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Análise técnica baseada nas tolerâncias brasileiras (CONTRAN).
                    </p>
                  </div>

                  {/* Config text */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 text-[11px]">
                    <span className="text-slate-500 block uppercase font-bold tracking-wider">Configuração Estimada</span>
                    <strong className="text-slate-200">{activeRotograma.calculo_eixos.configuracao_veiculo}</strong>
                  </div>

                  {/* List of eixos */}
                  <div className="space-y-3">
                    {activeRotograma.calculo_eixos.eixos?.map((eixo, i) => (
                      <div key={i} className="bg-slate-950/60 p-3 rounded-lg border border-slate-900 text-xs flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-200 font-semibold">{eixo.identificacao}</strong>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                            eixo.status === 'excedido' 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {eixo.status === 'excedido' ? 'SOBREPESO' : 'OK'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                          <div>
                            <span>Peso Est: </span>
                            <strong className="text-slate-200">{eixo.peso_estimado_kg ? `${(eixo.peso_estimado_kg).toLocaleString('pt-BR')} kg` : 'N/D'}</strong>
                          </div>
                          <div>
                            <span>Limite: </span>
                            <strong className="text-slate-300">{eixo.limite_legal_kg ? `${(eixo.limite_legal_kg).toLocaleString('pt-BR')} kg` : 'N/D'}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Overload / AET requirements summaries */}
                  <div className="mt-2 space-y-2 text-xs">
                    {activeRotograma.calculo_eixos.excesso_total_kg > 0 ? (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg font-bold flex items-center gap-2">
                        <AlertTriangle size={15} /> Excesso de Peso: {activeRotograma.calculo_eixos.excesso_total_kg.toLocaleString('pt-BR')} kg!
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg font-bold flex items-center gap-2">
                        <ShieldCheck size={15} /> Sem excessos no PBT e eixos tandem.
                      </div>
                    )}

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-900 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Configuração Mínima Recomendada:</span>
                        <strong className="text-slate-300 text-right">{activeRotograma.calculo_eixos.configuracao_minima_sugerida}</strong>
                      </div>
                      <div className="flex justify-between text-[11px] pt-1 border-t border-slate-900">
                        <span className="text-slate-400">Exige AET (Especial de Trânsito):</span>
                        <strong className={activeRotograma.calculo_eixos.necessita_aet ? "text-amber-400" : "text-slate-400"}>
                          {activeRotograma.calculo_eixos.necessita_aet ? "SIM" : "NÃO"}
                        </strong>
                      </div>
                    </div>

                    {/* Alertas específicos */}
                    {activeRotograma.calculo_eixos.alerta && (
                      <div className="p-3 bg-slate-900 border-l-2 border-amber-500 text-slate-300 text-[11px] rounded-r-md">
                        <strong>Alerta da IA:</strong> {activeRotograma.calculo_eixos.alerta}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Emergency contacts card */}
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
                    <PhoneCall size={14} className="text-rose-400" /> Contatos de Emergência do Trajeto
                  </h3>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between p-2 bg-slate-950/40 border border-slate-900 rounded-lg">
                      <span className="text-slate-400 font-semibold">PRF (Polícia Rodoviária):</span>
                      <strong className="text-sky-400 font-mono text-xs">{activeRotograma.contatos_emergencia.prf || '191'}</strong>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-950/40 border border-slate-900 rounded-lg">
                      <span className="text-slate-400 font-semibold">Resgate / SAMU:</span>
                      <strong className="text-rose-400 font-mono text-xs">{activeRotograma.contatos_emergencia.resgate || '192'}</strong>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-950/40 border border-slate-900 rounded-lg">
                      <span className="text-slate-400 font-semibold">Gerenciadora de Risco:</span>
                      <span className="text-slate-300 text-xs text-right font-bold">{activeRotograma.contatos_emergencia.gerenciadora_risco}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-950/40 border border-slate-900 rounded-lg">
                      <span className="text-slate-400 font-semibold">Torre da Transportadora:</span>
                      <span className="text-slate-300 text-xs text-right font-bold">{activeRotograma.contatos_emergencia.transportadora}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-950/40 border border-slate-900 rounded-lg">
                      <span className="text-slate-400 font-semibold">Serviço de Guincho Pesado:</span>
                      <span className="text-slate-300 text-xs text-right font-bold">{activeRotograma.contatos_emergencia.guincho}</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Inline fallback for Shield icon when not imported or dynamically resolved
function Shield({ className, size = 16 }: { className?: string, size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6z" />
    </svg>
  );
}
