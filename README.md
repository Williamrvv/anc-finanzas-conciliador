# Sistema de Conciliación Financiera ANC (v2.0)

Sistema web SPA (Single Page Application) diseñado para automatizar el cruce y validación de cierres de caja entre reportes internos (TSD) y estados de cuenta bancarios (BAC Credomatic y Scotiabank).

## 🚀 Visión General

El objetivo es eliminar la conciliación manual en Excel. El sistema ingesta archivos crudos (CSV/Excel), normaliza los datos en memoria (Client-Side), ejecuta algoritmos de emparejamiento por IDs únicos y permite la gestión visual de discrepancias antes de persistir la información.

---

## 🛠️ Stack Tecnológico

*   **Infraestructura:** Docker (PHP 8.2 + Apache + SQL Server Drivers).
*   **Frontend:** JavaScript Vanilla (ES6+) con arquitectura modular.
*   **Estilos:** Tailwind CSS (Modo Oscuro/Claro automático).
*   **Backend:** PHP Puro (Enrutador y Proxy de Autenticación).
*   **Base de Datos:** SQL Server 2022 (Conexión vía ODBC 18).
*   **Librerías:**
    *   `SheetJS (xlsx)`: Lectura de archivos Excel/CSV en el navegador.
    *   `VanillaGrid.js`: Motor propio de tablas de alto rendimiento.

---

## 📂 Estructura del Proyecto

```text
/src
├── js/
│   ├── app.js              # Router SPA y Manejo de Temas.
│   ├── conciliacion_ui.js  # CONTROLADOR: Orquestación de eventos y UI.
│   ├── vanilla_grid.js     # MOTOR: Renderizado de tablas dinámicas.
│   ├── bac_logic.js        # MÓDULO: Lógica de negocio BAC (Mixin).
│   ├── scotia_logic.js     # MÓDULO: Lógica de negocio Scotiabank (Mixin).
│   └── tsd_logic.js        # MÓDULO: Lógica de negocio TSD (Mixin).
├── views/                  # Vistas HTML parciales (Dashboard, Conciliación).
├── db.php                  # Singleton de conexión a SQL Server.
└── index.php               # Entry Point.
✨ Funcionalidades Implementadas
1. Motor de Tablas (vanilla_grid.js)

Un componente de UI personalizado para manejar grandes volúmenes de datos financieros.

Sticky Headers & Columns: Encabezados y columnas de control (checkbox) fijos al hacer scroll.

Smart Sorting: Ordenamiento inteligente (detecta montos vs texto).

Drag & Drop: Reordenamiento visual de columnas.

Agrupación: Agrupa filas por cualquier columna con un clic.

Autosuma: Selección tipo Excel (arrastrar mouse) que muestra Suma y Recuento en tiempo real.

Filtros y Búsqueda: Buscador global y filtros por columna con resaltado (Highlight).

2. Conciliación BAC (bac_logic.js)

Multi-Archivo: Soporta la carga (Drag & Drop) de múltiples CSVs (Detalle) y Excels (Pagado) simultáneamente.

Validación:

Detecta duplicados y alerta al usuario.

Valida estructura de columnas (Neto, Comisión, Créditos).

Lógica Financiera:

Cálculo automático: Neto Esperado = Monto Neto - Ajuste Comisión Int (ACI).

Extracción de IDs: Parsea descripciones bancarias para obtener AFI y LIQ (Referencias).

Algoritmo de Cruce (runMatch):

Agrupa ventas y depósitos por Afiliado.

Compara montos con tolerancia de redondeo (±5 colones).

Clasifica automáticamente en: Conciliado (Verde) o Excepción (Rojo).

3. Conciliación Scotiabank (scotia_logic.js)

Procesamiento de Bloques: Detecta secciones de "Lotes" vs "Ajustes" en el Excel.

Inversión de Signo: Convierte automáticamente los ajustes a negativo para la resta correcta.

Validación MerID: Filtra filas basura y subtotales, procesando solo transacciones con ID de comercio válido.

4. Consolidado TSD (tsd_logic.js)

Normalización: Limpia el reporte maestro TSD eliminando filas decorativas.

Conversión Divisas: Aplica Tipo de Cambio (TC) en tiempo real a montos en USD.

Cruce Final: Compara TSD vs (BAC + Scotia) usando el número de autorización.

5. Gestión de Discrepancias (Auditoría)

Tablas Separadas: Los datos conciliados van a la tabla principal; las diferencias van a una tabla de "Excepciones" inferior.

Análisis Detallado: Doble clic en cualquier fila abre un PopUp Comparativo que muestra lado a lado las ventas vs los depósitos que componen ese registro.

Diferimiento (Arrastre de Saldos):

Permite seleccionar transacciones específicas en el PopUp y "Diferirlas".

Estas filas se excluyen del cálculo actual y se mueven a una tabla de "Saldos Pendientes" (para conciliar mañana).

La operación es reversible.

🖥️ Interfaz de Usuario (UX)

Modo Oscuro/Claro: Persistente y detectado automáticamente.

Listas de Archivos: Indicadores visuales de cuántos archivos se han cargado, con lista desplegable y opción de eliminar individualmente.

Feedback: Mensajes de estado, loaders y alertas no intrusivas.

PopUps Nativos: Ventanas secundarias para aprovechar configuraciones multi-monitor.

🚀 Despliegue (Docker)

El proyecto incluye un entorno completo en Docker.

code
Bash
download
content_copy
expand_less
# Levantar el entorno (reconstruyendo si es necesario)
docker-compose up -d --build

# Acceso
# Web: https://localhost:4435

Las credenciales de base de datos y puertos se configuran en el archivo .env.

