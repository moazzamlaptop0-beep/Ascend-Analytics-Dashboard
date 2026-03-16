using System.Text.Json;

namespace AscendAPI.Services;

public sealed record MetricDefinition
{
    public required string Metric { get; init; }
    public required string Endpoint { get; init; }
    public required string Definition { get; init; }
    public required string Formula { get; init; }
    public required string[] SourceTables { get; init; }
}

public sealed class MetricDefinitionService
{
    private const string DefinitionsRelativePath = "Definitions/metric-definitions.json";

    private readonly MetricDefinitionCatalogFile _catalog;
    private readonly Dictionary<string, MetricDefinition> _byMetric;

    public MetricDefinitionService()
    {
        var path = Path.Combine(AppContext.BaseDirectory, DefinitionsRelativePath);
        if (!File.Exists(path))
        {
            throw new InvalidOperationException($"Metric definitions file not found: {path}");
        }

        var json = File.ReadAllText(path);
        _catalog = JsonSerializer.Deserialize<MetricDefinitionCatalogFile>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Failed to deserialize metric definitions.");

        if (_catalog.Metrics.Count == 0)
        {
            throw new InvalidOperationException("Metric definitions file is empty.");
        }

        _byMetric = _catalog.Metrics
            .ToDictionary(m => m.Metric.Trim().ToUpperInvariant(), m => m);
    }

    public string Version => _catalog.Version;

    public string UpdatedAtUtc => _catalog.UpdatedAtUtc;

    public IReadOnlyList<MetricDefinition> GetAll()
    {
        return _catalog.Metrics;
    }

    public MetricDefinition? GetByMetric(string metric)
    {
        if (string.IsNullOrWhiteSpace(metric)) return null;
        return _byMetric.GetValueOrDefault(metric.Trim().ToUpperInvariant());
    }

    private sealed class MetricDefinitionCatalogFile
    {
        public string Version { get; init; } = "1.0.0";

        public string UpdatedAtUtc { get; init; } = string.Empty;

        public List<MetricDefinition> Metrics { get; init; } = [];
    }
}
