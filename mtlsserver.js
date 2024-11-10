const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

const debugLog = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DEBUG] ${message}`);
};

const loadCertificate = (filename) => {
  try {
    const certPath = path.resolve(__dirname, filename);
    debugLog(`Loading certificate from: ${certPath}`);
    
    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificate file not found: ${filename}`);
    }
    
    const cert = fs.readFileSync(certPath, 'utf8');
    debugLog(`Loaded ${filename} successfully`);
    debugLog(`Certificate length: ${cert.length}`);
    return cert;
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    throw error;
  }
};

try {
  const options = {
    key: loadCertificate('server_key.pem'),
    cert: loadCertificate('server_cert.pem'),
    ca: loadCertificate('ca_cert.pem'),
    requestCert: true,
    rejectUnauthorized: true,
    
    // allowed protocols and ciphers
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
  };


  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Test endpoint
  app.get('/', (req, res) => {
    const clientCert = req.socket.getPeerCertificate();
    
    debugLog('Received request');
    debugLog(`Client authorized: ${req.client.authorized}`);
    if (clientCert) {
      debugLog(`Client certificate subject: ${JSON.stringify(clientCert.subject)}`);
    }

    if (req.client.authorized) {
      debugLog('Client successfully authenticated');
      res.json({
        status: 'success',
        message: 'mTLS connection successful',
        clientInfo: {
          subject: clientCert.subject,
          issuer: clientCert.issuer,
          valid_from: clientCert.valid_from,
          valid_to: clientCert.valid_to
        }
      });
    } else {
      debugLog('Client authentication failed');
      res.status(401).json({
        status: 'error',
        message: 'Client certificate verification failed'
      });
    }
  });

  const server = https.createServer(options, app);

  server.on('error', (error) => {
    console.error('Server error:', error);
  });

  server.on('tlsClientError', (error, tlsSocket) => {
    console.error('TLS Client error:', error);
    if (tlsSocket && tlsSocket.getProtocol()) {
      debugLog(`TLS Socket Info - Protocol: ${tlsSocket.getProtocol()}`);
    }
  });

  server.on('secureConnection', (tlsSocket) => {
    debugLog('Secure connection established');
    if (tlsSocket.getProtocol()) {
      debugLog(`Protocol: ${tlsSocket.getProtocol()}`);
    }
    if (tlsSocket.getCipher()) {
      debugLog(`Cipher: ${tlsSocket.getCipher().name}`);
    }
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });

  server.listen(8446, () => {
    console.log('mTLS server listening on port 8446');
  });

} catch (error) {
  console.error('Server initialization error:', error);
  process.exit(1);
}