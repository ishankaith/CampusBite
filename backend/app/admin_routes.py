
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import require_role


router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


# View all restaurant applications
@router.get(
    "/restaurants",
    response_model=list[schemas.RestaurantResponse]
)
def get_all_restaurant_applications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    return db.query(models.Restaurant).order_by(
        models.Restaurant.id.desc()
    ).all()


# View pending restaurant applications
@router.get(
    "/restaurants/pending",
    response_model=list[schemas.RestaurantResponse]
)
def get_pending_restaurants(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    return db.query(models.Restaurant).filter(
        models.Restaurant.approval_status == "pending"
    ).all()


# Approve a restaurant application
@router.put(
    "/restaurants/{restaurant_id}/approve",
    response_model=schemas.RestaurantResponse
)
def approve_restaurant(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id
    ).first()

    if restaurant is None:
        raise HTTPException(
            status_code=404,
            detail="Restaurant not found"
        )

    restaurant.approval_status = "approved"

    db.commit()
    db.refresh(restaurant)

    return restaurant


# Reject a restaurant application
@router.put(
    "/restaurants/{restaurant_id}/reject",
    response_model=schemas.RestaurantResponse
)
def reject_restaurant(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id
    ).first()

    if restaurant is None:
        raise HTTPException(
            status_code=404,
            detail="Restaurant not found"
        )

    restaurant.approval_status = "rejected"

    db.commit()
    db.refresh(restaurant)

    return restaurant


# View the payment ledger (admin only)
@router.get("/payment-transactions")
def get_payment_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    transactions = (
        db.query(models.PaymentTransaction)
        .order_by(models.PaymentTransaction.id.desc())
        .all()
    )

    return [
        {
            "id": transaction.id,
            "order_id": transaction.order_id,
            "order_number": f"CB{transaction.order_id:06d}",
            "customer_name": transaction.order.customer_name,
            "transaction_reference": transaction.transaction_reference,
            "payment_method": transaction.payment_method,
            "payment_status": transaction.payment_status,
            "amount": transaction.amount,
            "created_at": (
                transaction.created_at.isoformat()
                if transaction.created_at else None
            )
        }
        for transaction in transactions
    ]


class CancellationReview(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    admin_note: str | None = Field(default=None, max_length=500)


@router.get("/cancellation-requests")
def get_cancellation_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    requests = db.query(models.CancellationRequest).order_by(
        models.CancellationRequest.id.desc()
    ).all()
    return [{
        "id": item.id,
        "order_id": item.order_id,
        "order_number": f"CB{item.order_id:06d}",
        "customer_name": item.order.customer_name,
        "payment_method": item.order.payment_transaction.payment_method if item.order.payment_transaction else None,
        "payment_status": item.order.payment_transaction.payment_status if item.order.payment_transaction else None,
        "amount": item.order.total_amount,
        "reason": item.reason,
        "status": item.status,
        "admin_note": item.admin_note,
        "created_at": item.created_at.isoformat() if item.created_at else None
    } for item in requests]


@router.patch("/cancellation-requests/{request_id}")
def review_cancellation_request(
    request_id: int,
    review: CancellationReview,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    cancellation = db.query(models.CancellationRequest).filter(
        models.CancellationRequest.id == request_id
    ).first()
    if not cancellation:
        raise HTTPException(status_code=404, detail="Cancellation request not found")
    if cancellation.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been reviewed")

    order = cancellation.order
    payment = order.payment_transaction
    cancellation.admin_note = (review.admin_note or "").strip() or None
    cancellation.reviewed_at = datetime.now(timezone.utc)

    if review.decision == "reject":
        cancellation.status = "rejected"
        db.commit()
        return {"message": "Cancellation request rejected.", "status": "rejected"}

    # Re-check eligibility at approval time to avoid cancelling an order
    # that moved into preparation/delivery while awaiting review.
    fulfilments = db.query(models.RestaurantFulfilment).filter(
        models.RestaurantFulfilment.order_id == order.id
    ).all()
    assignment = db.query(models.DeliveryAssignment).filter(
        models.DeliveryAssignment.order_id == order.id
    ).first()
    if order.status in ["Cancelled", "Rejected"] or not fulfilments or any(
        f.status not in ["Placed", "Accepted"] for f in fulfilments
    ) or (assignment and assignment.status != "Unassigned"):
        raise HTTPException(status_code=409, detail="Order has progressed and can no longer be cancelled")

    order.status = "Cancelled"
    for fulfilment in fulfilments:
        fulfilment.status = "Cancelled"
    if assignment:
        assignment.status = "Cancelled"

    refund_result = None
    if payment and payment.payment_status == "paid_simulated":
        existing_refund = db.query(models.RefundTransaction).filter(
            models.RefundTransaction.order_id == order.id
        ).first()
        if not existing_refund:
            refund = models.RefundTransaction(
                payment_transaction_id=payment.id,
                order_id=order.id,
                refund_reference=f"CBREF-{order.id:06d}",
                amount=payment.amount,
                status="refunded",
                reason=cancellation.reason
            )
            db.add(refund)
            payment.payment_status = "refunded"
            refund_result = refund.refund_reference
    elif payment and payment.payment_status == "pending":
        payment.payment_status = "cancelled"

    cancellation.status = "approved"
    db.commit()
    return {
        "message": "Order cancellation approved.",
        "status": "approved",
        "order_number": f"CB{order.id:06d}",
        "payment_status": payment.payment_status if payment else None,
        "refund_reference": refund_result
    }


@router.get("/refund-transactions")
def get_refund_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    refunds = db.query(models.RefundTransaction).order_by(
        models.RefundTransaction.id.desc()
    ).all()
    return [{
        "id": item.id,
        "order_number": f"CB{item.order_id:06d}",
        "refund_reference": item.refund_reference,
        "amount": item.amount,
        "status": item.status,
        "reason": item.reason,
        "created_at": item.created_at.isoformat() if item.created_at else None
    } for item in refunds]


class ReturnReview(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    owner_note: str | None = Field(default=None, max_length=500)


@router.get("/restaurants/{restaurant_id}/return-requests")
def get_restaurant_return_requests(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("restaurant_owner"))
):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id,
        models.Restaurant.owner_id == current_user.id,
        models.Restaurant.approval_status == "approved"
    ).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Approved restaurant not found for this owner")
    requests = db.query(models.ReturnRequest).filter(
        models.ReturnRequest.restaurant_id == restaurant_id
    ).order_by(models.ReturnRequest.id.desc()).all()
    return [{
        "id": item.id,
        "order_id": item.order_id,
        "order_number": f"CB{item.order_id:06d}",
        "customer_name": item.order.customer_name,
        "amount": item.order.total_amount,
        "payment_method": item.order.payment_transaction.payment_method if item.order.payment_transaction else None,
        "payment_status": item.order.payment_transaction.payment_status if item.order.payment_transaction else None,
        "reason": item.reason,
        "status": item.status,
        "owner_note": item.owner_note,
        "created_at": item.created_at.isoformat() if item.created_at else None
    } for item in requests]


@router.patch("/return-requests/{request_id}")
def review_return_request(
    request_id: int,
    review: ReturnReview,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("restaurant_owner"))
):
    request = db.query(models.ReturnRequest).filter(
        models.ReturnRequest.id == request_id
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Return/refund request not found")
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == request.restaurant_id,
        models.Restaurant.owner_id == current_user.id,
        models.Restaurant.approval_status == "approved"
    ).first()
    if not restaurant:
        raise HTTPException(status_code=403, detail="You cannot review this restaurant's request")
    if request.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been reviewed")
    assignment = db.query(models.DeliveryAssignment).filter(
        models.DeliveryAssignment.order_id == request.order_id
    ).first()
    if not assignment or assignment.status != "Delivered":
        raise HTTPException(status_code=409, detail="The order is not in delivered status")

    request.owner_note = (review.owner_note or "").strip() or None
    request.reviewed_at = datetime.now(timezone.utc)
    if review.decision == "reject":
        request.status = "rejected"
        db.commit()
        return {"message": "Return/refund request rejected.", "status": "rejected"}

    payment = request.order.payment_transaction
    refund_reference = None
    if payment and payment.payment_method == "online" and payment.payment_status == "paid_simulated":
        existing_refund = db.query(models.RefundTransaction).filter(
            models.RefundTransaction.order_id == request.order_id
        ).first()
        if existing_refund:
            raise HTTPException(status_code=409, detail="A refund has already been recorded for this order")
        refund_reference = f"CBRET-{request.order_id:06d}"
        db.add(models.RefundTransaction(
            payment_transaction_id=payment.id,
            order_id=request.order_id,
            refund_reference=refund_reference,
            amount=payment.amount,
            status="refunded",
            reason=request.reason
        ))
        payment.payment_status = "refunded"
    request.status = "approved"
    db.commit()
    return {"message": "Return/refund request approved.", "status": "approved", "refund_reference": refund_reference, "payment_status": payment.payment_status if payment else None}
