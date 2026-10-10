import pandas as pd
import numpy as np
import uuid
import os
from io import BytesIO

# In-memory cache + Disk persistence
_file_store: dict[str, pd.DataFrame] = {}

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def sanitize_value(val):
    """Ensures values like NaN, Inf, -Inf are converted to None for JSON compliance."""
    if pd.isna(val):
        return None
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        if np.isnan(val) or np.isinf(val):
            return None
        return float(val)
    return val

def sanitize_records(records: list[dict]) -> list[dict]:
    """Sanitizes list of dictionary records to prevent 'Out of range float values' JSON error."""
    sanitized = []
    for row in records:
        clean_row = {}
        for k, v in row.items():
            clean_row[k] = sanitize_value(v)
        sanitized.append(clean_row)
    return sanitized

def save_uploaded_csv(file_bytes: bytes) -> str:
    """Parses CSV bytes into a DataFrame, stores it in memory and on disk with UTF-8 BOM, returns a file_id."""
    file_id = str(uuid.uuid4())
    try:
        df = pd.read_csv(BytesIO(file_bytes), encoding="utf-8-sig")
    except Exception:
        try:
            df = pd.read_csv(BytesIO(file_bytes), encoding="latin1")
        except Exception:
            df = pd.read_csv(BytesIO(file_bytes), encoding_errors="replace")
            
    _file_store[file_id] = df
    
    filepath = os.path.join(UPLOAD_DIR, f"{file_id}.csv")
    df.to_csv(filepath, index=False, encoding="utf-8-sig")
    
    return file_id

def get_dataframe(file_id: str) -> pd.DataFrame:
    """Retrieves DataFrame from memory cache or loads from disk storage."""
    if file_id in _file_store:
        return _file_store[file_id]
        
    filepath = os.path.join(UPLOAD_DIR, f"{file_id}.csv")
    if os.path.exists(filepath):
        df = pd.read_csv(filepath, encoding="utf-8-sig")
        _file_store[file_id] = df
        return df
        
    raise ValueError("File not found or expired")

def compute_stats(file_id: str) -> dict:
    df = get_dataframe(file_id)
    columns = []
    duplicate_rows_count = int(df.duplicated().sum())

    for col in df.columns:
        null_count = int(df[col].isnull().sum())
        sample_vals = df[col].dropna().head(3).tolist()
        clean_samples = [sanitize_value(v) for v in sample_vals if sanitize_value(v) is not None]
        
        columns.append({
            "column": col,
            "dtype": str(df[col].dtype),
            "null_count": null_count,
            "null_percentage": round((null_count / len(df)) * 100, 2) if len(df) > 0 else 0,
            "unique_count": int(df[col].nunique()),
            "sample_values": clean_samples,
        })

    return {
        "file_id": file_id,
        "row_count": len(df),
        "column_count": len(df.columns),
        "duplicate_rows_count": duplicate_rows_count,
        "columns": columns,
    }

def clean_dataframe(file_id: str, operations: dict):
    df = get_dataframe(file_id).copy()

    # 1. Standardize inconsistent string null representations ('N/A', 'na', 'null', 'None', '-')
    for col in df.select_dtypes(include=["object", "string"]).columns:
        df[col] = df[col].replace(["N/A", "n/a", "na", "NA", "null", "NULL", "None", "-"], np.nan)

    # 2. Trim whitespace from text columns
    if operations.get("trim_whitespace", True):
        for col in df.select_dtypes(include=["object", "string"]).columns:
            df[col] = df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)

    # 3. Standardize text casing (Titlecase for names/words)
    if operations.get("standardize_text", False):
        for col in df.select_dtypes(include=["object", "string"]).columns:
            df[col] = df[col].apply(lambda x: x.title() if isinstance(x, str) else x)

    # 4. Drop requested columns
    drop_cols = operations.get("drop_columns", [])
    if drop_cols:
        df = df.drop(columns=[c for c in drop_cols if c in df.columns])

    # 5. Drop duplicate rows
    if operations.get("drop_duplicates", False):
        df = df.drop_duplicates()

    # 6. Advanced missing value imputation per column
    fillna_strategy = operations.get("fillna_strategy", {})
    for col, strategy in fillna_strategy.items():
        if col not in df.columns:
            continue
            
        if strategy == "mean" and pd.api.types.is_numeric_dtype(df[col]):
            mean_val = df[col].mean()
            df[col] = df[col].fillna(mean_val)
        elif strategy == "median" and pd.api.types.is_numeric_dtype(df[col]):
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)
        elif strategy == "mode":
            mode_vals = df[col].mode()
            if not mode_vals.empty:
                df[col] = df[col].fillna(mode_vals.iloc[0])
        elif strategy == "zero":
            df[col] = df[col].fillna(0)
        elif strategy == "unknown":
            df[col] = df[col].fillna("Unknown")
        elif strategy == "drop_rows":
            df = df.dropna(subset=[col])

    new_file_id = str(uuid.uuid4())
    _file_store[new_file_id] = df
    
    # Save cleaned result to disk with UTF-8 BOM encoding for Excel compatibility
    filepath = os.path.join(UPLOAD_DIR, f"{new_file_id}.csv")
    df.to_csv(filepath, index=False, encoding="utf-8-sig")
    
    return new_file_id, df

def compute_comparison(original_file_id: str, cleaned_file_id: str, operations: dict = None) -> dict:
    """Computes detailed statistical and column-level differences between before and after datasets."""
    df_before = get_dataframe(original_file_id)
    df_after = get_dataframe(cleaned_file_id)

    rows_before = len(df_before)
    rows_after = len(df_after)
    rows_removed = max(0, rows_before - rows_after)
    rows_retained_pct = round((rows_after / rows_before) * 100, 2) if rows_before > 0 else 0.0

    cols_before = len(df_before.columns)
    cols_after = len(df_after.columns)
    dropped_cols = [c for c in df_before.columns if c not in df_after.columns]

    dups_before = int(df_before.duplicated().sum())
    dups_after = int(df_after.duplicated().sum())
    dups_removed = max(0, dups_before - dups_after)

    cells_before = rows_before * cols_before if rows_before and cols_before else 1
    missing_before = int(df_before.isnull().sum().sum())
    completeness_before = round(((cells_before - missing_before) / cells_before) * 100, 2)

    cells_after = rows_after * cols_after if rows_after and cols_after else 1
    missing_after = int(df_after.isnull().sum().sum())
    completeness_after = round(((cells_after - missing_after) / cells_after) * 100, 2)

    missing_resolved = max(0, missing_before - missing_after)
    completeness_delta = round(completeness_after - completeness_before, 2)

    column_comparison = []
    strategies = (operations or {}).get("fillna_strategy", {})

    for col in df_before.columns:
        nulls_b = int(df_before[col].isnull().sum())
        null_pct_b = round((nulls_b / rows_before) * 100, 2) if rows_before > 0 else 0.0
        dtype_b = str(df_before[col].dtype)

        if col in df_after.columns:
            nulls_a = int(df_after[col].isnull().sum())
            null_pct_a = round((nulls_a / rows_after) * 100, 2) if rows_after > 0 else 0.0
            dtype_a = str(df_after[col].dtype)
            imputed = max(0, nulls_b - nulls_a)
            applied_strategy = strategies.get(col, "retained")
            if nulls_b > 0 and nulls_a == 0 and applied_strategy == "retained":
                status = "auto-cleaned"
            elif imputed > 0:
                status = f"imputed ({applied_strategy})"
            else:
                status = "retained"

            column_comparison.append({
                "column": col,
                "status": status,
                "is_dropped": False,
                "dtype_before": dtype_b,
                "dtype_after": dtype_a,
                "null_count_before": nulls_b,
                "null_count_after": nulls_a,
                "null_pct_before": null_pct_b,
                "null_pct_after": null_pct_a,
                "imputed_count": imputed
            })
        else:
            column_comparison.append({
                "column": col,
                "status": "dropped",
                "is_dropped": True,
                "dtype_before": dtype_b,
                "dtype_after": "dropped",
                "null_count_before": nulls_b,
                "null_count_after": 0,
                "null_pct_before": null_pct_b,
                "null_pct_after": 0.0,
                "imputed_count": 0
            })

    return {
        "summary": {
            "rows_before": rows_before,
            "rows_after": rows_after,
            "rows_removed": rows_removed,
            "rows_retained_pct": rows_retained_pct,
            "columns_before": cols_before,
            "columns_after": cols_after,
            "columns_dropped": dropped_cols,
            "columns_dropped_count": len(dropped_cols),
            "duplicates_before": dups_before,
            "duplicates_after": dups_after,
            "duplicates_removed": dups_removed,
            "missing_cells_before": missing_before,
            "missing_cells_after": missing_after,
            "missing_cells_resolved": missing_resolved,
            "completeness_score_before": completeness_before,
            "completeness_score_after": completeness_after,
            "completeness_gain": completeness_delta,
        },
        "columns": column_comparison,
        "operations": operations or {}
    }