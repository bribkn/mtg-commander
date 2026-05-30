# ✨ MTG Commander TTS Builder

[![React](https://img.shields.io/badge/React-19.2-blue?logo=react&logoColor=white)](https://react.dev)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**MTG Commander TTS Builder** es un constructor de mazos interactivo, moderno y premium diseñado para la comunidad de Magic: The Gathering. Permite diseñar mazos Commander, personalizar el arte de las cartas, configurar reversos personalizados y exportar los mazos de manera impecable y directa a **Tabletop Simulator (TTS)** en formato JSON compatible.

Todo esto está envuelto en una interfaz oscura cinemática y de alto rendimiento basada en un sistema de diseño rojo y negro de alta gama.

---

## 🌟 Características Destacadas (Key Features)

### 1. 🎴 Panel de Mazos Multipropósito (Multi-Deck Dashboard)
* **Estética de Vidrio Esmerilado (Glassmorphic Design)**: Una pantalla de bienvenida espectacular con animaciones fluidas de entrada.
* **Mosaico Dinámico**: Muestra tus mazos guardados usando el **arte de portada personalizado** recortado de Scryfall.
* **Estadísticas en Tiempo Real**: Visualiza el número total de cartas, comandantes y tu porcentaje de victorias (**Winrate**) directamente en la tarjeta de cada mazo.
* **Acciones Rápidas**: Duplica, elimina o edita tus mazos con un solo clic.

### 2. 🌌 Banner Panorámico del Mazo (Panoramic Deck Hero Banner)
* Un banner inmersivo en la parte superior del editor que se adapta automáticamente al arte ilustrado de tu comandante o de la carta que elijas como portada (`art_crop`).
* **Edición en Línea**: Haz clic directamente sobre el título del mazo para renombrarlo instantáneamente en tiempo real.
* **Efecto de Pulso de Comandante**: Muestra la corona del comandante con sutiles microanimaciones interactivas.

### 3. 🛡️ Cuatro Vistas Premium de Cartas
* **Grid Visual (Por Defecto)**: Una rejilla de alta resolución con cartas a tamaño completo (`200px` - `250px`) y un espaciado ultra ajustado (`gap-2`) para emular una carpeta física. Al pasar el cursor, revela un menú de controles donde puedes alterar cantidades, asignar comandante, definir portada o cambiar de arte.
* **Visual Stack (Pila)**: Cartas superpuestas verticalmente que recrean la pila de cartas de una partida física. Al pasar el cursor sobre cualquier carta, esta se desplaza suavemente hacia arriba y adelante.
* **Lista Detallada (Text View)**: Fila clásica con un diseño limpio de información de costes de maná, tipo de carta, miniaturas detalladas y controles completos de edición.
* **Texto Condensado**: Una vista ultra compacta para mazos masivos, ideal para ver de un vistazo todo tu mazo con mínimas distracciones visuales.

### 4. ⚡ Integración de Combos (Commander Spellbook)
* Cada carta en cualquier vista incluye un botón interactivo de **Rayo Amarillo (`Zap`)**.
* Dado que EDHREC obtiene todos sus datos de combos de **Commander Spellbook**, este botón te redirige de manera directa y optimizada a la consulta exacta de esa carta en el motor de combos oficial, detallando instrucciones paso a paso, identidades de color requeridas y piezas sustitutas sin tiempos de carga extras.

### 5. 🖼️ Selector de Variantes de Arte (Widescreen Modal)
* ¿Quieres tu *Sol Ring* de Beta, con arte promocional, o con el marco retro? Un botón de galería te abre un diálogo panorámico de pantalla completa (`max-w-5xl`) que consulta en vivo la API de Scryfall para traerte todas las impresiones históricas de esa carta.
* Al seleccionar la variante, el arte se actualiza **instantáneamente** en la pila visual, en el banner panorámico del editor, en el panel del dashboard y en el archivo exportado para TTS.

### 6. 🎨 Reverso Personalizado con Ajuste Proporcional (Custom Cardbacks)
* El reverso por defecto se ha actualizado al icónico diseño de fantasía.
* Puedes subir cualquier URL de imagen para tu reverso.
* **Recorte Inteligente (`object-cover`)**: Si subes una imagen más ancha de lo normal, el constructor la ajustará proporcionalmente a una plantilla de carta vertical de Magic (proporción 5:7) sin estirarla ni deformarla.
* **Galería de Reversos**: Guarda un registro de todos los reversos que has usado para poder seleccionarlos rápidamente o eliminarlos si ya no los necesitas.

### 7. 🏆 Registro de Rendimiento y Winrate %
* Registra tus victorias y derrotas en tiempo real directamente desde el panel de estadísticas del editor.
* El constructor calcula y actualiza tu porcentaje de victorias y muestra una medalla dorada de rendimiento en la portada del mazo en el dashboard.

### 8. 📝 Importación Inteligente en Bloques y Detección de Comandante
* El importador masivo analiza tu lista por bloques de texto separados por líneas vacías.
* **Detección Automática**: Si dejas una línea vacía y una carta aislada al final (o una sección corta), el sistema la detectará automáticamente como tu Comandante y le asignará la corona sin que tengas que hacerlo manualmente.

---

## 🛠️ Stack Tecnológico (Tech Stack)

* **Framework**: [Next.js 16](https://nextjs.org) (App Router con Turbopack)
* **Biblioteca Principal**: [React 19](https://react.dev)
* **Estilos**: Tailwind CSS 4 & Custom Vanilla CSS Tokens
* **Iconos**: [Lucide React](https://lucide.dev)
* **Componentes base**: Shadcn UI & Radix Premier Primitives
* **Base de datos**: Sincronización en tiempo real y persistencia en `localStorage` (sin base de datos externa para máxima privacidad).

---

## 🚀 Instalación y Desarrollo (Getting Started)

Sigue estos pasos para ejecutar el proyecto en tu máquina local:

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/mtg-commander-tts.git
cd mtg-commander-tts
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar el servidor de desarrollo
```bash
npm run dev
```

El servidor local se iniciará en `http://localhost:3000`.

### 4. Construir para producción
Para compilar y validar que todo esté libre de errores de TypeScript antes de desplegar:
```bash
npm run build
```

---

## 📂 Estructura del Proyecto (Architecture)

El código está estructurado de manera modular y limpia:

```
├── app/
│   ├── api/                   # Rutas de API para consultas a Archidekt y Moxfield
│   ├── layout.tsx             # Proveedor global y fuentes del sistema
│   └── page.tsx               # Entrada principal (Conmutador entre Dashboard y Editor)
├── components/
│   ├── ui/                    # Componentes base atómicos de Shadcn (Dialog, Input, Button, etc.)
│   ├── CardbackModal.tsx      # Modal de carga y galería de reversos personalizados
│   ├── CardList.tsx           # El corazón del editor (Maneja las 4 vistas de cartas y selector de variantes)
│   ├── CardSearchBar.tsx      # Buscador con autocompletado fuzzy y llamadas a Scryfall
│   ├── DeckDashboard.tsx      # Landing page / Selector de mazos guardados con badges de Winrate
│   ├── DeckHeader.tsx         # Encabezado del constructor con el Banner Hero y edición de título
│   ├── ExportPanel.tsx        # Panel de exportación en JSON para Tabletop Simulator
│   ├── ImportModal.tsx        # Interfaz de bulk import y llamadas a APIs de importadores externos
│   └── StatsPanel.tsx         # Panel de estadísticas (Curva de maná, Winrate y recuento de Game Changers)
├── lib/
│   ├── deck-store.tsx         # Estado global (Contexto de React, Reducer y persistencia local)
│   ├── import.ts              # Algoritmos de análisis de texto en bloques y conectores externos
│   ├── scryfall.ts            # Cliente API de Scryfall (Búsquedas, categorías y variantes)
│   └── tts-export.ts          # Compilador JSON para la generación de archivos de Tabletop Simulator
├── public/                    # Assets estáticos
└── package.json
```

---

## 🤝 Contribuciones (Open Source Contributions)

Este es un proyecto **completamente open-source** disponible para que cualquiera lo mejore, lo clone o lo use de base para sus propios constructores. ¡Cualquier ayuda es bienvenida!

Si quieres contribuir:
1. Haz un **Fork** del proyecto.
2. Crea tu rama de características (`git checkout -b feature/nueva-caracteristica`).
3. Confirma tus cambios (`git commit -m 'Añade nueva característica'`).
4. Haz push a tu rama (`git push origin feature/nueva-caracteristica`).
5. Abre un **Pull Request**.

---

## 📝 Licencia

Este proyecto está bajo la Licencia **MIT**. Eres libre de usarlo, modificarlo y distribuirlo comercialmente o de forma privada.

*¡Desarrollado con pasión para los amantes de Magic: The Gathering! Que tus tierras nunca se giren sin maná disponible.* 🃏✨
