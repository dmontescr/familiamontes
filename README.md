# 🌳 Árbol Genealógico — Familia Montes

Aplicación web interactiva, moderna y privada para la gestión, preservación y visualización del árbol genealógico de la **Familia Montes**.

Repositorio oficial: [https://github.com/dmontescr/familiamontes](https://github.com/dmontescr/familiamontes)

---

## ✨ Características Principales

### 🔐 1. Seguridad y Acceso Restringido
- **Pantalla de autenticación privada** para familiares autorizados.
- **Control de seguridad:** Límite de **10 intentos fallidos por día** con bloqueo temporal informativo.
- **Persistencia de sesión:** Sesión protegida y validada en `sessionStorage`.
- **Privacidad estricta:** No se exponen credenciales ni claves privadas en el código público.

### 🌿 2. Visualizador Interactivo de Alta Fidelidad
- Visualización fluida con zoom, arrastre y centrado automático con **FamilyTreeJS**.
- **Diseño visual Montes:** Escudo heráldico auténtico de la Familia Montes (2 lobos pasantes en plata con bordura de gules y 8 sotueres).
- **Tarjetas compactas y proporcionadas (255 × 110 px):** Proporción armónica que mantiene las ramas unidas y legibles.
- **Franjas de género 100% integradas (`clip-path`):** Curvatura suave y unificada para los identificadores masculino (azul) y femenino (rosa).
- **Tipografía inteligente:** Nombres estándar en una sola línea centrada y división automática equilibrada en dos líneas para nombres largos.
- **Cálculo automático de edad:** Muestra el año de nacimiento y la edad actual para familiares vivos (ej. `1989 (37 años)`) o el rango y edad alcanzada para fallecidos (ej. `1932 — 2017 (85 años)`).
- **Indicador geográfico:** Chincheta roja (`📍`) junto al municipio y provincia de residencia.

### 👥 3. Ficha Lateral de Perfil y Relaciones Estructuradas
- Panel lateral (*Drawer*) con datos biográficos, lugar de residencia, profesión y memorias.
- **Bloque destacado de Familiares Directos:**
  - **Padres:** Fila individual para el Padre y fila individual para la Madre.
  - **Cónyuge:** Fila para el cónyuge o pareja.
  - **Hermanos:** Listado individual con viñeta para cada hermano/a.
  - **Hijos:** Listado individual con viñeta para cada hijo/a.
- **Acciones directas:** Acceso rápido a *Editar Datos* y *Eliminar Familiar* (con confirmación de seguridad).

### 🧬 4. Motor de Validación de Consanguinidad y Parentesco
- **Restricción de familiares directos de sangre:** Detección recursiva en todo el árbol que impide seleccionar en el desplegable de pareja a padres, abuelos, bisabuelos, hijos, nietos, hermanos, tíos o sobrinos.
- **Saneamiento bidireccional del grafo:** Validación automática de vínculos de cónyuge (`pids`) para prevenir bucles o inconsistencias.
- **Protección contra fallos:** Detección de errores con tarjeta de diagnóstico y botón para restaurar la versión anterior en un clic.

### 📍 5. Autocompletado de Municipios y Provincias de España
- Base de datos oficial integrada con los **8.134 municipios de España** (`data/municipios.json`).
- Búsqueda en tiempo real con tolerancia a tildes y orden de relevancia.
- Formato automático: **`Municipio (Provincia)`** (ej. *Navianos de la Vega (León)*, *La Bañeza (León)*, *Madrid (Madrid)*).
- Geocodificador en vivo para aldeas y pedanías menores.

### 💼 6. Autocompletado Flexible de Profesiones y Oficios
- Catálogo de más de **270 profesiones y oficios** en formato compacto inclusivo (`data/profesiones.json`, ej. *Biólogo/a*, *Ingeniero/a*, *Agricultor/a*).
- Sugerencias inteligentes mientras escribes con soporte para texto libre personalizado.

### 📷 7. Fotografías, Carpeta `/photos` y Visor en Grande (Lightbox)
- Carpeta dedicada `/photos` con nombres de archivo estructurados (`photos/nombre_persona.jpg`).
- Subida directa de fotos desde cualquier móvil u ordenador.
- Compresión y recorte inteligente en el navegador mediante Canvas (JPEG optimizado).
- **Visor Lightbox en Alta Definición:** Al pulsar sobre cualquier foto en el árbol o en el perfil, se abre ampliada a pantalla completa con fondo difuminado, fechas y edad.
- Sustitución y eliminación sincronizada de fotografías obsoletas.

### 📄 8. Exportación a PDF en Ultra Alta Resolución
- **Captura total del árbol:** Cálculo geométrico global (*bounding box*) para incluir **todas las ramas, niveles y generaciones**, sin importar qué parte esté visible en pantalla.
- **Formato normalizado horizontal:** Relación de aspecto estándar (DIN A3 / A2) centrado con márgenes de seguridad.
- **Nitidez 300+ DPI (Escala 3.0x):** Renderizado vectorial de máxima calidad para lectura con zoom e impresión en cualquier impresora o copistería.
- Descarga directa como **`arbol_genealogico_familia_montes.pdf`**.

---

## 📁 Estructura del Proyecto

```text
familiamontes/
├── index.html              # Estructura semántica, visor, modales y login
├── styles.css              # Sistema de diseño noble, paleta tierra y responsive
├── app.js                  # Lógica del árbol, seguridad, CRUD, autocompletado y PDF
├── assets/
│   ├── escudo_familia_montes.png   # Escudo heráldico oficial de la Familia Montes
│   └── favicon.svg                 # Icono de la web
├── photos/                 # Fotografías optimizadas de los familiares
├── data/
│   ├── tree.json           # Datos genealógicos completos
│   ├── municipios.json     # Censo de los 8.134 municipios de España
│   └── profesiones.json    # Catálogo de 270 profesiones y oficios
├── functions/
│   └── api/
│       └── save.js         # Endpoint Serverless para persistencia segura en GitHub API
└── README.md               # Documentación y manual del proyecto
```

---

## 💻 Ejecución y Desarrollo Local

Puedes ejecutar la aplicación en tu entorno local con cualquier servidor web estático:

```bash
# Con Python 3:
python3 -m http.server 8080

# Con npx (Node.js):
npx serve .
```

Abre **`http://localhost:8080`** en tu navegador e ingresa con las credenciales familiares autorizadas.
