from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from backend.database import get_db
from backend.models.user import User
from backend.schemas.user import UserCreate, UserLogin, UserOut, TokenResponse, UserProfileUpdate
from backend.auth.jwt_handler import create_access_token, get_current_user

router = APIRouter()
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


@router.post("/register", response_model=TokenResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        city=user_data.city,
        budget_min=user_data.budget_min,
        budget_max=user_data.budget_max,
        role=user_data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        current_user.name = name

    if payload.city is not None:
        current_user.city = payload.city.strip() or None

    if payload.budget_min is not None:
        current_user.budget_min = payload.budget_min
    if payload.budget_max is not None:
        current_user.budget_max = payload.budget_max
    if current_user.budget_min > current_user.budget_max:
        raise HTTPException(status_code=400, detail="Budget min cannot be greater than budget max")

    if payload.old_password or payload.new_password or payload.confirm_password:
        if not (payload.old_password and payload.new_password and payload.confirm_password):
            raise HTTPException(status_code=400, detail="old_password, new_password, and confirm_password are required together")
        if payload.new_password != payload.confirm_password:
            raise HTTPException(status_code=400, detail="New password and confirm password must match")
        if not verify_password(payload.old_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Old password is incorrect")
        current_user.password_hash = hash_password(payload.new_password)

    db.commit()
    db.refresh(current_user)
    return current_user
