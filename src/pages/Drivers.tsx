import React, { useState, useMemo } from 'react';
import { Driver } from '../types';
import { Users, Plus, Phone, CreditCard, Search, Edit2, Check, X } from 'lucide-react';

interface DriversProps {
  drivers: Driver[];
  onCreateDriver: (data: { name: string; cpf: string; phone?: string; licenseNumber?: string }) => void;
  onUpdateDriver?: (id: string, data: { name?: string; cpf?: string; phone?: string; licenseNumber?: string }) => void;
}

export default function Drivers({ drivers, onCreateDriver, onUpdateDriver }: DriversProps) {
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLicenseNumber, setEditLicenseNumber] = useState('');

  const filteredDrivers = useMemo(() => {
    if (!searchTerm) return drivers;
    const lower = searchTerm.toLowerCase();
    return drivers.filter(d => 
      d.name.toLowerCase().includes(lower) || 
      d.cpf.toLowerCase().includes(lower) ||
      (d.phone && d.phone.toLowerCase().includes(lower)) ||
      (d.licenseNumber && d.licenseNumber.toLowerCase().includes(lower))
    );
  }, [drivers, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cpf.trim()) return;

    onCreateDriver({
      name,
      cpf,
      phone,
      licenseNumber,
    });

    setName('');
    setCpf('');
    setPhone('');
    setLicenseNumber('');
  };

  const startEditing = (d: Driver) => {
    setEditingDriverId(d.id);
    setEditName(d.name);
    setEditCpf(d.cpf);
    setEditPhone(d.phone || '');
    setEditLicenseNumber(d.licenseNumber || '');
  };

  const cancelEditing = () => {
    setEditingDriverId(null);
    setEditName('');
    setEditCpf('');
    setEditPhone('');
    setEditLicenseNumber('');
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim() || !editCpf.trim()) return;
    if (onUpdateDriver) {
      onUpdateDriver(id, {
        name: editName.trim(),
        cpf: editCpf.trim(),
        phone: editPhone.trim(),
        licenseNumber: editLicenseNumber.trim(),
      });
    }
    cancelEditing();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Driver Registration */}
      <div className="xl:col-span-1 space-y-4">
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Plus size={15} className="text-sky-400" />
            Cadastrar Motorista Profissional
          </h2>
          <p className="text-[10px] text-slate-400 leading-snug">
            Adicione motoristas autorizados para guiar frotas de transporte vinculadas às viagens do sistema.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Carlos Eduardo de Oliveira"
                required
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">CPF</label>
              <input
                type="text"
                value={cpf}
                onChange={e => setCpf(e.target.value)}
                placeholder="Ex: 123.456.789-10"
                required
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Telefone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Ex: (11) 98765-4321"
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">CNH (Categoria)</label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={e => setLicenseNumber(e.target.value)}
                  placeholder="Ex: CNH-E 12345"
                  className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-500 transition text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={13} />
              Cadastrar Motorista
            </button>
          </form>
        </div>
      </div>

      {/* Drivers List */}
      <div className="xl:col-span-2 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Motoristas Autorizados</h2>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou CNH..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111827] border border-[#1f2d45] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDrivers.map(d => {
            const isEditing = editingDriverId === d.id;

            if (isEditing) {
              return (
                <div key={d.id} className="bg-[#111827] border border-sky-500/50 rounded-xl p-3.5 space-y-3 shadow-lg shadow-sky-500/5">
                  <div className="flex justify-between items-center border-b border-[#1f2d45] pb-2">
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wide">Editar Motorista</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleSaveEdit(d.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 transition"
                      >
                        <Check size={12} />
                        Salvar
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 transition"
                      >
                        <X size={12} />
                        Cancelar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Nome</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">CPF</label>
                      <input
                        type="text"
                        value={editCpf}
                        onChange={e => setEditCpf(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Telefone</label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                          className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">CNH</label>
                        <input
                          type="text"
                          value={editLicenseNumber}
                          onChange={e => setEditLicenseNumber(e.target.value)}
                          className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={d.id} className="bg-[#111827] border border-[#1f2d45] rounded-xl p-3.5 space-y-2.5 hover:border-[#2e4266] transition">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[#0a0e1a] border border-[#1f2d45]/80 text-slate-400 rounded-lg">
                      <Users size={14} />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-white block">{d.name}</span>
                      <span className="text-[9px] text-slate-500 font-mono leading-none block mt-0.5">CPF: {d.cpf}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase ${
                      d.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    }`}>
                      {d.status === 'AVAILABLE' ? 'Disponível' : 'Em Viagem'}
                    </span>

                    <button
                      onClick={() => startEditing(d)}
                      title="Editar motorista"
                      className="p-1.5 bg-[#0a0e1a] hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 border border-[#1f2d45] hover:border-sky-500/40 rounded-lg transition"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-[#1f2d45]/40 pt-2 text-slate-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <Phone size={11} className="text-slate-500" />
                    <span>{d.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard size={11} className="text-slate-500" />
                    <span>{d.licenseNumber || 'N/A'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
