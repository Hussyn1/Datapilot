import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { uploadCsv, getAiSuggestions, cleanCsv, downloadCsvFile, sendAiChat } from "../api/csvApi";
import DatasetComparisonView from "../components/DatasetComparisonView";

function CsvWorkspace() {
  const { token, logout } = useAuth();
  
  // Folders state
  const [folders, setFolders] = useState([
    { id: "f1", name: "My Datasets", count: 1 },
    { id: "f2", name: "Raw CSV Uploads", count: 0 },
    { id: "f3", name: "Cleaned Projects", count: 0 },
    { id: "f4", name: "Financial Data", count: 0 },
  ]);
  const [activeFolderId, setActiveFolderId] = useState("f1");
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Dataset states per workspace
  const [stats, setStats] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedDrops, setSelectedDrops] = useState([]);
  const [dropDuplicates, setDropDuplicates] = useState(true);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [standardizeText, setStandardizeText] = useState(true);
  const [fillnaStrategy, setFillnaStrategy] = useState({}); // col -> "mean" | "median" | "mode" | "zero" | "unknown" | "drop_rows"
  const [cleanedResult, setCleanedResult] = useState(null);
  
  // Right Sidebar Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState("suggestions");

  // AI Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "Hello! I am DataPilot AI. Ask me anything about duplicate values, inconsistent text formatting, missing value imputation, or column selection." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Operation Loading States
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  // Switch Active Folder & Reset Workspace View for New Folder
  function handleSelectFolder(folderId) {
    setActiveFolderId(folderId);
    setStats(null);
    setSuggestions([]);
    setSelectedDrops([]);
    setFillnaStrategy({});
    setCleanedResult(null);
    setError("");
    setChatMessages([
      { role: "assistant", content: "Hello! I am DataPilot AI. Ask me anything about duplicate values, inconsistent text formatting, missing value imputation, or column selection." }
    ]);
  }

  // Add new folder handler
  function handleAddFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const newId = "f_" + Date.now();
    const newF = {
      id: newId,
      name: newFolderName.trim(),
      count: 0
    };
    setFolders([...folders, newF]);
    setNewFolderName("");
    setShowNewFolderModal(false);
    handleSelectFolder(newId);
  }

  // Handle CSV file upload
  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const data = await uploadCsv(file, token);
      setStats(data);
      setSuggestions([]);
      setSelectedDrops([]);
      setFillnaStrategy({});
      setCleanedResult(null);
      setFolders((prev) =>
        prev.map((f) => (f.id === activeFolderId ? { ...f, count: f.count + 1 } : f))
      );
    } catch (err) {
      setError(err.message || "Failed to upload and analyze CSV.");
    } finally {
      setLoading(false);
    }
  }

  // Handle AI Suggestions trigger
  async function handleGetSuggestions() {
    if (!stats?.file_id) return;
    setDrawerOpen(true);
    setActiveDrawerTab("suggestions");
    setAiLoading(true);
    setError("");
    try {
      const data = await getAiSuggestions(stats.file_id, token);
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err.message || "Failed to fetch AI suggestions.");
    } finally {
      setAiLoading(false);
    }
  }

  // Handle Send Chat Message
  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim() || !stats?.file_id || chatLoading) return;
    
    const userMsg = chatInput.trim();
    setChatInput("");
    const updatedMessages = [...chatMessages, { role: "user", content: userMsg }];
    setChatMessages(updatedMessages);
    setChatLoading(true);

    try {
      const historyPayload = updatedMessages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await sendAiChat(stats.file_id, userMsg, historyPayload, token);
      setChatMessages([...updatedMessages, { role: "assistant", content: res.reply }]);
    } catch (err) {
      setChatMessages([...updatedMessages, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  function toggleDrop(column) {
    setSelectedDrops((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]
    );
  }

  function handleStrategyChange(col, strategy) {
    setFillnaStrategy((prev) => ({
      ...prev,
      [col]: strategy,
    }));
  }

  function applySuggestion(s) {
    if (s.action === "drop" && !selectedDrops.includes(s.column)) {
      setSelectedDrops((prev) => [...prev, s.column]);
    } else if (s.action === "impute_median") {
      handleStrategyChange(s.column, "median");
    } else if (s.action === "impute_mode") {
      handleStrategyChange(s.column, "mode");
    } else if (s.action === "remove_duplicates") {
      setDropDuplicates(true);
    }
  }

  // Execute cleaning operation
  async function handleClean() {
    if (!stats?.file_id) return;
    setCleaning(true);
    setError("");
    try {
      const result = await cleanCsv(
        stats.file_id,
        {
          drop_columns: selectedDrops,
          drop_duplicates: dropDuplicates,
          trim_whitespace: trimWhitespace,
          standardize_text: standardizeText,
          fillna_strategy: fillnaStrategy,
        },
        token
      );
      setCleanedResult(result);
    } catch (err) {
      setError(err.message || "Failed to clean CSV dataset.");
    } finally {
      setCleaning(false);
    }
  }

  // Download cleaned file
  async function handleDownload() {
    if (!cleanedResult?.new_file_id) return;
    setDownloading(true);
    setError("");
    try {
      await downloadCsvFile(cleanedResult.new_file_id, token);
    } catch (err) {
      setError(err.message || "Failed to download cleaned CSV.");
    } finally {
      setDownloading(false);
    }
  }

  const activeFolderName = folders.find((f) => f.id === activeFolderId)?.name || "Workspace";

  return (
    <div className="app-layout">
      {/* LEFT SIDEBAR (Folder Structure) */}
      <aside className="left-sidebar">
        <div className="sidebar-brand">
          <span>DataPilot</span>
          <span className="sidebar-badge">PRO</span>
        </div>

        <div className="sidebar-section-header">
          <span>Workspace Folders</span>
          <span style={{ cursor: "pointer", fontSize: "1rem" }} onClick={() => setShowNewFolderModal(!showNewFolderModal)}>➕</span>
        </div>

        {showNewFolderModal && (
          <form onSubmit={handleAddFolder} style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder="Folder Name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem", marginBottom: "0.4rem" }}
              autoFocus
            />
            <button type="submit" className="btn-orange" style={{ width: "100%", padding: "0.3rem", fontSize: "0.75rem" }}>
              Create Folder
            </button>
          </form>
        )}

        <div className="folder-tree">
          {folders.map((f) => (
            <div
              key={f.id}
              className={`folder-item ${activeFolderId === f.id ? "active" : ""}`}
              onClick={() => handleSelectFolder(f.id)}
            >
              <span>📁 {f.name}</span>
              <span className="file-count">{f.count}</span>
            </div>
          ))}
        </div>

        <button
          className="btn-add-folder"
          onClick={() => setShowNewFolderModal(true)}
        >
          ➕ New Folder
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-content">
        <header className="top-navbar">
          <div style={{ fontWeight: 600, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>📁 {activeFolderName}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>/ Dataset Cleaner</span>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link to="/image-labeling" style={{ textDecoration: "none" }}>
              <button
                className="btn-secondary"
                style={{
                  fontSize: "0.85rem",
                  padding: "0.45rem 0.85rem",
                  borderColor: "var(--accent-orange-border)",
                  color: "var(--accent-orange)",
                  background: "var(--accent-orange-light)",
                }}
              >
                🖼️ Image Auto-Labeler
              </button>
            </Link>
            {stats && (
              <button
                className="btn-orange"
                onClick={() => setDrawerOpen(!drawerOpen)}
              >
                ✨ AI Suggestions & Chat
              </button>
            )}
            <button onClick={logout} className="btn-secondary">
              Sign Out
            </button>
          </div>
        </header>

        <main className="workspace-container">
          {error && <div className="alert-error">{error}</div>}

          {!stats ? (
            <div className="card" style={{ textAlign: "center", padding: "3.5rem 2rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📂</div>
              <h3 className="card-title" style={{ justifyContent: "center" }}>Upload CSV to "{activeFolderName}"</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                Select or drag a CSV file to inspect dataset columns, clean duplicates, standardize text, and impute missing values.
              </p>
              <div className="upload-dropzone" onClick={() => document.getElementById("csv-file-input").click()}>
                <p style={{ fontSize: "1.1rem", fontWeight: "600", color: "var(--accent-orange)", marginBottom: "0.25rem" }}>
                  {loading ? "Analyzing CSV structure..." : "Click or Drag & Drop CSV file here"}
                </p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Supports .csv files up to 50MB
                </p>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Active Dataset Workspace</h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Folder: {activeFolderName}</p>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => document.getElementById("csv-file-input-reupload").click()}
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
                >
                  🔄 Replace CSV File
                  <input
                    id="csv-file-input-reupload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </button>
              </div>

              {/* STATS DASHBOARD */}
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="label">Total Rows</div>
                  <div className="value">{stats.row_count.toLocaleString()}</div>
                </div>
                <div className="stat-box">
                  <div className="label">Total Columns</div>
                  <div className="value">{stats.column_count}</div>
                </div>
                <div className="stat-box">
                  <div className="label">Duplicate Rows</div>
                  <div className="value" style={{ color: stats.duplicate_rows_count > 0 ? "#dc2626" : "var(--text-main)" }}>
                    {stats.duplicate_rows_count}
                  </div>
                </div>
                <div className="stat-box">
                  <div className="label">Selected to Drop</div>
                  <div className="value" style={{ color: selectedDrops.length ? "var(--accent-orange)" : "var(--text-main)" }}>
                    {selectedDrops.length}
                  </div>
                </div>
              </div>

              {/* DATA CLEANING OPTIONS CARD */}
              <div className="card" style={{ marginBottom: "1.5rem" }}>
                <h3 className="card-title" style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>
                  ⚙️ Global Data Cleaning Controls
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.9rem" }}>
                    <input
                      type="checkbox"
                      checked={dropDuplicates}
                      onChange={(e) => setDropDuplicates(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: "var(--accent-orange)" }}
                    />
                    <div>
                      <strong>Remove Duplicate Rows</strong>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {stats.duplicate_rows_count} duplicate rows found in dataset
                      </p>
                    </div>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.9rem" }}>
                    <input
                      type="checkbox"
                      checked={trimWhitespace}
                      onChange={(e) => setTrimWhitespace(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: "var(--accent-orange)" }}
                    />
                    <div>
                      <strong>Trim Text Whitespace</strong>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Strips leading/trailing spaces from text fields
                      </p>
                    </div>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.9rem" }}>
                    <input
                      type="checkbox"
                      checked={standardizeText}
                      onChange={(e) => setStandardizeText(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: "var(--accent-orange)" }}
                    />
                    <div>
                      <strong>Standardize Text Casing</strong>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Converts inconsistent text to Titlecase & fixes 'N/A' strings
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* TABLE CARD */}
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 className="card-title" style={{ margin: 0 }}>📊 Column Quality & Imputation Strategy</h3>
                  <button
                    onClick={handleGetSuggestions}
                    className="btn-orange"
                    disabled={aiLoading}
                  >
                    {aiLoading ? "Analyzing with AI..." : "✨ View AI Insights & Chat"}
                  </button>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Column Name</th>
                        <th>Type</th>
                        <th>Null %</th>
                        <th>Unique</th>
                        <th>Missing Value Strategy</th>
                        <th>Drop Column?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.columns.map((col) => (
                        <tr key={col.column}>
                          <td><strong>{col.column}</strong></td>
                          <td><span className="badge badge-info">{col.dtype}</span></td>
                          <td>
                            <span className={col.null_percentage > 30 ? "badge badge-warning" : ""}>
                              {col.null_percentage}% ({col.null_count})
                            </span>
                          </td>
                          <td>{col.unique_count}</td>
                          <td>
                            <select
                              value={fillnaStrategy[col.column] || "none"}
                              onChange={(e) => handleStrategyChange(col.column, e.target.value)}
                              style={{
                                padding: "0.35rem 0.6rem",
                                borderRadius: "6px",
                                border: "1px solid var(--surface-border)",
                                fontSize: "0.85rem",
                                background: "#f8fafc",
                                width: "100%",
                                cursor: "pointer"
                              }}
                            >
                              <option value="none">No Imputation</option>
                              {col.dtype.includes("int") || col.dtype.includes("float") ? (
                                <>
                                  <option value="mean">Fill Mean</option>
                                  <option value="median">Fill Median</option>
                                  <option value="zero">Fill Zero (0)</option>
                                </>
                              ) : (
                                <>
                                  <option value="mode">Fill Mode (Most Frequent)</option>
                                  <option value="unknown">Fill "Unknown"</option>
                                </>
                              )}
                              <option value="drop_rows">Drop Rows with Nulls</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedDrops.includes(col.column)}
                              onChange={() => toggleDrop(col.column)}
                              style={{ width: 18, height: 18, accentColor: "var(--accent-orange)", cursor: "pointer" }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={handleClean}
                    className="btn-success"
                    disabled={cleaning}
                  >
                    {cleaning ? "Executing Cleaning Pipeline..." : "⚡ Execute Cleaning & Preview"}
                  </button>
                </div>
              </div>
            </>
          )}

          {cleanedResult && (
            <DatasetComparisonView
              comparison={cleanedResult.comparison}
              explanation={cleanedResult.explanation}
              cleanedResult={cleanedResult}
              onDownload={handleDownload}
              downloading={downloading}
            />
          )}
        </main>
      </div>

      {/* RIGHT SIDEBAR DRAWER (AI Suggestions & Interactive Chat) */}
      <aside className={`right-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <div className="drawer-title">
            <span>✨ AI Assistant</span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <div className="drawer-tabs">
          <button
            className={`drawer-tab ${activeDrawerTab === "suggestions" ? "active" : ""}`}
            onClick={() => setActiveDrawerTab("suggestions")}
          >
            Suggestions ({suggestions.length})
          </button>
          <button
            className={`drawer-tab ${activeDrawerTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveDrawerTab("chat")}
          >
            AI Chat
          </button>
        </div>

        <div className="drawer-content">
          {activeDrawerTab === "suggestions" ? (
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                AI Recommendations powered by Groq (<code style={{ fontSize: "0.75rem" }}>openai/gpt-oss-120b</code>):
              </p>

              {aiLoading ? (
                <p style={{ textAlign: "center", color: "var(--accent-orange)", margin: "2rem 0" }}>
                  Analyzing dataset columns & quality...
                </p>
              ) : suggestions.length === 0 ? (
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", textAlign: "center", margin: "2rem 0" }}>
                  No drop or imputation suggestions generated yet. Click "View AI Insights" to analyze!
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {suggestions.map((s, i) => (
                    <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "0.85rem", borderRadius: "8px" }}>
                      <div style={{ fontWeight: "700", color: "#c2410c", marginBottom: "0.2rem" }}>
                        Action: {s.action} | {s.column}
                      </div>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.6rem" }}>
                        {s.reason}
                      </p>
                      <button
                        onClick={() => applySuggestion(s)}
                        className="btn-orange"
                        style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", width: "100%" }}
                      >
                        Apply {s.action}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="chat-container">
              <div className="chat-messages">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat-bubble ${msg.role}`} style={{ whiteSpace: "pre-wrap" }}>
                    {msg.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="chat-bubble assistant" style={{ color: "var(--accent-orange)" }}>
                    DataPilot AI is typing...
                  </div>
                )}
              </div>

              <form onSubmit={handleSendChat} className="chat-input-area">
                <input
                  type="text"
                  placeholder="Ask AI about duplicates, imputations, or dataset cleanup..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" className="btn-orange" disabled={chatLoading || !chatInput.trim()}>
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default CsvWorkspace;