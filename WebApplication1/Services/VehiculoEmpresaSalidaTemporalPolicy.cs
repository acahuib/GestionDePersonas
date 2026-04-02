// Archivo backend para VehiculoEmpresaSalidaTemporalPolicy.

namespace WebApplication1.Services
{
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

