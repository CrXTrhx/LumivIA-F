<h1 align="center">LumivIA-F Frontend</h1>
<p align="center">Interfaz web para monitoreo urbano en tiempo real con visualizacion de trafico, emisiones, inundaciones y rutas inteligentes.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Framework-Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white&labelColor=000000" alt="Next.js" />
  <img src="https://img.shields.io/badge/Frontend-React_19-61DAFB?style=for-the-badge&logo=react&logoColor=0B0F1A&labelColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Lenguaje-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=3178C6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Estilos-Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white&labelColor=06B6D4" alt="Tailwind CSS" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Mapas-Mapbox_GL-4264FB?style=for-the-badge&logo=mapbox&logoColor=white&labelColor=4264FB" alt="Mapbox GL" />
  <img src="https://img.shields.io/badge/Visualizacion-Deck.gl-1D4ED8?style=for-the-badge&logo=webgl&logoColor=white&labelColor=1D4ED8" alt="Deck.gl" />
  <img src="https://img.shields.io/badge/Gestor-npm-CB3837?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837" alt="npm" />
  <img src="https://img.shields.io/badge/Lint-ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white&labelColor=4B32C3" alt="ESLint" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white&labelColor=000000" alt="Vercel" />
</p>

## Tabla de contenido

1. [Descripcion del frontend](#descripcion-del-frontend)
2. [Tecnologias usadas](#tecnologias-usadas)
3. [Requisitos previos](#requisitos-previos)
4. [Instalacion](#instalacion)
5. [Variables de entorno](#variables-de-entorno-env)
6. [Scripts disponibles](#scripts-disponibles)
7. [Como correr en local](#como-correr-en-local)
8. [Como generar build de produccion](#como-generar-build-de-produccion)
9. [Como hacer deploy](#como-hacer-deploy)
10. [Estructura del proyecto](#estructura-del-proyecto)
11. [Integracion con backend](#integracion-con-backend)
12. [Solucion de problemas comunes](#solucion-de-problemas-comunes)
13. [Contacto del proyecto](#contacto-del-proyecto)

## Descripcion del frontend

Este frontend centraliza la operacion visual de LumivIA para:

- Visualizar datos urbanos en un mapa interactivo.
- Simular y monitorear flujo vehicular y emisiones.
- Mostrar zonas de inundacion, lluvia y reportes ciudadanos.
- Calcular rutas y validarlas contra condiciones de riesgo.

El objetivo es ofrecer una interfaz unica para analisis operativo y toma de decisiones en tiempo real.

## Tecnologias usadas

| Categoria | Stack |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Libreria UI | React 19 |
| Tipado | TypeScript |
| Estilos | Tailwind CSS 4 |
| Mapas | Mapbox GL JS |
| Capas geoespaciales | deck.gl |
| Graficas | Recharts, Chart.js |
| Tiempo real | STOMP + SockJS |
| Calidad de codigo | ESLint |
| Gestor de paquetes | npm |

## Requisitos previos

- Node.js >= 18.18 (recomendado LTS actual).
- npm >= 9.
- Git.
- Token de Mapbox para el mapa global (seccion de globo/home).
- Backend disponible en `<API_BASE_URL>` para endpoints REST y WebSocket.

## Instalacion

```bash
git clone git@github.com:CrXTrhx/LumivIA-F.git
cd LumivIA-F
npm install
```

## Variables de entorno (`.env`)

Crea un archivo `.env.local` en la raiz del proyecto:

```bash
cp .env.local.example .env.local
```

Si no tienes `.env.local.example`, crea `.env.local` manualmente.

| Variable | Requerida | Ejemplo | Descripcion |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Si | `pk.xxxxxxxxx` | Token para el mapa de globo en la pagina principal. |
| `NEXT_PUBLIC_MAPBOX_TOKEN_LIVE_MAP` | Si | `pk.xxxxxxxxx` | Token para el modulo de mapa en vivo. |
| `NEXT_PUBLIC_MAPBOX_TOKEN_DASHBOARD` | Si | `pk.xxxxxxxxx` | Token para el mapa del dashboard. |
| `NEXT_PUBLIC_OPENWEATHER_API_KEY` | Recomendado | `xxxxxxxxxxxxxxxx` | API key para datos climaticos (lluvia/viento). |
| `PORT` | No | `<FRONTEND_PORT>` | Puerto del servidor Next.js (por defecto 3000). |
| `NEXT_PUBLIC_API_BASE_URL` | No | `<API_BASE_URL>` | URL base del backend si decides parametrizar llamadas en frontend. |

Valores de referencia para este proyecto:

- Frontend local: `http://localhost:3000`
- Backend esperado: `http://localhost:8080`

## Scripts disponibles

| Script | Comando | Descripcion |
| --- | --- | --- |
| `dev` | `npm run dev` | Inicia entorno de desarrollo. |
| `build` | `npm run build` | Genera build de produccion. |
| `start` | `npm run start` | Sirve la build de produccion. |
| `lint` | `npm run lint` | Ejecuta analisis estatico de codigo. |
| `preview` | `npm run build && npm run start` | Flujo equivalente de previsualizacion en Next.js. |

## Como correr en local

1. Clona el repositorio.
2. Instala dependencias.
3. Configura variables de entorno.
4. Levanta el servidor de desarrollo.

```bash
git clone git@github.com:CrXTrhx/LumivIA-F.git
cd LumivIA-F
npm install
npm run dev
```

Abre en navegador:

```bash
http://localhost:3000
```

## Como generar build de produccion

```bash
npm run build
npm run start
```

Para cambiar el puerto en produccion:

```bash
PORT=<FRONTEND_PORT> npm run start
```

## Como hacer deploy

### Opcion recomendada: Vercel

```bash
npm install -g vercel
vercel
```

Configura en la plataforma:

- Root Directory: `/`
- Build Command: `npm run build`
- Output: gestionado por Next.js
- Variables de entorno: las mismas de `.env.local`

### Opcion servidor propio

```bash
npm install
npm run build
PORT=<FRONTEND_PORT> npm run start
```

## Estructura del proyecto

```text
.
├── app/
│   ├── dynamic/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── lumivia/
│   │   ├── live-map/
│   │   ├── dashboard-section.tsx
│   │   ├── globe-section.tsx
│   │   └── map-section.tsx
│   └── ui/
├── hooks/
├── lib/
├── public/
├── styles/
├── next.config.mjs
├── package.json
└── tsconfig.json
```

## Integracion con backend

URL base esperada:

```bash
<API_BASE_URL>
```

En la implementacion actual, el modulo de mapa en vivo consume por defecto:

```bash
http://localhost:8080
```

Endpoints principales utilizados por el frontend:

| Tipo | Endpoint |
| --- | --- |
| REST | `/api/camaras` |
| REST | `/api/ruta` |
| REST | `/api/flood/geojson/grid` |
| REST | `/api/flood/geojson/reports` |
| REST | `/api/flood/reports` |
| REST | `/api/flood/risk` |
| WebSocket | `/ws` |
| STOMP Topic | `/topic/camaras` |

## Solucion de problemas comunes

### 1) Puerto ocupado

Sintoma: Next.js no inicia porque el puerto ya esta en uso.

Solucion:

```bash
PORT=<FRONTEND_PORT> npm run dev
```

### 2) Variable de entorno faltante

Sintoma: error relacionado con token de Mapbox en el globo o mapa.

Solucion:

```bash
# .env.local
NEXT_PUBLIC_MAPBOX_TOKEN=<TU_TOKEN_MAPBOX>
NEXT_PUBLIC_MAPBOX_TOKEN_LIVE_MAP=<TU_TOKEN_MAPBOX_LIVE_MAP>
NEXT_PUBLIC_MAPBOX_TOKEN_DASHBOARD=<TU_TOKEN_MAPBOX_DASHBOARD>
NEXT_PUBLIC_OPENWEATHER_API_KEY=<TU_OPENWEATHER_API_KEY>
```

Reinicia el servidor luego de cambiar variables.

### 3) Error CORS con backend

Sintoma: fallan llamadas a API o WebSocket desde el navegador.

Solucion:

- Verifica que el backend permita origen `http://localhost:3000` (o el puerto configurado).
- Confirma que `<API_BASE_URL>` sea accesible desde el navegador.
- Valida que el endpoint WebSocket `/ws` este habilitado y accesible.

## Contacto del proyecto

Para soporte tecnico o coordinacion de despliegues:

- Equipo: `<TEAM_NAME>`
- Email: `<CONTACT_EMAIL>`
- Repositorio: `git@github.com:CrXTrhx/LumivIA-F.git`
