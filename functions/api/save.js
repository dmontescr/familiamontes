/**
 * Cloudflare Pages Function: /api/save
 * 
 * Permite a cualquier familiar autenticado persistir los cambios del árbol genealógico
 * y las fotografías de familiares directamente en el repositorio de GitHub:
 * 1. Sube / actualiza imágenes en la carpeta 'photos/nombre_persona.jpg'.
 * 2. Elimina fotografías antiguas si han sido modificadas o borradas.
 * 3. Realiza commit sobre 'data/tree.json'.
 * 
 * Variables de entorno en Cloudflare Pages:
 * - GITHUB_TOKEN: Personal Access Token (PAT) de GitHub con permiso repo / contents:write.
 * - GITHUB_OWNER: "dmontescr" (opcional, por defecto "dmontescr")
 * - GITHUB_REPO: "familiamontes" (opcional, por defecto "familiamontes")
 * - GITHUB_BRANCH: "main" (opcional, por defecto "main")
 */

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

// Endpoint de diagnóstico GET /api/save para verificar conectividad con GitHub
export async function onRequestGet(context) {
  const { env } = context;
  const token = (env.GITHUB_TOKEN || "").trim();
  const owner = (env.GITHUB_OWNER || "dmontescr").trim();
  const repo = (env.GITHUB_REPO || "familiamontes").trim();
  const branch = (env.GITHUB_BRANCH || "main").trim();

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  };

  if (!token) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Falta GITHUB_TOKEN en las variables de entorno de Cloudflare Pages.",
        hint: "Añade GITHUB_TOKEN en Cloudflare > Configuración > Variables y secretos."
      }),
      { status: 200, headers }
    );
  }

  try {
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "FamiliaMontes-App/1.0"
      }
    });

    const data = await checkRes.json();
    if (checkRes.ok) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Conexión con GitHub verificada con éxito.",
          repo: data.full_name,
          permissions: data.permissions,
          branch
        }),
        { status: 200, headers }
      );
    } else {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "GitHub rechazó la autenticación.",
          details: data.message || data
        }),
        { status: 200, headers }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Excepción al conectar con GitHub.",
        details: err.message
      }),
      { status: 200, headers }
    );
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    const token = (env.GITHUB_TOKEN || "").trim();
    const owner = (env.GITHUB_OWNER || "dmontescr").trim();
    const repo = (env.GITHUB_REPO || "familiamontes").trim();
    const branch = (env.GITHUB_BRANCH || "main").trim();

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Falta GITHUB_TOKEN en las variables de entorno de Cloudflare Pages.",
          details: "Asegúrate de añadir GITHUB_TOKEN en Cloudflare > Configuración > Variables y secretos."
        }),
        { status: 500, headers }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: "El cuerpo de la petición no es un JSON válido." }),
        { status: 400, headers }
      );
    }

    const treeData = Array.isArray(body) ? body : (body.data || body.tree);
    const photosToUpload = body.photosToUpload || []; // Array de { path: "photos/...", contentBase64: "..." }
    const photosToDelete = body.photosToDelete || []; // Array de "photos/..."

    if (!Array.isArray(treeData) || treeData.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Estructura de datos inválida. Se esperaba un array de familiares no vacío." }),
        { status: 400, headers }
      );
    }

    const defaultGhHeaders = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "FamiliaMontes-App/1.0"
    };

    const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;

    // 1. Eliminar fotos marcadas para borrado en GitHub
    for (const photoPath of photosToDelete) {
      if (!photoPath || !photoPath.startsWith("photos/")) continue;
      try {
        const checkRes = await fetch(`${baseUrl}/${photoPath}?ref=${encodeURIComponent(branch)}`, {
          method: "GET",
          headers: defaultGhHeaders
        });
        if (checkRes.ok) {
          const fileInfo = await checkRes.json();
          await fetch(`${baseUrl}/${photoPath}`, {
            method: "DELETE",
            headers: {
              ...defaultGhHeaders,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              message: `chore(photos): eliminar fotografía obsoleta ${photoPath}`,
              sha: fileInfo.sha,
              branch: branch
            })
          });
        }
      } catch (err) {
        console.warn(`Error al eliminar ${photoPath}:`, err);
      }
    }

    // 2. Subir / Actualizar nuevas fotos en la carpeta 'photos/'
    for (const item of photosToUpload) {
      if (!item.path || !item.contentBase64 || !item.path.startsWith("photos/")) continue;
      try {
        let existingSha = null;
        const checkRes = await fetch(`${baseUrl}/${item.path}?ref=${encodeURIComponent(branch)}`, {
          method: "GET",
          headers: defaultGhHeaders
        });
        if (checkRes.ok) {
          const fileInfo = await checkRes.json();
          existingSha = fileInfo.sha;
        }

        // Limpiar prefijo data:image/...;base64, si viene incluido
        const cleanBase64 = item.contentBase64.replace(/^data:image\/[a-z]+;base64,/, "");

        const putPayload = {
          message: `chore(photos): subir fotografía para ${item.path}`,
          content: cleanBase64,
          branch: branch
        };
        if (existingSha) putPayload.sha = existingSha;

        await fetch(`${baseUrl}/${item.path}`, {
          method: "PUT",
          headers: {
            ...defaultGhHeaders,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(putPayload)
        });
      } catch (err) {
        console.warn(`Error al subir ${item.path}:`, err);
      }
    }

    // 3. Comitear la actualización de 'data/tree.json'
    const treePath = "data/tree.json";
    let treeSha = null;
    const getTreeRes = await fetch(`${baseUrl}/${treePath}?ref=${encodeURIComponent(branch)}`, {
      method: "GET",
      headers: defaultGhHeaders
    });

    if (getTreeRes.ok) {
      const fileData = await getTreeRes.json();
      treeSha = fileData.sha;
    }

    const formattedJson = JSON.stringify(treeData, null, 2);
    // Codificación UTF-8 segura a Base64
    const base64TreeContent = btoa(unescape(encodeURIComponent(formattedJson)));

    const treeCommitPayload = {
      message: `chore(data): actualizar árbol genealógico y fotos [${new Date().toISOString().slice(0, 10)}]`,
      content: base64TreeContent,
      branch: branch
    };
    if (treeSha) treeCommitPayload.sha = treeSha;

    const putTreeRes = await fetch(`${baseUrl}/${treePath}`, {
      method: "PUT",
      headers: {
        ...defaultGhHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(treeCommitPayload)
    });

    if (!putTreeRes.ok) {
      const ghErr = await putTreeRes.json().catch(() => ({ message: "Error desconocido en GitHub" }));
      return new Response(
        JSON.stringify({
          success: false,
          error: "GitHub rechazó el guardado.",
          details: ghErr.message || JSON.stringify(ghErr)
        }),
        { status: putTreeRes.status, headers }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Árbol genealógico y fotografías sincronizados con éxito en GitHub.",
        uploadedPhotosCount: photosToUpload.length,
        deletedPhotosCount: photosToDelete.length
      }),
      { status: 200, headers }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Error interno al sincronizar con GitHub.",
        details: error.message
      }),
      { status: 500, headers }
    );
  }
}
