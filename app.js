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

  // Cargar árbol en caché local
  const cachedDataStr = localStorage.getItem("montes_tree_cache");
  let cachedTree = null;
  if (cachedDataStr) {
    try {
      cachedTree = JSON.parse(cachedDataStr);
    } catch (e) {}
  }

  const hasLocalUnsaved = localStorage.getItem("montes_has_unsaved") === "true";

  // 1. Intentar cargar desde el archivo data/tree.json
  try {
    const response = await fetch("data/tree.json?nocache=" + Date.now());
    if (response.ok) {
      const serverData = await response.json();
      if (Array.isArray(serverData)) {
        // Si el archivo en el servidor está vacío ([]), sincronizar vaciando la caché local
        if (serverData.length === 0) {
          AppState.treeData = [];
          localStorage.removeItem("montes_tree_cache");
          localStorage.removeItem("montes_has_unsaved");
          localStorage.removeItem("montes_photos_cache");
          localStorage.removeItem("montes_photos_deletions");
          AppState.photosCache = {};
          AppState.deletedPhotos = new Set();
          setUnsavedChanges(false);
          initTreeVisualization();
          updateHeaderSummary();
          return;
        }

        // Si hay cambios locales pendientes no sincronizados, preservarlos
        if (hasLocalUnsaved && Array.isArray(cachedTree) && cachedTree.length > 0) {
          AppState.treeData = cachedTree;
          setUnsavedChanges(true);
        } else {
          AppState.treeData = serverData;
          localStorage.setItem("montes_tree_cache", JSON.stringify(serverData));
          setUnsavedChanges(false);
        }
        initTreeVisualization();
        updateHeaderSummary();
        return;
      }
    }
  } catch (err) {
    console.warn("No se pudo cargar data/tree.json por fetch:", err);
  }

  // 2. Si falla fetch o no hay conexión, recurrir a la copia local guardada
  if (Array.isArray(cachedTree) && cachedTree.length > 0) {
    AppState.treeData = cachedTree;
    initTreeVisualization();
    updateHeaderSummary();
    return;
  }

  // 3. Fallback a array vacío si no hay ningún dato
  AppState.treeData = [];
  initTreeVisualization();
  updateHeaderSummary();
}

function setUnsavedChanges(status) {
  AppState.hasUnsavedChanges = status;
  localStorage.setItem("montes_has_unsaved", status ? "true" : "false");
  const badge = document.getElementById("unsaved-indicator");
  if (badge) {
    if (status) {
      badge.classList.add("visible");
    } else {
      badge.classList.remove("visible");
    }
  }
}

/**
 * Sincroniza el árbol genealógico y las fotografías con GitHub a través del endpoint /api/save
 */
async function syncTreeWithCloud(isAutoSave = false) {
  if (!isAutoSave) {
    showToast("Sincronizando cambios con la nube...", "info", 2500);
  }

  // Preparar fotografías pendientes de subir en Base64
  const photosToUpload = [];
  for (const [path, contentBase64] of Object.entries(AppState.photosCache || {})) {
    if (path && contentBase64 && typeof contentBase64 === "string" && contentBase64.startsWith("data:image/")) {
      photosToUpload.push({ path, contentBase64 });
    }
  }

  const photosToDelete = Array.from(AppState.deletedPhotos || []);

  const payload = {
    tree: AppState.treeData,
    photosToUpload,
    photosToDelete
  };

  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const resData = await response.json();
      setUnsavedChanges(false);
      AppState.deletedPhotos.clear();
      persistLocalTree();
      
      showToast("¡Cambios guardados y publicados con éxito en la nube!", "success", 4000);
      return true;
    } else {
      const errJson = await response.json().catch(() => ({}));
      console.warn("Respuesta no OK de /api/save:", errJson);
      
      if (response.status === 500 && errJson.error && errJson.error.includes("GITHUB_TOKEN")) {
        showToast("Los cambios se han guardado localmente en tu navegador. Para sincronizarlos con GitHub, añade la variable GITHUB_TOKEN en Cloudflare Pages.", "warning", 8000);
      } else {
        const errorDetail = errJson.details ? ` (${errJson.details})` : (errJson.error ? `: ${errJson.error}` : ": Error de servidor");
        showToast("Guardado localmente. Aviso al sincronizar en la nube" + errorDetail, "warning", 7000);
      }
      return false;
    }
  } catch (err) {
    console.warn("No se pudo conectar con /api/save (modo local o sin backend):", err);
    // En entorno local o sin Cloudflare Functions, se conserva 100% en localStorage
    if (!isAutoSave) {
      showToast("Cambios guardados en la memoria local de tu navegador.", "info", 3000);
    }
    return false;
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

    // Detección y ruptura de ciclos directos o invertidos (ej: si A es hijo de B, B no puede ser hijo de A)
    if (p.fid) {
      const father = personMap.get(p.fid);
      if (father && (father.fid === p.id || father.mid === p.id)) {
        if (father.fid === p.id) delete father.fid;
        if (father.mid === p.id) delete father.mid;
      }
    }
    if (p.mid) {
      const mother = personMap.get(p.mid);
      if (mother && (mother.fid === p.id || mother.mid === p.id)) {
        if (mother.fid === p.id) delete mother.fid;
        if (mother.mid === p.id) delete mother.mid;
      }
    }

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

    if (AppState.treeData.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 450px; text-align: center; padding: 2rem; color: #64748b;">
          <div style="width: 72px; height: 72px; border-radius: 50%; background: #f8fafc; border: 1.5px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; color: #a64b2a;">
            <i data-lucide="users" style="width: 36px; height: 36px;"></i>
          </div>
          <h2 style="font-family: 'Cinzel', Georgia, serif; font-size: 1.5rem; color: #1e293b; margin-bottom: 0.5rem;">Árbol Genealógico Vacío</h2>
          <p style="max-width: 420px; font-size: 0.95rem; line-height: 1.5; color: #64748b; margin-bottom: 1.5rem;">
            No hay ningún familiar registrado todavía. Pulsa el botón para añadir a la primera persona y comenzar a construir el árbol desde cero.
          </p>
          <button class="btn btn-primary" id="btn-empty-add-first" onclick="openAddRootPersonModal()" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; font-size: 0.95rem; border-radius: 8px;">
            <i data-lucide="user-plus" style="width: 18px; height: 18px;"></i>
            Añadir Primer Familiar
          </button>
        </div>
      `;
      const emptyAddBtn = document.getElementById("btn-empty-add-first");
      if (emptyAddBtn) {
        emptyAddBtn.onclick = () => openAddRootPersonModal();
      }
      refreshIcons();
      updateHeaderCount();
      return;
    }

    // Sanear y normalizar el grafo genealógico
    cleanAndValidateTreeData(AppState.treeData);

    // Configuración de plantilla Opción B: Vertical / Ficha (240 x 150 px con mayor holgura y lugar de nacimiento)
    FamilyTree.templates.montesTheme = Object.assign({}, FamilyTree.templates.john);
    FamilyTree.templates.montesTheme.size = [240, 150];
    
    // Tarjeta noble genérica
    FamilyTree.templates.montesTheme.node = `
      <clipPath id="cardClip{id}">
        <rect x="0" y="0" height="150" width="240" rx="14" ry="14"></rect>
      </clipPath>
      <rect x="0" y="0" height="150" width="240" fill="#ffffff" stroke-width="1.5" stroke="#d5cdbf" rx="14" ry="14" class="node-box" filter="drop-shadow(0px 4px 12px rgba(0,0,0,0.06))"></rect>
      <rect x="0" y="0" height="150" width="6" fill="#a64b2a" clip-path="url(#cardClip{id})"></rect>
    `;

    // Tarjetas diferenciadas por género con integración perfecta en las esquinas redondeadas
    FamilyTree.templates.montesTheme_male = Object.assign({}, FamilyTree.templates.montesTheme);
    FamilyTree.templates.montesTheme_male.node = `
      <clipPath id="cardClipM{id}">
        <rect x="0" y="0" height="150" width="240" rx="14" ry="14"></rect>
      </clipPath>
      <rect x="0" y="0" height="150" width="240" fill="#ffffff" stroke-width="1.5" stroke="#cbd5e1" rx="14" ry="14" class="node-box" filter="drop-shadow(0px 4px 12px rgba(37,99,235,0.07))"></rect>
      <rect x="0" y="0" height="150" width="6" fill="#3b82f6" clip-path="url(#cardClipM{id})"></rect>
    `;

    FamilyTree.templates.montesTheme_female = Object.assign({}, FamilyTree.templates.montesTheme);
    FamilyTree.templates.montesTheme_female.node = `
      <clipPath id="cardClipF{id}">
        <rect x="0" y="0" height="150" width="240" rx="14" ry="14"></rect>
      </clipPath>
      <rect x="0" y="0" height="150" width="240" fill="#ffffff" stroke-width="1.5" stroke="#fbcfe8" rx="14" ry="14" class="node-box" filter="drop-shadow(0px 4px 12px rgba(219,39,119,0.07))"></rect>
      <rect x="0" y="0" height="150" width="6" fill="#ec4899" clip-path="url(#cardClipF{id})"></rect>
    `;

    // Fotografía circular centrada verticalmente con cursor de ampliación (cy = 75)
    FamilyTree.templates.montesTheme.img_0 = `
      <clipPath id="ulaImg{id}"><circle cx="40" cy="75" r="26"></circle></clipPath>
      <circle cx="40" cy="75" r="28" fill="none" stroke="#e2d9cd" stroke-width="2"></circle>
      <image preserveAspectRatio="xMidYMid slice" clip-path="url(#ulaImg{id})" xlink:href="{val}" x="14" y="49" width="52" height="52" style="cursor: zoom-in; pointer-events: all;"></image>
    `;
    FamilyTree.templates.montesTheme_male.img_0 = FamilyTree.templates.montesTheme.img_0;
    FamilyTree.templates.montesTheme_female.img_0 = FamilyTree.templates.montesTheme.img_0;

    // Nombre Línea 1 (para nombres largos en 2 líneas)
    FamilyTree.templates.montesTheme.field_0 = `
      <text style="font-size: 12.5px; font-weight: 700; font-family: 'Outfit', -apple-system, sans-serif;" fill="#1e293b" x="74" y="23">{val}</text>
    `;
    FamilyTree.templates.montesTheme_male.field_0 = FamilyTree.templates.montesTheme.field_0;
    FamilyTree.templates.montesTheme_female.field_0 = FamilyTree.templates.montesTheme.field_0;

    // Nombre Línea 2 (para nombres largos en 2 líneas)
    FamilyTree.templates.montesTheme.field_3 = `
      <text style="font-size: 12.5px; font-weight: 700; font-family: 'Outfit', -apple-system, sans-serif;" fill="#1e293b" x="74" y="39">{val}</text>
    `;
    FamilyTree.templates.montesTheme_male.field_3 = FamilyTree.templates.montesTheme.field_3;
    FamilyTree.templates.montesTheme_female.field_3 = FamilyTree.templates.montesTheme.field_3;

    // Nombre en 1 sola línea (centrado y equilibrado)
    FamilyTree.templates.montesTheme.field_4 = `
      <text style="font-size: 13px; font-weight: 700; font-family: 'Outfit', -apple-system, sans-serif;" fill="#1e293b" x="74" y="30">{val}</text>
    `;
    FamilyTree.templates.montesTheme_male.field_4 = FamilyTree.templates.montesTheme.field_4;
    FamilyTree.templates.montesTheme_female.field_4 = FamilyTree.templates.montesTheme.field_4;

    // Fechas vitales y edad
    FamilyTree.templates.montesTheme.field_1 = `
      <text style="font-size: 11px; font-weight: 600; font-family: 'Outfit', -apple-system, sans-serif;" fill="#64748b" x="74" y="60">{val}</text>
    `;
    FamilyTree.templates.montesTheme_male.field_1 = FamilyTree.templates.montesTheme.field_1;
    FamilyTree.templates.montesTheme_female.field_1 = FamilyTree.templates.montesTheme.field_1;

    // Lugar de Nacimiento con estrella genealógica en tono ámbar/dorado noble
    FamilyTree.templates.montesTheme.field_6 = `
      <text style="font-size: 10.5px; font-weight: 600; font-family: 'Outfit', -apple-system, sans-serif;" fill="#b45309" x="74" y="84">{val}</text>
    `;
    FamilyTree.templates.montesTheme_male.field_6 = FamilyTree.templates.montesTheme.field_6;
    FamilyTree.templates.montesTheme_female.field_6 = FamilyTree.templates.montesTheme.field_6;

    // Ubicación Línea 1: Lugar de Residencia con chincheta roja (map-pin)
    FamilyTree.templates.montesTheme.field_2 = `
      <g>
        <svg x="74" y="97" width="12" height="12" viewBox="0 0 24 24" fill="#e11d48" stroke="#e11d48" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
        </svg>
        <text style="font-size: 10.5px; font-weight: 500; font-family: 'Outfit', -apple-system, sans-serif;" fill="#64748b" x="89" y="108">{val}</text>
      </g>
    `;
    FamilyTree.templates.montesTheme_male.field_2 = FamilyTree.templates.montesTheme.field_2;
    FamilyTree.templates.montesTheme_female.field_2 = FamilyTree.templates.montesTheme.field_2;

    // Ubicación Línea 2: Provincia entre paréntesis debajo del municipio
    FamilyTree.templates.montesTheme.field_5 = `
      <text style="font-size: 10px; font-weight: 500; font-family: 'Outfit', -apple-system, sans-serif;" fill="#94a3b8" x="89" y="126">{val}</text>
    `;
    FamilyTree.templates.montesTheme_male.field_5 = FamilyTree.templates.montesTheme.field_5;
    FamilyTree.templates.montesTheme_female.field_5 = FamilyTree.templates.montesTheme.field_5;

    // Limpiar campos extras
    for (let i = 7; i <= 15; i++) {
      delete FamilyTree.templates.montesTheme['field_' + i];
      delete FamilyTree.templates.montesTheme_male['field_' + i];
      delete FamilyTree.templates.montesTheme_female['field_' + i];
    }

/**
 * Asegura que todos los municipios muestren su provincia entre paréntesis al lado.
 * - Si cabe en 1 sola línea (<= 21 caracteres, ej: "Madrid (Madrid)", "Astorga (León)", "León (León)"),
 *   se muestra TODO junto en la misma línea.
 * - Solo si supera los 21 caracteres (ej: "Azuqueca de Henares (Guadalajara)", "Navianos de la Vega (León)", "Valladolid (Valladolid)"),
 *   la provincia pasa a la segunda línea.
 */
function parseLocationLines(city) {
  if (!city) return { muni: "", prov: "" };
  let trimmed = city.trim();

  // Si no tiene paréntesis con provincia y no tiene barra, añadir automáticamente su provincia al lado
  if (!trimmed.includes("(") && !trimmed.includes("/")) {
    trimmed = `${trimmed} (${trimmed})`;
  }

  // Si cabe en 1 sola línea (hasta 21 caracteres): ¡Todo junto en 1 línea!
  if (trimmed.length <= 21) {
    return {
      muni: trimmed,
      prov: ""
    };
  }

  // Si supera 21 caracteres y tiene formato "Municipio (Provincia)", se divide en 2 líneas
  const match = trimmed.match(/^(.+?)\s*\((.+?)\)$/);
  if (match) {
    return {
      muni: match[1].trim(),
      prov: `(${match[2].trim()})`
    };
  }

  // Si tiene formato compuesto con barra ej. "Madrid / Navianos"
  if (trimmed.includes(" / ")) {
    const parts = trimmed.split(" / ");
    if (parts.length === 2) {
      return {
        muni: parts[0].trim(),
        prov: `/ ${parts[1].trim()}`
      };
    }
  }

  return {
    muni: trimmed,
    prov: ""
  };
}

    // Mapeo de datos a formato FamilyTreeJS
    const formattedNodes = AppState.treeData.map(person => {
      const datesStr = (person.birth || person.death) 
        ? formatVitalDatesWithAge(person.birth, person.death) 
        : "";
      
      const loc = parseLocationLines(person.city);
      const birthLoc = (person.birth_place && person.birth_place.trim()) ? parseLocationLines(person.birth_place) : null;
      const birthStr = birthLoc ? `★ ${birthLoc.muni}` : "★ ";

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
        loc_birth: birthStr,
        loc_muni: loc.muni,
        loc_prov: loc.prov,
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
        siblingSeparation: 45,
        levelSeparation: 95,
        subtreeSeparation: 45,
        partnerSeparation: 30,
        scaleInitial: FamilyTree.match.boundary,
        nodeBinding: {
          field_0: "name_l1",
          field_3: "name_l2",
          field_4: "name_single",
          field_1: "title",
          field_6: "loc_birth",
          field_2: "loc_muni",
          field_5: "loc_prov",
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
  
  // Si cabe en 1 sola línea (hasta 22 caracteres): ¡NO saltar de línea!
  // Nombres como "Daniel Montes Cruz", "Javier Ruiz Gómez", "Elena Montes Fernández", "Francisco Montes Vega", etc. van en 1 línea
  if (trimmed.length <= 22) {
    return { line1: trimmed, line2: "" };
  }

  // Nombres de 4 palabras (ej: "Rosa María García López"):
  // Priorizar romper entre los dos apellidos: "Rosa María García" en línea 1 y "López" en línea 2
  if (words.length === 4) {
    const l1WithSurname = `${words[0]} ${words[1]} ${words[2]}`;
    if (l1WithSurname.length <= 21) {
      return {
        line1: l1WithSurname,
        line2: words[3]
      };
    }
    return {
      line1: `${words[0]} ${words[1]}`,
      line2: `${words[2]} ${words[3]}`
    };
  }

  // Nombres de 3 palabras (ej: "Manuel Montes Fernández"):
  // Romper entre los dos apellidos: "Manuel Montes" / "Fernández"
  if (words.length === 3) {
    return {
      line1: `${words[0]} ${words[1]}`,
      line2: words[2]
    };
  }

  // Nombres de 5 palabras (ej: "María del Carmen Fernández Santos"):
  if (words.length === 5) {
    return {
      line1: `${words[0]} ${words[1]} ${words[2]}`,
      line2: `${words[3]} ${words[4]}`
    };
  }

  // Algoritmo general: intentar dejar el último apellido en la 2ª línea si la 1ª cabe
  const allExceptLast = words.slice(0, words.length - 1).join(" ");
  if (allExceptLast.length <= 21) {
    return {
      line1: allExceptLast,
      line2: words[words.length - 1]
    };
  }

  const mid = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, mid).join(" "),
    line2: words.slice(mid).join(" ")
  };
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
  // Espaciado extra hacia la derecha mediante espacios protegidos no colapsables
  const ageSuffix = age ? `\u00A0\u00A0(${age})` : "";

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

  // Lugar de nacimiento
  const rowBirthPlace = document.getElementById("row-drawer-birthplace");
  if (person.birth_place) {
    if (rowBirthPlace) rowBirthPlace.style.display = "flex";
    const valBirthPlace = document.getElementById("drawer-val-birthplace");
    if (valBirthPlace) valBirthPlace.textContent = person.birth_place;
  } else {
    if (rowBirthPlace) rowBirthPlace.style.display = "none";
  }

  // Ubicación / Lugar de residencia
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
  const directionalHidden = document.getElementById("form-rel-directional-type");
  if (directionalHidden) directionalHidden.value = directionalType;
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
  const birthPlaceInput = document.getElementById("form-birth-place");
  if (birthPlaceInput) birthPlaceInput.value = "";
  document.getElementById("form-photo").value = "";
  document.getElementById("form-photo-file").value = "";
  document.getElementById("form-photo-preview").src = getDefaultAvatar(genderSelect.value);
  document.getElementById("btn-remove-photo").style.display = "none";

  const suggestionBox = document.getElementById("name-suggestion-box");
  if (suggestionBox) suggestionBox.style.display = "none";

  openModal("modal-person");
}

function openAddRootPersonModal() {
  const form = document.getElementById("form-person");
  form.reset();

  document.getElementById("form-person-id").value = "";
  document.getElementById("form-relative-target-id").value = "";
  const directionalHidden = document.getElementById("form-rel-directional-type");
  if (directionalHidden) directionalHidden.value = "";
  document.getElementById("group-relationship-type").style.display = "none";
  document.getElementById("group-form-links").style.display = "block";
  document.getElementById("form-gender").disabled = false;
  document.getElementById("modal-person-title").querySelector("span").textContent = "Añadir Nueva Persona al Árbol";
  
  const birthPlaceInput = document.getElementById("form-birth-place");
  if (birthPlaceInput) birthPlaceInput.value = "";
  document.getElementById("form-photo").value = "";
  document.getElementById("form-photo-file").value = "";
  document.getElementById("form-photo-preview").src = getDefaultAvatar("male");
  document.getElementById("btn-remove-photo").style.display = "none";

  const suggestionBox = document.getElementById("name-suggestion-box");
  if (suggestionBox) suggestionBox.style.display = "none";

  // Poblar selectores de padre, madre y cónyuge
  populateParentAndPartnerSelectors(null, {});

  openModal("modal-person");
}

function openEditPersonModal(personId) {
  const person = AppState.treeData.find(p => p.id === personId);
  if (!person) return;

  document.getElementById("form-person-id").value = person.id;
  document.getElementById("form-relative-target-id").value = "";
  const directionalHidden = document.getElementById("form-rel-directional-type");
  if (directionalHidden) directionalHidden.value = "";
  document.getElementById("group-relationship-type").style.display = "none";
  document.getElementById("group-form-links").style.display = "block";
  document.getElementById("form-gender").disabled = false;
  
  document.getElementById("modal-person-title").querySelector("span").textContent = `Editar: ${person.name}`;
  
  document.getElementById("form-name").value = person.name || "";
  document.getElementById("form-gender").value = person.gender || "male";
  const birthPlaceInput = document.getElementById("form-birth-place");
  if (birthPlaceInput) birthPlaceInput.value = person.birth_place || "";
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

  const suggestionBox = document.getElementById("name-suggestion-box");
  if (suggestionBox) suggestionBox.style.display = "none";

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

async function savePersonFromForm() {
  const saveBtn = document.getElementById("btn-save-person");
  const originalBtnHtml = saveBtn ? saveBtn.innerHTML : "";

  const idInput = document.getElementById("form-person-id").value;
  const relTargetIdInput = document.getElementById("form-relative-target-id").value;
  const directionalTypeInput = document.getElementById("form-rel-directional-type") ? document.getElementById("form-rel-directional-type").value : "";
  const selectRelType = document.getElementById("form-rel-type").value;
  const relType = directionalTypeInput || selectRelType;

  const name = document.getElementById("form-name").value.trim();
  const gender = document.getElementById("form-gender").value;
  const birthPlaceInput = document.getElementById("form-birth-place");
  const birth_place = birthPlaceInput ? birthPlaceInput.value.trim() : "";
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
        birth_place,
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

      // Romper ciclos si se seleccionó madre o padre que tuviera como padre/madre a esta persona
      if (manualMid) {
        const mother = AppState.treeData.find(p => p.id === manualMid);
        if (mother) {
          if (mother.fid === personId) delete mother.fid;
          if (mother.mid === personId) delete mother.mid;
        }
      }
      if (manualFid) {
        const father = AppState.treeData.find(p => p.id === manualFid);
        if (father) {
          if (father.fid === personId) delete father.fid;
          if (father.mid === personId) delete father.mid;
        }
      }

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
      birth_place,
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
        const isFather = relType === "parent_father" || (relType === "parent" && gender === "male");
        const isMother = relType === "parent_mother" || (relType === "parent" && gender === "female");

        if (isFather) {
          targetPerson.fid = newId;
          delete newPerson.fid;
          delete newPerson.mid;
          // Si el hijo ya tiene madre, vincularlos como pareja mutuamente
          if (targetPerson.mid) {
            newPerson.pids = [targetPerson.mid];
            const mother = AppState.treeData.find(p => p.id === targetPerson.mid);
            if (mother) {
              if (!mother.pids) mother.pids = [];
              if (!mother.pids.includes(newId)) mother.pids.push(newId);
            }
          }
        } else if (isMother) {
          targetPerson.mid = newId;
          delete newPerson.fid;
          delete newPerson.mid;
          // Si el hijo ya tiene padre, vincularlos como pareja mutuamente
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

  // Guardar automáticamente a través de la API en segundo plano
  await syncTreeWithCloud(true);

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalBtnHtml;
  }
}

async function deleteSelectedPerson() {
  if (!AppState.selectedPersonId) return;
  const personId = AppState.selectedPersonId;
  const person = AppState.treeData.find(p => p.id === personId);
  const name = person ? person.name : "la persona";

  const confirmBtn = document.getElementById("btn-confirm-delete");
  const originalConfirmHtml = confirmBtn ? confirmBtn.innerHTML : "";
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `
      <i data-lucide="loader-2" class="spin-animation" style="width: 16px; height: 16px;"></i>
      <span>Eliminando...</span>
    `;
    refreshIcons();
  }

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

  setUnsavedChanges(true);
  persistLocalTree();
  closeAllModals();
  closePersonDrawer();
  AppState.selectedPersonId = null;
  initTreeVisualization();
  updateHeaderSummary();
  showToast(`${name} ha sido eliminado del árbol`, "info");

  // Guardar automáticamente a través de la API
  await syncTreeWithCloud(true);

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = originalConfirmHtml;
  }
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
  showToast("Generando PDF del árbol genealógico en alta resolución...", "info", 5000);

  // 1. Si FamilyTree tiene exportPDF nativo, usar formato normalizado A3
  if (AppState.treeInstance && typeof AppState.treeInstance.exportPDF === "function") {
    try {
      AppState.treeInstance.exportPDF({
        filename: "arbol_genealogico_familia_montes.pdf",
        landscape: true,
        fit: "all",
        format: "A3",
        expandChildren: true,
        margin: [15, 15, 15, 15]
      });
      showToast("¡PDF del árbol genealógico descargado con éxito!", "success");
      return;
    } catch (err) {
      console.warn("Fallo exportPDF nativo de la librería, usando motor jsPDF:", err);
    }
  }

  // 2. Motor de renderizado vectorial de ultra alta resolución con proporción estándar
  try {
    const svgEl = document.querySelector("#tree-canvas svg");
    if (!svgEl) {
      showToast("No se encontró el árbol en pantalla para exportar.", "error");
      return;
    }

    // Calcular el área total del árbol completo
    let bbox;
    try {
      if (svgEl.getBBox) {
        bbox = svgEl.getBBox();
      }
    } catch (e) {
      console.warn("getBBox warn:", e);
    }

    if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
      const nodes = svgEl.querySelectorAll("rect, g[data-n-id]");
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach(el => {
        if (el.getBBox) {
          const b = el.getBBox();
          if (b.width > 0 && b.height > 0) {
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
          }
        }
      });
      if (minX !== Infinity) {
        bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      } else {
        bbox = { x: 0, y: 0, width: 2600, height: 1600 };
      }
    }

    const padding = 70;
    const cropX = bbox.x - padding;
    const cropY = bbox.y - padding;
    const totalWidth = Math.max(bbox.width + padding * 2, 800);
    const totalHeight = Math.max(bbox.height + padding * 2, 500);

    const clonedSvg = svgEl.cloneNode(true);
    clonedSvg.setAttribute("width", totalWidth);
    clonedSvg.setAttribute("height", totalHeight);
    clonedSvg.setAttribute("viewBox", `${cropX} ${cropY} ${totalWidth} ${totalHeight}`);
    clonedSvg.style.background = "#f8f6f0";

    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const DOMURL = window.URL || window.webkitURL || window;
    const url = DOMURL.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Escala 3.0 para nitidez fotográfica y vectorial superior (300+ DPI)
      const scale = 3.0;
      const canvas = document.createElement("canvas");
      canvas.width = totalWidth * scale;
      canvas.height = totalHeight * scale;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f8f6f0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      DOMURL.revokeObjectURL(url);

      if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;

        // Proporción estándar DIN (A3 / A2 según tamaño total)
        let dinFormat = "a3";
        if (totalWidth > 2200 || totalHeight > 1500) {
          dinFormat = "a2";
        }

        const isLandscape = totalWidth >= totalHeight;
        const pdf = new jsPDF({
          orientation: isLandscape ? "landscape" : "portrait",
          unit: "mm",
          format: dinFormat
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Margen perimetral limpio de 12 mm
        const marginMm = 12;
        const usableWidth = pageWidth - marginMm * 2;
        const usableHeight = pageHeight - marginMm * 2;

        // Escalar proporcionalmente para encajar en el área imprimible
        const scaleFactor = Math.min(usableWidth / totalWidth, usableHeight / totalHeight);
        const renderWidth = totalWidth * scaleFactor;
        const renderHeight = totalHeight * scaleFactor;

        // Centrado exacto en la página
        const posX = marginMm + (usableWidth - renderWidth) / 2;
        const posY = marginMm + (usableHeight - renderHeight) / 2;

        pdf.addImage(imgData, "JPEG", posX, posY, renderWidth, renderHeight);
        pdf.save("arbol_genealogico_familia_montes.pdf");
        showToast("¡PDF del árbol genealógico descargado con éxito!", "success");
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

  // Asistente inteligente de corrección de nombres y tildes
  setupNameAutoCorrection();

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
  const cityDropdown = document.getElementById("city-autocomplete-dropdown");
  const birthPlaceInput = document.getElementById("form-birth-place");
  const birthPlaceDropdown = document.getElementById("birthplace-autocomplete-dropdown");

  // Cargar dataset completo en segundo plano
  loadSpanishMunicipalitiesDataset();

  function attachAutocomplete(inputEl, dropdownEl) {
    if (!inputEl || !dropdownEl) return;
    setupAutocompleteKeyboardNavigation(inputEl, dropdownEl);

    let debounceTimer;
    inputEl.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const query = inputEl.value.trim();

      if (query.length < 2) {
        dropdownEl.style.display = "none";
        dropdownEl.innerHTML = "";
        return;
      }

      debounceTimer = setTimeout(async () => {
        const results = await searchMunicipalities(query);
        renderCityAutocomplete(results, inputEl, dropdownEl);
      }, 100);
    });
  }

  attachAutocomplete(cityInput, cityDropdown);
  attachAutocomplete(birthPlaceInput, birthPlaceDropdown);

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-group")) {
      if (cityDropdown) cityDropdown.style.display = "none";
      if (birthPlaceDropdown) birthPlaceDropdown.style.display = "none";
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
// 8. ASISTENTE INTELIGENTE DE CORRECCIÓN DE NOMBRES, TILDES Y ERRATAS
// ==========================================================================

const SPANISH_ACCENTED_NAMES_MAP = {
  // Nombres masculinos y femeninos frecuentes con tildes canónicas
  "maria": "María", "jose": "José", "jesus": "Jesús", "angel": "Ángel", "alvaro": "Álvaro",
  "raul": "Raúl", "ruben": "Rubén", "ivan": "Iván", "oscar": "Óscar", "adrian": "Adrián",
  "ines": "Inés", "sofia": "Sofía", "lucia": "Lucía", "ramon": "Ramón", "joaquin": "Joaquín",
  "cesar": "César", "hector": "Héctor", "andres": "Andrés", "victor": "Víctor", "tomas": "Tomás",
  "julian": "Julián", "felix": "Félix", "matias": "Matías", "belen": "Belén", "agustin": "Agustín",
  "damian": "Damián", "german": "Germán", "nestor": "Néstor", "simon": "Simón", "fabian": "Fabián",
  "sebastian": "Sebastián", "cristian": "Cristián", "rocio": "Rocío", "monica": "Mónica", "veronica": "Verónica",
  "inmaculada": "Inmaculada", "concepcion": "Concepción", "asuncion": "Asunción", "encarnacion": "Encarnación",
  "estefania": "Estefanía", "valentin": "Valentín", "martin": "Martín", "gonzalo": "Gonzalo",
  "rodrigo": "Rodrigo", "guillermo": "Guillermo", "antonio": "Antonio", "manuel": "Manuel",
  "francisco": "Francisco", "david": "David", "javier": "Javier", "carlos": "Carlos",
  "daniel": "Daniel", "alejandro": "Alejandro", "miguel": "Miguel", "pedro": "Pedro",
  "fernando": "Fernando", "jorge": "Jorge", "luis": "Luis", "alberto": "Alberto",
  "sergio": "Sergio", "juan": "Juan", "diego": "Diego", "pablo": "Pablo",
  "ignacio": "Ignacio", "jaime": "Jaime", "marcos": "Marcos", "lucas": "Lucas",
  "pilar": "Pilar", "carmen": "Carmen", "teresa": "Teresa", "elena": "Elena", "angela": "Ángela",
  "mercedes": "Mercedes", "rosario": "Rosario", "dolores": "Dolores", "consuelo": "Consuelo",
  "amalia": "Amalia", "cecilia": "Cecilia", "celia": "Celia", "claudia": "Claudia",

  // Apellidos españoles frecuentes con tildes canónicas
  "garcia": "García", "fernandez": "Fernández", "gonzalez": "González", "rodriguez": "Rodríguez",
  "lopez": "López", "martinez": "Martínez", "sanchez": "Sánchez", "perez": "Pérez",
  "gomez": "Gómez", "ruiz": "Ruiz", "hernandez": "Hernández", "diaz": "Díaz",
  "alvarez": "Álvarez", "munoz": "Muñoz", "dominguez": "Domínguez", "vazquez": "Vázquez",
  "ramirez": "Ramírez", "nunez": "Núñez", "mendez": "Méndez", "cortes": "Cortés",
  "marquez": "Márquez", "gimenez": "Giménez", "ibanez": "Ibáñez", "duran": "Durán",
  "benitez": "Benítez", "roman": "Román", "saez": "Sáez", "millan": "Millán",
  "beltran": "Beltrán", "marin": "Marín", "rubin": "Rubín", "montez": "Montes", "montes": "Montes",
  "alonso": "Alonso", "gutierrez": "Gutiérrez", "navarro": "Navarro", "torres": "Torres",
  "ramos": "Ramos", "gil": "Gil", "serrano": "Serrano", "blanco": "Blanco", "molina": "Molina",
  "morales": "Morales", "suarez": "Suárez", "ortega": "Ortega", "delgado": "Delgado",
  "castro": "Castro", "ortiz": "Ortiz", "sanz": "Sanz", "iglesias": "Iglesias",
  "garrido": "Garrido", "lozano": "Lozano", "santos": "Santos", "cano": "Cano",
  "cruz": "Cruz", "prieto": "Prieto", "calvo": "Calvo", "gallego": "Gallego",
  "vidal": "Vidal", "leon": "León", "cabrera": "Cabrera", "pena": "Peña",
  "flores": "Flores", "campos": "Campos", "vega": "Vega", "fuentes": "Fuentes",
  "carrasco": "Carrasco", "caballero": "Caballero", "nieto": "Nieto", "reyes": "Reyes",
  "aguilar": "Aguilar", "pascual": "Pascual", "santana": "Santana", "herrero": "Herrero",
  "montero": "Montero", "hidalgo": "Hidalgo", "mora": "Mora", "vicente": "Vicente",
  "arias": "Arias", "carmona": "Carmona", "crespo": "Crespo", "pastor": "Pastor",
  "soto": "Soto", "velasco": "Velasco", "soler": "Soler", "moya": "Moya",
  "esteban": "Esteban", "parra": "Parra", "bravo": "Bravo", "gallardo": "Gallardo",
  "rojas": "Rojas", "pardo": "Pardo", "franco": "Franco", "cordero": "Cordero",
  "rivas": "Rivas", "silva": "Silva", "luque": "Luque", "cuesta": "Cuesta",
  "maya": "Maya", "otero": "Otero", "valle": "Valle", "diez": "Díez"
};

const LOWERCASE_PARTICLES = new Set(["de", "del", "de la", "de los", "de las", "y", "e", "i", "la", "los", "las"]);

function normalizeTokenForLookup(token) {
  return token.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zñ]/g, "");
}

function correctSpanishName(rawName) {
  if (!rawName || typeof rawName !== "string") return "";
  const cleaned = rawName.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  const words = cleaned.split(" ");
  const correctedWords = [];

  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i];
    const lowerWord = rawWord.toLowerCase();

    // Mantener partículas intermedias en minúscula (ej. "de la", "del", "y")
    if (i > 0 && LOWERCASE_PARTICLES.has(lowerWord)) {
      correctedWords.push(lowerWord);
      continue;
    }

    const lookupKey = normalizeTokenForLookup(rawWord);
    if (SPANISH_ACCENTED_NAMES_MAP[lookupKey]) {
      correctedWords.push(SPANISH_ACCENTED_NAMES_MAP[lookupKey]);
    } else {
      // Capitalizar primera letra de forma estándar (Title Case)
      const capitalized = rawWord.charAt(0).toUpperCase() + rawWord.slice(1).toLowerCase();
      correctedWords.push(capitalized);
    }
  }

  return correctedWords.join(" ");
}

function autoCapitalizeInput(input) {
  const cursorPos = input.selectionStart;
  const originalValue = input.value;
  if (!originalValue) return;

  // Dividir conservando los espacios exactos
  const parts = originalValue.split(/(\s+)/);
  let wordCount = 0;

  const transformed = parts.map(part => {
    if (/^\s+$/.test(part) || !part) return part;
    const lower = part.toLowerCase();

    // Partículas intermedias se mantienen en minúscula (ej: "de", "del", "y")
    if (wordCount > 0 && LOWERCASE_PARTICLES.has(lower)) {
      wordCount++;
      return lower;
    }

    wordCount++;
    // Poner automáticamente la primera letra de cada nombre/apellido en mayúscula
    return part.charAt(0).toUpperCase() + part.slice(1);
  });

  const newValue = transformed.join("");
  if (newValue !== originalValue) {
    input.value = newValue;
    if (cursorPos !== null) {
      input.setSelectionRange(cursorPos, cursorPos);
    }
  }
}

function setupNameAutoCorrection() {
  const nameInput = document.getElementById("form-name");
  const suggestionBox = document.getElementById("name-suggestion-box");
  const suggestionText = document.getElementById("name-suggestion-text");
  const applyBtn = document.getElementById("btn-apply-name-suggestion");

  if (!nameInput) return;

  function evaluateCorrection() {
    const rawValue = nameInput.value;
    if (!rawValue || rawValue.trim().length < 3) {
      if (suggestionBox) suggestionBox.style.display = "none";
      return;
    }

    const corrected = correctSpanishName(rawValue);
    // Mostrar sugerencia si hay diferencias de tildes o acentos
    if (corrected && corrected !== rawValue.trim()) {
      if (suggestionText) suggestionText.textContent = corrected;
      if (suggestionBox) suggestionBox.style.display = "flex";
      refreshIcons();
    } else {
      if (suggestionBox) suggestionBox.style.display = "none";
    }
  }

  // Capitalización automática en tiempo real mientras se escribe y detección de sugerencias
  let debounceTimer;
  nameInput.addEventListener("input", () => {
    autoCapitalizeInput(nameInput);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(evaluateCorrection, 150);
  });

  // Aplicar sugerencia con el botón
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      const corrected = correctSpanishName(nameInput.value);
      if (corrected) {
        nameInput.value = corrected;
        if (suggestionBox) suggestionBox.style.display = "none";
        nameInput.focus();
        showToast("Nombre corregido con tildes ortográficas", "info", 2000);
      }
    });
  }

  // Al salir del campo (blur), aplicar formato canónico completo
  nameInput.addEventListener("blur", () => {
    const val = nameInput.value.trim();
    if (val.length >= 3) {
      nameInput.value = correctSpanishName(val);
      if (suggestionBox) suggestionBox.style.display = "none";
    }
  });
}

// ==========================================================================
// 9. SISTEMA DE NOTIFICACIONES TOAST
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

