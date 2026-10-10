import os
import io
import json
import base64
import uuid
import zipfile
import logging
from PIL import Image
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

VISION_MODEL = "qwen/qwen3.8-27b"
VALID_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}

# Temporary storage for labeled image sessions: session_id -> { "images": { id: { filename, bytes, label, ... } } }
_session_store: dict[str, dict] = {}

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

def normalize_image(img_bytes: bytes) -> tuple[bytes, str, str]:
    """
    Opens image, resizes if needed (min 32x32, max 1024x1024), 
    and generates:
    1. Optimized JPEG bytes for Groq Vision API
    2. Base64 thumbnail data URI for UI display
    """
    with Image.open(io.BytesIO(img_bytes)) as img:
        img = img.convert("RGB")
        w, h = img.size

        # Ensure minimum 32x32
        if w < 32 or h < 32:
            new_w = max(w, 64)
            new_h = max(h, 64)
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            w, h = img.size

        # Downscale if excessively large to keep Groq latency ultra-fast
        if max(w, h) > 1024:
            img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

        # Output bytes for Vision API
        out_buf = io.BytesIO()
        img.save(out_buf, format="JPEG", quality=85)
        api_bytes = out_buf.getvalue()
        api_b64 = base64.b64encode(api_bytes).decode("utf-8")

        # Create compact thumbnail for frontend preview
        thumb_img = img.copy()
        thumb_img.thumbnail((320, 320), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb_img.save(thumb_buf, format="JPEG", quality=80)
        thumb_b64 = base64.b64encode(thumb_buf.getvalue()).decode("utf-8")
        preview_url = f"data:image/jpeg;base64,{thumb_b64}"

        return api_bytes, api_b64, preview_url

def label_single_image(
    image_bytes: bytes,
    filename: str,
    candidate_labels: list[str] = None
) -> dict:
    """Invokes Groq Vision model to classify/auto-label the given image."""
    try:
        api_bytes, api_b64, preview_url = normalize_image(image_bytes)
    except Exception as e:
        logger.error(f"Image normalization failed for {filename}: {e}")
        return {
            "id": str(uuid.uuid4()),
            "filename": filename,
            "label": "Invalid Image",
            "confidence": 0.0,
            "tags": ["corrupted_file"],
            "description": f"Failed to process image: {str(e)}",
            "preview_url": None,
            "status": "error"
        }

    client = get_groq_client()
    if client:
        if candidate_labels and len(candidate_labels) > 0:
            prompt = f"""You are an advanced AI computer vision model.
Examine this image and classify it into the best matching category from this list of candidate labels:
Candidate Labels: {json.dumps(candidate_labels)}

If none of the candidates match closely, select the most relevant label or provide an appropriate label.

Respond strictly with valid JSON in this exact structure:
{{
  "label": "selected_label_from_candidates",
  "confidence": 0.95,
  "tags": ["visual_tag1", "visual_tag2", "visual_tag3"],
  "description": "Short 1-sentence description of the primary visual content"
}}
"""
        else:
            prompt = """You are an advanced AI computer vision model.
Examine this image and auto-detect its primary category/class label.

Respond strictly with valid JSON in this exact structure:
{
  "label": "primary_class_label",
  "confidence": 0.92,
  "tags": ["visual_tag1", "visual_tag2", "visual_tag3"],
  "description": "Short 1-sentence description of the primary visual content"
}
"""

        try:
            response = client.chat.completions.create(
                model=VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{api_b64}"}}
                        ]
                    }
                ],
                max_tokens=250,
                temperature=0.2
            )
            raw_text = response.choices[0].message.content.strip()
            if "```" in raw_text:
                raw_text = raw_text.split("```")[1].replace("json", "").strip()

            data = json.loads(raw_text)
            return {
                "id": str(uuid.uuid4()),
                "filename": filename,
                "label": str(data.get("label", "Unlabeled")).strip(),
                "confidence": round(float(data.get("confidence", 0.85)), 2),
                "tags": data.get("tags", []),
                "description": data.get("description", ""),
                "preview_url": preview_url,
                "status": "success"
            }
        except Exception as e:
            logger.warning(f"Groq Vision labeling failed for {filename}: {e}")

    # Fallback heuristic labeler
    chosen_label = candidate_labels[0] if candidate_labels else "Object"
    return {
        "id": str(uuid.uuid4()),
        "filename": filename,
        "label": chosen_label,
        "confidence": 0.50,
        "tags": ["auto-detected"],
        "description": "Visual item recognized via fallback engine",
        "preview_url": preview_url,
        "status": "fallback"
    }

def process_image_batch(
    files_data: list[tuple[str, bytes]],
    candidate_labels: list[str] = None
) -> tuple[str, list[dict]]:
    """Processes a batch of images, stores them in session cache, and returns labeled records."""
    session_id = str(uuid.uuid4())
    labeled_records = []
    stored_images = {}

    for filename, raw_bytes in files_data:
        record = label_single_image(raw_bytes, filename, candidate_labels)
        labeled_records.append(record)
        stored_images[record["id"]] = {
            "filename": filename,
            "bytes": raw_bytes,
            "label": record["label"],
            "confidence": record["confidence"],
            "tags": record.get("tags", []),
            "description": record.get("description", "")
        }

    _session_store[session_id] = stored_images
    return session_id, labeled_records

def get_session_images(session_id: str) -> dict:
    return _session_store.get(session_id, {})

def create_dataset_zip(session_id: str, updated_records: list[dict] = None) -> bytes:
    """
    Creates a downloadable ZIP archive containing:
    - Subfolders named by label (e.g. /Cat/image1.jpg, /Dog/image2.jpg)
    - annotations.csv
    - annotations.json
    """
    stored = _session_store.get(session_id, {})
    
    # Update labels if user manually edited them in the UI
    if updated_records:
        for r in updated_records:
            rid = r.get("id")
            if rid in stored:
                stored[rid]["label"] = r.get("label", stored[rid]["label"])

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        csv_rows = ["id,filename,label,confidence,tags,description"]
        json_annotations = []

        for img_id, item in stored.items():
            safe_label = "".join(c for c in item["label"] if c.isalnum() or c in (" ", "_", "-")).strip() or "Unlabeled"
            folder_path = f"labeled_dataset/{safe_label}/{item['filename']}"
            zip_file.writestr(folder_path, item["bytes"])

            tags_str = ";".join(item.get("tags", []))
            desc_clean = item.get("description", "").replace('"', '""')
            csv_rows.append(f'"{img_id}","{item["filename"]}","{safe_label}",{item["confidence"]},"{tags_str}","{desc_clean}"')

            json_annotations.append({
                "id": img_id,
                "filename": item["filename"],
                "label": safe_label,
                "confidence": item["confidence"],
                "tags": item.get("tags", []),
                "description": item.get("description", "")
            })

        # Add CSV and JSON files
        zip_file.writestr("labeled_dataset/annotations.csv", "\n".join(csv_rows))
        zip_file.writestr("labeled_dataset/annotations.json", json.dumps(json_annotations, indent=2))

    zip_buffer.seek(0)
    return zip_buffer.getvalue()
