from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import Config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "https://cafelytics-olive.vercel.app",
            "https://cafelytics-api.onrender.com"
        ]
    }
})

    from app import models

    from app.routes.auth      import auth_bp
    from app.routes.cafes     import cafes_bp
    from app.routes.sales     import sales_bp
    from app.routes.analytics import analytics_bp

    app.register_blueprint(auth_bp,      url_prefix="/api/auth")
    app.register_blueprint(cafes_bp,     url_prefix="/api/cafes")
    app.register_blueprint(sales_bp,     url_prefix="/api/sales")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")

    @app.route("/")
    def home():
        return jsonify({
            "message": "Cafe Backend API is running!",
            "status":  "OK",
            "version": "1.0"
        })

    return app
