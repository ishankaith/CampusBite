
from pydantic import BaseModel, ConfigDict
from typing import Optional


class RestaurantCreate(BaseModel):
    name: str
    cuisine: Optional[str] = None
    rating: float = 0
    delivery_time: Optional[str] = None
    price_for_one: Optional[int] = None
    image: Optional[str] = None


class RestaurantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    cuisine: Optional[str] = None
    rating: float = 0
    delivery_time: Optional[str] = None
    price_for_one: Optional[int] = None
    image: Optional[str] = None
    approval_status: str = "pending"


class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    restaurant_id: int


class MenuItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    price: float
    restaurant_id: int


class RestaurantDetailResponse(RestaurantResponse):
    menu_items: list[MenuItemResponse] = []
