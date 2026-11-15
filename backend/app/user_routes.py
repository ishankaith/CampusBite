
from fastapi import APIRouter, Depends

from .models import User
from .auth import get_current_user, require_role


router = APIRouter(
    prefix="/users",
    tags=["User Authentication"]
)


# Get details of the currently logged-in user
@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role
    }


# Customer-only test endpoint
@router.get("/customer-area")
def customer_area(
    current_user: User = Depends(require_role("customer"))
):
    return {
        "message": "Customer access granted",
        "user": current_user.name,
        "role": current_user.role
    }


# Restaurant-owner-only test endpoint
@router.get("/restaurant-owner-area")
def restaurant_owner_area(
    current_user: User = Depends(
        require_role("restaurant_owner")
    )
):
    return {
        "message": "Restaurant owner access granted",
        "user": current_user.name,
        "role": current_user.role
    }


# Delivery-partner-only test endpoint
@router.get("/delivery-partner-area")
def delivery_partner_area(
    current_user: User = Depends(
        require_role("delivery_partner")
    )
):
    return {
        "message": "Delivery partner access granted",
        "user": current_user.name,
        "role": current_user.role
    }
