using Dapper;
using System.Data;
using System.Text;

namespace AscendAPI.Helpers;

/// <summary>
/// Builds parameterised WHERE clauses for outboundmaster (om) + outboundmaster_detail (od) queries.
/// </summary>
public static class FilterHelper
{
    /// <summary>
    /// SQL expression to extract insurance name from the UniqueIndetifier prefix.
    /// e.g. "Aetna_12345" → "Aetna"
    /// </summary>
    public const string INS_EXPR =
        "LEFT(od.UniqueIndetifier, CHARINDEX(N'_', od.UniqueIndetifier + N'_') - 1)";

    /// <summary>
    /// Parse standard filter query-string parameters.
    /// </summary>
    public static FilterParams Parse(
        string? from, string? to,
        string? insurance, string? practice,
        string? dnis, string? callType)
    {
        return new FilterParams
        {
            From = string.IsNullOrWhiteSpace(from) ? null : DateTime.Parse(from),
            To = string.IsNullOrWhiteSpace(to) ? null : DateTime.Parse(to),
            Insurance = SplitCsv(insurance),
            Practice = SplitCsv(practice),
            Dnis = SplitCsv(dnis),
            CallType = SplitCsv(callType),
        };
    }

    /// <summary>
    /// Build a WHERE clause (with leading WHERE keyword when non-empty) and DynamicParameters.
    /// Aliases: om = outboundmaster, od = outboundmaster_detail.
    /// </summary>
    public static (string WhereSQL, DynamicParameters Params) BuildWhereClause(FilterParams f)
    {
        var conditions = new List<string>();
        var dp = new DynamicParameters();

        if (f.From.HasValue)
        {
            conditions.Add("om.CallDate >= @dateFrom");
            // Normalize to start of day to avoid UTC offset cutting off the boundary day
            dp.Add("dateFrom", f.From.Value.Date, DbType.DateTime);
        }
        if (f.To.HasValue)
        {
            conditions.Add("om.CallDate <= @dateTo");
            // Normalize to end of day so the full day is included
            dp.Add("dateTo", f.To.Value.Date.AddDays(1).AddTicks(-1), DbType.DateTime);
        }
        if (f.Insurance.Length > 0)
        {
            var orParts = new List<string>();
            for (int i = 0; i < f.Insurance.Length; i++)
            {
                var pName = $"ins{i}";
                orParts.Add($"od.UniqueIndetifier LIKE @{pName} + N'_%'");
                dp.Add(pName, f.Insurance[i], DbType.String);
            }
            conditions.Add($"({string.Join(" OR ", orParts)})");
        }
        if (f.Practice.Length > 0)
        {
            var names = new List<string>();
            for (int i = 0; i < f.Practice.Length; i++)
            {
                var pName = $"prac{i}";
                names.Add($"@{pName}");
                dp.Add(pName, f.Practice[i], DbType.String);
            }
            conditions.Add($"od.PracticeCode IN ({string.Join(",", names)})");
        }
        if (f.Dnis.Length > 0)
        {
            var names = new List<string>();
            for (int i = 0; i < f.Dnis.Length; i++)
            {
                var pName = $"dnis{i}";
                names.Add($"@{pName}");
                dp.Add(pName, f.Dnis[i], DbType.String);
            }
            conditions.Add($"RTRIM(od.IVR_Insurance) IN ({string.Join(",", names)})");
        }

        var whereSQL = conditions.Count > 0 ? $"WHERE {string.Join(" AND ", conditions)}" : "";
        return (whereSQL, dp);
    }

    /// <summary>
    /// Format a DateTime to a short US date string like "Jun 10" (matching the JS frontend).
    /// </summary>
    public static string FormatShortDate(DateTime dt) =>
        dt.ToString("MMM dd", System.Globalization.CultureInfo.InvariantCulture);

    private static string[] SplitCsv(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return Array.Empty<string>();
        return value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }
}

public class FilterParams
{
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public string[] Insurance { get; set; } = Array.Empty<string>();
    public string[] Practice { get; set; } = Array.Empty<string>();
    public string[] Dnis { get; set; } = Array.Empty<string>();
    public string[] CallType { get; set; } = Array.Empty<string>();
}
