const fs = require('fs');
let code = fs.readFileSync('src/pages/Trips.tsx', 'utf8');

const target1 = `                          <div className="flex gap-2">
                            {trip.productName && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/15 rounded px-1.5 py-0.5 w-fit font-bold uppercase">
                                <Package size={10} />
                                Carga: {trip.productName}
                              </span>
                              </div>
                   </div>
                      </div>
                      </div>
                      </div>
                      </div>
                      </div>
                      </div>
                      )}
                            {trip.contractId && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded px-1.5 py-0.5 w-fit font-bold uppercase">
                                <FileText size={10} />
                                {contracts?.find(c => c.id === trip.contractId)?.clientName || 'Contrato'}
                                {trip.loadedVolumeM3 ? \` (\${trip.loadedVolumeM3}m³)\` : ''}
                              </span>
                              </div>
                   </div>
                      </div>
                      </div>
                      )}
                        </div>
                   </div>`;

const replace1 = `                          <div className="flex gap-2">
                            {trip.productName && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/15 rounded px-1.5 py-0.5 w-fit font-bold uppercase">
                                <Package size={10} />
                                Carga: {trip.productName}
                              </span>
                            )}
                            {trip.contractId && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded px-1.5 py-0.5 w-fit font-bold uppercase">
                                <FileText size={10} />
                                {contracts?.find(c => c.id === trip.contractId)?.clientName || 'Contrato'}
                                {trip.loadedVolumeM3 ? \` (\${trip.loadedVolumeM3}m³)\` : ''}
                              </span>
                            )}
                          </div>`;

code = code.replace(target1, replace1);

// Run a regex replacement globally for corrupted `</div> </div> </div>` etc
code = code.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)}/g, ')}');
code = code.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)}/g, ')}');
code = code.replace(/<\/span>\s*<\/div>\s*<\/div>\s*\)}/g, '</span>)}');


fs.writeFileSync('src/pages/Trips.tsx', code);
