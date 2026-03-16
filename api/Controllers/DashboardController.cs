using AscendAPI.Helpers;
using AscendAPI.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using System.Data;

namespace AscendAPI.Controllers;

/// <summary>
/// Dashboard API - All 17 IVR metrics.
/// Mirrors the Node.js Express endpoints exactly so the React frontend works unchanged.
/// </summary>
[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly DbService _db;
    private readonly MetricDefinitionService _metricDefinitions;

    public DashboardController(DbService db, MetricDefinitionService metricDefinitions)
    {
        _db = db;
        _metricDefinitions = metricDefinitions;
    }

    private static string FormatDurationLong(long seconds)
    {
        if (seconds < 0) seconds = 0;
        if (seconds < 60) return $"{seconds}s";

        long mins = seconds / 60;
        long secs = seconds % 60;
        if (mins < 60) return $"{mins}m {secs}s";

        long hrs = mins / 60;
        long remainMins = mins % 60;
        if (hrs < 24) return $"{hrs}h {remainMins}m";

        long days = hrs / 24;
        long remainHours = hrs % 24;
        return $"{days}d {remainHours}h";
    }

    private static string FormatDurationShort(double seconds)
    {
        if (seconds < 0) seconds = 0;

        long mins = (long)Math.Floor(seconds / 60d);
        int secs = (int)Math.Round(seconds % 60d, MidpointRounding.AwayFromZero);

        if (secs == 60)
        {
            mins += 1;
            secs = 0;
        }

        return $"{mins}m {secs:00}s";
    }

    private static (string WhereSQL, DynamicParameters Params) BuildDateRangeWhereClause(
        string columnSql,
        string? from,
        string? to,
        string paramPrefix)
    {
        var conditions = new List<string>();
        var dp = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(from))
        {
            conditions.Add($"{columnSql} >= @{paramPrefix}From");
            dp.Add($"{paramPrefix}From", DateTime.Parse(from).Date, DbType.DateTime);
        }

        if (!string.IsNullOrWhiteSpace(to))
        {
            conditions.Add($"{columnSql} <= @{paramPrefix}To");
            dp.Add($"{paramPrefix}To", DateTime.Parse(to).Date.AddDays(1).AddTicks(-1), DbType.DateTime);
        }

        return (conditions.Count > 0 ? $"WHERE {string.Join(" AND ", conditions)}" : string.Empty, dp);
    }

    // ═══════════════════════════════════════════════════════
    // Metric Definitions Catalog
    // GET /api/dashboard/metric-definitions
    // GET /api/dashboard/metric-definitions/{metric}
    // ═══════════════════════════════════════════════════════
    [HttpGet("metric-definitions")]
    public IActionResult MetricDefinitions()
    {
        var metrics = _metricDefinitions.GetAll();
        return Ok(new
        {
            version = _metricDefinitions.Version,
            updatedAtUtc = _metricDefinitions.UpdatedAtUtc,
            count = metrics.Count,
            metrics,
        });
    }

    [HttpGet("metric-definitions/{metric}")]
    public IActionResult MetricDefinitionById(string metric)
    {
        var definition = _metricDefinitions.GetByMetric(metric);
        if (definition is null)
        {
            return NotFound(new
            {
                error = $"Metric definition not found for '{metric}'.",
            });
        }

        return Ok(definition);
    }

    // ═══════════════════════════════════════════════════════
    // M1: Total Calls Initiated
    // GET /api/dashboard/total-calls
    // ═══════════════════════════════════════════════════════
    [HttpGet("total-calls")]
    public async Task<IActionResult> TotalCalls(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT CAST(om.CallDate AS DATE) AS callDate,
                   COUNT(od.ID) AS callCount
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            {whereSQL}
            GROUP BY CAST(om.CallDate AS DATE)
            ORDER BY callDate", p)).AsList();

        int total = rows.Sum(r => (int)r.callCount);
        int avgDaily = rows.Count > 0 ? (int)Math.Round((double)total / rows.Count) : 0;
        string trend = "0.0";
        if (rows.Count >= 2)
        {
            int last = (int)rows[^1].callCount;
            int prev = (int)rows[^2].callCount;
            trend = (prev == 0 ? 0 : ((last - prev) / (double)prev * 100)).ToString("F1");
        }

        return Ok(new
        {
            total,
            avgDaily,
            trend,
            trendData = rows.Select(r => new
            {
                date = FilterHelper.FormatShortDate((DateTime)r.callDate),
                value = (int)r.callCount,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M2: Successful Connection Rate
    // GET /api/dashboard/connection-rate
    // ═══════════════════════════════════════════════════════
    [HttpGet("connection-rate")]
    public async Task<IActionResult> ConnectionRate(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT CAST(om.CallDate AS DATE) AS callDate,
                   COUNT(od.ID) AS total,
                   SUM(CASE WHEN RTRIM(od.Status) NOT IN ('R','D','Q') THEN 1 ELSE 0 END) AS connected
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            {whereSQL}
            GROUP BY CAST(om.CallDate AS DATE)
            ORDER BY callDate", p)).AsList();

        int totalAll = rows.Sum(r => (int)r.total);
        int totalConnected = rows.Sum(r => (int)r.connected);
        double current = totalAll > 0 ? Math.Round((double)totalConnected / totalAll * 100, 1) : 0;

        var trendData = rows.Select(r =>
        {
            int t = (int)r.total;
            int c = (int)r.connected;
            return new
            {
                date = FilterHelper.FormatShortDate((DateTime)r.callDate),
                value = t > 0 ? Math.Round((double)c / t * 100, 1) : 0,
            };
        }).ToList();

        double latest = trendData.Count > 0 ? trendData[^1].value : 0;
        double prev = trendData.Count > 1 ? trendData[^2].value : 0;

        return Ok(new
        {
            current,
            trend = Math.Round(latest - prev, 1),
            connected = totalConnected,
            initiated = totalAll,
            trendData,
        });
    }

    // ═══════════════════════════════════════════════════════
    // M3: Call Drop / Fail Rate
    // GET /api/dashboard/drop-rate
    // ═══════════════════════════════════════════════════════
    [HttpGet("drop-rate")]
    public async Task<IActionResult> DropRate(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT {FilterHelper.INS_EXPR} AS Insurance,
                   COUNT(od.ID) AS total,
                   SUM(CASE WHEN RTRIM(od.Status) = 'F' THEN 1 ELSE 0 END) AS dropped
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            {whereSQL}
            GROUP BY {FilterHelper.INS_EXPR}
            ORDER BY SUM(CASE WHEN RTRIM(od.Status) = 'F' THEN 1 ELSE 0 END) DESC", p)).AsList();

        int totalAll = rows.Sum(r => (int)r.total);
        int totalDropped = rows.Sum(r => (int)r.dropped);
        double overall = totalAll > 0 ? Math.Round((double)totalDropped / totalAll * 100, 1) : 0;

        return Ok(new
        {
            overall,
            trend = "0.0",
            byInsurance = rows.Take(15).Select(r => new
            {
                insurance = (string?)r.Insurance ?? "Unknown",
                dropRate = (int)r.total > 0
                    ? Math.Round((double)(int)r.dropped / (int)r.total * 100, 1) : 0,
                total = (int)r.total,
                dropped = (int)r.dropped,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M4: Peak Calling Hours
    // GET /api/dashboard/peak-hours
    // ═══════════════════════════════════════════════════════
    [HttpGet("peak-hours")]
    public async Task<IActionResult> PeakHours(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT DATEPART(HOUR, om.CallInTime) AS hour,
                   DATENAME(WEEKDAY, om.CallDate) AS dayOfWeek,
                   COUNT(od.ID) AS callCount
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            {whereSQL}
            GROUP BY DATEPART(HOUR, om.CallInTime), DATENAME(WEEKDAY, om.CallDate)
            ORDER BY DATEPART(HOUR, om.CallInTime)", p)).AsList();

        // Aggregate hourly totals
        var hourlyMap = new Dictionary<int, int>();
        foreach (var r in rows)
        {
            int h = (int)r.hour;
            int cnt = (int)r.callCount;
            hourlyMap[h] = hourlyMap.GetValueOrDefault(h) + cnt;
        }

        var hourly = Enumerable.Range(0, 24).Select(i => new
        {
            hour = $"{i:D2}:00",
            calls = hourlyMap.GetValueOrDefault(i),
        }).ToList();

        var peak = hourly.OrderByDescending(h => h.calls).First();

        var heatmapData = rows.Select(r => new
        {
            x = $"{(int)r.hour:D2}:00",
            y = (string)r.dayOfWeek,
            value = (int)r.callCount,
        });

        return Ok(new { hourly, peak, heatmapData });
    }

    // ═══════════════════════════════════════════════════════
    // M5: Active / Queued Calls (Real-Time snapshot)
    // GET /api/dashboard/active-calls
    // ═══════════════════════════════════════════════════════
    [HttpGet("active-calls")]
    public async Task<IActionResult> ActiveCalls()
    {
        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;

        int active = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM outboundmaster WHERE RTRIM(Status) = 'P'");

        var breakdown = await conn.QueryAsync<dynamic>(@"
            SELECT RTRIM(od.Status) AS detailStatus, COUNT(*) AS cnt
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            WHERE RTRIM(om.Status) = 'P'
            GROUP BY RTRIM(od.Status)");

        int capacity = 500;
        return Ok(new
        {
            current = active,
            capacity,
            utilizationPct = Math.Round((double)active / capacity * 100, 1),
            statusBreakdown = breakdown.Select(r => new
            {
                status = (string)r.detailStatus,
                count = (int)r.cnt,
            }),
            history = Array.Empty<object>(),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M6: Call Duration Distribution (cdrmaster)
    // GET /api/dashboard/call-duration
    // ═══════════════════════════════════════════════════════
    [HttpGet("call-duration")]
    public async Task<IActionResult> CallDuration(string? from, string? to)
    {
        var (cdrWhere, dp) = BuildDateRangeWhereClause("cdr.CallDate", from, to, "cdr");
        string cdrFilteredWhere = string.IsNullOrEmpty(cdrWhere)
            ? "WHERE cdr.Duration IS NOT NULL"
            : $"{cdrWhere} AND cdr.Duration IS NOT NULL";

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;

        var overall = await conn.QueryFirstOrDefaultAsync<dynamic>($@"
            WITH filtered AS (
                SELECT CAST(cdr.Duration AS float) AS Duration
                FROM cdrmaster cdr
                {cdrFilteredWhere}
            )
            SELECT TOP 1
                   CAST(AVG(Duration) OVER () AS decimal(10,2)) AS avgDuration,
                   MIN(Duration) OVER () AS minDuration,
                   CAST(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY Duration) OVER () AS decimal(10,2)) AS p25,
                   CAST(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY Duration) OVER () AS decimal(10,2)) AS median,
                   CAST(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY Duration) OVER () AS decimal(10,2)) AS p75,
                   CAST(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY Duration) OVER () AS decimal(10,2)) AS p90,
                   CAST(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY Duration) OVER () AS decimal(10,2)) AS p95,
                   MAX(Duration) OVER () AS maxDuration
            FROM filtered", dp);

        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT COALESCE(app.Insurance, 'Unknown') AS Insurance,
                   AVG(cdr.Duration) AS avgDuration,
                   MIN(cdr.Duration) AS minDuration,
                   MAX(cdr.Duration) AS maxDuration,
                   COUNT(*) AS callCount
            FROM cdrmaster cdr
            LEFT JOIN application app ON cdr.AppID = app.AppID
                 {cdrFilteredWhere}
            GROUP BY COALESCE(app.Insurance, 'Unknown')
            HAVING COUNT(*) > 0
            ORDER BY AVG(cdr.Duration) DESC", dp)).AsList();

        double allAvg = overall is not null ? (double)(decimal)overall.avgDuration : 0d;
        int min = overall is not null ? Convert.ToInt32(overall.minDuration) : 0;
        double p25 = overall is not null ? (double)(decimal)overall.p25 : 0d;
        double median = overall is not null ? (double)(decimal)overall.median : 0d;
        double p75 = overall is not null ? (double)(decimal)overall.p75 : 0d;
        double p90 = overall is not null ? (double)(decimal)overall.p90 : 0d;
        double p95 = overall is not null ? (double)(decimal)overall.p95 : 0d;
        int max = overall is not null ? Convert.ToInt32(overall.maxDuration) : 0;

        return Ok(new
        {
            overall = new
            {
                avg = allAvg,
                avgSeconds = allAvg,
                avgFormatted = FormatDurationShort(allAvg),
                min,
                minSeconds = min,
                minFormatted = FormatDurationShort(min),
                p25,
                p25Seconds = p25,
                p25Formatted = FormatDurationShort(p25),
                median,
                medianSeconds = median,
                medianFormatted = FormatDurationShort(median),
                p75,
                p75Seconds = p75,
                p75Formatted = FormatDurationShort(p75),
                p90,
                p90Seconds = p90,
                p90Formatted = FormatDurationShort(p90),
                p95,
                p95Seconds = p95,
                p95Formatted = FormatDurationShort(p95),
                max,
                maxSeconds = max,
                maxFormatted = FormatDurationShort(max),
            },
            byInsurance = rows.Select(r => new
            {
                insurance = (string)r.Insurance,
                avg = Math.Round(Convert.ToDouble(r.avgDuration), 1),
                avgFormatted = FormatDurationShort(Convert.ToDouble(r.avgDuration)),
                min = (int)r.minDuration,
                max = (int)r.maxDuration,
                count = (int)r.callCount,
                median = (object?)null,
                p90 = (object?)null,
                p95 = (object?)null,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M7: Top Dropped / Failed Insurances
    // GET /api/dashboard/top-dropped
    // ═══════════════════════════════════════════════════════
    [HttpGet("top-dropped")]
    public async Task<IActionResult> TopDropped(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = await conn.QueryAsync<dynamic>($@"
            SELECT TOP 10
                {FilterHelper.INS_EXPR} AS Insurance,
                COUNT(od.ID) AS total,
                SUM(CASE WHEN RTRIM(od.Status) = 'F' THEN 1 ELSE 0 END) AS dropped,
                CAST(
                    SUM(CASE WHEN RTRIM(od.Status) = 'F' THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100
                    AS DECIMAL(5,1)
                ) AS dropPct
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            {whereSQL}
            GROUP BY {FilterHelper.INS_EXPR}
            HAVING SUM(CASE WHEN RTRIM(od.Status) = 'F' THEN 1 ELSE 0 END) > 0
            ORDER BY dropped DESC", p);

        return Ok(new
        {
            insurances = rows.Select(r => new
            {
                insurance = (string?)r.Insurance ?? "Unknown",
                total = (int)r.total,
                dropped = (int)r.dropped,
                dropPct = (double)(decimal)(r.dropPct ?? 0m),
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M8: Call Status Breakdown (Initiation Source)
    // GET /api/dashboard/initiation-source
    // ═══════════════════════════════════════════════════════
    [HttpGet("initiation-source")]
    public async Task<IActionResult> InitiationSource(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT RTRIM(od.Status) AS statusCode,
                   COALESCE(ocs.Description, 'Status: ' + RTRIM(od.Status)) AS source,
                   COUNT(od.ID) AS [count]
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            LEFT JOIN outboundCallStatus ocs ON RTRIM(od.Status) = RTRIM(ocs.CallStatus)
            {whereSQL}
            GROUP BY RTRIM(od.Status), COALESCE(ocs.Description, 'Status: ' + RTRIM(od.Status))
            ORDER BY COUNT(od.ID) DESC", p)).AsList();

        int total = rows.Sum(r => (int)r.count);

        return Ok(new
        {
            sources = rows.Select(r => new
            {
                id = (string)r.statusCode,
                label = (string)r.source,
                value = (int)r.count,
                pct = total > 0 ? Math.Round((double)(int)r.count / total * 100, 1) : 0,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M9: Claim Completion Rate
    // GET /api/dashboard/claim-completion
    // ═══════════════════════════════════════════════════════
    [HttpGet("claim-completion")]
    public async Task<IActionResult> ClaimCompletion(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT RTRIM(od.Status) AS statusCode,
                   COALESCE(ocs.Description, RTRIM(od.Status)) AS ClaimStatus,
                   COUNT(od.ID) AS [count]
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            LEFT JOIN outboundCallStatus ocs ON RTRIM(od.Status) = RTRIM(ocs.CallStatus)
            {whereSQL}
            GROUP BY RTRIM(od.Status), COALESCE(ocs.Description, RTRIM(od.Status))
            ORDER BY COUNT(od.ID) DESC", p)).AsList();

        int total = rows.Sum(r => (int)r.count);
        var completed = rows.FirstOrDefault(r => (string)r.statusCode == "C");
        double completionRate = total > 0 && completed is not null
            ? Math.Round((double)(int)completed!.count / total * 100, 1) : 0;

        return Ok(new
        {
            completionRate,
            total,
            statuses = rows.Select(r => new
            {
                status = (string)r.ClaimStatus,
                count = (int)r.count,
                pct = total > 0 ? Math.Round((double)(int)r.count / total * 100, 1) : 0,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M10: Reattempt Outcome Funnel
    // GET /api/dashboard/reattempt-funnel
    // ═══════════════════════════════════════════════════════
    [HttpGet("reattempt-funnel")]
    public async Task<IActionResult> ReattemptFunnel(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            WITH filtered_calls AS (
                SELECT DISTINCT om.ID
                FROM outboundmaster om
                INNER JOIN outboundmaster_detail od ON od.OID = om.ID
                {whereSQL}
            ),
            attempt_buckets AS (
                SELECT fc.ID,
                       COUNT(od.ID) AS attempts
                FROM filtered_calls fc
                INNER JOIN outboundmaster_detail od ON od.OID = fc.ID
                GROUP BY fc.ID
            ),
            exact_stage_counts AS (
                SELECT attempts,
                       COUNT(*) AS exactCount
                FROM attempt_buckets
                GROUP BY attempts
            ),
            cumulative_stage_counts AS (
                SELECT attempts,
                       exactCount,
                       SUM(exactCount) OVER (
                           ORDER BY attempts DESC
                           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                       ) AS stageCount
                FROM exact_stage_counts
            ),
            final AS (
                SELECT attempts,
                       stageCount,
                       LAG(stageCount) OVER (ORDER BY attempts) AS previousStageCount,
                       MAX(CASE WHEN attempts = 1 THEN stageCount END) OVER () AS initialStageCount
                FROM cumulative_stage_counts
            )
            SELECT attempts,
                   stageCount,
                   CAST(
                       CASE
                           WHEN initialStageCount IS NULL OR initialStageCount = 0 THEN 0
                           ELSE stageCount * 100.0 / initialStageCount
                       END
                       AS DECIMAL(6,1)
                   ) AS pctOfInitial,
                   CAST(
                       CASE
                           WHEN previousStageCount IS NULL OR previousStageCount = 0 THEN NULL
                           ELSE (previousStageCount - stageCount) * 100.0 / previousStageCount
                       END
                       AS DECIMAL(6,1)
                   ) AS dropOffPct
            FROM final
            ORDER BY attempts", p)).AsList();

        return Ok(new
        {
            stages = rows.Select(r => new
            {
                attempt = (int)r.attempts,
                label = (int)r.attempts == 1 ? "1+ Attempts" : $"{(int)r.attempts}+ Attempts",
                count = (int)r.stageCount,
                percent = (double)(decimal)r.pctOfInitial,
                dropOffPercent = r.dropOffPct is null ? (double?)null : (double)(decimal)r.dropOffPct,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M11: First Attempt Success Rate
    // GET /api/dashboard/first-attempt-rate
    // ═══════════════════════════════════════════════════════
    [HttpGet("first-attempt-rate")]
    public async Task<IActionResult> FirstAttemptRate(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            WITH filtered_calls AS (
                SELECT DISTINCT om.ID,
                       CAST(om.CallDate AS DATE) AS callDate
                FROM outboundmaster om
                INNER JOIN outboundmaster_detail od ON od.OID = om.ID
                {whereSQL}
            ),
            first_attempts AS (
                SELECT fc.callDate,
                       CASE WHEN firstDetail.Status IN ('S','C') THEN 1 ELSE 0 END AS firstAttemptSuccess
                FROM filtered_calls fc
                CROSS APPLY (
                    SELECT TOP 1 RTRIM(od2.Status) AS Status
                    FROM outboundmaster_detail od2
                    WHERE od2.OID = fc.ID
                    ORDER BY od2.ID ASC
                ) firstDetail
            )
            SELECT callDate,
                   COUNT(*) AS total,
                   SUM(firstAttemptSuccess) AS firstAttemptSuccess
            FROM first_attempts
            GROUP BY callDate
            ORDER BY callDate", p)).AsList();

        int totalAll = rows.Sum(r => (int)r.total);
        int totalFAS = rows.Sum(r => (int)r.firstAttemptSuccess);
        double rate = totalAll > 0 ? Math.Round((double)totalFAS / totalAll * 100, 1) : 0;

        return Ok(new
        {
            rate,
            total = totalAll,
            firstAttemptSuccess = totalFAS,
            trendData = rows.Select(r => new
            {
                date = FilterHelper.FormatShortDate((DateTime)r.callDate),
                value = (int)r.total > 0
                    ? Math.Round((double)(int)r.firstAttemptSuccess / (int)r.total * 100, 1) : 0,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M12: Top Incomplete / Failed Steps
    // GET /api/dashboard/incomplete-steps
    // ═══════════════════════════════════════════════════════
    [HttpGet("incomplete-steps")]
    public async Task<IActionResult> IncompleteSteps(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        string statusFilter = string.IsNullOrEmpty(whereSQL)
            ? "WHERE RTRIM(od.Status) IN ('I','F','E','G','R')"
            : $"{whereSQL} AND RTRIM(od.Status) IN ('I','F','E','G','R')";

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT RTRIM(od.Status) AS statusCode,
                   COALESCE(ocs.Description, RTRIM(od.Status)) AS step,
                   {FilterHelper.INS_EXPR} AS Insurance,
                   COUNT(od.ID) AS [count]
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            LEFT JOIN outboundCallStatus ocs ON RTRIM(od.Status) = RTRIM(ocs.CallStatus)
            {statusFilter}
            GROUP BY RTRIM(od.Status), COALESCE(ocs.Description, RTRIM(od.Status)), {FilterHelper.INS_EXPR}
            ORDER BY COUNT(od.ID) DESC", p)).AsList();

        int total = rows.Sum(r => (int)r.count);

        // Aggregate by step
        var stepMap = new Dictionary<string, int>();
        foreach (var r in rows)
        {
            string step = (string)r.step;
            int cnt = (int)r.count;
            stepMap[step] = stepMap.GetValueOrDefault(step) + cnt;
        }

        return Ok(new
        {
            steps = stepMap.OrderByDescending(kv => kv.Value).Select(kv => new
            {
                step = kv.Key,
                count = kv.Value,
                pct = total > 0 ? Math.Round((double)kv.Value / total * 100, 1) : 0,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M13: Transcription Queue Length
    // GET /api/dashboard/transcription-queue
    // ═══════════════════════════════════════════════════════
    [HttpGet("transcription-queue")]
    public async Task<IActionResult> TranscriptionQueue()
    {
        const int queueLookbackDays = 30;
        var queueParams = new { lookbackDays = queueLookbackDays };

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;

        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT
                SUM(CASE
                        WHEN CallInTime IS NOT NULL
                         AND CallInTime >= DATEADD(DAY, -@lookbackDays, GETDATE())
                         AND CallInTime <= GETDATE()
                        THEN 1 ELSE 0
                    END) AS pending,
                CAST(AVG(CASE
                            WHEN CallInTime IS NOT NULL
                             AND CallInTime >= DATEADD(DAY, -@lookbackDays, GETDATE())
                             AND CallInTime <= GETDATE()
                            THEN CAST(DATEDIFF_BIG(SECOND, CallInTime, GETDATE()) AS bigint)
                            ELSE NULL
                         END) AS bigint) AS avgWaitSeconds,
                SUM(CASE
                        WHEN CallInTime IS NULL
                          OR CallInTime < DATEADD(DAY, -@lookbackDays, GETDATE())
                        THEN 1 ELSE 0
                    END) AS historicalPending
            FROM outboundmaster
            WHERE RTRIM(Status) = 'P'", queueParams);

        int pending = (int)(row?.pending ?? 0);
        long avgWait = row?.avgWaitSeconds is null ? 0L : Convert.ToInt64(row.avgWaitSeconds);
        int historicalPending = (int)(row?.historicalPending ?? 0);

        var history = await conn.QueryAsync<dynamic>(@"
            SELECT CAST(CallDate AS DATE) AS queueDate, COUNT(*) AS queueSize
            FROM outboundmaster
            WHERE RTRIM(Status) = 'P'
              AND CallInTime IS NOT NULL
                            AND CallInTime >= DATEADD(DAY, -@lookbackDays, GETDATE())
                            AND CallInTime <= GETDATE()
            GROUP BY CAST(CallDate AS DATE)
                        ORDER BY queueDate DESC", queueParams);

        return Ok(new
        {
            current = pending,
            avgWaitSeconds = avgWait,
            avgWaitFormatted = FormatDurationLong(avgWait),
            lookbackDays = queueLookbackDays,
            historicalPending,
            history = history.Reverse().Select(r => new
            {
                time = FilterHelper.FormatShortDate((DateTime)r.queueDate),
                value = (int)r.queueSize,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M14: Transcription Latency
    // GET /api/dashboard/transcription-time
    // ═══════════════════════════════════════════════════════
    [HttpGet("transcription-time")]
    public async Task<IActionResult> TranscriptionTime(string? from, string? to)
    {
        var (whereSql, dp) = BuildDateRangeWhereClause("cdr.CallDate", from, to, "trans");
        string filteredWhere = string.IsNullOrEmpty(whereSql)
            ? "WHERE cdr.TranscribeDateTime IS NOT NULL AND cdr.CallEndTime IS NOT NULL"
            : $"{whereSql} AND cdr.TranscribeDateTime IS NOT NULL AND cdr.CallEndTime IS NOT NULL";

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;

        var stats = await conn.QueryFirstOrDefaultAsync<dynamic>($@"
            WITH normalized AS (
                SELECT latencySec
                FROM (
                    SELECT (
                        SELECT MIN(v.latencySec)
                        FROM (VALUES
                            (CASE WHEN DATEDIFF(SECOND, cdr.CallEndTime, cdr.TranscribeDateTime) BETWEEN 0 AND 86400 THEN DATEDIFF(SECOND, cdr.CallEndTime, cdr.TranscribeDateTime) END),
                            (CASE WHEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, 11, cdr.TranscribeDateTime)) BETWEEN 0 AND 86400 THEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, 11, cdr.TranscribeDateTime)) END),
                            (CASE WHEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, 10, cdr.TranscribeDateTime)) BETWEEN 0 AND 86400 THEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, 10, cdr.TranscribeDateTime)) END),
                            (CASE WHEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, 9, cdr.TranscribeDateTime)) BETWEEN 0 AND 86400 THEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, 9, cdr.TranscribeDateTime)) END),
                            (CASE WHEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, -2, cdr.TranscribeDateTime)) BETWEEN 0 AND 86400 THEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, -2, cdr.TranscribeDateTime)) END),
                            (CASE WHEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, -3, cdr.TranscribeDateTime)) BETWEEN 0 AND 86400 THEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, -3, cdr.TranscribeDateTime)) END),
                            (CASE WHEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, -4, cdr.TranscribeDateTime)) BETWEEN 0 AND 86400 THEN DATEDIFF(SECOND, cdr.CallEndTime, DATEADD(HOUR, -4, cdr.TranscribeDateTime)) END)
                        ) v(latencySec)
                    ) AS latencySec
                    FROM cdrmaster cdr
                    {filteredWhere}
                ) base
                WHERE latencySec IS NOT NULL
            )
            SELECT TOP 1
                   COUNT(*) OVER () AS [count],
                   CAST(AVG(CAST(latencySec AS bigint)) OVER () AS bigint) AS avgLatencySec,
                   MIN(latencySec) OVER () AS minLatencySec,
                   CAST(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY CAST(latencySec AS float)) OVER () AS decimal(10,2)) AS p25,
                   CAST(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(latencySec AS float)) OVER () AS decimal(10,2)) AS median,
                   CAST(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CAST(latencySec AS float)) OVER () AS decimal(10,2)) AS p75,
                   CAST(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY CAST(latencySec AS float)) OVER () AS decimal(10,2)) AS p90,
                   CAST(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CAST(latencySec AS float)) OVER () AS decimal(10,2)) AS p95,
                   MAX(latencySec) OVER () AS maxLatencySec
            FROM normalized", dp);

        long avgLatencySec = stats?.avgLatencySec is null ? 0L : Convert.ToInt64(stats.avgLatencySec);
        int totalCount = stats?.count is null ? 0 : Convert.ToInt32(stats.count);

        return Ok(new
        {
            overallAvgSeconds = avgLatencySec,
            overallP90Seconds = stats is not null ? (double)(decimal)stats.p90 : 0,
            overallP90Formatted = stats is not null
                ? FormatDurationLong((long)Math.Round((double)(decimal)stats.p90, MidpointRounding.AwayFromZero))
                : "0s",
            byVendor = new[]
            {
                new
                {
                    vendor = "Auto Service",
                    count = totalCount,
                    avgSeconds = avgLatencySec,
                    avgFormatted = FormatDurationLong(avgLatencySec),
                    min = stats is not null ? Convert.ToInt32(stats.minLatencySec) : 0,
                    minFormatted = stats is not null ? FormatDurationLong(Convert.ToInt32(stats.minLatencySec)) : "0s",
                    p25 = stats is not null ? (double)(decimal)stats.p25 : 0,
                    p25Formatted = stats is not null
                        ? FormatDurationLong((long)Math.Round((double)(decimal)stats.p25, MidpointRounding.AwayFromZero))
                        : "0s",
                    median = stats is not null ? (double)(decimal)stats.median : 0,
                    medianFormatted = stats is not null
                        ? FormatDurationLong((long)Math.Round((double)(decimal)stats.median, MidpointRounding.AwayFromZero))
                        : "0s",
                    p75 = stats is not null ? (double)(decimal)stats.p75 : 0,
                    p75Formatted = stats is not null
                        ? FormatDurationLong((long)Math.Round((double)(decimal)stats.p75, MidpointRounding.AwayFromZero))
                        : "0s",
                    p90 = stats is not null ? (double)(decimal)stats.p90 : 0,
                    p90Formatted = stats is not null
                        ? FormatDurationLong((long)Math.Round((double)(decimal)stats.p90, MidpointRounding.AwayFromZero))
                        : "0s",
                    p95 = stats is not null ? (double)(decimal)stats.p95 : 0,
                    p95Formatted = stats is not null
                        ? FormatDurationLong((long)Math.Round((double)(decimal)stats.p95, MidpointRounding.AwayFromZero))
                        : "0s",
                    max = stats is not null ? Convert.ToInt32(stats.maxLatencySec) : 0,
                    maxFormatted = stats is not null ? FormatDurationLong(Convert.ToInt32(stats.maxLatencySec)) : "0s",
                }
            },
        });
    }

    // ═══════════════════════════════════════════════════════
    // M15: Transcription Throughput
    // GET /api/dashboard/transcription-api-usage
    // ═══════════════════════════════════════════════════════
    [HttpGet("transcription-api-usage")]
    public async Task<IActionResult> TranscriptionApiUsage(string? from, string? to)
    {
        var dp = new DynamicParameters();
        var conds = new List<string>();
        if (!string.IsNullOrWhiteSpace(from))
        {
            conds.Add("om.CallDate >= @dateFrom");
            dp.Add("dateFrom", DateTime.Parse(from), DbType.DateTime);
        }
        if (!string.IsNullOrWhiteSpace(to))
        {
            conds.Add("om.CallDate <= @dateTo");
            dp.Add("dateTo", DateTime.Parse(to), DbType.DateTime);
        }
        string extraWhere = conds.Count > 0 ? $"AND {string.Join(" AND ", conds)}" : "";

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT CAST(om.CallDate AS DATE) AS usageDate,
                   COUNT(*) AS transcribed,
                   SUM(od_count.detailCount) AS totalClaims
            FROM outboundmaster om
            CROSS APPLY (
                SELECT COUNT(*) AS detailCount
                FROM outboundmaster_detail od
                WHERE od.OID = om.ID
            ) od_count
            WHERE RTRIM(om.Status) = 'T'
            {extraWhere}
            GROUP BY CAST(om.CallDate AS DATE)
            ORDER BY usageDate", dp)).AsList();

        return Ok(new
        {
            vendors = new[]
            {
                new
                {
                    vendor = "Auto Service",
                    daily = rows.Select(r => new
                    {
                        date = FilterHelper.FormatShortDate((DateTime)r.usageDate),
                        calls = (int)r.transcribed,
                        chars = (int)r.totalClaims,
                    }),
                    totalCalls = rows.Sum(r => (int)r.transcribed),
                    totalChars = rows.Sum(r => (int)r.totalClaims),
                }
            },
        });
    }

    // ═══════════════════════════════════════════════════════
    // M16: Concurrent / Peak Call Volume
    // GET /api/dashboard/concurrent-peaks
    // ═══════════════════════════════════════════════════════
    [HttpGet("concurrent-peaks")]
    public async Task<IActionResult> ConcurrentPeaks(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT CAST(om.CallDate AS DATE) AS callDate,
                   DATEPART(HOUR, om.CallInTime) AS hour,
                   COUNT(od.ID) AS concurrent
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            {whereSQL}
            GROUP BY CAST(om.CallDate AS DATE), DATEPART(HOUR, om.CallInTime)
            ORDER BY callDate, hour", p)).AsList();

        var peakRow = rows.Count > 0
            ? rows.OrderByDescending(r => (int)r.concurrent).First()
            : null;

        return Ok(new
        {
            peak = peakRow != null ? new
            {
                date = FilterHelper.FormatShortDate((DateTime)peakRow.callDate),
                hour = $"{(int)peakRow.hour:D2}:00",
                concurrent = (int)peakRow.concurrent,
            } : null,
            capacity = 500,
            hourly = rows.Select(r => new
            {
                date = FilterHelper.FormatShortDate((DateTime)r.callDate),
                hour = $"{(int)r.hour:D2}:00",
                concurrent = (int)r.concurrent,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // M17: System Error Rate
    // GET /api/dashboard/error-rate
    // ═══════════════════════════════════════════════════════
    [HttpGet("error-rate")]
    public async Task<IActionResult> ErrorRate(
        string? from, string? to, string? insurance, string? practice, string? dnis, string? callType)
    {
        var f = FilterHelper.Parse(from, to, insurance, practice, dnis, callType);
        var (whereSQL, p) = FilterHelper.BuildWhereClause(f);

        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;
        var rows = (await conn.QueryAsync<dynamic>($@"
            SELECT CAST(om.CallDate AS DATE) AS callDate,
                   COUNT(od.ID) AS total,
                   SUM(CASE WHEN RTRIM(od.Status) IN ('F','G','E','R') THEN 1 ELSE 0 END) AS errors
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            {whereSQL}
            GROUP BY CAST(om.CallDate AS DATE)
            ORDER BY callDate", p)).AsList();

        int totalAll = rows.Sum(r => (int)r.total);
        int totalErrors = rows.Sum(r => (int)r.errors);
        double rate = totalAll > 0 ? Math.Round((double)totalErrors / totalAll * 100, 2) : 0;

        // Breakdown by error type - need second query with separate params
        var p2 = FilterHelper.BuildWhereClause(f).Params;
        string breakdownWhere = string.IsNullOrEmpty(whereSQL)
            ? "WHERE RTRIM(od.Status) IN ('F','G','E','R')"
            : $"{whereSQL} AND RTRIM(od.Status) IN ('F','G','E','R')";

        var breakdown = await conn.QueryAsync<dynamic>($@"
            SELECT RTRIM(od.Status) AS statusCode,
                   COALESCE(ocs.Description, RTRIM(od.Status)) AS ErrorType,
                   COUNT(od.ID) AS [count]
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            LEFT JOIN outboundCallStatus ocs ON RTRIM(od.Status) = RTRIM(ocs.CallStatus)
            {breakdownWhere}
            GROUP BY RTRIM(od.Status), COALESCE(ocs.Description, RTRIM(od.Status))
            ORDER BY COUNT(od.ID) DESC", p2);

        return Ok(new
        {
            rate,
            totalErrors,
            totalCalls = totalAll,
            trendData = rows.Select(r => new
            {
                date = FilterHelper.FormatShortDate((DateTime)r.callDate),
                value = (int)r.total > 0
                    ? Math.Round((double)(int)r.errors / (int)r.total * 100, 2) : 0,
            }),
            breakdown = breakdown.Select(r => new
            {
                type = (string)r.ErrorType,
                count = (int)r.count,
            }),
        });
    }

    // ═══════════════════════════════════════════════════════
    // Filter Options Endpoint
    // GET /api/dashboard/filter-options
    // ═══════════════════════════════════════════════════════
    [HttpGet("filter-options")]
    public async Task<IActionResult> FilterOptions()
    {
        // Use a single connection with sequential queries to reduce pool pressure
        await using var tc = await _db.GetThrottledConnectionAsync(HttpContext.RequestAborted);
        var conn = tc.Connection;

        var insRows = await conn.QueryAsync<dynamic>($@"
            SELECT TOP 50 {FilterHelper.INS_EXPR} AS val, COUNT(*) AS cnt
            FROM outboundmaster om
            INNER JOIN outboundmaster_detail od ON od.OID = om.ID
            WHERE od.UniqueIndetifier IS NOT NULL
            GROUP BY {FilterHelper.INS_EXPR}
            ORDER BY COUNT(*) DESC");

        var practRows = await conn.QueryAsync<dynamic>(@"
            SELECT DISTINCT RTRIM(od.PracticeCode) AS val
            FROM outboundmaster_detail od
            WHERE od.PracticeCode IS NOT NULL AND od.PracticeCode != ''
            ORDER BY val");

        var dnisRows = await conn.QueryAsync<dynamic>(@"
            SELECT DISTINCT RTRIM(od.IVR_Insurance) AS val
            FROM outboundmaster_detail od
            WHERE od.IVR_Insurance IS NOT NULL AND od.IVR_Insurance != ''
            ORDER BY val");

        return Ok(new
        {
            insurances = insRows.Select(r => (string?)r.val).Where(v => v != null),
            practices = practRows.Select(r => (string?)r.val).Where(v => v != null),
            dnis = dnisRows.Select(r => (string?)r.val).Where(v => v != null),
        });
    }
}
