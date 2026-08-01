import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { Package, Plus, Search, Tag, FileText, Trash2, Edit2, Check, X } from 'lucide-react';

interface ProductsProps {
  products: Product[];
  onCreateProduct: (data: { name: string; code?: string; description?: string }) => void;
  onUpdateProduct: (id: string, data: { name?: string; code?: string; description?: string }) => void;
  onDeleteProduct: (id: string) => void;
}

export default function Products({ products, onCreateProduct, onUpdateProduct, onDeleteProduct }: ProductsProps) {
  // Add state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lower = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      (p.code && p.code.toLowerCase().includes(lower)) ||
      (p.description && p.description.toLowerCase().includes(lower))
    );
  }, [products, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateProduct({
      name,
      code: code.trim() || undefined,
      description: description.trim() || undefined,
    });

    setName('');
    setCode('');
    setDescription('');
  };

  const handleStartEdit = (product: Product) => {
    setEditingId(product.id);
    setEditName(product.name);
    setEditCode(product.code || '');
    setEditDescription(product.description || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    onUpdateProduct(id, {
      name: editName,
      code: editCode.trim() || undefined,
      description: editDescription.trim() || undefined,
    });
    setEditingId(null);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Product Registration */}
      <div className="xl:col-span-1 space-y-4">
        <div className="bg-[#111827] border border-[#1f2d45] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Plus size={15} className="text-sky-400" />
            Cadastrar Novo Produto
          </h2>
          <p className="text-[10px] text-slate-400 leading-snug">
            Adicione tipos de produtos e cargas autorizadas para transporte que podem ser associadas às ordens de viagem.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Nome do Produto / Carga</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Alimentos Perecíveis"
                required
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Código / SKU (Opcional)</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Ex: PROD-102"
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Descrição do Tipo de Carga (Opcional)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex: Requer temperatura controlada a 4ºC..."
                rows={3}
                className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500/50 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-500 transition text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={13} />
              Cadastrar Produto
            </button>
          </form>
        </div>
      </div>

      {/* Products List */}
      <div className="xl:col-span-2 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Produtos Cadastrados</h2>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Buscar por produto, código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111827] border border-[#1f2d45] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map(p => {
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} className="bg-[#111827] border border-[#1f2d45] rounded-xl p-3.5 space-y-2.5">
                {isEditing ? (
                  // Edit View
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Nome do Produto</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Código</label>
                      <input
                        type="text"
                        value={editCode}
                        onChange={e => setEditCode(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Descrição</label>
                      <textarea
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        rows={2}
                        className="w-full bg-[#0a0e1a] border border-[#1f2d45] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500/50 resize-none"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 transition text-[10px] text-slate-300 font-semibold rounded flex items-center gap-1 cursor-pointer"
                      >
                        <X size={11} /> Cancelar
                      </button>
                      <button
                        onClick={() => handleSaveEdit(p.id)}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 transition text-[10px] text-white font-semibold rounded flex items-center gap-1 cursor-pointer"
                      >
                        <Check size={11} /> Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  // Static View
                  <div className="flex flex-col h-full justify-between gap-2.5">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-[#0a0e1a] border border-[#1f2d45]/80 text-sky-400 rounded-lg">
                            <Package size={14} />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-white block">{p.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono leading-none block mt-0.5 flex items-center gap-1">
                              <Tag size={9} />
                              {p.code || 'SEM CÓDIGO'}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleStartEdit(p)}
                            title="Editar Produto"
                            className="p-1 hover:bg-[#1f2d45]/50 hover:text-white transition text-slate-400 rounded cursor-pointer"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => {
                              onDeleteProduct(p.id);
                            }}
                            title="Remover Produto"
                            className="p-1 hover:bg-rose-500/10 hover:text-rose-400 transition text-slate-500 rounded cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {p.description ? (
                        <p className="text-[10px] text-slate-400 flex items-start gap-1 leading-snug bg-[#0a0e1a]/40 p-2 border border-[#1f2d45]/20 rounded-lg">
                          <FileText size={11} className="text-slate-500 shrink-0 mt-0.5" />
                          <span>{p.description}</span>
                        </p>
                      ) : (
                        <p className="text-[9px] text-slate-500 italic leading-snug bg-[#0a0e1a]/20 p-2 border border-[#1f2d45]/10 border-dashed rounded-lg">
                          Sem descrição adicional fornecida para este tipo de carga.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full bg-[#111827] border border-[#1f2d45]/60 border-dashed rounded-xl p-8 text-center text-slate-500 text-xs">
              Nenhum produto cadastrado que atenda à sua busca.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
