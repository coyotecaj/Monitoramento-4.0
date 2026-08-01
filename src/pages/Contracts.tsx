import React, { useState, useMemo } from 'react';
import { Contract, Trip } from '../types';
import { Plus, Search, Calendar, Briefcase, FileText, Trash2, Edit2, Check, X, ShieldAlert, Truck } from 'lucide-react';

interface ContractsProps {
  contracts: Contract[];
  trips: Trip[];
  onCreateContract: (data: { clientName: string; cnpj: string; volumeM3: number; startDate: string; endDate: string; status?: string }) => void;
  onUpdateContract: (id: string, data: { clientName?: string; cnpj?: string; volumeM3?: number; startDate?: string; endDate?: string; status?: string }) => void;
  onDeleteContract: (id: string) => void;
}

export default function Contracts({ contracts, trips, onCreateContract, onUpdateContract, onDeleteContract }: ContractsProps) {
  // Form state
  const [clientName, setClientName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [volumeM3, setVolumeM3] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [editVolumeM3, setEditVolumeM3] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState<any>('ACTIVE');

  const filteredContracts = useMemo(() => {
    if (!searchTerm) return contracts;
    const lower = searchTerm.toLowerCase();
    return contracts.filter(c => 
      c.clientName.toLowerCase().includes(lower) || 
      c.cnpj.toLowerCase().includes(lower) ||
      (c.status && c.status.toLowerCase().includes(lower))
    );
  }, [contracts, searchTerm]);

  // Handle CNPJ formatting automatically as user types
  const formatCnpjValue = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 14);
    if (raw.length <= 2) return raw;
    if (raw.length <= 5) return `${raw.slice(0, 2)}.${raw.slice(2)}`;
    if (raw.length <= 8) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
    if (raw.length <= 12) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
    return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(formatCnpjValue(e.target.value));
  };

  const handleEditCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditCnpj(formatCnpjValue(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !cnpj.trim() || !volumeM3 || !startDate || !endDate) return;

    // Calculate initial status based on date range
    const todayStr = new Date().toISOString().split('T')[0];
    let status: 'ACTIVE' | 'PENDING' | 'EXPIRED' = 'ACTIVE';
    if (todayStr < startDate) {
      status = 'PENDING';
    } else if (todayStr > endDate) {
      status = 'EXPIRED';
    }

    onCreateContract({
      clientName: clientName.trim(),
      cnpj: cnpj.trim(),
      volumeM3: Number(volumeM3),
      startDate,
      endDate,
      status
    });

    setClientName('');
    setCnpj('');
    setVolumeM3('');
    setStartDate('');
    setEndDate('');
  };

  const handleStartEdit = (contract: Contract) => {
    setEditingId(contract.id);
    setEditClientName(contract.clientName);
    setEditCnpj(contract.cnpj);
    setEditVolumeM3(String(contract.volumeM3));
    setEditStartDate(contract.startDate);
    setEditEndDate(contract.endDate);
    setEditStatus(contract.status || 'ACTIVE');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!editClientName.trim() || !editCnpj.trim() || !editVolumeM3 || !editStartDate || !editEndDate) return;
    
    onUpdateContract(id, {
      clientName: editClientName.trim(),
      cnpj: editCnpj.trim(),
      volumeM3: Number(editVolumeM3),
      startDate: editStartDate,
      endDate: editEndDate,
      status: editStatus
    });
    setEditingId(null);
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
      case 'PENDING':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
      case 'EXPIRED':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/25';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/25';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Vigente / Ativo';
      case 'PENDING':
        return 'Aguardando Início';
      case 'EXPIRED':
        return 'Expirado';
      default:
        return status || 'Ativo';
    }
  };

  // Format volume to localized string
  const formatVolume = (vol: number) => {
    return vol.toLocaleString('pt-BR') + ' m³';
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" id="contracts-container">
      {/* Contract Registration Panel */}
      <div className="xl:col-span-1 space-y-4" id="contracts-registration-panel">
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Plus size={15} className="text-sky-400" />
            Criar Novo Contrato
          </h2>
          <p className="text-[10px] text-slate-400 leading-snug">
            Configure novos contratos de transporte, definindo as metas volumétricas, documentos CNPJ do cliente e o prazo de vigência correspondente.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Nome do Cliente</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Ex: Construtora Alfa S.A."
                required
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">CNPJ do Cliente</label>
              <input
                type="text"
                value={cnpj}
                onChange={handleCnpjChange}
                placeholder="Ex: 00.000.000/0001-00"
                required
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Quantidade Programada (m³)</label>
              <input
                type="number"
                value={volumeM3}
                onChange={e => setVolumeM3(e.target.value)}
                placeholder="Ex: 1200"
                required
                min="1"
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Data de Início</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-sky-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Data de Fim</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  required
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-sky-500/50"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-500 transition text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Plus size={13} />
              Criar Contrato
            </button>
          </form>
        </div>
      </div>

      {/* Contracts List Panel */}
      <div className="xl:col-span-2 space-y-4" id="contracts-list-panel">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Contratos de Clientes</h2>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Buscar por cliente, CNPJ, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111827] border border-[#1f2d45] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredContracts.map(c => {
            const isEditing = editingId === c.id;
                    // Calculate linked trips stats
                    const linkedTrips = trips.filter(t => 
                      t.contractId === c.id || 
                      (t.cteInfo && c.clientName && (
                        t.cteInfo.remetente?.name?.toLowerCase().includes(c.clientName.toLowerCase()) || 
                        t.cteInfo.destinatario?.name?.toLowerCase().includes(c.clientName.toLowerCase())
                      ))
                    );
                    const totalLoadedVolume = linkedTrips.reduce((acc, t) => {
                      const vol = Number(t.loadedVolumeM3) || Number(t.cteInfo?.volume) || 0;
                      return acc + (isNaN(vol) ? 0 : vol);
                    }, 0);
                    const percentageRaw = c.volumeM3 > 0 ? (totalLoadedVolume / c.volumeM3) * 100 : 0;
                    let percentageDisplay = '0%';
                    if (percentageRaw > 0) {
                      if (percentageRaw < 0.01) {
                        percentageDisplay = '< 0,01%';
                      } else if (percentageRaw < 10) {
                        percentageDisplay = `${percentageRaw.toFixed(1).replace('.', ',')}%`;
                      } else {
                        percentageDisplay = `${Math.round(percentageRaw)}%`;
                      }
                    }

                    return (
                      <div key={c.id} className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3 flex flex-col justify-between" id={`contract-card-${c.id}`}>
                        {isEditing ? (
                          // Edit view
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Nome do Cliente</label>
                      <input
                        type="text"
                        value={editClientName}
                        onChange={e => setEditClientName(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">CNPJ</label>
                      <input
                        type="text"
                        value={editCnpj}
                        onChange={handleEditCnpjChange}
                        className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Vol (m³)</label>
                        <input
                          type="number"
                          value={editVolumeM3}
                          onChange={e => setEditVolumeM3(e.target.value)}
                          className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Status</label>
                        <select
                          value={editStatus}
                          onChange={e => setEditStatus(e.target.value)}
                          className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50"
                        >
                          <option value="ACTIVE">Vigente</option>
                          <option value="PENDING">Aguardando Início</option>
                          <option value="EXPIRED">Expirado</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Início</label>
                        <input
                          type="date"
                          value={editStartDate}
                          onChange={e => setEditStartDate(e.target.value)}
                          className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Fim</label>
                        <input
                          type="date"
                          value={editEndDate}
                          onChange={e => setEditEndDate(e.target.value)}
                          className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 transition text-[10px] text-slate-300 font-semibold rounded flex items-center gap-1 cursor-pointer"
                      >
                        <X size={11} /> Cancelar
                      </button>
                      <button
                        onClick={() => handleSaveEdit(c.id)}
                        className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 transition text-[10px] text-white font-semibold rounded flex items-center gap-1 cursor-pointer"
                      >
                        <Check size={11} /> Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  // Static view
                  <div className="space-y-3 flex flex-col justify-between h-full">
                    <div>
                      {/* Header */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-[#0a0e1a] border border-[#1f2d45]/80 text-sky-400 rounded-lg">
                            <FileText size={16} />
                          </div>
                          <div>
                            <h3 className="font-bold text-xs text-white leading-tight">{c.clientName}</h3>
                            <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                              CNPJ: {c.cnpj}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${getStatusBadgeClass(c.status)}`}>
                            {getStatusLabel(c.status)}
                          </span>
                        </div>
                      </div>

                      {/* Info / Metadata block */}
                      <div className="grid grid-cols-2 gap-3 bg-[#0a0e1a]/40 p-2.5 border border-[#1f2d45]/20 rounded-lg mt-3">
                        <div>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide block">Volume Contratado</span>
                          <span className="text-xs font-bold text-slate-200 mt-0.5 block font-mono">{formatVolume(c.volumeM3)}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide block">Período Vigente</span>
                          <span className="text-[10px] font-medium text-slate-300 mt-0.5 flex items-center gap-1">
                            <Calendar size={11} className="text-slate-500" />
                            {c.startDate.split('-').reverse().join('/')} - {c.endDate.split('-').reverse().join('/')}
                          </span>
                        </div>
                      </div>

                      {/* Progress block */}
                      <div className="bg-[#0a0e1a]/40 p-2.5 border border-[#1f2d45]/20 rounded-lg mt-3">
                        <div className="flex justify-between items-end mb-1.5">
                          <div>
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide block">Volume Descarregado / Progresso</span>
                            <span className="text-xs font-bold text-sky-400 mt-0.5 block font-mono">
                              {formatVolume(totalLoadedVolume)} <span className="text-slate-500 text-[10px]">/ {formatVolume(c.volumeM3)}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded border ${
                              percentageRaw >= 100
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : percentageRaw > 0
                                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                                : 'bg-slate-800/80 text-slate-400 border-slate-700/50'
                            }`}>
                              {percentageDisplay}
                            </span>
                            <div className="flex items-center gap-1.5 text-right">
                              <Truck size={10} className="text-slate-500" />
                              <span className="text-[10px] font-bold text-slate-300">{linkedTrips.length} viagens</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-full bg-[#1f2d45] rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${percentageRaw >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} 
                            style={{ width: `${totalLoadedVolume > 0 ? Math.max(Math.min(100, percentageRaw), 2) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-between items-center pt-2 border-t border-[#1f2d45]/40 mt-1">
                      <span className="text-[9px] text-slate-500 flex items-center gap-1 italic">
                        <Briefcase size={10} />
                        Gestão de Logística
                      </span>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleStartEdit(c)}
                          title="Editar Contrato"
                          className="p-1 hover:bg-[#1f2d45]/50 hover:text-white transition text-slate-400 rounded cursor-pointer"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => {
                            onDeleteContract(c.id);
                          }}
                          title="Remover Contrato"
                          className="p-1 hover:bg-rose-500/10 hover:text-rose-400 transition text-slate-500 rounded cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredContracts.length === 0 && (
            <div className="col-span-full bg-[#111827] border border-[#1f2d45]/60 border-dashed rounded-xl p-8 text-center text-slate-500 text-xs">
              Nenhum contrato cadastrado que atenda à sua busca.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
