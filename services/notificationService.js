// services/notificationService.js - Sistema de notificaciones avanzadas
class NotificationService {
    constructor() {
        this.alertLevels = {
            info: { distance: 1000, color: '#2196F3', priority: 1 },
            warning: { distance: 500, color: '#FF9800', priority: 2 },
            danger: { distance: 200, color: '#F44336', priority: 3 },
            critical: { distance: 50, color: '#9C27B0', priority: 4 }
        };
        
        this.lastAlerts = new Map();
        this.cooldownPeriod = 30000; // 30 segundos
        this.permissionsGranted = false;
        
        this.requestPermissions();
    }
    
    async requestPermissions() {
        // Solicitar permisos para notificaciones
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            this.permissionsGranted = permission === 'granted';
        }
        
        // Solicitar permisos para vibración (implícito en dispositivos móviles)
        if ('vibrate' in navigator) {
            // La vibración no requiere permisos explícitos
        }
    }
    
    processProximityAlert(userPosition, zbeZones) {
        let alerts = [];
        
        zbeZones.forEach(zone => {
            const distance = this.calculateDistanceToZone(userPosition, zone);
            const alertLevel = this.determineAlertLevel(distance);
            
            if (alertLevel && this.shouldTriggerAlert(zone.id, alertLevel)) {
                const alert = this.createAlert(zone, distance, alertLevel);
                alerts.push(alert);
                this.recordAlert(zone.id, alertLevel);
            }
        });
        
        // Procesar alertas por prioridad
        alerts.sort((a, b) => b.level.priority - a.level.priority);
        
        if (alerts.length > 0) {
            this.displayAlerts(alerts);
        }
        
        return alerts;
    }
    
    calculateDistanceToZone(userPosition, zone) {
        // Calcular distancia mínima al perímetro de la zona
        let minDistance = Infinity;
        
        for (let i = 0; i < zone.coordinates.length - 1; i++) {
            const pointA = zone.coordinates[i];
            const pointB = zone.coordinates[i + 1];
            const distance = this.distanceToLineSegment(userPosition, pointA, pointB);
            minDistance = Math.min(minDistance, distance);
        }
        
        return minDistance;
    }
    
    distanceToLineSegment(point, lineStart, lineEnd) {
        const A = point.lat - lineStart.lat;
        const B = point.lng - lineStart.lng;
        const C = lineEnd.lat - lineStart.lat;
        const D = lineEnd.lng - lineStart.lng;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) {
            return this.calculateDistance(point, lineStart);
        }
        
        let param = dot / lenSq;
        
        let closestPoint;
        if (param < 0) {
            closestPoint = lineStart;
        } else if (param > 1) {
            closestPoint = lineEnd;
        } else {
            closestPoint = {
                lat: lineStart.lat + param * C,
                lng: lineStart.lng + param * D
            };
        }
        
        return this.calculateDistance(point, closestPoint);
    }
    
    calculateDistance(pos1, pos2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = this.toRadians(pos2.lat - pos1.lat);
        const dLng = this.toRadians(pos2.lng - pos1.lng);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(pos1.lat)) * Math.cos(this.toRadians(pos2.lat)) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c * 1000; // Convertir a metros
    }
    
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    determineAlertLevel(distance) {
        for (const [level, config] of Object.entries(this.alertLevels)) {
            if (distance <= config.distance) {
                return { name: level, ...config };
            }
        }
        return null;
    }
    
    shouldTriggerAlert(zoneId, alertLevel) {
        const key = `${zoneId}_${alertLevel.name}`;
        const lastAlert = this.lastAlerts.get(key);
        
        if (!lastAlert) {
            return true;
        }
        
        return (Date.now() - lastAlert) > this.cooldownPeriod;
    }
    
    createAlert(zone, distance, level) {
        return {
            id: `alert_${zone.id}_${Date.now()}`,
            zone: zone,
            distance: Math.round(distance),
            level: level,
            timestamp: new Date(),
            message: this.generateAlertMessage(zone, distance, level)
        };
    }
    
    generateAlertMessage(zone, distance, level) {
        const distanceText = Math.round(distance);
        
        switch (level.name) {
            case 'critical':
                return `¡MUY CERCA! Estás a ${distanceText}m de ${zone.name}`;
            case 'danger':
                return `¡ATENCIÓN! Te acercas a ${zone.name} (${distanceText}m)`;
            case 'warning':
                return `Precaución: ${zone.name} a ${distanceText}m`;
            case 'info':
                return `ZBE detectada: ${zone.name} a ${distanceText}m`;
            default:
                return `Zona detectada: ${zone.name}`;
        }
    }
    
    displayAlerts(alerts) {
        const primaryAlert = alerts[0];
        
        // Mostrar banner de alerta
        this.showAlertBanner(primaryAlert);
        
        // Mostrar notificación del sistema
        if (this.permissionsGranted) {
            this.showSystemNotification(primaryAlert);
        }
        
        // Activar vibración
        this.triggerVibration(primaryAlert.level);
        
        // Reproducir sonido de alerta
        this.playAlertSound(primaryAlert.level);
        
        // Actualizar indicador visual
        this.updateVisualIndicator(primaryAlert.level);
    }
    
    showAlertBanner(alert) {
        const banner = document.getElementById('alertBanner');
        if (!banner) return;
        
        banner.style.backgroundColor = alert.level.color;
        banner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span><strong>ZBE Alert:</strong> ${alert.message}</span>
                <button onclick="this.parentElement.parentElement.classList.remove('show')" 
                        style="background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
            </div>
        `;
        
        banner.classList.add('show');
        
        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            banner.classList.remove('show');
        }, 5000);
    }
    
    showSystemNotification(alert) {
        if (!this.permissionsGranted) return;
        
        const notification = new Notification('ZBE Madrid Navigator', {
            body: alert.message,
            icon: '/assets/icon.png',
            badge: '/assets/badge.png',
            tag: `zbe-alert-${alert.zone.id}`,
            requireInteraction: alert.level.priority >= 3,
            actions: [
                {
                    action: 'view',
                    title: 'Ver en Mapa'
                },
                {
                    action: 'dismiss',
                    title: 'Descartar'
                }
            ]
        });
        
        notification.onclick = () => {
            window.focus();
            // Centrar en la zona de alerta
            if (window.navigator_app) {
                const zoneCenter = this.calculateZoneCenter(alert.zone);
                window.navigator_app.map.setCenter(zoneCenter);
                window.navigator_app.map.setZoom(16);
            }
        };
    }
    
    calculateZoneCenter(zone) {
        const coords = zone.coordinates;
        let lat = 0, lng = 0;
        
        coords.forEach(coord => {
            lat += coord.lat;
            lng += coord.lng;
        });
        
        return {
            lat: lat / coords.length,
            lng: lng / coords.length
        };
    }
    
    triggerVibration(level) {
        if (!('vibrate' in navigator)) return;
        
        const patterns = {
            info: [100],
            warning: [100, 50, 100],
            danger: [200, 100, 200, 100, 200],
            critical: [300, 100, 300, 100, 300, 100, 300]
        };
        
        navigator.vibrate(patterns[level.name] || [100]);
    }
    
    playAlertSound(level) {
        // Implementar reproducción de sonidos de alerta
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            const frequencies = {
                info: 440,
                warning: 554,
                danger: 659,
                critical: 880
            };
            
            oscillator.frequency.setValueAtTime(frequencies[level.name] || 440, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.warn('No se pudo reproducir sonido de alerta:', error);
        }
    }
    
    updateVisualIndicator(level) {
        const indicator = document.getElementById('statusDot');
        if (indicator) {
            indicator.className = `status-dot ${level.name}`;
            indicator.style.backgroundColor = level.color;
        }
    }
    
    recordAlert(zoneId, alertLevel) {
        const key = `${zoneId}_${alertLevel.name}`;
        this.lastAlerts.set(key, Date.now());
    }
}

// Exportar servicio
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationService;
} else {
    window.NotificationService = NotificationService;
}
