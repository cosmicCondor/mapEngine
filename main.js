// main.js - Archivo principal de Electron
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = process.argv.includes('--dev');

class ZBENavigatorApp {
    constructor() {
        this.mainWindow = null;
        this.setupApp();
    }
    
    setupApp() {
        app.whenReady().then(() => {
            this.createMainWindow();
            this.setupMenu();
            this.setupIPC();
            
            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    this.createMainWindow();
                }
            });
        });
        
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
    }
    
    createMainWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js')
            },
            icon: path.join(__dirname, 'assets', 'icon.png'),
            title: 'ZBE Madrid Navigator',
            show: false
        });
        
        // Cargar la aplicación
        if (isDev) {
            this.mainWindow.loadFile('index.html');
            this.mainWindow.webContents.openDevTools();
        } else {
            this.mainWindow.loadFile('index.html');
        }
        
        // Mostrar ventana cuando esté lista
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            
            if (isDev) {
                this.mainWindow.webContents.openDevTools();
            }
        });
        
        // Eventos de la ventana
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }
    
    setupMenu() {
        const template = [
            {
                label: 'Archivo',
                submenu: [
                    {
                        label: 'Exportar Ubicación',
                        click: () => this.exportLocation()
                    },
                    { type: 'separator' },
                    {
                        label: 'Salir',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => app.quit()
                    }
                ]
            },
            {
                label: 'Ver',
                submenu: [
                    { role: 'reload', label: 'Recargar' },
                    { role: 'forceReload', label: 'Forzar Recarga' },
                    { role: 'toggleDevTools', label: 'Herramientas de Desarrollo' },
                    { type: 'separator' },
                    { role: 'resetZoom', label: 'Zoom Normal' },
                    { role: 'zoomIn', label: 'Acercar' },
                    { role: 'zoomOut', label: 'Alejar' },
                    { type: 'separator' },
                    { role: 'togglefullscreen', label: 'Pantalla Completa' }
                ]
            },
            {
                label: 'Navegación',
                submenu: [
                    {
                        label: 'Centrar en Mi Ubicación',
                        accelerator: 'Ctrl+L',
                        click: () => this.centerOnLocation()
                    },
                    {
                        label: 'Mostrar/Ocultar ZBE',
                        accelerator: 'Ctrl+Z',
                        click: () => this.toggleZBE()
                    },
                    {
                        label: 'Configurar Alertas',
                        click: () => this.configureAlerts()
                    }
                ]
            },
            {
                label: 'Ayuda',
                submenu: [
                    {
                        label: 'Acerca de ZBE Navigator',
                        click: () => this.showAbout()
                    },
                    {
                        label: 'Información de ZBE Madrid',
                        click: () => this.showZBEInfo()
                    }
                ]
            }
        ];
        
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }
    
    setupIPC() {
        ipcMain.handle('get-zbe-data', async () => {
            // Retornar datos de ZBE actualizados
            return await this.getZBEData();
        });
        
        ipcMain.handle('save-location', async (event, locationData) => {
            return await this.saveLocationData(locationData);
        });
        
        ipcMain.handle('show-notification', async (event, title, body) => {
            // Manejar notificaciones del sistema
            const { Notification } = require('electron');
            if (Notification.isSupported()) {
                new Notification({ title, body }).show();
            }
        });
    }
    
    async getZBEData() {
        // Aquí podrías implementar la carga de datos desde APIs externas
        // Por ahora retornamos datos estáticos basados en la información de Madrid
        return {
            lastUpdated: new Date().toISOString(),
            zones: [
                // Datos actualizados de ZBE basados en los resultados de búsqueda
            ]
        };
    }
    
    centerOnLocation() {
        this.mainWindow.webContents.send('center-on-location');
    }
    
    toggleZBE() {
        this.mainWindow.webContents.send('toggle-zbe');
    }
    
    async exportLocation() {
        try {
            const { filePath } = await dialog.showSaveDialog(this.mainWindow, {
                defaultPath: 'ubicacion-zbe.json',
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            
            if (filePath) {
                this.mainWindow.webContents.send('export-location', filePath);
            }
        } catch (error) {
            console.error('Error al exportar ubicación:', error);
        }
    }
    
    configureAlerts() {
        // Abrir ventana de configuración de alertas
        const configWindow = new BrowserWindow({
            width: 500,
            height: 400,
            parent: this.mainWindow,
            modal: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });
        
        configWindow.loadFile('config.html');
    }
    
    showAbout() {
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'Acerca de ZBE Madrid Navigator',
            message: 'ZBE Madrid Navigator v1.0.0',
            detail: 'Aplicación para navegación consciente de Zonas de Bajas Emisiones en la Comunidad de Madrid.\n\nDesarrollado como Trabajo de Fin de Grado.\n\nUtiliza Google Maps API y datos oficiales de la Comunidad de Madrid.'
        });
    }
    
    showZBEInfo() {
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'Información sobre ZBE',
            message: 'Zonas de Bajas Emisiones en Madrid',
            detail: 'Las ZBE son áreas urbanas con restricciones de acceso según la clasificación ambiental de vehículos.\n\n' +
                    '24 municipios en la Comunidad de Madrid deben implementar ZBE según la Ley 7/2021.\n\n' +
                    'Objetivos: Mejorar calidad del aire, reducir contaminación y promover movilidad sostenible.'
        });
    }
}

// Inicializar aplicación
new ZBENavigatorApp();
