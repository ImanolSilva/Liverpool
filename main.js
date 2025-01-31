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
// Almacena la data de la hoja "Usuarios" en relaciones.xlsx
let relacionesData = null;

// Almacena TODAS las filas del Excel "Rechazos" (no solo las que ve el usuario)
let allRechazosEnExcel = [];

// Almacena SOLO las filas que el usuario filtra y visualiza
let rechazosGlobal = [];

// El archivo "rechazos" seleccionado
let selectedFileData = null;

// Para indicar si el usuario actual es admin
let isAdmin = false;

/*****************************************************
 *  ========== DOMContentLoaded ==========
 *****************************************************/
document.addEventListener("DOMContentLoaded", function () {
  // Referencias
  const logoutButton = document.getElementById("logout-btn");
  const confirmFileSelection = document.getElementById("confirmFileSelection");
  const dropzone = document.getElementById("dropzone");
  const saveCommentsBtn = document.getElementById("saveCommentsBtn");
  const downloadRechazosBtn = document.getElementById("downloadRechazosBtn"); // Botón para descargar

  // Logout
  logoutButton.addEventListener("click", () => {
    auth.signOut().then(() => {
      window.location.href = "login.html";
    });
  });

  // Botón confirmar selección (todos lo ven; así cargan el archivo)
  confirmFileSelection.addEventListener("click", () => {
    const selectedFile = document.getElementById("selectedFileName").textContent;
    if (selectedFile && selectedFileData) {
      Swal.fire({
        title: "Archivo Confirmado",
        text: `El archivo seleccionado es: ${selectedFile}`,
        icon: "success",
        confirmButtonText: "Ok"
      });
      // Cargamos el archivo local "relaciones.xlsx"
      loadRelacionesFile();
    }
  });

  // Botón guardar comentarios (todos pueden editar)
  saveCommentsBtn.addEventListener("click", saveAllComments);

  // Dropzone (solo sube el admin)
  dropzone.addEventListener("click", () => {
    if (!isAdmin) return; // Evitar que un user normal suba
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
    if (!isAdmin) return; // solo admin
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  });

  // Botón "Descargar Rechazos" (solo admin)
  if (downloadRechazosBtn) {
    downloadRechazosBtn.addEventListener("click", downloadRechazosFile);
  }

  // Verificar autenticación
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      document.getElementById("correoUsuario").innerText = user.email;

      // Determinar si es el admin (UID = "OaieQ6cGi7TnW0nbxvlk2oyLaER2")
      if (user.uid === "OaieQ6cGi7TnW0nbxvlk2oyLaER2","doxhVo1D3aYQqqkqgRgfJ4qcKcU2") {
        isAdmin = true;
        console.log("El usuario actual es ADMIN");
      } else {
        isAdmin = false;
        console.log("El usuario actual es USUARIO normal");
      }

      setUIForRole(isAdmin);

      // Cargar la lista de archivos "rechazos"
      loadFilesFromFirebase();
    } else {
      document.getElementById("correoUsuario").innerText = "No hay usuario logueado";
      window.location.href = "login.html";
    }
  });
});

/*****************************************************
 *  ========== Ajustar la UI según sea Admin o no
 *****************************************************/
function setUIForRole(admin) {
  const dropzone = document.getElementById("dropzone");
  const downloadRechazosBtn = document.getElementById("downloadRechazosBtn");
  
  // Ocultamos dropzone si no es admin
  dropzone.style.display = admin ? "block" : "none";

  // Ocultamos o mostramos el botón de descarga
  if (downloadRechazosBtn) {
    downloadRechazosBtn.style.display = admin ? "inline-block" : "none";
  }

  // El botón "Confirmar Selección" lo dejamos visible para todos
  // para que usuarios normales también puedan "seleccionar" y ver el archivo
  // y "saveCommentsBtn" igual para todos
}

/*****************************************************
 *  ========== ESCUCHA CAMBIOS EN TEXTAREA DE "Comentarios"
 *****************************************************/
document.addEventListener("input", (e) => {
  if (e.target && e.target.classList.contains("comentario-input")) {
    const rowIndex = e.target.getAttribute("data-row-index");
    const newComment = e.target.value;
    rechazosGlobal[rowIndex].Comentarios = newComment;
    console.log("Nuevo comentario para rowIndex=" + rowIndex, newComment);
  }
});

/*****************************************************
 *  ========== FUNCIONES PARA DESCARGAR RECHAZOS (solo admin)
 *****************************************************/
async function downloadRechazosFile() {
  if (!isAdmin) return;
  try {
    const storageRef = storage.ref("uploads/");
    const fileList = await storageRef.listAll();
    const archivoRechazos = fileList.items.find(item =>
      item.name.toLowerCase().includes("rechazos")
    );

    if (!archivoRechazos) {
      Swal.fire("Archivo no encontrado", "No se encontró 'rechazos' en Firebase.", "error");
      return;
    }

    const url = await archivoRechazos.getDownloadURL();
    // Crear un enlace temporal para forzar la descarga
    const link = document.createElement("a");
    link.href = url;
    link.download = "rechazos.xlsx"; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error("Error al descargar:", error);
    Swal.fire("Error", "No se pudo descargar 'rechazos.xlsx'", "error");
  }
}

/*****************************************************
 *  ========== FUNCIONES PARA LISTAR/SUBIR ARCHIVOS ==========
 *****************************************************/
async function loadFilesFromFirebase() {
  Swal.fire("Cargando archivos...", "Recuperando archivos de Firebase Storage", "info");
  try {
    const storageRef = storage.ref("uploads");
    const fileList = await storageRef.listAll();
    const files = [];

    fileList.items.forEach(item => {
      if (item.name.toLowerCase().includes("rechazos")) {
        const cleanName = item.name
          .replace(/^\d+/g, "")
          .replace(/_/g, " ")
          .replace(".xlsx", "");
        files.push({ name: cleanName, ref: item });
      }
    });

    if (files.length > 0) {
      renderFileSelectOptions(files);
      Swal.fire("Archivos cargados", "Se encontraron archivos 'rechazos' en Firebase", "success");
    } else {
      Swal.fire("Sin archivos", "No se encontraron archivos de 'rechazos' en Firebase", "warning");
    }
  } catch (error) {
    console.error("Error al listar archivos:", error);
    Swal.fire("Error", "Hubo un problema al cargar archivos de Firebase", "error");
  }
}

function renderFileSelectOptions(files) {
  const fileListContainer = document.getElementById("fileListContainer");
  fileListContainer.innerHTML = "";

  files.forEach((file) => {
    const fileItem = document.createElement("div");
    fileItem.className = "list-group-item d-flex justify-content-between";

    const fileInfo = document.createElement("div");
    fileInfo.textContent = file.name;

    // Todos (normales y admin) pueden "Seleccionar" para ver y editar
    const selectBtn = document.createElement("button");
    selectBtn.className = "btn btn-primary btn-sm";
    selectBtn.textContent = "Seleccionar";

    selectBtn.addEventListener("click", () => {
      document.getElementById("selectedFileName").textContent = `Seleccionado: ${file.name}`;
      // Habilitar el botón "Confirmar Selección" para todos (para que puedan cargarlo y ver data)
      document.getElementById("confirmFileSelection").disabled = false;
      selectedFileData = file;
    });

    fileItem.appendChild(fileInfo);
    fileItem.appendChild(selectBtn);
    fileListContainer.appendChild(fileItem);
  });
}

function handleFileUpload(file) {
  if (!file || !isAdmin) return; // Solo admin sube
  Swal.fire({
    title: "¿Estás seguro?",
    text: "Esto eliminará el archivo 'rechazos' anterior.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, subir",
    cancelButtonText: "Cancelar"
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire("Subiendo...", "El archivo se está subiendo.", "info");
      await deletePreviousFile();
      const fileRef = storage.ref(`uploads/rechazos.xlsx`);
      await fileRef.put(file);
      loadFilesFromFirebase();
      window.location.reload();
    }
  });
}

async function deletePreviousFile() {
  const storageRef = storage.ref("uploads");
  const fileList = await storageRef.listAll();
  const existingFile = fileList.items.find(item => item.name.toLowerCase().includes("rechazos"));
  if (existingFile) {
    await existingFile.delete();
  }
}

/*****************************************************
 *  ========== FUNCIONES PARA "relaciones.xlsx" Y CARGAR RECHAZOS
 *****************************************************/
function fixEncoding(str) {
  if (!str) return "";
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

async function loadRelacionesFile() {
  const filePath = "relaciones.xlsx";
  const reader = new FileReader();

  fetch(filePath)
    .then(response => {
      if (!response.ok) throw new Error("No se encontró relaciones.xlsx");
      return response.blob();
    })
    .then(blob => {
      reader.onload = function (e) {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets["Usuarios"];
        if (!sheet) {
          Swal.fire("Error", "No existe la hoja 'Usuarios' en relaciones.xlsx", "error");
          return;
        }
        relacionesData = XLSX.utils.sheet_to_json(sheet);

        // Tomamos el correo del usuario
        const correoUsuario = auth.currentUser.email;
        const usuarioData = relacionesData.filter(row => row.Correo === correoUsuario);

        if (usuarioData.length === 0) {
          Swal.fire("Error", "No se encontró info para este usuario en 'relaciones'.", "error");
          return;
        }

        // Construimos un array de secciones
        let secciones = [];
        usuarioData.forEach(row => {
          if (row.Sección) {
            secciones = secciones.concat(
              row.Sección.toString().split(",").map(s => s.trim())
            );
          }
          for (let i = 1; i <= 5; i++) {
            if (row[`Sección ${i}`]) {
              secciones = secciones.concat(
                row[`Sección ${i}`].toString().split(",").map(s => s.trim())
              );
            }
          }
        });
        // Quitamos duplicados
        secciones = [...new Set(secciones)];

        // Cargar TODAS las filas de "rechazos"
        loadRechazosFile(secciones);
      };
      reader.readAsBinaryString(blob);
    })
    .catch((error) => {
      console.error("Error al cargar relaciones.xlsx:", error);
      Swal.fire("Error", "No se pudo cargar el archivo 'relaciones.xlsx'", "error");
    });
}

/**
 * Lee "rechazos.xlsx" completo, lo guarda en allRechazosEnExcel,
 * luego filtra solo las secciones del usuario y muestra un acordeón
 */
async function loadRechazosFile(secciones) {
  const fileRef = storage.ref("uploads/");
  const fileList = await fileRef.listAll();
  const archivoRechazos = fileList.items.find(item => item.name.toLowerCase().includes("rechazos"));

  if (!archivoRechazos) {
    Swal.fire("Archivo no encontrado", "No se encontró 'rechazos' en Firebase", "warning");
    return;
  }

  try {
    const url = await archivoRechazos.getDownloadURL();
    const response = await fetch(url);
    const blob = await response.blob();

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets["Rechazos"];
      if (!sheet) {
        Swal.fire("Error", "No existe la hoja 'Rechazos' en el Excel", "error");
        return;
      }

      // Guardamos todas las filas en memoria
      allRechazosEnExcel = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      // Filtramos solo lo que el usuario ve
      const rechazosFiltrados = allRechazosEnExcel.filter((row) => {
        return secciones.some(seccion =>
          row.Sección && row.Sección.toString().trim() === seccion.toString().trim()
        );
      });

      // Renderizar en acordeón
      renderRechazos(rechazosFiltrados);
    };
    reader.readAsBinaryString(blob);

  } catch (err) {
    console.error("Error al cargar rechazos.xlsx:", err);
    Swal.fire("Error", "No se pudo descargar 'rechazos.xlsx' desde Firebase", "error");
  }
}

/*****************************************************
 *  ========== RENDERIZAR RECHAZOS (ACORDEÓN)
 *****************************************************/
function renderRechazos(rechazosFiltrados) {
  const rechazosContainer = document.getElementById("rechazosContainer");
  rechazosContainer.innerHTML = "";

  // Guardamos SOLO las filas que el usuario ve
  rechazosGlobal = rechazosFiltrados.map((item, index) => ({
    ...item,
    _rowIndex: index,
    Comentarios: item.Comentarios || ""
  }));

  if (rechazosGlobal.length === 0) {
    rechazosContainer.innerHTML = `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle-fill icon-pink"></i>
        No se encontraron rechazos para tus secciones.
      </div>`;
    return;
  }

  // Creamos un contenedor accordion
  const accordion = document.createElement("div");
  accordion.className = "accordion";
  accordion.id = "rechazosAccordion";

  rechazosGlobal.forEach((rechazo, i) => {
    const fecha = fixEncoding(rechazo["Fecha Rechazo"] || "");
    const seccion = fixEncoding(rechazo["Sección"] || "");
    const remision = fixEncoding(rechazo["Remisión"] || "");
    const sku = fixEncoding(rechazo["Sku"] || "");
    const usuario = fixEncoding(rechazo["Usuario"] || "");
    const jefe = fixEncoding(rechazo["Jefe"] || "");
    const comentarios = fixEncoding(rechazo["Comentarios"] || "");

    // IDs únicos para cada item
    const headingId = `heading-${i}`;
    const collapseId = `collapse-${i}`;

    // Item del acordeón
    const item = document.createElement("div");
    item.className = "accordion-item mb-2";

    // Header (muestra solo la Remisión)
    const header = document.createElement("h2");
    header.className = "accordion-header";
    header.id = headingId;
    header.innerHTML = `
      <button 
        class="accordion-button collapsed gap-2" 
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
    
    // Cuerpo
    const body = document.createElement("div");
    body.className = "accordion-body";
    
    // Generar la URL de la imagen dinámica con la sección
    defaultImageUrl = "https://www.liverpool.com.mx/img/unavailable.jpg"; // Imagen válida
    
    // Generar variaciones hacia arriba y hacia abajo para el SKU
    const generateSkuVariations = (sku) => {
      const variations = [sku];
      const baseSku = parseInt(sku, 10); // Convertir a número entero
      for (let i = 1; i <= 100; i++) { // Probar 100 números hacia arriba y hacia abajo
        variations.push((baseSku + i).toString());
        variations.push((baseSku - i).toString());
      }
      return variations;
    };
    
    const skuVariations = generateSkuVariations(sku);
    const imageUrls = skuVariations.map(variation => `https://ss${seccion}.liverpool.com.mx/xl/${variation}.jpg`);
    const searchUrl = `https://www.liverpool.com.mx/tienda?s=${sku}`;
    const googleSearchUrl = `https://www.google.com/search?q=site:liverpool.com.mx+${sku}`;
    
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
        <strong>Usuario:</strong> ${usuario} <br>
    
        <i class="bi bi-person-gear icon-pink"></i>
        <strong>Jefe:</strong> ${jefe}
      </p>
      
      <div class="text-center mb-3">
        <img id="img-${sku}" src="${imageUrls[0]}" alt="Imagen del artículo" class="img-fluid" style="max-width: 200px; display: none;">
        <div id="no-image-${sku}" class="no-image" style="display: none; text-align: center; font-weight: bold; padding: 10px; border: 2px dashed #ff4081; color: #ff4081; border-radius: 10px;">
          Imagen no disponible. Por favor, presiona <a href="${searchUrl}" target="_blank">Buscar en Liverpool</a> para verificar la información.
        </div>
      </div>
    
      <div class="text-center mb-3">
            <a href="${searchUrl}" target="_blank" class="btn btn-outline-secondary">Buscar en Liverpool</a>
        <a href="${googleSearchUrl}" target="_blank" class="btn btn-outline-danger">Buscar en Google</a>
      </div>
    
      <label 
        for="comentario-${rechazo._rowIndex}"
        class="form-label fw-semibold"
      >
        <i class="bi bi-chat-left-dots icon-pink me-1"></i>
        Comentarios:
      </label>
      <textarea
        id="comentario-${rechazo._rowIndex}"
        rows="3"
        class="form-control comentario-input"
        data-row-index="${rechazo._rowIndex}"
      >${comentarios}</textarea>
    `;
    
    collapseDiv.appendChild(body);
    item.appendChild(header);
    item.appendChild(collapseDiv);
    accordion.appendChild(item);
    rechazosContainer.appendChild(accordion);
    
    // Validar la imagen después de agregarla al DOM
    const imgElement = document.getElementById(`img-${sku}`);
    const noImageElement = document.getElementById(`no-image-${sku}`);
    
    let currentIndex = 0;
    const tryNextImage = () => {
      if (currentIndex < imageUrls.length) {
        imgElement.src = imageUrls[currentIndex];
        currentIndex++;
      } else {
        imgElement.onerror = null;
        imgElement.style.display = 'none';
        noImageElement.style.display = 'block';
      }
    };
    
    imgElement.onerror = tryNextImage;
    imgElement.onload = function() {
      if (imgElement.src.includes(sku)) {
        this.style.display = 'block';
        noImageElement.style.display = 'none';
      } else {
        tryNextImage();
      }
    };
    
    // Iniciar la primera búsqueda de imagen
    tryNextImage();
    
    

    collapseDiv.appendChild(body);
    item.appendChild(header);
    item.appendChild(collapseDiv);
    accordion.appendChild(item);
  });

  rechazosContainer.appendChild(accordion);
}

/*****************************************************
 *  ========== GUARDAR COMENTARIOS (MERGE)
 *****************************************************/
async function saveAllComments() {
  try {
    Swal.fire("Guardando cambios...", "Por favor espera", "info");

    // 1. Buscar el archivo "rechazos.xlsx" en Firebase
    const fileRef = storage.ref("uploads/");
    const fileList = await fileRef.listAll();
    const archivoRechazos = fileList.items.find(item =>
      item.name.toLowerCase().includes("rechazos")
    );

    if (!archivoRechazos) {
      Swal.fire("Archivo no encontrado", "No se encontró 'rechazos' en Firebase.", "error");
      return;
    }

    // 2. Descargar la versión más reciente de "rechazos.xlsx"
    const url = await archivoRechazos.getDownloadURL();
    const response = await fetch(url);
    const blob = await response.blob();

    // 3. Leer el archivo con FileReader
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary" });

        const sheet = workbook.Sheets["Rechazos"];
        if (!sheet) {
          Swal.fire("Error", "No existe la hoja 'Rechazos' en el Excel", "error");
          return;
        }

        // 4. Convertir la hoja a JSON
        let actualRechazos = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        // Creamos un diccionario de comentarios editados (Remisión -> Comentarios)
        const comentariosEditados = {};
        rechazosGlobal.forEach((fila) => {
          if (fila.Remisión) {
            comentariosEditados[fila.Remisión] = fila.Comentarios || "";
          }
        });

        // 5. MERGE: aplicar al JSON original
        actualRechazos = actualRechazos.map((row) => {
          if (row.Remisión && comentariosEditados.hasOwnProperty(row.Remisión)) {
            return { ...row, Comentarios: comentariosEditados[row.Remisión] };
          }
          return row;
        });

        // 6. Convertir de nuevo a hoja Excel
        const newSheet = XLSX.utils.json_to_sheet(actualRechazos);
        workbook.Sheets["Rechazos"] = newSheet;

        // 7. Generar un ArrayBuffer
        const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

        // 8. Subir a Firebase
        const newBlob = new Blob([wbout], { type: "application/octet-stream" });
        await archivoRechazos.delete();
        await storage.ref("uploads/rechazos.xlsx").put(newBlob);

        // 9. Confirmación y recarga
        Swal.fire("Éxito", "Los comentarios se han guardado correctamente.", "success")
          .then(() => {
            window.location.reload();
          });

      } catch (error) {
        console.error("Error al actualizar comentarios:", error);
        Swal.fire("Error", "No se pudo actualizar el archivo con comentarios.", "error");
      }
    };
    reader.readAsBinaryString(blob);

  } catch (error) {
    console.error("Error general al guardar comentarios:", error);
    Swal.fire("Error", "No se pudieron guardar los comentarios.", "error");
  }
}
