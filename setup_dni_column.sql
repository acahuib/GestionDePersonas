-- =====================================================
-- Script para agregar columna Dni a SalidasDetalle
-- y preparar datos de prueba en tabla Personas
-- =====================================================

USE ControlAccesosDB;
GO

-- 1. Agregar columna Dni a SalidasDetalle
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('SalidasDetalle') 
    AND name = 'Dni'
)
BEGIN
    ALTER TABLE SalidasDetalle
    ADD Dni NVARCHAR(20) NULL;
    PRINT '✅ Columna Dni agregada a SalidasDetalle';
END
ELSE
BEGIN
    PRINT 'ℹ️ Columna Dni ya existe en SalidasDetalle';
END
GO

-- 2. Migrar DNIs existentes desde JSON a columna (si los hay)
UPDATE SalidasDetalle
SET Dni = JSON_VALUE(DatosJSON, '$.dni')
WHERE Dni IS NULL 
  AND JSON_VALUE(DatosJSON, '$.dni') IS NOT NULL;

PRINT '✅ DNIs migrados desde JSON a columna (si existían)';
GO

-- 3. Crear índice para mejorar performance del JOIN con Personas
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_SalidasDetalle_Dni' 
    AND object_id = OBJECT_ID('SalidasDetalle')
)
BEGIN
    CREATE INDEX IX_SalidasDetalle_Dni ON SalidasDetalle(Dni);
    PRINT '✅ Índice IX_SalidasDetalle_Dni creado';
END
ELSE
BEGIN
    PRINT 'ℹ️ Índice IX_SalidasDetalle_Dni ya existe';
END
GO

-- 4. (OPCIONAL) Insertar datos de prueba en tabla Personas
-- Descomentar si necesitas datos de prueba

/*
-- Verificar si ya existen datos
IF NOT EXISTS (SELECT * FROM Personas WHERE Dni IN ('12345678', '87654321', '11223344'))
BEGIN
    INSERT INTO Personas (Dni, Nombre, Tipo) VALUES
    ('12345678', 'Juan Carlos Pérez López', 'Proveedor'),
    ('87654321', 'María Elena Rodríguez García', 'Proveedor'),
    ('11223344', 'Carlos Alberto Sánchez Torres', 'PersonalLocal'),
    ('55667788', 'Ana María Fernández Díaz', 'Proveedor');
    
    PRINT '✅ Datos de prueba insertados en tabla Personas';
END
ELSE
BEGIN
    PRINT 'ℹ️ Ya existen datos de prueba en tabla Personas';
END
GO
*/

-- 5. Verificar resultado
SELECT 
    COUNT(*) as TotalPersonas,
    Tipo,
    COUNT(CASE WHEN LEN(Dni) = 8 THEN 1 END) as DnisValidos
FROM Personas
GROUP BY Tipo;

PRINT '';
PRINT '📊 Resumen de tabla Personas:';
GO

-- 6. Verificar columna Dni en SalidasDetalle
SELECT 
    COUNT(*) as TotalRegistros,
    COUNT(Dni) as ConDni,
    COUNT(*) - COUNT(Dni) as SinDni
FROM SalidasDetalle;

PRINT '';
PRINT '📊 Resumen de SalidasDetalle con columna Dni:';
GO

PRINT '';
PRINT '✅ Script completado exitosamente';
PRINT 'ℹ️ Ahora reinicia el servidor ASP.NET para aplicar los cambios';
GO
