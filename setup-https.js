const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certsDir = path.join(__dirname, 'certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

console.log('🔐 Setting up HTTPS for local development...\n');

// Method 1: Try using mkcert (if installed)
try {
  execSync('mkcert --version', { stdio: 'ignore' });
  console.log('✅ mkcert is installed\n');
  console.log('📝 Generating SSL certificates using mkcert...');
  
  try {
    execSync(`mkcert -install`, { stdio: 'inherit' });
  } catch (e) {
    console.log('⚠️  Could not install CA (may need admin). Continuing...\n');
  }
  
  const keyFile = path.join(certsDir, 'localhost-key.pem');
  const certFile = path.join(certsDir, 'localhost.pem');
  execSync(`mkcert -key-file "${keyFile}" -cert-file "${certFile}" localhost`, { stdio: 'inherit', shell: true });
  
  console.log('\n✅ SSL certificates generated successfully!');
  console.log('📁 Certificates saved in:', certsDir);
  console.log('\n🚀 You can now run: npm run dev:https\n');
  process.exit(0);
} catch (error) {
  // mkcert not found, continue to alternative
}

// Method 2: Generate self-signed certificate using OpenSSL (if available)
console.log('📝 Trying to generate certificates using OpenSSL...\n');

try {
  const keyPath = path.join(certsDir, 'localhost-key.pem');
  const certPath = path.join(certsDir, 'localhost.pem');
  
  // Generate private key
  execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'inherit' });
  
  // Generate certificate
  execSync(`openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -subj "/CN=localhost"`, { stdio: 'inherit' });
  
  console.log('\n✅ SSL certificates generated successfully!');
  console.log('📁 Certificates saved in:', certsDir);
  console.log('\n🚀 You can now run: npm run dev:https\n');
  console.log('⚠️  Note: You may see a security warning in your browser.');
  console.log('   This is normal for self-signed certificates. Click "Advanced" → "Proceed to localhost"\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ OpenSSL not found.\n');
}

// Method 3: Instructions for manual setup
console.log('📦 To set up HTTPS, choose one of these options:\n');
console.log('Option 1: Install mkcert (Recommended)');
console.log('   Windows: Right-click PowerShell → "Run as Administrator"');
console.log('   Then run: choco install mkcert');
console.log('   Or: scoop bucket add extras && scoop install mkcert\n');
console.log('Option 2: Install OpenSSL');
console.log('   Windows: Download from https://slproweb.com/products/Win32OpenSSL.html');
console.log('   Or use: choco install openssl\n');
console.log('After installing, run this script again: npm run setup:https\n');
process.exit(1);
