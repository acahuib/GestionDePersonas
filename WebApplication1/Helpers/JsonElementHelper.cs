using System.Globalization;
using System.Text.Json;

namespace WebApplication1.Helpers
{
    public static class JsonElementHelper
    {
        public static string? GetString(JsonElement root, string key)
        {
            return root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : null;
        }

        public static string? GetString(JsonElement root, params string[] keys)
        {
            foreach (var key in keys)
            {
                var value = GetString(root, key);
                if (!string.IsNullOrWhiteSpace(value))
                    return value;
            }

            return null;
        }

        public static int? GetInt(JsonElement root, string key)
        {
            if (!root.TryGetProperty(key, out var value))
                return null;

            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number))
                return number;

            if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var asText))
                return asText;

            return null;
        }

        public static int? GetInt(JsonElement root, params string[] keys)
        {
            foreach (var key in keys)
            {
                var value = GetInt(root, key);
                if (value.HasValue)
                    return value;
            }

            return null;
        }

        public static DateTime? GetDateTime(JsonElement root, string key)
        {
            if (!root.TryGetProperty(key, out var value) || value.ValueKind == JsonValueKind.Null)
                return null;

            if (value.ValueKind == JsonValueKind.String &&
                DateTime.TryParse(value.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed))
                return parsed;

            try
            {
                return value.GetDateTime();
            }
            catch
            {
                return null;
            }
        }
    }
}
