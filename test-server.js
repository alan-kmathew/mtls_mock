// test-server.js
const { spawn } = require('child_process');
const path = require('path');

console.log('Starting server and running diagnostics...');

// Start the server
const server = spawn('node', ['server.js'], {
  stdio: 'inherit'
});

// Wait for server to start
setTimeout(() => {
  console.log('\nRunning diagnostics...');
  const diagnostics = spawn('node', ['server-diagnostics.js'], {
    stdio: 'inherit'
  });

  diagnostics.on('close', (code) => {
    console.log(`\nDiagnostics completed with code ${code}`);
    server.kill();
    process.exit(code);
  });
}, 2000);

process.on('SIGINT', () => {
  server.kill();
  process.exit();
});