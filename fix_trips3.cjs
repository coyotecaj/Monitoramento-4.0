const fs = require('fs');
let code = fs.readFileSync('src/pages/Trips.tsx', 'utf8');

const regex7 = /{vehicle\?\.status !== 'MAINTENANCE' && \([\s\S]*?<div className="space-y-1\.5 bg-\[#0a0e1a\] p-3 rounded-lg border border-\[#1f2d45\]\/80">[\s\S]*?<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1\.5 pb-1">[\s\S]*?<p className="text-\[9px\] font-bold text-slate-400 uppercase tracking-wider">Máquina de Estados Automatizada<\/p>[\s\S]*?{trip\.status === 'SCHEDULED' && countdown && \([\s\S]*?<span className={\`text-\[9px\] font-mono font-bold px-2 py-0\.5 rounded text-center sm:text-right \${[\s\S]*?countdown\.urgent \? 'bg-rose-500\/10 text-rose-400 border border-rose-500\/20' : 'bg-sky-500\/10 text-sky-400 border border-sky-500\/20'[\s\S]*?}\`}>[\s\S]*?{countdown\.text}[\s\S]*?<\/span>[\s\S]*?\)}[\s\S]*?<\/div>[\s\S]*?<div className="grid grid-cols-5 gap-1 text-center text-\[8px\] font-semibold">[\s\S]*?{\/\* State Step 1 \*\/}/m;

const replacement7 = `{vehicle?.status !== 'MAINTENANCE' && (
                    <div className="space-y-1.5 bg-[#0a0e1a] p-3 rounded-lg border border-[#1f2d45]/80">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Máquina de Estados Automatizada</p>
                        {trip.status === 'SCHEDULED' && countdown && (
                          <span className={\`text-[9px] font-mono font-bold px-2 py-0.5 rounded text-center sm:text-right \${
                            countdown.urgent ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          }\`}>
                            {countdown.text}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-1 text-center text-[8px] font-semibold">
                         {/* State Step 1 */}`;

code = code.replace(regex7, replacement7);

fs.writeFileSync('src/pages/Trips.tsx', code);
