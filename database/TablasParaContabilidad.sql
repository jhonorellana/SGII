CREATE TABLE cuenta_bancaria (
    id_cuenta_bancaria INT AUTO_INCREMENT PRIMARY KEY,
    id_persona int NOT NULL,
    id_banco int NOT NULL,
    id_tipo_cuenta int NULL,
    numero_cuenta VARCHAR(20) NULL,
    activo TINYINT DEFAULT 1,
    elimiminado TINYINT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
);