/*
  Ejecutar en SQL Server (instancia que aloja ControlAccesosDB)
  Crea login de servidor y usuario de base de datos para la aplicacion.
*/

USE [master];
GO

IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = 'app')
BEGIN
    CREATE LOGIN [app] WITH PASSWORD = 'prueba123', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;
END
GO

USE [ControlAccesosDB];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'app')
BEGIN
    CREATE USER [app] FOR LOGIN [app];
END
GO

ALTER ROLE [db_datareader] ADD MEMBER [app];
ALTER ROLE [db_datawriter] ADD MEMBER [app];
GO

/*
  Si usas migraciones EF o cambios de esquema desde la app, descomenta:
  ALTER ROLE [db_ddladmin] ADD MEMBER [app];
*/
