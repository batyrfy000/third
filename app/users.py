from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, auth

router = APIRouter()

@router.post("/register", response_model=schemas.UserOut)
def register(user_data: schemas.UserCreate, db: Session = Depends(auth.get_db)):
    user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already registered")
    new_user = models.User(
        username=user_data.username,
        hashed_password=auth.hash_password(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login")
def login(form_data: auth.OAuth2PasswordRequestForm = Depends(), db: Session = Depends(auth.get_db)):
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(auth.get_db)):
    return db.query(models.User).all()
