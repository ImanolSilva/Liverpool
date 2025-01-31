// ========== CONFIGURACIÓN DE FIREBASE ==========
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

// ========== LISTA DE ADMINISTRADORES ==========
const adminUIDs = [
  "OaieQ6cGi7TnW0nbxvlk2oyLaER2",
  "doxhVo1D3aYQqqkqgRgfJ4qcKcU2",
  // ...
];

// ========== ELEMENTOS DEL DOM ==========
const logoutButton = document.getElementById("logout-btn");
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const seccionRegistro = document.getElementById('seccionRegistro');
const skuInput = document.getElementById('skuInput');
const skuForm = document.getElementById('skuForm');
const descargarBtn = document.getElementById('descargarBtn');

const userFilePickerSection = document.getElementById('userFilePickerSection');
const loadFileBtn = document.getElementById('loadFileBtn');
const selectedFileName = document.getElementById('selectedFileName');
const borrarBtn = document.getElementById('borrarBtn');
const confirmFileSelection = document.getElementById('confirmFileSelection');

// Variable global para el workbook en uso
let workbook = null;
// ID del archivo seleccionado
let selectedFileIdGlobal = null;
// ¿Es admin?
let isAdminGlobal = false;

// ========== AUXILIARES ==========

/**
 * Convierte la URL de Storage a ArrayBuffer
 */
async function base64ToArrayBufferFromURL(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error al obtener arrayBuffer:', error);
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo obtener el archivo.' });
    return null;
  }
}

function mostrarSeccionesAdmin() {
  const adminUploadSection = document.getElementById('adminUploadSection');
  if (adminUploadSection) adminUploadSection.style.display = 'block';
  if (borrarBtn) borrarBtn.style.display = 'block';
}

function mostrarSeccionesUsuario() {
  const adminUploadSection = document.getElementById('adminUploadSection');
  if (adminUploadSection) adminUploadSection.style.display = 'none';
  if (borrarBtn) borrarBtn.style.display = 'none';
}

/**
 * Elimina hoja "PRECIOS CHECADOS" si existe en el workbook.
 */
function eliminarHojaPreciosChecados(wb) {
  if (wb.Sheets['PRECIOS CHECADOS']) {
    delete wb.Sheets['PRECIOS CHECADOS'];
  }
  wb.SheetNames = wb.SheetNames.filter(name => name !== 'PRECIOS CHECADOS');
}

/**
 * Reconstruye la hoja PRECIOS CHECADOS a partir de Firestore subcoleccion 'prices_checked'
 */
async function reconstruirHojaPreciosChecados(fileId, wb) {
  // 1. Eliminar cualquier rastro de PRECIOS CHECADOS que venga en el Excel
  eliminarHojaPreciosChecados(wb);

  // 2. Consultar la subcolección
  const snapshot = await db.collection('files').doc(fileId).collection('prices_checked').get();
  if (snapshot.empty) {
    console.log(`No hay SKUs verificados en "prices_checked" para fileId=${fileId}.`);
    // Si quieres una hoja vacía, la creamos
    wb.Sheets['PRECIOS CHECADOS'] = XLSX.utils.json_to_sheet([]);
    wb.SheetNames.push('PRECIOS CHECADOS');
    return;
  }

  // 3. Armar array con los docs
  const preciosChecadosArray = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    preciosChecadosArray.push({
      SKU: data.SKU || '',
      DESCRIPCION: data.DESCRIPCION || '',
      PIEZAS: data.PIEZAS || 'N/A',
      PRECIO: data.PRECIO || 'Sin precio',
      SACAR_ETIQUETAS: data.SACAR_ETIQUETAS || 'NO'
    });
  });

  // 4. Crear la hoja con esos datos
  const sheet = XLSX.utils.json_to_sheet(preciosChecadosArray);
  wb.Sheets['PRECIOS CHECADOS'] = sheet;
  wb.SheetNames.push('PRECIOS CHECADOS');
}

// ========== RENDERIZAR ARCHIVOS ==========
function renderFileSelectOptions(archivos) {
  const fileListContainer = document.getElementById('fileListContainer');
  if (!fileListContainer) return;

  fileListContainer.innerHTML = '';
  if (archivos.length === 0) {
    fileListContainer.innerHTML = '<p class="text-muted">No hay archivos disponibles.</p>';
    return;
  }

  archivos.forEach(fileObj => {
    const fileItem = document.createElement('div');
    fileItem.className = 'list-group-item d-flex justify-content-between align-items-center flex-wrap';

    const fileInfo = document.createElement('div');
    fileInfo.className = 'mb-2 mb-md-0';
    fileInfo.textContent = fileObj.name;

    const buttonsDiv = document.createElement('div');

    // Botón de selección
    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'btn btn-sm btn-primary me-2';
    selectBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
    selectBtn.addEventListener('click', () => {
      fileListContainer.querySelectorAll('.list-group-item').forEach(item => item.classList.remove('active'));
      fileItem.classList.add('active');

      selectedFileIdGlobal = fileObj.id;
      selectedFileName.textContent = fileObj.name;
      confirmFileSelection.disabled = false;
    });
    buttonsDiv.appendChild(selectBtn);

    // Botón eliminar (admin)
    if (isAdminGlobal) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-danger';
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
      deleteBtn.addEventListener('click', () => {
        eliminarArchivoSeleccionado(fileObj.id);
      });
      buttonsDiv.appendChild(deleteBtn);
    }

    fileItem.appendChild(fileInfo);
    fileItem.appendChild(buttonsDiv);
    fileListContainer.appendChild(fileItem);
  });
}

// ========== CARGAR LISTA DE ARCHIVOS ==========
async function cargarArchivosDesdeFirestore() {
  try {
    const querySnapshot = await db.collection('files').orderBy('uploadedAt', 'desc').get();
    const archivos = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      archivos.push({ id: doc.id, name: data.name, url: data.url });
    });
    renderFileSelectOptions(archivos);
  } catch (error) {
    console.error('Error al obtener archivos:', error);
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo obtener la lista de archivos.' });
  }
}

// ========== ELIMINAR ARCHIVO + SUBCOLECCION ==========
async function eliminarArchivoSeleccionado(fileId) {
  try {
    const fileDoc = await db.collection('files').doc(fileId).get();
    if (!fileDoc.exists) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'El archivo no existe en la base de datos.' });
      return;
    }
    const fileData = fileDoc.data();
    const fileUrl = fileData.url;

    // Eliminar subcoleccion 'prices_checked'
    const pricesCheckedRef = db.collection('files').doc(fileId).collection('prices_checked');
    const snapshot = await pricesCheckedRef.get();
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    // Eliminar doc principal
    await db.collection('files').doc(fileId).delete();

    // Eliminar archivo en Storage
    if (fileUrl) {
      const storageRef = storage.refFromURL(fileUrl);
      await storageRef.delete();
    }

    Swal.fire({
      icon: 'success',
      title: 'Eliminado',
      text: 'Archivo y subcolección eliminados correctamente.'
    });
    cargarArchivosDesdeFirestore();

    // Si era el archivo seleccionado
    if (selectedFileIdGlobal === fileId) {
      selectedFileIdGlobal = null;
      workbook = null;
      seccionRegistro.style.display = 'none';
      descargarBtn.disabled = true;
      selectedFileName.textContent = 'No se ha seleccionado ningún archivo.';
      loadFileBtn.disabled = true;

      // Desuscribir la escucha de prices_checked
      if (unsubscribePricesChecked) {
        unsubscribePricesChecked();
        unsubscribePricesChecked = null;
      }
    }
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `No se pudo eliminar el archivo. ${error.message}`
    });
  }
}

// ========== BOTÓN BORRAR (ADMIN) ==========
if (borrarBtn) {
  borrarBtn.addEventListener('click', async () => {
    if (!selectedFileIdGlobal) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No has seleccionado ningún archivo.' });
      return;
    }
    const fileId = selectedFileIdGlobal;
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esto eliminará el archivo y todos sus SKUs verificados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await eliminarArchivoSeleccionado(fileId);
      }
    });
  });
}

// ========== SUBIR ARCHIVO ==========
function handleFile(file) {
  const user = auth.currentUser;
  if (!user) {
    Swal.fire({ icon: "error", title: "No Autenticado", text: "Inicia sesión." });
    return;
  }
  if (!file) {
    Swal.fire({ icon: "warning", title: "Sin Archivo", text: "Selecciona un archivo para subir." });
    return;
  }

  const storageRef = storage.ref();
  const filePath = `uploads/${Date.now()}_${file.name}`;
  const fileRef = storageRef.child(filePath);

  Swal.fire({ title: "Subiendo archivo...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  fileRef.put(file)
    .then(() => fileRef.getDownloadURL())
    .then(downloadURL => {
      return db.collection("files").add({
        name: file.name,
        url: downloadURL,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        uploadedBy: user.uid,
      });
    })
    .then(() => {
      Swal.fire({ icon: "success", title: "Archivo subido", text: `"${file.name}" se subió correctamente.` });
      cargarArchivosDesdeFirestore();
    })
    .catch(error => {
      console.error("Error al subir archivo:", error);
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    });
}

// ========== DRAG & DROP ==========
if (dropzone) {
  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  dropzone.addEventListener('click', () => {
    if (fileInput) fileInput.click();
  });
}
if (fileInput) {
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFile(fileInput.files[0]);
    }
  });
}

// ========== DETECTAR 10+ DIGITOS EN skuInput PARA ENVIAR ==========
skuInput.addEventListener('input', () => {
  if (skuInput.value.length >= 10) {
    skuForm.requestSubmit();
  }
});

// ========== FORMULARIO SKU (VERIFICAR) ==========
skuForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  const valorSku = skuInput.value.trim().toUpperCase();

  if (!valorSku) {
    Swal.fire({ icon: 'warning', title: 'Aviso', text: 'Ingresa un SKU válido.' });
    return;
  }
  if (!workbook || !workbook.Sheets['DATOS']) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se ha cargado la hoja DATOS.' });
    return;
  }

  const datosSheet = workbook.Sheets['DATOS'];
  const datosJson = XLSX.utils.sheet_to_json(datosSheet);
  
  // Ajusta a tu encabezado EXACTO
  const item = datosJson.find(row =>
    row.SKU && row.SKU.toString().trim().toUpperCase() === valorSku
  );
  if (!item) {
    Swal.fire({ icon: 'error', title: 'SKU no encontrado', text: `El SKU ${valorSku} no está en la hoja DATOS.` });
    skuInput.value = '';
    return;
  }

  // Ojo: la columna en tu Excel debe llamarse EXACTAMENTE "PRECIO"
  const descripcion = item.DESCRIPCION || 'Sin descripción';
  const piezas = item.PIEZAS || 'N/A';
  const precio = item.PRECIO || 'Sin precio';

  if (!selectedFileIdGlobal) {
    Swal.fire({ icon: 'error', title: 'Archivo No Seleccionado', text: 'Selecciona un archivo.' });
    return;
  }

  const priceCheckRef = db.collection('files').doc(selectedFileIdGlobal).collection('prices_checked').doc(valorSku);
  const priceCheckDoc = await priceCheckRef.get();
  if (priceCheckDoc.exists) {
    const data = priceCheckDoc.data();
    Swal.fire({
      icon: 'info',
      title: 'SKU ya verificado',
      text: `El SKU ${valorSku} ya fue verificado.
Precio: $${data.PRECIO}.
No es necesario volver a marcarlo.`
    });
    skuInput.value = '';
    return;
  }

  // Preguntar si el precio está correcto
  const confirm = await Swal.fire({
    title: 'Verificar Precio',
    html: `
      <p><strong>SKU:</strong> ${valorSku}</p>
      <p><strong>Descripción:</strong> ${descripcion}</p>
      <p><strong>Piezas:</strong> ${piezas}</p>
      <p><strong>Precio:</strong> $${precio}</p>
      <hr>
      <p>¿El precio en la etiqueta está correcto?</p>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, es correcto',
    cancelButtonText: 'No, está mal'
  });

  let sacarEtiquetas = 'NO';
  if (!confirm.isConfirmed) {
    sacarEtiquetas = 'SI';
  }

  // Guardar en Firestore
  await priceCheckRef.set({
    SKU: valorSku,
    DESCRIPCION: descripcion,
    PIEZAS: piezas,
    PRECIO: precio,
    SACAR_ETIQUETAS: sacarEtiquetas,
    FECHA_REGISTRO: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Reconstruir o actualizar la hoja PRECIOS CHECADOS en memoria
  // Eliminamos y la volvemos a crear con datos de Firestore
  await reconstruirHojaPreciosChecados(selectedFileIdGlobal, workbook);

  Swal.fire({
    icon: 'success',
    title: 'Artículo Verificado',
    text: `El SKU ${valorSku} se registró correctamente.
SACAR_ETIQUETAS = ${sacarEtiquetas}`
  });
  skuInput.value = '';
});

// ========== FUNCIÓN CARGAR WORKBOOK Y RECONSTRUIR DESDE FIRESTORE ==========
async function loadWorkbookFromArrayBuffer(arrayBuffer, fileId) {
  if (!arrayBuffer) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo obtener el archivo.' });
    return null;
  }
  try {
    if (arrayBuffer.byteLength === 0) {
      throw new Error('El archivo está vacío.');
    }

    // Parsear con XLSX
    const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const header = String.fromCharCode(...bytes);
    if (!header.startsWith('PK')) {
      throw new Error('El archivo no parece ser un archivo Excel válido.');
    }

    // Leer
    const newWorkbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Verificar hoja DATOS
    if (!newWorkbook.Sheets['DATOS']) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No existe la hoja "DATOS" en el Excel.' });
      return null;
    }

    // Reconstruir PRECIOS CHECADOS desde Firestore
    await reconstruirHojaPreciosChecados(fileId, newWorkbook);

    // Asignar a la variable global workbook
    workbook = newWorkbook;

    seccionRegistro.style.display = '';
    descargarBtn.disabled = false;

    Swal.fire({
      icon: 'success',
      title: 'Archivo Cargado',
      text: 'El archivo Excel se cargó correctamente.'
    });
    return newWorkbook;
  } catch (error) {
    console.error('Error al parsear Excel:', error);
    Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    return null;
  }
}

// ========== BOTÓN DESCARGAR (SOBRESCRIBIR) ==========
if (descargarBtn) {
  descargarBtn.addEventListener('click', async function () {
    if (!selectedFileIdGlobal) {
      Swal.fire({ icon: 'warning', title: 'Sin Archivo', text: 'Selecciona un archivo primero.' });
      return;
    }
    if (!workbook) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No hay ningún libro de Excel cargado.' });
      return;
    }

    try {
      // Generar array del workbook actualizado
      const workbookOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([workbookOut], { type: 'application/octet-stream' });

      // Obtener el documento del archivo seleccionado
      const fileDoc = await db.collection("files").doc(selectedFileIdGlobal).get();
      if (!fileDoc.exists) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró el archivo en Firestore.' });
        return;
      }
      const fileData = fileDoc.data();
      const originalUrl = fileData.url;
      const storageRef = storage.refFromURL(originalUrl);

      // Subir el archivo actualizado a Storage
      await storageRef.put(blob);
      const updatedDownloadUrl = await storageRef.getDownloadURL();

      // Actualizar la URL en Firestore
      await db.collection("files").doc(selectedFileIdGlobal).update({
        url: updatedDownloadUrl
      });

      // Descargar el archivo localmente
      const localUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = localUrl;
      a.download = 'precios_checados_actualizado.xlsx';
      a.click();
      URL.revokeObjectURL(localUrl);

      Swal.fire({
        icon: 'success',
        title: 'Archivo Actualizado',
        text: 'Se subió y descargó la versión actual con PRECIOS CHECADOS.'
      });
    } catch (error) {
      console.error('Error al subir/descargar Excel:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el archivo.' });
    }
  });
}

// ========== BOTÓN "CARGAR ARCHIVO ELEGIDO" ==========
if (loadFileBtn) {
  loadFileBtn.addEventListener('click', async function () {
    if (!selectedFileIdGlobal) {
      Swal.fire({ icon: 'info', title: 'No has seleccionado ningún archivo' });
      return;
    }
    try {
      // Descargar el documento del archivo seleccionado
      const doc = await db.collection('files').doc(selectedFileIdGlobal).get();
      if (!doc.exists) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró el archivo en la lista.' });
        return;
      }
      const data = doc.data();
      
      // Reiniciar el workbook
      workbook = null;
      const arrayBuffer = await base64ToArrayBufferFromURL(data.url);

      // Cargar y reconstruir el workbook
      await loadWorkbookFromArrayBuffer(arrayBuffer, selectedFileIdGlobal);

      // Configurar la escucha en tiempo real para la subcolección prices_checked
      await setupPricesCheckedListener(selectedFileIdGlobal);
    } catch (error) {
      console.error('Error al cargar el archivo:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el archivo seleccionado.' });
    }
  });
}

// ========== MANEJO DEL MODAL (confirmar selección) ==========
if (confirmFileSelection) {
  confirmFileSelection.addEventListener('click', () => {
    if (!selectedFileIdGlobal) {
      Swal.fire({ icon: 'warning', title: 'No se ha seleccionado ningún archivo', text: 'Elige un archivo para continuar.' });
      return;
    }
    const activeItem = document.querySelector('.list-group-item.active');
    const fileName = activeItem ? activeItem.querySelector('div').textContent : 'No seleccionado';
    selectedFileName.textContent = fileName;

    // Cerrar modal (Bootstrap)
    const fileSelectionModal = bootstrap.Modal.getInstance(document.getElementById('fileSelectionModal'));
    if (fileSelectionModal) fileSelectionModal.hide();

    loadFileBtn.disabled = false;
  });
}

// ========== CERRAR SESIÓN ==========
logoutButton.addEventListener("click", () => {
  auth.signOut()
    .then(() => {
      Swal.fire("Sesión cerrada", "Has cerrado sesión correctamente.", "success")
        .then(() => {
          window.location.href = "login.html"; 
        });
    })
    .catch((error) => {
      Swal.fire("Error al cerrar sesión", error.message, "error");
    });
});

// ========== onAuthStateChanged ==========
auth.onAuthStateChanged(async (user) => {
  if (user) {
    console.log(`UID del usuario autenticado: ${user.uid}`);
    await cargarArchivosDesdeFirestore();
    console.log(`Usuario autenticado: ${user.email}`);

    isAdminGlobal = adminUIDs.includes(user.uid);
    if (isAdminGlobal) mostrarSeccionesAdmin();
    else mostrarSeccionesUsuario();
  } else {
    Swal.fire({
      icon: "warning",
      title: "No Autenticado",
      text: "Debes iniciar sesión para acceder.",
      confirmButtonText: "Ir al Login"
    }).then(() => {
      window.location.href = "login.html";
    });
  }
});

// ========== Exponer la Función de Eliminación Globalmente (Opcional) ==========
window.deleteAdminFile = eliminarArchivoSeleccionado;

// ========== FUNCIONES DE ESCUCHA EN TIEMPO REAL ==========
let unsubscribePricesChecked = null;

async function setupPricesCheckedListener(fileId) {
  if (unsubscribePricesChecked) {
    unsubscribePricesChecked();
  }

  unsubscribePricesChecked = db.collection('files').doc(fileId).collection('prices_checked')
    .onSnapshot(async (snapshot) => {
      const preciosChecadosArray = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        preciosChecadosArray.push({
          SKU: data.SKU || '',
          DESCRIPCION: data.DESCRIPCION || '',
          PIEZAS: data.PIEZAS || 'N/A',
          PRECIO: data.PRECIO || 'Sin precio',
          SACAR_ETIQUETAS: data.SACAR_ETIQUETAS || 'NO'
        });
      });
      
      if (workbook) {
        eliminarHojaPreciosChecados(workbook);
        const sheet = XLSX.utils.json_to_sheet(preciosChecadosArray);
        workbook.Sheets['PRECIOS CHECADOS'] = sheet;
        workbook.SheetNames.push('PRECIOS CHECADOS');
        console.log('Hoja PRECIOS CHECADOS actualizada en el workbook.');

        // Opcional: Notificar al usuario de la actualización
        Swal.fire({
          icon: 'info',
          title: 'Actualización',
          text: 'El archivo ha sido actualizado con las últimas verificaciones.'
        });
      }
    }, (error) => {
      console.error('Error en listener de prices_checked:', error);
    });
}

// ========== BOTÓN LOGOUT ==========
logoutButton.addEventListener("click", () => {
  auth.signOut()
    .then(() => {
      Swal.fire("Sesión cerrada", "Has cerrado sesión correctamente.", "success")
        .then(() => {
          window.location.href = "login.html";
        });
    })
    .catch((error) => {
      Swal.fire("Error al cerrar sesión", error.message, "error");
    });
});



