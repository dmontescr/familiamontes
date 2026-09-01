/**
 * ==========================================================================
 * ÁRBOL GENEALÓGICO — FAMILIA MONTES (Navianos de la Vega, León)
 * Lógica Frontend, Visualización Interactiva, CRUD y Sincronización GitHub
 * ==========================================================================
 */

// Estado global de la aplicación
const AppState = {
  treeData: [],
  treeInstance: null,
  selectedPersonId: null,
  hasUnsavedChanges: false,
  isAuthenticated: false,
  photosCache: {},      // Mapeo de 'photos/nombre_persona.jpg' -> base64 DataURL
  deletedPhotos: new Set() // Set de 'photos/...' marcadas para eliminar
};

// Generar nombre de archivo limpio para la carpeta photos/
function slugifyPersonName(name) {
  if (!name) return "familiar";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Obtener URL de imagen (sea base64 local, ruta de photos/ o avatar por defecto)
function getPersonPhotoUrl(photoValue, gender) {
  if (!photoValue) return getDefaultAvatar(gender);
  if (photoValue.startsWith("photos/")) {
    if (AppState.photosCache && AppState.photosCache[photoValue]) {
      return AppState.photosCache[photoValue];
    }
    return photoValue;
  }
  return photoValue;
}

// Credenciales de acceso Gatekeeper
const AUTH_CREDENTIALS = {
  user: "navianos",
  pass: "delavega"
};

// Datos predeterminados de respaldo (por si falla fetch en entornos locales file://)
const DEFAULT_TREE_DATA = [
  {
    "id": 1,
    "pids": [2],
    "name": "Francisco Montes Vega",
    "gender": "male",
    "birth": "1932",
    "death": "2018",
    "city": "Navianos de la Vega (León)",
    "profession": "Agricultor y Ganadero",
    "photo": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
    "notes": "Patriarca de la rama Montes de Navianos. Gran aficionado a las tradiciones leonesas."
  },
  {
    "id": 2,
    "pids": [1],
    "name": "María del Carmen Fernández Santos",
    "gender": "female",
    "birth": "1935",
    "death": "2021",
    "city": "Navianos de la Vega (León)",
    "profession": "Maestra de Primaria",
    "photo": "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=300&auto=format&fit=crop&q=80",
    "notes": "Matriarca de la familia. Enseñó a leer a varias generaciones del pueblo."
  },
  {
    "id": 3,
    "mid": 2,
    "fid": 1,
    "pids": [4],
    "name": "Manuel Montes Fernández",
    "gender": "male",
    "birth": "1960",
    "death": "",
    "city": "León / Navianos",
    "profession": "Ingeniero Agrónomo",
    "photo": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    "notes": "Hijo mayor de Francisco y Carmen."
  },
  {
    "id": 4,
    "pids": [3],
    "name": "Rosa María García López",
    "gender": "female",
    "birth": "1963",
    "death": "",
    "city": "Astorga (León)",
    "profession": "Enfermera",
    "photo": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
    "notes": "Casada con Manuel desde 1988."
  },
  {
    "id": 5,
    "mid": 2,
    "fid": 1,
    "pids": [6],
    "name": "Elena Montes Fernández",
    "gender": "female",
    "birth": "1964",
    "death": "",
    "city": "Madrid",
    "profession": "Arquitecta",
    "photo": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80",
    "notes": "Hija de Francisco y Carmen. Reside en Madrid."
  },
  {
    "id": 6,
    "pids": [5],
    "name": "Javier Ruiz Gómez",
    "gender": "male",
    "birth": "1962",
    "death": "",
    "city": "Madrid",
    "profession": "Profesor de Historia",
    "photo": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    "notes": "Casado con Elena."
  },
  {
    "id": 7,
    "mid": 2,
    "fid": 1,
    "pids": [],
    "name": "Antonio Montes Fernández",
    "gender": "male",
    "birth": "1968",
    "death": "",
    "city": "Valladolid",
    "profession": "Veterinario",
    "photo": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80",
    "notes": "Hijo menor de Francisco y Carmen."
  },
  {
    "id": 8,
    "mid": 4,
    "fid": 3,
    "pids": [9],
    "name": "David Montes García",
    "gender": "male",
    "birth": "1990",
    "death": "",
    "city": "Madrid / Navianos",
    "profession": "Desarrollador de Software",
    "photo": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80",
    "notes": "Nieto de Francisco y Carmen. Creador de la web de la familia."
  },
  {
    "id": 9,
    "pids": [8],
    "name": "Lucía Álvarez Martín",
    "gender": "female",
    "birth": "1992",
    "death": "",
    "city": "Madrid",
    "profession": "Diseñadora UX",
    "photo": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    "notes": "Pareja de David."
  },
  {
    "id": 10,
    "mid": 4,
    "fid": 3,
    "pids": [],
    "name": "Sara Montes García",
    "gender": "female",
    "birth": "1994",
    "death": "",
    "city": "León",
    "profession": "Bióloga",
    "photo": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    "notes": "Hija de Manuel y Rosa."
  },
  {
    "id": 11,
    "mid": 5,
    "fid": 6,
    "pids": [],
    "name": "Pablo Ruiz Montes",
    "gender": "male",
    "birth": "1996",
    "death": "",
    "city": "Madrid",
    "profession": "Músico y Productor",
    "photo": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80",
    "notes": "Hijo de Elena y Javier."
  },
  {
    "id": 12,
    "mid": 9,
    "fid": 8,
    "pids": [],
    "name": "Mateo Montes Álvarez",
    "gender": "male",
    "birth": "2023",
    "death": "",
    "city": "Madrid",
    "profession": "",
    "photo": "https://images.unsplash.com/photo-1596870230751-ebdfce98ec42?w=300&auto=format&fit=crop&q=80",
    "notes": "Biznieto de Francisco y Carmen. La nueva generación."
  }
];

// ==========================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Inicializar iconos de Lucide
  refreshIcons();

  // Comprobar autenticación guardada en sessionStorage
  checkSession();

  // Registrar eventos de interfaz
  setupAuthEvents();
  setupToolbarEvents();
  setupModalEvents();
  setupDrawerEvents();
  setupSearchEvents();

  // Redibujar árbol al redimensionar pantalla
  window.addEventListener("resize", () => {
    if (AppState.treeInstance && typeof AppState.treeInstance.draw === "function") {
      AppState.treeInstance.draw();
    }
  });
});

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

// ==========================================================================
// 1. MÓDULO DE AUTENTICACIÓN (GATEKEEPER) CON LÍMITE DE 10 INTENTOS AL DÍA
// ==========================================================================
const MAX_LOGIN_ATTEMPTS = 10;

function getTodayKey() {
  return "montes_attempts_" + new Date().toISOString().slice(0, 10);
}

function getFailedAttemptsToday() {
  const key = getTodayKey();
  return parseInt(localStorage.getItem(key) || "0", 10);
}

function registerFailedAttempt() {
  const key = getTodayKey();
  const current = getFailedAttemptsToday();
  const updated = current + 1;
  localStorage.setItem(key, updated.toString());
  return updated;
}

function resetFailedAttempts() {
  const key = getTodayKey();
  localStorage.removeItem(key);
}

function checkSession() {
  const isAuth = sessionStorage.getItem("montes_auth_logged_in") === "true";
  if (isAuth) {
    showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app-container").style.display = "none";
  AppState.isAuthenticated = false;

  // Comprobar si se ha alcanzado el límite diario de intentos
  checkLoginLockoutState();
}

function checkLoginLockoutState() {
  const attempts = getFailedAttemptsToday();
  const errorMsg = document.getElementById("login-error-msg");
  const loginBtn = document.getElementById("btn-submit-login");
  const userInput = document.getElementById("login-user");
  const passInput = document.getElementById("login-pass");

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    if (userInput) userInput.disabled = true;
    if (passInput) passInput.disabled = true;
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.style.opacity = "0.5";
      loginBtn.style.cursor = "not-allowed";
    }
    if (errorMsg) {
      errorMsg.style.display = "flex";
      errorMsg.innerHTML = `
        <i data-lucide="shield-alert" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
        <span>Acceso bloqueado. Contacte con el administrador de la web.</span>
      `;
      refreshIcons();
    }
    return true;
  }
  return false;
}

function showApp() {
  document.getElementById("login-screen").classList.add("hidden");
  const appContainer = document.getElementById("app-container");
  appContainer.style.display = "flex";
  AppState.isAuthenticated = true;
  refreshIcons();

  // Forzar cálculo de dimensiones de layout
  window.dispatchEvent(new Event("resize"));

  // Cargar datos del árbol genealógico
  loadTreeData();
}

function setupAuthEvents() {
  const loginForm = document.getElementById("login-form");
  const loginUser = document.getElementById("login-user");
  const loginPass = document.getElementById("login-pass");
  const errorMsg = document.getElementById("login-error-msg");
  const btnLogout = document.getElementById("btn-logout");

  // Verificar estado inicial de bloqueo
  checkLoginLockoutState();

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // 1. Validar bloqueo por intentos diarios
    if (checkLoginLockoutState()) {
      return;
    }

    const user = loginUser.value.trim();
    const pass = loginPass.value.trim();

    // 2. Validación de credenciales
    if (user === AUTH_CREDENTIALS.user && pass === AUTH_CREDENTIALS.pass) {
      resetFailedAttempts();
      errorMsg.style.display = "none";
      sessionStorage.setItem("montes_auth_logged_in", "true");
      showApp();
      showToast("¡Bienvenido/a a la Casa Montes!", "success");
    } else {
      const attemptsCount = registerFailedAttempt();
      const remaining = MAX_LOGIN_ATTEMPTS - attemptsCount;

      loginPass.value = "";
      loginPass.focus();

      if (attemptsCount >= MAX_LOGIN_ATTEMPTS) {
        checkLoginLockoutState();
        showToast("Acceso bloqueado. Contacte con el administrador de la web.", "error", 6000);
      } else {
        errorMsg.style.display = "flex";
        errorMsg.innerHTML = `
          <i data-lucide="alert-circle" style="width: 16px; height: 16px; flex-shrink: 0;"></i>
          <span>Usuario o contraseña incorrectos. Te quedan <strong>${remaining}</strong> intento(s) hoy.</span>
        `;
        refreshIcons();
      }
    }
  });

  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem("montes_auth_logged_in");
    showLogin();
    showToast("Sesión cerrada correctamente", "info");
  });
}

// ==========================================================================
// 2. CARGA Y PERSISTENCIA DE DATOS
// ==========================================================================
async function loadTreeData() {
  // Cargar caché local de fotos y eliminaciones
  const cachedPhotos = localStorage.getItem("montes_photos_cache");
  if (cachedPhotos) {
    try {
      AppState.photosCache = JSON.parse(cachedPhotos);
    } catch (e) {}
  }
  const cachedDeletions = localStorage.getItem("montes_photos_deletions");
  if (cachedDeletions) {
    try {
      AppState.deletedPhotos = new Set(JSON.parse(cachedDeletions));
    } catch (e) {}
  }

  // 1. Intentar cargar desde el archivo data/tree.json
  try {
    const response = await fetch("data/tree.json?nocache=" + Date.now());
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        AppState.treeData = data;
        localStorage.setItem("montes_tree_cache", JSON.stringify(data));
        initTreeVisualization();
        updateHeaderSummary();
        return;
      }
    }
  } catch (err) {
    console.warn("No se pudo cargar data/tree.json por fetch (posible modo offline/file):", err);
  }

  // 2. Si falla fetch, recurrir a localStorage
  const cachedData = localStorage.getItem("montes_tree_cache");
  if (cachedData) {
    try {
      AppState.treeData = JSON.parse(cachedData);
      initTreeVisualization();
      updateHeaderSummary();
      return;
    } catch (e) {
      console.error("Error al parsear caché local:", e);
    }
  }

  // 3. Fallback a datos predeterminados
  AppState.treeData = JSON.parse(JSON.stringify(DEFAULT_TREE_DATA));
  localStorage.setItem("montes_tree_cache", JSON.stringify(AppState.treeData));
  initTreeVisualization();
  updateHeaderSummary();
}

function setUnsavedChanges(status) {
  AppState.hasUnsavedChanges = status;
  const badge = document.getElementById("unsaved-indicator");
  if (badge) {
    if (status) {
      badge.classList.add("visible");
    } else {
      badge.classList.remove("visible");
    }
  }
}

function updateHeaderSummary() {
  const summaryEl = document.getElementById("header-tree-summary");
  if (summaryEl) {
    const total = AppState.treeData.length;
    summaryEl.textContent = `Árbol Genealógico · ${total} familiares`;
  }
}

// ==========================================================================
// 3. VISUALIZACIÓN DEL ÁRBOL GENEALÓGICO (FamilyTreeJS)
// ==========================================================================

/**
 * Normaliza y sanea las referencias de parentesco para asegurar que FamilyTreeJS
 * renderice el árbol de forma 100% estable sin excepciones de layout.
 */
function cleanAndValidateTreeData(data) {
  if (!Array.isArray(data)) return [];
  const personMap = new Map();
  data.forEach(p => {
    if (p && p.id) personMap.set(p.id, p);
  });

  data.forEach(p => {
    if (!Array.isArray(p.pids)) p.pids = [];
    
    // Quitar a uno mismo y IDs inexistentes
    p.pids = p.pids.filter(pid => pid !== p.id && personMap.has(pid));

    // Validar fid y mid (eliminar si apuntan a sí mismos o IDs inexistentes)
    if (p.fid && (!personMap.has(p.fid) || p.fid === p.id)) delete p.fid;
    if (p.mid && (!personMap.has(p.mid) || p.mid === p.id)) delete p.mid;

    // Si tiene más de una pareja, dejar solo la primera para evitar conflictos de layout
    if (p.pids.length > 1) {
      p.pids = [p.pids[0]];
    }
  });

  // Asegurar simetría estricta en parejas
  data.forEach(p => {
    if (p.pids && p.pids.length > 0) {
      const partnerId = p.pids[0];
      const partner = personMap.get(partnerId);
      if (partner) {
        if (!Array.isArray(partner.pids)) partner.pids = [];
        if (partner.pids[0] !== p.id) {
          partner.pids = [p.id];
        }
      } else {
        p.pids = [];
      }
    }
  });

  return data;
}

window.restoreLastValidTree = function() {
  if (AppState.lastValidTreeData && AppState.lastValidTreeData.length > 0) {
    AppState.treeData = JSON.parse(JSON.stringify(AppState.lastValidTreeData));
    persistLocalTree();
    initTreeVisualization();
    showToast("Se ha restaurado la versión anterior del árbol", "info");
  } else {
    loadTreeData();
  }
};

function initTreeVisualization() {
  const container = document.getElementById("tree-canvas");
  if (!container) return;

  if (typeof FamilyTree === "undefined") {
    container.innerHTML = `
    <div style="text-align: center; padding: 4rem 2rem; color: #a64b2a;">
      <i data-lucide="alert-circle" style="width: 48px; height: 48px; margin: 0 auto 1rem;"></i>
      <h3>Error al cargar la librería del árbol interactivo</h3>
      <p style="margin-top: 0.5rem; font-size: 0.9rem;">Por favor, comprueba tu conexión a Internet para cargar la librería desde el CDN.</p>
    </div>`;
    return;
  }

  // Asegurar que el contenedor tenga dimensiones calculadas antes de renderizar
  setTimeout(() => {
    container.innerHTML = "";

    // Sanear y normalizar el grafo genealógico
    cleanAndValidateTreeData(AppState.treeData);

    // Configuración de plantilla espaciosa y elegante para la Familia Montes
    FamilyTree.templates.montesTheme = Object.assign({}, FamilyTree.templates.john);
    FamilyTree.templates.montesTheme.size = [285, 114];
    
    // Tarjeta noble con amplio espacio y sombra suave
    FamilyTree.templates.montesTheme.node = `
      <rect x="0" y="0" height="114" width="285" fill="#ffffff" stroke-width="1.5" stroke="#d5cdbf" rx="14" ry="14" class="node-box" filter="drop-shadow(0px 4px 12px rgba(0,0,0,0.07))"></rect>
      <rect x="0" y="0" height="114" width="7" fill="#a64b2a" rx="4" ry="4"></rect>
    `;

    // Tarjetas diferenciadas por género
    FamilyTree.templates.montesTheme_male = Object.assign({}, FamilyTree.templates.montesTheme);
    FamilyTree.templates.montesTheme_male.node = `
      <rect x="0" y="0" height="114" width="285" fill="#ffffff" stroke-width="1.5" stroke="#cbd5e1" rx="14" ry="14" class="node-box" filter="drop-shadow(0px 4px 12px rgba(37,99,235,0.08))"></rect>
      <rect x="0" y="0" height="114" width="7" fill="#2563eb" rx="4" ry="4"></rect>
    `;

    FamilyTree.templates.montesTheme_female = Object.assign({}, FamilyTree.templates.montesTheme);
    FamilyTree.templates.montesTheme_female.node = `
      <rect x="0" y="0" height="114" width="285" fill="#ffffff" stroke-width="1.5" stroke="#fbcfe8" rx="14" ry="14" class="node-box" filter="drop-shadow(0px 4px 12px rgba(219,39,119,0.08))"></rect>
      <rect x="0" y="0" height="114" width="7" fill="#db2777" rx="4" ry="4"></rect>
    `;

    // Fotografía circular centrada verticalmente con cursor de ampliación
    FamilyTree.templates.montesTheme.img_0 = `
      <clipPath id="ulaImg{id}"><circle cx="48" cy="57" r="30"></circle></clipPath>
      <circle cx="48" cy="57" r="32" fill="none" stroke="#e2d9cd" stroke-width="2"></circle>
      <image preserveAspectRatio="xMidYMid slice" clip-path="url(#ulaImg{id})" xlink:href="{val}" x="18" y="27" width="60" height="60" style="cursor: zoom-in; pointer-events: all;"></image>
    `;
    FamilyTree.templates.montesTheme_male.img_0 = FamilyTree.templates.montesTheme.img_0;
    FamilyTree.templates.montesTheme_female.img_0 = FamilyTree.templates.montesTheme.img_0;

    // Nombre Línea 1 (para nombres largos en 2 líneas)
    FamilyTree.templates.montesTheme.field_0 = `
      <text style="font-size: 13.5px; font-weight: 700; font-family: 'Outfit', -apple-system, sans-serif;" fill="#1e293b" x="88" y="28">{val}</text>
    `;
    FamilyTree.templates.montesTheme_male.field_0 = FamilyTree.templates.montesTheme.field_0;
    FamilyTree.templates.montesTheme_female.field_0 = FamilyTree.templates.montesTheme.field_0;

    // Nombre Línea 2 (para nombres largos en 2 líneas)
    FamilyTree.templates.montesTheme.field_3 = `
      <text style="font-size: 13.5px; font-weight: 700; font-family: 'Outfit', -apple-system, sans-serif;" fill="#1e293b" x="88" y="46">{val}</text>
    `;
    FamilyTree.templates.montesTheme_male.field_3 = FamilyTree.templates.montesTheme.field_3;
    FamilyTree.templates.montesTheme_female.field_3 = FamilyTree.templates.montesTheme.field_3;

    // Nombre en 1 sola línea (centrado y equilibrado)
    FamilyTree.templates.montesTheme.field_4 = `
      <text style="font-size: 14.5px; font-weight: 700; font-family: 'Outfit', -apple-system, sans-serif;" fill="#1e293b" x="88" y="38">{val}</text>
    `;
    FamilyTree.templates.montesTheme_male.field_4 = FamilyTree.templates.montesTheme.field_4;
    FamilyTree.templates.montesTheme_female.field_4 = FamilyTree.templates.montesTheme.field_4;

    // Fechas vitales y edad
    FamilyTree.templates.montesTheme.field_1 = `
      <text style="font-size: 12px; font-weight: 600; font-family: 'Outfit', -apple-system, sans-serif;" fill="#64748b" x="88" y="64">{val}</text>
    `;
    FamilyTree.templates.montesTheme_male.field_1 = FamilyTree.templates.montesTheme.field_1;
    FamilyTree.templates.montesTheme_female.field_1 = FamilyTree.templates.montesTheme.field_1;

    // Ubicación / Origen con chincheta roja (map-pin)
    FamilyTree.templates.montesTheme.field_2 = `
      <g>
        <svg x="88" y="76" width="13" height="13" viewBox="0 0 24 24" fill="#e11d48" stroke="#e11d48" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
        </svg>
        <text style="font-size: 11.5px; font-weight: 500; font-family: 'Outfit', -apple-system, sans-serif;" fill="#64748b" x="105" y="87">{val}</text>
      </g>
    `;
    FamilyTree.templates.montesTheme_male.field_2 = FamilyTree.templates.montesTheme.field_2;
    FamilyTree.templates.montesTheme_female.field_2 = FamilyTree.templates.montesTheme.field_2;

    // Mapeo de datos a formato FamilyTreeJS
    const formattedNodes = AppState.treeData.map(person => {
      const datesStr = (person.birth || person.death) 
        ? formatVitalDatesWithAge(person.birth, person.death) 
        : "";
      
      const locationStr = person.city || "";
      const nameParts = formatPersonNameLines(person.name);
      const isSingleLine = !nameParts.line2;

      return {
        id: person.id,
        mid: person.mid,
        fid: person.fid,
        pids: person.pids || [],
        gender: person.gender || "male",
        name_l1: isSingleLine ? "" : nameParts.line1,
        name_l2: isSingleLine ? "" : nameParts.line2,
        name_single: isSingleLine ? nameParts.line1 : "",
        name: person.name,
        title: datesStr,
        subtitle: locationStr,
        photo: getPersonPhotoUrl(person.photo, person.gender),
        raw: person
      };
    });

    try {
      AppState.treeInstance = new FamilyTree(container, {
        template: "montesTheme",
        mode: "light",
        enableSearch: false,
        mouseScrool: FamilyTree.action.zoom,
        nodeMouseClick: FamilyTree.action.none,
        siblingSeparation: 65,
        levelSeparation: 90,
        subtreeSeparation: 60,
        partnerSeparation: 35,
        scaleInitial: FamilyTree.match.boundary,
        nodeBinding: {
          field_0: "name_l1",
          field_3: "name_l2",
          field_4: "name_single",
          field_1: "title",
          field_2: "subtitle",
          img_0: "photo"
        },
        nodes: formattedNodes
      });

      // Guardar copia del estado válido
      AppState.lastValidTreeData = JSON.parse(JSON.stringify(AppState.treeData));

      // Evento al hacer clic en un nodo
      AppState.treeInstance.onNodeClick((args) => {
        const personId = parseInt(args.node.id, 10);
        const target = args.event && (args.event.target || args.event.srcElement);

        if (target) {
          const tagName = target.tagName ? target.tagName.toLowerCase() : "";
          const clipPath = target.getAttribute ? (target.getAttribute("clip-path") || "") : "";
          const cx = target.getAttribute ? target.getAttribute("cx") : "";

          if (tagName === "image" || (tagName === "circle" && cx === "48") || clipPath.includes("ulaImg")) {
            openPhotoLightboxById(personId);
            return false;
          }
        }

        openPersonDrawer(personId);
        return false;
      });

      setTimeout(() => {
        if (AppState.treeInstance) {
          AppState.treeInstance.fit();
        }
      }, 100);

    } catch (err) {
      console.error("Error al inicializar FamilyTree:", err);
      container.innerHTML = `
        <div class="tree-error-banner">
          <div class="tree-error-card">
            <div class="tree-error-icon">
              <i data-lucide="alert-triangle" style="width: 28px; height: 28px;"></i>
            </div>
            <h3>No se pudo organizar el mapa</h3>
            <p>El cambio de parentesco generó un conflicto en el árbol: <strong>${err.message}</strong></p>
            <div class="tree-error-actions">
              <button type="button" class="btn-primary" onclick="restoreLastValidTree()">
                <i data-lucide="rotate-ccw" style="width: 16px; height: 16px;"></i>
                <span>Restaurar versión anterior</span>
              </button>
            </div>
          </div>
        </div>
      `;
      refreshIcons();
    }
  }, 60);
}



function formatPersonNameLines(fullName) {
  if (!fullName) return { line1: "", line2: "" };
  const trimmed = fullName.trim();
  const words = trimmed.split(/\s+/);
  
  // Nombres de longitud estándar (hasta 25 caracteres) se mantienen en 1 sola línea
  if (trimmed.length <= 25) {
    return { line1: trimmed, line2: "" };
  }

  // Nombres realmente largos se dividen armónicamente en 2 líneas
  let line1 = "";
  let line2 = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (i === 0) {
      line1 = word;
    } else if ((line1 + " " + word).length <= 22 && line2 === "") {
      line1 += " " + word;
    } else {
      line2 += (line2 ? " " : "") + word;
    }
  }

  return { line1, line2 };
}

function getDefaultAvatar(gender) {
  if (gender === "female") {
    return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
  }
  return "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";
}

/**
 * Extrae el año numérico de 4 dígitos de un string de fecha (ej. "1960", "15/04/1989", etc.)
 */
function extractYear(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.toString().match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Calcula la edad actual para familiares vivos o la edad alcanzada al fallecer
 */
function calculateAge(birthStr, deathStr) {
  const birthYear = extractYear(birthStr);
  if (!birthYear) return null;

  const deathYear = extractYear(deathStr);
  const currentYear = new Date().getFullYear();

  if (deathYear) {
    const ageAtDeath = deathYear - birthYear;
    return ageAtDeath >= 0 ? `${ageAtDeath} años` : null;
  } else {
    const currentAge = currentYear - birthYear;
    return currentAge >= 0 ? `${currentAge} años` : null;
  }
}

/**
 * Formatea las fechas vitales agregando la edad con espacio antes del paréntesis.
 * Para personas vivas: muestra solo el año de nacimiento (ej. "1989   (37 años)").
 * Para personas fallecidas: muestra nacimiento y defunción (ej. "1932 — 2017   (85 años)").
 */
function formatVitalDatesWithAge(birth, death) {
  if (!birth && !death) return "";
  const age = calculateAge(birth, death);
  const ageSuffix = age ? ` (${age})` : "";

  // Si está vivo (sin fecha de defunción)
  if (!death) {
    const birthText = birth || "?";
    return `${birthText}${ageSuffix}`;
  }

  // Si está fallecido
  const birthText = birth || "?";
  const deathText = death;
  return `${birthText} — ${deathText}${ageSuffix}`;
}

// ==========================================================================
// 4. GESTIÓN DEL PANEL LATERAL (DRAWER) Y RELACIONES DIRECCIONALES
// ==========================================================================
function openPersonDrawer(personId) {
  const person = AppState.treeData.find(p => p.id === personId);
  if (!person) return;

  AppState.selectedPersonId = personId;

  document.getElementById("drawer-person-name").textContent = person.name;
  document.getElementById("drawer-person-img").src = getPersonPhotoUrl(person.photo, person.gender);

  const datesText = (person.birth || person.death) 
    ? formatVitalDatesWithAge(person.birth, person.death)
    : "Sin fechas registradas";
  document.getElementById("drawer-person-dates").querySelector("span").textContent = datesText;

  // Ubicación
  const rowCity = document.getElementById("row-drawer-city");
  if (person.city) {
    rowCity.style.display = "flex";
    document.getElementById("drawer-val-city").textContent = person.city;
  } else {
    rowCity.style.display = "none";
  }

  // Profesión
  const rowProf = document.getElementById("row-drawer-profession");
  if (person.profession) {
    rowProf.style.display = "flex";
    document.getElementById("drawer-val-profession").textContent = person.profession;
  } else {
    rowProf.style.display = "none";
  }

  // Notas
  const rowNotes = document.getElementById("row-drawer-notes");
  if (person.notes) {
    rowNotes.style.display = "flex";
    document.getElementById("drawer-val-notes").textContent = person.notes;
  } else {
    rowNotes.style.display = "none";
  }

  // Familiares directos vinculados
  const familyDesc = getFamilyRelationshipsSummary(person);
  document.getElementById("drawer-val-family").innerHTML = familyDesc;

  // Validación de Padres (Regla: Máximo 1 padre y 1 madre)
  const btnAddFather = document.getElementById("btn-dir-add-father");
  const btnAddMother = document.getElementById("btn-dir-add-mother");

  const hasFather = Boolean(person.fid);
  const hasMother = Boolean(person.mid);

  if (btnAddFather) {
    if (hasFather) {
      btnAddFather.disabled = true;
      const fatherObj = AppState.treeData.find(p => p.id === person.fid);
      btnAddFather.title = `Ya tiene padre asignado (${fatherObj ? fatherObj.name : 'Asignado'})`;
    } else {
      btnAddFather.disabled = false;
      btnAddFather.title = "Añadir Padre";
    }
  }

  if (btnAddMother) {
    if (hasMother) {
      btnAddMother.disabled = true;
      const motherObj = AppState.treeData.find(p => p.id === person.mid);
      btnAddMother.title = `Ya tiene madre asignada (${motherObj ? motherObj.name : 'Asignada'})`;
    } else {
      btnAddMother.disabled = false;
      btnAddMother.title = "Añadir Madre";
    }
  }

  // Validación de Pareja / Cónyuge (Regla: Máximo 1 cónyuge)
  const btnAddPartner = document.getElementById("btn-dir-add-partner");
  const hasPartner = person.pids && person.pids.length > 0;

  if (btnAddPartner) {
    if (hasPartner) {
      btnAddPartner.disabled = true;
      const partnerObj = AppState.treeData.find(p => p.id === person.pids[0]);
      btnAddPartner.title = `Ya tiene pareja asignada (${partnerObj ? partnerObj.name : 'Asignada'})`;
    } else {
      btnAddPartner.disabled = false;
      btnAddPartner.title = "Añadir Pareja o Cónyuge";
    }
  }

  // Mostrar panel
  document.getElementById("person-drawer").classList.add("active");
  refreshIcons();
}

function closePersonDrawer() {
  document.getElementById("person-drawer").classList.remove("active");
}

function getFamilyRelationshipsSummary(person) {
  const categories = [];

  // 1. Categoría: Padres (Padre en una fila y Madre en otra fila)
  const parentRows = [];
  if (person.fid) {
    const f = AppState.treeData.find(p => p.id === person.fid);
    if (f) parentRows.push(`<div class="drawer-rel-row"><strong>Padre:</strong> <span>${f.name}</span></div>`);
  }
  if (person.mid) {
    const m = AppState.treeData.find(p => p.id === person.mid);
    if (m) parentRows.push(`<div class="drawer-rel-row"><strong>Madre:</strong> <span>${m.name}</span></div>`);
  }
  if (parentRows.length > 0) {
    categories.push(`
      <div class="drawer-rel-category">
        ${parentRows.join("")}
      </div>
    `);
  }

  // 2. Categoría: Cónyuge
  if (person.pids && person.pids.length > 0) {
    const partnerObj = AppState.treeData.find(p => p.id === person.pids[0]);
    if (partnerObj) {
      categories.push(`
        <div class="drawer-rel-category">
          <div class="drawer-rel-row"><strong>Cónyuge:</strong> <span>${partnerObj.name}</span></div>
        </div>
      `);
    }
  }

  // 3. Categoría: Hermanos (lista en filas separadas)
  const siblings = AppState.treeData
    .filter(p => p.id !== person.id && ((person.fid && p.fid === person.fid) || (person.mid && p.mid === person.mid)))
    .map(p => p.name);
  if (siblings.length > 0) {
    categories.push(`
      <div class="drawer-rel-category">
        <div class="drawer-rel-row"><strong>Hermanos (${siblings.length}):</strong></div>
        <ul class="drawer-rel-list">
          ${siblings.map(name => `<li>${name}</li>`).join("")}
        </ul>
      </div>
    `);
  }

  // 4. Categoría: Hijos (lista en filas separadas)
  const children = AppState.treeData
    .filter(p => p.fid === person.id || p.mid === person.id)
    .map(p => p.name);
  if (children.length > 0) {
    categories.push(`
      <div class="drawer-rel-category">
        <div class="drawer-rel-row"><strong>Hijos (${children.length}):</strong></div>
        <ul class="drawer-rel-list">
          ${children.map(name => `<li>${name}</li>`).join("")}
        </ul>
      </div>
    `);
  }

  if (categories.length === 0) {
    return "<em>Sin vínculos directos registrados</em>";
  }

  return `<div class="drawer-rel-container">${categories.join("")}</div>`;
}

function setupDrawerEvents() {
  document.getElementById("drawer-close-btn").addEventListener("click", closePersonDrawer);

  // Botón Editar Ficha desde el Drawer
  document.getElementById("drawer-btn-edit").addEventListener("click", () => {
    if (!AppState.selectedPersonId) return;
    openEditPersonModal(AppState.selectedPersonId);
  });

  // Botón Enfocar / Centrar en persona
  document.getElementById("drawer-btn-center").addEventListener("click", () => {
    if (!AppState.selectedPersonId || !AppState.treeInstance) return;
    AppState.treeInstance.center(AppState.selectedPersonId);
  });

  // Botón Eliminar Persona
  document.getElementById("drawer-btn-delete").addEventListener("click", () => {
    if (!AppState.selectedPersonId) return;
    openDeleteConfirmModal(AppState.selectedPersonId);
  });

  // Clic en la foto de perfil del Drawer para verla ampliada
  const drawerAvatar = document.getElementById("drawer-person-img");
  if (drawerAvatar) {
    drawerAvatar.addEventListener("click", () => {
      if (AppState.selectedPersonId) {
        openPhotoLightboxById(AppState.selectedPersonId);
      }
    });
  }

  // EVENTOS DIRECCIONALES (+ EN TODAS LAS DIRECCIONES)
  // 1. Arriba: Padre
  document.getElementById("btn-dir-add-father").addEventListener("click", () => {
    if (!AppState.selectedPersonId) return;
    openAddDirectionalRelativeModal(AppState.selectedPersonId, "parent_father");
  });

  // 2. Arriba: Madre
  document.getElementById("btn-dir-add-mother").addEventListener("click", () => {
    if (!AppState.selectedPersonId) return;
    openAddDirectionalRelativeModal(AppState.selectedPersonId, "parent_mother");
  });

  // 3. Mismo Nivel: Pareja / Cónyuge
  document.getElementById("btn-dir-add-partner").addEventListener("click", () => {
    if (!AppState.selectedPersonId) return;
    openAddDirectionalRelativeModal(AppState.selectedPersonId, "partner");
  });

  // 4. Mismo Nivel: Hermano / Hermana
  document.getElementById("btn-dir-add-sibling").addEventListener("click", () => {
    if (!AppState.selectedPersonId) return;
    openAddDirectionalRelativeModal(AppState.selectedPersonId, "sibling");
  });

  // 5. Abajo: Hijo / Hija
  document.getElementById("btn-dir-add-child").addEventListener("click", () => {
    if (!AppState.selectedPersonId) return;
    openAddDirectionalRelativeModal(AppState.selectedPersonId, "child");
  });
}

// ==========================================================================
// 4.1. VISUALIZADOR DE FOTOGRAFÍAS EN ALTA DEFINICIÓN (LIGHTBOX)
// ==========================================================================
function openPhotoLightboxById(personId) {
  const person = AppState.treeData.find(p => p.id === personId);
  if (!person) return;

  const photoUrl = getPersonPhotoUrl(person.photo, person.gender);
  const datesText = (person.birth || person.death) 
    ? formatVitalDatesWithAge(person.birth, person.death) 
    : (person.city || "Familia Montes");

  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxName = document.getElementById("lightbox-person-name");
  const lightboxDates = document.getElementById("lightbox-person-dates");

  if (lightboxImg) lightboxImg.src = photoUrl;
  if (lightboxName) lightboxName.textContent = person.name;
  if (lightboxDates) lightboxDates.textContent = datesText;

  openModal("modal-photo-lightbox");
}

// ==========================================================================
// 5. MOTOR DE PARENTESCO DIRECTO Y CRUD DE FAMILIARES
// ==========================================================================

/**
 * Calcula el conjunto de todos los familiares de sangre directos (ancestros,
 * descendientes, hermanos, tíos y sobrinos) para evitar emparejamientos biológicos directos.
 */
function getDirectBloodRelatives(personId, overrideFid = null, overrideMid = null) {
  const relatives = new Set();
  if (!personId) return relatives;
  relatives.add(personId);

  const person = AppState.treeData.find(p => p.id === personId);
  const fid = (overrideFid !== undefined && overrideFid !== null) ? overrideFid : (person ? person.fid : null);
  const mid = (overrideMid !== undefined && overrideMid !== null) ? overrideMid : (person ? person.mid : null);

  // 1. Ancestros en todos los niveles (Padres, Abuelos, Bisabuelos, etc.)
  function collectAncestors(currentFid, currentMid) {
    const parentIds = [currentFid, currentMid].filter(Boolean);
    for (const pId of parentIds) {
      if (!relatives.has(pId)) {
        relatives.add(pId);
        const parent = AppState.treeData.find(p => p.id === pId);
        if (parent) {
          collectAncestors(parent.fid, parent.mid);
        }
      }
    }
  }
  collectAncestors(fid, mid);

  // 2. Descendientes en todos los niveles (Hijos, Nietos, Bisnietos, etc.)
  function collectDescendants(ancestorId) {
    AppState.treeData.forEach(p => {
      if (p.fid === ancestorId || p.mid === ancestorId) {
        if (!relatives.has(p.id)) {
          relatives.add(p.id);
          collectDescendants(p.id);
        }
      }
    });
  }
  collectDescendants(personId);

  // 3. Hermanos/as y toda su descendencia (Sobrinos, Sobrinos-nietos)
  const siblingIds = new Set();
  if (fid || mid) {
    AppState.treeData.forEach(p => {
      if (p.id !== personId) {
        if ((fid && p.fid === fid) || (mid && p.mid === mid)) {
          siblingIds.add(p.id);
          relatives.add(p.id);
        }
      }
    });
  }
  siblingIds.forEach(sibId => {
    collectDescendants(sibId);
  });

  // 4. Tíos/as directos (Hermanos de los padres)
  const parents = [fid, mid].filter(Boolean);
  parents.forEach(pId => {
    const parent = AppState.treeData.find(p => p.id === pId);
    if (parent && (parent.fid || parent.mid)) {
      AppState.treeData.forEach(p => {
        if (p.id !== pId) {
          if ((parent.fid && p.fid === parent.fid) || (parent.mid && p.mid === parent.mid)) {
            relatives.add(p.id);
          }
        }
      });
    }
  });

  return relatives;
}

function populateParentAndPartnerSelectors(excludePersonId = null, preselected = {}) {
  const fatherSelect = document.getElementById("form-select-father");
  const motherSelect = document.getElementById("form-select-mother");
  const partnerSelect = document.getElementById("form-select-partner");

  if (!fatherSelect || !motherSelect || !partnerSelect) return;

  const currentPerson = excludePersonId ? AppState.treeData.find(p => p.id === excludePersonId) : null;
  const initialFid = preselected.fid !== undefined ? preselected.fid : (currentPerson ? currentPerson.fid : null);
  const initialMid = preselected.mid !== undefined ? preselected.mid : (currentPerson ? currentPerson.mid : null);
  const initialPid = preselected.pid !== undefined ? preselected.pid : ((currentPerson && currentPerson.pids && currentPerson.pids.length > 0) ? currentPerson.pids[0] : null);

  // Refrescar candidatos a cónyuge excluyendo a toda la familia directa (ancestros, descendientes, hermanos, tíos, sobrinos)
  const refreshPartnerOptions = () => {
    const selectedFid = fatherSelect.value ? parseInt(fatherSelect.value, 10) : null;
    const selectedMid = motherSelect.value ? parseInt(motherSelect.value, 10) : null;
    const currentSelectedPid = partnerSelect.value ? parseInt(partnerSelect.value, 10) : (initialPid ? parseInt(initialPid, 10) : null);

    // Obtener todos los familiares de sangre prohibidos
    const forbiddenPartnerIds = excludePersonId 
      ? getDirectBloodRelatives(excludePersonId, selectedFid, selectedMid)
      : new Set();

    if (excludePersonId) forbiddenPartnerIds.add(excludePersonId);
    if (selectedFid) forbiddenPartnerIds.add(selectedFid);
    if (selectedMid) forbiddenPartnerIds.add(selectedMid);

    // Filtrar candidatos a pareja
    const partnerCandidates = AppState.treeData.filter(p => {
      if (forbiddenPartnerIds.has(p.id)) return false;
      // Excluir personas que ya están casadas con un tercero
      if (p.pids && p.pids.length > 0 && !p.pids.includes(excludePersonId)) {
        return false;
      }
      return true;
    });

    partnerSelect.innerHTML = '<option value="">-- Sin pareja / cónyuge --</option>' + 
      partnerCandidates.map(p => `<option value="${p.id}">${p.name} ${p.birth ? `(${p.birth})` : ''}</option>`).join("");
    
    if (currentSelectedPid && !forbiddenPartnerIds.has(currentSelectedPid)) {
      partnerSelect.value = currentSelectedPid.toString();
    } else {
      partnerSelect.value = "";
    }
  };

  // Conjunto de IDs prohibidos para ser Padres (uno mismo y todos sus descendientes: hijos, nietos, bisnietos)
  const forbiddenParentIds = new Set();
  if (excludePersonId) {
    forbiddenParentIds.add(excludePersonId);
    
    function addAllDescendants(ancestorId) {
      AppState.treeData.forEach(p => {
        if (p.fid === ancestorId || p.mid === ancestorId) {
          if (!forbiddenParentIds.has(p.id)) {
            forbiddenParentIds.add(p.id);
            addAllDescendants(p.id);
          }
        }
      });
    }
    addAllDescendants(excludePersonId);
  }

  // 1. Padres posibles (varones no prohibidos)
  const maleCandidates = AppState.treeData.filter(p => !forbiddenParentIds.has(p.id) && p.gender !== "female");
  fatherSelect.innerHTML = '<option value="">-- Sin padre asignado --</option>' + 
    maleCandidates.map(p => `<option value="${p.id}">${p.name} ${p.birth ? `(${p.birth})` : ''}</option>`).join("");
  fatherSelect.value = initialFid ? initialFid.toString() : "";

  // 2. Madres posibles (mujeres no prohibidas)
  const femaleCandidates = AppState.treeData.filter(p => !forbiddenParentIds.has(p.id) && p.gender === "female");
  motherSelect.innerHTML = '<option value="">-- Sin madre asignada --</option>' + 
    femaleCandidates.map(p => `<option value="${p.id}">${p.name} ${p.birth ? `(${p.birth})` : ''}</option>`).join("");
  motherSelect.value = initialMid ? initialMid.toString() : "";

  // 3. Poblar cónyuges con las restricciones de parentesco
  refreshPartnerOptions();

  // Escuchar cambios dinámicos en los selectores de padre y madre
  fatherSelect.onchange = refreshPartnerOptions;
  motherSelect.onchange = refreshPartnerOptions;
}

function openAddDirectionalRelativeModal(targetPersonId, directionalType) {
  const targetPerson = AppState.treeData.find(p => p.id === targetPersonId);
  if (!targetPerson) return;

  const form = document.getElementById("form-person");
  form.reset();

  document.getElementById("form-person-id").value = "";
  document.getElementById("form-relative-target-id").value = targetPersonId;
  document.getElementById("group-relationship-type").style.display = "none";
  document.getElementById("group-form-links").style.display = "none";
  
  const titleEl = document.getElementById("modal-person-title").querySelector("span");
  const genderSelect = document.getElementById("form-gender");

  // Configurar tipo según dirección seleccionada
  let relTypeValue = "child";

  if (directionalType === "parent_father") {
    relTypeValue = "parent_father";
    genderSelect.value = "male";
    genderSelect.disabled = true;
    titleEl.textContent = `Añadir Padre de ${targetPerson.name.split(" ")[0]}`;
  } else if (directionalType === "parent_mother") {
    relTypeValue = "parent_mother";
    genderSelect.value = "female";
    genderSelect.disabled = true;
    titleEl.textContent = `Añadir Madre de ${targetPerson.name.split(" ")[0]}`;
  } else if (directionalType === "partner") {
    relTypeValue = "partner";
    genderSelect.value = targetPerson.gender === "male" ? "female" : "male";
    genderSelect.disabled = false;
    titleEl.textContent = `Añadir Pareja de ${targetPerson.name.split(" ")[0]}`;
  } else if (directionalType === "sibling") {
    relTypeValue = "sibling";
    genderSelect.value = "male";
    genderSelect.disabled = false;
    titleEl.textContent = `Añadir Hermano/a de ${targetPerson.name.split(" ")[0]}`;
  } else if (directionalType === "child") {
    relTypeValue = "child";
    genderSelect.value = "male";
    genderSelect.disabled = false;
    titleEl.textContent = `Añadir Hijo/a de ${targetPerson.name.split(" ")[0]}`;
  }

  document.getElementById("form-rel-type").value = relTypeValue;
  document.getElementById("form-photo").value = "";
  document.getElementById("form-photo-file").value = "";
  document.getElementById("form-photo-preview").src = getDefaultAvatar(genderSelect.value);
  document.getElementById("btn-remove-photo").style.display = "none";

  openModal("modal-person");
}

function openAddRootPersonModal() {
  const form = document.getElementById("form-person");
  form.reset();

  document.getElementById("form-person-id").value = "";
  document.getElementById("form-relative-target-id").value = "";
  document.getElementById("group-relationship-type").style.display = "none";
  document.getElementById("group-form-links").style.display = "block";
  document.getElementById("form-gender").disabled = false;
  document.getElementById("modal-person-title").querySelector("span").textContent = "Añadir Nueva Persona al Árbol";
  
  document.getElementById("form-photo").value = "";
  document.getElementById("form-photo-file").value = "";
  document.getElementById("form-photo-preview").src = getDefaultAvatar("male");
  document.getElementById("btn-remove-photo").style.display = "none";

  // Poblar selectores de padre, madre y cónyuge
  populateParentAndPartnerSelectors(null, {});

  openModal("modal-person");
}

function openEditPersonModal(personId) {
  const person = AppState.treeData.find(p => p.id === personId);
  if (!person) return;

  document.getElementById("form-person-id").value = person.id;
  document.getElementById("form-relative-target-id").value = "";
  document.getElementById("group-relationship-type").style.display = "none";
  document.getElementById("group-form-links").style.display = "block";
  document.getElementById("form-gender").disabled = false;
  
  document.getElementById("modal-person-title").querySelector("span").textContent = `Editar: ${person.name}`;
  
  document.getElementById("form-name").value = person.name || "";
  document.getElementById("form-gender").value = person.gender || "male";
  document.getElementById("form-city").value = person.city || "";
  document.getElementById("form-birth").value = person.birth || "";
  document.getElementById("form-death").value = person.death || "";
  document.getElementById("form-profession").value = person.profession || "";
  document.getElementById("form-photo").value = person.photo || "";
  document.getElementById("form-photo-file").value = "";
  document.getElementById("form-notes").value = person.notes || "";
  
  const hasPhoto = Boolean(person.photo);
  document.getElementById("form-photo-preview").src = person.photo || getDefaultAvatar(person.gender);
  document.getElementById("btn-remove-photo").style.display = hasPhoto ? "inline-flex" : "none";

  // Poblar selectores con los datos actuales
  populateParentAndPartnerSelectors(personId, {
    fid: person.fid,
    mid: person.mid,
    pid: (person.pids && person.pids.length > 0) ? person.pids[0] : ""
  });

  openModal("modal-person");
}

function openDeleteConfirmModal(personId) {
  const person = AppState.treeData.find(p => p.id === personId);
  if (!person) return;

  document.getElementById("delete-target-name").textContent = person.name;
  openModal("modal-delete-confirm");
}

function savePersonFromForm() {
  const idInput = document.getElementById("form-person-id").value;
  const relTargetIdInput = document.getElementById("form-relative-target-id").value;
  const relType = document.getElementById("form-rel-type").value;

  const name = document.getElementById("form-name").value.trim();
  const gender = document.getElementById("form-gender").value;
  const city = document.getElementById("form-city").value.trim();
  const birth = document.getElementById("form-birth").value.trim();
  const death = document.getElementById("form-death").value.trim();
  const profession = document.getElementById("form-profession").value.trim();
  const photo = document.getElementById("form-photo").value.trim();
  const notes = document.getElementById("form-notes").value.trim();

  // Vínculos seleccionados manualmente
  const fatherSelectVal = document.getElementById("form-select-father").value;
  const motherSelectVal = document.getElementById("form-select-mother").value;
  const partnerSelectVal = document.getElementById("form-select-partner").value;

  const manualFid = fatherSelectVal ? parseInt(fatherSelectVal, 10) : null;
  const manualMid = motherSelectVal ? parseInt(motherSelectVal, 10) : null;
  const manualPid = partnerSelectVal ? parseInt(partnerSelectVal, 10) : null;

  if (!name) {
    showToast("Por favor, introduce el nombre completo.", "error");
    return;
  }

  // Manejo de fotografías nombradas en la carpeta photos/
  let finalPhoto = photo;

  if (photo && photo.startsWith("data:image")) {
    const photoPath = `photos/${slugifyPersonName(name)}.jpg`;
    AppState.photosCache[photoPath] = photo;
    finalPhoto = photoPath;

    // Si se está editando y tenía una foto previa diferente en photos/, marcar la antigua para eliminar
    if (idInput) {
      const personId = parseInt(idInput, 10);
      const oldPerson = AppState.treeData.find(p => p.id === personId);
      if (oldPerson && oldPerson.photo && oldPerson.photo.startsWith("photos/") && oldPerson.photo !== photoPath) {
        AppState.deletedPhotos.add(oldPerson.photo);
        delete AppState.photosCache[oldPerson.photo];
      }
    }
  } else if (!photo && idInput) {
    // Si se eliminó la foto existente
    const personId = parseInt(idInput, 10);
    const oldPerson = AppState.treeData.find(p => p.id === personId);
    if (oldPerson && oldPerson.photo && oldPerson.photo.startsWith("photos/")) {
      AppState.deletedPhotos.add(oldPerson.photo);
      delete AppState.photosCache[oldPerson.photo];
    }
    finalPhoto = "";
  }

  // CASO A: EDITAR PERSONA EXISTENTE
  if (idInput) {
    const personId = parseInt(idInput, 10);
    const index = AppState.treeData.findIndex(p => p.id === personId);
    if (index !== -1) {
      const oldPerson = AppState.treeData[index];
      const oldPid = (oldPerson.pids && oldPerson.pids.length > 0) ? oldPerson.pids[0] : null;

      // Desvincular antigua pareja si ha cambiado
      if (oldPid && oldPid !== manualPid) {
        const formerPartner = AppState.treeData.find(p => p.id === oldPid);
        if (formerPartner && formerPartner.pids) {
          formerPartner.pids = formerPartner.pids.filter(id => id !== personId);
        }
      }

      // Vincular nueva pareja si se seleccionó
      const newPids = manualPid ? [manualPid] : [];
      if (manualPid) {
        const newPartner = AppState.treeData.find(p => p.id === manualPid);
        if (newPartner) {
          if (!newPartner.pids) newPartner.pids = [];
          // Desvincular a terceros si la nueva pareja tenía otra anterior
          newPartner.pids.forEach(otherPid => {
            if (otherPid !== personId) {
              const otherP = AppState.treeData.find(p => p.id === otherPid);
              if (otherP && otherP.pids) {
                otherP.pids = otherP.pids.filter(id => id !== manualPid);
              }
            }
          });
          newPartner.pids = [personId];
        }
      }

      AppState.treeData[index] = {
        ...oldPerson,
        name,
        gender,
        city,
        birth,
        death,
        profession,
        photo: finalPhoto,
        notes,
        fid: manualFid || undefined,
        mid: manualMid || undefined,
        pids: newPids
      };

      if (!manualFid) delete AppState.treeData[index].fid;
      if (!manualMid) delete AppState.treeData[index].mid;

      showToast(`Datos de ${name} actualizados`, "success");
    }
  } 
  // CASO B: AÑADIR NUEVA PERSONA
  else {
    const newId = generateNextId();
    const newPerson = {
      id: newId,
      name,
      gender,
      city,
      birth,
      death,
      profession,
      photo: finalPhoto,
      notes,
      pids: []
    };

    // 1. Si se crearon vínculos mediante los selectores manuales
    if (manualFid) newPerson.fid = manualFid;
    if (manualMid) newPerson.mid = manualMid;
    if (manualPid) {
      newPerson.pids = [manualPid];
      const partnerObj = AppState.treeData.find(p => p.id === manualPid);
      if (partnerObj) {
        if (!partnerObj.pids) partnerObj.pids = [];
        if (!partnerObj.pids.includes(newId)) partnerObj.pids.push(newId);
      }
    }

    // 2. Si se añade mediante el flujo direccional desde el panel lateral
    if (relTargetIdInput) {
      const targetId = parseInt(relTargetIdInput, 10);
      const targetPerson = AppState.treeData.find(p => p.id === targetId);

      if (targetPerson) {
        if (relType === "parent_father") {
          targetPerson.fid = newId;
          if (targetPerson.mid) {
            newPerson.pids = [targetPerson.mid];
            const mother = AppState.treeData.find(p => p.id === targetPerson.mid);
            if (mother) {
              if (!mother.pids) mother.pids = [];
              if (!mother.pids.includes(newId)) mother.pids.push(newId);
            }
          }
        } else if (relType === "parent_mother") {
          targetPerson.mid = newId;
          if (targetPerson.fid) {
            newPerson.pids = [targetPerson.fid];
            const father = AppState.treeData.find(p => p.id === targetPerson.fid);
            if (father) {
              if (!father.pids) father.pids = [];
              if (!father.pids.includes(newId)) father.pids.push(newId);
            }
          }
        } else if (relType === "partner") {
          newPerson.pids = [targetPerson.id];
          if (!targetPerson.pids) targetPerson.pids = [];
          if (!targetPerson.pids.includes(newId)) {
            targetPerson.pids.push(newId);
          }
        } else if (relType === "sibling") {
          if (targetPerson.fid) newPerson.fid = targetPerson.fid;
          if (targetPerson.mid) newPerson.mid = targetPerson.mid;
        } else if (relType === "child") {
          if (targetPerson.gender === "female") {
            newPerson.mid = targetPerson.id;
            if (targetPerson.pids && targetPerson.pids.length > 0) {
              newPerson.fid = targetPerson.pids[0];
            }
          } else {
            newPerson.fid = targetPerson.id;
            if (targetPerson.pids && targetPerson.pids.length > 0) {
              newPerson.mid = targetPerson.pids[0];
            }
          }
        }
      }
    }

    AppState.treeData.push(newPerson);
    showToast(`Se ha añadido a ${name} al árbol genealógico`, "success");
  }

  // Normalizar y sanear datos
  cleanAndValidateTreeData(AppState.treeData);
  setUnsavedChanges(true);

  // Guardar en caché local y refrescar árbol
  persistLocalTree();
  closeAllModals();
  initTreeVisualization();
  updateHeaderSummary();

  if (AppState.selectedPersonId) {
    openPersonDrawer(AppState.selectedPersonId);
  }
}

function deleteSelectedPerson() {
  if (!AppState.selectedPersonId) return;
  const personId = AppState.selectedPersonId;
  const person = AppState.treeData.find(p => p.id === personId);
  const name = person ? person.name : "la persona";

  // Si la persona tenía una foto en photos/, marcarla para eliminar en GitHub
  if (person && person.photo && person.photo.startsWith("photos/")) {
    AppState.deletedPhotos.add(person.photo);
    delete AppState.photosCache[person.photo];
  }

  // Eliminar persona del array
  AppState.treeData = AppState.treeData.filter(p => p.id !== personId);

  // Limpiar referencias en los demás nodos (pids, fid, mid)
  AppState.treeData.forEach(p => {
    if (p.pids && Array.isArray(p.pids)) {
      p.pids = p.pids.filter(pid => pid !== personId);
    }
    if (p.fid === personId) delete p.fid;
    if (p.mid === personId) delete p.mid;
  });

  persistLocalTree();
  closeAllModals();
  closePersonDrawer();
  AppState.selectedPersonId = null;
  initTreeVisualization();
  updateHeaderSummary();
  showToast(`${name} ha sido eliminado del árbol`, "info");
}

function generateNextId() {
  if (AppState.treeData.length === 0) return 1;
  const maxId = AppState.treeData.reduce((max, p) => (typeof p.id === 'number' && p.id > max ? p.id : max), 0);
  return maxId + 1;
}

function persistLocalTree() {
  localStorage.setItem("montes_tree_cache", JSON.stringify(AppState.treeData));
  localStorage.setItem("montes_photos_cache", JSON.stringify(AppState.photosCache || {}));
  localStorage.setItem("montes_photos_deletions", JSON.stringify(Array.from(AppState.deletedPhotos || [])));
}

// ==========================================================================
// 6. EXPORTACIÓN A PDF HORIZONTAL DE ALTA RESOLUCIÓN
// ==========================================================================
function exportTreeLandscapePDF() {
  showToast("Generando mapa completo en PDF horizontal...", "info", 5000);

  // 1. Intentar con exportación nativa de FamilyTree si está disponible
  if (AppState.treeInstance && typeof AppState.treeInstance.exportPDF === "function") {
    try {
      AppState.treeInstance.exportPDF({
        filename: "arbol_genealogico_familia_montes.pdf",
        landscape: true,
        fit: "all",
        expandChildren: true,
        margin: [15, 15, 15, 15]
      });
      showToast("¡PDF del árbol genealógico descargado con éxito!", "success");
      return;
    } catch (err) {
      console.warn("Fallo exportPDF nativo, usando renderizador jsPDF:", err);
    }
  }

  // 2. Fallback de alta resolución con jsPDF y Canvas SVG
  try {
    const svgEl = document.querySelector("#tree-canvas svg");
    if (!svgEl) {
      showToast("No se encontró el árbol en pantalla para exportar.", "error");
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const DOMURL = window.URL || window.webkitURL || window;
    const url = DOMURL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Escala 2.5x para máxima nitidez en zoom de móviles
      const scale = 2.5;
      const canvas = document.createElement("canvas");
      canvas.width = (img.width || 2400) * scale;
      canvas.height = (img.height || 1400) * scale;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f6f3ee";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      DOMURL.revokeObjectURL(url);

      if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        // Crear documento PDF horizontal
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [canvas.width / scale, canvas.height / scale]
        });

        pdf.addImage(imgData, "JPEG", 0, 0, canvas.width / scale, canvas.height / scale);
        pdf.save(`arbol_genealogico_familia_montes_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast("¡PDF horizontal generado con alta resolución!", "success");
      }
    };
    img.src = url;
  } catch (error) {
    console.error("Error al exportar PDF:", error);
    showToast("Error al generar el PDF: " + error.message, "error");
  }
}

// ==========================================================================
// 7. BUSCADOR Y HERRAMIENTAS DE NAVEGACIÓN
// ==========================================================================
function setupSearchEvents() {
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      searchResults.style.display = "none";
      searchResults.innerHTML = "";
      return;
    }

    const matches = AppState.treeData.filter(p => 
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.city && p.city.toLowerCase().includes(query)) ||
      (p.profession && p.profession.toLowerCase().includes(query))
    );

    if (matches.length === 0) {
      searchResults.innerHTML = `<div style="padding: 0.8rem; font-size: 0.82rem; color: var(--color-text-muted); text-align: center;">No se encontraron familiares</div>`;
      searchResults.style.display = "block";
      return;
    }

    searchResults.innerHTML = matches.map(p => `
      <div class="search-item" data-id="${p.id}">
        <img class="search-item-avatar" src="${p.photo || getDefaultAvatar(p.gender)}" alt="${p.name}">
        <div class="search-item-info">
          <div class="search-item-name">${p.name}</div>
          <div class="search-item-meta">${p.city || ''} ${p.birth ? '· ' + formatVitalDatesWithAge(p.birth, p.death) : ''}</div>
        </div>
      </div>
    `).join("");

    searchResults.style.display = "block";

    // Clic en resultado de búsqueda
    searchResults.querySelectorAll(".search-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = parseInt(item.dataset.id, 10);
        searchInput.value = "";
        searchResults.style.display = "none";
        
        if (AppState.treeInstance) {
          AppState.treeInstance.center(id);
        }
        openPersonDrawer(id);
      });
    });
  });

  // Cerrar buscador al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) {
      searchResults.style.display = "none";
    }
  });
}

function setupToolbarEvents() {
  // Nueva Persona Raíz
  document.getElementById("btn-add-root-person").addEventListener("click", openAddRootPersonModal);

  // Exportar PDF Horizontal
  const btnExportPdf = document.getElementById("btn-export-pdf");
  if (btnExportPdf) {
    btnExportPdf.addEventListener("click", exportTreeLandscapePDF);
  }

  // Controles flotantes de Zoom
  document.getElementById("ctrl-zoom-in").addEventListener("click", () => {
    if (AppState.treeInstance) AppState.treeInstance.zoom(true);
  });
  document.getElementById("ctrl-zoom-out").addEventListener("click", () => {
    if (AppState.treeInstance) AppState.treeInstance.zoom(false);
  });
  document.getElementById("ctrl-center").addEventListener("click", () => {
    if (AppState.treeInstance) AppState.treeInstance.fit();
  });
}

function setupModalEvents() {
  // Cerrar modales con botones de clase modal-close-trigger (botones Cancelar y X)
  document.querySelectorAll(".modal-close-trigger").forEach(btn => {
    btn.addEventListener("click", closeAllModals);
  });

  // Cerrar al hacer clic deliberado en el fondo oscuro (mousedown y mouseup en el backdrop)
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    let startedOnBackdrop = false;

    backdrop.addEventListener("mousedown", (e) => {
      startedOnBackdrop = (e.target === backdrop);
    });

    backdrop.addEventListener("mouseup", (e) => {
      // Para el formulario de edición, no cerrar por clic accidental fuera para no perder datos
      if (backdrop.id === "modal-person") return;

      if (startedOnBackdrop && e.target === backdrop) {
        closeAllModals();
      }
      startedOnBackdrop = false;
    });
  });

  // Evitar que el envío estándar del formulario recargue o cierre el modal
  const personForm = document.getElementById("form-person");
  if (personForm) {
    personForm.addEventListener("submit", (e) => {
      e.preventDefault();
      savePersonFromForm();
    });
  }

  // Guardar persona desde el botón principal
  document.getElementById("btn-save-person").addEventListener("click", savePersonFromForm);

  // Confirmar eliminación
  document.getElementById("btn-confirm-delete").addEventListener("click", deleteSelectedPerson);

  // Autocompletado inteligente de Municipios y Provincias
  setupCityAutocomplete();

  // Autocompletado inteligente de Profesiones y Oficios
  setupProfessionAutocomplete();

  // Gestión y subida de fotografías
  setupPhotoUploadHandling();

  // Cerrar con tecla Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Si hay un desplegable de autocompletado abierto, solo cerrarlo a él
      const cityDropdown = document.getElementById("city-autocomplete-dropdown");
      const profDropdown = document.getElementById("profession-autocomplete-dropdown");
      if ((cityDropdown && cityDropdown.style.display !== "none") || 
          (profDropdown && profDropdown.style.display !== "none")) {
        if (cityDropdown) cityDropdown.style.display = "none";
        if (profDropdown) profDropdown.style.display = "none";
        return;
      }
      closeAllModals();
    }
  });
}

// ==========================================================================
// 7. SUBIDA Y COMPRESIÓN DE FOTOGRAFÍAS
// ==========================================================================
function setupPhotoUploadHandling() {
  const triggerBtn = document.getElementById("btn-trigger-upload");
  const fileInput = document.getElementById("form-photo-file");
  const removeBtn = document.getElementById("btn-remove-photo");
  const photoInput = document.getElementById("form-photo");
  const photoPreview = document.getElementById("form-photo-preview");
  const genderSelect = document.getElementById("form-gender");

  if (!triggerBtn || !fileInput) return;

  // Clic en botón "Subir Foto" abre el selector del sistema
  triggerBtn.addEventListener("click", () => {
    fileInput.click();
  });

  // Al seleccionar archivo de imagen desde móvil o PC
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Por favor selecciona un archivo de imagen (JPG, PNG o WebP).", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const rawDataUrl = loadEvent.target.result;
      const img = new Image();
      img.onload = () => {
        // Redimensionar a max 320x320 manteniendo proporción para rendimiento óptimo
        const maxDim = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const optimizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        photoInput.value = optimizedDataUrl;
        photoPreview.src = optimizedDataUrl;
        if (removeBtn) removeBtn.style.display = "inline-flex";
        showToast("Fotografía optimizada y lista para guardar", "success");
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });

  // Botón "Quitar Foto"
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      photoInput.value = "";
      fileInput.value = "";
      photoPreview.src = getDefaultAvatar(genderSelect.value);
      removeBtn.style.display = "none";
      showToast("Foto eliminada. Se usará el avatar predeterminado.", "info");
    });
  }

  // Cambiar avatar por defecto si cambia de género y no hay foto personalizada
  genderSelect.addEventListener("change", () => {
    if (!photoInput.value) {
      photoPreview.src = getDefaultAvatar(genderSelect.value);
    }
  });
}

// ==========================================================================
// 8. AUTOCOMPLETADO DE MUNICIPIOS Y PROVINCIAS (BASE DE DATOS COMPLETA DE ESPAÑA)
// ==========================================================================
let allSpanishMunicipalities = [];
let isMunicipalitiesLoaded = false;
let cityDebounceTimer = null;

async function loadSpanishMunicipalitiesDataset() {
  if (isMunicipalitiesLoaded) return;
  try {
    const res = await fetch("data/municipios.json");
    if (res.ok) {
      const data = await res.json();
      allSpanishMunicipalities = data.map(item => ({
        city: item.c,
        province: item.p,
        normCity: item.c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        normProv: item.p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      }));
      isMunicipalitiesLoaded = true;
    }
  } catch (err) {
    console.warn("No se pudo cargar data/municipios.json localmente:", err);
  }
}

function setupCityAutocomplete() {
  const cityInput = document.getElementById("form-city");
  const dropdown = document.getElementById("city-autocomplete-dropdown");
  if (!cityInput || !dropdown) return;

  // Cargar dataset completo en segundo plano
  loadSpanishMunicipalitiesDataset();

  // Activar navegación con flechas de teclado y Enter
  setupAutocompleteKeyboardNavigation(cityInput, dropdown);

  cityInput.addEventListener("input", () => {
    clearTimeout(cityDebounceTimer);
    const query = cityInput.value.trim();

    if (query.length < 2) {
      dropdown.style.display = "none";
      dropdown.innerHTML = "";
      return;
    }

    // Búsqueda instantánea con 100ms de debounce
    cityDebounceTimer = setTimeout(async () => {
      const results = await searchMunicipalities(query);
      renderCityAutocomplete(results, cityInput, dropdown);
    }, 100);
  });

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-group")) {
      dropdown.style.display = "none";
    }
  });
}

async function searchMunicipalities(query) {
  const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const list = [];
  const seen = new Set();

  if (allSpanishMunicipalities.length > 0) {
    // 1. Coincidencias que empiezan por el nombre del municipio (máxima prioridad)
    for (const item of allSpanishMunicipalities) {
      if (item.normCity.startsWith(normalizedQuery)) {
        const key = `${item.city} (${item.province})`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ city: item.city, province: item.province });
          if (list.length >= 8) break;
        }
      }
    }

    // 2. Coincidencias que contienen la palabra en el municipio o provincia
    if (list.length < 8) {
      for (const item of allSpanishMunicipalities) {
        if (item.normCity.includes(normalizedQuery) || item.normProv.startsWith(normalizedQuery)) {
          const key = `${item.city} (${item.province})`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({ city: item.city, province: item.province });
            if (list.length >= 8) break;
          }
        }
      }
    }
  }

  // 3. Si hay pocos resultados locales, consultar geocodificador OpenStreetMap (para aldeas/pedanías muy pequeñas)
  if (list.length < 5) {
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=es&limit=6`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.features) {
          data.features.forEach(f => {
            const p = f.properties;
            if (p && p.country === "España" && p.name) {
              const cityName = p.name;
              const provinceName = p.county || p.state || "España";
              const key = `${cityName} (${provinceName})`;
              if (!seen.has(key)) {
                seen.add(key);
                list.push({ city: cityName, province: provinceName });
              }
            }
          });
        }
      }
    } catch (err) {
      // Usar resultados locales sin error
    }
  }

  return list.slice(0, 8);
}

function renderCityAutocomplete(results, input, dropdown) {
  if (results.length === 0) {
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
    return;
  }

  dropdown.innerHTML = results.map(item => `
    <div class="autocomplete-item" data-value="${item.city} (${item.province})">
      <i data-lucide="map-pin" style="width: 14px; height: 14px; color: var(--color-primary); flex-shrink: 0;"></i>
      <span class="autocomplete-item-city">${item.city}</span>
      <span class="autocomplete-item-province">${item.province}</span>
    </div>
  `).join("");

  dropdown.style.display = "flex";
  refreshIcons();

  dropdown.querySelectorAll(".autocomplete-item").forEach(itemEl => {
    itemEl.addEventListener("click", () => {
      input.value = itemEl.dataset.value;
      dropdown.style.display = "none";
      dropdown.innerHTML = "";
    });
  });
}

// ==========================================================================
// 7.2. AUTOCOMPLETADO DE PROFESIONES Y OFICIOS
// ==========================================================================
let allProfessionsList = [];
let isProfessionsLoaded = false;
let professionDebounceTimer = null;

async function loadProfessionsDataset() {
  if (isProfessionsLoaded) return;
  try {
    const res = await fetch("data/profesiones.json");
    if (res.ok) {
      const data = await res.json();
      allProfessionsList = data.map(item => ({
        name: item,
        norm: item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      }));
      isProfessionsLoaded = true;
    }
  } catch (err) {
    console.warn("No se pudo cargar data/profesiones.json localmente:", err);
  }
}

function setupProfessionAutocomplete() {
  const professionInput = document.getElementById("form-profession");
  const dropdown = document.getElementById("profession-autocomplete-dropdown");
  if (!professionInput || !dropdown) return;

  loadProfessionsDataset();

  // Activar navegación con flechas de teclado y Enter
  setupAutocompleteKeyboardNavigation(professionInput, dropdown);

  professionInput.addEventListener("input", () => {
    clearTimeout(professionDebounceTimer);
    const query = professionInput.value.trim();

    if (query.length < 1) {
      dropdown.style.display = "none";
      dropdown.innerHTML = "";
      return;
    }

    professionDebounceTimer = setTimeout(() => {
      const results = searchProfessions(query);
      renderProfessionAutocomplete(results, professionInput, dropdown);
    }, 60);
  });

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-group")) {
      dropdown.style.display = "none";
    }
  });
}

function searchProfessions(query) {
  const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const list = [];
  const seen = new Set();

  if (allProfessionsList.length > 0) {
    // 1. Coincidencias que empiezan por la consulta
    for (const item of allProfessionsList) {
      if (item.norm.startsWith(normalizedQuery)) {
        if (!seen.has(item.name)) {
          seen.add(item.name);
          list.push(item.name);
          if (list.length >= 8) break;
        }
      }
    }

    // 2. Coincidencias que contienen la consulta en cualquier parte
    if (list.length < 8) {
      for (const item of allProfessionsList) {
        if (item.norm.includes(normalizedQuery)) {
          if (!seen.has(item.name)) {
            seen.add(item.name);
            list.push(item.name);
            if (list.length >= 8) break;
          }
        }
      }
    }
  }

  return list;
}

function renderProfessionAutocomplete(results, input, dropdown) {
  if (results.length === 0) {
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
    return;
  }

  dropdown.innerHTML = results.map(prof => `
    <div class="autocomplete-item" data-value="${prof}">
      <i data-lucide="briefcase" style="width: 14px; height: 14px; color: var(--color-gold); flex-shrink: 0;"></i>
      <span class="autocomplete-item-city" style="font-weight: 500;">${prof}</span>
    </div>
  `).join("");

  dropdown.style.display = "flex";
  refreshIcons();

  dropdown.querySelectorAll(".autocomplete-item").forEach(itemEl => {
    itemEl.addEventListener("click", () => {
      input.value = itemEl.dataset.value;
      dropdown.style.display = "none";
      dropdown.innerHTML = "";
    });
  });
}

// ==========================================================================
// 7.3. GESTIÓN DE NAVEGACIÓN POR TECLADO PARA AUTOCOMPLETADOS
// ==========================================================================
function setupAutocompleteKeyboardNavigation(input, dropdown) {
  let activeIndex = -1;

  input.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll(".autocomplete-item");
    const isVisible = dropdown.style.display !== "none" && items.length > 0;

    if (!isVisible) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      highlightAutocompleteItem(items, activeIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      highlightAutocompleteItem(items, activeIndex);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        e.stopPropagation();
        items[activeIndex].click();
        activeIndex = -1;
      }
    } else if (e.key === "Escape") {
      dropdown.style.display = "none";
      dropdown.innerHTML = "";
      activeIndex = -1;
    }
  });

  input.addEventListener("input", () => {
    activeIndex = -1;
  });
}

function highlightAutocompleteItem(items, index) {
  items.forEach((item, i) => {
    if (i === index) {
      item.classList.add("highlighted");
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      item.classList.remove("highlighted");
    }
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    refreshIcons();
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal-backdrop").forEach(modal => {
    modal.classList.remove("active");
  });
}

// ==========================================================================
// 8. SISTEMA DE NOTIFICACIONES TOAST
// ==========================================================================
function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let iconName = "info";
  if (type === "success") iconName = "check-circle";
  if (type === "error") iconName = "alert-circle";

  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width: 20px; height: 20px; flex-shrink: 0;"></i>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}
