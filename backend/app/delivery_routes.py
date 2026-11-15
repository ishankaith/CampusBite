
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_db
from . import models
from .auth import get_current_user, require_role


router = APIRouter(
    prefix="/delivery",
    tags=["Delivery Management"]
)


class DeliveryStatusUpdate(BaseModel):
    status: Literal[
        "Picked Up",
        "Out for Delivery",
        "Delivered"
    ]


def serialize_delivery_order(order):
    assignment = order.delivery_assignment

    return {
        "order_id": order.id,
        "order_number": f"CB{order.id:06d}",
        "customer_name": order.customer_name,
        "phone": order.phone,
        "address": order.address,
        "total_amount": order.total_amount,
        "restaurant_fulfilments": [
            {
                "restaurant_id": fulfilment.restaurant_id,
                "restaurant_name": fulfilment.restaurant.name,
                "status": fulfilment.status,
                "items": [
                    {
                        "item_name": link.order_item.item_name,
                        "quantity": link.order_item.quantity,
                    }
                    for link in fulfilment.items
                ],
            }
            for fulfilment in order.fulfilments
        ],
        "delivery_status": (
            assignment.status if assignment else "Unassigned"
        ),
        "delivery_partner_id": (
            assignment.delivery_partner_id if assignment else None
        ),
    }




# Restaurant owners can view delivery partners available for assignment.
@router.get("/available-partners")
def get_available_delivery_partners(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("restaurant_owner"))
):
    partners = (
        db.query(models.User)
        .filter(models.User.role == "delivery_partner")
        .order_by(models.User.name.asc())
        .all()
    )
    return [{"id": partner.id, "name": partner.name, "email": partner.email}
            for partner in partners]


# Restaurant-controlled assignment. The owner may assign only an order
# belonging to their approved restaurant and ready for pickup.
@router.post("/restaurants/{restaurant_id}/orders/{order_id}/assign/{delivery_partner_id}")
def restaurant_assign_delivery_partner(
    restaurant_id: int,
    order_id: int,
    delivery_partner_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("restaurant_owner"))
):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id
    ).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    if restaurant.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this restaurant")
    if restaurant.approval_status != "approved":
        raise HTTPException(status_code=403, detail="Restaurant must be approved")

    partner = db.query(models.User).filter(
        models.User.id == delivery_partner_id,
        models.User.role == "delivery_partner"
    ).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")

    order = db.query(models.Order).filter(
        models.Order.id == order_id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    fulfilment = db.query(models.RestaurantFulfilment).filter(
        models.RestaurantFulfilment.order_id == order_id,
        models.RestaurantFulfilment.restaurant_id == restaurant_id
    ).first()
    if not fulfilment:
        raise HTTPException(status_code=404, detail="Order does not belong to this restaurant")
    if fulfilment.status != "Ready for Pickup":
        raise HTTPException(status_code=400, detail="Order must be Ready for Pickup before assignment")
    if not order.fulfilments or any(
        part.status != "Ready for Pickup" for part in order.fulfilments
    ):
        raise HTTPException(
            status_code=400,
            detail="All restaurants on this order must be Ready for Pickup before assignment"
        )

    assignment = db.query(models.DeliveryAssignment).filter(
        models.DeliveryAssignment.order_id == order_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Delivery assignment record not found")

    updated_rows = db.query(models.DeliveryAssignment).filter(
        models.DeliveryAssignment.id == assignment.id,
        models.DeliveryAssignment.status == "Unassigned",
        models.DeliveryAssignment.delivery_partner_id.is_(None)
    ).update(
        {
            "delivery_partner_id": partner.id,
            "status": "Assigned",
            "assigned_at": datetime.now(timezone.utc)
        },
        synchronize_session=False
    )
    if updated_rows == 0:
        db.rollback()
        raise HTTPException(status_code=409, detail="This order has already been claimed or assigned")

    db.commit()
    return {
        "message": "Delivery partner assigned successfully",
        "order_id": order_id,
        "delivery_partner_id": partner.id,
        "delivery_partner_name": partner.name,
        "delivery_status": "Assigned"
    }


# View orders ready for delivery
# Delivery partners only
@router.get("/ready-orders")
def get_ready_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("delivery_partner")
    )
):
    orders = db.query(models.Order).all()
    ready_orders = []

    for order in orders:
        if not order.fulfilments:
            continue

        all_restaurants_ready = all(
            fulfilment.status == "Ready for Pickup"
            for fulfilment in order.fulfilments
        )

        assignment = order.delivery_assignment

        if (
            all_restaurants_ready
            and assignment
            and assignment.status == "Unassigned"
        ):
            ready_orders.append(
                serialize_delivery_order(order)
            )

    return ready_orders


# Assign an eligible order to the logged-in delivery partner
@router.post("/orders/{order_id}/assign/{delivery_partner_id}")
def assign_delivery_partner(
    order_id: int,
    delivery_partner_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("delivery_partner")
    )
):
    # A partner cannot assign an order to another person
    if delivery_partner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only assign orders to yourself"
        )

    order = db.query(models.Order).filter(
        models.Order.id == order_id
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    if not order.fulfilments:
        raise HTTPException(
            status_code=400,
            detail="Order has no restaurant fulfilments"
        )

    all_restaurants_ready = all(
        fulfilment.status == "Ready for Pickup"
        for fulfilment in order.fulfilments
    )

    if not all_restaurants_ready:
        raise HTTPException(
            status_code=400,
            detail="All restaurants must mark the order Ready for Pickup first"
        )

    assignment = order.delivery_assignment

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Delivery assignment record not found"
        )

    # Conditional update prevents two partners claiming the same order
    updated_rows = (
        db.query(models.DeliveryAssignment)
        .filter(
            models.DeliveryAssignment.id == assignment.id,
            models.DeliveryAssignment.status == "Unassigned",
            models.DeliveryAssignment.delivery_partner_id.is_(None)
        )
        .update(
            {
                "delivery_partner_id": current_user.id,
                "status": "Assigned",
                "assigned_at": datetime.now(timezone.utc)
            },
            synchronize_session=False
        )
    )

    if updated_rows == 0:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This order has already been assigned"
        )

    db.commit()
    db.refresh(assignment)

    return {
        "message": "Delivery order assigned successfully",
        "order_id": order.id,
        "order_number": f"CB{order.id:06d}",
        "delivery_partner_id": current_user.id,
        "delivery_partner_name": current_user.name,
        "delivery_status": assignment.status,
    }


# View orders assigned to the logged-in delivery partner
@router.get("/partners/{delivery_partner_id}/orders")
def get_partner_orders(
    delivery_partner_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("delivery_partner")
    )
):
    if delivery_partner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own assigned orders"
        )

    assignments = (
        db.query(models.DeliveryAssignment)
        .filter(
            models.DeliveryAssignment.delivery_partner_id
            == current_user.id
        )
        .all()
    )

    return [
        serialize_delivery_order(assignment.order)
        for assignment in assignments
    ]


# Update delivery status
# Only the assigned delivery partner can do this
@router.patch("/orders/{order_id}/status")
def update_delivery_status(
    order_id: int,
    update: DeliveryStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("delivery_partner")
    )
):
    assignment = (
        db.query(models.DeliveryAssignment)
        .filter(
            models.DeliveryAssignment.order_id == order_id
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Delivery assignment not found"
        )

    if assignment.delivery_partner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="This order is not assigned to you"
        )

    allowed_transitions = {
        "Assigned": ["Picked Up"],
        "Picked Up": ["Out for Delivery"],
        "Out for Delivery": ["Delivered"],
    }

    allowed_next_statuses = allowed_transitions.get(
        assignment.status,
        []
    )

    if update.status not in allowed_next_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot change delivery status from "
                f"{assignment.status} to {update.status}"
            )
        )

    old_status = assignment.status
    assignment.status = update.status

    if update.status == "Picked Up":
        assignment.picked_up_at = datetime.now(timezone.utc)

    if update.status == "Delivered":
        assignment.delivered_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(assignment)

    return {
        "message": "Delivery status updated successfully",
        "order_id": order_id,
        "delivery_partner_id": current_user.id,
        "old_status": old_status,
        "new_status": assignment.status,
    }
