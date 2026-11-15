from .database import SessionLocal
from .models import Restaurant

db = SessionLocal()

restaurants = [
    {
        "name": "Indian Kitchen",
        "cuisine": "North Indian",
        "rating": 4.6,
        "delivery_time": "25–35 min",
        "price_for_one": 150,
        "image": "🍛"
    },
    {
        "name": "Campus Pizza",
        "cuisine": "Pizza & Italian",
        "rating": 4.4,
        "delivery_time": "20–30 min",
        "price_for_one": 200,
        "image": "🍕"
    },
    {
        "name": "Burger Point",
        "cuisine": "Burgers & Fast Food",
        "rating": 4.3,
        "delivery_time": "15–25 min",
        "price_for_one": 120,
        "image": "🍔"
    },
    {
        "name": "Green Bowl",
        "cuisine": "Healthy Food",
        "rating": 4.5,
        "delivery_time": "20–30 min",
        "price_for_one": 180,
        "image": "🥗"
    }
]

try:
    for restaurant_data in restaurants:
        existing = db.query(Restaurant).filter(
            Restaurant.name == restaurant_data["name"]
        ).first()

        if not existing:
            db.add(Restaurant(**restaurant_data))

    db.commit()
    print("Restaurants added successfully!")

finally:
    db.close()