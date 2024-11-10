// server-diagnostics.mjs
import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ServerDiagnostics {
  constructor(port = 3443) {
    this.port = port;
    this.results = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    let coloredMessage;

    switch(type) {
      case 'success':
        coloredMessage = `✓ ${message}`;
        console.log(`[${timestamp}] ${coloredMessage} (Success)`);
        break;
      case 'error':
        coloredMessage = `✗ ${message}`;
        console.log(`[${timestamp}] ${coloredMessage} (Error)`);
        break;
      case 'warning':
        coloredMessage = `⚠ ${message}`;
        console.log(`[${timestamp}] ${coloredMessage} (Warning)`);
        break;
      default:
        coloredMessage = `ℹ ${message}`;
        console.log(`[${timestamp}] ${coloredMessage} (Info)`);
    }

    this.results.push({ timestamp, message, type });
  }

  async runDiagnostics() {
    console.log('\n=== Starting Server Diagnostics ===\n');

    // 1. Check required files
    this.checkRequiredFiles();

    // 2. Validate certificate chain
    this.validateCertificates();

    // 3. Check server configuration
    this.checkServerConfiguration();

    // 4. Test server accessibility
    await this.testServerAccess();

    this.printSummary();
  }

  checkRequiredFiles() {
    console.log('\n1. Checking Required Files:\n');
    
    const requiredFiles = [
      { path: 'server_key.pem', description: 'Server Private Key' },
      { path: 'server_cert.pem', description: 'Server Certificate' },
      { path: 'ca_cert.pem', description: 'CA Certificate' }
    ];

    requiredFiles.forEach(file => {
      try {
        fs.accessSync(path.join(__dirname, file.path));
        this.log(`${file.description} (${file.path}) exists`, 'success');
        
        const stats = fs.statSync(path.join(__dirname, file.path));
        const permissions = stats.mode & parseInt('777', 8);
        
        if (file.path === 'server_key.pem' && (permissions & parseInt('044', 8))) {
          this.log(`${file.path} has too open permissions: ${permissions.toString(8)}`, 'warning');
        }
      } catch (error) {
        this.log(`${file.description} (${file.path}) is missing: ${error.message}`, 'error');
      }
    });
  }

  validateCertificates() {
    console.log('\n2. Validating Certificates:\n');

    try {
      const caCertPem = fs.readFileSync(path.join(__dirname, 'ca_cert.pem'), 'utf8');
      const serverCertPem = fs.readFileSync(path.join(__dirname, 'server_cert.pem'), 'utf8');
      
      const caCert = forge.pki.certificateFromPem(caCertPem);
      const serverCert = forge.pki.certificateFromPem(serverCertPem);

      this.log('CA Certificate loaded successfully', 'success');
      this.log(`CA Certificate Subject: ${caCert.subject.getField('CN').value}`);
      
      if (caCert.extensions.find(ext => ext.name === 'basicConstraints')?.cA) {
        this.log('CA Certificate has correct basicConstraints', 'success');
      } else {
        this.log('CA Certificate missing proper basicConstraints', 'error');
      }

      this.log('Server Certificate loaded successfully', 'success');
      this.log(`Server Certificate Subject: ${serverCert.subject.getField('CN').value}`);
      
      try {
        if (serverCert.verify(caCert.publicKey)) {
          this.log('Server Certificate is properly signed by CA', 'success');
        } else {
          this.log('Server Certificate verification failed', 'error');
        }
      } catch (error) {
        this.log(`Certificate verification error: ${error.message}`, 'error');
      }

      const now = new Date();
      if (now > serverCert.validity.notBefore && now < serverCert.validity.notAfter) {
        this.log('Server Certificate is within validity period', 'success');
      } else {
        this.log('Server Certificate is not valid at current date', 'error');
      }

    } catch (error) {
      this.log(`Certificate validation error: ${error.message}`, 'error');
    }
  }

  checkServerConfiguration() {
    console.log('\n3. Checking Server Configuration:\n');
    
    try {
      const serverFile = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
      
      const checks = [
        { pattern: /requestCert:\s*true/, message: 'Client certificate request enabled' },
        { pattern: /rejectUnauthorized:\s*true/, message: 'Unauthorized clients rejected' },
        { pattern: /express\.json/, message: 'JSON body parser configured' },
        { pattern: /\/api\/protected/, message: 'Protected endpoint defined' }
      ];

      checks.forEach(check => {
        if (check.pattern.test(serverFile)) {
          this.log(check.message, 'success');
        } else {
          this.log(`Missing configuration: ${check.message}`, 'error');
        }
      });

    } catch (error) {
      this.log(`Server configuration check error: ${error.message}`, 'error');
    }
  }

  async testServerAccess() {
    console.log('\n4. Testing Server Accessibility:\n');

    return new Promise((resolve) => {
      try {
        const req = https.request({
          hostname: 'localhost',
          port: this.port,
          path: '/api/health',
          method: 'GET',
          rejectUnauthorized: false // For testing only
        }, (res) => {
          this.log(`Server responded with status: ${res.statusCode}`, 
            res.statusCode === 200 ? 'success' : 'warning');
          resolve();
        });

        req.on('error', (error) => {
          this.log(`Server access error: ${error.message}`, 'error');
          resolve();
        });

        req.end();
      } catch (error) {
        this.log(`Server test error: ${error.message}`, 'error');
        resolve();
      }
    });
  }

  printSummary() {
    console.log('\n=== Diagnostic Summary ===\n');

    const counts = {
      success: this.results.filter(r => r.type === 'success').length,
      error: this.results.filter(r => r.type === 'error').length,
      warning: this.results.filter(r => r.type === 'warning').length
    };

    console.log(`Passed: ${counts.success}`);
    console.log(`Failed: ${counts.error}`);
    console.log(`Warnings: ${counts.warning}`);

    if (counts.error > 0) {
      console.log('\nRequired Actions:');
      this.results
        .filter(r => r.type === 'error')
        .forEach(r => console.log(`- ${r.message}`));
    }

    if (counts.warning > 0) {
      console.log('\nRecommendations:');
      this.results
        .filter(r => r.type === 'warning')
        .forEach(r => console.log(`- ${r.message}`));
    }
  }
}

// Run diagnostics
const diagnostics = new ServerDiagnostics();
diagnostics.runDiagnostics();