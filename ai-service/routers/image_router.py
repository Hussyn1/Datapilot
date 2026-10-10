from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io
import json
import zipfile
from pydantic import BaseModel
from auth import get_current_user_id
from services import image_labeler

router = APIRouter(prefix="/image", tags=["image"])

class ExportDatasetRequest(BaseModel):
    session_id: str
    export_format: str = "zip"  # "zip" | "csv" | "json"
    records: list[dict] = []

@router.post("/label-batch")
async def label_images_batch(
    files: list[UploadFile] = File(...),
    candidate_labels: str = Form(None),
    user_id: int = Depends(get_current_user_id)
):
    """
    Auto-labels a batch of uploaded images or a .zip file using Groq Vision AI (qwen/qwen3.8-27b).
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    labels_list = None
    if candidate_labels and candidate_labels.strip():
        labels_list = [l.strip() for l in candidate_labels.split(",") if l.strip()]

    extracted_files: list[tuple[str, bytes]] = []

    for f in files:
        contents = await f.read()
        filename_lower = f.filename.lower()

        # Handle zip file containing images
        if filename_lower.endswith(".zip"):
            try:
                with zipfile.ZipFile(io.BytesIO(contents)) as zf:
                    for zip_info in zf.infolist():
                        if zip_info.is_dir():
                            continue
                        name_lower = zip_info.filename.lower()
                        ext = "." + name_lower.split(".")[-1] if "." in name_lower else ""
                        if ext in image_labeler.VALID_IMAGE_EXTENSIONS:
                            file_data = zf.read(zip_info.filename)
                            # Keep simple basename
                            clean_name = zip_info.filename.split("/")[-1].split("\\")[-1]
                            extracted_files.append((clean_name, file_data))
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to read zip archive: {str(e)}")
        else:
            # Handle regular image files
            ext = "." + filename_lower.split(".")[-1] if "." in filename_lower else ""
            if ext in image_labeler.VALID_IMAGE_EXTENSIONS:
                extracted_files.append((f.filename, contents))

    if not extracted_files:
        raise HTTPException(
            status_code=400,
            detail="No supported image files found. Please upload .png, .jpg, .jpeg, .webp, or a .zip containing images."
        )

    # Process batch with Groq Vision
    session_id, records = image_labeler.process_image_batch(extracted_files, labels_list)

    # Compute statistics & class distribution
    class_distribution = {}
    total_conf = 0.0
    for r in records:
        lbl = r["label"]
        class_distribution[lbl] = class_distribution.get(lbl, 0) + 1
        total_conf += r.get("confidence", 0.0)

    avg_confidence = round(total_conf / len(records), 2) if records else 0.0

    return {
        "session_id": session_id,
        "total_images": len(records),
        "class_distribution": class_distribution,
        "average_confidence": avg_confidence,
        "candidate_labels_used": labels_list,
        "records": records,
    }

@router.post("/export-dataset")
async def export_labeled_dataset(
    request: ExportDatasetRequest,
    user_id: int = Depends(get_current_user_id)
):
    """
    Exports the labeled dataset in the requested format:
    - 'zip': Full dataset archive with images sorted into category subfolders + CSV/JSON annotations
    - 'csv': Metadata spreadsheet with filename, label, confidence, tags
    - 'json': Structured annotations array
    """
    stored = image_labeler.get_session_images(request.session_id)
    if not stored and not request.records:
        raise HTTPException(status_code=404, detail="Dataset session expired or not found")

    fmt = request.export_format.lower()

    if fmt == "zip":
        zip_bytes = image_labeler.create_dataset_zip(request.session_id, request.records)
        return StreamingResponse(
            io.BytesIO(zip_bytes),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=labeled_dataset_{request.session_id[:8]}.zip"}
        )

    elif fmt == "csv":
        csv_rows = ["id,filename,label,confidence,tags,description"]
        for r in request.records:
            tags_str = ";".join(r.get("tags", []))
            desc_clean = r.get("description", "").replace('"', '""')
            csv_rows.append(f'"{r.get("id")}","{r.get("filename")}","{r.get("label")}",{r.get("confidence")},"{tags_str}","{desc_clean}"')
        
        csv_text = "\n".join(csv_rows)
        return StreamingResponse(
            io.BytesIO(csv_text.encode("utf-8-sig")),
            media_type="text/csv; charset=utf-8-sig",
            headers={"Content-Disposition": f"attachment; filename=annotations_{request.session_id[:8]}.csv"}
        )

    elif fmt == "json":
        json_data = json.dumps(request.records, indent=2)
        return StreamingResponse(
            io.BytesIO(json_data.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=annotations_{request.session_id[:8]}.json"}
        )

    raise HTTPException(status_code=400, detail="Invalid export format. Must be 'zip', 'csv', or 'json'")
