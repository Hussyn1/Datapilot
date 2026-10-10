import os
import json
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Supported Groq LLM Models
PRIMARY_MODEL = "openai/gpt-oss-120b"
FALLBACK_MODELS = [
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile",
    "llama-3.1-80b-instant",
    "llama3-70b-8192"
]

def get_groq_client():
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if not groq_key:
        return None
    try:
        from groq import Groq
        return Groq(api_key=groq_key)
    except Exception as e:
        logger.warning(f"Could not instantiate Groq client: {e}")
        return None

def suggest_columns_to_drop(stats: dict) -> list[dict]:
    """Generates AI suggestions for column drops, missing value imputations, duplicate removals, and text cleaning."""
    client = get_groq_client()
    
    if client:
        prompt = f"""You are an expert data cleaning assistant. Given these dataset statistics, suggest comprehensive data cleaning actions:
- Which columns to drop (high nulls >50%, constant columns, or unneeded ID columns)
- Which columns to impute missing values (mean, median, mode, or unknown)
- Whether to remove duplicate rows or trim text whitespace

Dataset statistics:
{json.dumps(stats, indent=2)}

Respond ONLY with valid JSON in this exact format, no other text:
{{"suggestions": [{{"column": "column_name", "action": "drop | impute_median | impute_mode | trim_text", "reason": "short explanation"}}]}}
"""
        models_to_try = [PRIMARY_MODEL] + FALLBACK_MODELS
        for model in models_to_try:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}]
                )
                raw_text = response.choices[0].message.content.strip()
                if "```" in raw_text:
                    raw_text = raw_text.split("```")[1].replace("json", "").strip()
                result = json.loads(raw_text)
                return result.get("suggestions", [])
            except Exception as e:
                logger.warning(f"Groq API suggest failed for model {model}: {e}")

    # Heuristic fallback engine when Groq API key is missing or encounters errors
    suggestions = []
    columns = stats.get("columns", [])
    row_count = stats.get("row_count", 0)
    dup_count = stats.get("duplicate_rows_count", 0)

    if dup_count > 0:
        suggestions.append({
            "column": "Dataset Duplicate Rows",
            "action": "remove_duplicates",
            "reason": f"Found {dup_count} duplicate rows in dataset that should be removed"
        })

    for col_stat in columns:
        col_name = col_stat.get("column", "")
        dtype = col_stat.get("dtype", "")
        null_pct = col_stat.get("null_percentage", 0)
        unique_count = col_stat.get("unique_count", 0)
        col_lower = col_name.lower()

        # Action 1: Drop high nulls
        if null_pct >= 50:
            suggestions.append({
                "column": col_name,
                "action": "drop",
                "reason": f"High missing value rate ({null_pct}% nulls)"
            })
        # Action 2: Drop constant column
        elif unique_count == 1 and row_count > 1:
            suggestions.append({
                "column": col_name,
                "action": "drop",
                "reason": "Constant column containing only 1 unique value across all rows"
            })
        # Action 3: Impute missing numericals
        elif 0 < null_pct < 50 and ("float" in dtype or "int" in dtype):
            suggestions.append({
                "column": col_name,
                "action": "impute_median",
                "reason": f"Contains {null_pct}% missing numeric values; impute with column median"
            })
        # Action 4: Impute missing categoricals
        elif 0 < null_pct < 50 and ("object" in dtype or "str" in dtype):
            suggestions.append({
                "column": col_name,
                "action": "impute_mode",
                "reason": f"Contains {null_pct}% missing text values; fill with mode or 'Unknown'"
            })
        # Action 5: Drop high-cardinality IDs
        elif ("id" in col_lower or "guid" in col_lower) and unique_count == row_count and row_count > 5:
            suggestions.append({
                "column": col_name,
                "action": "drop",
                "reason": "High-cardinality identifier column unlikely to contain predictive signals"
            })

    return suggestions

def chat_with_ai(user_message: str, stats: dict, chat_history: list[dict] = None) -> str:
    """Answers user queries about dataset analysis, duplicate removal, text cleaning, and missing value strategies."""
    client = get_groq_client()
    
    cols_summary = []
    for c in stats.get("columns", []):
        cols_summary.append(f"{c.get('column')} ({c.get('dtype')}, {c.get('null_percentage')}% null, {c.get('unique_count')} unique)")

    system_prompt = f"""You are DataPilot AI, an expert data cleaning and analysis assistant.
Current Dataset Summary:
- Total Rows: {stats.get('row_count', 'Unknown')}
- Total Columns: {stats.get('column_count', 'Unknown')}
- Duplicate Rows Count: {stats.get('duplicate_rows_count', 0)}
- Column Details: {', '.join(cols_summary[:15])}

Provide comprehensive advice on:
1. Handling duplicate rows & inconsistent text values (whitespace, capitalization, 'N/A' strings)
2. Choosing missing value imputation strategies (mean, median, mode, zero, drop rows)
3. Column selection and feature engineering recommendations."""

    if client:
        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            for msg in chat_history[-6:]:
                role = msg.get("role", "user")
                if role not in ["user", "assistant"]:
                    role = "user"
                content = str(msg.get("content", "")).strip()
                if content:
                    messages.append({"role": role, "content": content})
                    
        messages.append({"role": "user", "content": user_message})

        models_to_try = [PRIMARY_MODEL] + FALLBACK_MODELS
        for model in models_to_try:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=600,
                )
                reply = response.choices[0].message.content
                if reply and len(reply.strip()) > 0:
                    return reply
            except Exception as e:
                logger.warning(f"Groq Chat failed for model {model}: {e}")

    dup_count = stats.get("duplicate_rows_count", 0)
    high_nulls = [c.get("column") for c in stats.get("columns", []) if c.get("null_percentage", 0) >= 30]
    
    return f"Dataset Analysis ({stats.get('row_count', 0)} rows, {stats.get('column_count', 0)} columns):\n- Duplicate Rows: {dup_count} found.\n- Columns with high nulls (>=30%): {', '.join(high_nulls) if high_nulls else 'None'}.\n- Recommended Actions: Enable 'Remove Duplicate Rows', turn on 'Trim Whitespace & Text Standardization', and select missing value fill strategies for null columns."

def explain_cleaning_transformation(comparison: dict) -> dict:
    """Generates an AI narrative and key audit insights explaining what happened during data cleaning and what changed."""
    summary = comparison.get("summary", {})
    rows_before = summary.get("rows_before", 0)
    rows_after = summary.get("rows_after", 0)
    rows_removed = summary.get("rows_removed", 0)
    cols_before = summary.get("columns_before", 0)
    cols_after = summary.get("columns_after", 0)
    dropped_cols = summary.get("columns_dropped", [])
    dups_removed = summary.get("duplicates_removed", 0)
    missing_before = summary.get("missing_cells_before", 0)
    missing_after = summary.get("missing_cells_after", 0)
    missing_resolved = summary.get("missing_cells_resolved", 0)
    completeness_before = summary.get("completeness_score_before", 0.0)
    completeness_after = summary.get("completeness_score_after", 0.0)
    completeness_gain = summary.get("completeness_gain", 0.0)

    client = get_groq_client()
    if client:
        prompt = f"""You are an expert Data Scientist and Dataset Quality Auditor.
A user just completed a data cleaning pipeline on their dataset.
Here are the statistical differences before and after:
- Rows: from {rows_before} to {rows_after} ({rows_removed} removed)
- Duplicate Rows Removed: {dups_removed}
- Columns: from {cols_before} to {cols_after} (Dropped columns: {dropped_cols if dropped_cols else 'None'})
- Missing Value Cells: from {missing_before} to {missing_after} ({missing_resolved} cells imputed or resolved)
- Dataset Completeness: improved from {completeness_before}% to {completeness_after}% (gain: +{completeness_gain}%)
- Column Details: {json.dumps(comparison.get('columns', [])[:8], indent=2)}

Explain clearly and professionally:
1. What happened during this cleaning process.
2. What specifically changed in the dataset and its impact on data hygiene.
3. Why the dataset is now better suited for ML models, analytics, or database storage.

Respond ONLY with valid JSON in this exact structure:
{{
  "headline": "Short punchy executive headline",
  "narrative": "1-2 paragraphs clear, engaging narrative explaining what occurred and what changed",
  "key_highlights": [
    "Specific bullet 1 about rows/duplicates",
    "Specific bullet 2 about missing values/imputations",
    "Specific bullet 3 about column pruning or hygiene"
  ],
  "data_readiness": "Assessment of readiness for downstream tasks (ML/BI/SQL)"
}}
"""
        models_to_try = [PRIMARY_MODEL] + FALLBACK_MODELS
        for model in models_to_try:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=700
                )
                raw_text = response.choices[0].message.content.strip()
                if "```" in raw_text:
                    raw_text = raw_text.split("```")[1].replace("json", "").strip()
                parsed = json.loads(raw_text)
                return {
                    "headline": parsed.get("headline", "Dataset Successfully Cleaned & Optimized"),
                    "narrative": parsed.get("narrative", ""),
                    "key_highlights": parsed.get("key_highlights", []),
                    "data_readiness": parsed.get("data_readiness", "Production-Ready for ML, BI & Analytics"),
                    "model_used": model
                }
            except Exception as e:
                logger.warning(f"Groq Explain failed for model {model}: {e}")

    # Heuristic fallback if Groq API key is missing or fails
    highlights = []
    if dups_removed > 0:
        highlights.append(f"Purged {dups_removed} duplicate rows, eliminating redundancy and preventing biased analytics.")
    if dropped_cols:
        highlights.append(f"Pruned {len(dropped_cols)} unnecessary or sparse column(s): {', '.join(dropped_cols)}.")
    if missing_resolved > 0:
        highlights.append(f"Resolved {missing_resolved} missing cell(s) via imputation strategies.")
    if completeness_gain > 0:
        highlights.append(f"Increased overall dataset completeness from {completeness_before}% to {completeness_after}% (+{completeness_gain}%).")
    if not highlights:
        highlights.append(f"Preserved {rows_after} records and normalized text fields across all columns.")

    narrative = (
        f"Your dataset underwent automated cleaning and preprocessing, transitioning from {rows_before} to {rows_after} rows "
        f"and {cols_before} to {cols_after} columns. "
        f"A total of {missing_resolved} missing data points were imputed, while {dups_removed} duplicate records were eliminated. "
        f"Overall dataset completeness reached {completeness_after}%, significantly improving suitability for machine learning and reporting."
    )

    return {
        "headline": "Dataset Successfully Cleaned & Optimized",
        "narrative": narrative,
        "key_highlights": highlights,
        "data_readiness": "Production-Ready for ML, BI & Analytics",
        "model_used": "heuristic-engine"
    }