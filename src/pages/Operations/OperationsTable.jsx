import { useState, useMemo, useCallback, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useOperationsData } from "../../hooks/useOperationsData";
import { useGlobalFilters } from "../../hooks/useGlobalFilters";
import { exportToCsv } from "../../utils/csvExport";
import { LoadingSpinner } from "../../components/ui";
import {
  RiSearchLine,
  RiDownloadLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
} from "@remixicon/react";

// ── Status badge colors ──
const STATUS_COLORS = {
  Completed: "bg-green-50 text-green-700",
  Dropped: "bg-red-50 text-red-700",
  "In Progress": "bg-blue-50 text-blue-700",
  Failed: "bg-orange-50 text-orange-700",
  Transferred: "bg-purple-50 text-purple-700",
};

const STATUS_FILTER_CODES = {
  Completed: ["S", "C"],
  Dropped: ["D"],
  "In Progress": ["I", "Q", "N"],
  Failed: ["F", "R", "E", "G"],
  Transferred: ["T"],
};

// ── Column definitions ──
const COLUMNS = [
  {
    accessorKey: "id",
    header: "Call ID",
    size: 120,
  },
  {
    accessorKey: "timestampFormatted",
    header: "Timestamp",
    size: 165,
  },
  {
    accessorKey: "insurance",
    header: "Insurance",
    size: 130,
  },
  {
    accessorKey: "practice",
    header: "Practice",
    size: 90,
  },
  {
    accessorKey: "dnis",
    header: "DNIS",
    size: 120,
  },
  {
    accessorKey: "callType",
    header: "Type",
    size: 90,
  },
  {
    accessorKey: "source",
    header: "Source",
    size: 80,
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 110,
    cell: ({ getValue }) => {
      const status = getValue();
      return (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}
        >
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: "durationFormatted",
    header: "Duration",
    size: 80,
  },
  {
    accessorKey: "lastStep",
    header: "Last Step",
    size: 140,
  },
  {
    accessorKey: "attempts",
    header: "Attempts",
    size: 80,
  },
  {
    accessorKey: "errors",
    header: "Errors",
    size: 70,
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return <span className="text-gray-300">0</span>;
      return <span className="text-red-600 font-medium">{val}</span>;
    },
  },
  {
    accessorKey: "claimId",
    header: "Claim ID",
    size: 120,
    cell: ({ getValue }) =>
      getValue() || <span className="text-gray-300">-</span>,
  },
];

const CSV_COLUMNS = COLUMNS.map((c) => ({
  key: c.accessorKey,
  header: c.header,
}));

// ── Page sizes ──
const PAGE_SIZES = [25, 50, 100, 200];

export default function OperationsTable() {
  const { filters: globalFilters } = useGlobalFilters();

  // ── Local state ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState(null);
  const [dir, setDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const searchTimeout = useRef(null);

  // debounce search
  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 350);
  }, []);

  // Merge global + local filters
  const mergedFilters = useMemo(
    () => ({
      dateRange: globalFilters.dateRange,
      insurance: globalFilters.insurance,
      practice: globalFilters.practice,
      dnis: globalFilters.dnis,
      callType: globalFilters.callType,
      status: statusFilter
        ? (STATUS_FILTER_CODES[statusFilter] || []).join(",") || undefined
        : undefined,
    }),
    [globalFilters, statusFilter],
  );

  // ── Fetch data ──
  const {
    data: result,
    isLoading,
    isFetching,
  } = useOperationsData({
    page,
    pageSize,
    sort,
    dir,
    filters: mergedFilters,
    search,
  });

  const rows = result?.data ?? [];
  const totalRecords = result?.totalRecords ?? 0;
  const totalPages = result?.totalPages ?? 0;

  // ── TanStack Table ──
  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    state: {
      sorting: sort ? [{ id: sort, desc: dir === "desc" }] : [],
    },
  });

  // ── Virtualization ──
  const tableContainerRef = useRef(null);
  const tableRows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  // ── Sort handler ──
  const handleSort = (columnId) => {
    if (sort === columnId) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(columnId);
      setDir("desc");
    }
    setPage(1);
  };

  // ── CSV Export ──
  const handleExport = () => {
    if (!rows.length) return;
    exportToCsv(rows, `operations-export-page-${page}`, CSV_COLUMNS);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-60 max-w-sm">
          <RiSearchLine
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search call ID, insurance, status..."
            value={searchInput}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">All Statuses</option>
          {["Completed", "Dropped", "In Progress", "Failed", "Transferred"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </select>

        {/* Page size */}
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          {PAGE_SIZES.map((sz) => (
            <option key={sz} value={sz}>
              {sz} rows
            </option>
          ))}
        </select>

        {/* Record count */}
        <span className="text-xs text-gray-400 ml-auto">
          {totalRecords.toLocaleString()} records
          {isFetching && !isLoading && (
            <span className="ml-2 text-blue-500">updating…</span>
          )}
        </span>

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={!rows.length}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
        >
          <RiDownloadLine size={14} />
          CSV
        </button>
      </div>

      {/* ── Data Table ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div
          ref={tableContainerRef}
          className="bg-white border border-gray-200 rounded-xl overflow-auto"
          style={{ maxHeight: "calc(100vh - 320px)" }}
        >
          <table className="w-full text-sm">
            {/* Header */}
            <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    const isSorted = sort === header.column.id;
                    return (
                      <th
                        key={header.id}
                        className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100/60 transition-colors"
                        style={{ width: header.column.getSize() }}
                        onClick={() => handleSort(header.column.id)}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {isSorted ? (
                            dir === "asc" ? (
                              <RiArrowUpSLine
                                size={14}
                                className="text-blue-500"
                              />
                            ) : (
                              <RiArrowDownSLine
                                size={14}
                                className="text-blue-500"
                              />
                            )
                          ) : (
                            <RiArrowDownSLine
                              size={12}
                              className="text-gray-300"
                            />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            {/* Virtual body */}
            <tbody>
              {virtualizer.getVirtualItems().length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="text-center py-12 text-gray-400"
                  >
                    No records found
                  </td>
                </tr>
              ) : (
                <>
                  {/* Spacer top */}
                  {virtualizer.getVirtualItems()[0]?.start > 0 && (
                    <tr>
                      <td
                        colSpan={COLUMNS.length}
                        style={{
                          height: virtualizer.getVirtualItems()[0].start,
                        }}
                      />
                    </tr>
                  )}

                  {virtualizer.getVirtualItems().map((vRow) => {
                    const row = tableRows[vRow.index];
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-gray-100 hover:bg-blue-50/30 transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-3 py-2 text-gray-700 whitespace-nowrap"
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {/* Spacer bottom */}
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        colSpan={COLUMNS.length}
                        style={{
                          height:
                            virtualizer.getTotalSize() -
                            (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                        }}
                      />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Page {page} of {totalPages.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <RiArrowLeftSLine size={14} />
            </button>

            {/* Page number input */}
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={(e) => {
                const val = Math.max(
                  1,
                  Math.min(totalPages, Number(e.target.value) || 1),
                );
                setPage(val);
              }}
              className="w-16 text-center text-xs border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <RiArrowRightSLine size={14} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
