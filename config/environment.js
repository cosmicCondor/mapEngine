// config/environment.js - Configuración de entornos
class EnvironmentConfig {
    constructor() {
        this.env = process.env.NODE_ENV || 'development';
        this.config = this.loadConfig();
    }
    
    loadConfig() {
        const baseConfig = {
            app: {
                name: 'ZBE Madrid Navigator',
                version: '1.0.0',
                description: 'Navegación con alertas de Zonas de Bajas Emisiones'
            },
            maps: {
                apiKey: process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyADRUDdpHA4b_k318KKf_oVpQUZNsRFRCI',
                libraries: ['geometry', 'places'],
                defaultCenter: { lat: 40.4168, lng: -3.7038 },
                defaultZoom: 12
            },
            zbe: {
                updateInterval: 3600000, // 1 hora
                alertThresholds: {
                    info: 1000,
                    warning: 500,
                    danger: 200,
                    critical: 50
                },
                cooldownPeriod: 30000
            },
            services: {
                madridGeoPortal: 'https://sigma.madrid.es/hosted/rest/services/GEOPORTAL/MADRID_ZBE/MapServer',
                updateEndpoint: '/api/zbe/update',
                statusEndpoint: '/api/status'
            }
        };
        
        const envConfigs = {
            development: {
                ...baseConfig,
                debug: true,
                maps: {
                    ...baseConfig.maps,
                    apiKey: 'DEVELOPMENT_API_KEY'
                },
                zbe: {
                    ...baseConfig.zbe,
                    updateInterval: 300000, // 5 minutos en desarrollo
                    alertThresholds: {
                        info: 2000,  // Distancias mayores para testing
                        warning: 1000,
                        danger: 500,
                        critical: 100
                    }
                }
            },
            
            production: {
                ...baseConfig,
                debug: false,
                maps: {
                    ...baseConfig.maps,
                    apiKey: process.env.GOOGLE_MAPS_API_KEY_PROD
                },
                analytics: {
                    enabled: true,
                    trackingId: process.env.ANALYTICS_TRACKING_ID
                },
                errorReporting: {
                    enabled: true,
                    endpoint: process.env.ERROR_REPORTING_ENDPOINT
                }
            },
            
            testing: {
                ...baseConfig,
                debug: true,
                maps: {
                    ...baseConfig.maps,
                    apiKey: 'TESTING_API_KEY'
                },
                zbe: {
                    ...baseConfig.zbe,
                    updateInterval: 60000, // 1 minuto para tests
                    alertThresholds: {
                        info: 5000,
                        warning: 2000,
                        danger: 1000,
                        critical: 500
                    }
                },
                mockData: true
            }
        };
        
        return envConfigs[this.env] || baseConfig;
    }
    
    get(key) {
        return this.getNestedProperty(this.config, key);
    }
    
    getNestedProperty(obj, key) {
        return key.split('.').reduce((o, k) => (o || {})[k], obj);
    }
    
    isProduction() {
        return this.env === 'production';
    }
    
    isDevelopment() {
        return this.env === 'development';
    }
    
    isTesting() {
        return this.env === 'testing';
    }
}

// Exportar instancia singleton
const envConfig = new EnvironmentConfig();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = envConfig;
} else {
    window.EnvironmentConfig = envConfig;
}
