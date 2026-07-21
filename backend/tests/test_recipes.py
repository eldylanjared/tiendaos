"""Recipe products (made-to-order): selling deducts component stock, not the parent's.
Voiding restores components. Component CRUD guards against self/duplicate/nested."""
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
from app.config import get_settings
from app.models.product import Product
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
    fake_admin = User(id="u1", username="test", hashed_password="x", pin_code="0000", full_name="Test", role="admin")
    for route in app.routes:
        if hasattr(route, "dependant"):
            for d in route.dependant.dependencies:
                if d.call and getattr(d.call, "__qualname__", "").startswith(("require_role", "get_current_user")):
                    app.dependency_overrides[d.call] = lambda: fake_admin

    # Sale uses settings.store_id + current_user.id; both FKs must exist
    db = TestSession()
    db.add(Store(id=get_settings().store_id, name="Test Store"))
    db.add(User(id="u1", username="test", hashed_password="x", pin_code="0000", full_name="Test", role="admin"))
    db.commit()
    db.close()

    with TestClient(app) as c:
        yield c, TestSession

    app.dependency_overrides.clear()
    os.unlink(path)


def _product(db, pid, name, price=10.0, stock=100):
    db.add(Product(id=pid, barcode=f"bc-{pid}", name=name, description="", price=price,
                   cost=0, stock=stock, min_stock=0, image_url="", is_active=True, sell_by_weight=False))
    db.commit()
    return pid


def test_recipe_sale_deducts_components_not_parent(client):
    c, TestSession = client
    db = TestSession()
    _product(db, "vaso", "Vaso", price=0, stock=50)
    _product(db, "topo", "Topo Chico", price=0, stock=40)
    _product(db, "cerveza", "Cerveza New Mix", price=0, stock=30)
    _product(db, "newmix", "Bebida New Mix", price=65, stock=0)  # made-to-order, own stock unused
    db.close()

    # Build recipe: 1 vaso + 1 topo + 2 cervezas
    assert c.post("/api/products/newmix/components", json={"component_id": "vaso", "quantity": 1}).status_code == 200
    assert c.post("/api/products/newmix/components", json={"component_id": "topo", "quantity": 1}).status_code == 200
    assert c.post("/api/products/newmix/components", json={"component_id": "cerveza", "quantity": 2}).status_code == 200

    # Sell 3 New Mix at fixed price 65
    r = c.post("/api/sales", json={"items": [{"product_id": "newmix", "quantity": 3}], "cash_received": 200})
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 195.0  # 3 * 65, price is fixed, not summed from components

    db = TestSession()
    assert db.query(Product).filter_by(id="vaso").first().stock == 47      # 50 - 3
    assert db.query(Product).filter_by(id="topo").first().stock == 37      # 40 - 3
    assert db.query(Product).filter_by(id="cerveza").first().stock == 24   # 30 - 6
    assert db.query(Product).filter_by(id="newmix").first().stock == 0     # untouched
    db.close()


def test_void_restores_components(client):
    c, TestSession = client
    db = TestSession()
    _product(db, "vaso", "Vaso", price=0, stock=10)
    _product(db, "newmix", "Bebida New Mix", price=65, stock=0)
    db.close()
    c.post("/api/products/newmix/components", json={"component_id": "vaso", "quantity": 1})

    r = c.post("/api/sales", json={"items": [{"product_id": "newmix", "quantity": 4}], "cash_received": 300})
    sale_id = r.json()["id"]
    db = TestSession()
    assert db.query(Product).filter_by(id="vaso").first().stock == 6  # 10 - 4
    db.close()

    assert c.post(f"/api/sales/{sale_id}/void").status_code == 200
    db = TestSession()
    assert db.query(Product).filter_by(id="vaso").first().stock == 10  # restored
    db.close()


def test_component_guards(client):
    c, TestSession = client
    db = TestSession()
    _product(db, "p1", "Recipe")
    _product(db, "p2", "Comp")
    _product(db, "p3", "Nested parent")
    db.close()

    # self-component rejected
    assert c.post("/api/products/p1/components", json={"component_id": "p1"}).status_code == 400
    # valid add
    assert c.post("/api/products/p1/components", json={"component_id": "p2"}).status_code == 200
    # duplicate rejected
    assert c.post("/api/products/p1/components", json={"component_id": "p2"}).status_code == 400
    # nested recipe rejected: p1 is now a recipe, can't be a component of p3
    assert c.post("/api/products/p3/components", json={"component_id": "p1"}).status_code == 400

    # components embedded in product response with component details
    body = c.get("/api/products/p1").json()
    assert len(body["components"]) == 1
    assert body["components"][0]["component_name"] == "Comp"
