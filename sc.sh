#!/bin/bash

# Create directories
mkdir -p certs
cd certs

# Generate CA private key and certificate
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 365 -key ca.key -out ca.crt -subj "/CN=Test CA"

# Generate server private key and CSR
openssl genrsa -out server.key 4096
openssl req -new -key server.key -out server.csr -subj "/CN=localhost"

# Sign server certificate with CA
openssl x509 -req -days 365 -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt

# Generate client private key and CSR
openssl genrsa -out client.key 4096
openssl req -new -key client.key -out client.csr -subj "/CN=TestClient"

# Sign client certificate with CA
openssl x509 -req -days 365 -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt

# Create PKCS12 file for client (optional - for browser testing)
openssl pkcs12 -export -out client.p12 -inkey client.key -in client.crt -certfile ca.crt -passout pass:password

# Clean up CSR files
rm *.csr

echo "Certificates generated successfully!"