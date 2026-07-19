"""Tests for product deletion: FK cascades (barcodes/promos) and sold-product deactivation."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.product import Product, ProductBarcode
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.models.store import Store


@pytest.fixture()
def client():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _fk_on(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    TestSession = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    # Bypass auth: require_role returns a dependency per call, so override each produced callable
    fake_admin = User(id="u1", username="test", hashed_password="x", pin_code="0000", full_name="Test", role="admin")

    for route in app.routes:
        if hasattr(route, "dependant"):
            for d in route.dependant.dependencies:
                if d.call and getattr(d.call, "__qualname__", "").startswith(("require_role", "get_current_user")):
                    app.dependency_overrides[d.call] = lambda: fake_admin

    with TestClient(app) as c:
        yield c, TestSession

    app.dependency_overrides.clear()
    os.unlink(path)


def _make_product(db, pid="p1", barcode="123", with_pack=False):
    p = Product(id=pid, barcode=barcode, name=f"Prod {pid}", description="", price=10.0,
                cost=5.0, stock=10, min_stock=1, image_url="", is_active=True, sell_by_weight=False)
    db.add(p)
    if with_pack:
        db.add(ProductBarcode(id=f"pb-{pid}", product_id=pid, barcode=f"pack-{barcode}", units=6, pack_price=50.0))
    db.commit()
    return pid


def _make_sale_for(db, pid):
    if not db.query(Store).filter_by(id="st1").first():
        db.add(Store(id="st1", name="Test Store"))
    if not db.query(User).filter_by(id="u1").first():
        db.add(User(id="u1", username="test", hashed_password="x", pin_code="0000", full_name="Test", role="admin"))
    db.flush()
    s = Sale(id="s1", store_id="st1", user_id="u1", subtotal=10, tax=0, total=10,
             payment_method="cash", cash_received=10, change_given=0, status="completed")
    db.add(s)
    db.flush()
    db.add(SaleItem(id="si1", sale_id="s1", product_id=pid, product_name="x",
                    quantity=1, unit_price=10, line_total=10))
    db.commit()


def test_delete_product_with_pack_barcodes(client):
    c, TestSession = client
    db = TestSession()
    _make_product(db, with_pack=True)
    db.close()

    r = c.delete("/api/products/p1")
    assert r.status_code == 200, r.text

    db = TestSession()
    assert db.query(Product).filter_by(id="p1").first() is None
    assert db.query(ProductBarcode).filter_by(product_id="p1").first() is None
    db.close()


def test_delete_sold_product_deactivates(client):
    c, TestSession = client
    db = TestSession()
    _make_product(db)
    _make_sale_for(db, "p1")
    db.close()

    r = c.delete("/api/products/p1")
    assert r.status_code == 409, r.text

    db = TestSession()
    p = db.query(Product).filter_by(id="p1").first()
    assert p is not None and p.is_active is False
    db.close()


def test_bulk_delete_mixed(client):
    c, TestSession = client
    db = TestSession()
    _make_product(db, pid="p1", barcode="111", with_pack=True)  # deletable
    _make_product(db, pid="p2", barcode="222")                   # sold -> deactivate
    _make_sale_for(db, "p2")
    db.close()

    r = c.post("/api/products/bulk-delete", json={"ids": ["p1", "p2"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["deleted"] == 1
    assert body["deactivated"] == 1

    db = TestSession()
    assert db.query(Product).filter_by(id="p1").first() is None
    p2 = db.query(Product).filter_by(id="p2").first()
    assert p2 is not None and p2.is_active is False
    db.close()


def test_ticket_alias_add_and_unique(client):
    c, TestSession = client
    db = TestSession()
    _make_product(db, pid="p1", barcode="111")
    _make_product(db, pid="p2", barcode="222")
    db.close()

    r = c.post("/api/products/p1/ticket-aliases", json={"alias": "CC600 REF PET"})
    assert r.status_code == 200, r.text
    alias_id = r.json()["id"]

    # same alias on another product is rejected (must be unambiguous for OCR)
    r = c.post("/api/products/p2/ticket-aliases", json={"alias": "cc600 ref pet"})
    assert r.status_code == 400

    # aliases come back embedded in the product response
    r = c.get("/api/products/p1")
    assert r.status_code == 200
    assert [a["alias"] for a in r.json()["ticket_aliases"]] == ["CC600 REF PET"]

    # delete, and cascade on product delete
    r = c.delete(f"/api/products/p1/ticket-aliases/{alias_id}")
    assert r.status_code == 200
    r = c.post("/api/products/p1/ticket-aliases", json={"alias": "OTRA"})
    assert r.status_code == 200
    r = c.delete("/api/products/p1")
    assert r.status_code == 200, r.text
