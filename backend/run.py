from app import create_app

try:
    app = create_app()
except RuntimeError as error:
    raise SystemExit(str(error)) from error


if __name__ == "__main__":
    app.run(debug=app.config["DEBUG"], port=app.config["PORT"])
