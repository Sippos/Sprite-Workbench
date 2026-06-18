const fs = require('fs');

const appSource = fs.readFileSync('src/App.tsx.backup', 'utf-8');
const lines = appSource.split('\n');

const appStart = lines.findIndex(l => l.startsWith('function App() {'));

// The top level return is exactly around line 1344.
const appReturn = 1343;

const hookBody = lines.slice(appStart + 1, appReturn).join('\n');

// The helpers start at async function fileToSpriteFrame which is around line 2600.
// Let's find it properly.
const helpersStart = lines.findIndex(l => l.startsWith('async function fileToSpriteFrame'));
// We slice to the end, but remove the "export default App;" at the end if it exists.
let helpersCodeLines = lines.slice(helpersStart);
helpersCodeLines = helpersCodeLines.filter(l => !l.includes('export default App;'));
const helpersCode = helpersCodeLines.join('\n');

const prefix = fs.readFileSync('prefix.txt', 'utf-8');
const suffix = fs.readFileSync('suffix.txt', 'utf-8');

fs.writeFileSync('src/store/ProjectContext.tsx', prefix + '\n' + hookBody + '\n' + suffix + '\n\n' + helpersCode);
console.log('ProjectContext.tsx generated successfully.');
