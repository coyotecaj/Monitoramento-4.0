import React, { useState, useMemo } from 'react';
import { Vehicle } from '../types';
import { 
  Wrench, 
  Calendar, 
  ClipboardList, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  Clock, 
  Plus, 
  Search, 
  Trash2, 
  User, 
  ExternalLink,
  Settings,
  RefreshCw
} from 'lucide-react';

interface MaintenanceProps {
  vehicles: Vehicle[];
  onUpdateVehicleMaintenance: (
    id: string, 
    data: { 
      inMaintenance: boolean; 
      maintenanceReason?: string | null; 
      maintenanceExpectedDate?: string | null; 
    }
  ) => Promise<void>;
  onNavigate: (page: string) => void;
}

export default function Maintenance({ 
  vehicles, 
  onUpdateVehicleMaintenance,
  onNavigate
}: MaintenanceProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [reason, setReason] = useState('');
  const [hasExpectedDate, setHasExpectedDate] = useState(true);
  const [expectedDate, setExpectedDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter vehicles that are currently in maintenance
  const maintenanceVehicles = useMemo(() => {
    return vehicles.filter(v => v.status === 'MAINTENANCE');
  }, [vehicles]);

  // Filter vehicles that are available to be put in maintenance (all except those currently in maintenance)
  const availableToMaintenance = useMemo(() => {
    return vehicles.filter(v => v.status !== 'MAINTENANCE');
  }, [vehicles]);

  // Filtered maintenance list for search
  const filteredMaintenance = useMemo(() => {
    if (!searchTerm) return maintenanceVehicles;
    const lower = searchTerm.toLowerCase();
    return maintenanceVehicles.filter(v => 
      v.licensePlate.toLowerCase().includes(lower) ||
      v.model.toLowerCase().includes(lower) ||
      (v.maintenanceReason && v.maintenanceReason.toLowerCase().includes(lower))
    );
  }, [maintenanceVehicles, searchTerm]);

  // Handle placing a vehicle in maintenance
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) {
      setErrorMsg('Selecione um veículo.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Informe o motivo da manutenção.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const targetDate = hasExpectedDate && expectedDate ? new Date(expectedDate).toISOString() : null;
      await onUpdateVehicleMaintenance(selectedVehicleId, {
        inMaintenance: true,
        maintenanceReason: reason,
        maintenanceExpectedDate: targetDate
      });

      setSuccessMsg('Veículo colocado em manutenção com sucesso!');
      setSelectedVehicleId('');
      setReason('');
      setExpectedDate('');
      setHasExpectedDate(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao colocar veículo em manutenção.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle releasing a vehicle from maintenance
  const handleRelease = async (id: string, licensePlate?: string) => {
    setReleasingId(id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await onUpdateVehicleMaintenance(id, {
        inMaintenance: false
      });
      setSuccessMsg(`Veículo ${licensePlate ? `(${licensePlate})` : ''} liberado da manutenção com sucesso!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao liberar veículo.');
    } finally {
      setReleasingId(null);
    }
  };

  // Stats calculations
  const totalInMaintenance = maintenanceVehicles.length;
  const inMaintenanceWithoutDate = maintenanceVehicles.filter(v => !v.maintenanceExpectedDate).length;
  const inMaintenanceWithDate = totalInMaintenance - inMaintenanceWithoutDate;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d45] pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-wide">
            <Wrench className="text-yellow-400 animate-pulse" size={22} />
            Controle de Oficina & Manutenção
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestão operacional de frotas paradas, reparos em andamento e previsão de liberação para a torre de controle.
          </p>
        </div>
        <button
          onClick={() => onNavigate('map')}
          className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 transition duration-200 cursor-pointer self-start"
        >
          Ver no Mapa
          <ExternalLink size={13} />
        </button>
      </div>

      {/* Alert Banner for Operations */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-300">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-300">
          <AlertTriangle size={16} />
          {errorMsg}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-400/10 text-yellow-400">
            <Truck size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Veículos na Oficina</span>
            <span className="block text-2xl font-bold text-white font-mono mt-0.5">{totalInMaintenance}</span>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
            <Calendar size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Com Liberação Definida</span>
            <span className="block text-2xl font-bold text-white font-mono mt-0.5">{inMaintenanceWithDate}</span>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Previsão em Aberto</span>
            <span className="block text-2xl font-bold text-white font-mono mt-0.5">{inMaintenanceWithoutDate}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Workshop Form (Adicionar Manutenção) */}
        <div className="lg:col-span-5 bg-[#111827] border border-[#1f2d45] rounded-xl p-5 space-y-4">
          <div className="border-b border-[#1f2d45]/60 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
              <Plus className="text-sky-400" size={16} />
              Registrar Entrada na Oficina
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Informe os dados técnicos para que a torre de controle possa identificar o veículo quebrado no mapa.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Vehicle Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Veículo Fora de Serviço</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
                required
              >
                <option value="">Selecione um veículo...</option>
                {availableToMaintenance.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.licensePlate} - {v.model.replace(/\(.*\)/g, '')} {v.driverName ? `(${v.driverName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Maintenance Reason */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Motivo da Manutenção / Descrição do Defeito</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Vazamento de óleo hidráulico, quebra de embreagem, revisão mecânica preventiva..."
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors min-h-[80px] resize-none"
                required
              />
            </div>

            {/* Expected Date Control */}
            <div className="space-y-3 bg-[#0a0e1a]/50 border border-[#1f2d45]/40 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Previsão de Liberação</span>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!hasExpectedDate}
                    onChange={(e) => setHasExpectedDate(!e.target.checked)}
                    className="rounded bg-[#0a0e1a] border-[#1f2d45] text-sky-500 focus:ring-0 focus:ring-offset-0"
                  />
                  Deixar em aberto
                </label>
              </div>

              {hasExpectedDate ? (
                <div className="relative">
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
                    required
                  />
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 font-mono italic">
                  Sem data definida. A torre de controle será alertada sobre a ausência de previsão operacional.
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold transition duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <Wrench size={14} />
              {isSubmitting ? 'Salvando...' : 'Colocar em Manutenção'}
            </button>
          </form>
        </div>

        {/* Right Column: Workshop Vehicles Grid/List (Em Manutenção Atualmente) */}
        <div className="lg:col-span-7 bg-[#111827] border border-[#1f2d45] rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1f2d45]/60 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                <ClipboardList className="text-yellow-400" size={16} />
                Veículos em Oficina Atualmente
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Listagem em tempo real enviada via Server-Sent Events (SSE) para a telemetria.</p>
            </div>
            
            {/* Search filter */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
              <input
                type="text"
                placeholder="Filtrar placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Table list of vehicles currently in maintenance */}
          {filteredMaintenance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 border border-dashed border-[#1f2d45] rounded-xl">
              <CheckCircle2 className="text-emerald-500 w-8 h-8 animate-bounce" />
              <p className="text-xs font-semibold text-white">Nenhum Veículo em Manutenção</p>
              <p className="text-[10px] text-slate-400 max-w-xs">Todos os caminhões da frota estão disponíveis para trânsito ou viagem operacional.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredMaintenance.map(v => (
                <div 
                  key={v.id} 
                  className="bg-[#0a0e1a]/80 border border-[#1f2d45] rounded-xl p-4 flex flex-col sm:flex-row justify-between gap-4 hover:border-yellow-500/30 transition-colors duration-200"
                >
                  <div className="space-y-2">
                    {/* Plate & model */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded">
                        {v.licensePlate}
                      </span>
                      <span className="text-xs font-semibold text-white truncate max-w-[200px]" title={v.model}>
                        {v.model.replace(/\(.*\)/g, '')}
                      </span>
                    </div>

                    {/* Reason */}
                    {v.maintenanceReason && (
                      <p className="text-[11px] text-slate-300 bg-[#111827] border border-[#1f2d45]/40 px-2.5 py-1.5 rounded-lg leading-relaxed">
                        <span className="font-bold text-slate-400">Defeito:</span> {v.maintenanceReason}
                      </p>
                    )}

                    {/* Dates metadata */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-400 font-mono">
                      {v.maintenanceStartDate && (
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-slate-500" />
                          <span>Entrada: {new Date(v.maintenanceStartDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} className={v.maintenanceExpectedDate ? 'text-sky-400' : 'text-amber-500'} />
                        <span className={v.maintenanceExpectedDate ? 'text-slate-300 font-bold' : 'text-amber-400 font-bold'}>
                          Liberação: {v.maintenanceExpectedDate 
                            ? new Date(v.maintenanceExpectedDate).toLocaleDateString('pt-BR') 
                            : 'Em aberto (Sem previsão)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex sm:flex-col justify-end items-end shrink-0 gap-2">
                    <button
                      onClick={() => handleRelease(v.id, v.licensePlate)}
                      disabled={releasingId === v.id}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 self-start sm:self-auto"
                    >
                      {releasingId === v.id ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          Liberando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} />
                          Liberar Frota
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
