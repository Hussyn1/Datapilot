from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
import io
from pydantic import BaseModel

from auth import get_current_user_id
from model.schemas import CleanRequest
from services import csv_cleaner, ai_client

router = APIRouter(prefix="/csv", tags=["csv"])

class AiSuggestBody(BaseModel):
    file_id: str | None = None

class ChatRequest(BaseModel):
    file_id: str
    message: str
    history: list[dict] = []

@router.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    contents = await file.read()
    file_id = csv_cleaner.save_uploaded_csv(contents)
    stats = csv_cleaner.compute_stats(file_id)
    return stats

@router.get("/stats/{file_id}")
async def get_stats(file_id: str, user_id: int = Depends(get_current_user_id)):
    try:
        return csv_cleaner.compute_stats(file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")

@router.post("/ai-suggest")
async def ai_suggest(
    file_id: str | None = Query(None),
    body: AiSuggestBody | None = None,
    user_id: int = Depends(get_current_user_id)
):
    target_file_id = file_id or (body.file_id if body else None)
    if not target_file_id:
        raise HTTPException(status_code=400, detail="file_id query or body parameter required")
        
    try:
        stats = csv_cleaner.compute_stats(target_file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")

    suggestions = ai_client.suggest_columns_to_drop(stats)
    return {"suggestions": suggestions}

@router.post("/chat")
async def ai_chat(request: ChatRequest, user_id: int = Depends(get_current_user_id)):
    try:
        stats = csv_cleaner.compute_stats(request.file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")

    reply = ai_client.chat_with_ai(request.message, stats, request.history)
    return {"reply": reply}

@router.post("/clean")
async def clean_csv(request: CleanRequest, user_id: int = Depends(get_current_user_id)):
    try:
        operations_dict = request.operations.model_dump()
        new_file_id, df = csv_cleaner.clean_dataframe(
            request.file_id, operations_dict
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")

    # Compute before vs after statistical comparison
    comparison = csv_cleaner.compute_comparison(
        request.file_id, new_file_id, operations_dict
    )

    # Generate Groq AI explanation and audit of what happened and what changed
    explanation = ai_client.explain_cleaning_transformation(comparison)

    # Convert head preview to records and sanitize NaN/Inf values for JSON compliance
    raw_preview = df.head(10).to_dict(orient="records")
    clean_preview = csv_cleaner.sanitize_records(raw_preview)

    return {
        "new_file_id": new_file_id,
        "row_count": len(df),
        "preview": clean_preview,
        "comparison": comparison,
        "explanation": explanation,
    }

@router.get("/comparison/{original_file_id}/{cleaned_file_id}")
async def get_dataset_comparison(
    original_file_id: str,
    cleaned_file_id: str,
    user_id: int = Depends(get_current_user_id)
):
    try:
        comparison = csv_cleaner.compute_comparison(original_file_id, cleaned_file_id)
        explanation = ai_client.explain_cleaning_transformation(comparison)
        return {"comparison": comparison, "explanation": explanation}
    except ValueError:
        raise HTTPException(status_code=404, detail="One or both files not found")

@router.get("/download/{file_id}")
async def download_csv(file_id: str, user_id: int = Depends(get_current_user_id)):
    try:
        df = csv_cleaner.get_dataframe(file_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")

    stream = io.BytesIO()
    df.to_csv(stream, index=False, encoding="utf-8-sig")
    stream.seek(0)

    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename=cleaned_{file_id}.csv"},
    )