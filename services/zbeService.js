// services/zbeService.js - Servicio para datos de ZBE
class ZBEDataService {
    constructor() {
        this.baseURL = 'https://sigma.madrid.es/hosted/rest/services/GEOPORTAL/MADRID_ZBE/MapServer';
        this.cache = new Map();
        this.cacheTimeout = 3600000; // 1 hora
    }
    
    async fetchZBEData() {
        try {
            // Verificar cache
            const cached = this.getCachedData('zbe-zones');
            if (cached) {
                return cached;
            }
            
            // Obtener datos del servicio oficial
            const response = await fetch(`${this.baseURL}/0/query?f=json&where=1%3D1&outFields=*&returnGeometry=true`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const processedData = this.processZBEData(data);
            
            // Guardar en cache
            this.setCachedData('zbe-zones', processedData);
            
            return processedData;
        } catch (error) {
            console.error('Error fetching ZBE data:', error);
            return this.getFallbackData();
        }
    }
    
    processZBEData(rawData) {
        if (!rawData.features) {
            return this.getFallbackData();
        }
        
        return rawData.features.map(feature => {
            const geometry = feature.geometry;
            const attributes = feature.attributes;
            
            return {
                id: attributes.OBJECTID || Date.now(),
                name: attributes.NOMBRE || 'ZBE Sin Nombre',
                municipality: attributes.MUNICIPIO || 'Madrid',
                type: attributes.TIPO || 'Zona de Bajas Emisiones',
                restrictions: attributes.RESTRICCIONES || 'Restricciones según normativa',
                coordinates: this.convertGeometryToCoordinates(geometry),
                lastUpdated: new Date().toISOString(),
                source: 'Comunidad de Madrid - Geoportal'
            };
        });
    }
    
    convertGeometryToCoordinates(geometry) {
        if (!geometry || !geometry.rings) {
            return [];
        }
        
        // Convertir de rings a formato Google Maps
        const ring = geometry.rings[0]; // Tomar el primer anillo
        return ring.map(coord => ({
            lat: coord[1],
            lng: coord[0]
        }));
    }
    
    getFallbackData() {
        // Datos de respaldo basados en información oficial
        return [
            {
                id: 1,
                name: "ZBEDEP Distrito Centro",
                municipality: "Madrid",
                type: "Zona de Bajas Emisiones de Especial Protección",
                restrictions: "Prohibido acceso vehículos categoría A. Restricciones para B y C",
                coordinates: [
                    {lat: 40.4200, lng: -3.7038},
                    {lat: 40.4180, lng: -3.6980},
                    {lat: 40.4140, lng: -3.6990},
                    {lat: 40.4120, lng: -3.7020},
                    {lat: 40.4130, lng: -3.7080},
                    {lat: 40.4170, lng: -3.7090},
                    {lat: 40.4200, lng: -3.7038}
                ],
                lastUpdated: new Date().toISOString(),
                source: 'Datos estáticos - Comunidad de Madrid'
            }
        ];
    }
    
    getCachedData(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }
    
    setCachedData(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    async getZBEStatistics() {
        const zones = await this.fetchZBEData();
        return {
            totalZones: zones.length,
            municipalities: [...new Set(zones.map(z => z.municipality))].length,
            lastUpdate: zones.reduce((latest, zone) => {
                const zoneDate = new Date(zone.lastUpdated);
                return zoneDate > latest ? zoneDate : latest;
            }, new Date(0))
        };
    }
}

// Exportar servicio
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZBEDataService;
} else {
    window.ZBEDataService = ZBEDataService;
}
