// services/analyticsService.js - Sistema de análisis y métricas
class AnalyticsService {
    constructor() {
        this.isEnabled = false;
        this.sessionId = this.generateSessionId();
        this.metrics = {
            session: {
                startTime: Date.now(),
                duration: 0,
                interactions: 0,
                alertsTriggered: 0,
                zonesVisited: new Set()
            },
            navigation: {
                totalDistance: 0,
                averageSpeed: 0,
                routeChanges: 0,
                gpsAccuracy: []
            },
            alerts: {
                total: 0,
                byLevel: { info: 0, warning: 0, danger: 0, critical: 0 },
                responseTime: [],
                dismissed: 0
            },
            zones: {
                approached: new Map(),
                entered: new Map(),
                avoided: new Map()
            }
        };
        
        this.initializeAnalytics();
    }
    
    initializeAnalytics() {
        // Verificar consentimiento del usuario
        const consent = localStorage.getItem('analytics-consent');
        if (consent === 'true') {
            this.enable();
        }
    }
    
    enable() {
        this.isEnabled = true;
        this.startSession();
        console.log('📊 Analytics habilitado');
    }
    
    disable() {
        this.isEnabled = false;
        console.log('📊 Analytics deshabilitado');
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    startSession() {
        if (!this.isEnabled) return;
        
        this.metrics.session.startTime = Date.now();
        this.trackEvent('session_start', {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: this.detectPlatform(),
            screenResolution: `${screen.width}x${screen.height}`
        });
    }
    
    endSession() {
        if (!this.isEnabled) return;
        
        this.metrics.session.duration = Date.now() - this.metrics.session.startTime;
        
        this.trackEvent('session_end', {
            duration: this.metrics.session.duration,
            interactions: this.metrics.session.interactions,
            alertsTriggered: this.metrics.session.alertsTriggered,
            zonesVisited: this.metrics.session.zonesVisited.size
        });
        
        this.sendBatchedEvents();
    }
    
    trackEvent(eventName, eventData = {}) {
        if (!this.isEnabled) return;
        
        const event = {
            id: this.generateEventId(),
            sessionId: this.sessionId,
            name: eventName,
            timestamp: Date.now(),
            data: eventData
        };
        
        this.queueEvent(event);
        this.updateMetrics(eventName, eventData);
    }
    
    generateEventId() {
        return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }
    
    queueEvent(event) {
        let queue = JSON.parse(localStorage.getItem('analytics-queue') || '[]');
        queue.push(event);
        
        // Limitar el tamaño de la cola
        if (queue.length > 100) {
            queue = queue.slice(-50);
        }
        
        localStorage.setItem('analytics-queue', JSON.stringify(queue));
    }
    
    updateMetrics(eventName, eventData) {
        switch (eventName) {
            case 'user_interaction':
                this.metrics.session.interactions++;
                break;
                
            case 'alert_triggered':
                this.metrics.session.alertsTriggered++;
                this.metrics.alerts.total++;
                if (eventData.level) {
                    this.metrics.alerts.byLevel[eventData.level]++;
                }
                break;
                
            case 'zone_approached':
                const zoneId = eventData.zoneId;
                if (zoneId) {
                    this.metrics.session.zonesVisited.add(zoneId);
                    this.updateZoneMetric('approached', zoneId, eventData);
                }
                break;
                
            case 'zone_entered':
                if (eventData.zoneId) {
                    this.updateZoneMetric('entered', eventData.zoneId, eventData);
                }
                break;
                
            case 'location_update':
                this.updateNavigationMetrics(eventData);
                break;
                
            case 'alert_dismissed':
                this.metrics.alerts.dismissed++;
                if (eventData.responseTime) {
                    this.metrics.alerts.responseTime.push(eventData.responseTime);
                }
                break;
        }
    }
    
    updateZoneMetric(action, zoneId, data) {
        const zoneMap = this.metrics.zones[action];
        if (!zoneMap.has(zoneId)) {
            zoneMap.set(zoneId, {
                count: 0,
                firstTime: Date.now(),
                lastTime: Date.now(),
                data: []
            });
        }
        
        const zoneData = zoneMap.get(zoneId);
        zoneData.count++;
        zoneData.lastTime = Date.now();
        zoneData.data.push({
            timestamp: Date.now(),
            ...data
        });
    }
    
    updateNavigationMetrics(locationData) {
        if (locationData.accuracy) {
            this.metrics.navigation.gpsAccuracy.push(locationData.accuracy);
        }
        
        if (locationData.speed) {
            // Calcular velocidad promedio
            const speeds = this.metrics.navigation.speeds || [];
            speeds.push(locationData.speed);
            this.metrics.navigation.speeds = speeds;
            this.metrics.navigation.averageSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        }
    }
    
    trackZBEApproach(zoneId, distance, userLocation) {
        this.trackEvent('zone_approached', {
            zoneId,
            distance,
            location: {
                lat: Math.round(userLocation.lat * 1000) / 1000, // Anonimizar coordenadas
                lng: Math.round(userLocation.lng * 1000) / 1000
            },
            timestamp: new Date().toISOString()
        });
    }
    
    trackAlertTriggered(alertData) {
        this.trackEvent('alert_triggered', {
            zoneId: alertData.zone.id,
            level: alertData.level.name,
            distance: alertData.distance,
            timestamp: alertData.timestamp.toISOString()
        });
    }
    
    trackAlertDismissed(alertId, responseTime) {
        this.trackEvent('alert_dismissed', {
            alertId,
            responseTime,
            timestamp: new Date().toISOString()
        });
    }
    
    trackRouteChange(oldRoute, newRoute, reason) {
        this.metrics.navigation.routeChanges++;
        this.trackEvent('route_change', {
            reason,
            timestamp: new Date().toISOString()
        });
    }
    
    generateReport() {
        const report = {
            sessionId: this.sessionId,
            generatedAt: new Date().toISOString(),
            summary: {
                sessionDuration: Date.now() - this.metrics.session.startTime,
                totalInteractions: this.metrics.session.interactions,
                alertsTriggered: this.metrics.session.alertsTriggered,
                uniqueZonesVisited: this.metrics.session.zonesVisited.size
            },
            navigation: {
                averageSpeed: this.metrics.navigation.averageSpeed,
                routeChanges: this.metrics.navigation.routeChanges,
                averageGPSAccuracy: this.calculateAverageAccuracy()
            },
            alerts: {
                totalAlerts: this.metrics.alerts.total,
                alertsByLevel: { ...this.metrics.alerts.byLevel },
                averageResponseTime: this.calculateAverageResponseTime(),
                dismissalRate: this.calculateDismissalRate()
            },
            zones: this.generateZoneReport()
        };
        
        return report;
    }
    
    calculateAverageAccuracy() {
        const accuracies = this.metrics.navigation.gpsAccuracy;
        return accuracies.length > 0 ? 
            accuracies.reduce((a, b) => a + b, 0) / accuracies.length : 0;
    }
    
    calculateAverageResponseTime() {
        const times = this.metrics.alerts.responseTime;
        return times.length > 0 ? 
            times.reduce((a, b) => a + b, 0) / times.length : 0;
    }
    
    calculateDismissalRate() {
        return this.metrics.alerts.total > 0 ? 
            (this.metrics.alerts.dismissed / this.metrics.alerts.total) * 100 : 0;
    }
    
    generateZoneReport() {
        const zoneReport = {};
        
        ['approached', 'entered', 'avoided'].forEach(action => {
            zoneReport[action] = {};
            this.metrics.zones[action].forEach((data, zoneId) => {
                zoneReport[action][zoneId] = {
                    count: data.count,
                    firstVisit: new Date(data.firstTime).toISOString(),
                    lastVisit: new Date(data.lastTime).toISOString()
                };
            });
        });
        
        return zoneReport;
    }
    
    detectPlatform() {
        if (window.electron) return 'electron';
        if (navigator.userAgent.includes('Mobile')) return 'mobile';
        return 'web';
    }
    
    async sendBatchedEvents() {
        if (!this.isEnabled) return;
        
        const queue = JSON.parse(localStorage.getItem('analytics-queue') || '[]');
        if (queue.length === 0) return;
        
        try {
            // En un entorno real, enviarías a tu servidor de analytics
            console.log('📊 Enviando eventos de analytics:', queue.length);
            
            // Simular envío
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Limpiar cola después del envío exitoso
            localStorage.removeItem('analytics-queue');
            
        } catch (error) {
            console.error('Error enviando eventos de analytics:', error);
        }
    }
    
    exportData() {
        const data = {
            metrics: this.metrics,
            report: this.generateReport(),
            events: JSON.parse(localStorage.getItem('analytics-queue') || '[]')
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `zbe-analytics-${this.sessionId}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Exportar instancia singleton
const analyticsService = new AnalyticsService();

// Configurar eventos de ciclo de vida
window.addEventListener('beforeunload', () => {
    analyticsService.endSession();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = analyticsService;
} else {
    window.AnalyticsService = analyticsService;
}
