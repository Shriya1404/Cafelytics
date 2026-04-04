from datetime import date, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func

from app import db
from app.models import Sale, Product, Cafe

analytics_bp = Blueprint("analytics", __name__)


def get_range_start(range_key):
    if range_key == "7":
        return date.today() - timedelta(days=6)

    if range_key == "30":
        return date.today() - timedelta(days=29)

    if range_key == "month":
        today = date.today()
        return date(today.year, today.month, 1)

    return None


def apply_range_filter(query, range_key):
    start_date = get_range_start(range_key)
    if start_date:
        query = query.filter(Sale.sale_date >= start_date)
    return query


def get_owned_cafe_or_404(cafe_id):
    user_id = int(get_jwt_identity())
    cafe = Cafe.query.filter_by(id=cafe_id, owner_id=user_id).first()
    if not cafe:
        return None
    return cafe


@analytics_bp.route("/revenue/<int:cafe_id>", methods=["GET"])
@jwt_required()
def revenue(cafe_id):
    if not get_owned_cafe_or_404(cafe_id):
        return jsonify({"error": "Cafe not found"}), 404

    period = request.args.get("period", "daily")
    range_key = request.args.get("range")

    if period == "monthly":
        results_query = db.session.query(
            func.extract("year", Sale.sale_date).label("year"),
            func.extract("month", Sale.sale_date).label("month"),
            func.sum(Sale.total_amount).label("revenue"),
            func.sum(Sale.quantity).label("units_sold"),
            func.count(Sale.id).label("total_orders")
        ).filter(Sale.cafe_id == cafe_id)

        results_query = apply_range_filter(results_query, range_key)
        results = results_query.group_by(
            func.extract("year", Sale.sale_date),
            func.extract("month", Sale.sale_date)
        ).order_by(
            func.extract("year", Sale.sale_date),
            func.extract("month", Sale.sale_date)
        ).all()
    else:
        results_query = db.session.query(
            Sale.sale_date.label("period"),
            func.sum(Sale.total_amount).label("revenue"),
            func.sum(Sale.quantity).label("units_sold"),
            func.count(Sale.id).label("total_orders")
        ).filter(Sale.cafe_id == cafe_id)

        results_query = apply_range_filter(results_query, range_key)
        results = results_query.group_by(
            Sale.sale_date
        ).order_by(
            Sale.sale_date
        ).all()

    total_revenue_query = db.session.query(
        func.sum(Sale.total_amount)
    ).filter(Sale.cafe_id == cafe_id)
    total_revenue_query = apply_range_filter(total_revenue_query, range_key)
    total_revenue = total_revenue_query.scalar() or 0.0

    total_units_query = db.session.query(
        func.sum(Sale.quantity)
    ).filter(Sale.cafe_id == cafe_id)
    total_units_query = apply_range_filter(total_units_query, range_key)
    total_units = total_units_query.scalar() or 0

    total_orders_query = db.session.query(
        func.count(Sale.id)
    ).filter(Sale.cafe_id == cafe_id)
    total_orders_query = apply_range_filter(total_orders_query, range_key)
    total_orders = total_orders_query.scalar() or 0

    return jsonify({
        "cafe_id": cafe_id,
        "period_type": period,
        "range": range_key,
        "total_revenue": round(float(total_revenue), 2),
        "total_units": int(total_units),
        "total_orders": int(total_orders),
        "breakdown": [
            {
                "period": (
                    f"{int(row.year):04d}-{int(row.month):02d}"
                    if period == "monthly"
                    else str(row.period)
                ),
                "revenue": round(float(row.revenue), 2),
                "units_sold": int(row.units_sold),
                "total_orders": int(row.total_orders)
            }
            for row in results
        ]
    })


@analytics_bp.route("/products/<int:cafe_id>", methods=["GET"])
@jwt_required()
def product_analytics(cafe_id):
    if not get_owned_cafe_or_404(cafe_id):
        return jsonify({"error": "Cafe not found"}), 404

    range_key = request.args.get("range")

    query = db.session.query(
        Product.id,
        Product.name,
        Product.category,
        Product.price,
        func.sum(Sale.quantity).label("total_units"),
        func.sum(Sale.total_amount).label("total_revenue"),
        func.count(Sale.id).label("total_orders"),
        func.min(Sale.sale_date).label("first_sale"),
        func.max(Sale.sale_date).label("last_sale")
    ).join(
        Sale, Sale.product_id == Product.id
    ).filter(
        Sale.cafe_id == cafe_id
    )

    query = apply_range_filter(query, range_key)
    results = query.group_by(
        Product.id,
        Product.name,
        Product.category,
        Product.price
    ).order_by(
        func.sum(Sale.total_amount).desc()
    ).all()

    grand_total = sum(float(row.total_revenue) for row in results) or 1

    return jsonify({
        "cafe_id": cafe_id,
        "range": range_key,
        "total_products": len(results),
        "products": [
            {
                "product_id": row.id,
                "name": row.name,
                "category": row.category,
                "price": row.price,
                "total_units": int(row.total_units),
                "total_revenue": round(float(row.total_revenue), 2),
                "total_orders": int(row.total_orders),
                "revenue_share": round(
                    (float(row.total_revenue) / grand_total) * 100,
                    2
                ),
                "first_sale": str(row.first_sale),
                "last_sale": str(row.last_sale)
            }
            for row in results
        ]
    })


@analytics_bp.route("/categories/<int:cafe_id>", methods=["GET"])
@jwt_required()
def category_analytics(cafe_id):
    if not get_owned_cafe_or_404(cafe_id):
        return jsonify({"error": "Cafe not found"}), 404

    range_key = request.args.get("range")

    query = db.session.query(
        Product.category,
        func.sum(Sale.quantity).label("total_units"),
        func.sum(Sale.total_amount).label("total_revenue"),
        func.count(Sale.id).label("total_orders"),
        func.count(Product.id.distinct()).label("unique_products")
    ).join(
        Sale, Sale.product_id == Product.id
    ).filter(
        Sale.cafe_id == cafe_id
    )

    query = apply_range_filter(query, range_key)
    results = query.group_by(
        Product.category
    ).order_by(
        func.sum(Sale.total_amount).desc()
    ).all()

    grand_total = sum(float(row.total_revenue) for row in results) or 1

    return jsonify({
        "cafe_id": cafe_id,
        "range": range_key,
        "total_categories": len(results),
        "categories": [
            {
                "category": row.category or "Uncategorized",
                "total_units": int(row.total_units),
                "total_revenue": round(float(row.total_revenue), 2),
                "total_orders": int(row.total_orders),
                "unique_products": int(row.unique_products),
                "revenue_share": round(
                    (float(row.total_revenue) / grand_total) * 100,
                    2
                )
            }
            for row in results
        ]
    })


@analytics_bp.route("/summary/<int:cafe_id>", methods=["GET"])
@jwt_required()
def summary(cafe_id):
    if not get_owned_cafe_or_404(cafe_id):
        return jsonify({"error": "Cafe not found"}), 404

    range_key = request.args.get("range")

    total_revenue_query = db.session.query(
        func.sum(Sale.total_amount)
    ).filter(Sale.cafe_id == cafe_id)
    total_revenue_query = apply_range_filter(total_revenue_query, range_key)
    total_revenue = total_revenue_query.scalar() or 0.0

    total_orders_query = db.session.query(
        func.count(Sale.id)
    ).filter(Sale.cafe_id == cafe_id)
    total_orders_query = apply_range_filter(total_orders_query, range_key)
    total_orders = total_orders_query.scalar() or 0

    total_units_query = db.session.query(
        func.sum(Sale.quantity)
    ).filter(Sale.cafe_id == cafe_id)
    total_units_query = apply_range_filter(total_units_query, range_key)
    total_units = total_units_query.scalar() or 0

    best_product_query = db.session.query(
        Product.name,
        func.sum(Sale.total_amount).label("revenue")
    ).join(
        Sale, Sale.product_id == Product.id
    ).filter(
        Sale.cafe_id == cafe_id
    )
    best_product_query = apply_range_filter(best_product_query, range_key)
    best_product = best_product_query.group_by(
        Product.name
    ).order_by(
        func.sum(Sale.total_amount).desc()
    ).first()

    best_category_query = db.session.query(
        Product.category,
        func.sum(Sale.total_amount).label("revenue")
    ).join(
        Sale, Sale.product_id == Product.id
    ).filter(
        Sale.cafe_id == cafe_id
    )
    best_category_query = apply_range_filter(best_category_query, range_key)
    best_category = best_category_query.group_by(
        Product.category
    ).order_by(
        func.sum(Sale.total_amount).desc()
    ).first()

    avg_order_value = (
        float(total_revenue) / int(total_orders)
        if total_orders > 0 else 0.0
    )

    return jsonify({
        "cafe_id": cafe_id,
        "range": range_key,
        "total_revenue": round(float(total_revenue), 2),
        "total_orders": int(total_orders),
        "total_units_sold": int(total_units),
        "avg_order_value": round(avg_order_value, 2),
        "best_product": best_product.name if best_product else None,
        "best_category": best_category.category if best_category else None
    })
