"""
ESC/POS receipt printer service for Rongta 80mm (and compatible) thermal printers.
Connects via USB file device (Linux: /dev/usb/lp0) or TCP network.
"""
from __future__ import annotations

import textwrap
from datetime import datetime
from typing import List

from app.config import get_settings

settings = get_settings()

# 80mm paper at 12cpi = 48 printable chars
COLS = 48


def _center(text: str) -> str:
    return text.center(COLS)


def _ljust_rjust(left: str, right: str, width: int = COLS) -> str:
    space = width - len(left) - len(right)
    if space < 1:
        space = 1
    return left + " " * space + right


def _divider(char: str = "-") -> str:
    return char * COLS


def build_receipt_text(
    store_name: str,
    items: List[dict],
    subtotal: float,
    tax: float,
    total: float,
    payment_method: str,
    cash_received: float,
    change_given: float,
    sale_id: str,
    created_at: str,
) -> str:
    """Build the plain-text receipt string (used for both ESC/POS and fallback)."""
    lines: List[str] = []

    # Header
    lines.append(_center(store_name.upper()))
    lines.append(_center("================================"))
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        date_str = dt.strftime("%d/%m/%Y  %H:%M")
    except Exception:
        date_str = created_at[:16]
    lines.append(_center(date_str))
    lines.append(_divider())

    # Items
    for item in items:
        name = item["product_name"]
        qty = item["quantity"]
        unit = item["unit_price"]
        total_line = item["line_total"]

        # First line: qty x name ... line_total
        qty_str = f"{qty}x"
        price_str = f"${total_line:.2f}"
        label = f"{qty_str} {name}"
        # Wrap long names
        max_label = COLS - len(price_str) - 1
        if len(label) <= max_label:
            lines.append(_ljust_rjust(label, price_str))
        else:
            # Wrap: first line truncated, price on same line
            lines.append(_ljust_rjust(label[:max_label], price_str))
            # Extra name chars on next line, indented
            rest = label[max_label:]
            for chunk in textwrap.wrap(rest, COLS - 3):
                lines.append("   " + chunk)

        # Unit price line if qty > 1
        if qty > 1:
            lines.append(f"   ${unit:.2f} c/u")

    lines.append(_divider())

    # Totals
    lines.append(_ljust_rjust("Subtotal", f"${subtotal:.2f}"))
    lines.append(_ljust_rjust("IVA (16%)", f"${tax:.2f}"))
    lines.append(_divider("="))
    lines.append(_ljust_rjust("TOTAL", f"${total:.2f}"))
    lines.append(_divider("="))

    # Payment
    method = payment_method.upper() if payment_method else "EFECTIVO"
    lines.append(_ljust_rjust(f"PAGO ({method})", f"${cash_received:.2f}"))
    if change_given > 0:
        lines.append(_ljust_rjust("CAMBIO", f"${change_given:.2f}"))

    lines.append(_divider())
    lines.append(_center("Gracias por su compra"))
    lines.append(_center(f"Ticket: {sale_id[:8].upper()}"))
    lines.append("")
    lines.append("")
    lines.append("")  # Feed before cut

    return "\n".join(lines)


def print_receipt(
    store_name: str,
    items: List[dict],
    subtotal: float,
    tax: float,
    total: float,
    payment_method: str,
    cash_received: float,
    change_given: float,
    sale_id: str,
    created_at: str,
) -> None:
    """Print a receipt to the configured thermal printer."""
    text = build_receipt_text(
        store_name, items, subtotal, tax, total,
        payment_method, cash_received, change_given,
        sale_id, created_at,
    )

    printer_port = settings.printer_port

    # Network printer: host:port
    if ":" in printer_port and not printer_port.startswith("/"):
        host, port_str = printer_port.rsplit(":", 1)
        _print_network(text, host, int(port_str))
    else:
        _print_usb(text, printer_port)


def _print_usb(text: str, port: str) -> None:
    """Send ESC/POS data to a USB file device (Linux /dev/usb/lp0)."""
    ESC = b"\x1b"
    GS = b"\x1d"

    init = ESC + b"@"                      # Initialize printer
    charset = ESC + b"t\x12"              # Code page: Windows-1252 (latin)
    align_center = ESC + b"a\x01"
    align_left = ESC + b"a\x00"
    bold_on = ESC + b"E\x01"
    bold_off = ESC + b"E\x00"
    double_height = ESC + b"!\x10"        # Double height for store name
    normal_size = ESC + b"!\x00"
    cut = GS + b"V\x41\x03"              # Full cut with 3mm feed

    with open(port, "wb") as p:
        p.write(init + charset)

        lines = text.split("\n")
        for i, line in enumerate(lines):
            # First line = store name: centered, double height, bold
            if i == 0:
                p.write(align_center + bold_on + double_height)
                p.write(line.encode("cp1252", errors="replace") + b"\n")
                p.write(normal_size + bold_off + align_left)
            elif line.startswith("TOTAL"):
                p.write(bold_on)
                p.write(line.encode("cp1252", errors="replace") + b"\n")
                p.write(bold_off)
            else:
                p.write(line.encode("cp1252", errors="replace") + b"\n")

        p.write(cut)


def _print_network(text: str, host: str, port: int) -> None:
    """Send ESC/POS data to a network printer via TCP socket."""
    import socket

    ESC = b"\x1b"
    GS = b"\x1d"
    init = ESC + b"@"
    charset = ESC + b"t\x12"
    cut = GS + b"V\x41\x03"

    data = init + charset
    data += text.encode("cp1252", errors="replace")
    data += cut

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(5)
        s.connect((host, port))
        s.sendall(data)
