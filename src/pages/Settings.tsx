import React, { useState, useEffect } from 'react';
import { callSascarSoap } from '../services/api';
import { Settings as SettingsIcon, Shield, Radio, KeyRound, HelpCircle, Code, CheckCircle, AlertCircle, Map, Volume2, VolumeX, Database, RefreshCw, Power, Play, RotateCcw } from 'lucide-react';

const PRECONFIGURED_MAPS_KEY = 'AIzaSyCoM-MbWKq5gsf0pWgcc6Cj4BShCslqXcE';

export default function Settings() {
  const [demoMode, setDemoMode] = useState(true);
  const [sascarUser, setSascarUser] = useState('');
  const [sascarPass, setSascarPass] = useState('');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Database sync states
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusData, setStatusData] = useState<any | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const fetchCloudStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/database/cloud-status');
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch (err: any) {
      console.error('Erro ao buscar status do Firestore:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleSyncFromCloud = async () => {
    setSyncStatus('loading');
    setSyncError(null);
    try {
      const res = await fetch('/api/database/sync-from-cloud', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncStatus('success');
        await fetchCloudStatus();
        setTimeout(() => {
          setSyncStatus('idle');
          window.location.reload();
        }, 1200);
      } else {
        setSyncStatus('error');
        setSyncError(data.message || data.error || 'Erro desconhecido ao sincronizar.');
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(err?.message || 'Falha de conexão com o servidor.');
    }
  };

  useEffect(() => {
    fetchCloudStatus();
  }, []);

  const [mapsApiKey, setMapsApiKey] = useState(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('google_maps_api_key') || PRECONFIGURED_MAPS_KEY
      : PRECONFIGURED_MAPS_KEY;
  });
  const [isMapsActive, setIsMapsActive] = useState(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('google_maps_active') === 'true'
      : false;
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [mapsMsg, setMapsMsg] = useState('');

  // Voice Alert configurations stored with direct live local state sync
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('voice_alerts_enabled') !== 'false' : true;
  });
  const [voiceNear, setVoiceNear] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('voice_alerts_near') !== 'false' : true;
  });
  const [voiceInside, setVoiceInside] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('voice_alerts_inside') !== 'false' : true;
  });
  const [voiceExit, setVoiceExit] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('voice_alerts_exit') !== 'false' : true;
  });
  const [proximityVal, setProximityVal] = useState(() => {
    return typeof window !== 'undefined' ? Number(localStorage.getItem('voice_alerts_proximity') || '3000') : 3000;
  });
  const [volumeVal, setVolumeVal] = useState(() => {
    return typeof window !== 'undefined' ? Number(localStorage.getItem('voice_alerts_volume') || '1.0') : 1.0;
  });
  const [toastDurationVal, setToastDurationVal] = useState(() => {
    return typeof window !== 'undefined' ? Number(localStorage.getItem('voice_alerts_toast_duration') || '20') : 20;
  });

  // Direct sync of local state variables into local storage for the core real-time observer
  useEffect(() => {
    localStorage.setItem('voice_alerts_enabled', String(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
    localStorage.setItem('voice_alerts_near', String(voiceNear));
  }, [voiceNear]);

  useEffect(() => {
    localStorage.setItem('voice_alerts_inside', String(voiceInside));
  }, [voiceInside]);

  useEffect(() => {
    localStorage.setItem('voice_alerts_exit', String(voiceExit));
  }, [voiceExit]);

  useEffect(() => {
    localStorage.setItem('voice_alerts_proximity', String(proximityVal));
  }, [proximityVal]);

  useEffect(() => {
    localStorage.setItem('voice_alerts_volume', String(volumeVal));
  }, [volumeVal]);

  useEffect(() => {
    localStorage.setItem('voice_alerts_toast_duration', String(toastDurationVal));
  }, [toastDurationVal]);

  const handleTestVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const testMsg = "Sinal de teste. O sintetizador de voz do TransControl está ativo e monitorando aproximações de cercas eletrônicas para auxiliar a torre de controle.";
      const utterance = new SpeechSynthesisUtterance(testMsg);
      utterance.lang = 'pt-BR';
      utterance.volume = volumeVal;
      
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.startsWith('pt') || v.lang === 'pt-BR');
      if (ptVoice) {
        utterance.voice = ptVoice;
      }
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Seu navegador não suporta de forma nativa a síntese de voz (Web Speech Synthesis API).");
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async (initial = false) => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok && isMounted) {
          const data = await res.json();
          if (initial) {
            setDemoMode(data.demoMode);
            setSascarUser(data.sascarUser || '');
            if (data.sascarPass) {
              setSascarPass(data.sascarPass);
            }
          } else {
            setDemoMode(data.demoMode);
          }
          setLastSyncError(data.lastSyncError || null);
          setLastSyncTime(data.lastSyncTime || null);
        }
      } catch (err) {
        console.error('Erro ao buscar configurações do servidor:', err);
      }
    };

    fetchSettings(true);
    const interval = setInterval(() => fetchSettings(false), 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demoMode,
          sascarUser,
          sascarPass
        })
      });
      if (res.ok) {
        setSaveSettingsSuccess(true);
        setTimeout(() => setSaveSettingsSuccess(false), 3000);
      } else {
        alert('Erro ao salvar as configurações.');
      }
    } catch (err) {
      alert('Erro ao salvar as configurações: conexão falhou.');
    }
  };

  const handleActivateMaps = () => {
    const keyToSave = mapsApiKey.trim() || PRECONFIGURED_MAPS_KEY;
    localStorage.setItem('google_maps_api_key', keyToSave);
    localStorage.setItem('google_maps_active', 'true');
    setIsMapsActive(true);
    setSaveSuccess(true);
    setMapsMsg('Chave do Google Maps ativada com sucesso! Os mapas interativos e de satélite foram habilitados.');
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleDeactivateMaps = () => {
    localStorage.setItem('google_maps_active', 'false');
    setIsMapsActive(false);
    setSaveSuccess(true);
    setMapsMsg('Google Maps desativado. O sistema voltou a utilizar o mapa gratuito OpenStreetMap.');
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleSaveMapsKey = (e: React.FormEvent) => {
    e.preventDefault();
    const keyToSave = mapsApiKey.trim() || PRECONFIGURED_MAPS_KEY;
    localStorage.setItem('google_maps_api_key', keyToSave);
    setSaveSuccess(true);
    setMapsMsg('Chave do Google Maps salva com sucesso.');
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleResetMapsKey = () => {
    setMapsApiKey(PRECONFIGURED_MAPS_KEY);
    localStorage.setItem('google_maps_api_key', PRECONFIGURED_MAPS_KEY);
    setSaveSuccess(true);
    setMapsMsg('Chave restaurada para o valor pré-configurado do sistema.');
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleTestSoap = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    try {
      // Usando 'obterPacotePosicoesJSON' com quantidade 1 como teste real de conexão
      const xmlResponse = await callSascarSoap('obterPacotePosicoesJSON', {
        usuario: sascarUser,
        senha: sascarPass,
        quantidade: 1
      });
      setTestResult(xmlResponse);
    } catch (err: any) {
      setTestResult(`Erro de conexão SOAP: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* General Configuration Cards */}
      <div className="lg:col-span-2 space-y-4">
        {/* Toggle Mode */}
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Radio size={15} className="text-sky-400" />
            Modo do Servidor / Simulação
          </h2>
          <p className="text-[10px] text-slate-400 leading-snug">
            Configure se o sistema utilizará posições reais do integrador Sascar ou o motor de simulação contínua do Brasil.
          </p>

          <div className="space-y-2">
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-sky-500/30 bg-sky-500/5 cursor-pointer">
              <input
                type="radio"
                checked={demoMode}
                onChange={() => setDemoMode(true)}
                className="mt-0.5 accent-sky-500"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Modo Demonstração (Ativo)</span>
                <span className="text-[10px] text-slate-400 block leading-relaxed">
                  Simula o movimento real de 3 veículos ao longo das rodovias brasileiras (Campinas-Curitiba-São Paulo). Dispara cercas automáticas, transições de estado e permite simular upload de documentos CT-e com geradores mock rápidos.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#1f2d45] bg-[#0a0e1a]/40 cursor-pointer">
              <input
                type="radio"
                checked={!demoMode}
                onChange={() => setDemoMode(false)}
                className="mt-0.5 accent-sky-500"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-300 block">Modo Produção (Sincronização Sascar Live)</span>
                <span className="text-[10px] text-slate-500 block leading-relaxed">
                  Conecta-se à API SOAP real da Sascar para puxar posições de frotas ativas em tempo real usando suas credenciais.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* SOAP Credentials testing and saving */}
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <KeyRound size={15} className="text-sky-400" />
            Configurações e Integração SOAP Sascar
          </h2>
          <p className="text-[10px] text-slate-400 leading-snug">
            Insira suas credenciais da Sascar para conectar-se ao Web Service real. Salve as configurações no servidor para ativar a sincronização em tempo real de posições de veículos.
          </p>

          {/* Real-time Sync Status Indicator */}
          {!demoMode && (
            <div className={`p-3 rounded-lg border text-xs flex flex-col gap-1 ${
              lastSyncError 
                ? 'bg-red-500/10 border-red-500/20 text-red-300' 
                : lastSyncTime 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                  : 'bg-slate-500/10 border-slate-500/20 text-slate-300'
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <span className={`w-2 h-2 rounded-full ${
                    lastSyncError ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
                  }`} />
                  Status da Sincronização Sascar Live
                </span>
                <span className="text-[10px] opacity-80">
                  {lastSyncTime ? `Última sincronização: ${new Date(lastSyncTime).toLocaleTimeString('pt-BR')}` : 'Aguardando primeira conexão...'}
                </span>
              </div>
              
              {lastSyncError ? (
                <div className="text-[11px] mt-1 flex items-start gap-1.5">
                  <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-red-400">Falha na Conexão:</span> {lastSyncError}
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      O servidor Sascar recusou a autenticação. Verifique se o usuário e senha cadastrados estão corretos. O servidor continuará tentando restabelecer conexão automaticamente a cada 15 segundos.
                    </p>
                  </div>
                </div>
              ) : lastSyncTime ? (
                <div className="text-[11px] mt-1 flex items-start gap-1.5 text-slate-300">
                  <CheckCircle size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span>Conectado com sucesso ao Web Service Sascar. Posições de veículos e dados de motoristas atualizados em tempo real!</span>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                  Iniciando conexão com o Web Service da Sascar usando as credenciais informadas...
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Usuário Sascar</label>
                <input
                  type="text"
                  value={sascarUser}
                  onChange={e => setSascarUser(e.target.value)}
                  placeholder="Ex: WORKGR"
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Senha de Acesso</label>
                <input
                  type="password"
                  value={sascarPass}
                  onChange={e => setSascarPass(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-500 transition text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer"
              >
                Salvar Configurações no Servidor
              </button>
              
              <button
                type="button"
                onClick={handleTestSoap}
                disabled={testing || !sascarUser || !sascarPass}
                className="bg-[#1a2236] hover:bg-slate-800 transition text-slate-200 border border-[#1f2d45] text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {testing ? 'Comunicando...' : 'Testar Comunicação SOAP (obterPacotePosicoesJSON)'}
              </button>
            </div>
          </form>

          {saveSettingsSuccess && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2.5 py-1.5 animate-pulse">
              <CheckCircle size={14} />
              <span>Configurações e modo do servidor atualizados com sucesso no backend!</span>
            </div>
          )}

          {testResult && (
            <div className="bg-[#0a0e1a] rounded-lg border border-[#1f2d45] p-3 space-y-1.5">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold flex items-center gap-1">
                <Code size={11} className="text-sky-400" />
                Retorno JSON do Servidor (Proxy express)
              </span>
              <pre className="text-[9px] font-mono text-emerald-400 bg-[#0a0e1a] p-2 rounded border border-[#1f2d45]/40 overflow-x-auto max-h-[120px] leading-relaxed">
                {typeof testResult === 'object' ? JSON.stringify(testResult, null, 2) : testResult}
              </pre>
            </div>
          )}
        </div>

        {/* Google Maps API Key Config */}
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Map size={15} className="text-sky-400" />
              Configuração do Google Maps
            </h2>
            {isMapsActive ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle size={13} /> ATIVADO (Google Maps Ativo)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                <AlertCircle size={13} /> DESATIVADO (Usando OpenStreetMap Gratuito)
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            A chave do Google Maps está pré-configurada no sistema, porém <strong className="text-white">permanece desativada por padrão</strong>. Quando desativada, o sistema utiliza o mapa gratuito do OpenStreetMap. Clique no botão <strong className="text-emerald-400">Ativar Chave</strong> abaixo para habilitar o Google Maps.
          </p>

          <form onSubmit={handleSaveMapsKey} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Chave de API do Google Maps (Google Maps Platform Key)
                </label>
                {mapsApiKey === PRECONFIGURED_MAPS_KEY && (
                  <span className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                    Pré-configurada no Sistema
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={mapsApiKey}
                  onChange={e => setMapsApiKey(e.target.value)}
                  placeholder="Ex: AIzaSyD..."
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-2 pr-8 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
                />
                {mapsApiKey && (
                  <button
                    type="button"
                    onClick={() => setMapsApiKey('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-1 cursor-pointer"
                    title="Limpar campo"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {!isMapsActive ? (
                <button
                  type="button"
                  onClick={handleActivateMaps}
                  className="bg-emerald-600 hover:bg-emerald-500 transition text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  <Play size={14} /> Ativar Chave do Google Maps
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDeactivateMaps}
                  className="bg-amber-600/90 hover:bg-amber-500 transition text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-950/40"
                >
                  <Power size={14} /> Desativar Google Maps (Voltar ao OpenStreetMap)
                </button>
              )}

              <button
                type="submit"
                className="bg-sky-600/80 hover:bg-sky-500 transition text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                Salvar Chave
              </button>

              {mapsApiKey !== PRECONFIGURED_MAPS_KEY && (
                <button
                  type="button"
                  onClick={handleResetMapsKey}
                  className="bg-slate-800 hover:bg-slate-700 transition text-slate-300 border border-slate-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} /> Restaurar Chave Pré-configurada
                </button>
              )}
            </div>
          </form>

          {saveSuccess && (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
              <CheckCircle size={15} className="shrink-0" />
              <span>{mapsMsg || 'Configuração atualizada com sucesso!'}</span>
            </div>
          )}
        </div>

        {/* Vocal Geofencing Alerts Configurations */}
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Volume2 size={16} className="text-sky-400 animate-pulse" />
              Alertas de Voz para Cerca Eletrônica (Sintetizador)
            </h2>
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors ${
                voiceEnabled 
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
              }`}
            >
              {voiceEnabled ? (
                <>
                  <Volume2 size={12} /> Ativo
                </>
              ) : (
                <>
                  <VolumeX size={12} /> Mutado
                </>
              )}
            </button>
          </div>

          <p className="text-[10px] text-slate-400 leading-snug">
            Auxilie os operadores da torre de controle com alertas sonoros automáticos de voz toda vez que um veículo estiver se aproximando, entrar ou sair de uma cerca geográfica cadastrada no sistema.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Toggles */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Eventos Monitorados</span>
              
              <label className="flex items-center gap-2.5 p-2 bg-[#0a0e1a]/40 border border-[#1f2d45]/60 rounded-lg cursor-pointer hover:bg-slate-800/10 transition-colors">
                <input
                  type="checkbox"
                  checked={voiceNear}
                  onChange={e => setVoiceNear(e.target.checked)}
                  className="rounded border-[#1f2d45] bg-[#0a0e1a] text-sky-500 focus:ring-0 accent-sky-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Detectar Aproximação</span>
                  <span className="text-[9px] text-slate-500 block leading-tight">Dispara quando veículo chega próximo à cerca</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 bg-[#0a0e1a]/40 border border-[#1f2d45]/60 rounded-lg cursor-pointer hover:bg-slate-800/10 transition-colors">
                <input
                  type="checkbox"
                  checked={voiceInside}
                  onChange={e => setVoiceInside(e.target.checked)}
                  className="rounded border-[#1f2d45] bg-[#0a0e1a] text-sky-500 focus:ring-0 accent-sky-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Detectar Entrada</span>
                  <span className="text-[9px] text-slate-500 block leading-tight">Dispara no momento exato em que entra na cerca</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 bg-[#0a0e1a]/40 border border-[#1f2d45]/60 rounded-lg cursor-pointer hover:bg-slate-800/10 transition-colors">
                <input
                  type="checkbox"
                  checked={voiceExit}
                  onChange={e => setVoiceExit(e.target.checked)}
                  className="rounded border-[#1f2d45] bg-[#0a0e1a] text-sky-500 focus:ring-0 accent-sky-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Detectar Saída</span>
                  <span className="text-[9px] text-slate-500 block leading-tight">Dispara no momento exato em que sai da cerca</span>
                </div>
              </label>
            </div>

            {/* Custom parameters */}
            <div className="space-y-3 bg-[#0a0e1a]/30 p-3 rounded-lg border border-[#1f2d45]/40 flex flex-col justify-between">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                    <span>Raio de Proximidade</span>
                    <span className="text-sky-400 font-mono font-medium lowercase">{proximityVal} metros ({(proximityVal / 1000).toFixed(1)} km)</span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="10000"
                    step="500"
                    value={proximityVal}
                    onChange={e => setProximityVal(Number(e.target.value))}
                    className="w-full h-1 bg-[#1f2d45] rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <span className="text-[8px] text-slate-500 font-mono block leading-none mt-1">Margem para disparo de alerta de aproximação antes da entrada exata na cerca</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                    <span>Volume do Alerta</span>
                    <span className="text-sky-400 font-mono font-medium">{Math.round(volumeVal * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volumeVal}
                    onChange={e => setVolumeVal(Number(e.target.value))}
                    className="w-full h-1 bg-[#1f2d45] rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                    <span>Tempo de Exibição do Alerta (Tela)</span>
                    <span className="text-sky-400 font-mono font-medium">{toastDurationVal} segundos</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={toastDurationVal}
                    onChange={e => setToastDurationVal(Number(e.target.value))}
                    className="w-full h-1 bg-[#1f2d45] rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <span className="text-[8px] text-slate-500 font-mono block leading-none mt-1">Tempo que o alerta visual (texto) permanece visível no topo da tela</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#1f2d45]/40">
                <button
                  type="button"
                  onClick={handleTestVoice}
                  className="w-full bg-[#1a2236] hover:bg-[#25324e] text-slate-200 border border-[#1f2d45] hover:border-sky-500/30 font-bold font-mono text-[10px] uppercase tracking-wider py-2 rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Volume2 size={13} className="text-sky-400" /> Testar Voz de Alerta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture FAQ and Info */}
      <div className="lg:col-span-1 space-y-4">
        {/* Sincronização da Nuvem */}
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider border-b border-[#1f2d45] pb-2">
            <Database size={15} className="text-emerald-400" />
            Sincronização de Banco de Dados
          </h2>
          <p className="text-[10px] text-slate-400 leading-snug">
            Sincronize as informações do banco de dados em tempo real. Esta ferramenta alimenta os dados da versão <strong>PUBLICADA</strong> diretamente para esta versão em <strong>CONSTRUÇÃO</strong>.
          </p>

          {/* Counts Status Comparison */}
          {statusData && statusData.success && (
            <div className="space-y-2.5 bg-[#0a0e1a]/40 border border-[#1f2d45]/60 rounded-lg p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center justify-between">
                <span>Resumo de Registros</span>
                {statusData.cloud.updatedAt && (
                  <span className="text-emerald-400 normal-case font-mono text-[9px]">
                    Nuvem: {new Date(statusData.cloud.updatedAt).toLocaleTimeString('pt-BR')} {new Date(statusData.cloud.updatedAt).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase tracking-wide block">Versão Publicada</span>
                  <ul className="space-y-1 text-slate-300 font-mono">
                    <li>🚚 Veículos: <strong>{statusData.cloud.counts.vehicles}</strong></li>
                    <li>👤 Motoristas: <strong>{statusData.cloud.counts.drivers}</strong></li>
                    <li>🗺️ Geocercas: <strong>{statusData.cloud.counts.geofences}</strong></li>
                    <li>🏁 Viagens: <strong>{statusData.cloud.counts.trips}</strong></li>
                  </ul>
                </div>
                <div className="space-y-1 border-l border-[#1f2d45] pl-2">
                  <span className="text-slate-500 uppercase tracking-wide block">Em Construção</span>
                  <ul className="space-y-1 text-slate-300 font-mono">
                    <li>🚚 Veículos: <strong>{statusData.local.counts.vehicles}</strong></li>
                    <li>👤 Motoristas: <strong>{statusData.local.counts.drivers}</strong></li>
                    <li>🗺️ Geocercas: <strong>{statusData.local.counts.geofences}</strong></li>
                    <li>🏁 Viagens: <strong>{statusData.local.counts.trips}</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleSyncFromCloud}
              disabled={syncStatus === 'loading' || loadingStatus}
              className={`w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-1.5 cursor-pointer`}
            >
              <RefreshCw size={13} className={syncStatus === 'loading' ? 'animate-spin' : ''} />
              {syncStatus === 'loading' ? 'Sincronizando...' : 'Alimentar Nuvem → Local'}
            </button>

            <button
              type="button"
              onClick={fetchCloudStatus}
              disabled={syncStatus === 'loading' || loadingStatus}
              className="w-full bg-transparent hover:bg-slate-800/20 text-slate-300 border border-[#1f2d45] text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 cursor-pointer"
            >
              Atualizar Comparativo
            </button>
          </div>

          {syncStatus === 'success' && (
            <div className="flex items-start gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded p-2 animate-pulse leading-snug">
              <CheckCircle size={14} className="shrink-0 mt-0.5" />
              <span>Sincronização concluída com sucesso! Os dados locais foram atualizados a partir do banco de dados publicado e as telas foram recarregadas.</span>
            </div>
          )}

          {syncStatus === 'error' && (
            <div className="flex items-start gap-1.5 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded p-2 leading-snug">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Erro de Sincronização:</span>
                <p className="mt-0.5 text-slate-300">{syncError}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider border-b border-[#1f2d45] pb-2">
            <HelpCircle size={15} className="text-sky-400" />
            Entendendo a Engenharia
          </h2>

          <div className="space-y-3.5 text-[11px] text-slate-300 leading-relaxed">
            <div className="space-y-0.5">
              <p className="font-bold text-slate-200">1. Como funciona o Proxy SOAP Sascar?</p>
              <p className="text-slate-400">
                APIs legadas de rastreamento utilizam SOAP 1.1 em XML e não fornecem cabeçalhos CORS, impedindo chamadas diretas pelo navegador. Criamos um roteador em Node.js (`server.ts`) que monta o envelope XML, injeta os cabeçalhos HTTPS apropriados e repassa a requisição com TLS v1.2 de forma 100% segura.
              </p>
            </div>

            <div className="space-y-0.5">
              <p className="font-bold text-slate-200">2. Como as Geocercas são monitoradas?</p>
              <p className="text-slate-400">
                O servidor roda um loop contínuo que calcula a distância de cada frota para as cercas cadastradas através da fórmula matemática de Haversine. Esse cálculo projeta a curvatura da Terra fornecendo métricas de aproximação extremamente precisas em metros.
              </p>
            </div>

            <div className="space-y-0.5">
              <p className="font-bold text-slate-200">3. O Parser do CT-e lê quais tags?</p>
              <p className="text-gray-400">
                Lemos o namespace oficial da SEFAZ de documentos eletrônicos (`http://www.portalfiscal.inf.br/cte`). O parser frontend processa tags estruturais como `nCT` (número), `vCarga` (valor de carga), `vTPrest` (serviço) e dados dos participantes em `emit`, `rem` e `dest`.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
