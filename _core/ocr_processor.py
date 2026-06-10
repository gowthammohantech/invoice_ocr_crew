import sys
from pathlib import Path

import config
# pyrefly: ignore [missing-import]
from PIL import Image, ImageDraw

try:
    # pyrefly: ignore [missing-import]
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    print("Warning: 'pillow-heif' is not installed. HEIC image OCR will not be supported.")

try:
    # pyrefly: ignore [missing-import]
    from pdf2image import convert_from_path
except ImportError:
    print("Error: 'pdf2image' is required. Install it using: pip install pdf2image")
    sys.exit(1)

# --- Engine-specific imports ---

if config.OCR_ENGINE == "paddleocr":
    try:
        # pyrefly: ignore [missing-import]
        import numpy as np
        # pyrefly: ignore [missing-import]
        from paddleocr import PaddleOCR
        _paddle = PaddleOCR(
            lang="en",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
    except ImportError:
        print("Error: 'paddleocr' is required for OCR_ENGINE=paddleocr.")
        print("Install it using: pip install paddleocr paddlepaddle")
        sys.exit(1)
else:
    try:
        # pyrefly: ignore [missing-import]
        import pytesseract
    except ImportError:
        print("Error: 'pytesseract' is required. Install it using: pip install pytesseract")
        sys.exit(1)


# --- Per-engine helpers ---

def _tesseract_from_image(img: Image.Image) -> str:
    return pytesseract.image_to_string(img, lang=config.OCR_LANG).strip()


_MAX_SIDE = 1600

_BOX_COLORS = [
    "#E63946", "#2A9D8F", "#E9C46A", "#F4A261", "#457B9D",
    "#8338EC", "#FB5607", "#06D6A0", "#118AB2", "#FFD166",
]


def _paddle_from_image(img: Image.Image) -> tuple[str, list, Image.Image]:
    img = img.convert("RGB")
    w, h = img.size
    if max(w, h) > _MAX_SIDE:
        scale = _MAX_SIDE / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    arr = np.array(img)
    result = _paddle.predict(arr)
    lines, boxes = [], []
    for page in (result or []):
        for text in (page.get("rec_texts") or []):
            lines.append(text)
        for box in (page.get("rec_polys") or []):
            boxes.append(box)
    return "\n".join(lines).strip(), boxes, img


def _draw_ocr_boxes(img: Image.Image, boxes: list) -> Image.Image:
    annotated = img.convert("RGBA")
    overlay = Image.new("RGBA", annotated.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for idx, box in enumerate(boxes):
        color_hex = _BOX_COLORS[idx % len(_BOX_COLORS)]
        r, g, b = int(color_hex[1:3], 16), int(color_hex[3:5], 16), int(color_hex[5:7], 16)
        pts = [(float(pt[0]), float(pt[1])) for pt in box]
        draw.polygon(pts, fill=(r, g, b, 60), outline=(r, g, b, 220))
    return Image.alpha_composite(annotated, overlay).convert("RGB")


def _save_reference_image(source_path: Path, page_num: int, annotated: Image.Image) -> None:
    stem = source_path.stem
    out_path = config.REFERENCE_DIR / f"{stem}_page{page_num}_ref.png"
    annotated.save(out_path)
    print(f"Reference image saved: {out_path.name}")


def _ocr_image_obj(img: Image.Image) -> tuple[str, list, Image.Image]:
    if config.OCR_ENGINE == "paddleocr":
        return _paddle_from_image(img)
    return _tesseract_from_image(img), [], img


# --- Public API ---

def ocr_pdf(pdf_path: Path) -> str:
    print(f"Converting PDF '{pdf_path.name}' to images...")
    try:
        pages = convert_from_path(str(pdf_path), dpi=200, thread_count=1)
    except Exception as e:
        raise RuntimeError(
            f"Failed to convert PDF '{pdf_path.name}' to images. "
            f"Is 'poppler' installed? (brew install poppler)\nError: {e}"
        )

    engine_label = config.OCR_ENGINE.capitalize()
    print(f"Running {engine_label} OCR on {len(pages)} PDF pages...")
    blocks = []
    for i, page in enumerate(pages):
        try:
            text, boxes, canvas = _ocr_image_obj(page)
            blocks.append(f"--- PAGE {i + 1} ---\n{text}\n")
            if boxes:
                annotated = _draw_ocr_boxes(canvas, boxes)
                _save_reference_image(pdf_path, i + 1, annotated)
        except Exception as e:
            raise RuntimeError(
                f"OCR failed on page {i + 1} of '{pdf_path.name}'.\nError: {e}"
            )

    return "\n".join(blocks)


def ocr_image(image_path: Path) -> str:
    print(f"Opening image '{image_path.name}'...")
    try:
        with Image.open(image_path) as img:
            img_copy = img.copy()
            engine_label = config.OCR_ENGINE.capitalize()
            print(f"Running {engine_label} OCR on '{image_path.name}'...")
            text, boxes, canvas = _ocr_image_obj(img_copy)
            if boxes:
                annotated = _draw_ocr_boxes(canvas, boxes)
                _save_reference_image(image_path, 1, annotated)
            return text
    except Exception as e:
        raise RuntimeError(
            f"OCR failed on '{image_path.name}'.\nError: {e}"
        )


def extract_raw_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        return ocr_pdf(file_path)
    elif suffix in {".heic", ".heif", ".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"}:
        return ocr_image(file_path)
    else:
        raise ValueError(f"Unsupported file format '{suffix}' for OCR.")
