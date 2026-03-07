"""
Receipt OCR and parsing using Tesseract.

Flow:
1. Image preprocessing (enhance contrast, grayscale)
2. Tesseract OCR → raw text
3. Regex patterns extract: total amount, date, vendor
4. Keyword matching → suggest category
5. VendorMapping DB lookup → learned categories override defaults
"""
import re
from datetime import datetime
from io import BytesIO

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

from sqlalchemy.orm import Session
from app.models.finance import VendorMapping


def preprocess_image(image_bytes: bytes) -> Image.Image:
    """Enhance receipt image for better OCR accuracy."""
    img = Image.open(BytesIO(image_bytes))

    # Convert to grayscale
    img = img.convert("L")

    # Auto-rotate if needed (EXIF)
    try:
        from PIL import ExifTags
        exif = img.getexif()
        for tag, value in exif.items():
            if ExifTags.TAGS.get(tag) == "Orientation":
                if value == 3:
                    img = img.rotate(180, expand=True)
                elif value == 6:
                    img = img.rotate(270, expand=True)
                elif value == 8:
                    img = img.rotate(90, expand=True)
    except Exception:
        pass

    # Resize if too small (< 1000px wide)
    if img.width < 1000:
        ratio = 1000 / img.width
        img = img.resize((1000, int(img.height * ratio)), Image.LANCZOS)

    # Enhance contrast
    img = ImageEnhance.Contrast(img).enhance(1.8)

    # Sharpen
    img = img.filter(ImageFilter.SHARPEN)

    return img


def ocr_image(image_bytes: bytes) -> str:
    """Run Tesseract OCR on receipt image."""
    img = preprocess_image(image_bytes)
    text = pytesseract.image_to_string(img, lang="spa+eng", config="--psm 6")
    return text


def extract_total(text: str) -> float | None:
    """Extract the total amount from receipt text."""
    lines = text.upper().split("\n")

    # Patterns for total amount (Mexican receipts)
    # Look for TOTAL line first (most reliable)
    total_patterns = [
        r"TOTAL\s*\$?\s*([\d,]+\.?\d*)",
        r"TOTAL\s*A\s*PAGAR\s*\$?\s*([\d,]+\.?\d*)",
        r"TOTAL\s*MXN\s*\$?\s*([\d,]+\.?\d*)",
        r"TOTAL\s*:?\s*\$?\s*([\d,]+\.?\d*)",
        r"IMPORTE\s*TOTAL\s*\$?\s*([\d,]+\.?\d*)",
        r"GRAN\s*TOTAL\s*\$?\s*([\d,]+\.?\d*)",
        r"MONTO\s*TOTAL\s*\$?\s*([\d,]+\.?\d*)",
    ]

    for pattern in total_patterns:
        for line in lines:
            match = re.search(pattern, line)
            if match:
                amount_str = match.group(1).replace(",", "")
                try:
                    amount = float(amount_str)
                    if amount > 0:
                        return amount
                except ValueError:
                    continue

    # Fallback: look for the largest dollar amount in the text
    all_amounts = re.findall(r"\$\s*([\d,]+\.\d{2})", text)
    if all_amounts:
        amounts = []
        for a in all_amounts:
            try:
                amounts.append(float(a.replace(",", "")))
            except ValueError:
                continue
        if amounts:
            return max(amounts)

    return None


def extract_date(text: str) -> str:
    """Extract date from receipt text. Returns YYYY-MM-DD or empty."""
    # Common Mexican receipt date formats
    date_patterns = [
        # DD/MM/YYYY or DD-MM-YYYY
        (r"(\d{1,2})[/\-](\d{1,2})[/\-](20\d{2})", lambda m: f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"),
        # YYYY-MM-DD
        (r"(20\d{2})[/\-](\d{1,2})[/\-](\d{1,2})", lambda m: f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"),
        # DD MMM YYYY (Spanish months)
        (r"(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\w*\s+(20\d{2})",
         lambda m: _parse_spanish_date(m)),
    ]

    text_upper = text.upper()
    for pattern, formatter in date_patterns:
        match = re.search(pattern, text_upper)
        if match:
            try:
                result = formatter(match)
                if result:
                    # Validate it's a real date
                    datetime.strptime(result, "%Y-%m-%d")
                    return result
            except (ValueError, IndexError):
                continue

    return ""


MONTH_MAP = {
    "ENE": "01", "FEB": "02", "MAR": "03", "ABR": "04",
    "MAY": "05", "JUN": "06", "JUL": "07", "AGO": "08",
    "SEP": "09", "OCT": "10", "NOV": "11", "DIC": "12",
}


def _parse_spanish_date(match) -> str:
    day = match.group(1).zfill(2)
    month = MONTH_MAP.get(match.group(2)[:3], "")
    year = match.group(3)
    if month:
        return f"{year}-{month}-{day}"
    return ""


def extract_vendor(text: str) -> str:
    """Extract vendor/store name from receipt — usually in the first few lines."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # Skip very short lines and lines that are just numbers/symbols
    for line in lines[:8]:
        # Clean up
        clean = re.sub(r"[^A-Za-záéíóúñÁÉÍÓÚÑ\s&\.\-]", "", line).strip()
        if len(clean) >= 3 and not clean.replace(" ", "").isdigit():
            return clean[:100]

    return ""


# Keyword rules for category matching
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "proveedores": [
        "coca cola", "coca-cola", "pepsi", "bimbo", "lala", "gamesa",
        "sabritas", "marinela", "barcel", "alpura", "jumex", "distribuidor",
        "abarrotes", "mayoreo", "proveedora", "bodega", "proveedor",
    ],
    "renta": ["renta", "arrendamiento", "inmobiliaria", "alquiler"],
    "servicios": [
        "cfe", "comision federal", "telmex", "telcel", "att", "izzi",
        "totalplay", "megacable", "agua y drenaje", "naturgy", "gas natural",
        "electricidad", "internet", "telefono", "telefonia",
    ],
    "nomina": ["nomina", "sueldo", "salario", "pago empleado"],
    "transporte": [
        "gasolinera", "pemex", "bp", "shell", "oxxo gas", "gasolina",
        "diesel", "caseta", "peaje", "estacionamiento", "uber", "didi",
    ],
    "mantenimiento": [
        "ferreteria", "home depot", "plomero", "electricista",
        "mantenimiento", "reparacion", "refaccion", "pinturas",
    ],
    "impuestos": ["sat", "impuesto", "iva", "isr", "contribucion", "hacienda"],
    "publicidad": ["publicidad", "facebook", "google", "imprenta", "volantes", "lona"],
    "varios": [],
}


def guess_category(text: str, vendor: str, db: Session | None = None) -> tuple[str, str]:
    """
    Guess category from OCR text + vendor name.
    Returns (category, entry_type).
    First checks learned vendor mappings, then falls back to keywords.
    """
    vendor_lower = vendor.lower().strip()

    # Check learned mappings first
    if db and vendor_lower:
        mapping = (
            db.query(VendorMapping)
            .filter(VendorMapping.vendor_name == vendor_lower)
            .first()
        )
        if mapping:
            return mapping.category, mapping.entry_type

    # Keyword matching
    combined = (text + " " + vendor).lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in combined:
                return cat, "expense"

    return "varios", "expense"


def learn_vendor(db: Session, vendor: str, category: str, entry_type: str):
    """Save or update a vendor→category mapping for future use."""
    vendor_lower = vendor.lower().strip()
    if not vendor_lower or len(vendor_lower) < 3:
        return

    existing = db.query(VendorMapping).filter(VendorMapping.vendor_name == vendor_lower).first()
    if existing:
        existing.category = category
        existing.entry_type = entry_type
        existing.times_seen += 1
        existing.updated_at = datetime.utcnow()
    else:
        mapping = VendorMapping(
            vendor_name=vendor_lower,
            category=category,
            entry_type=entry_type,
        )
        db.add(mapping)
    db.commit()


def parse_receipt(image_bytes: bytes, db: Session | None = None) -> dict:
    """Full pipeline: OCR → parse → categorize."""
    raw_text = ocr_image(image_bytes)

    total = extract_total(raw_text)
    date = extract_date(raw_text)
    vendor = extract_vendor(raw_text)
    category, entry_type = guess_category(raw_text, vendor, db)

    return {
        "entry_type": entry_type,
        "amount": round(total, 2) if total else 0,
        "category": category,
        "description": vendor[:60] if vendor else "",
        "date": date,
        "raw_text": raw_text[:500],  # Send first 500 chars for debugging
        "confidence": "high" if total and date and vendor else "medium" if total else "low",
    }
