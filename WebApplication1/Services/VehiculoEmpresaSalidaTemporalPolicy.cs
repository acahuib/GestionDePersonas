namespace WebApplication1.Services
{
    /// <summary>
    /// Politica temporal para permitir registrar SALIDA de VehiculoEmpresa
    /// cuando no existe entrada previa en garita.
    ///
    /// Para desactivar sin tocar codigo, poner en appsettings:
    /// Features:VehiculoEmpresaPermitirSalidaSinEntradaTemporal = false
    /// </summary>
    public class VehiculoEmpresaSalidaTemporalPolicy
    {
        private readonly IConfiguration _configuration;

        public VehiculoEmpresaSalidaTemporalPolicy(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public bool PermitirSalidaSinEntradaTemporal()
        {
            return _configuration.GetValue<bool>("Features:VehiculoEmpresaPermitirSalidaSinEntradaTemporal");
        }
    }
}