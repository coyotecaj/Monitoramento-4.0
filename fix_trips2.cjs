const fs = require('fs');
let code = fs.readFileSync('src/pages/Trips.tsx', 'utf8');

const regex3 = /<div className="bg-\[#0a0e1a\] p-2\.5 rounded-lg border border-\[#1f2d45\]\/60">[\s\S]*?<span className="text-\[9px\] text-slate-500 block uppercase font-bold">Caminhão<\/span>[\s\S]*?<span className="font-bold text-slate-200 block text-xs mt-0\.5">{vehicle\?\.licensePlate \|\| 'Não Vinculado'}<\/span>[\s\S]*?<\/div>[\s\S]*?<span className="text-\[8px\] text-slate-400 font-mono">{vehicle\?\.model \|\| 'Desconhecido'}<\/span>/m;

const replacement3 = `<div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Caminhão</span>
                        <span className="font-bold text-slate-200 block text-xs mt-0.5">{vehicle?.licensePlate || 'Não Vinculado'}</span>
                        <span className="text-[8px] text-slate-400 font-mono">{vehicle?.model || 'Desconhecido'}</span>
                      </div>`;

code = code.replace(regex3, replacement3);

const regex4 = /<div className="bg-\[#0a0e1a\] p-2\.5 rounded-lg border border-\[#1f2d45\]\/60">[\s\S]*?<span className="text-\[9px\] text-slate-500 block uppercase font-bold">Motorista<\/span>[\s\S]*?<span className="font-bold text-slate-200 block text-xs mt-0\.5 truncate">{driver\?\.name \|\| 'Não Vinculado'}<\/span>[\s\S]*?<\/div>[\s\S]*?<span className="text-\[8px\] text-slate-400 font-mono">CPF: {driver\?\.cpf \|\| 'Desconhecido'}<\/span>/m;

const replacement4 = `<div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Motorista</span>
                        <span className="font-bold text-slate-200 block text-xs mt-0.5 truncate">{driver?.name || 'Não Vinculado'}</span>
                        <span className="text-[8px] text-slate-400 font-mono">CPF: {driver?.cpf || 'Desconhecido'}</span>
                      </div>`;
                      
code = code.replace(regex4, replacement4);

const regex5 = /<div className="bg-\[#0a0e1a\] p-2\.5 rounded-lg border border-\[#1f2d45\]\/60">[\s\S]*?<span className="text-\[9px\] text-slate-500 block uppercase font-bold">Origem<\/span>[\s\S]*?<span className="font-bold text-slate-200 block text-xs mt-0\.5 truncate">{origin\?\.name \|\| 'N\/A'}<\/span>[\s\S]*?<\/div>[\s\S]*?<span className="text-\[8px\] text-slate-400 font-mono">Raio: {origin\?\.radius}m<\/span>/m;

const replacement5 = `<div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Origem</span>
                        <span className="font-bold text-slate-200 block text-xs mt-0.5 truncate">{origin?.name || 'N/A'}</span>
                        <span className="text-[8px] text-slate-400 font-mono">Raio: {origin?.radius}m</span>
                      </div>`;
                      
code = code.replace(regex5, replacement5);

const regex6 = /<div className="bg-\[#0a0e1a\] p-2\.5 rounded-lg border border-\[#1f2d45\]\/60">[\s\S]*?<span className="text-\[9px\] text-slate-500 block uppercase font-bold">Destino<\/span>[\s\S]*?<span className="font-bold text-slate-200 block text-xs mt-0\.5 truncate">{dest\?\.name \|\| 'N\/A'}<\/span>[\s\S]*?<\/div>[\s\S]*?<span className="text-\[8px\] text-slate-400 font-mono">Raio: {dest\?\.radius}m<\/span>/m;

const replacement6 = `<div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Destino</span>
                        <span className="font-bold text-slate-200 block text-xs mt-0.5 truncate">{dest?.name || 'N/A'}</span>
                        <span className="text-[8px] text-slate-400 font-mono">Raio: {dest?.radius}m</span>
                      </div>`;
                      
code = code.replace(regex6, replacement6);

fs.writeFileSync('src/pages/Trips.tsx', code);
