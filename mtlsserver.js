const https = require('https');
const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;
const express = require('express');
const app = express();

const DOMAIN_NAME = 'https://mtlsserver-52a108593257.herokuapp.com';

const debugLog = (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DEBUG] ${message}`);
};

const generateCertificate = (keyFile, certFile) => {
    try {
        debugLog('Generating new certificate...');
        execSync(`openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 -keyout ${keyFile} -out ${certFile} -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=${DOMAIN_NAME}"`);
        debugLog('New certificate generated successfully');
    } catch (error) {
        console.error('Error generating new certificate:', error);
        throw error;
    }
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
    const keyFile = 'server_key.pem';
    const certFile = 'server_cert.pem';
    const caFile = 'ca_cert.pem';

    // Generate new certificates if they do not exist
    if (!fs.existsSync(path.resolve(__dirname, keyFile)) || !fs.existsSync(path.resolve(__dirname, certFile))) {
        generateCertificate(keyFile, certFile);
    }

    const options = {
        key: loadCertificate(keyFile),
        cert: loadCertificate(certFile),
        ca: loadCertificate(caFile),
        requestCert: true,
        rejectUnauthorized: true,
        // allowed protocols and ciphers
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
    };

    app.use((req, res, next) => {
        debugLog('Received incoming request');
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
        debugLog('Processing GET request');
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

    const PORT = 8446;
    server.listen(PORT, () => {
        console.log(`mTLS server listening on port ${PORT}`);
    });

} catch (error) {
    console.error('Server initialization error:', error);
    process.exit(1);
}