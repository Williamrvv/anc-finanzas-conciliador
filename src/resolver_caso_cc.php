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
        // Buscamos el caso usando cualquiera de los dos tokens
        $stmt = $pdo->prepare("SELECT IdCaso, NumeroContrato, NombreCliente, MontoCRC, Sucursal_Relacionada, Estado, TokenAprobacionJefe, TokenResolucionCS FROM Tbl_Casos_TSD WHERE TokenAprobacionJefe = ? OR TokenResolucionCS = ?");
        $stmt->execute([$token, $token]);
        $caso = $stmt->fetch();

        if (!$caso) {
            $error = "El ticket no existe o el token ha expirado.";
        } else {
            // Si ya está resuelto, buscamos en el historial QUIÉN lo resolvió
            if ($caso['Estado'] === 'RESUELTO' || $caso['Estado'] === 'CERRADO') {
                $stmtH = $pdo->prepare("SELECT EmailActor, ComentarioAdicional, FechaAccion FROM Tbl_Casos_Historial WHERE IdCaso = ? AND Accion LIKE 'RESUELTO_%' ORDER BY IdHistorial DESC");
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
                    <div class="flex justify-between text-sm pt-2 border-t border-slate-200 mt-2">
                        <span class="text-slate-500 font-bold uppercase text-[10px]">Monto colones</span>
                        <span class="font-black text-red-600 font-mono">₡<?php echo number_format($caso['MontoCRC'], 2); ?></span>
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
                                // 1. Intentamos usar el Email real si existe (logueado en el sistema)
                                $actorVisual = $historialResuelto['EmailActor'];
                                
                                // 2. Si es NULL, sabemos que se resolvió por Token (Correo Externo).
                                // Extraemos el nombre que escondimos en el ComentarioAdicional usando Regex.
                                if (empty($actorVisual)) {
                                    $comentario = $historialResuelto['ComentarioAdicional'] ?? '';
                                    // Buscamos el texto entre "Resuelto vía Correo por: " y el pipe " | "
                                    if (preg_match('/por:\s*(.+?)\s*\|/', $comentario, $matches)) {
                                        $actorVisual = $matches[1] . " (Vía Email)";
                                    } else {
                                        $actorVisual = "Servicio al Cliente (Externo)";
                                    }
                                }
                            ?>
                            <span class="font-bold text-slate-800"><?php echo htmlspecialchars($actorVisual); ?></span>
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
            <?php else: ?>
                <!-- PANTALLA: RESOLVER (Aún está pendiente) -->
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-slate-500 font-bold uppercase text-[10px]">Contrato</span>
                        <span class="font-black text-slate-800"><?php echo $caso['NumeroContrato']; ?></span>
                    </div>
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-slate-500 font-bold uppercase text-[10px]">Cliente</span>
                        <span class="font-bold text-slate-700 text-right truncate w-48"><?php echo $caso['NombreCliente']; ?></span>
                    </div>
                    <div class="flex justify-between text-sm pt-2 border-t border-slate-200">
                        <span class="text-slate-500 font-bold uppercase text-[10px]">Diferencia CRC</span>
                        <span class="font-black text-red-600 font-mono">₡<?php echo number_format($caso['MontoCRC'], 2); ?></span>
                    </div>
                </div>

                <form id="form-resolver" class="space-y-4">
                    <input type="hidden" id="token" value="<?php echo htmlspecialchars($token); ?>">
                    <input type="hidden" id="actor" value="<?php echo htmlspecialchars($actorUrl); ?>">
                    
                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-2">Comentarios de Resolución (Opcional)</label>
                        <textarea id="comentario" rows="3" class="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-shadow" placeholder="Escriba aquí los ajustes realizados en TSD..."></textarea>
                    </div>

                    <button type="submit" id="btn-submit" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors flex justify-center items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Marcar como Resuelto
                    </button>
                </form>

                <div id="msg-box" class="hidden mt-4 text-center text-sm font-bold p-3 rounded-lg"></div>
            <?php endif; ?>
        </div>
    </div>

    <script>
        const form = document.getElementById('form-resolver');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btn-submit');
                const msgBox = document.getElementById('msg-box');
                
                btn.disabled = true;
                btn.innerHTML = 'Procesando...';

                try {
                    const res = await fetch('api/procesar_resolucion_cc.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token: document.getElementById('token').value,
                            comentario: document.getElementById('comentario').value,
                            actor: document.getElementById('actor').value
                        })
                    });
                    const data = await res.json();

                    if (data.success) {
                        form.innerHTML = '<div class="text-center py-6"><div class="text-5xl mb-4">🎉</div><h2 class="text-xl font-bold text-green-600 mb-2">¡Ajuste Guardado!</h2><p class="text-slate-500 text-sm">El caso ha sido marcado como resuelto.</p></div>';
                    } else {
                        msgBox.innerText = data.error;
                        msgBox.className = 'mt-4 text-center text-sm font-bold p-3 rounded-lg bg-red-100 text-red-600 block';
                        btn.disabled = false;
                        btn.innerHTML = 'Reintentar';
                    }
                } catch (err) {
                    msgBox.innerText = 'Error de conexión.';
                    msgBox.classList.remove('hidden');
                    btn.disabled = false;
                }
            });
        }
    </script>
</body>
</html>