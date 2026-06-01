<?php
require_once __DIR__ . '/db.php';
$token = $_GET['token'] ?? '';
$actorUrl = $_GET['actor'] ?? 'Usuario Externo'; 

$error = null;
$caso = null;
$historialResuelto = null;

if (empty($token)) {
    $error = "Enlace inválido o corrupto.";
} else {
    try {
        $pdo = Database::connect();
        // Buscamos el caso y extraemos quién lo creó y su justificación (Hacemos un JOIN con Usuarios)
        $stmt = $pdo->prepare("
            SELECT C.IdCaso, C.NumeroContrato, C.NombreCliente, C.MontoCRC, C.Sucursal_Relacionada, C.Estado, 
                   C.TokenAprobacionJefe, C.TokenResolucionCS, C.MotivoAgente, C.EmailCreador, 
                   ISNULL(RTRIM(U.Nombre + ' ' + ISNULL(U.Apellidos, '')), C.EmailCreador) AS CreadorNombre,
                   ISNULL(D.MontoUSD, 0) AS MontoUSD
            FROM Tbl_Casos_TSD C 
            LEFT JOIN Tbl_Usuarios U ON C.EmailCreador = U.Email 
            LEFT JOIN Tbl_CierreCaja_Detalle D ON C.IdCierreOrigen = D.IdCierre AND C.NumeroContrato = D.Numero_Contrato
            WHERE C.TokenAprobacionJefe = ? OR C.TokenResolucionCS = ?
        ");
        $stmt->execute([$token, $token]);
        $caso = $stmt->fetch();

        if (!$caso) {
            $error = "El ticket no existe o el token ha expirado.";
        } else {
            // Comprobamos la pertenencia del token
            $esTokenJefe = ($caso['TokenAprobacionJefe'] === $token);
            $esTokenCS = ($caso['TokenResolucionCS'] === $token);

            // Si ya está resuelto, buscamos en el historial QUIÉN lo resolvió (Agregamos la Accion para el rol)
            if ($caso['Estado'] === 'RESUELTO' || $caso['Estado'] === 'CERRADO') {
                $stmtH = $pdo->prepare("SELECT Accion, EmailActor, ComentarioAdicional, FechaAccion FROM Tbl_Casos_Historial WHERE IdCaso = ? AND Accion LIKE 'RESUELTO_%' ORDER BY IdHistorial DESC");
                $stmtH->execute([$caso['IdCaso']]);
                $historialResuelto = $stmtH->fetch();
            }
        }
    } catch (Exception $e) {
        $error = "Error de base de datos.";
    }
}
?>
<!DOCTYPE html>
<html lang="es" class="bg-slate-50">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resolución de Ticket - IRI</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="flex items-center justify-center min-h-screen p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
        
        <!-- Header -->
        <div class="bg-indigo-600 px-6 py-4 text-center">
            <h1 class="text-xl font-black text-white">Resolución de Ticket</h1>
            <p class="text-indigo-200 text-sm">Integración Regional de Ingresos</p>
        </div>

        <div class="p-6">
            <?php if ($error): ?>
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">⚠️</div>
                    <h2 class="text-lg font-bold text-slate-800 mb-2">Aviso del Sistema</h2>
                    <p class="text-slate-500"><?php echo $error; ?></p>
                </div>
            <?php elseif ($historialResuelto): ?>
                <!-- PANTALLA: YA RESUELTO (La carrera la ganó el otro) -->
                
                <!-- 1. Contexto del Caso (Enriquecido) -->
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 shadow-sm">
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-slate-500 font-bold uppercase text-[10px]">Contrato</span>
                        <span class="font-black text-slate-800"><?php echo htmlspecialchars($caso['NumeroContrato']); ?></span>
                    </div>
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-slate-500 font-bold uppercase text-[10px]">Cliente</span>
                        <span class="font-bold text-slate-700 text-right truncate w-48" title="<?php echo htmlspecialchars($caso['NombreCliente']); ?>">
                            <?php echo htmlspecialchars($caso['NombreCliente']); ?>
                        </span>
                    </div>
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-slate-500 font-bold uppercase text-[10px]">Sucursal</span>
                        <span class="font-bold text-slate-700"><?php echo htmlspecialchars($caso['Sucursal_Relacionada']); ?></span>
                    </div>
                    <div class="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                        <div>
                            <span class="block text-slate-500 font-bold uppercase text-[10px]">Monto Colones</span>
                            <span class="font-black text-red-600 font-mono text-base">₡<?php echo number_format($caso['MontoCRC'], 2); ?></span>
                        </div>
                        <div class="text-right border-l border-slate-200 pl-4">
                            <span class="block text-slate-500 font-bold uppercase text-[10px]">Monto Dólares</span>
                            <span class="font-black text-emerald-600 font-mono text-base">$<?php echo number_format($caso['MontoUSD'], 2); ?></span>
                        </div>
                    </div>
                </div>

                <!-- 2. Alerta de Resolución -->
                <div class="text-center py-4">
                    <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-500 mb-3 shadow-inner">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h2 class="text-lg font-black text-slate-800 mb-4">El ticket ya fue cerrado en TSD</h2>
                    
                    <!-- 3. Bitácora de Quién lo resolvió -->
                    <div class="bg-white p-4 rounded-xl border border-slate-200 text-left text-sm shadow-sm">
                        <div class="mb-2">
                            <span class="block text-[10px] font-bold text-slate-500 uppercase">Resuelto por:</span>
                            <?php 
                                // 1. Determinamos el rol según la acción guardada
                                $esJefatura = ($historialResuelto['Accion'] === 'RESUELTO_JEFATURA');
                                $badgeColor = $esJefatura ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
                                $badgeText = $esJefatura ? 'Jefatura' : 'Servicio al Cliente';
                                $rolBadge = "<span class='ml-2 inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase $badgeColor'>$badgeText</span>";

                                // 2. Intentamos usar el Email real si existe
                                $actorVisual = $historialResuelto['EmailActor'];
                                
                                // 3. Si es NULL, se resolvió por Token. Extraemos con Regex.
                                if (empty($actorVisual)) {
                                    $comentario = $historialResuelto['ComentarioAdicional'] ?? '';
                                    if (preg_match('/por:\s*(.+?)\s*\|/', $comentario, $matches)) {
                                        $actorVisual = $matches[1] . " (Vía Email)";
                                    } else {
                                        $actorVisual = "Usuario Externo";
                                    }
                                }
                            ?>
                            <span class="font-bold text-slate-800 flex items-center"><?php echo htmlspecialchars($actorVisual); ?> <?php echo $rolBadge; ?></span>
                        </div>
                        <div class="mb-2">
                            <span class="block text-[10px] font-bold text-slate-500 uppercase">Fecha:</span>
                            <span class="text-slate-600"><?php echo date('d/m/Y H:i', strtotime($historialResuelto['FechaAccion'] ?? date('Y-m-d'))); ?></span>
                        </div>
                        <?php if(!empty($historialResuelto['ComentarioAdicional'])): ?>
                        <div class="mt-3 pt-3 border-t border-slate-200">
                            <span class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notas del ajuste:</span>
                            <p class="text-slate-700 italic">"<?php echo htmlspecialchars($historialResuelto['ComentarioAdicional'] ?? ''); ?>"</p>
                        </div>
                        <?php endif; ?>
                    </div>
                </div>
            <?php elseif (($caso['Estado'] === 'PENDIENTE_VISTO_BUENO' && $esTokenJefe) || ($caso['Estado'] === 'PENDIENTE_RESOLUCION' && $esTokenCS)): ?>
                <!-- PANTALLA: APROBAR O RESOLVER CON CONTEXTO -->
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 shadow-sm">
                    <div class="flex justify-between items-center mb-3 pb-3 border-b border-slate-200">
                        <span class="text-slate-500 font-bold uppercase text-[10px]">Contrato</span>
                        <span class="font-black text-indigo-700 text-base"><?php echo $caso['NumeroContrato']; ?></span>
                    </div>
                    
                    <div class="mb-3">
                        <span class="block text-slate-500 font-bold uppercase text-[10px] mb-1">Cliente / Sucursal</span>
                        <span class="block font-bold text-slate-800 text-sm truncate"><?php echo $caso['NombreCliente']; ?></span>
                        <span class="block text-xs text-slate-600"><?php echo $caso['Sucursal_Relacionada']; ?></span>
                    </div>

                    <div class="mb-4 bg-white p-3 rounded-lg border border-slate-200">
                        <span class="block text-slate-500 font-bold uppercase text-[10px] mb-1">Solicitado por:</span>
                        <span class="block text-xs font-bold text-slate-800 mb-2">👤 <?php echo htmlspecialchars($caso['CreadorNombre']); ?></span>
                        <span class="block text-slate-500 font-bold uppercase text-[10px] mb-1">Motivo del Agente:</span>
                        <span class="block text-xs text-slate-700 italic border-l-2 border-indigo-400 pl-2">"<?php echo htmlspecialchars($caso['MotivoAgente'] ?? 'Sin justificación.'); ?>"</span>
                    </div>

                    <div class="flex justify-between items-center pt-2 border-t border-slate-200">
                        <div>
                            <span class="block text-slate-500 font-bold uppercase text-[10px] mb-0.5">Monto Colones</span>
                            <span class="font-black text-red-600 font-mono text-lg">₡<?php echo number_format($caso['MontoCRC'], 2); ?></span>
                        </div>
                        <div class="text-right border-l border-slate-200 pl-4">
                            <span class="block text-slate-500 font-bold uppercase text-[10px] mb-0.5">Monto Dólares</span>
                            <span class="font-black text-emerald-600 font-mono text-lg">$<?php echo number_format($caso['MontoUSD'], 2); ?></span>
                        </div>
                    </div>
                </div>

                <form id="form-resolver" class="space-y-4">
                    <input type="hidden" id="token" value="<?php echo htmlspecialchars($token); ?>">
                    <input type="hidden" id="actor" value="<?php echo htmlspecialchars($actorUrl); ?>">
                    
                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-2">
                            <?php echo $caso['Estado'] === 'PENDIENTE_VISTO_BUENO' ? 'Nota / Comentario de Jefatura (Opcional)' : 'Comentarios de Resolución (Opcional)'; ?>
                        </label>
                        <textarea id="comentario" rows="3" class="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-shadow" placeholder="<?php echo $caso['Estado'] === 'PENDIENTE_VISTO_BUENO' ? 'Indique la resolución (si lo cierra) o una nota (si lo escala a SC)...' : 'Escriba aquí los ajustes realizados en TSD...'; ?>"></textarea>
                    </div>

                    <div id="botones-container" class="mt-4">
                        <?php if ($caso['Estado'] === 'PENDIENTE_VISTO_BUENO'): ?>
                            <div class="flex flex-col gap-3">
                                <button type="button" onclick="enviarAccion('RESOLVER')" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors flex justify-center items-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                    Cerrar y Marcar como Resuelto
                                </button>
                                <button type="button" onclick="enviarAccion('ESCALAR_SC')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors flex justify-center items-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                                    Escalar a SC
                                </button>
                            </div>
                        <?php else: ?>
                            <button type="button" onclick="enviarAccion('RESOLVER')" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors flex justify-center items-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                Marcar como Resuelto
                            </button>
                        <?php endif; ?>
                    </div>
                </form>

                <div id="msg-box" class="hidden mt-4 text-center text-sm font-bold p-3 rounded-lg"></div>
            <?php else: ?>
                <!-- PANTALLA: ESTADO INTERMEDIO O DENEGADO -->
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">⏳</div>
                    <h2 class="text-lg font-bold text-slate-800 mb-2">Acción no disponible</h2>
                    <p class="text-slate-500">
                        <?php 
                            if ($caso['Estado'] === 'PENDIENTE_RESOLUCION' && $esTokenJefe) {
                                echo "Ya has dado tu visto bueno a este ticket. Actualmente se encuentra en manos de Servicio al Cliente.";
                            } else {
                                echo "Este enlace no es válido para el estado actual del ticket.";
                            }
                        ?>
                    </p>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <script>
        const form = document.getElementById('form-resolver');
        const msgBox = document.getElementById('msg-box');

        async function enviarAccion(tipoAccion) {
            const btnContainer = document.getElementById('botones-container');
            const originalBtns = btnContainer.innerHTML;
            
            btnContainer.innerHTML = '<div class="w-full text-center py-3 bg-slate-100 text-slate-500 font-bold rounded-xl animate-pulse">Procesando...</div>';
            if (msgBox) msgBox.classList.add('hidden');

            try {
                const res = await fetch('api/procesar_resolucion_cc.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: document.getElementById('token').value,
                        comentario: document.getElementById('comentario').value,
                        actor: document.getElementById('actor').value,
                        accion: tipoAccion
                    })
                });
                const data = await res.json();

                if (data.success) {
                    if (tipoAccion === 'ESCALAR_SC') {
                        form.innerHTML = '<div class="text-center py-6"><div class="text-5xl mb-4">↗️</div><h2 class="text-xl font-bold text-indigo-600 mb-2">¡Escalado!</h2><p class="text-slate-500 text-sm">El ticket ha sido escalado a Servicio al Cliente.</p></div>';
                    } else {
                        form.innerHTML = '<div class="text-center py-6"><div class="text-5xl mb-4">🎉</div><h2 class="text-xl font-bold text-green-600 mb-2">¡Ajuste Guardado!</h2><p class="text-slate-500 text-sm">El caso ha sido cerrado y marcado como resuelto.</p></div>';
                    }
                } else {
                    if (msgBox) {
                        msgBox.innerText = data.error;
                        msgBox.className = 'mt-4 text-center text-sm font-bold p-3 rounded-lg bg-red-100 text-red-600 block';
                    }
                    btnContainer.innerHTML = originalBtns; 
                }
            } catch (err) {
                if (msgBox) {
                    msgBox.innerText = 'Error de conexión. Intente nuevamente.';
                    msgBox.className = 'mt-4 text-center text-sm font-bold p-3 rounded-lg bg-red-100 text-red-600 block';
                }
                btnContainer.innerHTML = originalBtns; 
            }
        }
        
        if(form) {
            form.addEventListener('submit', e => e.preventDefault());
        }
    </script>
</body>
</html>