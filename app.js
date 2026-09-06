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
  currentRootId: null,
  treeOrientation: localStorage.getItem("montes_tree_orientation") || "top",
  treeLayout: localStorage.getItem("montes_tree_layout") || "normal",
  hasUnsavedChanges: false,
  isAuthenticated: false,
  photosCache: {},      // Mapeo de 'photos/nombre_persona.jpg' -> base64 DataURL
  deletedPhotos: new Set(), // Set de 'photos/...' marcadas para eliminar
  prerenderHookAttached: false
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
  const isAuth = sessionStorage.getItem("montes_auth_logged_in") === "true" || window.location.search.includes("autologin=1");
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

/**
 * Obtiene el objeto cónyuge de una persona (buscando tanto en pids propios como en los pids de su pareja)
 */
function getPersonPartner(person) {
  if (!person || !AppState.treeData) return null;
  if (person.pids && person.pids.length > 0) {
    const direct = AppState.treeData.find(p => p.id === person.pids[0]);
    if (direct) return direct;
  }
  return AppState.treeData.find(p => p.id !== person.id && p.pids && p.pids.includes(person.id)) || null;
}

/**
 * Obtiene el ID del cónyuge de una persona
 */
function getPersonPartnerId(person) {
  const partner = getPersonPartner(person);
  return partner ? partner.id : null;
}

/**
 * Extrae el primer apellido o término significativo del nombre para titular ramas
 */
function getFirstSurname(fullName) {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0];
  if (parts.length === 2) return parts[1];
  return parts[1];
}

/**
 * Analiza el árbol genealógico y devuelve todas las ramas principales disponibles.
 * Cada rama representa una línea troncal de ancestros raíces con sus descendientes.
 */
function getAvailableBranches(treeData) {
  if (!treeData || treeData.length === 0) return [];

  // Encontrar todas las personas que no tienen padres registrados (raíces)
  // Descartar a cónyuges que se unieron a generaciones intermedias/inferiores (su pareja sí tiene padres registrados)
  let candidateRoots = treeData.filter(p => {
    if (p.fid || p.mid) return false;
    const partner = getPersonPartner(p);
    if (partner && (partner.fid || partner.mid)) {
      return false;
    }
    return true;
  });

  if (candidateRoots.length === 0) {
    candidateRoots = treeData.filter(p => !p.fid && !p.mid);
  }

  if (candidateRoots.length === 0) {
    return [{
      id: treeData[0].id,
      name: `Rama Principal (${treeData[0].name})`,
      shortName: treeData[0].name,
      membersCount: treeData.length,
      nodeIds: new Set(treeData.map(p => p.id))
    }];
  }

  // Función para obtener todos los nodos alcanzables en orden descendente y cónyuges
  function getReachableNodes(startId) {
    const visited = new Set();
    const queue = [startId];

    while (queue.length > 0) {
      const currId = queue.shift();
      if (visited.has(currId)) continue;
      visited.add(currId);

      const p = treeData.find(x => x.id === currId);
      if (!p) continue;

      if (p.pids) {
        p.pids.forEach(pid => {
          if (!visited.has(pid)) queue.push(pid);
        });
      }

      treeData.forEach(child => {
        if ((child.fid === currId || child.mid === currId) && !visited.has(child.id)) {
          queue.push(child.id);
        }
      });
    }

    return visited;
  }

  // Agrupar raíces (evitando duplicar parejas de raíces como Simón y Teresa o Carlos y Bibiana)
  const processedRoots = new Set();
  const branches = [];

  candidateRoots.forEach(root => {
    if (processedRoots.has(root.id)) return;
    processedRoots.add(root.id);

    let partner = null;
    if (root.pids && root.pids.length > 0) {
      partner = treeData.find(p => p.id === root.pids[0] && !p.fid && !p.mid);
      if (partner) processedRoots.add(partner.id);
    }

    const reachableNodes = getReachableNodes(root.id);

    // Solo considerar como rama si tiene descendientes o al menos 2 personas alcanzables
    if (reachableNodes.size < 2 && candidateRoots.length > 2) {
      return;
    }

    // Nombre representativo y noble
    let branchTitle = "";
    let shortTitle = "";
    if (partner) {
      const rootSurname = getFirstSurname(root.name);
      const partnerSurname = getFirstSurname(partner.name);
      const rootFirst = root.name.split(" ")[0];
      const partnerFirst = partner.name.split(" ")[0];

      if (rootSurname && partnerSurname && rootSurname !== partnerSurname) {
        branchTitle = `Rama ${rootSurname} ${partnerSurname} (${rootFirst} y ${partnerFirst})`;
        shortTitle = `Rama ${rootSurname} ${partnerSurname}`;
      } else {
        branchTitle = `Rama ${rootFirst} y ${partnerFirst}`;
        shortTitle = `Rama ${rootFirst} y ${partnerFirst}`;
      }
    } else {
      branchTitle = `Rama ${root.name}`;
      shortTitle = root.name;
    }

    branches.push({
      id: root.id,
      name: branchTitle,
      shortName: shortTitle,
      membersCount: reachableNodes.size,
      nodeIds: reachableNodes,
      rootPerson: root,
      partnerPerson: partner
    });
  });

  // Si no se encontró ninguna rama con >= 2 miembros, usar la primera raíz directa
  if (branches.length === 0 && candidateRoots.length > 0) {
    branches.push({
      id: candidateRoots[0].id,
      name: `Rama ${candidateRoots[0].name}`,
      shortName: candidateRoots[0].name,
      membersCount: treeData.length,
      nodeIds: new Set(treeData.map(p => p.id))
    });
  }

  // Ordenar de mayor a menor número de miembros
  branches.sort((a, b) => b.membersCount - a.membersCount);

  return branches;
}

/**
 * Calcula todas las raíces ancestrales del árbol para desplegar todas las ramas a la vez
 */
function getAllTreeRoots(treeData) {
  if (!treeData || treeData.length === 0) return [];

  const nodeMap = new Map();
  treeData.forEach(p => nodeMap.set(p.id, p));

  const candidateRoots = treeData.filter(p => {
    if (p.fid || p.mid) return false;
    if (p.pids && p.pids.length > 0) {
      const partner = nodeMap.get(p.pids[0]);
      if (partner && (partner.fid || partner.mid)) {
        return false;
      }
    }
    return true;
  });

  if (candidateRoots.length === 0) {
    return [treeData[0].id];
  }

  const roots = [];
  const processed = new Set();

  candidateRoots.forEach(r => {
    if (processed.has(r.id)) return;
    processed.add(r.id);
    if (r.pids && r.pids.length > 0) {
      processed.add(r.pids[0]);
    }
    roots.push(r.id);
  });

  return roots;
}

/**
 * Llena el selector de ramas en el header y sincroniza el estado
 */
function populateBranchSelector(treeData) {
  const branchContainer = document.getElementById("branch-selector-container");
  const branchSelect = document.getElementById("branch-select");
  if (!branchSelect || !branchContainer) return;

  const branches = getAvailableBranches(treeData);
  const total = treeData.length;

  branchContainer.style.display = "inline-flex";
  branchSelect.innerHTML = "";

  // Opción 1: Todas las ramas (por defecto)
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = `Todas las ramas (${total})`;
  if (!AppState.currentRootId || AppState.currentRootId === "all") {
    allOpt.selected = true;
  }
  branchSelect.appendChild(allOpt);

  branches.forEach(branch => {
    const opt = document.createElement("option");
    opt.value = branch.id.toString();
    opt.textContent = `${branch.shortName} (${branch.membersCount})`;
    if (AppState.currentRootId === branch.id.toString()) {
      opt.selected = true;
    }
    branchSelect.appendChild(opt);
  });

  if (!AppState.currentRootId) {
    AppState.currentRootId = "all";
  }
  branchSelect.value = AppState.currentRootId.toString();

  updateHeaderSummary();
}

/**
 * Cambia la visualización a una rama específica o al árbol completo
 */
function switchTreeBranch(rootId, focusPersonId = null) {
  AppState.currentRootId = rootId.toString();
  
  const branchSelect = document.getElementById("branch-select");
  if (branchSelect && branchSelect.value !== rootId.toString()) {
    branchSelect.value = rootId.toString();
  }

  initTreeVisualization();

  if (focusPersonId) {
    setTimeout(() => {
      if (AppState.treeInstance && typeof AppState.treeInstance.center === "function") {
        AppState.treeInstance.center(focusPersonId);
      }
      openPersonDrawer(focusPersonId);
    }, 220);
  }
}

/**
 * Navega a una persona en el árbol genealógico, cambiando automáticamente de rama si es necesario
 */
function navigateToPerson(personId) {
  const targetId = parseInt(personId, 10);
  if (isNaN(targetId)) return;

  // Si estamos en la vista de todas las ramas ("all"), centrar directamente
  if (!AppState.currentRootId || AppState.currentRootId === "all") {
    if (AppState.treeInstance && typeof AppState.treeInstance.center === "function") {
      AppState.treeInstance.center(targetId);
    }
    openPersonDrawer(targetId);
    return;
  }

  const branches = getAvailableBranches(AppState.treeData);
  const currentBranch = branches.find(b => b.id.toString() === AppState.currentRootId.toString());

  if (currentBranch && currentBranch.nodeIds.has(targetId)) {
    if (AppState.treeInstance && typeof AppState.treeInstance.center === "function") {
      AppState.treeInstance.center(targetId);
    }
    openPersonDrawer(targetId);
    return;
  }

  const targetBranch = branches.find(b => b.nodeIds.has(targetId));
  if (targetBranch) {
    switchTreeBranch(targetBranch.id, targetId);
  } else {
    openPersonDrawer(targetId);
  }
}

/**
 * Determina la raíz o raíces óptimas para asegurar que el árbol esté siempre
 * desplegado al máximo abarcando todas las generaciones y ramas familiares.
 */
function getBestTreeRoot(treeData) {
  if (!treeData || treeData.length === 0) return undefined;

  if (AppState.currentRootId && AppState.currentRootId !== "all") {
    const idNum = parseInt(AppState.currentRootId, 10);
    if (!isNaN(idNum)) {
      return [idNum];
    }
  }

  // Por defecto: Desplegar todas las ramas completas simultáneamente
  return getAllTreeRoots(treeData);
}

function updateHeaderSummary() {
  const summaryEl = document.getElementById("header-tree-summary");
  if (summaryEl) {
    const total = AppState.treeData.length;
    const branches = getAvailableBranches(AppState.treeData);
    
    if (AppState.currentRootId && AppState.currentRootId !== "all") {
      const currentBranch = branches.find(b => b.id.toString() === AppState.currentRootId.toString());
      if (currentBranch) {
        summaryEl.textContent = `${total} familiares · Vista: ${currentBranch.shortName}`;
        return;
      }
    }
    summaryEl.textContent = `Árbol Completo · ${total} familiares (todas las ramas desplegadas)`;
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

    // Completar segundo progenitor si uno de ellos está casado y el hijo no tiene asignado el otro
    if (p.fid && !p.mid) {
      const father = personMap.get(p.fid);
      if (father && father.pids && father.pids.length > 0 && personMap.has(father.pids[0])) {
        const potentialMother = personMap.get(father.pids[0]);
        if (potentialMother && potentialMother.gender === "female") {
          p.mid = potentialMother.id;
        }
      }
    }
    if (p.mid && !p.fid) {
      const mother = personMap.get(p.mid);
      if (mother && mother.pids && mother.pids.length > 0 && personMap.has(mother.pids[0])) {
        const potentialFather = personMap.get(mother.pids[0]);
        if (potentialFather && potentialFather.gender !== "female") {
          p.fid = potentialFather.id;
        }
      }
    }
  });

  // Asegurar simetría mutua en todas las parejas sin borrar pids
  data.forEach(p => {
    if (p.pids && p.pids.length > 0) {
      const partnerId = p.pids[0];
      const partner = personMap.get(partnerId);
      if (partner) {
        if (!Array.isArray(partner.pids)) partner.pids = [];
        if (!partner.pids.includes(p.id)) {
          partner.pids.unshift(p.id);
        }
        if (partner.pids.length > 1) {
          partner.pids = [partner.pids[0]];
        }
      } else {
        p.pids = [];
      }
    }
  });

  return data;
}

/**
 * Calcula la profundidad generacional de cada familiar en el árbol genealógico.
 * Raíces ancestrales (sin padres) = Gen 0.
 * Hijos = Gen de progenitores + 1.
 * Cónyuges = Se sincronizan a la misma generación máxima de la pareja.
 */
function calculateGenerations(treeList) {
  if (!Array.isArray(treeList) || treeList.length === 0) return new Map();
  const pMap = new Map();
  treeList.forEach(p => pMap.set(p.id, p));

  const genMap = new Map();
  function getPersonGen(id, visited = new Set()) {
    if (visited.has(id)) return 0;
    visited.add(id);
    if (genMap.has(id)) return genMap.get(id);

    const person = pMap.get(id);
    if (!person) return 0;

    let maxParentGen = -1;
    if (person.fid && pMap.has(person.fid)) {
      maxParentGen = Math.max(maxParentGen, getPersonGen(person.fid, new Set(visited)));
    }
    if (person.mid && pMap.has(person.mid)) {
      maxParentGen = Math.max(maxParentGen, getPersonGen(person.mid, new Set(visited)));
    }

    const gen = (maxParentGen >= 0) ? maxParentGen + 1 : 0;
    genMap.set(id, gen);
    return gen;
  }

  treeList.forEach(p => getPersonGen(p.id));

  // Sincronización bidireccional entre cónyuges para que compartan siempre la misma generación
  for (let i = 0; i < 3; i++) {
    treeList.forEach(p => {
      let partnerId = null;
      if (p.pids && p.pids.length > 0) {
        partnerId = p.pids[0];
      } else {
        const spouse = treeList.find(x => x.pids && x.pids.includes(p.id));
        if (spouse) partnerId = spouse.id;
      }

      if (partnerId) {
        const g1 = genMap.get(p.id) || 0;
        const g2 = genMap.get(partnerId) || 0;
        const maxG = Math.max(g1, g2);
        genMap.set(p.id, maxG);
        genMap.set(partnerId, maxG);
      }
    });
  }

  return genMap;
}

/**
 * Asegura que todos los municipios muestren su provincia entre paréntesis al lado.
 */
function formatLocationWithProvince(loc) {
  if (!loc) return "";
  let trimmed = loc.trim();
  if (!trimmed) return "";
  if (trimmed.includes("(") || trimmed.includes("/")) return trimmed;
  if (typeof allSpanishMunicipalities !== "undefined" && allSpanishMunicipalities.length > 0) {
    const norm = trimmed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const match = allSpanishMunicipalities.find(m => m.normCity === norm);
    if (match) {
      return `${match.city} (${match.province})`;
    }
  }
  return `${trimmed} (${trimmed})`;
}

// ==========================================================================
// 3. MOTOR GENEALÓGICO NATIVO Y DEFINITIVO (MontesTreeEngine)
// ==========================================================================

class MontesTreeEngine {
  constructor(container, treeData, options = {}) {
    this.container = container;
    this.treeData = treeData || [];
    this.options = options;
    this.cardW = 270;
    this.cardH = 130;
    this.partnerGap = 24;
    this.siblingGap = 35;
    this.familyGap = 70;
    this.levelGap = 70;
    this.step = this.cardH + this.levelGap; // 200px
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.positions = new Map();
    this.couples = [];
    this.childGroups = [];
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.initDOM();
    this.layout();
    this.render();
    this.fit();
    this.setupInteractions();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="tree-world" id="montes-tree-world">
        <svg class="tree-connectors-svg" id="montes-tree-connectors"></svg>
        <div class="tree-cards-layer" id="montes-tree-cards"></div>
      </div>
    `;
    this.world = document.getElementById("montes-tree-world");
    this.svg = document.getElementById("montes-tree-connectors");
    this.cardsLayer = document.getElementById("montes-tree-cards");
  }

  layout() {
    this.positions.clear();
    this.couples = [];
    this.childGroups = [];

    const isHorizontal = (AppState.treeOrientation === "left");
    const pMap = new Map();
    this.treeData.forEach(p => pMap.set(p.id, p));

    // Filtrar personas si hay una rama específica seleccionada
    let visibleData = this.treeData;
    if (AppState.currentRootId && AppState.currentRootId !== "all") {
      const branches = getAvailableBranches(this.treeData);
      const currentBranch = branches.find(b => b.id.toString() === AppState.currentRootId.toString());
      if (currentBranch && currentBranch.nodeIds) {
        visibleData = this.treeData.filter(p => currentBranch.nodeIds.has(p.id));
      }
    }

    const genMap = calculateGenerations(this.treeData);

    // Identificar parejas
    const processedCouples = new Set();
    visibleData.forEach(p => {
      if (p.pids && p.pids.length > 0) {
        const partnerId = p.pids[0];
        const partner = pMap.get(partnerId);
        if (partner && visibleData.some(m => m.id === partnerId)) {
          const key = Math.min(p.id, partner.id) + "_" + Math.max(p.id, partner.id);
          if (!processedCouples.has(key)) {
            processedCouples.add(key);
            const pHasParents = (p.fid || p.mid);
            const partnerHasParents = (partner.fid || partner.mid);
            if (partnerHasParents && !pHasParents) {
              this.couples.push({ p1: partner, p2: p });
            } else if (pHasParents && !partnerHasParents) {
              this.couples.push({ p1: p, p2: partner });
            } else if (p.gender === "female" && partner.gender === "male") {
              this.couples.push({ p1: partner, p2: p });
            } else {
              this.couples.push({ p1: p, p2: partner });
            }
          }
        }
      }
    });

    // Agrupar personas visibles por nivel de generación
    const genGroups = new Map();
    visibleData.forEach(p => {
      const g = genMap.get(p.id) || 0;
      if (!genGroups.has(g)) genGroups.set(g, []);
      genGroups.get(g).push(p);
    });

    const sortedGens = [...genGroups.keys()].sort((a, b) => a - b);

    // Disposición generacional ordenada y matemática
    sortedGens.forEach(g => {
      const members = genGroups.get(g);
      if (!members || members.length === 0) return;

      const genCouples = [];
      const genSingles = [];
      const placed = new Set();

      this.couples.forEach(c => {
        if (members.some(m => m.id === c.p1.id) && members.some(m => m.id === c.p2.id)) {
          genCouples.push(c);
          placed.add(c.p1.id);
          placed.add(c.p2.id);
        }
      });

      members.forEach(p => {
        if (!placed.has(p.id)) {
          genSingles.push(p);
          placed.add(p.id);
        }
      });

      const rowUnits = [];
      genCouples.forEach(c => rowUnits.push({ type: "couple", data: c }));
      genSingles.forEach(s => rowUnits.push({ type: "single", data: s }));

      // Calcular punto de anclaje inicial de la fila
      let startX = 50;
      if (g > 0 && rowUnits.length > 0) {
        const first = rowUnits[0].type === "couple" ? rowUnits[0].data.p1 : rowUnits[0].data;
        if (first.fid && first.mid && this.positions.has(first.fid) && this.positions.has(first.mid)) {
          const p1Pos = this.positions.get(first.fid);
          const p2Pos = this.positions.get(first.mid);
          const parentMid = (Math.min(p1Pos.x, p2Pos.x) + Math.max(p1Pos.x, p2Pos.x) + this.cardW) / 2;
          const unitW = rowUnits[0].type === "couple" ? (this.cardW * 2 + this.partnerGap) : this.cardW;
          startX = Math.max(50, parentMid - (unitW / 2));
        } else if (first.fid && this.positions.has(first.fid)) {
          startX = Math.max(50, this.positions.get(first.fid).x);
        } else if (first.mid && this.positions.has(first.mid)) {
          startX = Math.max(50, this.positions.get(first.mid).x);
        }
      }

      let currentX = startX;
      const targetY = 50 + g * this.step;

      rowUnits.forEach((unit, idx) => {
        if (idx > 0) {
          const prevUnit = rowUnits[idx - 1];
          const isSibling = (unit.type === "single" && prevUnit.type === "couple" && unit.data.fid === prevUnit.data.p2.fid) ||
                            (unit.type === "single" && prevUnit.type === "single" && unit.data.fid && unit.data.fid === prevUnit.data.fid);
          currentX += isSibling ? this.siblingGap : this.familyGap;
        }

        if (unit.type === "couple") {
          const p1 = unit.data.p1;
          const p2 = unit.data.p2;
          this.positions.set(p1.id, { x: currentX, y: targetY });
          currentX += this.cardW + this.partnerGap;
          this.positions.set(p2.id, { x: currentX, y: targetY });
          currentX += this.cardW;
        } else {
          const p = unit.data;
          this.positions.set(p.id, { x: currentX, y: targetY });
          currentX += this.cardW;
        }
      });
    });

    // En orientación horizontal, rotar 90 grados
    if (isHorizontal) {
      this.positions.forEach(pos => {
        const oldX = pos.x;
        const oldY = pos.y;
        pos.x = oldY * 1.5;
        pos.y = oldX;
      });
    }

    // Identificar grupos de hijos por matrimonio o progenitor
    const childMap = new Map();
    visibleData.forEach(p => {
      if (p.fid && p.mid) {
        const key = Math.min(p.fid, p.mid) + "_" + Math.max(p.fid, p.mid);
        if (!childMap.has(key)) childMap.set(key, { pids: [p.fid, p.mid], children: [] });
        childMap.get(key).children.push(p.id);
      } else if (p.fid) {
        const key = "single_" + p.fid;
        if (!childMap.has(key)) childMap.set(key, { pids: [p.fid], children: [] });
        childMap.get(key).children.push(p.id);
      } else if (p.mid) {
        const key = "single_" + p.mid;
        if (!childMap.has(key)) childMap.set(key, { pids: [p.mid], children: [] });
        childMap.get(key).children.push(p.id);
      }
    });

    this.childGroups = [...childMap.values()];
  }

  render() {
    this.cardsLayer.innerHTML = "";
    const isHorizontal = (AppState.treeOrientation === "left");

    // 1. Renderizado de Tarjetas Físicas
    this.treeData.forEach(p => {
      const pos = this.positions.get(p.id);
      if (!pos) return;

      const card = document.createElement("div");
      card.className = `tree-card ${p.gender || "male"}`;
      card.style.left = pos.x + "px";
      card.style.top = pos.y + "px";
      card.setAttribute("data-person-id", p.id);

      const photoUrl = getPersonPhotoUrl(p.photo, p.gender);
      const dates = (p.birth || p.death) ? formatVitalDatesWithAge(p.birth, p.death) : "";
      const birthStr = (p.birth_place && p.birth_place.trim()) ? formatLocationWithProvince(p.birth_place) : "";
      const resStr = (p.city && p.city.trim()) ? formatLocationWithProvince(p.city) : "";
      const hasPartner = (p.pids && p.pids.length > 0) || this.treeData.some(x => x.pids && x.pids.includes(p.id));

      card.innerHTML = `
        <img class="card-photo" src="${photoUrl}" alt="${p.name}" data-action="photo">
        <div class="card-info" data-action="card">
          <div class="card-name" title="${p.name}">${p.name}</div>
          ${dates ? `<div class="card-dates">${dates}</div>` : ""}
          ${birthStr ? `
            <div class="card-meta">
              <svg viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="#b45309"></polygon>
              </svg>
              <span>${birthStr}</span>
            </div>
          ` : ""}
          ${resStr ? `
            <div class="card-meta">
              <svg viewBox="0 0 24 24" fill="#e11d48" stroke="#e11d48" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
              </svg>
              <span>${resStr}</span>
            </div>
          ` : ""}
        </div>
        <div class="btn-add-child" data-action="add-child" data-id="${p.id}" title="Añadir hijo/a">+</div>
        ${!hasPartner ? `<div class="btn-add-partner" data-action="add-partner" data-id="${p.id}" title="Añadir pareja / cónyuge">+</div>` : ""}
      `;

      card.addEventListener("click", (e) => {
        const actionEl = e.target.closest("[data-action]");
        const action = actionEl ? actionEl.getAttribute("data-action") : "card";

        if (action === "add-child") {
          e.stopPropagation();
          openAddChildModal(p.id);
          return;
        }
        if (action === "add-partner") {
          e.stopPropagation();
          openAddPartnerModal(p.id);
          return;
        }
        if (action === "photo") {
          e.stopPropagation();
          openPhotoLightboxById(p.id);
          return;
        }
        openPersonDrawer(p.id);
      });

      this.cardsLayer.appendChild(card);
    });

    // 2. Conectores Genealógicos Ortogonales en SVG
    let svgHtml = "";

    if (!isHorizontal) {
      // Líneas de Matrimonio
      this.couples.forEach(c => {
        const pos1 = this.positions.get(c.p1.id);
        const pos2 = this.positions.get(c.p2.id);
        if (!pos1 || !pos2) return;

        const leftX = Math.min(pos1.x, pos2.x) + this.cardW;
        const rightX = Math.max(pos1.x, pos2.x);
        const y = pos1.y + this.cardH / 2;

        svgHtml += `<line x1="${leftX}" y1="${y}" x2="${rightX}" y2="${y}" class="marriage-line" />`;
        const midX = (leftX + rightX) / 2;
        svgHtml += `<circle cx="${midX}" cy="${y}" r="4.5" class="marriage-badge" />`;
      });

      // Líneas hacia Hijos
      this.childGroups.forEach(group => {
        const childPositions = group.children.map(id => this.positions.get(id)).filter(Boolean);
        if (childPositions.length === 0) return;

        let sourceX, sourceY;
        if (group.pids.length === 2) {
          const p1 = this.positions.get(group.pids[0]);
          const p2 = this.positions.get(group.pids[1]);
          if (!p1 || !p2) return;
          sourceX = (Math.min(p1.x, p2.x) + this.cardW + Math.max(p1.x, p2.x)) / 2;
          sourceY = p1.y + this.cardH / 2;
        } else {
          const p = this.positions.get(group.pids[0]);
          if (!p) return;
          sourceX = p.x + this.cardW / 2;
          sourceY = p.y + this.cardH;
        }

        const busY = sourceY + (this.cardH / 2) + (this.levelGap / 2);
        svgHtml += `<path d="M ${sourceX} ${sourceY} V ${busY}" class="connector-line" />`;

        const childCenterXs = childPositions.map(pos => pos.x + this.cardW / 2);
        const minX = Math.min(sourceX, ...childCenterXs);
        const maxX = Math.max(sourceX, ...childCenterXs);

        svgHtml += `<line x1="${minX}" y1="${busY}" x2="${maxX}" y2="${busY}" class="connector-line" />`;

        childPositions.forEach(pos => {
          const cx = pos.x + this.cardW / 2;
          svgHtml += `<path d="M ${cx} ${busY} V ${pos.y}" class="connector-line" />`;
        });
      });
    } else {
      // Líneas en orientación horizontal (izquierda -> derecha)
      this.couples.forEach(c => {
        const pos1 = this.positions.get(c.p1.id);
        const pos2 = this.positions.get(c.p2.id);
        if (!pos1 || !pos2) return;

        const topY = Math.min(pos1.y, pos2.y) + this.cardH;
        const botY = Math.max(pos1.y, pos2.y);
        const x = pos1.x + this.cardW / 2;

        svgHtml += `<line x1="${x}" y1="${topY}" x2="${x}" y2="${botY}" class="marriage-line" />`;
        const midY = (topY + botY) / 2;
        svgHtml += `<circle cx="${x}" cy="${midY}" r="4.5" class="marriage-badge" />`;
      });

      this.childGroups.forEach(group => {
        const childPositions = group.children.map(id => this.positions.get(id)).filter(Boolean);
        if (childPositions.length === 0) return;

        let sourceX, sourceY;
        if (group.pids.length === 2) {
          const p1 = this.positions.get(group.pids[0]);
          const p2 = this.positions.get(group.pids[1]);
          if (!p1 || !p2) return;
          sourceX = p1.x + this.cardW / 2;
          sourceY = (Math.min(p1.y, p2.y) + this.cardH + Math.max(p1.y, p2.y)) / 2;
        } else {
          const p = this.positions.get(group.pids[0]);
          if (!p) return;
          sourceX = p.x + this.cardW;
          sourceY = p.y + this.cardH / 2;
        }

        const busX = sourceX + (this.cardW / 2) + 35;
        svgHtml += `<path d="M ${sourceX} ${sourceY} H ${busX}" class="connector-line" />`;

        const childCenterYs = childPositions.map(pos => pos.y + this.cardH / 2);
        const minY = Math.min(sourceY, ...childCenterYs);
        const maxY = Math.max(sourceY, ...childCenterYs);

        svgHtml += `<line x1="${busX}" y1="${minY}" x2="${busX}" y2="${maxY}" class="connector-line" />`;

        childPositions.forEach(pos => {
          const cy = pos.y + this.cardH / 2;
          svgHtml += `<path d="M ${busX} ${cy} H ${pos.x}" class="connector-line" />`;
        });
      });
    }

    this.svg.innerHTML = svgHtml;
  }

  applyTransform() {
    if (this.world) {
      this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
  }

  fit() {
    if (this.positions.size === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.positions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + this.cardW);
      maxY = Math.max(maxY, pos.y + this.cardH);
    });

    const pad = 60;
    const treeW = (maxX - minX) + pad * 2;
    const treeH = (maxY - minY) + pad * 2;
    const containerW = this.container.clientWidth || window.innerWidth;
    const containerH = this.container.clientHeight || (window.innerHeight - 64);

    const scaleX = containerW / treeW;
    const scaleY = containerH / treeH;
    this.scale = Math.min(0.95, Math.min(scaleX, scaleY));

    this.panX = (containerW - (maxX + minX) * this.scale) / 2;
    this.panY = (containerH - (maxY + minY) * this.scale) / 2;

    this.applyTransform();
  }

  center(personId) {
    const idNum = parseInt(personId, 10);
    const pos = this.positions.get(idNum);
    if (!pos) return;

    const containerW = this.container.clientWidth || window.innerWidth;
    const containerH = this.container.clientHeight || (window.innerHeight - 64);
    const targetScale = Math.max(this.scale, 0.85);

    const targetPanX = (containerW / 2) - (pos.x + this.cardW / 2) * targetScale;
    const targetPanY = (containerH / 2) - (pos.y + this.cardH / 2) * targetScale;

    const startPanX = this.panX;
    const startPanY = this.panY;
    const startScale = this.scale;
    const startTime = performance.now();
    const duration = 280;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = progress * (2 - progress);

      this.panX = startPanX + (targetPanX - startPanX) * ease;
      this.panY = startPanY + (targetPanY - startPanY) * ease;
      this.scale = startScale + (targetScale - startScale) * ease;
      this.applyTransform();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  zoom(inOut) {
    const factor = inOut ? 1.25 : 0.8;
    const newScale = Math.min(2.5, Math.max(0.15, this.scale * factor));
    const cx = (this.container.clientWidth || window.innerWidth) / 2;
    const cy = (this.container.clientHeight || window.innerHeight) / 2;

    this.panX = cx - (cx - this.panX) * (newScale / this.scale);
    this.panY = cy - (cy - this.panY) * (newScale / this.scale);
    this.scale = newScale;

    this.applyTransform();
  }

  draw() {
    this.layout();
    this.render();
  }

  onNodeClick(handler) {
    this.onNodeClickHandler = handler;
  }

  setupInteractions() {
    let isDown = false;
    let startX, startY;

    this.container.addEventListener("mousedown", (e) => {
      if (e.target.closest(".tree-card") || e.target.closest(".btn-add-child") || e.target.closest(".btn-add-partner")) return;
      isDown = true;
      startX = e.clientX - this.panX;
      startY = e.clientY - this.panY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      this.panX = e.clientX - startX;
      this.panY = e.clientY - startY;
      this.applyTransform();
    });

    window.addEventListener("mouseup", () => {
      isDown = false;
    });

    this.container.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(2.5, Math.max(0.15, this.scale * zoomFactor));

      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
      this.scale = newScale;

      this.applyTransform();
    }, { passive: false });
  }
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

  container.innerHTML = "";

  if (!AppState.treeData || AppState.treeData.length === 0) {
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

  // Sanear datos y selector de ramas
  cleanAndValidateTreeData(AppState.treeData);
  populateBranchSelector(AppState.treeData);

  // Sincronizar selectores en la cabecera
  const orientSelect = document.getElementById("tree-orientation-select");
  if (orientSelect && orientSelect.value !== AppState.treeOrientation) {
    orientSelect.value = AppState.treeOrientation;
  }
  const layoutSelect = document.getElementById("tree-layout-select");
  if (layoutSelect && layoutSelect.value !== AppState.treeLayout) {
    layoutSelect.value = AppState.treeLayout;
  }

  // Inicializar MontesTreeEngine nativo
  AppState.treeInstance = new MontesTreeEngine(container, AppState.treeData);
  AppState.lastValidTreeData = JSON.parse(JSON.stringify(AppState.treeData));
  updateHeaderSummary();
}



function formatPersonNameLines(fullName) {
  if (!fullName) return { line1: "", line2: "" };
  const trimmed = fullName.trim();
  
  // Con 270px de caja, los nombres de hasta 26 caracteres caben perfectamente en 1 sola línea:
  // "Aurelia Carrera Rodríguez" (25 chars), "Atanasio Montes Carrera" (23 chars), "Manuel Montes Posado" (20 chars)
  if (trimmed.length <= 26) {
    return { line1: trimmed, line2: "" };
  }

  // Agrupar partículas y preposiciones españolas compuestas ("de", "del", "de la", "de los", "de las", "san", "santa", "y")
  // con la palabra que les sigue para no romper nunca expresiones como "de los Reyes", "del Carmen", "de la Vega"
  const rawWords = trimmed.split(/\s+/);
  const units = [];
  const connectors = new Set(["de", "del", "de la", "de los", "de las", "y", "san", "santa"]);

  let i = 0;
  while (i < rawWords.length) {
    if (i + 2 < rawWords.length && rawWords[i].toLowerCase() === "de" && ["la", "los", "las"].includes(rawWords[i + 1].toLowerCase())) {
      units.push(`${rawWords[i]} ${rawWords[i + 1]} ${rawWords[i + 2]}`);
      i += 3;
    } else if (i + 1 < rawWords.length && connectors.has(rawWords[i].toLowerCase())) {
      units.push(`${rawWords[i]} ${rawWords[i + 1]}`);
      i += 2;
    } else {
      units.push(rawWords[i]);
      i++;
    }
  }

  // Buscar el punto de corte óptimo que respete los apellidos y partículas
  // Probar de derecha a izquierda para maximizar la línea 1 dentro del límite (<= 24 caracteres)
  for (let splitIdx = units.length - 1; splitIdx >= 1; splitIdx--) {
    const l1 = units.slice(0, splitIdx).join(" ");
    const l2 = units.slice(splitIdx).join(" ");
    if (l1.length <= 24 && l2.length <= 26) {
      return { line1: l1, line2: l2 };
    }
  }

  for (let splitIdx = units.length - 1; splitIdx >= 1; splitIdx--) {
    const l1 = units.slice(0, splitIdx).join(" ");
    const l2 = units.slice(splitIdx).join(" ");
    if (l1.length <= 26) {
      return { line1: l1, line2: l2 };
    }
  }

  const mid = Math.ceil(rawWords.length / 2);
  return {
    line1: rawWords.slice(0, mid).join(" "),
    line2: rawWords.slice(mid).join(" ")
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
    if (f) {
      parentRows.push(`
        <div class="drawer-rel-row linkable" onclick="navigateToPerson(${f.id})" title="Ver a ${f.name} en el árbol">
          <strong>Padre:</strong>
          <span class="person-jump-link">${f.name} <i data-lucide="external-link" style="width: 12px; height: 12px;"></i></span>
        </div>
      `);
    }
  }
  if (person.mid) {
    const m = AppState.treeData.find(p => p.id === person.mid);
    if (m) {
      parentRows.push(`
        <div class="drawer-rel-row linkable" onclick="navigateToPerson(${m.id})" title="Ver a ${m.name} en el árbol">
          <strong>Madre:</strong>
          <span class="person-jump-link">${m.name} <i data-lucide="external-link" style="width: 12px; height: 12px;"></i></span>
        </div>
      `);
    }
  }
  if (parentRows.length > 0) {
    categories.push(`
      <div class="drawer-rel-category">
        ${parentRows.join("")}
      </div>
    `);
  }

  // 2. Categoría: Cónyuge
  const partnerObj = getPersonPartner(person);
  if (partnerObj) {
    categories.push(`
      <div class="drawer-rel-category">
        <div class="drawer-rel-row linkable" onclick="navigateToPerson(${partnerObj.id})" title="Ver a ${partnerObj.name} en el árbol">
          <strong>Cónyuge:</strong>
          <span class="person-jump-link">${partnerObj.name} <i data-lucide="external-link" style="width: 12px; height: 12px;"></i></span>
        </div>
      </div>
    `);
  }

  // 3. Categoría: Hermanos (lista en filas separadas)
  const siblings = AppState.treeData
    .filter(p => p.id !== person.id && ((person.fid && p.fid === person.fid) || (person.mid && p.mid === person.mid)));
  if (siblings.length > 0) {
    categories.push(`
      <div class="drawer-rel-category">
        <div class="drawer-rel-row"><strong>Hermanos (${siblings.length}):</strong></div>
        <ul class="drawer-rel-list">
          ${siblings.map(sib => `
            <li class="linkable" onclick="navigateToPerson(${sib.id})" title="Ver a ${sib.name} en el árbol">
              <span class="person-jump-link">${sib.name} <i data-lucide="external-link" style="width: 11px; height: 11px;"></i></span>
            </li>
          `).join("")}
        </ul>
      </div>
    `);
  }

  // 4. Categoría: Hijos (lista en filas separadas)
  const children = AppState.treeData
    .filter(p => p.fid === person.id || p.mid === person.id);
  if (children.length > 0) {
    categories.push(`
      <div class="drawer-rel-category">
        <div class="drawer-rel-row"><strong>Hijos (${children.length}):</strong></div>
        <ul class="drawer-rel-list">
          ${children.map(ch => `
            <li class="linkable" onclick="navigateToPerson(${ch.id})" title="Ver a ${ch.name} en el árbol">
              <span class="person-jump-link">${ch.name} <i data-lucide="external-link" style="width: 11px; height: 11px;"></i></span>
            </li>
          `).join("")}
        </ul>
      </div>
    `);
  }

  // 5. Banner de cambio de rama si la persona conecta con otra rama ancestral
  const branches = getAvailableBranches(AppState.treeData);
  const otherBranches = branches.filter(b => b.id !== AppState.currentRootId && b.nodeIds.has(person.id));
  if (otherBranches.length > 0) {
    const ob = otherBranches[0];
    categories.push(`
      <div class="drawer-branch-switch-banner" onclick="switchTreeBranch(${ob.id}, ${person.id})" title="Desplegar toda la ${ob.name}">
        <i data-lucide="git-branch" style="width: 15px; height: 15px; flex-shrink: 0;"></i>
        <span>Desplegar ${ob.shortName}</span>
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
  const initialPid = preselected.pid !== undefined ? preselected.pid : getPersonPartnerId(currentPerson);

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
      const partnerIdOfP = getPersonPartnerId(p);
      if (partnerIdOfP && partnerIdOfP !== excludePersonId) {
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

function openAddRootPersonModal() {
  const form = document.getElementById("form-person");
  form.reset();

  document.getElementById("form-person-id").value = "";
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

function openAddChildModal(parentPersonId) {
  const parent = AppState.treeData.find(p => p.id === parentPersonId);
  if (!parent) return;

  const form = document.getElementById("form-person");
  form.reset();

  document.getElementById("form-person-id").value = "";
  document.getElementById("group-form-links").style.display = "block";
  document.getElementById("form-gender").disabled = false;
  document.getElementById("form-gender").value = "male";
  
  document.getElementById("modal-person-title").querySelector("span").textContent = `Añadir Hijo/a de ${parent.name}`;
  
  const birthPlaceInput = document.getElementById("form-birth-place");
  if (birthPlaceInput) birthPlaceInput.value = "";
  document.getElementById("form-photo").value = "";
  document.getElementById("form-photo-file").value = "";
  document.getElementById("form-photo-preview").src = getDefaultAvatar("male");
  document.getElementById("btn-remove-photo").style.display = "none";

  const suggestionBox = document.getElementById("name-suggestion-box");
  if (suggestionBox) suggestionBox.style.display = "none";

  let initialFid = null;
  let initialMid = null;

  if (parent.gender === "female") {
    initialMid = parent.id;
    if (parent.pids && parent.pids.length > 0) {
      initialFid = parent.pids[0];
    }
  } else {
    initialFid = parent.id;
    if (parent.pids && parent.pids.length > 0) {
      initialMid = parent.pids[0];
    }
  }

  // Poblar selectores de padre, madre y cónyuge con los padres preseleccionados
  populateParentAndPartnerSelectors(null, {
    fid: initialFid,
    mid: initialMid
  });

  openModal("modal-person");
}

function openAddPartnerModal(personId) {
  const person = AppState.treeData.find(p => p.id === personId);
  if (!person) return;

  const form = document.getElementById("form-person");
  form.reset();

  document.getElementById("form-person-id").value = "";
  document.getElementById("group-form-links").style.display = "block";
  document.getElementById("form-gender").disabled = false;
  
  const targetGender = person.gender === "male" ? "female" : "male";
  document.getElementById("form-gender").value = targetGender;
  
  document.getElementById("modal-person-title").querySelector("span").textContent = `Añadir Cónyuge / Pareja de ${person.name}`;
  
  const birthPlaceInput = document.getElementById("form-birth-place");
  if (birthPlaceInput) birthPlaceInput.value = "";
  document.getElementById("form-photo").value = "";
  document.getElementById("form-photo-file").value = "";
  document.getElementById("form-photo-preview").src = getDefaultAvatar(targetGender);
  document.getElementById("btn-remove-photo").style.display = "none";

  const suggestionBox = document.getElementById("name-suggestion-box");
  if (suggestionBox) suggestionBox.style.display = "none";

  // Poblar selectores con la pareja preseleccionada
  populateParentAndPartnerSelectors(null, {
    pid: person.id
  });

  openModal("modal-person");
}

function openEditPersonModal(personId) {
  const person = AppState.treeData.find(p => p.id === personId);
  if (!person) return;

  document.getElementById("form-person-id").value = person.id;
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
    pid: getPersonPartnerId(person) || ""
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

    // Si se crearon vínculos mediante los selectores manuales
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
async function exportTreeLandscapePDF() {
  showToast("Generando PDF del árbol genealógico en alta resolución...", "info", 6000);

  const worldEl = document.getElementById("montes-tree-world") || document.querySelector(".tree-world");
  if (!worldEl) {
    showToast("No se encontró el árbol en pantalla para exportar.", "error");
    return;
  }

  try {
    // 1. Guardar estado de transformación actual
    const prevTransform = worldEl.style.transform;
    const prevTransition = worldEl.style.transition;

    // 2. Calcular límites totales del árbol completo
    const cards = worldEl.querySelectorAll(".tree-card");
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cards.forEach(card => {
      const left = parseFloat(card.style.left) || 0;
      const top = parseFloat(card.style.top) || 0;
      const w = card.offsetWidth || 270;
      const h = card.offsetHeight || 130;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, left + w);
      maxY = Math.max(maxY, top + h);
    });

    if (minX === Infinity) {
      minX = 0; minY = 0; maxX = 2000; maxY = 900;
    }

    const pad = 60;
    const totalW = (maxX - minX) + pad * 2;
    const totalH = (maxY - minY) + pad * 2;

    // 3. Normalizar temporalmente a posición absoluta para captura
    worldEl.style.transition = "none";
    worldEl.style.transform = `translate(${-minX + pad}px, ${-minY + pad}px) scale(1)`;

    // 4. Renderizar con html2canvas si está disponible
    if (typeof html2canvas === "function") {
      const canvas = await html2canvas(worldEl, {
        backgroundColor: "#f8f6f0",
        scale: 2.0,
        width: totalW,
        height: totalH,
        useCORS: true,
        logging: false
      });

      // Restaurar estado visual original del árbol interactivo
      worldEl.style.transform = prevTransform;
      worldEl.style.transition = prevTransition;

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;

        let dinFormat = "a3";
        if (totalW > 2400 || totalH > 1600) {
          dinFormat = "a2";
        }

        const isLandscape = totalW >= totalH;
        const pdf = new jsPDF({
          orientation: isLandscape ? "landscape" : "portrait",
          unit: "mm",
          format: dinFormat
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const marginMm = 12;
        const usableWidth = pageWidth - marginMm * 2;
        const usableHeight = pageHeight - marginMm * 2;

        const scaleFactor = Math.min(usableWidth / totalW, usableHeight / totalH);
        const renderWidth = totalW * scaleFactor;
        const renderHeight = totalH * scaleFactor;

        const posX = marginMm + (usableWidth - renderWidth) / 2;
        const posY = marginMm + (usableHeight - renderHeight) / 2;

        pdf.addImage(imgData, "JPEG", posX, posY, renderWidth, renderHeight);
        pdf.save("arbol_genealogico_familia_montes.pdf");
        showToast("¡PDF del árbol genealógico descargado con éxito!", "success");
        return;
      }
    }

    // Restaurar si no se pudo generar
    worldEl.style.transform = prevTransform;
    worldEl.style.transition = prevTransition;
    showToast("No se encontró la biblioteca jsPDF/html2canvas para la descarga.", "error");
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

    const branches = getAvailableBranches(AppState.treeData);

    searchResults.innerHTML = matches.map(p => {
      const branch = branches.find(b => b.nodeIds.has(p.id));
      const branchTag = (branch && branches.length > 1) 
        ? `<span class="search-branch-tag">${branch.shortName}</span>` 
        : "";
      return `
        <div class="search-item" data-id="${p.id}">
          <img class="search-item-avatar" src="${p.photo || getDefaultAvatar(p.gender)}" alt="${p.name}">
          <div class="search-item-info">
            <div class="search-item-name">${p.name} ${branchTag}</div>
            <div class="search-item-meta">${p.city || ''} ${p.birth ? '· ' + formatVitalDatesWithAge(p.birth, p.death) : ''}</div>
          </div>
        </div>
      `;
    }).join("");

    searchResults.style.display = "block";

    // Clic en resultado de búsqueda: navega directamente y cambia de rama si es necesario
    searchResults.querySelectorAll(".search-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = parseInt(item.dataset.id, 10);
        searchInput.value = "";
        searchResults.style.display = "none";
        navigateToPerson(id);
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
  // Selector de Rama Familiar
  const branchSelect = document.getElementById("branch-select");
  if (branchSelect) {
    branchSelect.addEventListener("change", (e) => {
      switchTreeBranch(e.target.value);
    });
  }

  // Selector de Orientación de Vista
  const orientSelect = document.getElementById("tree-orientation-select");
  if (orientSelect) {
    orientSelect.addEventListener("change", (e) => {
      AppState.treeOrientation = e.target.value;
      localStorage.setItem("montes_tree_orientation", e.target.value);
      initTreeVisualization();
    });
  }

  // Selector de Distribución de Hijos / Hermanos
  const layoutSelect = document.getElementById("tree-layout-select");
  if (layoutSelect) {
    layoutSelect.addEventListener("change", (e) => {
      AppState.treeLayout = e.target.value;
      localStorage.setItem("montes_tree_layout", e.target.value);
      initTreeVisualization();
    });
  }

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

