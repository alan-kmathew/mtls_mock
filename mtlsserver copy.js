const https = require('https');
const fs = require('fs');
const path = require('path');

// Add debug logging
const debugLog = (message) => {
  console.log(`[DEBUG] ${message}`);
};

// Load certificates with error handling
const loadCertificate = (filename) => {
  try {
    const cert = fs.readFileSync(path.resolve(__dirname, filename));
    debugLog(`Loaded ${filename} successfully`);
    debugLog(`Certificate length: ${cert.length}`);
    return cert;
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    throw error;
  }
};

const serverKey = loadCertificate('server_key.pem');
const serverCert = loadCertificate('server_cert.pem');
const caCert = loadCertificate('ca_cert.pem');

const options = {
  key: serverKey,
  cert: serverCert,
  ca: caCert,
  requestCert: true,
  rejectUnauthorized: true,
  // Add debug options
  handshakeTimeout: 120000,  // Increase timeout for debugging
  debug: true
};

const server = https.createServer(options, (req, res) => {
  debugLog('Received request');
  debugLog(`Client authorized: ${req.client.authorized}`);
  debugLog(`Client certificate: ${req.client.getPeerCertificate(true)}`);
  
  if (req.client.authorized) {
    debugLog('Client successfully authenticated');
    res.writeHead(200);
    res.end('Hello, secure world! mTLS connection successful.');
  } else {
    debugLog('Client authentication failed');
    res.writeHead(401);
    res.end('Client certificate verification failed.');
  }
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

server.on('tlsClientError', (error) => {
  console.error('TLS Client error:', error);
});

server.listen(8443, () => {
  console.log('mTLS server listening on port 8443');
});

