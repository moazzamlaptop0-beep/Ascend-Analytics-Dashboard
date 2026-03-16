using AscendAPI.Helpers;
using AscendAPI.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using System.Data;

namespace AscendAPI.Controllers;

/// <summary>
/// Operations API - Paginated call log table + detail view.
/// Mirrors the Node.js Express endpoints exactly.
/// </summary>
[ApiController]
[Route("api/operations")]
public class OperationsController : ControllerBase
{
    private readonly DbService _db;
    public OperationsController(DbService db) => _db = db;

    private static string? NormalizeCallIdSearch(string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return null;

        var trimmed = search.Trim();
        if (trimmed.StartsWith("CALL-", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[5..];
        }

        if (!trimmed.All(char.IsDigit)) return null;

        trimmed = trimmed.TrimStart('0');
        return string.IsNullOrEmpty(trimmed) ? "0" : trimmed;
    }

    private static readonly Dictionary<string, string> SortMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["CallDate"] = "om.CallDate",
        ["CallInTime"] = "om.CallInTime",
        ["CallID"] = "od.ID",
        ["Insurance"] = FilterHelper.INS_EXPR,
        ["DNIS"] = "od.IVR_Insurance",
        ["Practice"] = "od.PracticeCode",
        ["Status"] = "od.Status",
        ["ClaimNo"] = "od.ClaimNo",
        ["NoOfClaims"] = "od.NoOfClaims",
        ["UniqueId"] = "od.UniqueIndetifier",
        ["BatchStatus"] = "om.Status",
    };

    // GET /api/operations/logs
    [HttpGet("logs")]
    public async Task<IActionResult> Logs(
        int page = 1, int size = 50, string sort = "CallDate", string dir = "desc",
        string? search = null,
        string? from = null, string? to = null,
        string? insurance = null, string? practice = null,
        string? dnis = null, string? status = null)
    {
        page = Math.Max(1, page);
        size = Math.Clamp(size, 1, 200);
        string sortExpr = SortMap.GetValueOrDefault(sort, "om.CallDate");
        string sortDir = dir == "asc" ? "ASC" : "DESC";
        int offset = (page - 1) * size;

        // Build WHERE
        var conditions = new List<string>();
        var dp = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(from))
        {
            conditions.Add("om.CallDate >= @dateFrom");
            dp.Add("dateFrom", DateTime.Parse(from), DbType.DateTime);
        }
        if (!string.IsNullOrWhiteSpace(to))
        {
            conditions.Add("om.CallDate <= @dateTo");
            dp.Add("dateTo", DateTime.Parse(to), DbType.DateTime);
        }

        var insurances = FilterHelper.Parse(null, null, insurance, null, null, null).Insurance;
        if (insurances.Length > 0)
        {
            var orParts = new List<string>();
            for (int i = 0; i < insurances.Length; i++)
            {
                orParts.Add($"od.UniqueIndetifier LIKE @ins{i} + N'_%'");
                dp.Add($"ins{i}", insurances[i], DbType.String);
            }
            conditions.Add($"({string.Join(" OR ", orParts)})");
        }

        var practices = string.IsNullOrWhiteSpace(practice) ? Array.Empty<string>()
            : practice.Split(',', StringSplitOptions.RemoveEmptyEntries);
        if (practices.Length > 0)
        {
            var names = new List<string>();
            for (int i = 0; i < practices.Length; i++)
            {
                names.Add($"@prac{i}");
                dp.Add($"prac{i}", practices[i], DbType.String);
            }
            conditions.Add($"od.PracticeCode IN ({string.Join(",", names)})");
        }

        var dnisArr = string.IsNullOrWhiteSpace(dnis) ? Array.Empty<string>()
            : dnis.Split(',', StringSplitOptions.RemoveEmptyEntries);
        if (dnisArr.Length > 0)
        {
            var names = new List<string>();
            for (int i = 0; i < dnisArr.Length; i++)
            {
                names.Add($"@dnis{i}");
                dp.Add($"dnis{i}", dnisArr[i], DbType.String);
            }
            conditions.Add($"RTRIM(od.IVR_Insurance) IN ({string.Join(",", names)})");
        }

        var statuses = string.IsNullOrWhiteSpace(status) ? Array.Empty<string>()
            : status.Split(',', StringSplitOptions.RemoveEmptyEntries);
        if (statuses.Length > 0)
        {
            var names = new List<string>();
            for (int i = 0; i < statuses.Length; i++)
            {
                names.Add($"@st{i}");
                dp.Add($"st{i}", statuses[i], DbType.String);
            }
            conditions.Add($"RTRIM(od.Status) IN ({string.Join(",", names)})");
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var trimmedSearch = search.Trim();
            var normalizedCallIdSearch = NormalizeCallIdSearch(trimmedSearch);

            conditions.Add(@"(od.ClaimNo LIKE N'%' + @search + N'%'
                OR od.UniqueIndetifier LIKE N'%' + @search + N'%'
                OR RTRIM(od.IVR_Insurance) LIKE N'%' + @search + N'%'
                OR od.Transcription LIKE N'%' + @search + N'%'
                OR (@searchCallId IS NOT NULL AND CAST(od.ID AS VARCHAR) = @searchCallId))");
            dp.Add("search", trimmedSearch, DbType.String);
            dp.Add("searchCallId", normalizedCallIdSearch, DbType.String);
        }

        string whereSQL = conditions.Count > 0 ? $"WHERE {string.Join(" AND ", conditions)}" : "";

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;

        // Count
        int total = await conn.ExecuteScalarAsync<int>($@"
            SELECT COUNT(*)
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            {whereSQL}", dp);

        // Add pagination params
        dp.Add("offset", offset, DbType.Int32);
        dp.Add("pageSize", size, DbType.Int32);

        // Fetch page
        var rows = await conn.QueryAsync<dynamic>($@"
            SELECT od.ID AS CallID,
                   CAST(om.CallDate AS DATE) AS CallDate,
                   om.CallInTime,
                   RTRIM(od.IVR_Insurance) AS DNIS,
                   RTRIM(od.IVR_Ascend) AS AscendExt,
                   {FilterHelper.INS_EXPR} AS Insurance,
                   RTRIM(od.PracticeCode) AS Practice,
                   RTRIM(od.Status) AS Status,
                   COALESCE(ocs.Description, 'Status: ' + RTRIM(od.Status)) AS StatusDescription,
                   od.ClaimNo,
                   od.NoOfClaims,
                   RTRIM(od.UniqueIndetifier) AS UniqueId,
                   RTRIM(om.Status) AS BatchStatus,
                   LEFT(od.Transcription, 200) AS TranscriptionPreview
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            LEFT JOIN outboundCallStatus ocs ON RTRIM(od.Status) = RTRIM(ocs.CallStatus)
            {whereSQL}
            ORDER BY {sortExpr} {sortDir}
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY", dp);

        return Ok(new
        {
            rows,
            total,
            page,
            pageSize = size,
            totalPages = (int)Math.Ceiling((double)total / size),
        });
    }

    // GET /api/operations/detail/{id}
    [HttpGet("detail/{id:int}")]
    public async Task<IActionResult> Detail(int id)
    {
        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;

        var row = await conn.QueryFirstOrDefaultAsync<dynamic>($@"
            SELECT od.ID AS CallID,
                   CAST(om.CallDate AS DATE) AS CallDate,
                   om.CallInTime,
                   RTRIM(od.IVR_Insurance) AS DNIS,
                   RTRIM(od.IVR_Ascend) AS AscendExt,
                   {FilterHelper.INS_EXPR} AS Insurance,
                   RTRIM(od.PracticeCode) AS Practice,
                   RTRIM(od.Status) AS Status,
                   COALESCE(ocs.Description, RTRIM(od.Status)) AS StatusDescription,
                   od.ClaimNo,
                   od.NoOfClaims,
                   RTRIM(od.UniqueIndetifier) AS UniqueId,
                   RTRIM(om.Status) AS BatchStatus,
                   RTRIM(om.Remarks) AS BatchRemarks,
                   od.Transcription
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            LEFT JOIN outboundCallStatus ocs ON RTRIM(od.Status) = RTRIM(ocs.CallStatus)
            WHERE od.ID = @callId", new { callId = id });

        if (row == null)
            return NotFound(new { error = "Record not found" });

        var eav = await conn.QueryAsync<dynamic>(@"
            SELECT Name AS promptId, Value
            FROM outboundmaster_detail_data
            WHERE DID = @callId
            ORDER BY Name", new { callId = id });

        // Merge detailData into the response
        var dict = (IDictionary<string, object>)row;
        dict["detailData"] = eav;

        return Ok(dict);
    }
}
