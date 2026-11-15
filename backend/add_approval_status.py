
import sqlite3
from pathlib import Path

# This script must be run from the backend directory.
database_path = Path("campusbite.db")

if not database_path.exists():
    raise FileNotFoundError(
        f"Database not found: {database_path.resolve()}"
    )

connection = sqlite3.connect(database_path)

try:
    cursor = connection.cursor()

    # Check whether the column already exists.
    cursor.execute("PRAGMA table_info(restaurants)")
    columns = [column[1] for column in cursor.fetchall()]

    if "approval_status" not in columns:
        cursor.execute(
            "ALTER TABLE restaurants ADD COLUMN approval_status VARCHAR"
        )
        print("Added approval_status column.")
    else:
        print("approval_status column already exists.")

    # Existing restaurants should remain publicly available.
    cursor.execute("""
        UPDATE restaurants
        SET approval_status = 'approved'
        WHERE approval_status IS NULL
    """)

    connection.commit()

    # Verify the migration.
    cursor.execute("""
        SELECT id, name, approval_status
        FROM restaurants
    """)

    restaurants = cursor.fetchall()

    print("\nRestaurant approval status:")
    for restaurant in restaurants:
        print(restaurant)

    print("\nMigration completed successfully.")

except Exception:
    connection.rollback()
    raise

finally:
    connection.close()
