import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { labelImagesBatch, exportLabeledDataset } from "../api/imageApi";

export default function ImageLabelingStudio() {
  const { token, logout } = useAuth();

  // Upload & Config state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [labelingMode, setLabelingMode] = useState("custom"); // "custom" | "auto"
  const [candidateLabelsInput, setCandidateLabelsInput] = useState("Defect, Normal, Scratch, Misaligned");
  
  // Results & Session state
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [records, setRecords] = useState([]);
  const [classDistribution, setClassDistribution] = useState({});
  const [avgConfidence, setAvgConfidence] = useState(0);

  // Gallery Filters
  const [activeClassFilter, setActiveClassFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState("ALL"); // "ALL" | "HIGH" | "LOW"

  // Modal Preview
  const [previewImage, setPreviewImage] = useState(null);

  function handleFileSelection(e) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
      setError("");
    }
  }

  async function handleStartAutoLabeling() {
    if (selectedFiles.length === 0) {
      setError("Please select one or more image files or a .zip archive first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const candidateLabels = labelingMode === "custom" ? candidateLabelsInput : "";
      const result = await labelImagesBatch(selectedFiles, candidateLabels, token);

      setSessionId(result.session_id);
      setRecords(result.records || []);
      setClassDistribution(result.class_distribution || {});
      setAvgConfidence(result.average_confidence || 0);
    } catch (err) {
      setError(err.message || "Failed to auto-label images with Groq AI.");
    } finally {
      setLoading(false);
    }
  }

  function handleLabelChange(id, newLabel) {
    const updated = records.map((r) => (r.id === id ? { ...r, label: newLabel } : r));
    setRecords(updated);

    // Recompute distribution
    const dist = {};
    for (const r of updated) {
      dist[r.label] = (dist[r.label] || 0) + 1;
    }
    setClassDistribution(dist);
  }

  function handleDeleteRecord(id) {
    const updated = records.filter((r) => r.id !== id);
    setRecords(updated);

    const dist = {};
    for (const r of updated) {
      dist[r.label] = (dist[r.label] || 0) + 1;
    }
    setClassDistribution(dist);
  }

  async function handleExport(format) {
    if (!sessionId || records.length === 0) return;
    setExporting(true);
    setError("");
    try {
      await exportLabeledDataset(sessionId, format, records, token);
    } catch (err) {
      setError(err.message || `Failed to export dataset as ${format.toUpperCase()}.`);
    } finally {
      setExporting(false);
    }
  }

  // Filter records
  const filteredRecords = records.filter((r) => {
    const matchesClass = activeClassFilter === "ALL" || r.label === activeClassFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      r.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.tags && r.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesConf =
      confidenceFilter === "ALL" ||
      (confidenceFilter === "HIGH" && r.confidence >= 0.8) ||
      (confidenceFilter === "LOW" && r.confidence < 0.8);

    return matchesClass && matchesSearch && matchesConf;
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-color)" }}>
      {/* TOP NAVBAR */}
      <header
        style={{
          background: "var(--surface-color)",
          borderBottom: "1px solid var(--surface-border)",
          padding: "0.85rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "var(--shadow-sm)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🚀</span>
            <span style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--accent-orange)" }}>
              DataPilot
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                background: "#f1f5f9",
                color: "var(--text-muted)",
                padding: "0.2rem 0.5rem",
                borderRadius: "6px",
              }}
            >
              STUDIO
            </span>
          </div>

          {/* Navigation link between CSV Cleaner & Image Studio */}
          <nav style={{ display: "flex", gap: "0.5rem", marginLeft: "1.5rem" }}>
            <Link
              to="/"
              style={{
                textDecoration: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                padding: "0.45rem 0.9rem",
                borderRadius: "8px",
              }}
            >
              📊 CSV Cleaner & Charts
            </Link>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--accent-orange)",
                background: "var(--accent-orange-light)",
                padding: "0.45rem 0.9rem",
                borderRadius: "8px",
                border: "1px solid var(--accent-orange-border)",
              }}
            >
              🖼️ Image Auto-Labeler (Groq Vision)
            </span>
          </nav>
        </div>

        <button
          onClick={logout}
          style={{
            background: "transparent",
            border: "1px solid var(--surface-border)",
            color: "var(--text-muted)",
            padding: "0.4rem 0.85rem",
            fontSize: "0.8rem",
            borderRadius: "6px",
          }}
        >
          Logout
        </button>
      </header>

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem 1.5rem", width: "100%", flexGrow: 1 }}>
        {/* HERO BANNER */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            color: "#ffffff",
            padding: "2rem",
            borderRadius: "16px",
            marginBottom: "2rem",
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1.5rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span
                style={{
                  background: "rgba(249, 115, 22, 0.2)",
                  color: "#fb923c",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.25rem 0.65rem",
                  borderRadius: "999px",
                  border: "1px solid rgba(249, 115, 22, 0.4)",
                }}
              >
                ⚡ Groq LPU Vision • qwen/qwen3.8-27b
              </span>
              <span
                style={{
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34d399",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.25rem 0.65rem",
                  borderRadius: "999px",
                }}
              >
                Active
              </span>
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 0.5rem 0" }}>
              AI Image Dataset Auto-Labeling Studio
            </h1>
            <p style={{ margin: 0, fontSize: "0.95rem", color: "#94a3b8", maxWidth: "680px", lineHeight: 1.5 }}>
              Upload individual images or a ZIP archive. Groq's high-speed multimodal vision AI classifies, detects visual attributes, and organizes your dataset into exportable labeled folders or annotations.
            </p>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
              Estimated Speed
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#38bdf8" }}>
              ~300-500 ms
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Per Image via Groq LPUs
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              padding: "0.85rem 1.25rem",
              borderRadius: "8px",
              marginBottom: "1.5rem",
              fontSize: "0.9rem",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* STEP 1: UPLOAD & CONFIGURATION CARD */}
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 className="card-title" style={{ marginBottom: "1.25rem" }}>
            1. Upload Images & Configure Classification
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {/* File Dropzone */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: "0.5rem",
                }}
              >
                Select Images or .ZIP Archive:
              </label>
              <div
                style={{
                  border: "2px dashed var(--surface-border)",
                  borderRadius: "12px",
                  padding: "2rem 1.5rem",
                  textAlign: "center",
                  background: "#f8fafc",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => document.getElementById("imageFileInput").click()}
              >
                <input
                  id="imageFileInput"
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.webp,.bmp,.gif,.zip"
                  onChange={handleFileSelection}
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📁</div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected`
                    : "Click or Drop Images / ZIP here"}
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Supports PNG, JPG, JPEG, WEBP, or a ZIP archive containing images.
                </p>
                {selectedFiles.length > 0 && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      fontSize: "0.75rem",
                      color: "var(--accent-orange)",
                      fontWeight: 600,
                    }}
                  >
                    ✓ Ready to process: {selectedFiles.slice(0, 3).map((f) => f.name).join(", ")}
                    {selectedFiles.length > 3 ? ` and ${selectedFiles.length - 3} more` : ""}
                  </div>
                )}
              </div>
            </div>

            {/* Classification Settings */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: "0.5rem",
                }}
              >
                Labeling Strategy:
              </label>

              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setLabelingMode("custom")}
                  style={{
                    flex: 1,
                    padding: "0.6rem 0.85rem",
                    borderRadius: "8px",
                    border: labelingMode === "custom" ? "2px solid var(--accent-orange)" : "1px solid var(--surface-border)",
                    background: labelingMode === "custom" ? "var(--accent-orange-light)" : "#fff",
                    color: labelingMode === "custom" ? "var(--accent-orange)" : "var(--text-main)",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  🎯 Candidate Classes
                </button>
                <button
                  type="button"
                  onClick={() => setLabelingMode("auto")}
                  style={{
                    flex: 1,
                    padding: "0.6rem 0.85rem",
                    borderRadius: "8px",
                    border: labelingMode === "auto" ? "2px solid var(--accent-orange)" : "1px solid var(--surface-border)",
                    background: labelingMode === "auto" ? "var(--accent-orange-light)" : "#fff",
                    color: labelingMode === "auto" ? "var(--accent-orange)" : "var(--text-main)",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  🔍 Open Auto-Detect
                </button>
              </div>

              {labelingMode === "custom" ? (
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                    Candidate Classes (comma-separated):
                  </label>
                  <input
                    type="text"
                    value={candidateLabelsInput}
                    onChange={(e) => setCandidateLabelsInput(e.target.value)}
                    placeholder="e.g. Dog, Cat, Bird, Car"
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      border: "1px solid var(--surface-border)",
                      fontSize: "0.85rem",
                    }}
                  />
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                    Groq Vision will assign each image to the closest matching class from this list.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "8px",
                    padding: "0.85rem",
                    fontSize: "0.825rem",
                    color: "var(--text-muted)",
                  }}
                >
                  💡 <strong>Auto-Detect Mode:</strong> Groq will dynamically analyze each image and generate free-form primary category labels and visual tags.
                </div>
              )}

              <div style={{ marginTop: "1.25rem" }}>
                <button
                  type="button"
                  onClick={handleStartAutoLabeling}
                  className="btn-orange"
                  disabled={loading || selectedFiles.length === 0}
                  style={{ width: "100%", padding: "0.75rem 1.25rem", fontSize: "0.95rem" }}
                >
                  {loading ? (
                    <span>⏳ Groq AI Labeling in Progress...</span>
                  ) : (
                    <span>✨ Start Groq AI Auto-Labeling ({selectedFiles.length} files)</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2: REVIEW & EXPORT STUDIO (When records exist) */}
        {records.length > 0 && (
          <div>
            {/* KPI STATS ROW */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
                marginBottom: "1.75rem",
              }}
            >
              <div className="metric-delta-card">
                <div className="metric-label">Total Images Labeled</div>
                <div className="metric-compare">
                  <span className="metric-after">{records.length}</span>
                </div>
                <div className="metric-delta positive">Ready for Export</div>
              </div>

              <div className="metric-delta-card">
                <div className="metric-label">Detected Classes</div>
                <div className="metric-compare">
                  <span className="metric-after">{Object.keys(classDistribution).length}</span>
                </div>
                <div className="metric-delta neutral">Distinct categories</div>
              </div>

              <div className="metric-delta-card highlight">
                <div className="metric-label">Average Confidence</div>
                <div className="metric-compare">
                  <span className="metric-after" style={{ color: "#10b981" }}>
                    {(avgConfidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="metric-delta positive">High Accuracy</div>
              </div>
            </div>

            {/* CLASS DISTRIBUTION PILLS & EXPORT BAR */}
            <div
              className="card"
              style={{
                marginBottom: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.5rem" }}>
                  Filter by Category:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setActiveClassFilter("ALL")}
                    style={{
                      padding: "0.35rem 0.75rem",
                      fontSize: "0.8rem",
                      borderRadius: "999px",
                      border: "1px solid var(--surface-border)",
                      background: activeClassFilter === "ALL" ? "var(--accent-orange)" : "#fff",
                      color: activeClassFilter === "ALL" ? "#fff" : "var(--text-main)",
                    }}
                  >
                    All ({records.length})
                  </button>
                  {Object.entries(classDistribution).map(([label, count]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setActiveClassFilter(label)}
                      style={{
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.8rem",
                        borderRadius: "999px",
                        border: "1px solid var(--surface-border)",
                        background: activeClassFilter === label ? "var(--accent-orange)" : "#fff",
                        color: activeClassFilter === label ? "#fff" : "var(--text-main)",
                      }}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Buttons */}
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleExport("zip")}
                  className="btn-orange"
                  disabled={exporting}
                  style={{ fontSize: "0.85rem", padding: "0.55rem 1rem" }}
                >
                  📦 Export Foldered ZIP
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  style={{
                    background: "#fff",
                    border: "1px solid var(--surface-border)",
                    color: "var(--text-main)",
                    fontSize: "0.85rem",
                    padding: "0.55rem 1rem",
                  }}
                  disabled={exporting}
                >
                  📄 Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("json")}
                  style={{
                    background: "#fff",
                    border: "1px solid var(--surface-border)",
                    color: "var(--text-main)",
                    fontSize: "0.85rem",
                    padding: "0.55rem 1rem",
                  }}
                  disabled={exporting}
                >
                  📋 Export JSON
                </button>
              </div>
            </div>

            {/* SEARCH & CONFIDENCE FILTER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <input
                type="text"
                placeholder="Search by filename, label, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "0.5rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--surface-border)",
                  fontSize: "0.85rem",
                  width: "280px",
                }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Confidence:</span>
                <select
                  value={confidenceFilter}
                  onChange={(e) => setConfidenceFilter(e.target.value)}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--surface-border)",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="ALL">All Confidences</option>
                  <option value="HIGH">High (≥ 80%)</option>
                  <option value="LOW">Review Needed (&lt; 80%)</option>
                </select>
                <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                  Showing {filteredRecords.length} of {records.length}
                </span>
              </div>
            </div>

            {/* GALLERY GRID */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "1.25rem",
              }}
            >
              {filteredRecords.map((r) => {
                const confPercent = Math.round(r.confidence * 100);
                const confColor = confPercent >= 80 ? "#10b981" : confPercent >= 60 ? "#f97316" : "#ef4444";

                return (
                  <div
                    key={r.id}
                    style={{
                      background: "var(--surface-color)",
                      border: "1px solid var(--surface-border)",
                      borderRadius: "12px",
                      overflow: "hidden",
                      boxShadow: "var(--shadow-sm)",
                      display: "flex",
                      flexDirection: "column",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                  >
                    {/* Thumbnail Image */}
                    <div
                      style={{
                        position: "relative",
                        height: "180px",
                        background: "#0f172a",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onClick={() => setPreviewImage(r)}
                    >
                      {r.preview_url ? (
                        <img
                          src={r.preview_url}
                          alt={r.filename}
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <div style={{ color: "#64748b", fontSize: "0.85rem" }}>No Preview</div>
                      )}

                      {/* Confidence Tag on Thumbnail */}
                      <span
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          background: "rgba(15, 23, 42, 0.8)",
                          color: confColor,
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "6px",
                          backdropFilter: "blur(4px)",
                          border: `1px solid ${confColor}40`,
                        }}
                      >
                        {confPercent}%
                      </span>
                    </div>

                    {/* Card Content */}
                    <div style={{ padding: "1rem", flexGrow: 1, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {/* Filename */}
                      <div
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={r.filename}
                      >
                        {r.filename}
                      </div>

                      {/* Editable Label Field */}
                      <div>
                        <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                          Assigned Label:
                        </label>
                        <input
                          type="text"
                          value={r.label}
                          onChange={(e) => handleLabelChange(r.id, e.target.value)}
                          style={{
                            width: "100%",
                            padding: "0.35rem 0.6rem",
                            borderRadius: "6px",
                            border: "1px solid var(--accent-orange-border)",
                            background: "var(--accent-orange-light)",
                            color: "var(--accent-orange)",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            marginTop: "0.2rem",
                          }}
                        />
                      </div>

                      {/* Tags */}
                      {r.tags && r.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                          {r.tags.map((tag, tidx) => (
                            <span
                              key={tidx}
                              style={{
                                fontSize: "0.68rem",
                                background: "#f1f5f9",
                                color: "#475569",
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Description */}
                      {r.description && (
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.35 }}>
                          {r.description}
                        </p>
                      )}

                      {/* Footer Actions */}
                      <div style={{ marginTop: "auto", paddingTop: "0.5rem", display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(r.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            padding: "0.2rem 0.4rem",
                          }}
                        >
                          🗑 Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* IMAGE ZOOM MODAL */}
        {previewImage && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "1rem",
            }}
            onClick={() => setPreviewImage(null)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                maxWidth: "600px",
                width: "100%",
                overflow: "hidden",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ background: "#0f172a", padding: "1.5rem", textAlign: "center" }}>
                <img
                  src={previewImage.preview_url}
                  alt={previewImage.filename}
                  style={{ maxHeight: "360px", maxWidth: "100%", objectFit: "contain" }}
                />
              </div>
              <div style={{ padding: "1.25rem" }}>
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>{previewImage.filename}</h3>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
                  <span className="badge-tag imputed" style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}>
                    Label: {previewImage.label}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Confidence: {(previewImage.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                  {previewImage.description}
                </p>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="btn-orange"
                  style={{ width: "100%" }}
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
