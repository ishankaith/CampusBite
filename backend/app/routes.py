
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user, require_role


router = APIRouter(
    prefix="/restaurants",
    tags=["Restaurants"]
)


# Helper: verify that the logged-in owner owns this restaurant
def get_owned_restaurant(
    restaurant_id: int,
    current_user: models.User,
    db: Session
):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id
    ).first()

    if restaurant is None:
        raise HTTPException(
            status_code=404,
            detail="Restaurant not found"
        )

    if restaurant.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not own this restaurant"
        )

    if restaurant.approval_status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Your restaurant must be approved before you can manage it"
        )

    return restaurant


# Get all approved restaurants (public)
@router.get("/", response_model=list[schemas.RestaurantResponse])
def get_restaurants(db: Session = Depends(get_db)):
    return db.query(models.Restaurant).filter(
        models.Restaurant.approval_status == "approved"
    ).all()


# Get the restaurants/applications belonging to the logged-in owner.
# This intentionally includes pending and rejected applications so the owner
# can see the review status.
@router.get(
    "/my",
    response_model=list[schemas.RestaurantResponse]
)
def get_my_restaurants(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("restaurant_owner")
    )
):
    return db.query(models.Restaurant).filter(
        models.Restaurant.owner_id == current_user.id
    ).order_by(models.Restaurant.id.desc()).all()


# Get an approved restaurant by ID (public)
@router.get(
    "/{restaurant_id}",
    response_model=schemas.RestaurantResponse
)
def get_restaurant(
    restaurant_id: int,
    db: Session = Depends(get_db)
):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id,
        models.Restaurant.approval_status == "approved"
    ).first()

    if restaurant is None:
        raise HTTPException(
            status_code=404,
            detail="Restaurant not found or not approved"
        )

    return restaurant


# Create a restaurant application (restaurant owner only)
@router.post(
    "/",
    response_model=schemas.RestaurantResponse,
    status_code=status.HTTP_201_CREATED
)
def create_restaurant(
    restaurant: schemas.RestaurantCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("restaurant_owner")
    )
):
    existing_application = db.query(models.Restaurant).filter(
        models.Restaurant.owner_id == current_user.id
    ).first()
    if existing_application is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a restaurant application. Check its status in your owner portal."
        )

    new_restaurant = models.Restaurant(
        **restaurant.model_dump(),
        owner_id=current_user.id,
        approval_status="pending"
    )

    db.add(new_restaurant)
    db.commit()
    db.refresh(new_restaurant)

    return new_restaurant


# Get menu items for an approved restaurant (public)
@router.get(
    "/{restaurant_id}/menu",
    response_model=list[schemas.MenuItemResponse]
)
def get_restaurant_menu(
    restaurant_id: int,
    db: Session = Depends(get_db)
):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id,
        models.Restaurant.approval_status == "approved"
    ).first()

    if restaurant is None:
        raise HTTPException(
            status_code=404,
            detail="Restaurant not found or not approved"
        )

    return restaurant.menu_items


# Add a menu item (owner of that restaurant only)
@router.post(
    "/{restaurant_id}/menu",
    response_model=schemas.MenuItemResponse
)
def create_menu_item(
    restaurant_id: int,
    item: schemas.MenuItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("restaurant_owner")
    )
):
    restaurant = get_owned_restaurant(
        restaurant_id,
        current_user,
        db
    )

    new_item = models.MenuItem(
        name=item.name,
        description=item.description,
        price=item.price,
        restaurant_id=restaurant.id
    )

    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return new_item


# Update restaurant details (owner only)
@router.put(
    "/{restaurant_id}",
    response_model=schemas.RestaurantResponse
)
def update_restaurant(
    restaurant_id: int,
    restaurant_data: schemas.RestaurantCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("restaurant_owner")
    )
):
    restaurant = get_owned_restaurant(
        restaurant_id,
        current_user,
        db
    )

    restaurant.name = restaurant_data.name
    restaurant.cuisine = restaurant_data.cuisine
    restaurant.rating = restaurant_data.rating
    restaurant.delivery_time = restaurant_data.delivery_time
    restaurant.price_for_one = restaurant_data.price_for_one
    restaurant.image = restaurant_data.image

    # The owner cannot change approval_status.
    db.commit()
    db.refresh(restaurant)

    return restaurant


# Restaurant deletion is disabled to protect order history
@router.delete("/{restaurant_id}")
def delete_restaurant(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("restaurant_owner")
    )
):
    get_owned_restaurant(
        restaurant_id,
        current_user,
        db
    )

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Restaurant deletion is disabled to preserve order history"
    )


# Update a menu item (owner of its restaurant only)
@router.put("/menu/{item_id}")
def update_menu_item(
    item_id: int,
    item: schemas.MenuItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("restaurant_owner")
    )
):
    menu_item = db.query(models.MenuItem).filter(
        models.MenuItem.id == item_id
    ).first()

    if menu_item is None:
        raise HTTPException(
            status_code=404,
            detail="Menu item not found"
        )

    restaurant = get_owned_restaurant(
        menu_item.restaurant_id,
        current_user,
        db
    )

    # Do not allow moving menu items to another restaurant
    if item.restaurant_id != restaurant.id:
        raise HTTPException(
            status_code=400,
            detail="Menu items cannot be moved to another restaurant"
        )

    menu_item.name = item.name
    menu_item.description = item.description
    menu_item.price = item.price

    db.commit()
    db.refresh(menu_item)

    return menu_item


# Delete a menu item (owner of its restaurant only)
@router.delete("/menu/{item_id}")
def delete_menu_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("restaurant_owner")
    )
):
    menu_item = db.query(models.MenuItem).filter(
        models.MenuItem.id == item_id
    ).first()

    if menu_item is None:
        raise HTTPException(
            status_code=404,
            detail="Menu item not found"
        )

    get_owned_restaurant(
        menu_item.restaurant_id,
        current_user,
        db
    )

    db.delete(menu_item)
    db.commit()

    return {
        "message": "Menu item deleted successfully"
    }
