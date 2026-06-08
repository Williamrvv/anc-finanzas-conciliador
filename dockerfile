FROM php:8.2-apache

# Instalar dependencias del sistema y gnupg para las llaves de Microsoft
RUN apt-get update && apt-get install -y \
    gnupg2 \
    unixodbc-dev \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Agregar repositorio de Microsoft y drivers ODBC (Compatible Debian 12)
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl https://packages.microsoft.com/config/debian/12/prod.list | tee /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 mssql-tools18 \
    && echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc

# Instalar extensiones PHP para SQL Server
RUN pecl install sqlsrv-5.11.1 pdo_sqlsrv-5.11.1 \
    && docker-php-ext-enable sqlsrv pdo_sqlsrv

# Habilitar mod_rewrite de Apache
RUN a2enmod rewrite

# --- INICIO BLOQUE SSL ---
# 1. Habilitar SSL en Apache
RUN a2enmod ssl

# 2. Generar certificado autofirmado (valido por 365 días)
# Se guarda en las rutas por defecto de Debian/Apache (snakeoil) para facilitar la config
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/ssl-cert-snakeoil.key \
    -out /etc/ssl/certs/ssl-cert-snakeoil.pem \
    -subj "/C=CR/ST=SanJose/L=SanJose/O=ANC/OU=Finanzas/CN=localhost"

# 3. Habilitar el sitio default-ssl (que usa los certificados generados arriba)
RUN a2ensite default-ssl
# --- FIN BLOQUE SSL ---

# Copiar configuración (opcional, dejamos el workdir estándar)
WORKDIR /var/www/html