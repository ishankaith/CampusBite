
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.database import engine, Base
from app import models


def add_user_role_column():
    """Add the role column to an existing users table if necessary."""

    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        print("Users table does not exist yet. It will be created.")
        return

    columns = [
        column["name"]
        for column in inspector.get_columns("users")
    ]

    if "role" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN role VARCHAR NOT NULL DEFAULT 'customer'"
                )
            )
        print("Added role column to users table.")
    else:
        print("User role column already exists.")


def create_new_tables():
    """Create new tables without deleting existing tables or records."""

    Base.metadata.create_all(bind=engine)
    print("Database tables checked and created where necessary.")


def migrate_existing_orders():
    """Create restaurant fulfilments for existing orders."""

    db = Session(bind=engine)

    try:
        orders = (
            db.query(models.Order)
            .order_by(models.Order.id)
            .all()
        )

        migrated_count = 0
        skipped_items = 0

        for order in orders:

            # Skip an order that already has fulfilments.
            existing = (
                db.query(models.RestaurantFulfilment)
                .filter(
                    models.RestaurantFulfilment.order_id == order.id
                )
                .first()
            )

            if existing:
                continue

            restaurant_items = {}

            for item in order.items:

                if item.menu_item_id is None:
                    skipped_items += 1
                    continue

                menu_item = (
                    db.query(models.MenuItem)
                    .filter(
                        models.MenuItem.id == item.menu_item_id
                    )
                    .first()
                )

                if menu_item is None:
                    skipped_items += 1
                    continue

                restaurant_id = menu_item.restaurant_id

                restaurant_items.setdefault(
                    restaurant_id, []
                ).append(item)

            # Preserve the old order's restaurant status.
            legacy_status = order.status or "Placed"

            delivery_status = "Unassigned"

            if legacy_status == "Out for Delivery":
                delivery_status = "Out for Delivery"
            elif legacy_status == "Delivered":
                delivery_status = "Delivered"

            # Create one fulfilment for each restaurant.
            for restaurant_id, items in restaurant_items.items():

                fulfilment_status = legacy_status

                # Delivery statuses are not restaurant statuses.
                if legacy_status in [
                    "Out for Delivery",
                    "Delivered"
                ]:
                    fulfilment_status = "Ready for Pickup"

                fulfilment = models.RestaurantFulfilment(
                    order_id=order.id,
                    restaurant_id=restaurant_id,
                    status=fulfilment_status
                )

                db.add(fulfilment)
                db.flush()

                for order_item in items:
                    db.add(
                        models.FulfilmentItem(
                            fulfilment_id=fulfilment.id,
                            order_item_id=order_item.id
                        )
                    )

            # One delivery assignment for the complete order.
            db.add(
                models.DeliveryAssignment(
                    order_id=order.id,
                    delivery_partner_id=None,
                    status=delivery_status
                )
            )

            migrated_count += 1

        db.commit()

        print(f"Orders processed: {len(orders)}")
        print(f"Orders migrated: {migrated_count}")
        print(f"Items that could not be linked: {skipped_items}")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


def verify_migration():
    """Display a summary of the migrated database."""

    db = Session(bind=engine)

    try:
        print("\n--- MIGRATION VERIFICATION ---")
        print("Existing orders:", db.query(models.Order).count())
        print(
            "Restaurant fulfilments:",
            db.query(models.RestaurantFulfilment).count()
        )
        print(
            "Fulfilment items:",
            db.query(models.FulfilmentItem).count()
        )
        print(
            "Delivery assignments:",
            db.query(models.DeliveryAssignment).count()
        )
        print("Users:", db.query(models.User).count())

        print("\nMigration verification completed.")

    finally:
        db.close()


if __name__ == "__main__":
    print("Starting CampusBite database migration...\n")

    add_user_role_column()
    create_new_tables()
    migrate_existing_orders()
    verify_migration()

    print("\nDatabase migration finished.")
