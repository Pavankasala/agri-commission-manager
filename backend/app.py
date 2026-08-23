import os

from datetime import timedelta
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

import db
from routes import (
    advance_bp,
    auth_bp,
    balance_bp,
    bills_bp,
    cash_bp,
    expenditures_bp,
    reports_bp,
    sales_bp,
    shops_bp,
)


DEFAULT_ALLOWED_ORIGINS = (
    "https://agri-commission-manager.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)


def _allowed_origins() -> list[str]:
    configured = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
    if not configured:
        return list(DEFAULT_ALLOWED_ORIGINS)
    return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]


def create_app(test_config: dict | None = None) -> Flask:
    """Application factory used by production and isolated tests."""
    application = Flask(__name__)
    secret_key = os.environ.get("SECRET_KEY") or os.environ.get("JWT_SECRET_KEY")
    application.config.from_mapping(
        SECRET_KEY=secret_key,
        JWT_SECRET_KEY=secret_key or "development-only-change-this-before-production",
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(seconds=int(os.environ.get("TOKEN_MAX_AGE_SECONDS", "86400"))),
        TOKEN_MAX_AGE_SECONDS=int(os.environ.get("TOKEN_MAX_AGE_SECONDS", "86400")),
        GOOGLE_CLIENT_ID=os.environ.get("GOOGLE_CLIENT_ID", "").strip(),
        APP_ENV=os.environ.get("APP_ENV", "development").lower(),
    )
    if test_config:
        application.config.update(test_config)

    if not application.config.get("SECRET_KEY"):
        if application.config["APP_ENV"] == "production":
            raise RuntimeError("SECRET_KEY must be configured in production")
        application.config["SECRET_KEY"] = "development-only-change-this-before-production"
        application.config["JWT_SECRET_KEY"] = "development-only-change-this-before-production"
        application.logger.warning("Using a development-only SECRET_KEY; configure SECRET_KEY before production use")

    # Initialize Flask-JWT-Extended
    JWTManager(application)

    # Token authentication uses Authorization headers, not cookies.
    CORS(
        application,
        resources={r"/*": {"origins": _allowed_origins()}},
        supports_credentials=False,
    )

    db.init_db()


    application.register_blueprint(auth_bp)
    application.register_blueprint(bills_bp)
    application.register_blueprint(expenditures_bp)
    application.register_blueprint(cash_bp)
    application.register_blueprint(advance_bp)
    application.register_blueprint(balance_bp)
    application.register_blueprint(shops_bp)
    application.register_blueprint(sales_bp)
    application.register_blueprint(reports_bp)

    @application.route("/api/health", methods=["GET"])
    @application.route("/health", methods=["GET"])
    def health_check():
        try:
            conn = db.get_db()
            conn.close()
            return jsonify({"status": "healthy", "success": True}), 200
        except Exception:
            return jsonify({"status": "unhealthy", "success": False}), 503

    return application


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
