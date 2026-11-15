
from app.database import SessionLocal, engine
from app.models import User

print("Database being used:")
print(engine.url.database)

db = SessionLocal()

try:
    user = db.query(User).filter(User.id == 4).first()

    if user:
        print("\nAdmin account found:")
        print("ID:", user.id)
        print("Name:", user.name)
        print("Email:", user.email)
        print("Role:", repr(user.role))
    else:
        print("\nUser ID 4 was not found.")

finally:
    db.close()
