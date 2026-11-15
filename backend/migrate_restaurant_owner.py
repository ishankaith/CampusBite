
from sqlalchemy import inspect, text

from app.database import engine

inspector = inspect(engine)

columns = [
    column["name"]
    for column in inspector.get_columns("restaurants")
]

if "owner_id" not in columns:
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE restaurants "
                "ADD COLUMN owner_id INTEGER REFERENCES users(id)"
            )
        )
    print("Successfully added owner_id to restaurants.")
else:
    print("owner_id already exists. No migration needed.")

print("Migration completed.")
