import pandas as pd
from app import db
from app.models import Sale, Product


def process_sales_csv(file, cafe_id):
    """
    Reads a CSV file using Pandas and saves data to PostgreSQL.

    Required CSV columns:
        product_name  — name of the product
        quantity      — how many units sold
        total_amount  — total money earned
        sale_date     — date in YYYY-MM-DD format

    Optional CSV columns:
        category      — e.g. Coffee, Food, Dessert
        price         — price per unit
    """

    try:
        # Read CSV into a Pandas DataFrame
        df = pd.read_csv(file)

        # Clean column names
        # Removes spaces and makes lowercase
        # Example: "Product Name" becomes "product_name"
        df.columns = (
            df.columns
            .str.strip()
            .str.lower()
            .str.replace(" ", "_")
        )

        # Check all required columns exist
        required_columns = [
            "product_name",
            "quantity",
            "total_amount",
            "sale_date"
        ]
        for col in required_columns:
            if col not in df.columns:
                return {
                    "error": f"Missing required column: '{col}'"
                }, 400

        # ── Clean the data ──

        # Drop rows where product_name is empty
        df = df.dropna(subset=["product_name"])

        # Convert quantity to integer
        df["quantity"] = pd.to_numeric(
            df["quantity"], errors="coerce"
        ).fillna(0).astype(int)

        # Convert total_amount to float
        df["total_amount"] = pd.to_numeric(
            df["total_amount"], errors="coerce"
        ).fillna(0.0)

        # Convert sale_date to datetime, drop invalid dates
        df["sale_date"] = pd.to_datetime(
            df["sale_date"], errors="coerce"
        )
        df = df.dropna(subset=["sale_date"])

        # Handle optional columns
        if "category" not in df.columns:
            df["category"] = "Uncategorized"
        else:
            df["category"] = df["category"].fillna("Uncategorized")

        if "price" not in df.columns:
            df["price"] = 0.0
        else:
            df["price"] = pd.to_numeric(
                df["price"], errors="coerce"
            ).fillna(0.0)

        # ── Insert rows into database ──
        inserted = 0
        skipped  = 0
        errors   = []

        for index, row in df.iterrows():
            try:
                with db.session.begin_nested():
                    product = Product.query.filter_by(
                        name=str(row["product_name"]).strip(),
                        cafe_id=cafe_id
                    ).first()

                    if not product:
                        product = Product(
                            name=str(row["product_name"]).strip(),
                            category=str(row["category"]).strip(),
                            price=float(row["price"]),
                            cafe_id=cafe_id
                        )
                        db.session.add(product)
                        db.session.flush()

                    sale = Sale(
                        cafe_id=cafe_id,
                        product_id=product.id,
                        quantity=int(row["quantity"]),
                        total_amount=float(row["total_amount"]),
                        sale_date=row["sale_date"].date()
                    )
                    db.session.add(sale)

                inserted += 1

            except Exception as row_error:
                errors.append(f"Row {index + 2}: {str(row_error)}")
                skipped += 1
                continue

        # Save everything to database
        db.session.commit()

        return {
            "message":  "CSV processed successfully",
            "inserted": inserted,
            "skipped":  skipped,
            "errors":   errors
        }, 200

    except Exception as e:
        db.session.rollback()
        return {
            "error": f"Failed to process CSV: {str(e)}"
        }, 500
