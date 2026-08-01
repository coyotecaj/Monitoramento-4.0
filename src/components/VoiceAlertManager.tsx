import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, AlertCircle, Play, CheckCircle2, Navigation, Bell, Megaphone } from 'lucide-react';
import { Vehicle, Geofence, Trip } from '../types';
import { isPointInPolygon } from '../utils/geometry';

interface VoiceAlertManagerProps {
  vehicles: Vehicle[];
  geofences: Geofence[];
  trips: Trip[];
}

interface AlertLog {
  id: string;
  time: string;
  message: string;
  type: 'near' | 'inside' | 'exit' | 'maintenance' | 'announcement';
  plate: string;
}

// Haversine distance helper (in meters)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function cleanPassoText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\s*\(\s*\d+[º°]?\s*Passo\s*\)/gi, '')
    .replace(/\s*\(\s*Passo\s*\d+\s*\)/gi, '')
    .replace(/\s*-\s*Passo\s*\d+/gi, '')
    .replace(/\s*\bPasso\s*\d+\b/gi, '')
    .replace(/\s*\b\d+[º°]?\s*Passo\b/gi, '')
    .replace(/\s*\(\s*Status\s*\d+[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function VoiceAlertManager({ vehicles, geofences, trips }: VoiceAlertManagerProps) {
  const [enabled, setEnabled] = useState(true);
  const [nearEnabled, setNearEnabled] = useState(true);
  const [insideEnabled, setInsideEnabled] = useState(true);
  const [exitEnabled, setExitEnabled] = useState(true);
  const [proximityBuffer, setProximityBuffer] = useState(3000); // 3km proximity default
  const [volume, setVolume] = useState(1.0);
  const [toastDuration, setToastDuration] = useState(20); // Default to 20 seconds
  const [activeAlert, setActiveAlert] = useState<AlertLog | null>(null);
  const [logs, setLogs] = useState<AlertLog[]>([]);

  // Queue of warnings for voice & text rendering
  const [queue, setQueue] = useState<AlertLog[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep a map of previous states to detect transitions
  // Key: vehicleId_geofenceId, Value: 'INSIDE' | 'NEAR' | 'OUTSIDE'
  const prevStatesRef = useRef<Record<string, 'INSIDE' | 'NEAR' | 'OUTSIDE'>>({});
  const lastAlertTimeRef = useRef<Record<string, number>>({});
  const recentEnqueuedAlertsRef = useRef<Map<string, number>>(new Map());
  const mountTimeRef = useRef<number>(Date.now());
  const isInitializedRef = useRef<boolean>(false);

  // Helper to completely silence speech and clear pending alert queue
  const handleSilenceAll = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    currentUtteranceRef.current = null;
    setQueue([]);
    setActiveAlert(null);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (speechDelayTimeoutRef.current) {
      clearTimeout(speechDelayTimeoutRef.current);
    }
  }, []);

  // Reload settings from localStorage on mount and periodically
  useEffect(() => {
    const loadSettings = () => {
      const storedEnabled = localStorage.getItem('voice_alerts_enabled');
      const storedNear = localStorage.getItem('voice_alerts_near');
      const storedInside = localStorage.getItem('voice_alerts_inside');
      const storedExit = localStorage.getItem('voice_alerts_exit');
      const storedProximity = localStorage.getItem('voice_alerts_proximity');
      const storedVolume = localStorage.getItem('voice_alerts_volume');
      const storedToastDuration = localStorage.getItem('voice_alerts_toast_duration');

      if (storedEnabled !== null) {
        const isEn = storedEnabled === 'true';
        setEnabled(isEn);
        if (!isEn) {
          handleSilenceAll();
        }
      }
      if (storedNear !== null) setNearEnabled(storedNear === 'true');
      if (storedInside !== null) setInsideEnabled(storedInside === 'true');
      if (storedExit !== null) setExitEnabled(storedExit === 'true');
      if (storedProximity !== null) setProximityBuffer(Number(storedProximity));
      if (storedVolume !== null) setVolume(Number(storedVolume));
      if (storedToastDuration !== null) setToastDuration(Number(storedToastDuration));
    };

    loadSettings();
    // Listen to storage events to keep settings in sync if changed in another page/tab
    window.addEventListener('storage', loadSettings);
    // Also set an interval to regularly poll localStorage to reflect instant settings changes
    const interval = setInterval(loadSettings, 1000);

    return () => {
      window.removeEventListener('storage', loadSettings);
      clearInterval(interval);
    };
  }, [handleSilenceAll]);

  // Cleanup synthesis on component unmount to prevent lingering speech
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (speechDelayTimeoutRef.current) {
        clearTimeout(speechDelayTimeoutRef.current);
      }
    };
  }, []);

  // Queue processing logic
  useEffect(() => {
    if (queue.length > 0 && !isSpeaking) {
      const nextAlert = queue[0];
      setQueue(prev => prev.slice(1));
      setActiveAlert(nextAlert);

      // Clear any previous auto-dismiss timeout
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      // Schedule auto-dismiss for this alert toast based on configured duration
      toastTimeoutRef.current = setTimeout(() => {
        setActiveAlert(current => current?.id === nextAlert.id ? null : current);
      }, toastDuration * 1000);

      if (enabled && 'speechSynthesis' in window) {
        setIsSpeaking(true);

        const utterance = new SpeechSynthesisUtterance(nextAlert.message);
        utterance.lang = 'pt-BR';
        utterance.volume = volume;
        utterance.rate = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang.startsWith('pt') || v.lang === 'pt-BR');
        if (ptVoice) {
          utterance.voice = ptVoice;
        }

        // Assign to ref to prevent garbage collection on some browsers
        currentUtteranceRef.current = utterance;

        utterance.onend = () => {
          setIsSpeaking(false);
          currentUtteranceRef.current = null;
        };

        utterance.onerror = (e) => {
          console.warn('Erro na síntese de voz, continuando fila:', e);
          setIsSpeaking(false);
          currentUtteranceRef.current = null;
        };

        // Determine chime duration to delay speaking so chime and speech don't overlap
        const chimeDuration = nextAlert.type === 'maintenance'
          ? 1400
          : nextAlert.type === 'announcement'
            ? 950
            : 550;

        if (speechDelayTimeoutRef.current) {
          clearTimeout(speechDelayTimeoutRef.current);
        }

        speechDelayTimeoutRef.current = setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, chimeDuration);
      } else {
        setIsSpeaking(true);
        const chimeDuration = nextAlert.type === 'maintenance'
          ? 1400
          : nextAlert.type === 'announcement'
            ? 950
            : 550;

        // Simulate speaking delay based on text length (approx 65ms per char) plus chime duration
        const speechDelay = Math.min(6000, nextAlert.message.length * 65) + chimeDuration;
        
        if (speechDelayTimeoutRef.current) {
          clearTimeout(speechDelayTimeoutRef.current);
        }

        speechDelayTimeoutRef.current = setTimeout(() => {
          setIsSpeaking(false);
        }, speechDelay);
      }
    }
  }, [queue, isSpeaking, enabled, volume, toastDuration]);

  // Keep track of processed trip event IDs to fire alerts for newly generated server events
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const eventsInitializedRef = useRef<boolean>(false);

  // Play subtle 2-tone audio chime (Web Audio API) alongside speech synthesis and text banner
  const playAlertChime = useCallback((type: 'near' | 'inside' | 'exit' | 'maintenance' | 'announcement') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      if (type === 'announcement') {
        // A soft, elegant corporate announcement chime (F4 -> A4 -> C5) with smooth sine waves and gentle decay
        const frequencies = [349.23, 440.00, 523.25]; // F4, A4, C5
        frequencies.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.15);
          
          gain.gain.setValueAtTime(0, now + i * 0.15);
          gain.gain.linearRampToValueAtTime(0.12 * volume, now + i * 0.15 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.60);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.15);
          osc.stop(now + i * 0.15 + 0.60);
        });
        return;
      }

      if (type === 'maintenance') {
        // High attention warning siren sound sweeping between 600Hz and 1000Hz twice
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1000, now + 0.35);
        osc.frequency.linearRampToValueAtTime(600, now + 0.7);
        osc.frequency.linearRampToValueAtTime(1000, now + 1.05);
        osc.frequency.linearRampToValueAtTime(600, now + 1.4);
        
        gain.gain.setValueAtTime(0.18 * volume, now);
        gain.gain.setValueAtTime(0.18 * volume, now + 1.0);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.4);
        return;
      }

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(type === 'inside' ? 880 : type === 'exit' ? 440 : 660, now);
      gain1.gain.setValueAtTime(0.2 * volume, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(type === 'inside' ? 1174.66 : type === 'exit' ? 523.25 : 880, now + 0.2);
      gain2.gain.setValueAtTime(0.2 * volume, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.45);
    } catch (e) {
      // Ignore audio context errors if blocked by browser
    }
  }, [volume]);

  // Unlock browser audio & speech synthesis context on user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Enqueue new alerts (Speech + Audio Chime + Text Toast)
  const enqueueAlert = useCallback((text: string, type: 'near' | 'inside' | 'exit' | 'maintenance' | 'announcement', plate: string) => {
    const cleanedText = cleanPassoText(text);
    
    // Deduplication check: prevent duplicate alerts for the same vehicle & type within 15s
    const dedupKey = `${plate}_${type}_${cleanedText.slice(0, 30)}`;
    const lastTime = recentEnqueuedAlertsRef.current.get(dedupKey) || 0;
    if (Date.now() - lastTime < 15000) {
      return; // Skip duplicate alert
    }
    recentEnqueuedAlertsRef.current.set(dedupKey, Date.now());

    const newAlert: AlertLog = {
      id: 'alert_' + Date.now() + Math.random().toString(36).substr(2, 5),
      time: new Date().toLocaleTimeString('pt-BR'),
      message: cleanedText,
      type,
      plate
    };

    // Play instant audio chime feedback
    playAlertChime(type);

    // Save to alert history logs (keep last 20)
    setLogs(prev => [newAlert, ...prev.slice(0, 19)]);
    
    // Add to queue (cap queue to max 3 items so alerts stay fresh)
    setQueue(prev => [...prev.slice(-2), newAlert]);
  }, [playAlertChime]);

  // Keep track of previous vehicle statuses to trigger alerts on maintenance changes
  const prevVehicleStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (vehicles.length === 0) return;

    const isAppStartup = Date.now() - mountTimeRef.current < 3000;

    vehicles.forEach(vehicle => {
      const prevStatus = prevVehicleStatusesRef.current[vehicle.id];

      if (prevStatus !== undefined && prevStatus !== vehicle.status) {
        if (enabled && !isAppStartup) {
          const plateSpaced = vehicle.licensePlate.split('').join(' ');
          const driverName = vehicle.driverName || 'Motorista não identificado';

          if (vehicle.status === 'MAINTENANCE') {
            const text = `Atenção! Atenção! Veículo de placa ${plateSpaced}, conduzido por ${driverName}, entrou em MANUTENÇÃO.`;
            enqueueAlert(text, 'maintenance', vehicle.licensePlate);
          } else if (prevStatus === 'MAINTENANCE') {
            const text = `Atenção! Atenção! Veículo de placa ${plateSpaced}, conduzido por ${driverName}, saiu da MANUTENÇÃO e está liberado para viagens.`;
            enqueueAlert(text, 'maintenance', vehicle.licensePlate);
          }
        }
      }

      prevVehicleStatusesRef.current[vehicle.id] = vehicle.status;
    });
  }, [vehicles, enabled, enqueueAlert]);

  // 1. Process server trip events (e.g. GEOFENCE_NEAR, STATUS_CHANGE, SPEED_ALERT)
  useEffect(() => {
    if (trips.length === 0) return;

    // First run: seed existing event IDs so we don't alert for old historical logs
    if (!eventsInitializedRef.current) {
      trips.forEach(trip => {
        if (trip.events) {
          trip.events.forEach(evt => processedEventIdsRef.current.add(evt.id));
        }
      });
      eventsInitializedRef.current = true;
      return;
    }

    // Subsequent runs: alert for newly added events on active trips
    trips.forEach(trip => {
      if (trip.status === 'DELIVERED') return; // skip completed trips
      if (!trip.events) return;

      const vehicle = vehicles.find(v => v.id === trip.vehicleId);
      const plate = vehicle?.licensePlate || 'VEÍCULO';

      trip.events.forEach(evt => {
        if (!processedEventIdsRef.current.has(evt.id)) {
          processedEventIdsRef.current.add(evt.id);

          let alertType: 'near' | 'inside' | 'exit' = 'near';
          if (evt.type === 'GEOFENCE_NEAR') alertType = 'near';
          else if (evt.type === 'STATUS_CHANGE' || evt.type === 'GEOFENCE_ENTER') alertType = 'inside';
          else if (evt.type === 'GEOFENCE_EXIT') alertType = 'exit';

          const descPt = evt.description
            ? evt.description
                .replace(/\bEN_ROUTE\b/g, 'Em Trânsito')
                .replace(/\bSCHEDULED\b/g, 'Agendado')
                .replace(/\bWAITING_LOADING\b/g, 'No Carregamento')
                .replace(/\bWAITING_UNLOADING\b/g, 'No Descarregamento')
                .replace(/\bDELIVERED\b/g, 'Concluído')
                .replace(/\bSTART_TRANSIT\b/g, 'Trânsito / Vazio')
                .replace(/\bAVAILABLE\b/g, 'Disponível')
                .replace(/\bMAINTENANCE\b/g, 'Em Manutenção')
                .replace(/\bBLOCKED\b/g, 'Bloqueado')
                .replace(/\bALERT\b/g, 'Com Alerta')
            : '';

          enqueueAlert(descPt, alertType, plate);
        }
      });
    });
  }, [trips, vehicles, enqueueAlert]);

  // 2. Process real-time vehicle coordinate updates and trigger voice & text alerts on state transition
  useEffect(() => {
    if (vehicles.length === 0 || geofences.length === 0) return;

    // Protection 1: Skip voice alerts during initial 3 seconds of mount hydration
    const isAppStartup = Date.now() - mountTimeRef.current < 3000;

    vehicles.forEach(vehicle => {
      // Check if vehicle has an active trip or status in route
      const isActiveInBoard = vehicle.status === 'EN_ROUTE' || trips.some(t => t.vehicleId === vehicle.id && t.status !== 'DELIVERED');

      // Check telemetry timestamp validity
      const telemetryTimeMs = vehicle.telemetryTime ? new Date(vehicle.telemetryTime).getTime() : 0;
      const isRecentTelemetry = telemetryTimeMs > 0 && (Date.now() - telemetryTimeMs) < 30 * 60 * 1000; // 30 min window

      geofences.forEach(geofence => {
        // Monitor active routes prioritized, OR if inactive, transport bases and gas stations
        if (!isActiveInBoard && geofence.icon !== 'TRANSPORT_BASE' && geofence.icon !== 'GAS_STATION') {
          return;
        }

        const key = `${vehicle.id}_${geofence.id}`;
        const distance = getDistance(
          vehicle.currentLatitude,
          vehicle.currentLongitude,
          geofence.latitude,
          geofence.longitude
        );

        const isInside = geofence.shapeType === 'POLYGON' && geofence.polygonCoordinates && geofence.polygonCoordinates.length >= 3
          ? isPointInPolygon(
              { latitude: vehicle.currentLatitude, longitude: vehicle.currentLongitude },
              geofence.polygonCoordinates
            )
          : distance <= geofence.radius;

        let currentState: 'INSIDE' | 'NEAR' | 'OUTSIDE' = 'OUTSIDE';
        if (isInside) {
          currentState = 'INSIDE';
        } else if (distance <= geofence.radius + proximityBuffer) {
          currentState = 'NEAR';
        }

        const prevState = prevStatesRef.current[key];

        // Store baseline state on initial load without firing alerts
        if (!isInitializedRef.current || isAppStartup || prevState === undefined) {
          prevStatesRef.current[key] = currentState;
          return;
        }

        // We trigger alerts on actual state transitions
        if (prevState !== currentState) {
          const cooldownKey = `${key}_${currentState}`;
          const lastAlertTime = lastAlertTimeRef.current[cooldownKey] || 0;
          // 2-minute cooldown per (vehicle, fence, state)
          const isCoolingDown = (Date.now() - lastAlertTime) < 2 * 60 * 1000;

          // For active board trips or valid telemetry, fire alert
          if ((isActiveInBoard || isRecentTelemetry) && !isCoolingDown && enabled) {
            const driverName = vehicle.driverName || 'Motorista não identificado';
            const plateSpaced = vehicle.licensePlate.split('').join(' '); // Say plate letter by letter
            const distanceFormatted = distance >= 1000 
              ? `${(distance / 1000).toFixed(1)} quilômetros`
              : `${Math.round(distance)} metros`;

            let shouldEnqueue = false;
            let text = '';

            if (currentState === 'INSIDE' && prevState !== 'INSIDE') {
              if (insideEnabled) {
                const activeTrip = trips.find(t => t.vehicleId === vehicle.id && t.status !== 'DELIVERED');
                if (activeTrip && activeTrip.originGeofenceId === geofence.id) {
                  text = `Atenção torre de controle! Veículo de placa ${plateSpaced}, conduzido por ${driverName}, chegou na origem ${geofence.name} para CARREGAMENTO.`;
                } else if (activeTrip && activeTrip.destinationGeofenceId === geofence.id) {
                  text = `Atenção torre de controle! Veículo de placa ${plateSpaced}, conduzido por ${driverName}, chegou ao destino ${geofence.name} para DESCARREGAMENTO.`;
                } else {
                  text = `Atenção torre de controle! Veículo de placa ${plateSpaced}, conduzido por ${driverName}, entrou na cerca eletrônica ${geofence.name}.`;
                }
                enqueueAlert(text, 'inside', vehicle.licensePlate);
                shouldEnqueue = true;
              }
            } else if (prevState === 'INSIDE' && currentState !== 'INSIDE') {
              if (exitEnabled) {
                text = `Informativo! Veículo de placa ${plateSpaced}, de ${driverName}, saiu da cerca eletrônica ${geofence.name}.`;
                enqueueAlert(text, 'exit', vehicle.licensePlate);
                shouldEnqueue = true;
              }
            } else if (currentState === 'NEAR' && prevState === 'OUTSIDE') {
              if (nearEnabled) {
                text = `Aproximação detectada! O veículo de placa ${plateSpaced}, conduzido por ${driverName}, está se aproximando da cerca ${geofence.name}, a uma distância de ${distanceFormatted}.`;
                enqueueAlert(text, 'near', vehicle.licensePlate);
                shouldEnqueue = true;
              }
            }

            if (shouldEnqueue) {
              lastAlertTimeRef.current[cooldownKey] = Date.now();
            }
          }
        }

        // Store new state
        prevStatesRef.current[key] = currentState;
      });
    });

    if (!isInitializedRef.current && !isAppStartup) {
      isInitializedRef.current = true;
    }
  }, [vehicles, geofences, trips, nearEnabled, insideEnabled, exitEnabled, proximityBuffer, enabled, enqueueAlert]);

  const handleRepeat = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.volume = volume;

      const ptVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('pt') || v.lang === 'pt-BR');
      if (ptVoice) utterance.voice = ptVoice;

      currentUtteranceRef.current = utterance;

      utterance.onend = () => {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
      };

      window.speechSynthesis.speak(utterance);
    }
  }, [volume]);

  // Dispatch custom events for synchronization with MapComponent
  useEffect(() => {
    const event = new CustomEvent('active-voice-alert-change', { detail: activeAlert });
    window.dispatchEvent(event);
  }, [activeAlert]);

  useEffect(() => {
    const handleBroadcastAnnouncement = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.message) {
        // Enqueue as a beautiful corporate style voice/text toast
        enqueueAlert(customEvent.detail.message, 'announcement', 'AVISO');
      }
    };

    window.addEventListener('broadcast-announcement-received', handleBroadcastAnnouncement);

    return () => {
      window.removeEventListener('broadcast-announcement-received', handleBroadcastAnnouncement);
    };
  }, [enqueueAlert]);

  useEffect(() => {
    const handleRequest = () => {
      const event = new CustomEvent('active-voice-alert-change', { detail: activeAlert });
      window.dispatchEvent(event);
    };

    const handleDismiss = () => {
      handleSilenceAll();
    };

    const handleRepeatEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.message) {
        handleRepeat(customEvent.detail.message);
      }
    };

    window.addEventListener('request-active-voice-alert', handleRequest);
    window.addEventListener('dismiss-active-voice-alert', handleDismiss);
    window.addEventListener('repeat-active-voice-alert', handleRepeatEvent);

    return () => {
      window.removeEventListener('request-active-voice-alert', handleRequest);
      window.removeEventListener('dismiss-active-voice-alert', handleDismiss);
      window.removeEventListener('repeat-active-voice-alert', handleRepeatEvent);
    };
  }, [activeAlert, handleRepeat, handleSilenceAll]);

  return (
    <>
      {/* Floating active vocal warning toast (top right of screen) */}
      {activeAlert && (
        <div 
          id="active-voice-alert-toast" 
          className={`fixed top-20 right-6 z-[9999] max-w-sm w-full bg-slate-950/95 border-2 rounded-xl p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-right-10 duration-300 ${
            activeAlert.type === 'announcement' ? 'border-sky-500/60 shadow-sky-500/10' : 'border-amber-500/60 shadow-amber-500/10'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${
              activeAlert.type === 'inside' 
                ? 'bg-rose-500/15 text-rose-400' 
                : activeAlert.type === 'exit' 
                  ? 'bg-amber-500/15 text-amber-400' 
                  : activeAlert.type === 'maintenance'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : activeAlert.type === 'announcement'
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                      : 'bg-sky-500/15 text-sky-400'
            }`}>
              {activeAlert.type === 'inside' ? (
                <CheckCircle2 size={18} className="animate-bounce" />
              ) : activeAlert.type === 'exit' ? (
                <Navigation size={18} />
              ) : activeAlert.type === 'maintenance' ? (
                <AlertCircle size={18} className="animate-pulse text-red-500" />
              ) : activeAlert.type === 'announcement' ? (
                <Megaphone size={18} className="animate-pulse text-sky-400" />
              ) : (
                <Bell size={18} className="animate-swing" />
              )}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
                  {activeAlert.type === 'inside' && 'Cerca Eletrônica: ENTRADA'}
                  {activeAlert.type === 'exit' && 'Cerca Eletrônica: SAÍDA'}
                  {activeAlert.type === 'near' && 'Cerca Eletrônica: APROXIMAÇÃO'}
                  {activeAlert.type === 'maintenance' && 'Oficina: MANUTENÇÃO'}
                  {activeAlert.type === 'announcement' && 'Central: TRANSPORTE / AVISO'}
                </span>
                <span className="text-[9px] font-mono text-slate-500">{activeAlert.time}</span>
              </div>
              <p className="text-xs text-slate-100 font-semibold leading-relaxed">
                {activeAlert.message.replace(/Placa ([A-Z0-9 ]+),/gi, `Placa ${activeAlert.plate},`)}
              </p>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => handleRepeat(activeAlert.message)}
                  className="flex items-center gap-1 text-[9px] font-mono font-bold text-sky-400 hover:text-sky-300 uppercase cursor-pointer"
                >
                  <Play size={10} /> Repetir Voz
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSilenceAll}
                    className="flex items-center gap-1 text-[9px] font-mono font-bold text-rose-400 hover:text-rose-300 uppercase cursor-pointer"
                  >
                    <VolumeX size={10} /> Silenciar Tudo
                  </button>
                  <button
                    type="button"
                    onClick={handleSilenceAll}
                    className="text-[9px] font-mono text-slate-500 hover:text-slate-300 uppercase cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
