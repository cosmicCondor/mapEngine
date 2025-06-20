// scripts/build.js - Script de construcción automatizada
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class BuildManager {
    constructor() {
        this.projectRoot = process.cwd();
        this.distDir = path.join(this.projectRoot, 'dist');
        this.assetsDir = path.join(this.projectRoot, 'assets');
    }
    
    async buildAll() {
        console.log('🚀 Iniciando proceso de construcción...');
        
        try {
            await this.prepareBuild();
            await this.buildWeb();
            await this.buildElectron();
            await this.createPackages();
            
            console.log('✅ Construcción completada exitosamente');
        } catch (error) {
            console.error('❌ Error en el proceso de construcción:', error);
            process.exit(1);
        }
    }
    
    async prepareBuild() {
        console.log('📦 Preparando entorno de construcción...');
        
        // Limpiar directorio de distribución
        if (fs.existsSync(this.distDir)) {
            fs.rmSync(this.distDir, { recursive: true, force: true });
        }
        fs.mkdirSync(this.distDir, { recursive: true });
        
        // Verificar dependencias
        this.verifyDependencies();
        
        // Generar archivos de configuración
        this.generateConfigFiles();
    }
    
    verifyDependencies() {
        const requiredDeps = ['electron', 'electron-builder'];
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        requiredDeps.forEach(dep => {
            if (!packageJson.devDependencies[dep]) {
                throw new Error(`Dependencia requerida no encontrada: ${dep}`);
            }
        });
    }
    
    generateConfigFiles() {
        // Generar manifest para PWA
        const manifest = {
            name: "ZBE Madrid Navigator",
            short_name: "ZBE Navigator",
            description: "Navegación con alertas de Zonas de Bajas Emisiones",
            start_url: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#1976D2",
            icons: [ // REVISAR
                {
                    src: "assets/icon-192.png",
                    sizes: "192x192",
                    type: "image/png"
                },
                {
                    src: "assets/icon-512.png",
                    sizes: "512x512",
                    type: "image/png"
                }
            ]
        };
        
        fs.writeFileSync(
            path.join(this.projectRoot, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        );
    }
    
    async buildWeb() {
        console.log('🌐 Construyendo versión web...');
        
        // Copiar archivos web al directorio de distribución
        const webFiles = ['index.html', 'app.js', 'manifest.json'];
        const webDir = path.join(this.distDir, 'web');
        fs.mkdirSync(webDir, { recursive: true });
        
        webFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.copyFileSync(file, path.join(webDir, file));
            }
        });
        
        // Copiar assets
        if (fs.existsSync(this.assetsDir)) {
            fs.cpSync(this.assetsDir, path.join(webDir, 'assets'), { recursive: true });
        }
        
        // Generar service worker para PWA
        this.generateServiceWorker(webDir);
    }
    
    generateServiceWorker(webDir) {
        const swContent = `
const CACHE_NAME = 'zbe-navigator-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/assets/icon-192.png',
    '/assets/icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
        `;
        
        fs.writeFileSync(path.join(webDir, 'sw.js'), swContent.trim());
    }
    
    async buildElectron() {
        console.log('⚡ Construyendo aplicaciones Electron...');
        
        const platforms = ['win', 'mac', 'linux'];
        
        for (const platform of platforms) {
            try {
                console.log(`📱 Construyendo para ${platform}...`);
                execSync(`npm run build-${platform}`, { stdio: 'inherit' });
            } catch (error) {
                console.warn(`⚠️ No se pudo construir para ${platform}:`, error.message);
            }
        }
    }
    
    async createPackages() {
        console.log('📦 Creando paquetes de distribución...');
        
        // Crear archivo ZIP para la versión web
        const archiver = require('archiver');
        const output = fs.createWriteStream(path.join(this.distDir, 'zbe-navigator-web.zip'));
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        archive.pipe(output);
        archive.directory(path.join(this.distDir, 'web'), false);
        await archive.finalize();
        
        console.log('📁 Paquete web creado: zbe-navigator-web.zip');
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    const builder = new BuildManager();
    builder.buildAll();
}

module.exports = BuildManager;
