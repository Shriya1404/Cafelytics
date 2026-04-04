from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity
)
from app.models import User
from app import db

auth_bp = Blueprint("auth", __name__)


# ────────────────────────────────────────────
# REGISTER
# POST /api/auth/register
# Body: { "username": "john", "email": "john@test.com", "password": "123456" }
# ────────────────────────────────────────────
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    # Check all fields are provided
    if not data:
        return jsonify({"error": "No data provided"}), 400

    required = ["username", "email", "password"]
    for field in required:
        if field not in data or not data[field]:
            return jsonify({"error": f"{field} is required"}), 400

    # Check password length
    if len(data["password"]) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    # Check if email already exists
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    # Check if username already exists
    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already taken"}), 409

    # Create the new user
    user = User(
        username = data["username"],
        email    = data["email"]
    )
    user.set_password(data["password"])

    db.session.add(user)
    db.session.commit()

    # Generate JWT token immediately after register
    token = create_access_token(identity=str(user.id))

    return jsonify({
        "message": "Account created successfully",
        "token":   token,
        "user":    user.to_dict()
    }), 201


# ────────────────────────────────────────────
# LOGIN
# POST /api/auth/login
# Body: { "email": "john@test.com", "password": "123456" }
# ────────────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    if not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password are required"}), 400

    # Find the user by email
    user = User.query.filter_by(email=data["email"]).first()

    # Check user exists and password is correct
    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid email or password"}), 401

    # Generate JWT token
    token = create_access_token(identity=str(user.id))

    return jsonify({
        "message": "Login successful",
        "token":   token,
        "user":    user.to_dict()
    })


# ────────────────────────────────────────────
# GET CURRENT USER
# GET /api/auth/me
# Header: Authorization: Bearer <token>
# ────────────────────────────────────────────
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user    = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user.to_dict())


# ────────────────────────────────────────────
# CHANGE PASSWORD
# PUT /api/auth/change-password
# Header: Authorization: Bearer <token>
# Body: { "old_password": "123456", "new_password": "newpass" }
# ────────────────────────────────────────────
@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    user_id = int(get_jwt_identity())
    user    = User.query.get(user_id)
    data    = request.get_json()

    if not data.get("old_password") or not data.get("new_password"):
        return jsonify({"error": "old_password and new_password are required"}), 400

    if not user.check_password(data["old_password"]):
        return jsonify({"error": "Current password is incorrect"}), 401

    if len(data["new_password"]) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    user.set_password(data["new_password"])
    db.session.commit()

    return jsonify({"message": "Password changed successfully"})