const { execSync } = require('child_process');
const fs = require('fs');

try {
  let output = execSync('npx tsc --noEmit', { stdio: 'pipe' }).toString();
} catch (e) {
  let out = e.stdout.toString() + e.stderr.toString();
  // We need to parse out and auto add closing divs to the end of the file or matching lines.
  
  // Honestly I will just nuke the page and recreate a simpler version if it doesn't work this time
}
