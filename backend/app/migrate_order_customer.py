import sqlite3
from pathlib import Path

DATABASE_PATH = Path(__file__).resolve().parent.parent / "campusbite.db"


def migrate():
    if not DATABASE_PATH.exists():
        raise FileNotFoundError(
            f"Database not found: {DATABASE_PATH}"
        )

    connection = sqlite3.connect(DATABASE_PATH)

    try:
        cursor = connection.cursor()

        cursor.execute("PRAGMA table_info(orders)")
        columns = [column[1] for column in cursor.fetchall()]

        if "customer_id" not in columns:
            cursor.execute("""
                ALTER TABLE orders
                ADD COLUMN customer_id INTEGER
                REFERENCES users(id)
            """)
            print("Added customer_id column to orders.")
        else:
            print("customer_id column already exists. No change needed.")

        connection.commit()

        cursor.execute("SELECT COUNT(*) FROM orders")
        order_count = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(*)
            FROM orders
            WHERE customer_id IS NULL
        """)
        unlinked_count = cursor.fetchone()[0]

        print(f"Existing orders preserved: {order_count}")
        print(f"Orders not linked to an account: {unlinked_count}")

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


if __name__ == "__main__":
    migrate()