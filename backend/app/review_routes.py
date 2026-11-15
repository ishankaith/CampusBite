from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import get_db
from . import models
from .auth import require_role

router = APIRouter(tags=["Reviews"])


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=1000)


def order_id_from_number(order_number: str) -> int:
    value = order_number.upper()
    if value.startswith("CB"):
        value = value[2:]
    if not value.isdigit():
        raise HTTPException(status_code=400, detail="Invalid order number")
    return int(value)


def serialize_review(review):
    created = review.created_at
    if created and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)

    # Use the fulfilment-to-order-item links so the review lists the dishes
    # actually associated with this restaurant's part of the order.
    ordered_items = []
    fulfilment = next(
        (f for f in review.order.fulfilments if f.restaurant_id == review.restaurant_id),
        None
    )
    if fulfilment:
        ordered_items = [
            {
                "item_name": link.order_item.item_name,
                "quantity": link.order_item.quantity,
            }
            for link in fulfilment.items
            if link.order_item is not None
        ]

    # Compatibility fallback for older orders without fulfilment item links.
    if not ordered_items:
        ordered_items = [
            {"item_name": item.item_name, "quantity": item.quantity}
            for item in review.order.items
        ]

    return {
        "id": review.id,
        "order_id": review.order_id,
        "customer_name": review.customer.name,
        "restaurant_id": review.restaurant_id,
        "rating": review.rating,
        "comment": review.comment,
        "ordered_items": ordered_items,
        "created_at": created.isoformat() if created else None,
    }


@router.post("/orders/{order_number}/review", status_code=status.HTTP_201_CREATED)
def create_order_review(
    order_number: str,
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("customer")),
):
    order_id = order_id_from_number(order_number)
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.customer_id == current_user.id
    ).first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    fulfilments = db.query(models.RestaurantFulfilment).filter(
        models.RestaurantFulfilment.order_id == order.id
    ).all()
    assignment = db.query(models.DeliveryAssignment).filter(
        models.DeliveryAssignment.order_id == order.id
    ).first()

    delivered = (assignment is not None and assignment.status == "Delivered") or (
        not assignment and bool(fulfilments) and all(f.status == "Delivered" for f in fulfilments)
    )
    if not delivered:
        raise HTTPException(status_code=400, detail="You can review an order only after it is delivered")
    if not fulfilments:
        raise HTTPException(status_code=400, detail="No restaurant is associated with this order")

    # CampusBite's current checkout flow creates one restaurant fulfilment per order.
    restaurant_id = fulfilments[0].restaurant_id
    existing = db.query(models.RestaurantReview).filter(
        models.RestaurantReview.order_id == order.id,
        models.RestaurantReview.restaurant_id == restaurant_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already reviewed this order")

    review = models.RestaurantReview(
        order_id=order.id,
        customer_id=current_user.id,
        restaurant_id=restaurant_id,
        rating=review_data.rating,
        comment=review_data.comment.strip()
    )
    db.add(review)
    db.flush()

    average = db.query(func.avg(models.RestaurantReview.rating)).filter(
        models.RestaurantReview.restaurant_id == restaurant_id
    ).scalar()
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id
    ).first()
    if restaurant:
        restaurant.rating = round(float(average or 0), 1)

    db.commit()
    db.refresh(review)
    return {"message": "Thank you for reviewing your order", "review": serialize_review(review)}


@router.get("/restaurants/{restaurant_id}/reviews")
def get_restaurant_reviews(
    restaurant_id: int,
    db: Session = Depends(get_db),
):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id,
        models.Restaurant.approval_status == "approved"
    ).first()
    if restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    reviews = db.query(models.RestaurantReview).filter(
        models.RestaurantReview.restaurant_id == restaurant_id
    ).order_by(models.RestaurantReview.created_at.desc(), models.RestaurantReview.id.desc()).all()
    return [serialize_review(review) for review in reviews]


@router.get("/owner/restaurants/{restaurant_id}/reviews")
def get_owner_restaurant_reviews(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("restaurant_owner")),
):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id,
        models.Restaurant.owner_id == current_user.id,
        models.Restaurant.approval_status == "approved"
    ).first()
    if restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    reviews = db.query(models.RestaurantReview).filter(
        models.RestaurantReview.restaurant_id == restaurant_id
    ).order_by(models.RestaurantReview.created_at.desc(), models.RestaurantReview.id.desc()).all()
    return [serialize_review(review) for review in reviews]
