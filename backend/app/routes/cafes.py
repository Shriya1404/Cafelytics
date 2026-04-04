from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Cafe, Product, Sale
from app import db

cafes_bp = Blueprint("cafes", __name__)


@cafes_bp.route("/", methods=["GET"])
@jwt_required()
def get_cafes():
    user_id = int(get_jwt_identity())
    cafes   = Cafe.query.filter_by(owner_id=user_id).all()
    return jsonify([c.to_dict() for c in cafes])


@cafes_bp.route("/", methods=["POST"])
@jwt_required()
def create_cafe():
    user_id = int(get_jwt_identity())
    data    = request.get_json()

    if not data or "name" not in data:
        return jsonify({"error": "Cafe name is required"}), 400

    cafe = Cafe(
        name     = data["name"],
        location = data.get("location", ""),
        owner_id = user_id
    )
    db.session.add(cafe)
    db.session.commit()

    return jsonify(cafe.to_dict()), 201


@cafes_bp.route("/<int:cafe_id>", methods=["PUT"])
@jwt_required()
def update_cafe(cafe_id):
    user_id = int(get_jwt_identity())
    cafe    = Cafe.query.filter_by(id=cafe_id, owner_id=user_id).first()

    if not cafe:
        return jsonify({"error": "Cafe not found"}), 404

    data          = request.get_json()
    cafe.name     = data.get("name", cafe.name)
    cafe.location = data.get("location", cafe.location)
    db.session.commit()

    return jsonify(cafe.to_dict())


@cafes_bp.route("/<int:cafe_id>", methods=["DELETE"])
@jwt_required()
def delete_cafe(cafe_id):
    user_id = int(get_jwt_identity())
    cafe    = Cafe.query.filter_by(id=cafe_id, owner_id=user_id).first()

    if not cafe:
        return jsonify({"error": "Cafe not found"}), 404

    try:
        Sale.query.filter_by(cafe_id=cafe.id).delete()
        Product.query.filter_by(cafe_id=cafe.id).delete()
        db.session.delete(cafe)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to delete cafe"}), 500

    return jsonify({"message": "Cafe deleted successfully"})
