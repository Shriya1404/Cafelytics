from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


# ─────────────────────────────────────────
# TABLE 1 — Users
# ─────────────────────────────────────────
class User(db.Model):
    __tablename__ = "users"

    id         = db.Column(db.Integer, primary_key=True)
    username   = db.Column(db.String(80), unique=True, nullable=False)
    email      = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # One user can own many cafes
    cafes = db.relationship("Cafe", backref="owner", lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id":         self.id,
            "username":   self.username,
            "email":      self.email,
            "created_at": self.created_at.isoformat()
        }


# ─────────────────────────────────────────
# TABLE 2 — Cafes
# ─────────────────────────────────────────
class Cafe(db.Model):
    __tablename__ = "cafes"

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(120), nullable=False)
    location   = db.Column(db.String(200))
    owner_id   = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # One cafe can have many products and many sales
    products = db.relationship("Product", backref="cafe", lazy=True)
    sales    = db.relationship("Sale", backref="cafe", lazy=True)

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       self.name,
            "location":   self.location,
            "owner_id":   self.owner_id,
            "created_at": self.created_at.isoformat()
        }


# ─────────────────────────────────────────
# TABLE 3 — Products
# ─────────────────────────────────────────
class Product(db.Model):
    __tablename__ = "products"

    id       = db.Column(db.Integer, primary_key=True)
    name     = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(80))
    price    = db.Column(db.Float, nullable=False)
    cafe_id  = db.Column(db.Integer, db.ForeignKey("cafes.id"), nullable=False)

    # One product can appear in many sales
    sales = db.relationship("Sale", backref="product", lazy=True)

    def to_dict(self):
        return {
            "id":       self.id,
            "name":     self.name,
            "category": self.category,
            "price":    self.price,
            "cafe_id":  self.cafe_id
        }


# ─────────────────────────────────────────
# TABLE 4 — Sales
# ─────────────────────────────────────────
class Sale(db.Model):
    __tablename__ = "sales"

    id           = db.Column(db.Integer, primary_key=True)
    cafe_id      = db.Column(db.Integer, db.ForeignKey("cafes.id"), nullable=False)
    product_id   = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    quantity     = db.Column(db.Integer, nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    sale_date    = db.Column(db.Date, nullable=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":           self.id,
            "cafe_id":      self.cafe_id,
            "product_id":   self.product_id,
            "quantity":     self.quantity,
            "total_amount": self.total_amount,
            "sale_date":    self.sale_date.isoformat(),
            "created_at":   self.created_at.isoformat()
        }
