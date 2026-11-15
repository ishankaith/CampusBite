
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from .database import get_db
from . import models
from .auth import require_role


router = APIRouter(prefix="/orders", tags=["Orders"])


# --------------------------------------------------
# PYDANTIC SCHEMAS
# --------------------------------------------------

class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    customer_name: str
    phone: str
    address: str
    items: list[OrderItemCreate]
    payment_method: Literal["cod", "online"] = "cod"


class OrderStatusUpdate(BaseModel):
    status: Literal[
        "Accepted",
        "Rejected",
        "Preparing",
        "Ready for Pickup"
    ]


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def generate_order_number(order_id: int):
    return f"CB{order_id:06d}"


def get_restaurant_fulfilment(db, order_id, restaurant_id):
    return (
        db.query(models.RestaurantFulfilment)
        .filter(
            models.RestaurantFulfilment.order_id == order_id,
            models.RestaurantFulfilment.restaurant_id == restaurant_id
        )
        .first()
    )


def serialize_order_items(items):
    return [
        {
            "menu_item_id": item.menu_item_id,
            "item_name": item.item_name,
            "price": item.price,
            "quantity": item.quantity
        }
        for item in items
    ]


def get_customer_facing_status(fulfilments, assignment):
    """
    Calculate the status customers should see.

    Delivery progress takes priority over restaurant progress.
    """

    if assignment:
        delivery_status = assignment.status
        if delivery_status == "Cancelled":
            return "Cancelled"

        if delivery_status in [
            "Delivered",
            "Out for Delivery",
            "Picked Up",
            "Assigned"
        ]:
            return delivery_status

    if not fulfilments:
        return "Placed"

    statuses = [f.status for f in fulfilments]

    if all(status == "Rejected" for status in statuses):
        return "Rejected"

    if any(status == "Preparing" for status in statuses):
        return "Preparing"

    if all(status == "Ready for Pickup" for status in statuses):
        return "Ready for Pickup"

    if any(status == "Rejected" for status in statuses):
        return "Partially Rejected"

    if any(status == "Accepted" for status in statuses):
        return "Accepted"

    return "Placed"


def serialize_created_at(created_at):
    """
    SQLite commonly returns naive UTC timestamps.
    Mark those timestamps as UTC.
    """

    if created_at is None:
        return None

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return created_at.isoformat()


def serialize_payment(payment):
    if payment is None:
        return None

    return {
        "transaction_reference": payment.transaction_reference,
        "payment_method": payment.payment_method,
        "payment_status": payment.payment_status,
        "amount": payment.amount,
        "created_at": serialize_created_at(payment.created_at)
    }


def serialize_cancellation(request):
    if request is None:
        return None
    return {
        "status": request.status,
        "reason": request.reason,
        "admin_note": request.admin_note,
        "created_at": serialize_created_at(request.created_at),
        "reviewed_at": serialize_created_at(request.reviewed_at)
    }


def serialize_return_request(request):
    if request is None:
        return None
    return {
        "id": request.id,
        "status": request.status,
        "reason": request.reason,
        "owner_note": request.owner_note,
        "created_at": serialize_created_at(request.created_at),
        "reviewed_at": serialize_created_at(request.reviewed_at)
    }


def order_can_be_cancelled(order, fulfilments, assignment):
    if order.status == "Cancelled" or order.status == "Rejected":
        return False
    if not fulfilments or any(f.status not in ["Placed", "Accepted"] for f in fulfilments):
        return False
    if assignment and assignment.status != "Unassigned":
        return False
    return True


def get_order_delivery_assignment(db, order_id):
    return (
        db.query(models.DeliveryAssignment)
        .filter(
            models.DeliveryAssignment.order_id == order_id
        )
        .first()
    )


def get_order_fulfilments(db, order_id):
    return (
        db.query(models.RestaurantFulfilment)
        .filter(
            models.RestaurantFulfilment.order_id == order_id
        )
        .all()
    )


def get_owned_restaurant(db, restaurant_id, current_user):
    """
    Verify that the restaurant exists and belongs
    to the currently authenticated restaurant owner.
    """

    restaurant = (
        db.query(models.Restaurant)
        .filter(models.Restaurant.id == restaurant_id)
        .first()
    )

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
            detail="Your restaurant must be approved before you can manage orders"
        )

    return restaurant


# --------------------------------------------------
# 1. CREATE A NEW ORDER
# POST /orders/
# Customer only
# --------------------------------------------------

@router.post("/")
def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("customer")
    )
):
    if not order_data.items:
        raise HTTPException(
            status_code=400,
            detail="Order must contain at least one item"
        )

    total_amount = 0
    order_items_data = []
    restaurant_groups = {}

    try:
        # Validate menu items and calculate prices from database.
        for item in order_data.items:

            menu_item = (
                db.query(models.MenuItem)
                .filter(models.MenuItem.id == item.menu_item_id)
                .first()
            )

            if not menu_item:
                raise HTTPException(
                    status_code=404,
                    detail=f"Menu item with ID {item.menu_item_id} not found"
                )

            item_total = menu_item.price * item.quantity
            total_amount += item_total

            order_items_data.append({
                "menu_item_id": menu_item.id,
                "item_name": menu_item.name,
                "price": menu_item.price,
                "quantity": item.quantity,
                "restaurant_id": menu_item.restaurant_id
            })

            restaurant_groups.setdefault(
                menu_item.restaurant_id, []
            ).append(len(order_items_data) - 1)

        # Create the main customer order.
        new_order = models.Order(
            customer_id=current_user.id,
            customer_name=current_user.name,
            phone=order_data.phone,
            address=order_data.address,
            total_amount=total_amount,
            status="Placed"
        )

        db.add(new_order)
        db.flush()

        # Create all order items.
        created_items = []

        for item_data in order_items_data:
            new_item = models.OrderItem(
                order_id=new_order.id,
                menu_item_id=item_data["menu_item_id"],
                item_name=item_data["item_name"],
                price=item_data["price"],
                quantity=item_data["quantity"]
            )

            db.add(new_item)
            db.flush()
            created_items.append(new_item)

        # Create one restaurant fulfilment per restaurant.
        for restaurant_id, item_indexes in restaurant_groups.items():

            fulfilment = models.RestaurantFulfilment(
                order_id=new_order.id,
                restaurant_id=restaurant_id,
                status="Placed"
            )

            db.add(fulfilment)
            db.flush()

            # Connect order items to their restaurant fulfilment.
            for item_index in item_indexes:
                db.add(
                    models.FulfilmentItem(
                        fulfilment_id=fulfilment.id,
                        order_item_id=created_items[item_index].id
                    )
                )

        # One delivery assignment for the entire customer order.
        delivery_assignment = models.DeliveryAssignment(
            order_id=new_order.id,
            delivery_partner_id=None,
            status="Unassigned"
        )

        db.add(delivery_assignment)

        # Record payment in the ledger as part of the same transaction.
        payment_status = (
            "pending" if order_data.payment_method == "cod"
            else "paid_simulated"
        )
        payment_transaction = models.PaymentTransaction(
            order_id=new_order.id,
            transaction_reference=f"CBPAY-{new_order.id:06d}",
            payment_method=order_data.payment_method,
            payment_status=payment_status,
            amount=total_amount
        )
        db.add(payment_transaction)

        db.commit()
        db.refresh(new_order)

        return {
            "id": new_order.id,
            "order_number": generate_order_number(new_order.id),
            "customer_name": new_order.customer_name,
            "total_amount": new_order.total_amount,
            "status": "Placed",
            "restaurant_fulfilments": [
                {
                    "restaurant_id": restaurant_id,
                    "status": "Placed"
                }
                for restaurant_id in restaurant_groups
            ],
            "delivery_status": "Unassigned",
            "payment": serialize_payment(payment_transaction),
            "message": "Order placed successfully"
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as error:
        db.rollback()
        print("Order creation error:", error)

        raise HTTPException(
            status_code=500,
            detail="Could not create order"
        )


# --------------------------------------------------
# 2. GET AUTHENTICATED CUSTOMER'S ORDERS
# GET /orders/
# --------------------------------------------------

@router.get("/")
def get_all_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("customer")
    )
):
    # Never return every customer's orders.
    orders = (
        db.query(models.Order)
        .filter(models.Order.customer_id == current_user.id)
        .order_by(models.Order.id.desc())
        .all()
    )

    result = []

    for order in orders:
        fulfilments = get_order_fulfilments(db, order.id)
        assignment = get_order_delivery_assignment(db, order.id)

        result.append({
            "id": order.id,
            "order_number": generate_order_number(order.id),
            "customer_name": order.customer_name,
            "phone": order.phone,
            "address": order.address,
            "total_amount": order.total_amount,
            "status": get_customer_facing_status(
                fulfilments, assignment
            ),
            "items": serialize_order_items(order.items),
            "restaurant_fulfilments": [
                {
                    "restaurant_id": f.restaurant_id,
                    "restaurant_name": f.restaurant.name,
                    "status": f.status
                }
                for f in fulfilments
            ],
            "delivery_status": (
                assignment.status if assignment else None
            ),
            "payment": serialize_payment(order.payment_transaction),
            "cancellation": serialize_cancellation(order.cancellation_request),
            "return_request": serialize_return_request(order.return_request),
            "can_request_cancellation": order_can_be_cancelled(
                order, fulfilments, assignment
            ) and order.cancellation_request is None
        })

    return result


# --------------------------------------------------
# 3. GET ORDERS FOR A PARTICULAR RESTAURANT
# GET /orders/restaurant/{restaurant_id}
# Restaurant owner only
# --------------------------------------------------

@router.get("/restaurant/{restaurant_id}")
def get_restaurant_orders(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("restaurant_owner")
    )
):
    # SECURITY: Verify ownership before retrieving orders.
    restaurant = get_owned_restaurant(
        db,
        restaurant_id,
        current_user
    )

    fulfilments = (
        db.query(models.RestaurantFulfilment)
        .filter(
            models.RestaurantFulfilment.restaurant_id == restaurant.id
        )
        .order_by(models.RestaurantFulfilment.id.desc())
        .all()
    )

    result = []

    for fulfilment in fulfilments:
        order = fulfilment.order

        restaurant_items = [
            link.order_item
            for link in fulfilment.items
        ]

        restaurant_subtotal = sum(
            item.price * item.quantity
            for item in restaurant_items
        )

        assignment = get_order_delivery_assignment(db, order.id)
        result.append({
            "id": order.id,
            "order_number": generate_order_number(order.id),
            "customer_name": order.customer_name,
            "phone": order.phone,
            "address": order.address,
            # Customer-facing status includes delivery progress. Keep the
            # restaurant fulfilment status separately for audit/display.
            "status": get_customer_facing_status([fulfilment], assignment),
            "restaurant_status": fulfilment.status,
            "delivery_status": assignment.status if assignment else "Unassigned",
            "order_total": order.total_amount,
            "restaurant_subtotal": restaurant_subtotal,
            "items": serialize_order_items(restaurant_items)
        })

    return result


# --------------------------------------------------
# 4. UPDATE RESTAURANT FULFILMENT STATUS
# PATCH /orders/restaurant/{restaurant_id}/orders/{order_id}/status
# Restaurant owner only
# --------------------------------------------------

@router.patch("/restaurant/{restaurant_id}/orders/{order_id}/status")
def update_restaurant_order_status(
    restaurant_id: int,
    order_id: int,
    status_data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("restaurant_owner")
    )
):
    # SECURITY: Verify ownership before changing anything.
    get_owned_restaurant(
        db,
        restaurant_id,
        current_user
    )

    fulfilment = get_restaurant_fulfilment(
        db,
        order_id,
        restaurant_id
    )

    if not fulfilment:
        raise HTTPException(
            status_code=404,
            detail="Restaurant fulfilment not found for this order"
        )

    allowed_transitions = {
        "Placed": ["Accepted", "Rejected"],
        "Accepted": ["Preparing", "Rejected"],
        "Preparing": ["Ready for Pickup"],
        "Ready for Pickup": [],
        "Rejected": []
    }

    current_status = fulfilment.status
    new_status = status_data.status

    if new_status not in allowed_transitions.get(current_status, []):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid status transition: "
                f"{current_status} to {new_status}"
            )
        )

    fulfilment.status = new_status

    db.commit()
    db.refresh(fulfilment)

    return {
        "message": "Restaurant fulfilment status updated successfully",
        "order_id": order_id,
        "order_number": generate_order_number(order_id),
        "restaurant_id": restaurant_id,
        "old_status": current_status,
        "new_status": fulfilment.status
    }


# --------------------------------------------------
# 5. GET AUTHENTICATED CUSTOMER ORDER HISTORY
# GET /orders/my-orders
# Customer only
# --------------------------------------------------

@router.get("/my-orders")
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("customer")
    )
):
    orders = (
        db.query(models.Order)
        .filter(models.Order.customer_id == current_user.id)
        .order_by(
            models.Order.created_at.desc(),
            models.Order.id.desc()
        )
        .all()
    )

    result = []

    for order in orders:
        fulfilments = get_order_fulfilments(db, order.id)
        assignment = get_order_delivery_assignment(db, order.id)

        result.append({
            "id": order.id,
            "order_number": generate_order_number(order.id),
            "customer_name": order.customer_name,
            "total_amount": order.total_amount,
            "status": get_customer_facing_status(
                fulfilments, assignment
            ),
            "created_at": serialize_created_at(order.created_at),
            "items": serialize_order_items(order.items),
            "restaurant_fulfilments": [
                {
                    "restaurant_id": f.restaurant_id,
                    "restaurant_name": f.restaurant.name,
                    "status": f.status
                }
                for f in fulfilments
            ],
            "delivery_status": (
                assignment.status if assignment else None
            ),
            "payment": serialize_payment(order.payment_transaction),
            "cancellation": serialize_cancellation(order.cancellation_request),
            "return_request": serialize_return_request(order.return_request),
            "can_request_cancellation": order_can_be_cancelled(
                order, fulfilments, assignment
            ) and order.cancellation_request is None
        })

    return result


# --------------------------------------------------
# 6. LEGACY PHONE-BASED CUSTOMER ORDER HISTORY
# GET /orders/customer/{phone}
# Customer only
# --------------------------------------------------

@router.get("/customer/{phone}")
def get_customer_orders(
    phone: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("customer")
    )
):
    # The customer ID check prevents someone from retrieving
    # another customer's orders just by knowing their phone number.
    orders = (
        db.query(models.Order)
        .filter(
            models.Order.customer_id == current_user.id,
            models.Order.phone == phone
        )
        .order_by(models.Order.id.desc())
        .all()
    )

    result = []

    for order in orders:
        fulfilments = get_order_fulfilments(db, order.id)
        assignment = get_order_delivery_assignment(db, order.id)

        result.append({
            "id": order.id,
            "order_number": generate_order_number(order.id),
            "customer_name": order.customer_name,
            "total_amount": order.total_amount,
            "status": get_customer_facing_status(
                fulfilments, assignment
            ),
            "created_at": serialize_created_at(order.created_at),
            "items": serialize_order_items(order.items),
            "restaurant_fulfilments": [
                {
                    "restaurant_id": f.restaurant_id,
                    "restaurant_name": f.restaurant.name,
                    "status": f.status
                }
                for f in fulfilments
            ],
            "delivery_status": (
                assignment.status if assignment else None
            ),
            "payment": serialize_payment(order.payment_transaction),
            "cancellation": serialize_cancellation(order.cancellation_request),
            "return_request": serialize_return_request(order.return_request),
            "can_request_cancellation": order_can_be_cancelled(
                order, fulfilments, assignment
            ) and order.cancellation_request is None
        })

    return result


# --------------------------------------------------
# CUSTOMER CANCELLATION REQUEST
# POST /orders/{order_id}/cancellation
# --------------------------------------------------

class CancellationRequestCreate(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


@router.post("/{order_id}/cancellation")
def request_order_cancellation(
    order_id: str,
    request_data: CancellationRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("customer"))
):
    numeric_id = order_id.upper()[2:] if order_id.upper().startswith("CB") else order_id
    if not numeric_id.isdigit():
        raise HTTPException(status_code=400, detail="Invalid order number")

    order = db.query(models.Order).filter(
        models.Order.id == int(numeric_id),
        models.Order.customer_id == current_user.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    existing = db.query(models.CancellationRequest).filter(
        models.CancellationRequest.order_id == order.id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A cancellation request already exists for this order")

    fulfilments = get_order_fulfilments(db, order.id)
    assignment = get_order_delivery_assignment(db, order.id)
    if not order_can_be_cancelled(order, fulfilments, assignment):
        raise HTTPException(
            status_code=400,
            detail="This order can no longer be cancelled because preparation or delivery has started. Please contact support."
        )

    cancellation = models.CancellationRequest(
        order_id=order.id,
        customer_id=current_user.id,
        reason=request_data.reason.strip(),
        status="pending"
    )
    db.add(cancellation)
    db.commit()
    db.refresh(cancellation)
    return {
        "message": "Cancellation request submitted for admin review.",
        "order_number": generate_order_number(order.id),
        "cancellation": serialize_cancellation(cancellation)
    }


# --------------------------------------------------
# CUSTOMER POST-DELIVERY RETURN / REFUND REQUEST
# --------------------------------------------------

class ReturnRequestCreate(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


@router.post("/{order_id}/return-request")
def create_return_request(
    order_id: str,
    request_data: ReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("customer"))
):
    numeric_id = order_id.upper()[2:] if order_id.upper().startswith("CB") else order_id
    if not numeric_id.isdigit():
        raise HTTPException(status_code=400, detail="Invalid order number")

    order = db.query(models.Order).filter(
        models.Order.id == int(numeric_id),
        models.Order.customer_id == current_user.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    assignment = get_order_delivery_assignment(db, order.id)
    if not assignment or assignment.status != "Delivered":
        raise HTTPException(status_code=400, detail="Return/refund requests are available only after delivery")
    if order.cancellation_request and order.cancellation_request.status == "approved":
        raise HTTPException(status_code=409, detail="This order was already cancelled and refunded")
    if order.return_request:
        raise HTTPException(status_code=409, detail="A return/refund request already exists for this order")

    restaurant_id = db.query(models.RestaurantFulfilment.restaurant_id).filter(
        models.RestaurantFulfilment.order_id == order.id
    ).first()
    if not restaurant_id:
        raise HTTPException(status_code=400, detail="No restaurant was found for this order")

    request = models.ReturnRequest(
        order_id=order.id,
        customer_id=current_user.id,
        restaurant_id=restaurant_id[0],
        reason=request_data.reason.strip(),
        status="pending"
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return {"message": "Return/refund request submitted to the restaurant.", "return_request": serialize_return_request(request)}


# --------------------------------------------------
# 7. GET A SINGLE ORDER BY ID OR ORDER NUMBER
# GET /orders/{order_id}
# Customer who placed the order only
# --------------------------------------------------

@router.get("/{order_id}")
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("customer")
    )
):
    if order_id.upper().startswith("CB"):
        numeric_id = order_id.upper()[2:]
    else:
        numeric_id = order_id

    if not numeric_id.isdigit():
        raise HTTPException(
            status_code=400,
            detail="Invalid order ID or order number"
        )

    # SECURITY: Find the order only if it belongs to this customer.
    order = (
        db.query(models.Order)
        .filter(
            models.Order.id == int(numeric_id),
            models.Order.customer_id == current_user.id
        )
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    fulfilments = get_order_fulfilments(db, order.id)
    assignment = get_order_delivery_assignment(db, order.id)

    return {
        "id": order.id,
        "order_number": generate_order_number(order.id),
        "customer_name": order.customer_name,
        "phone": order.phone,
        "address": order.address,
        "total_amount": order.total_amount,
        "status": get_customer_facing_status(
            fulfilments, assignment
        ),
        "created_at": serialize_created_at(order.created_at),
        "items": serialize_order_items(order.items),
        "restaurant_fulfilments": [
            {
                "restaurant_id": f.restaurant_id,
                "restaurant_name": f.restaurant.name,
                "status": f.status
            }
            for f in fulfilments
        ],
        "delivery_status": (
            assignment.status if assignment else None
        ),
        "payment": serialize_payment(order.payment_transaction),
        "cancellation": serialize_cancellation(order.cancellation_request),
        "return_request": serialize_return_request(order.return_request),
        "review": (lambda r: {
            "rating": r.rating,
            "comment": r.comment,
            "ordered_items": [
                {"item_name": item.item_name, "quantity": item.quantity}
                for item in order.items
            ]
        } if r else None)(db.query(models.RestaurantReview).filter(
            models.RestaurantReview.order_id == order.id
        ).first()),
        "can_request_cancellation": order_can_be_cancelled(
            order, fulfilments, assignment
        ) and order.cancellation_request is None
    }
