import React, { useState } from "react";

export default function DatasetComparisonView({
  comparison,
  explanation,
  cleanedResult,
  onDownload,
  downloading,
}) {
  const [activeTab, setActiveTab] = useState("visuals"); // 'visuals' | 'preview' | 'columns'
  const [filterQuery, setFilterQuery] = useState("");

  if (!comparison) return null;

  const { summary = {}, columns = [] } = comparison;
  const filteredColumns = columns.filter((c) =>
    c.column.toLowerCase().includes(filterQuery.toLowerCase())
  );

  // Maximum missing percentage for scaling bar chart (at least 10% to prevent flat bars)
  const maxMissingPct = Math.max(
    ...columns.map((c) => Math.max(c.null_pct_before || 0, c.null_pct_after || 0)),
    10
  );

  return (
    <div className="card comparison-container" style={{ marginTop: "2rem" }}>
      {/* HEADER SECTION */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
          paddingBottom: "1.25rem",
          borderBottom: "1px solid var(--surface-border)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
            <span style={{ fontSize: "1.4rem" }}>📊</span>
            <h3 className="card-title" style={{ margin: 0 }}>
              Before vs. After Dataset Visualization & Audit
            </h3>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "0.2rem 0.55rem",
                borderRadius: "999px",
                background: "#ecfdf5",
                color: "#059669",
                border: "1px solid #a7f3d0",
              }}
            >
              Cleaning Applied
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}>
            Compare metrics, missing data reduction, and schema changes side-by-side with Groq AI analysis.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            onClick={onDownload}
            className="btn-orange"
            disabled={downloading}
            style={{ padding: "0.55rem 1.1rem" }}
          >
            {downloading ? "Downloading..." : "📥 Download Cleaned CSV"}
          </button>
        </div>
      </div>

      {/* AI EXPLANATION AUDIT CARD */}
      {explanation && (
        <div
          style={{
            background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
            border: "1px solid #fdba74",
            borderRadius: "12px",
            padding: "1.25rem",
            marginBottom: "1.75rem",
            position: "relative",
            boxShadow: "0 4px 14px rgba(249, 115, 22, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.2rem" }}>✨</span>
              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#9a3412" }}>
                Groq AI Transformation Audit
              </span>
            </div>
            {explanation.model_used && (
              <span
                style={{
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  background: "#fff",
                  color: "#c2410c",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "6px",
                  border: "1px solid #fed7aa",
                }}
              >
                Model: {explanation.model_used}
              </span>
            )}
          </div>

          <h4
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#7c2d12",
              margin: "0 0 0.6rem 0",
            }}
          >
            {explanation.headline || "Transformation Summary"}
          </h4>

          <p
            style={{
              fontSize: "0.9rem",
              color: "#431407",
              lineHeight: 1.6,
              marginBottom: "1rem",
            }}
          >
            {explanation.narrative}
          </p>

          {/* Key highlights bullet list */}
          {explanation.key_highlights && explanation.key_highlights.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#9a3412",
                  marginBottom: "0.4rem",
                }}
              >
                Key Transformations Applied:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {explanation.key_highlights.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#431407",
                      background: "rgba(255, 255, 255, 0.75)",
                      padding: "0.45rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid rgba(253, 186, 116, 0.5)",
                    }}
                  >
                    <span style={{ color: "#ea580c", fontWeight: "bold" }}>✔</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {explanation.data_readiness && (
            <div
              style={{
                marginTop: "1rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#065f46",
                background: "#d1fae5",
                padding: "0.3rem 0.75rem",
                borderRadius: "999px",
                border: "1px solid #6ee7b7",
              }}
            >
              <span>🚀 Readiness Status:</span>
              <span>{explanation.data_readiness}</span>
            </div>
          )}
        </div>
      )}

      {/* KPI METRIC DELTA CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        {/* Rows Card */}
        <div className="metric-delta-card">
          <div className="metric-label">Total Rows</div>
          <div className="metric-compare">
            <span className="metric-before">{summary.rows_before?.toLocaleString()}</span>
            <span className="metric-arrow">➔</span>
            <span className="metric-after">{summary.rows_after?.toLocaleString()}</span>
          </div>
          <div className={`metric-delta ${summary.rows_removed > 0 ? "warning" : "positive"}`}>
            {summary.rows_removed > 0
              ? `-${summary.rows_removed.toLocaleString()} removed`
              : "No rows dropped"}
          </div>
        </div>

        {/* Columns Card */}
        <div className="metric-delta-card">
          <div className="metric-label">Columns</div>
          <div className="metric-compare">
            <span className="metric-before">{summary.columns_before}</span>
            <span className="metric-arrow">➔</span>
            <span className="metric-after">{summary.columns_after}</span>
          </div>
          <div className={`metric-delta ${summary.columns_dropped_count > 0 ? "neutral" : "positive"}`}>
            {summary.columns_dropped_count > 0
              ? `-${summary.columns_dropped_count} dropped`
              : "All retained"}
          </div>
        </div>

        {/* Missing Cells Card */}
        <div className="metric-delta-card">
          <div className="metric-label">Missing Value Cells</div>
          <div className="metric-compare">
            <span className="metric-before" style={{ color: "#ef4444" }}>
              {summary.missing_cells_before?.toLocaleString()}
            </span>
            <span className="metric-arrow">➔</span>
            <span className="metric-after" style={{ color: "#10b981" }}>
              {summary.missing_cells_after?.toLocaleString()}
            </span>
          </div>
          <div className="metric-delta positive">
            {summary.missing_cells_resolved > 0
              ? `-${summary.missing_cells_resolved.toLocaleString()} resolved`
              : "0 missing"}
          </div>
        </div>

        {/* Duplicates Card */}
        <div className="metric-delta-card">
          <div className="metric-label">Duplicate Rows</div>
          <div className="metric-compare">
            <span className="metric-before" style={{ color: "#f97316" }}>
              {summary.duplicates_before?.toLocaleString()}
            </span>
            <span className="metric-arrow">➔</span>
            <span className="metric-after" style={{ color: "#10b981" }}>
              {summary.duplicates_after?.toLocaleString()}
            </span>
          </div>
          <div className="metric-delta positive">
            {summary.duplicates_removed > 0
              ? `-${summary.duplicates_removed} purged`
              : "Zero duplicates"}
          </div>
        </div>

        {/* Completeness Card */}
        <div className="metric-delta-card highlight">
          <div className="metric-label">Completeness Score</div>
          <div className="metric-compare">
            <span className="metric-before">{summary.completeness_score_before}%</span>
            <span className="metric-arrow">➔</span>
            <span className="metric-after" style={{ color: "#10b981" }}>
              {summary.completeness_score_after}%
            </span>
          </div>
          <div className="metric-delta positive">
            +{summary.completeness_gain}% hygiene gain
          </div>
        </div>
      </div>

      {/* VIEW TABS */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "1px solid var(--surface-border)",
          marginBottom: "1.5rem",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("visuals")}
          style={{
            background: activeTab === "visuals" ? "#fff" : "transparent",
            border: "none",
            borderBottom: activeTab === "visuals" ? "2px solid var(--accent-orange)" : "2px solid transparent",
            color: activeTab === "visuals" ? "var(--accent-orange)" : "var(--text-muted)",
            fontWeight: 700,
            borderRadius: "6px 6px 0 0",
            padding: "0.6rem 1.2rem",
            cursor: "pointer",
          }}
        >
          📈 Visual Charts & Graphs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("columns")}
          style={{
            background: activeTab === "columns" ? "#fff" : "transparent",
            border: "none",
            borderBottom: activeTab === "columns" ? "2px solid var(--accent-orange)" : "2px solid transparent",
            color: activeTab === "columns" ? "var(--accent-orange)" : "var(--text-muted)",
            fontWeight: 700,
            borderRadius: "6px 6px 0 0",
            padding: "0.6rem 1.2rem",
            cursor: "pointer",
          }}
        >
          📋 Column Transformation Ledger ({columns.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          style={{
            background: activeTab === "preview" ? "#fff" : "transparent",
            border: "none",
            borderBottom: activeTab === "preview" ? "2px solid var(--accent-orange)" : "2px solid transparent",
            color: activeTab === "preview" ? "var(--accent-orange)" : "var(--text-muted)",
            fontWeight: 700,
            borderRadius: "6px 6px 0 0",
            padding: "0.6rem 1.2rem",
            cursor: "pointer",
          }}
        >
          🔍 Cleaned Table Preview
        </button>
      </div>

      {/* TAB 1: VISUAL CHARTS & COMPARISONS */}
      {activeTab === "visuals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Missing Values Before vs After Bar Chart */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--surface-border)",
              borderRadius: "12px",
              padding: "1.25rem",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 700 }}>
                  Missing Data Rate per Column: Before vs. After
                </h4>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Side-by-side percentage of null values. Green demonstrates resolved/imputed values.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      background: "#ef4444",
                      borderRadius: "3px",
                      display: "inline-block",
                    }}
                  />
                  <span>Before Cleaning</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      background: "#10b981",
                      borderRadius: "3px",
                      display: "inline-block",
                    }}
                  />
                  <span>After Cleaning</span>
                </div>
              </div>
            </div>

            {/* Horizontal comparative bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {columns.map((col) => {
                const widthBefore = (col.null_pct_before / maxMissingPct) * 100;
                const widthAfter = (col.null_pct_after / maxMissingPct) * 100;

                return (
                  <div
                    key={col.column}
                    style={{
                      padding: "0.6rem 0.8rem",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "0.35rem",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <strong style={{ color: "var(--text-main)" }}>{col.column}</strong>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          ({col.dtype_before})
                        </span>
                        {col.is_dropped ? (
                          <span className="badge-tag dropped">Column Dropped</span>
                        ) : col.imputed_count > 0 ? (
                          <span className="badge-tag imputed">
                            {col.imputed_count} cells imputed
                          </span>
                        ) : col.null_pct_before === 0 ? (
                          <span className="badge-tag pristine">Clean (0% Nulls)</span>
                        ) : null}
                      </div>

                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {col.is_dropped ? (
                          <span style={{ color: "#dc2626" }}>Dropped from dataset</span>
                        ) : (
                          <span>
                            <span style={{ color: "#ef4444", fontWeight: 600 }}>
                              {col.null_pct_before}%
                            </span>
                            {" ➔ "}
                            <span style={{ color: "#10b981", fontWeight: 600 }}>
                              {col.null_pct_after}%
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Comparative Bars */}
                    {!col.is_dropped && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {/* Before Bar */}
                        <div
                          style={{
                            height: "7px",
                            background: "#fee2e2",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(widthBefore, col.null_pct_before > 0 ? 3 : 0)}%`,
                              height: "100%",
                              background: "#ef4444",
                              borderRadius: "4px",
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                        {/* After Bar */}
                        <div
                          style={{
                            height: "7px",
                            background: "#d1fae5",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(widthAfter, col.null_pct_after > 0 ? 3 : 0)}%`,
                              height: "100%",
                              background: "#10b981",
                              borderRadius: "4px",
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dataset Completeness & Health Gauge */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Completeness Meter */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--surface-border)",
                borderRadius: "12px",
                padding: "1.25rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", fontWeight: 700 }}>
                Overall Completeness Gain
              </h4>
              <p style={{ margin: "0 0 1rem 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Calculated across all non-null values relative to total matrix cells.
              </p>

              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
                  <span>Before Pipeline</span>
                  <span style={{ fontWeight: 700, color: "#64748b" }}>{summary.completeness_score_before}%</span>
                </div>
                <div style={{ height: "10px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${summary.completeness_score_before}%`,
                      height: "100%",
                      background: "#94a3b8",
                      borderRadius: "999px",
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
                  <span>After Pipeline</span>
                  <span style={{ fontWeight: 700, color: "#059669" }}>{summary.completeness_score_after}%</span>
                </div>
                <div style={{ height: "10px", background: "#d1fae5", borderRadius: "999px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${summary.completeness_score_after}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      borderRadius: "999px",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Retention & Deduplication Ratio */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--surface-border)",
                borderRadius: "12px",
                padding: "1.25rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", fontWeight: 700 }}>
                Data Retention & Deduplication
              </h4>
              <p style={{ margin: "0 0 1rem 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Percentage of valid rows retained vs. duplicate rows eliminated.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-around",
                  padding: "0.5rem 0",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a" }}>
                    {summary.rows_retained_pct}%
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Rows Retained
                  </div>
                </div>

                <div style={{ height: "40px", width: "1px", background: "var(--surface-border)" }} />

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10b981" }}>
                    {summary.duplicates_before > 0 ? "100%" : "0"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Duplicates Purged
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COLUMN-BY-COLUMN TRANSFORMATION LEDGER */}
      {activeTab === "columns" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <input
              type="text"
              placeholder="Filter columns by name..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid var(--surface-border)",
                fontSize: "0.85rem",
                width: "260px",
              }}
            />
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Showing {filteredColumns.length} of {columns.length} columns
            </span>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Status</th>
                  <th>Type (Before / After)</th>
                  <th>Nulls Before</th>
                  <th>Nulls After</th>
                  <th>Imputed / Saved</th>
                </tr>
              </thead>
              <tbody>
                {filteredColumns.map((col, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{col.column}</strong>
                    </td>
                    <td>
                      {col.is_dropped ? (
                        <span className="badge-tag dropped">Dropped</span>
                      ) : col.imputed_count > 0 ? (
                        <span className="badge-tag imputed">{col.status}</span>
                      ) : (
                        <span className="badge-tag retained">Retained</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {col.dtype_before} ➔ {col.dtype_after}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: col.null_count_before > 0 ? "#ef4444" : "inherit", fontWeight: 600 }}>
                        {col.null_count_before} ({col.null_pct_before}%)
                      </span>
                    </td>
                    <td>
                      <span style={{ color: col.null_count_after > 0 ? "#ef4444" : "#10b981", fontWeight: 600 }}>
                        {col.null_count_after} ({col.null_pct_after}%)
                      </span>
                    </td>
                    <td>
                      {col.imputed_count > 0 ? (
                        <span style={{ color: "#0284c7", fontWeight: 600 }}>
                          +{col.imputed_count} filled
                        </span>
                      ) : col.is_dropped ? (
                        <span style={{ color: "#94a3b8" }}>Removed</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Clean</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CLEANED DATA PREVIEW TABLE */}
      {activeTab === "preview" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
                First 10 Cleaned Records Preview
              </h4>
              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Showing verified output with formatted nulls and trimmed text values.
              </p>
            </div>
            <button onClick={onDownload} className="btn-orange" disabled={downloading}>
              {downloading ? "Downloading..." : "📥 Download CSV"}
            </button>
          </div>

          {cleanedResult?.preview && cleanedResult.preview.length > 0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    {Object.keys(cleanedResult.preview[0]).map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cleanedResult.preview.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val, cidx) => (
                        <td key={cidx}>{val !== null && val !== undefined ? String(val) : "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem" }}>
              No preview rows available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
