# SIPRO - Sistema de Inversiones

## 📋 Descripción

Sistema de Gestión de Inversiones Integral (SIPRO) - Aplicación web full-stack para la administración de inversiones financieras, catálogos, grupos familiares y reportes.

## 🏗️ Arquitectura

### **Backend (Laravel)**
- **Framework**: Laravel 10.x
- **Base de Datos**: MySQL
- **API REST**: JSON API
- **Autenticación**: JWT Tokens

### **Frontend (Angular)**
- **Framework**: Angular 17+
- **Arquitectura**: Standalone Components
- **Estilos**: Bootstrap 5 + Bootstrap Icons
- **HTTP Client**: Angular HTTP con RxJS

## 🚀 Funcionalidades Implementadas

### **✅ Módulo de Autenticación**
- Login de usuarios
- Gestión de tokens JWT
- Rutas protegidas

### **✅ Módulo de Catálogos**
- CRUD completo de catálogos
- CRUD completo de valores de catálogo
- Listados con paginación y filtros
- Estados activo/inactivo

### **✅ Layout Principal**
- Sidebar navegación colapsable
- Header con fecha/hora real
- Diseño responsive
- Menú de usuario

### **✅ Dashboard**
- Estadísticas principales
- Acciones rápidas
- Navegación a módulos

## 📁 Estructura del Proyecto

```
SIPRO_07/
├── backend/                    # API Laravel
│   ├── app/
│   │   ├── Http/Controllers/API/
│   │   ├── Models/
│   │   └── ...
│   ├── database/
│   ├── routes/
│   └── ...
├── frontend/                   # Aplicación Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/
│   │   │   ├── core/
│   │   │   ├── dashboard/
│   │   │   ├── layout/
│   │   │   └── modules/
│   │   │       └── catalogos/
│   │   └── ...
│   └── ...
└── documentación/              # Documentación del proyecto
```

## 🛠️ Tecnologías

### **Backend**
- PHP 8.2+
- Laravel 10.x
- MySQL 8.0+
- Composer

### **Frontend**
- TypeScript
- Angular 17+
- Node.js 18+
- Bootstrap 5
- RxJS

## 📦 Instalación

### **Requisitos Previos**
- PHP 8.2+
- Composer
- Node.js 18+
- MySQL 8.0+
- Git

### **Backend (Laravel)**
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve --port=8000
```

### **Frontend (Angular)**
```bash
cd frontend
npm install
ng serve --port=4200
```

## 🔧 Configuración

### **Variables de Entorno (.env)**
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sipro
DB_USERNAME=root
DB_PASSWORD=

JWT_SECRET=your_jwt_secret_here
```

### **Configuración Angular (environment.ts)**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000/api'
};
```

## 📊 Base de Datos

### **Tablas Principales**
- `catalogo` - Catálogos del sistema
- `catalogo_valor` - Valores de catálogos
- `inversion` - Inversiones principales
- `persona` - Personas del sistema
- `grupo_familiar` - Grupos familiares
- `instrumento` - Instrumentos financieros
- `emisor` - Entidades emisoras

## 🚀 Despliegue

### **Desarrollo**
- Backend: `php artisan serve --port=8000`
- Frontend: `ng serve --port=4200`

### **Producción**
- Backend: Configurar servidor web (Apache/Nginx)
- Frontend: `ng build` y desplegar archivos estáticos

## 📝 Notas

- El sistema utiliza arquitectura de microservicios con API REST
- Los componentes Angular son standalone (sin NgModule)
- La autenticación se maneja con JWT tokens
- El diseño es responsive con Bootstrap 5

## 🤝 Contribución

1. Fork del proyecto
2. Crear rama de características
3. Commits descriptivos
4. Pull Request

## 📄 Licencia

Proyecto privado - Todos los derechos reservados.

---

**Desarrollado con ❤️ para la gestión integral de inversiones**
