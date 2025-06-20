// services/cacheManager.js - Sistema de caché inteligente
class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.storageKey = 'zbe-navigator-cache';
        this.maxMemoryItems = 100;
        this.defaultTTL = 3600000; // 1 hora
        this.geoTTL = 300000; // 5 minutos para datos geo
        
        this.loadPersistentCache();
        this.setupCleanupInterval();
    }
    
    loadPersistentCache() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                Object.entries(data).forEach(([key, value]) => {
                    if (this.isValid(value)) {
                        this.memoryCache.set(key, value);
                    }
                });
            }
        } catch (error) {
            console.warn('Error cargando caché persistente:', error);
        }
    }
    
    savePersistentCache() {
        try {
            const cacheData = {};
            this.memoryCache.forEach((value, key) => {
                if (this.isValid(value) && value.persistent) {
                    cacheData[key] = value;
                }
            });
            localStorage.setItem(this.storageKey, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Error guardando caché persistente:', error);
        }
    }
    
    setupCleanupInterval() {
        setInterval(() => {
            this.cleanup();
            this.savePersistentCache();
        }, 300000); // Limpiar cada 5 minutos
    }
    
    set(key, data, options = {}) {
        const ttl = options.ttl || this.defaultTTL;
        const persistent = options.persistent !== false;
        const geoLocation = options.geoLocation;
        
        const cacheItem = {
            data,
            timestamp: Date.now(),
            ttl,
            persistent,
            geoLocation,
            accessCount: 1,
            lastAccess: Date.now()
        };
        
        // Gestión de memoria limitada
        if (this.memoryCache.size >= this.maxMemoryItems) {
            this.evictLeastUsed();
        }
        
        this.memoryCache.set(key, cacheItem);
        
        if (persistent) {
            this.savePersistentCache();
        }
    }
    
    get(key, userLocation = null) {
        const item = this.memoryCache.get(key);
        
        if (!item) {
            return null;
        }
        
        if (!this.isValid(item, userLocation)) {
            this.memoryCache.delete(key);
            return null;
        }
        
        // Actualizar estadísticas de acceso
        item.accessCount++;
        item.lastAccess = Date.now();
        
        return item.data;
    }
    
    isValid(item, userLocation = null) {
        const now = Date.now();
        
        // Verificar TTL
        if (now - item.timestamp > item.ttl) {
            return false;
        }
        
        // Verificar relevancia geográfica
        if (item.geoLocation && userLocation) {
            const distance = this.calculateDistance(item.geoLocation, userLocation);
            if (distance > 50000) { // 50km
                return false;
            }
        }
        
        return true;
    }
    
    evictLeastUsed() {
        let leastUsed = null;
        let minScore = Infinity;
        
        this.memoryCache.forEach((item, key) => {
            // Score basado en frecuencia y recencia
            const score = item.accessCount * (Date.now() - item.lastAccess);
            if (score < minScore) {
                minScore = score;
                leastUsed = key;
            }
        });
        
        if (leastUsed) {
            this.memoryCache.delete(leastUsed);
        }
    }
    
    cleanup() {
        const toDelete = [];
        this.memoryCache.forEach((item, key) => {
            if (!this.isValid(item)) {
                toDelete.push(key);
            }
        });
        
        toDelete.forEach(key => this.memoryCache.delete(key));
    }
    
    calculateDistance(pos1, pos2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = this.toRadians(pos2.lat - pos1.lat);
        const dLng = this.toRadians(pos2.lng - pos1.lng);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(pos1.lat)) * Math.cos(this.toRadians(pos2.lat)) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c * 1000; // metros
    }
    
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    invalidateByPattern(pattern) {
        const regex = new RegExp(pattern);
        const toDelete = [];
        
        this.memoryCache.forEach((item, key) => {
            if (regex.test(key)) {
                toDelete.push(key);
            }
        });
        
        toDelete.forEach(key => this.memoryCache.delete(key));
    }
    
    getStats() {
        const stats = {
            totalItems: this.memoryCache.size,
            memoryUsage: 0,
            hitRatio: 0,
            oldestItem: null,
            newestItem: null
        };
        
        let totalAccess = 0;
        let totalHits = 0;
        let oldest = Date.now();
        let newest = 0;
        
        this.memoryCache.forEach(item => {
            const itemSize = JSON.stringify(item).length;
            stats.memoryUsage += itemSize;
            totalAccess += item.accessCount;
            totalHits += item.accessCount - 1; // -1 por el set inicial
            
            if (item.timestamp < oldest) {
                oldest = item.timestamp;
                stats.oldestItem = item;
            }
            if (item.timestamp > newest) {
                newest = item.timestamp;
                stats.newestItem = item;
            }
        });
        
        stats.hitRatio = totalAccess > 0 ? (totalHits / totalAccess) * 100 : 0;
        
        return stats;
    }
    
    clear() {
        this.memoryCache.clear();
        localStorage.removeItem(this.storageKey);
    }
}

// Exportar instancia singleton
const cacheManager = new CacheManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = cacheManager;
} else {
    window.CacheManager = cacheManager;
}
