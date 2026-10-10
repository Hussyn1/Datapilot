from pydantic import BaseModel
from typing import Optional, Any

class ColumnStat(BaseModel):
    column: str
    dtype: str
    null_count: int
    null_percentage: float
    unique_count: int
    sample_values: list[Any]

class CsvStatsResponse(BaseModel):
    file_id: str
    row_count: int
    column_count: int
    duplicate_rows_count: int = 0
    columns: list[ColumnStat]

class CleanOperation(BaseModel):
    drop_columns: list[str] = []
    drop_duplicates: bool = True
    trim_whitespace: bool = True
    standardize_text: bool = False
    fillna_strategy: dict[str, str] = {}  # col -> "mean" | "median" | "mode" | "zero" | "unknown" | "drop_rows"
    custom_fill_values: dict[str, str] = {}

class CleanRequest(BaseModel):
    file_id: str
    operations: CleanOperation