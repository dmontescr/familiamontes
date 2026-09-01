# 🌳 Árbol Genealógico — Familia Montes

Aplicación web interactiva, moderna y privada para la gestión, preservación y visualización del árbol genealógico de la **Familia Montes**.

Repositorio oficial: [https://github.com/dmontescr/familiamontes](https://github.com/dmontescr/familiamontes)

---

## ✨ Características Principales

### 🔐 1. Seguridad y Acceso Restringido
- **Pantalla de autenticación privada** para familiares.
- **Control de seguridad:** Límite de **10 intentos fallidos por día**.
- **Bloqueo de seguridad:** Mensaje informativo tras 10 intentos: *"Acceso bloqueado. Contacte con el administrador de la web."*
- **Credenciales:** Usuario `navianos` · Contraseña `delavega` (persistencia de sesión segura en `sessionStorage`).

### 🌿 2. Visualizador Interactivo de Alta Fidelidad
- Visualización fluida con zoom, arrastre y centrado automático con **FamilyTreeJS**.
- **Diseño visual Montes:** Escudo heráldico auténtico de la Familia Montes (2 lobos pasantes en plata con bordura de gules y 8 sotueres).
- **Tarjetas optimizadas:** Dimensiones generosas con división en 2 líneas para nombres largos y centrado vertical equilibrado en nombres cortos.
- **Diferenciación visual:** Distinción por género y estado vital (indicador sutil para personas fallecidas).

### 👥 3. Ficha Lateral de Perfil y Relaciones Estructuradas
- Panel lateral (*Drawer*) con detalles biográficos (fechas, lugar de residencia, profesión y recuerdos).
- **Bloque destacado de Familiares Directos:**
  - **Padres:** Fila individual para el Padre y fila individual para la Madre.
  - **Cónyuge:** Fila para el cónyuge o pareja.
  - **Hermanos:** Listado en filas separadas con viñeta para cada hermano/a.
  - **Hijos:** Listado en filas separadas con viñeta para cada hijo/a.
- **Reglas de parentesco:** Restricción de máximo 1 padre, 1 madre y 1 cónyuge por persona con desactivación automática de botones ya asignados.

### 📍 4. Autocompletado de Municipios y Provincias de España
- Base de datos oficial integrada con los **8.134 municipios de España** (`data/municipios.json`).
- Búsqueda en tiempo real con tolerancia a tildes y orden de relevancia.
- Formato automático: **`Municipio (Provincia)`** (ej. *Navianos de la Vega (León)*, *La Bañeza (León)*, *Alcalá de Henares (Madrid)*).
- Geocodificador en vivo para aldeas y pedanías menores.

### 📷 5. Subida y Optimización de Fotos
- Botón directo para subir fotografías desde cualquier dispositivo (móvil u ordenador).
- Compresión y recorte inteligente en el navegador mediante Canvas (JPEG optimizado) para un rendimiento instantáneo sin saturar almacenamiento.
- Opción para retirar o sustituir la fotografía en cualquier momento.

### 📄 6. Exportación en PDF Horizontal de Alta Resolución
- Descarga del mapa genealógico completo en una **única hoja horizontal** de alta definición (*High-DPI*), optimizada para visualización con zoom en pantallas móviles y tablets.

---

## 📁 Estructura del Proyecto

```text
familiamontes/
├── index.html              # Estructura semántica, visor, modales y login
├── styles.css              # Sistema de diseño, paleta tierra/terracota y responsive
├── app.js                  # Lógica de árbol, seguridad, CRUD, autocompletado y fotos
├── assets/
│   ├── escudo_familia_montes.png   # Escudo heráldico oficial
│   └── favicon.svg                 # Icono del árbol
├── data/
│   ├── tree.json           # Datos genealógicos de la Familia Montes
│   └── municipios.json     # Censo oficial de 8.134 municipios y provincias de España
├── functions/
│   └── api/
│       └── save.js         # Endpoint Serverless para persistencia en GitHub API
└── README.md               # Documentación del proyecto
```

---

## 💻 Ejecución y Desarrollo Local

Puedes abrir y probar la aplicación en tu entorno local con cualquier servidor web estático:

```bash
# Con Python 3:
python3 -m http.server 8080

# Con npx (Node.js):
npx serve .
```

Abre **`http://localhost:8080`** en tu navegador e ingresa con las credenciales familiares (`navianos` / `delavega`).
