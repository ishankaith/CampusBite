
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    DateTime,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="customer")

    owned_restaurants = relationship(
        "Restaurant",
        back_populates="owner"
    )

    delivery_assignments = relationship(
        "DeliveryAssignment",
        back_populates="delivery_partner"
    )

    # Orders placed by this customer
    orders = relationship(
        "Order",
        back_populates="customer"
    )


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    cuisine = Column(String)
    rating = Column(Float, default=0)
    delivery_time = Column(String)
    price_for_one = Column(Integer)
    image = Column(String)

    # New restaurant applications require approval
    approval_status = Column(
        String,
        nullable=False,
        default="pending",
        server_default="pending"
    )

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    owner = relationship(
        "User",
        back_populates="owned_restaurants"
    )

    menu_items = relationship(
        "MenuItem",
        back_populates="restaurant",
        cascade="all, delete-orphan"
    )

    fulfilments = relationship(
        "RestaurantFulfilment",
        back_populates="restaurant"
    )


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    price = Column(Float, nullable=False)
    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id"),
        nullable=False
    )

    restaurant = relationship(
        "Restaurant",
        back_populates="menu_items"
    )


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)

    # Customer details
    customer_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    customer_name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    address = Column(String, nullable=False)

    total_amount = Column(Float, nullable=False)
    status = Column(String, default="Placed")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # Customer account relationship
    customer = relationship(
        "User",
        back_populates="orders"
    )

    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )

    fulfilments = relationship(
        "RestaurantFulfilment",
        back_populates="order",
        cascade="all, delete-orphan"
    )

    delivery_assignment = relationship(
        "DeliveryAssignment",
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan"
    )

    payment_transaction = relationship(
        "PaymentTransaction",
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan"
    )

    cancellation_request = relationship(
        "CancellationRequest",
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan"
    )

    return_request = relationship(
        "ReturnRequest",
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(
        Integer,
        ForeignKey("orders.id"),
        nullable=False
    )

    menu_item_id = Column(Integer, nullable=True)
    item_name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)

    order = relationship(
        "Order",
        back_populates="items"
    )

    fulfilment_links = relationship(
        "FulfilmentItem",
        back_populates="order_item"
    )


class RestaurantFulfilment(Base):
    __tablename__ = "restaurant_fulfilments"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(
        Integer,
        ForeignKey("orders.id"),
        nullable=False
    )

    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id"),
        nullable=False
    )

    status = Column(String, nullable=False, default="Placed")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint(
            "order_id",
            "restaurant_id",
            name="uq_order_restaurant_fulfilment"
        ),
    )

    order = relationship(
        "Order",
        back_populates="fulfilments"
    )

    restaurant = relationship(
        "Restaurant",
        back_populates="fulfilments"
    )

    items = relationship(
        "FulfilmentItem",
        back_populates="fulfilment",
        cascade="all, delete-orphan"
    )


class FulfilmentItem(Base):
    __tablename__ = "fulfilment_items"

    id = Column(Integer, primary_key=True, index=True)

    fulfilment_id = Column(
        Integer,
        ForeignKey("restaurant_fulfilments.id"),
        nullable=False
    )

    order_item_id = Column(
        Integer,
        ForeignKey("order_items.id"),
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "order_item_id",
            name="uq_fulfilment_order_item"
        ),
    )

    fulfilment = relationship(
        "RestaurantFulfilment",
        back_populates="items"
    )

    order_item = relationship(
        "OrderItem",
        back_populates="fulfilment_links"
    )


class DeliveryAssignment(Base):
    __tablename__ = "delivery_assignments"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(
        Integer,
        ForeignKey("orders.id"),
        nullable=False,
        unique=True
    )

    delivery_partner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    status = Column(String, nullable=False, default="Unassigned")

    assigned_at = Column(DateTime(timezone=True), nullable=True)
    picked_up_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)

    order = relationship(
        "Order",
        back_populates="delivery_assignment"
    )

    delivery_partner = relationship(
        "User",
        back_populates="delivery_assignments"
    )


class PaymentTransaction(Base):
    """One payment-ledger entry for each CampusBite order."""

    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(
        Integer,
        ForeignKey("orders.id"),
        nullable=False,
        unique=True,
        index=True
    )
    transaction_reference = Column(
        String,
        nullable=False,
        unique=True,
        index=True
    )
    payment_method = Column(String, nullable=False)
    payment_status = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    order = relationship(
        "Order",
        back_populates="payment_transaction"
    )


class CancellationRequest(Base):
    """A customer's request to cancel an order, reviewed by an admin."""

    __tablename__ = "cancellation_requests"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")
    admin_note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    order = relationship("Order", back_populates="cancellation_request")
    customer = relationship("User")


class RefundTransaction(Base):
    """Audit record for a simulated online-payment refund."""

    __tablename__ = "refund_transactions"

    id = Column(Integer, primary_key=True, index=True)
    payment_transaction_id = Column(Integer, ForeignKey("payment_transactions.id"), nullable=False, unique=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True, index=True)
    refund_reference = Column(String, nullable=False, unique=True, index=True)
    amount = Column(Float, nullable=False)
    status = Column(String, nullable=False, default="refunded")
    reason = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    payment_transaction = relationship("PaymentTransaction")
    order = relationship("Order")


class ReturnRequest(Base):
    """A customer's post-delivery return/refund request."""
    __tablename__ = "return_requests"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    reason = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")
    owner_note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    order = relationship("Order", back_populates="return_request")
    customer = relationship("User")
    restaurant = relationship("Restaurant")


class RestaurantReview(Base):
    """A customer review linked to a delivered order and restaurant."""
    __tablename__ = "restaurant_reviews"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(String(1000), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("order_id", "restaurant_id", name="uq_review_order_restaurant"),
    )

    order = relationship("Order")
    customer = relationship("User")
    restaurant = relationship("Restaurant")
