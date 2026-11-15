
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from .database import get_db
from .models import User, Restaurant
from .auth import hash_password, verify_password, create_access_token


router = APIRouter(prefix="/auth", tags=["Authentication"])


# Registration request
class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Literal[
        "customer",
        "restaurant_owner",
        "delivery_partner"
    ] = "customer"
    restaurant_id: Optional[int] = None


# Login request
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Register a new user
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(
    user_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    email = str(user_data.email).lower()

    # Check whether the email is already registered
    existing_user = db.query(User).filter(
        User.email == email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already registered"
        )

    # Restaurant owners can now register first and submit a restaurant
    # application from their owner portal. A restaurant_id is still accepted
    # for backward compatibility with the earlier registration flow.
    restaurant = None

    if user_data.role == "restaurant_owner" and user_data.restaurant_id is not None:
        restaurant = db.query(Restaurant).filter(
            Restaurant.id == user_data.restaurant_id
        ).first()

        if restaurant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant not found"
            )

        if restaurant.owner_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This restaurant already has an owner"
            )

    elif user_data.role != "restaurant_owner" and user_data.restaurant_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only restaurant owners can provide a restaurant ID"
        )

    # Create the user with a hashed password
    new_user = User(
        name=user_data.name.strip(),
        email=email,
        password=hash_password(user_data.password),
        role=user_data.role
    )

    try:
        db.add(new_user)
        db.flush()

        # Link the restaurant to its new owner
        if restaurant is not None:
            restaurant.owner_id = new_user.id

        db.commit()
        db.refresh(new_user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create account. Email or restaurant may already be registered."
        )

    # Generate JWT access token after successful registration
    access_token = create_access_token(
        data={"sub": str(new_user.id)}
    )

    # Return token and user details to frontend
    return {
        "message": "Account created successfully",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role
        }
    }


# Log in an existing user
@router.post("/login")
def login_user(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    email = str(login_data.email).lower()

    user = db.query(User).filter(
        User.email == email
    ).first()

    if user is None or not verify_password(
        login_data.password,
        user.password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    access_token = create_access_token(
        data={"sub": str(user.id)}
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }
