# Setting Up HTTPS for Local Development

The Web Speech API requires HTTPS (or localhost) to access the microphone. Follow these steps to set up HTTPS for your local development environment.

## Quick Setup

### Step 1: Install mkcert

**Windows (using Chocolatey):**
```bash
choco install mkcert
```

**Windows (using Scoop):**
```bash
scoop bucket add extras
scoop install mkcert
```

**macOS:**
```bash
brew install mkcert
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install libnss3-tools
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/
```

### Step 2: Generate SSL Certificates

Run the setup script:
```bash
npm run setup:https
```

This will:
- Create a `certs` directory
- Install the local CA
- Generate SSL certificates for `localhost`

### Step 3: Start the HTTPS Server

Instead of `npm run dev`, use:
```bash
npm run dev:https
```

Your app will now be available at: **https://localhost:3000**

## Important Notes

1. **First Time Setup**: When you first visit `https://localhost:3000`, your browser may show a security warning. This is normal for self-signed certificates. Click "Advanced" and then "Proceed to localhost" to continue.

2. **Browser Trust**: After running `mkcert -install`, your browser will trust the certificates automatically.

3. **Certificate Location**: Certificates are stored in the `certs/` directory (which is gitignored for security).

4. **Production**: This setup is only for local development. Production deployments should use proper SSL certificates from a trusted CA.

## Troubleshooting

### "mkcert: command not found"
- Make sure mkcert is installed and in your PATH
- Try restarting your terminal after installation

### "Permission denied" errors
- On Linux/macOS, you may need to use `sudo` for `mkcert -install`
- Make sure you have write permissions in the project directory

### Browser still shows security warning
- Clear your browser cache
- Make sure you're accessing `https://localhost:3000` (not `http://`)
- Try a different browser

### Microphone still not working
- Make sure you're using `https://` (not `http://`)
- Check browser console for any errors
- Grant microphone permissions when prompted by the browser

## Alternative: Use HTTP on localhost

If you prefer not to set up HTTPS, you can access your app at `http://localhost:3000` (without the 's'). The Web Speech API works on `localhost` even without HTTPS, but it won't work on other local IP addresses like `http://192.168.x.x:3000`.
