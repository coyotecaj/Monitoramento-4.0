import React, { useState, useEffect } from 'react';
import { Trip, Vehicle, Driver, Geofence, CteInfo } from '../types';
import { FileText, X, AlertCircle, CheckCircle, Truck, User, MapPin, Sparkles, Building2 } from 'lucide-react';
import { getTripInternalId } from '../utils/trip';

interface CteModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  vehicles: Vehicle[];
  drivers: Driver[];
  geofences: Geofence[];
  onUploadCte: (tripId: string, cteData: CteInfo) => void | Promise<void>;
}

export default function CteModal({
  isOpen,
  onClose,
  trip,
  vehicles,
  drivers,
  geofences,
  onUploadCte,
}: CteModalProps) {
  const [cteInput, setCteInput] = useState('');
  const [volumeInput, setVolumeInput] = useState('');
  const [freteInput, setFreteInput] = useState('');
  const [xmlError, setXmlError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (trip?.cteInfo) {
      setCteInput(trip.cteInfo.nCT || '');
      setVolumeInput(trip.cteInfo.volume ? String(trip.cteInfo.volume) : (trip.loadedVolumeM3 ? String(trip.loadedVolumeM3) : ''));
      setFreteInput(trip.cteInfo.valorFrete ? trip.cteInfo.valorFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    } else if (trip) {
      setCteInput('');
      setVolumeInput(trip.loadedVolumeM3 ? String(trip.loadedVolumeM3) : '');
      setFreteInput('');
    }
    setXmlError(null);
  }, [trip]);

  if (!isOpen || !trip) return null;

  const vehicle = vehicles.find(v => v.id === trip.vehicleId);
  const driver = drivers.find(d => d.id === trip.driverId);
  const origin = geofences.find(g => g.id === trip.originGeofenceId);
  const dest = geofences.find(g => g.id === trip.destinationGeofenceId);

  const driverName = driver?.name || trip.cteInfo?.motoristaNome || vehicle?.driverName || 'Não informado';

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

  const handleSimulate = () => {
    setCteInput(Math.floor(100000 + Math.random() * 900000).toString());
    setVolumeInput((Math.floor(15 + Math.random() * 50)).toString());
    setFreteInput((Math.floor(2500 + Math.random() * 3000)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setXmlError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cteInput.trim() || !volumeInput.trim() || !freteInput.trim()) {
      setXmlError('Por favor, preencha todas as informações obrigatórias.');
      return;
    }

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

    const cteData: CteInfo = {
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
      motoristaNome: driverName,
      placaVeiculo: vehicle?.licensePlate || 'TRA-0000',
      reboquePlacas: ['REB-8A90'],
      apoliceSeguro: 'APL-98234-82',
      seguradora: 'Porto Seguro',
      volume: vVolume,
      valorFrete: vFrete
    };

    setIsSubmitting(true);
    try {
      await onUploadCte(trip.id, cteData);
      onClose();
    } catch (err) {
      setXmlError('Ocorreu um erro ao salvar os dados do CT-e.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111827] border border-[#1f2d45] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f2d45] bg-[#162032]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-400">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                Preenchimento de CT-e
                <span className="font-mono text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  {getTripInternalId(trip)}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Informe o Conhecimento de Transporte para esta viagem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {trip.status === 'WAITING_UNLOADING' && trip.hasExitedDest && !trip.cteInfo && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5 text-emerald-300 text-xs">
              <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="font-extrabold text-emerald-300 uppercase tracking-wide">Preenchimento de CT-e para Conclusão de Entrega</p>
                <p className="text-[11px] text-emerald-300/90 mt-0.5 leading-snug">
                  O veículo concluiu o descarregamento no destino. Preencha os dados do CT-e para finalizar esta viagem.
                </p>
              </div>
            </div>
          )}

          {/* Trip Summary Card */}
          <div className="bg-[#0a0e1a] border border-[#1f2d45] rounded-xl p-3.5 space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Veículo / Placa</span>
                <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <Truck size={13} className="text-sky-400 shrink-0" />
                  {vehicle ? `${vehicle.licensePlate} (${vehicle.model})` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Motorista</span>
                <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5 truncate">
                  <User size={13} className="text-indigo-400 shrink-0" />
                  {driverName}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1f2d45]/50 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Origem</span>
                <span className="font-semibold text-slate-300 flex items-center gap-1.5 mt-0.5 truncate">
                  <Building2 size={13} className="text-amber-400 shrink-0" />
                  {origin?.name || 'Carregamento'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Destino</span>
                <span className="font-semibold text-slate-300 flex items-center gap-1.5 mt-0.5 truncate">
                  <MapPin size={13} className="text-emerald-400 shrink-0" />
                  {dest?.name || 'Descarregamento'}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] text-slate-300 uppercase font-bold tracking-wider mb-1.5">
                Número do CT-e *
              </label>
              <input
                type="text"
                required
                value={cteInput}
                onChange={e => setCteInput(e.target.value)}
                placeholder="Ex: 482394"
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/80 font-mono transition shadow-inner"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-300 uppercase font-bold tracking-wider mb-1.5">
                  Volume (m³) *
                </label>
                <input
                  type="text"
                  required
                  value={volumeInput}
                  onChange={e => setVolumeInput(e.target.value)}
                  placeholder="Ex: 35.00"
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/80 font-mono transition shadow-inner"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 uppercase font-bold tracking-wider mb-1.5">
                  Valor Frete (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={freteInput}
                  onChange={e => setFreteInput(e.target.value)}
                  placeholder="Ex: 2.976,86"
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/80 font-mono transition shadow-inner"
                />
              </div>
            </div>

            {xmlError && (
              <p className="text-xs text-rose-400 font-semibold flex items-center gap-1.5 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                <AlertCircle size={15} className="shrink-0 text-rose-400" />
                {xmlError}
              </p>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-[#1f2d45]/80 gap-2">
              <button
                type="button"
                onClick={handleSimulate}
                className="text-xs text-sky-400 hover:text-sky-300 font-bold tracking-wide transition cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20"
              >
                <Sparkles size={14} className="text-sky-400" />
                Simular Preenchimento
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-bold text-slate-400 hover:text-white bg-[#1a2236] hover:bg-slate-800 rounded-xl transition cursor-pointer border border-[#1f2d45]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-4 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                >
                  <CheckCircle size={15} />
                  {isSubmitting ? 'Salvando...' : 'Salvar CT-e'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
