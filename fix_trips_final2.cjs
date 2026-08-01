const fs = require('fs');
let code = fs.readFileSync('src/pages/Trips.tsx', 'utf8');

const target1 = `                              </span>
                            )}
                          )}
                     <div className="flex gap-1.5 flex-wrap">`;

const replace1 = `                              </span>
                            )}
                          </div>
                     <div className="flex gap-1.5 flex-wrap">`;

code = code.replace(target1, replace1);

const target2 = `                        <>
                          <span className="font-bold text-slate-200 block mt-0.5">{vehicle?.licensePlate}</span>
                        </>
                        </div>
                   </div>
                      </div>`;

const replace2 = `                        <>
                          <span className="font-bold text-slate-200 block mt-0.5">{vehicle?.licensePlate}</span>
                        </>
                      )}
                    </div>`;

code = code.replace(target2, replace2);

const target3 = `                        <>
                          <span className="font-bold text-slate-200 block mt-0.5">{driver?.name}</span>
                        </>
                        </div>
                   </div>
                      </div>`;

const replace3 = `                        <>
                          <span className="font-bold text-slate-200 block mt-0.5">{driver?.name}</span>
                        </>
                      )}
                    </div>`;

code = code.replace(target3, replace3);

const target4 = `                        <>
                          <span className="font-bold text-slate-200 block mt-0.5">{origin?.name}</span>
                        </>
                        </div>
                   </div>
                      </div>`;

const replace4 = `                        <>
                          <span className="font-bold text-slate-200 block mt-0.5">{origin?.name}</span>
                        </>
                      )}
                    </div>`;

code = code.replace(target4, replace4);

const target5 = `                        <>
                          <span className="font-bold text-slate-200 block mt-0.5">{dest?.name}</span>
                        </>
                        </div>
                   </div>
                      </div>`;

const replace5 = `                        <>
                          <span className="font-bold text-slate-200 block mt-0.5">{dest?.name}</span>
                        </>
                      )}
                    </div>`;

code = code.replace(target5, replace5);

const target6 = `                        <>
                          <span className="font-bold text-slate-200 block mt-0.5">{new Date(trip.scheduledLoadingDate).toLocaleDateString()}</span>
                        </>
                        </div>
                   </div>
                      </div>`;

const replace6 = `                        <>
                          <span className="font-bold text-slate-200 block mt-0.5">{new Date(trip.scheduledLoadingDate).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>`;

code = code.replace(target6, replace6);

const target7 = `                              <span className="text-slate-400">Tempo de Viagem</span>
                            </div>
                            <span className="font-mono font-bold text-slate-200">{trip.metadata.totalTransitTimeMins >= 60 ? \`\${Math.floor(trip.metadata.totalTransitTimeMins / 60)}h \${trip.metadata.totalTransitTimeMins % 60}min\` : \`\${trip.metadata.totalTransitTimeMins} min\`}</span>
                          </div>
                        </div>
                   </div>`;

const replace7 = `                              <span className="text-slate-400">Tempo de Viagem</span>
                            </div>
                            <span className="font-mono font-bold text-slate-200">{trip.metadata.totalTransitTimeMins >= 60 ? \`\${Math.floor(trip.metadata.totalTransitTimeMins / 60)}h \${trip.metadata.totalTransitTimeMins % 60}min\` : \`\${trip.metadata.totalTransitTimeMins} min\`}</span>
                          </div>
                        )}
                      </div>`;

code = code.replace(target7, replace7);


const target8 = `                              Ver Rota no Mapa
                            </button>
                        </div>
                   </div>`;

const replace8 = `                              Ver Rota no Mapa
                            </button>
                          </div>
                        </div>`;

code = code.replace(target8, replace8);

const target9 = `                          </div>
                   </div>
                      </div>
                      </div>
                      </div>`;
const replace9 = `                          </div>
                        </div>
                      </div>
                    </div>`;
code = code.replace(target9, replace9);

fs.writeFileSync('src/pages/Trips.tsx', code);
