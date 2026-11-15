from app.database import SessionLocal
from app.models import Restaurant, MenuItem

db = SessionLocal()

menu_data = {
    "Indian Kitchen": [
        {"name": "Paneer Butter Masala", "price": 180, "description": "Rich paneer curry"},
        {"name": "Dal Makhani", "price": 140, "description": "Creamy black lentils"},
        {"name": "Veg Biryani", "price": 160, "description": "Aromatic vegetable rice"}
    ],

    "Campus Pizza": [
        {"name": "Margherita", "price": 199, "description": "Classic cheese pizza"},
        {"name": "Farmhouse", "price": 249, "description": "Loaded vegetable pizza"},
        {"name": "Garlic Bread", "price": 99, "description": "Toasted garlic bread"}
    ],

    "Burger Point": [
        {"name": "Veg Burger", "price": 99, "description": "Classic vegetable burger"},
        {"name": "Cheese Burger", "price": 139, "description": "Burger with cheese"},
        {"name": "French Fries", "price": 89, "description": "Crispy golden fries"}
    ],

    "Green Bowl": [
        {"name": "Garden Salad", "price": 120, "description": "Fresh garden vegetables"},
        {"name": "Protein Bowl", "price": 190, "description": "Healthy protein bowl"},
        {"name": "Fruit Bowl", "price": 110, "description": "Fresh seasonal fruits"}
    ]
}

try:
    for restaurant_name, items in menu_data.items():

        restaurant = db.query(Restaurant).filter(
            Restaurant.name == restaurant_name
        ).first()

        if not restaurant:
            print(f"Restaurant not found: {restaurant_name}")
            continue

        for item in items:
            existing = db.query(MenuItem).filter(
                MenuItem.name == item["name"],
                MenuItem.restaurant_id == restaurant.id
            ).first()

            if not existing:
                new_item = MenuItem(
                    name=item["name"],
                    description=item["description"],
                    price=item["price"],
                    restaurant_id=restaurant.id
                )
                db.add(new_item)

    db.commit()

    print("Menu items added successfully!")
    print("Total menu items:", db.query(MenuItem).count())

except Exception as e:
    db.rollback()
    print("Error:", e)

finally:
    db.close()