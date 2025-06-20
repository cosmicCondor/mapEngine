// app.js - Lógica principal de la aplicación
class ZBENavigator {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.userPosition = null;
        this.zbeZones = [];
        this.zbePolygons = [];
        this.isTracking = false;
        this.alertThreshold = 500; // 500 metros
        this.watchId = null;
        this.lastAlertTime = 0;
        this.alertCooldown = 30000; // 30 segundos
        
        this.initializeZBEData();
    }
    
    async initializeZBEData() {
        // Datos de ZBE de la Comunidad de Madrid basados en los servicios oficiales
        this.zbeZones = await this.loadZBEZones();
    }
    
    async loadZBEZones() {
        // Datos reales de ZBE de Madrid basados en los resultados de búsqueda
        const zbeData = [
            {
                name: "ZBEDEP Distrito Centro",
                type: "Zona de Bajas Emisiones de Especial Protección",
                municipality: "Madrid",
                coordinates: [
                    // Perímetro aproximado del Distrito Centro de Madrid
                    {lat: 40.4200, lng: -3.7038},
                    {lat: 40.4180, lng: -3.6980},
                    {lat: 40.4140, lng: -3.6990},
                    {lat: 40.4120, lng: -3.7020},
                    {lat: 40.4130, lng: -3.7080},
                    {lat: 40.4170, lng: -3.7090},
                    {lat: 40.4200, lng: -3.7038}
                ],
                restrictions: "Prohibido acceso vehículos categoría A. Limitaciones para B y C.",
                description: "Zona creada para proteger la salud humana y el medio ambiente urbano"
            },
            {
                name: "ZBE Alcalá de Henares",
                type: "Zona de Bajas Emisiones",
                municipality: "Alcalá de Henares",
                coordinates: [
                    {lat: 40.4817, lng: -3.3658},
                    {lat: 40.4800, lng: -3.3600},
                    {lat: 40.4780, lng: -3.3620},
                    {lat: 40.4790, lng: -3.3680},
                    {lat: 40.4817, lng: -3.3658}
                ],
                restrictions: "Restricciones según clasificación ambiental",
                description: "ZBE implementada según Ley 7/2021"
            },
            {
                name: "ZBE Alcobendas",
                type: "Zona de Bajas Emisiones",
                municipality: "Alcobendas",
                coordinates: [
                    {lat: 40.5411, lng: -3.6419},
                    {lat: 40.5390, lng: -3.6380},
                    {lat: 40.5370, lng: -3.6400},
                    {lat: 40.5380, lng: -3.6440},
                    {lat: 40.5411, lng: -3.6419}
                ],
                restrictions: "Restricciones según normativa municipal",
                description: "ZBE para municipios > 50.000 habitantes"
            }
        ];
        
        return zbeData;
    }
    
    initMap() {
        // Configuración inicial del mapa centrado en Madrid
        const mapOptions = {
            zoom: 12,
            center: {lat: 40.4168, lng: -3.7038},
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{visibility: "off"}]
                }
            ]
        };
        
        this.map = new google.maps.Map(document.getElementById('map'), mapOptions);
        
        // Cargar zonas ZBE en el mapa
        this.loadZBEPolygons();
        
        // Inicializar geolocalización
        this.initGeolocation();
        
        // Configurar info window
        this.infoWindow = new google.maps.InfoWindow();
        
        this.updateStatus("Mapa inicializado", "success");
    }
    
    loadZBEPolygons() {
        this.zbeZones.forEach((zone, index) => {
            const polygon = new google.maps.Polygon({
                paths: zone.coordinates,
                strokeColor: '#FF0000',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#FF0000',
                fillOpacity: 0.2,
                map: this.map
            });
            
            // Agregar evento click para mostrar información
            polygon.addListener('click', (event) => {
                this.showZoneInfo(zone, event.latLng);
            });
            
            this.zbePolygons.push(polygon);
        });
    }
    
    showZoneInfo(zone, position) {
        const content = `
            <div style="max-width: 300px;">
                <h3>${zone.name}</h3>
                <p><strong>Municipio:</strong> ${zone.municipality}</p>
                <p><strong>Tipo:</strong> ${zone.type}</p>
                <p><strong>Restricciones:</strong> ${zone.restrictions}</p>
                <p><strong>Descripción:</strong> ${zone.description}</p>
            </div>
        `;
        
        this.infoWindow.setContent(content);
        this.infoWindow.setPosition(position);
        this.infoWindow.open(this.map);
    }
    
    initGeolocation() {
        if (!navigator.geolocation) {
            this.updateStatus("Geolocalización no soportada", "error");
            return;
        }
        
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 1000
        };
        
        // Obtener posición inicial
        navigator.geolocation.getCurrentPosition(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handleGeolocationError(error),
            options
        );
        
        // Iniciar seguimiento continuo
        this.startTracking();
    }
    
    startTracking() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 1000
        };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handleGeolocationError(error),
            options
        );
        
        this.updateStatus("Seguimiento GPS activo", "success");
    }
    
    stopTracking() {
        if (!this.isTracking) return;
        
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        this.isTracking = false;
        this.updateStatus("Seguimiento GPS desactivado", "warning");
    }
    
    handlePositionUpdate(position) {
        const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        
        this.userPosition = newPosition;
        this.updateUserMarker(newPosition);
        this.checkProximityToZBE(newPosition);
        this.updateDistanceDisplay(newPosition);
    }
    
    updateUserMarker(position) {
        if (this.userMarker) {
            this.userMarker.setPosition(position);
        } else {
            this.userMarker = new google.maps.Marker({
                position: position,
                map: this.map,
                title: 'Tu ubicación',
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="10" cy="10" r="8" fill="#4285F4" stroke="#fff" stroke-width="2"/>
                            <circle cx="10" cy="10" r="3" fill="#fff"/>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(20, 20),
                    anchor: new google.maps.Point(10, 10)
                }
            });
        }
    }
    
    checkProximityToZBE(userPosition) {
        let minDistance = Infinity;
        let nearestZone = null;
        
        this.zbeZones.forEach(zone => {
            // Calcular distancia al centro de la zona
            const zoneCenter = this.calculatePolygonCenter(zone.coordinates);
            const distance = this.calculateDistance(userPosition, zoneCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestZone = zone;
            }
            
            // Verificar si está dentro o muy cerca de la zona
            if (this.isPointInPolygon(userPosition, zone.coordinates) || distance <= this.alertThreshold) {
                this.triggerProximityAlert(zone, distance);
            }
        });
        
        return {distance: minDistance, zone: nearestZone};
    }
    
    calculatePolygonCenter(coordinates) {
        let lat = 0, lng = 0;
        coordinates.forEach(coord => {
            lat += coord.lat;
            lng += coord.lng;
        });
        return {
            lat: lat / coordinates.length,
            lng: lng / coordinates.length
        };
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
    
    isPointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
                (point.lng < (polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat) / (polygon[j].lat - polygon[i].lat) + polygon[i].lng)) {
                inside = !inside;
            }
        }
        return inside;
    }
    
    triggerProximityAlert(zone, distance) {
        const now = Date.now();
        if (now - this.lastAlertTime < this.alertCooldown) {
            return; // Evitar spam de alertas
        }
        
        this.lastAlertTime = now;
        this.showAlert(zone, distance);
        this.updateStatus("Cerca de ZBE", "danger");
        
        // Vibración si está disponible
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
        
        // Notificación del sistema si está disponible
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('ZBE Madrid Navigator', {
                body: `Te acercas a ${zone.name}. Distancia: ${Math.round(distance)}m`,
                icon: '/icon.png'
            });
        }
    }
    
    showAlert(zone, distance) {
        const alertBanner = document.getElementById('alertBanner');
        alertBanner.innerHTML = `
            <strong>¡Atención!</strong> Te estás acercando a ${zone.name} 
            (${Math.round(distance)}m) - ${zone.restrictions}
        `;
        alertBanner.classList.add('show');
        
        setTimeout(() => {
            alertBanner.classList.remove('show');
        }, 5000);
    }
    
    updateDistanceDisplay(userPosition) {
        const {distance, zone} = this.checkProximityToZBE(userPosition);
        const distanceText = document.getElementById('distanceText');
        
        if (zone) {
            distanceText.textContent = `${Math.round(distance)}m (${zone.name})`;
        } else {
            distanceText.textContent = 'Calculando...';
        }
    }
    
    updateStatus(message, type) {
        const statusText = document.getElementById('statusText');
        const statusDot = document.getElementById('statusDot');
        
        statusText.textContent = message;
        statusDot.className = `status-dot ${type}`;
    }
    
    handleGeolocationError(error) {
        let message = "Error de geolocalización: ";
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message += "Permisos denegados";
                break;
            case error.POSITION_UNAVAILABLE:
                message += "Posición no disponible";
                break;
            case error.TIMEOUT:
                message += "Tiempo de espera agotado";
                break;
            default:
                message += "Error desconocido";
                break;
        }
        this.updateStatus(message, "error");
    }
}

// Funciones globales para controles
let navigator_app;

function initMap() {
    navigator_app = new ZBENavigator();
    navigator_app.initMap();
    
    // Solicitar permisos de notificación
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function centerOnUser() {
    if (navigator_app && navigator_app.userPosition) {
        navigator_app.map.setCenter(navigator_app.userPosition);
        navigator_app.map.setZoom(16);
    }
}

function toggleZBEVisibility() {
    if (navigator_app) {
        navigator_app.zbePolygons.forEach(polygon => {
            const isVisible = polygon.getMap() !== null;
            polygon.setMap(isVisible ? null : navigator_app.map);
        });
    }
}

function toggleTracking() {
    if (navigator_app) {
        if (navigator_app.isTracking) {
            navigator_app.stopTracking();
        } else {
            navigator_app.startTracking();
        }
    }
}
