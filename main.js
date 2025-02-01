/*****************************************************
 *  ========== CONFIGURACIÓN DE FIREBASE ==========
 *****************************************************/
const firebaseConfig = {
  apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
  authDomain: "loginliverpool.firebaseapp.com",
  projectId: "loginliverpool",
  storageBucket: "loginliverpool.appspot.com",
  messagingSenderId: "704223815941",
  appId: "1:704223815941:web:c871525230fb61caf96f6c",
  measurementId: "G-QFEPQ4TSPY",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const storage = firebase.app().storage("gs://loginliverpool.firebasestorage.app");
const db = firebase.firestore();
const auth = firebase.auth();

/*****************************************************
 *  ========== VARIABLES GLOBALES ==========
 *****************************************************/
const AppState = {
  relacionesData: null,         // Data de "relaciones.xlsx"
  usuariosData: [],             // Data de "Usuarios.xlsx"
  allRechazosEnExcel: [],       // Todas las filas de "rechazos.xlsx"
  rechazosGlobal: [],           // Filas filtradas para el usuario
  selectedFileData: null,       // Archivo "rechazos" seleccionado
  isAdmin: false                // Indica si el usuario es admin
};

const ADMIN_UIDS = ["OaieQ6cGi7TnW0nbxvlk2oyLaER2", "doxhVo1D3aYQqqkqgRgfJ4qcKcU2"];

/*****************************************************
 *  ========== FUNCIONES AUXILIARES ==========
 *****************************************************/

/**
 * Muestra un mensaje utilizando SweetAlert2.
 * @param {string} icon - Tipo de ícono ("success", "error", etc.)
 * @param {string} title - Título del mensaje.
 * @param {string} text - Texto descriptivo.
 */
function showAlert(icon, title, text) {
  return Swal.fire({ icon, title, text });
}

/**
 * Configura la interfaz de usuario según el rol del usuario.
 * Muestra/oculta la zona de subida y el botón de descarga.
 * @param {boolean} isAdmin 
 */
function setUIForRole(isAdmin) {
  const dropzone = document.getElementById("dropzone");
  const downloadRechazosBtn = document.getElementById("downloadRechazosBtn");
  dropzone.style.display = isAdmin ? "block" : "none";
  if (downloadRechazosBtn) {
    downloadRechazosBtn.style.display = isAdmin ? "inline-block" : "none";
  }
}

/**
 * Corrige problemas de encoding en cadenas.
 * @param {string} str 
 * @returns {string}
 */
function fixEncoding(str) {
  if (!str) return "";
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

/**
 * Crea y carga dinámicamente la imagen original para un artículo, usando el SKU exacto.
 * Si la imagen no se carga, se muestra en su lugar una imagen “graciosa”.
 * 
 * @param {string} sku - SKU exacto del artículo.
 * @param {string} seccion - La sección del artículo.
 * @param {string} containerId - ID del contenedor donde se insertará la imagen.
 */
function loadDynamicImage(sku, seccion, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // URL de la imagen original
  const imageUrl = `https://ss${seccion}.liverpool.com.mx/xl/${sku}.jpg`;
  
  // URL de la imagen graciosa (puedes cambiarla por otra imagen divertida)
  const funnyImageUrl = "https://michelacosta.com/wp-content/uploads/2017/03/Cristiano-llorando.gif";
  
  // Crear elementos para la imagen y para el mensaje alternativo
  const imgElement = document.createElement("img");
  imgElement.alt = "Imagen del artículo";
  imgElement.className = "img-fluid";
  imgElement.style.maxWidth = "200px";
  imgElement.style.display = "none";

  const fallbackElement = document.createElement("div");
  fallbackElement.className = "no-image";
  fallbackElement.style.display = "none";
  fallbackElement.style.textAlign = "center";
  fallbackElement.style.fontWeight = "bold";
  fallbackElement.style.padding = "10px";
  fallbackElement.style.border = "2px dashed #ff4081";
  fallbackElement.style.color = "#ff4081";
  fallbackElement.style.borderRadius = "10px";

  container.appendChild(imgElement);
  container.appendChild(fallbackElement);

  // Intentar cargar la imagen original
  imgElement.src = imageUrl;
  imgElement.onload = function() {
    // Si la imagen se carga correctamente, se muestra
    this.style.display = "block";
    fallbackElement.style.display = "none";
  };

  imgElement.onerror = function() {
    // Si ocurre un error, se muestra la imagen graciosa
    imgElement.style.display = "none";
    fallbackElement.innerHTML = `
      <div>
        <img src="${funnyImageUrl}" alt="Imagen graciosa" style="max-width: 100px; margin-bottom: 10px;">
        <p>¡Ups! No se encontró la imagen original. ¡Mira esto!</p>
      </div>
    `;
    fallbackElement.style.display = "block";
  };
}

/**
 * Carga el archivo "Usuarios.xlsx" (hoja "Usuarios") y almacena sus datos en AppState.usuariosData.
 */
async function loadUsuariosFile() {
  try {
    const response = await fetch("Usuarios.xlsx");
    if (!response.ok) throw new Error("No se encontró Usuarios.xlsx");
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets["Usuarios"];
      if (!sheet) {
        showAlert("error", "Error", "No existe la hoja 'Usuarios' en Usuarios.xlsx");
        return;
      }
      AppState.usuariosData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    };
    reader.readAsBinaryString(blob);
  } catch (error) {
    console.error("Error al cargar Usuarios.xlsx:", error);
    showAlert("error", "Error", "No se pudo cargar el archivo 'Usuarios.xlsx'");
  }
}

/*****************************************************
 *  ========== EVENTOS DOMContentLoaded ==========
 *****************************************************/
document.addEventListener("DOMContentLoaded", () => {
  // Referencias a elementos del DOM
  const logoutButton = document.getElementById("logout-btn");
  const confirmFileSelection = document.getElementById("confirmFileSelection");
  const dropzone = document.getElementById("dropzone");
  const saveCommentsBtn = document.getElementById("saveCommentsBtn");
  const downloadRechazosBtn = document.getElementById("downloadRechazosBtn");

  // Botón Logout
  logoutButton.addEventListener("click", () => {
    auth.signOut().then(() => {
      window.location.href = "login.html";
    });
  });

  // Botón de confirmar selección de archivo
  confirmFileSelection.addEventListener("click", () => {
    const selectedFileName = document.getElementById("selectedFileName").textContent;
    if (selectedFileName && AppState.selectedFileData) {
      showAlert("success", "Archivo Confirmado", `El archivo seleccionado es: ${selectedFileName}`);
      // Cargar el archivo de relaciones para continuar
      loadRelacionesFile();
    }
  });

  // Botón para guardar comentarios
  saveCommentsBtn.addEventListener("click", saveAllComments);

  // Configuración de dropzone (solo para admin)
  dropzone.addEventListener("click", () => {
    if (!AppState.isAdmin) return;
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".xlsx, .xls";
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      handleFileUpload(file);
    });
    fileInput.click();
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
    if (!AppState.isAdmin) return;
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  });

  // Botón "Descargar Rechazos" (solo para admin)
  if (downloadRechazosBtn) {
    downloadRechazosBtn.addEventListener("click", downloadRechazosFile);
  }

  // Verificar autenticación y configurar el rol del usuario
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      document.getElementById("correoUsuario").innerText = user.email;
      AppState.isAdmin = ADMIN_UIDS.includes(user.uid);
      console.log(`El usuario actual es ${AppState.isAdmin ? "ADMIN" : "USUARIO normal"}`);
      setUIForRole(AppState.isAdmin);
      // Cargar tanto el archivo de Usuarios como la lista de rechazos
      await loadUsuariosFile();
      await loadFilesFromFirebase();
    } else {
      document.getElementById("correoUsuario").innerText = "No hay usuario logueado";
      window.location.href = "login.html";
    }
  });
});

/*****************************************************
 *  ========== FUNCIONES PARA MANEJO DE ARCHIVOS ==========
 *****************************************************/

/**
 * Carga la lista de archivos "rechazos" desde Firebase Storage.
 */
async function loadFilesFromFirebase() {
  try {
    await showAlert("info", "Cargando archivos...", "Recuperando archivos de Firebase Storage");
    const storageRef = storage.ref("uploads");
    const fileList = await storageRef.listAll();
    const files = [];

    fileList.items.forEach(item => {
      if (item.name.toLowerCase().includes("rechazos")) {
        const cleanName = item.name.replace(/^\d+/g, "").replace(/_/g, " ").replace(".xlsx", "");
        files.push({ name: cleanName, ref: item });
      }
    });

    if (files.length > 0) {
      renderFileSelectOptions(files);
      showAlert("success", "Archivos cargados", "Se encontraron archivos 'rechazos' en Firebase");
    } else {
      showAlert("warning", "Sin archivos", "No se encontraron archivos de 'rechazos' en Firebase");
    }
  } catch (error) {
    console.error("Error al listar archivos:", error);
    showAlert("error", "Error", "Hubo un problema al cargar archivos de Firebase");
  }
}

/**
 * Renderiza las opciones de selección de archivo en el DOM.
 * @param {Array} files 
 */
function renderFileSelectOptions(files) {
  const fileListContainer = document.getElementById("fileListContainer");
  fileListContainer.innerHTML = "";
  files.forEach(file => {
    const fileItem = document.createElement("div");
    fileItem.className = "list-group-item d-flex justify-content-between";

    const fileInfo = document.createElement("div");
    fileInfo.textContent = file.name;

    const selectBtn = document.createElement("button");
    selectBtn.className = "btn btn-primary btn-sm";
    selectBtn.textContent = "Seleccionar";
    selectBtn.addEventListener("click", () => {
      document.getElementById("selectedFileName").textContent = `Seleccionado: ${file.name}`;
      document.getElementById("confirmFileSelection").disabled = false;
      AppState.selectedFileData = file;
    });

    fileItem.appendChild(fileInfo);
    fileItem.appendChild(selectBtn);
    fileListContainer.appendChild(fileItem);
  });
}

/**
 * Maneja la subida de un archivo (solo para admin).
 * @param {File} file 
 */
async function handleFileUpload(file) {
  if (!file || !AppState.isAdmin) return;
  const result = await Swal.fire({
    title: "¿Estás seguro?",
    text: "Esto eliminará el archivo 'rechazos' anterior.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, subir",
    cancelButtonText: "Cancelar"
  });
  if (result.isConfirmed) {
    try {
      await showAlert("info", "Subiendo...", "El archivo se está subiendo.");
      await deletePreviousFile();
      const fileRef = storage.ref(`uploads/rechazos.xlsx`);
      await fileRef.put(file);
      await loadFilesFromFirebase();
      window.location.reload();
    } catch (error) {
      console.error("Error en handleFileUpload:", error);
      showAlert("error", "Error", "No se pudo subir el archivo.");
    }
  }
}

/**
 * Elimina el archivo "rechazos" anterior de Firebase Storage.
 */
async function deletePreviousFile() {
  try {
    const storageRef = storage.ref("uploads");
    const fileList = await storageRef.listAll();
    const existingFile = fileList.items.find(item => item.name.toLowerCase().includes("rechazos"));
    if (existingFile) {
      await existingFile.delete();
    }
  } catch (error) {
    console.error("Error al eliminar archivo previo:", error);
  }
}

/*****************************************************
 *  ========== FUNCIONES PARA MANEJO DE ARCHIVOS EXCEL ==========
 *****************************************************/

/**
 * Carga el archivo "relaciones.xlsx", procesa la hoja "Usuarios"
 * y a partir de allí extrae las secciones para cargar "rechazos.xlsx".
 */
async function loadRelacionesFile() {
  const filePath = "relaciones.xlsx";
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error("No se encontró relaciones.xlsx");
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets["Usuarios"];
      if (!sheet) {
        showAlert("error", "Error", "No existe la hoja 'Usuarios' en relaciones.xlsx");
        return;
      }
      AppState.relacionesData = XLSX.utils.sheet_to_json(sheet);
      const correoUsuario = auth.currentUser.email;
      const usuarioData = AppState.relacionesData.filter(row => row.Correo === correoUsuario);
      if (usuarioData.length === 0) {
        showAlert("error", "Error", "No se encontró info para este usuario en 'relaciones'.");
        return;
      }
      // Extraer todas las secciones (posibles en varios campos)
      let secciones = [];
      usuarioData.forEach(row => {
        if (row.Sección) {
          secciones = secciones.concat(row.Sección.toString().split(",").map(s => s.trim()));
        }
        for (let i = 1; i <= 5; i++) {
          if (row[`Sección ${i}`]) {
            secciones = secciones.concat(row[`Sección ${i}`].toString().split(",").map(s => s.trim()));
          }
        }
      });
      secciones = [...new Set(secciones)]; // Eliminar duplicados
      loadRechazosFile(secciones);
    };
    reader.readAsBinaryString(blob);
  } catch (error) {
    console.error("Error al cargar relaciones.xlsx:", error);
    showAlert("error", "Error", "No se pudo cargar el archivo 'relaciones.xlsx'");
  }
}

/**
 * Descarga el archivo "rechazos.xlsx", filtra las filas según las secciones
 * y llama a la función para renderizar el acordeón.
 * @param {Array} secciones 
 */
async function loadRechazosFile(secciones) {
  try {
    const storageRef = storage.ref("uploads");
    const fileList = await storageRef.listAll();
    const archivoRechazos = fileList.items.find(item => item.name.toLowerCase().includes("rechazos"));
    if (!archivoRechazos) {
      showAlert("warning", "Archivo no encontrado", "No se encontró 'rechazos' en Firebase");
      return;
    }
    const url = await archivoRechazos.getDownloadURL();
    const response = await fetch(url);
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets["Rechazos"];
      if (!sheet) {
        showAlert("error", "Error", "No existe la hoja 'Rechazos' en el Excel");
        return;
      }
      AppState.allRechazosEnExcel = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      // Filtrar solo las filas correspondientes a las secciones del usuario
      const rechazosFiltrados = AppState.allRechazosEnExcel.filter(row => {
        return secciones.some(seccion =>
          row.Sección && row.Sección.toString().trim() === seccion.toString().trim()
        );
      });
      renderRechazos(rechazosFiltrados);
    };
    reader.readAsBinaryString(blob);
  } catch (error) {
    console.error("Error al cargar rechazos.xlsx:", error);
    showAlert("error", "Error", "No se pudo descargar 'rechazos.xlsx' desde Firebase");
  }
}

/*****************************************************
 *  ========== RENDERIZAR ACORDEÓN ==========
 *****************************************************/
/**
 * Renderiza el acordeón con la información de cada rechazo.
 * Si un rechazo ya tiene comentarios, el encabezado se pinta de verde.
 * Además, se busca el nombre real del usuario a partir de AppState.usuariosData.
 * @param {Array} rechazosFiltrados 
 */
function renderRechazos(rechazosFiltrados) {
  const rechazosContainer = document.getElementById("rechazosContainer");
  rechazosContainer.innerHTML = "";

  // Guardar en el estado solo los rechazos que se muestran al usuario
  AppState.rechazosGlobal = rechazosFiltrados.map((item, index) => ({
    ...item,
    _rowIndex: index,
    Comentarios: item.Comentarios || ""
  }));

  if (AppState.rechazosGlobal.length === 0) {
    rechazosContainer.innerHTML = `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle-fill icon-pink"></i>
        No se encontraron rechazos para tus secciones.
      </div>`;
    return;
  }

  // Crear el contenedor de acordeón
  const accordion = document.createElement("div");
  accordion.className = "accordion";
  accordion.id = "rechazosAccordion";

  AppState.rechazosGlobal.forEach((rechazo, i) => {
    const fecha = fixEncoding(rechazo["Fecha Rechazo"] || "");
    const seccion = fixEncoding(rechazo["Sección"] || "");
    const remision = fixEncoding(rechazo["Remisión"] || "");
    const sku = fixEncoding(rechazo["Sku"] || "");
    
    // Obtener el valor original del campo "Usuario"
    let usuarioCode = fixEncoding(rechazo["Usuario"] || "");
    // Normalizamos para comparar (quitamos espacios y convertimos a minúsculas)
    const userCodeNormalized = usuarioCode.trim().toLowerCase();
    // Buscar en AppState.usuariosData el usuario cuyo campo "Usuarios" coincida (normalizado)
    let usuarioName = usuarioCode;
    if (AppState.usuariosData && AppState.usuariosData.length > 0) {
      const foundUser = AppState.usuariosData.find(u => {
        return u.Usuarios &&
          u.Usuarios.toString().trim().toLowerCase() === userCodeNormalized;
      });
      if (foundUser && foundUser.Nombre) {
        usuarioName = foundUser.Nombre;
      }
    }
    
    const jefe = fixEncoding(rechazo["Jefe"] || "");
    const comentarios = fixEncoding(rechazo["Comentarios"] || "");

    const headingId = `heading-${i}`;
    const collapseId = `collapse-${i}`;

    // Si hay comentarios, se agrega la clase "has-comment-header"
    const headerButtonClass = `accordion-button collapsed gap-2 ${comentarios.trim() !== "" ? "has-comment-header" : ""}`;

    // Crear elementos del acordeón
    const accordionItem = document.createElement("div");
    accordionItem.className = "accordion-item mb-2";

    const header = document.createElement("h2");
    header.className = "accordion-header";
    header.id = headingId;
    header.innerHTML = `
      <button 
        class="${headerButtonClass}" 
        type="button" 
        data-bs-toggle="collapse"
        data-bs-target="#${collapseId}"
        aria-expanded="false"
        aria-controls="${collapseId}"
      >
        <i class="bi bi-file-earmark-text icon-pink"></i>
        <strong>Remisión:</strong> ${remision}
      </button>
    `;

    const collapseDiv = document.createElement("div");
    collapseDiv.id = collapseId;
    collapseDiv.className = "accordion-collapse collapse";
    collapseDiv.setAttribute("aria-labelledby", headingId);

    const body = document.createElement("div");
    body.className = "accordion-body";
    const searchUrl = `https://www.liverpool.com.mx/tienda?s=${sku}`;
    const googleSearchUrl = `https://www.google.com/search?q=site:liverpool.com.mx+${sku}`;

    // Determinar la clase para el textarea (agrega "has-comment" si ya hay comentario)
    const textareaClass = comentarios.trim() !== ""
      ? "form-control comentario-input has-comment"
      : "form-control comentario-input";

    body.innerHTML = `
      <div class="mb-2 text-muted">
        <i class="bi bi-calendar2 icon-pink"></i> <strong>Fecha:</strong> ${fecha}
      </div>
      <p class="mb-2">
        <i class="bi bi-diagram-2 icon-pink"></i>
        <strong>Sección:</strong> ${seccion} <br>
        <i class="bi bi-tags icon-pink"></i>
        <strong>SKU:</strong> ${sku} <br>
        <i class="bi bi-person icon-pink"></i>
        <strong>Usuario:</strong> ${usuarioName} <br>
        <i class="bi bi-person-gear icon-pink"></i>
        <strong>Jefe:</strong> ${jefe}
      </p>
      <div class="text-center mb-3" id="imgContainer-${sku}">
        <!-- La imagen se cargará dinámicamente -->
      </div>
      <div class="text-center mb-3">
        <a href="${searchUrl}" target="_blank" class="btn btn-outline-secondary">Buscar en Liverpool</a>
        <a href="${googleSearchUrl}" target="_blank" class="btn btn-outline-danger">Buscar en Google</a>
      </div>
      <label for="comentario-${rechazo._rowIndex}" class="form-label fw-semibold">
        <i class="bi bi-chat-left-dots icon-pink me-1"></i>
        Comentarios:
      </label>
      <textarea
        id="comentario-${rechazo._rowIndex}"
        rows="3"
        class="${textareaClass}"
        data-row-index="${rechazo._rowIndex}"
      >${comentarios}</textarea>
    `;

    collapseDiv.appendChild(body);
    accordionItem.appendChild(header);
    accordionItem.appendChild(collapseDiv);
    accordion.appendChild(accordionItem);
    rechazosContainer.appendChild(accordion);

    // Cargar la imagen dinámica para este SKU
    loadDynamicImage(sku, seccion, `imgContainer-${sku}`);
  });
}

/*****************************************************
 *  ========== ESCUCHA DE CAMBIOS EN TEXTAREA ==========
 *****************************************************/
document.addEventListener("input", (e) => {
  if (e.target && e.target.classList.contains("comentario-input")) {
    const rowIndex = e.target.getAttribute("data-row-index");
    const newComment = e.target.value;
    if (AppState.rechazosGlobal[rowIndex]) {
      AppState.rechazosGlobal[rowIndex].Comentarios = newComment;
      console.log(`Nuevo comentario para rowIndex=${rowIndex}: ${newComment}`);
    }
    // Actualiza la clase del textarea: si tiene contenido se agrega "has-comment", si no se remueve
    if (newComment.trim() !== "") {
      e.target.classList.add("has-comment");
    } else {
      e.target.classList.remove("has-comment");
    }
    // Actualiza también el encabezado (accordion header) correspondiente
    const headerButton = document.querySelector(`#heading-${rowIndex} button`);
    if (headerButton) {
      if (newComment.trim() !== "") {
        headerButton.classList.add("has-comment-header");
      } else {
        headerButton.classList.remove("has-comment-header");
      }
    }
  }
});

/*****************************************************
 *  ========== DESCARGAR "RECHAZOS" (ADMIN) ==========
 *****************************************************/
async function downloadRechazosFile() {
  if (!AppState.isAdmin) return;
  try {
    const storageRef = storage.ref("uploads/");
    const fileList = await storageRef.listAll();
    const archivoRechazos = fileList.items.find(item => item.name.toLowerCase().includes("rechazos"));
    if (!archivoRechazos) {
      return showAlert("error", "Archivo no encontrado", "No se encontró 'rechazos' en Firebase.");
    }
    const url = await archivoRechazos.getDownloadURL();
    const link = document.createElement("a");
    link.href = url;
    link.download = "rechazos.xlsx"; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error al descargar:", error);
    showAlert("error", "Error", "No se pudo descargar 'rechazos.xlsx'");
  }
}

/*****************************************************
 *  ========== GUARDAR COMENTARIOS (MERGE) ==========
 *****************************************************/
async function saveAllComments() {
  try {
    await showAlert("info", "Guardando cambios...", "Por favor espera");
    // Buscar el archivo "rechazos.xlsx" en Firebase Storage
    const storageRef = storage.ref("uploads/");
    const fileList = await storageRef.listAll();
    const archivoRechazos = fileList.items.find(item => item.name.toLowerCase().includes("rechazos"));
    if (!archivoRechazos) {
      return showAlert("error", "Archivo no encontrado", "No se encontró 'rechazos' en Firebase.");
    }
    // Descargar la versión actual del archivo
    const url = await archivoRechazos.getDownloadURL();
    const response = await fetch(url);
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets["Rechazos"];
        if (!sheet) {
          return showAlert("error", "Error", "No existe la hoja 'Rechazos' en el Excel");
        }
        let actualRechazos = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        // Crear diccionario de comentarios editados
        const comentariosEditados = {};
        AppState.rechazosGlobal.forEach(fila => {
          if (fila.Remisión) {
            comentariosEditados[fila.Remisión] = fila.Comentarios || "";
          }
        });
        // Merge: actualizar comentarios en cada fila
        actualRechazos = actualRechazos.map(row => {
          if (row.Remisión && comentariosEditados.hasOwnProperty(row.Remisión)) {
            return { ...row, Comentarios: comentariosEditados[row.Remisión] };
          }
          return row;
        });
        // Convertir nuevamente a hoja Excel
        const newSheet = XLSX.utils.json_to_sheet(actualRechazos);
        workbook.Sheets["Rechazos"] = newSheet;
        const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const newBlob = new Blob([wbout], { type: "application/octet-stream" });
        // Eliminar el archivo previo y subir el actualizado
        await archivoRechazos.delete();
        await storage.ref("uploads/rechazos.xlsx").put(newBlob);
        showAlert("success", "Éxito", "Los comentarios se han guardado correctamente.")
          .then(() => window.location.reload());
      } catch (error) {
        console.error("Error al actualizar comentarios:", error);
        showAlert("error", "Error", "No se pudo actualizar el archivo con comentarios.");
      }
    };
    reader.readAsBinaryString(blob);
  } catch (error) {
    console.error("Error general al guardar comentarios:", error);
    showAlert("error", "Error", "No se pudieron guardar los comentarios.");
  }
}
