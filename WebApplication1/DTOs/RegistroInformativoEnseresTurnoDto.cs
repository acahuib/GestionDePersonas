namespace WebApplication1.DTOs
{
    public class RegistroInformativoEnseresTurnoDto
    {
        public required string Turno { get; set; }
        public string? Puesto { get; set; }
        public DateTime Fecha { get; set; }
        public required List<RegistroInformativoEnserItemDto> Objetos { get; set; }
        public List<string>? GuardiasGarita { get; set; }
        public List<GuardiaZonaTurnoDto>? GuardiasOtrasZonas { get; set; }
        public string? Observaciones { get; set; }
    }

    public class GuardiaZonaTurnoDto
    {
        public required string Guardia { get; set; }
        public required string Zona { get; set; }
    }

    public class RegistroInformativoEnserItemDto
    {
        public required string Nombre { get; set; }
        public int Cantidad { get; set; }
    }
}