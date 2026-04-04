from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Sale, Cafe
from app.utils.csv_processor import process_sales_csv
from app import db

sales_bp = Blueprint("sales", __name__)


@sales_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_csv():
    user_id = int(get_jwt_identity())

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Only .csv files are accepted"}), 400

    cafe_id = request.form.get("cafe_id")
    if not cafe_id:
        return jsonify({"error": "cafe_id is required"}), 400

    cafe = Cafe.query.filter_by(
        id=int(cafe_id),
        owner_id=user_id
    ).first()

    if not cafe:
        return jsonify({"error": "Cafe not found"}), 404

    result, status_code = process_sales_csv(file, int(cafe_id))
    return jsonify(result), status_code


@sales_bp.route("/<int:cafe_id>", methods=["GET"])
@jwt_required()
def get_sales(cafe_id):
    user_id = int(get_jwt_identity())
    cafe = Cafe.query.filter_by(id=cafe_id, owner_id=user_id).first()
    if not cafe:
        return jsonify({"error": "Cafe not found"}), 404

    page     = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    sales = Sale.query.filter_by(
        cafe_id=cafe_id
    ).order_by(
        Sale.sale_date.desc()
    ).paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )

    return jsonify({
        "sales":        [s.to_dict() for s in sales.items],
        "total":        sales.total,
        "pages":        sales.pages,
        "current_page": page,
        "per_page":     per_page
    })
