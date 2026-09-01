/**
 * Cloudflare Pages Function: /api/save
 * 
 * Permite a cualquier familiar autenticado persistir los cambios del árbol genealógico
 * directamente en el repositorio de GitHub realizando un commit sobre 'data/tree.json'.
 * 
 * Variables de entorno requeridas en el panel de Cloudflare Pages:
 * - GITHUB_TOKEN: Personal Access Token (PAT) de GitHub con permiso de lectura/escritura (contents:write).
 * - GITHUB_OWNER: Nombre de usuario u organización de GitHub (ej. "dmontes").
 * - GITHUB_REPO: Nombre del repositorio (ej. "Web-Familia-Montes" o "familia-montes").
 * - GITHUB_BRANCH: (Opcional) Rama objetivo, por defecto "main".
 */

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Encabezados estándar de respuesta JSON
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    // 1. Verificación de variables de entorno
    const token = env.GITHUB_TOKEN;
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || "main";

    if (!token || !owner || !repo) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Faltan variables de entorno en Cloudflare Pages.",
          details: "Asegúrate de configurar GITHUB_TOKEN, GITHUB_OWNER y GITHUB_REPO en Configuración > Variables de entorno de Cloudflare Pages."
        }),
        { status: 500, headers }
      );
    }

    // 2. Parseo del cuerpo de la petición
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: "El cuerpo de la petición no es un JSON válido." }),
        { status: 400, headers }
      );
    }

    // Acepta tanto un array directo de nodos como un objeto { data: [...] }
    const treeData = Array.isArray(body) ? body : (body.data || body.tree);

    if (!Array.isArray(treeData) || treeData.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Estructura de datos inválida. Se esperaba un array de nodos no vacío." }),
        { status: 400, headers }
      );
    }

    const filePath = "data/tree.json";
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const authHeader = `Bearer ${token}`;

    const defaultGhHeaders = {
      "Authorization": authHeader,
      "Accept": "application/vnd.github+json",
      "User-Agent": "FamiliaMontes-CloudflarePages/1.0"
    };

    // 3. Obtener el SHA actual de data/tree.json en GitHub
    let currentSha = null;
    const getFileResponse = await fetch(`${githubApiUrl}?ref=${encodeURIComponent(branch)}`, {
      method: "GET",
      headers: defaultGhHeaders
    });

    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      currentSha = fileData.sha;
    } else if (getFileResponse.status !== 404) {
      const errorText = await getFileResponse.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: `Error al consultar el archivo en GitHub (HTTP ${getFileResponse.status}).`,
          details: errorText
        }),
        { status: getFileResponse.status, headers }
      );
    }

    // 4. Preparar el contenido codificado en Base64 con UTF-8
    const formattedJson = JSON.stringify(treeData, null, 2);
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(formattedJson);
    
    // Conversión segura de bytes binarios a Base64
    let binary = "";
    const len = utf8Bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Content = btoa(binary);

    // 5. Enviar PUT a la API de GitHub para comitear los cambios
    const commitPayload = {
      message: `chore(data): actualización del árbol genealógico Familia Montes [${new Date().toISOString().slice(0, 10)}]`,
      content: base64Content,
      branch: branch
    };

    if (currentSha) {
      commitPayload.sha = currentSha;
    }

    const putResponse = await fetch(githubApiUrl, {
      method: "PUT",
      headers: {
        ...defaultGhHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(commitPayload)
    });

    if (!putResponse.ok) {
      const ghError = await putResponse.json().catch(() => ({ message: "Error desconocido en GitHub" }));
      return new Response(
        JSON.stringify({
          success: false,
          error: "GitHub rechazó el commit.",
          details: ghError.message || ghError
        }),
        { status: putResponse.status, headers }
      );
    }

    const commitResult = await putResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Árbol genealógico guardado y sincronizado con éxito en GitHub.",
        commitSha: commitResult.commit?.sha,
        nodesCount: treeData.length
      }),
      { status: 200, headers }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Error interno del servidor al procesar la sincronización.",
        details: error.message
      }),
      { status: 500, headers }
    );
  }
}
