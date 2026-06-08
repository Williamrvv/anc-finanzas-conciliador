<?php
// =========================================================================
// HERRAMIENTA TEMPORAL DE MIGRACIÓN (COPIAR Y PEGAR DESDE EXCEL)
// BLINDADA CON BUFFERING PARA EVITAR ERRORES DE JSON
// =========================================================================
ob_start(); // Inicia el buffer para atrapar cualquier basura/warning de PHP
ini_set('display_errors', 0);
session_start();

// Validar que solo un Admin pueda ejecutar esto
if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
    die("<h2 style='color:red; text-align:center; padding: 50px;'>Acceso denegado. Solo administradores pueden migrar usuarios.</h2>");
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    ob_clean(); // Limpiamos cualquier error previo para que el JSON salga puro
    header('Content-Type: application/json; charset=utf-8');
    
    // Auto-detección inteligente del archivo db.php
    if (file_exists(__DIR__ . '/db.php')) {
        require_once __DIR__ . '/db.php';
    } elseif (file_exists(__DIR__ . '/../db.php')) {
        require_once __DIR__ . '/../db.php';
    } else {
        echo json_encode(['success' => false, 'error' => 'No se encontró el archivo de conexión db.php.']);
        exit;
    }

    $inputJSON = file_get_contents('php://input');
    $data = json_decode($inputJSON, true);
    $pasteData = trim($data['pasteData'] ?? '');
    
    if (empty($pasteData)) {
        echo json_encode(['success' => false, 'error' => 'No hay datos para procesar.']);
        exit;
    }

    try {
        $pdo = Database::connect();
        
        // 1. Mapear Roles
        $stmtRoles = $pdo->query("SELECT Id_Rol, Nombre_Rol FROM Tbl_Roles");
        $mapaRoles = [];
        while ($r = $stmtRoles->fetch(PDO::FETCH_ASSOC)) {
            $mapaRoles[strtolower(trim($r['Nombre_Rol']))] = $r['Id_Rol'];
        }

        $pdo->beginTransaction();

        $stmtUser = $pdo->prepare("INSERT INTO Tbl_Usuarios (Email, Nombre, Apellidos, Id_Rol, Password_Hash, Activo) VALUES (?, ?, ?, ?, NULL, 1)");
        $stmtSuc = $pdo->prepare("INSERT INTO Tbl_Usuario_Sucursales_cc (EmailUsuario, CodigoSucursal, NombreSucursal, Activo) VALUES (?, ?, 'Sede Importada', 1)");

        $lineas = explode("\n", $pasteData);
        $insertados = 0;
        $errores = [];

        foreach ($lineas as $index => $linea) {
            $linea = trim($linea);
            if (empty($linea)) continue;

            // Al pegar de Excel, las columnas se separan por tabulaciones (\t)
            $cols = explode("\t", $linea);
            
            $email = trim($cols[0] ?? '');
            
            // Si es la primera fila de encabezados o viene vacía, la ignoramos
            if (strtolower($email) === 'correo_corporativo' || empty($email)) continue;

            $nombre = trim($cols[1] ?? '');
            $apellidos = trim($cols[2] ?? '');
            $rolExcel = strtolower(trim($cols[3] ?? ''));
            $sucursalesRaw = trim($cols[4] ?? '');

            // Validar Rol
            $idRol = $mapaRoles[$rolExcel] ?? null;
            if (!$idRol) {
                $errores[] = "Fila " . ($index + 1) . " omitida ($email): El rol '$rolExcel' no existe en la BD.";
                continue;
            }

            try {
                // A) Insertar Usuario (Password_Hash en NULL)
                $stmtUser->execute([$email, $nombre, $apellidos, $idRol]);

                // B) Insertar Sucursales
                if (!empty($sucursalesRaw)) {
                    $listaSucursales = explode(',', $sucursalesRaw);
                    foreach ($listaSucursales as $sucursal) {
                        $codigoLimpio = trim($sucursal);
                        if (!empty($codigoLimpio)) {
                            $stmtSuc->execute([$email, $codigoLimpio]);
                        }
                    }
                }
                $insertados++;
            } catch (Throwable $e) {
                // Si el correo ya existe, falla el constraint UNIQUE y lo atrapamos
                $errores[] = "Fila " . ($index + 1) . " omitida ($email): Usuario duplicado o error SQL.";
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'insertados' => $insertados, 'errores' => $errores]);
        exit;

    } catch (Throwable $e) { // Usamos Throwable para atrapar errores fatales en PHP 8
        if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Error Crítico: ' . $e->getMessage()]);
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Migración Masiva de Usuarios</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 min-h-screen p-8 font-sans">
    
    <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center">
            <h1 class="text-xl font-black text-white">🚀 Carga Masiva de Usuarios desde Excel</h1>
            <span class="text-indigo-200 text-xs font-bold bg-indigo-800 px-2 py-1 rounded">Pre-Producción</span>
        </div>
        
        <div class="p-6">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
                <p class="font-bold mb-2">Instrucciones:</p>
                <ol class="list-decimal pl-5 space-y-1">
                    <li>Asegúrese de que el orden de las columnas en su Excel sea: <b class="bg-blue-100 px-1 rounded">Correo | Nombre | Apellidos | Rol | Sucursales (separadas por coma)</b>.</li>
                    <li>Seleccione todas las celdas en Excel (incluyendo el encabezado), copie (<kbd class="bg-slate-200 px-1 rounded">Ctrl+C</kbd>) y pegue en la caja de abajo (<kbd class="bg-slate-200 px-1 rounded">Ctrl+V</kbd>).</li>
                    <li>Las contraseñas quedarán en blanco para forzar a los usuarios a configurarlas.</li>
                </ol>
            </div>

            <textarea id="paste-area" rows="12" class="w-full p-4 text-sm font-mono border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400 whitespace-pre" placeholder="Pegue los datos de Excel aquí..." wrap="off"></textarea>

            <div class="flex justify-between items-center mt-6">
                <p class="text-xs text-rose-500 font-bold">⚠️ Recuerde eliminar este archivo del servidor tras finalizar la migración.</p>
                <button id="btn-procesar" onclick="procesarCarga()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-colors flex items-center gap-2">
                    Procesar Usuarios
                </button>
            </div>

            <div id="resultado" class="mt-6 hidden"></div>
        </div>
    </div>

    <script>
        async function procesarCarga() {
            const pasteData = document.getElementById('paste-area').value.trim();
            const btn = document.getElementById('btn-procesar');
            const resDiv = document.getElementById('resultado');

            if (!pasteData) {
                alert("Por favor, pegue los datos antes de procesar.");
                return;
            }

            btn.disabled = true;
            btn.innerHTML = "Procesando...";
            resDiv.classList.add('hidden');

            try {
                // Blindaje frontend: apuntar dinámicamente a la misma URL para evitar saltos y redirecciones
                const currentUrl = window.location.href;

                const res = await fetch(currentUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pasteData })
                });

                // Blindaje: Revisar si la respuesta falló a nivel HTTP (ej. 500 Server Error)
                if (!res.ok) {
                    throw new Error("El servidor respondió con código: " + res.status);
                }

                const data = await res.json();

                if (data.success) {
                    let html = `<div class="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                                    <h3 class="text-emerald-700 font-black text-lg mb-1">✅ ¡Migración Exitosa!</h3>
                                    <p class="text-emerald-600 text-sm">Se insertaron <b>${data.insertados}</b> usuarios correctamente.</p>`;
                    
                    if (data.errores.length > 0) {
                        html += `<div class="mt-4 pt-4 border-t border-emerald-200">
                                    <h4 class="text-rose-600 font-bold text-sm mb-2">⚠️ Omitidos (${data.errores.length}):</h4>
                                    <ul class="text-xs text-slate-600 space-y-1 bg-white p-3 rounded border border-slate-200 max-h-40 overflow-y-auto">
                                        ${data.errores.map(e => `<li>${e}</li>`).join('')}
                                    </ul>
                                 </div>`;
                    }
                    html += `</div>`;
                    resDiv.innerHTML = html;
                    document.getElementById('paste-area').value = ''; // Limpiar
                } else {
                    resDiv.innerHTML = `<div class="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 font-bold">${data.error}</div>`;
                }
            } catch (err) {
                resDiv.innerHTML = `<div class="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 font-bold">Error al procesar: ${err.message}. Asegúrese de haber copiado las celdas correctamente.</div>`;
            }

            resDiv.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = "Procesar Usuarios";
        }
    </script>
</body>
</html>