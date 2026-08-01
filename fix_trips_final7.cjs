const fs = require('fs');
let code = fs.readFileSync('src/pages/Trips.tsx', 'utf8');

const target1 = `                            )}
                          )}
                     <div className="flex gap-1.5 flex-wrap">`;

const replace1 = `                            )}
                          </div>
                     <div className="flex gap-1.5 flex-wrap">`;

code = code.replace(target1, replace1);

fs.writeFileSync('src/pages/Trips.tsx', code);
