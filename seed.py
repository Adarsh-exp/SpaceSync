"""
Seed the database with demo data.
Run: python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from backend.database import engine, SessionLocal, Base
from backend.models.user import User
from backend.models.space import Space
from backend.models.booking import Booking
from backend.models.review import Review
from backend.ml.sentiment import get_sentiment
from passlib.context import CryptContext
from datetime import date, timedelta
import random

Base.metadata.create_all(bind=engine)
db = SessionLocal()
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Users ─────────────────────────────────────────────────────────────────────
users_data = [
    dict(name="Admin User",    email="admin@spacesync.in",  role="admin",  city="Hyderabad", budget_min=0,   budget_max=10000),
    dict(name="Rahul Sharma",  email="rahul@example.com",   role="owner",  city="Hyderabad", budget_min=200, budget_max=2000),
    dict(name="Priya Patel",   email="priya@example.com",   role="user",   city="Bangalore", budget_min=100, budget_max=1500),
    dict(name="Arjun Mehta",   email="arjun@example.com",   role="user",   city="Mumbai",    budget_min=300, budget_max=3000),
    dict(name="Sneha Reddy",   email="sneha@example.com",   role="owner",  city="Chennai",   budget_min=0,   budget_max=5000),
]

created_users = []
for u in users_data:
    existing = db.query(User).filter(User.email == u["email"]).first()
    if not existing:
        user = User(password_hash=pwd.hash("password123"), **u)
        db.add(user)
        db.flush()
        created_users.append(user)
        print(f"  ✅ User: {u['name']} ({u['email']}) — password: password123")
    else:
        created_users.append(existing)
        print(f"  ⏭  User exists: {u['email']}")

db.commit()

# Get owner IDs
owner1 = db.query(User).filter(User.email == "rahul@example.com").first()
owner2 = db.query(User).filter(User.email == "sneha@example.com").first()

# ── Spaces ────────────────────────────────────────────────────────────────────
spaces_data = [
    dict(owner_id=owner1.id, name="Green Valley Cricket Ground", type="cricket",    city="Hyderabad", area="Gachibowli",      base_price=800,  amenities="Floodlights,Pavilion,Parking,Changing Rooms,Scoreboard", rating=4.5, total_bookings=142, lat=17.4401, lng=78.3489),
    dict(owner_id=owner1.id, name="Stadium Arena Hyderabad",     type="cricket",    city="Hyderabad", area="Miyapur",         base_price=1200, amenities="Floodlights,Nets,Cafeteria,Umpire,PA System",            rating=4.8, total_bookings=210, lat=17.4947, lng=78.3571),
    dict(owner_id=owner2.id, name="Royal Celebration Hall",      type="party_hall", city="Hyderabad", area="Jubilee Hills",   base_price=5000, amenities="AC,Stage,Catering,DJ,Decoration,Parking,Generator",      rating=4.7, total_bookings=88,  lat=17.4321, lng=78.4086),
    dict(owner_id=owner2.id, name="Garden Oasis Party Hall",     type="party_hall", city="Bangalore", area="Koramangala",     base_price=3500, amenities="Open Garden,Catering,DJ,Parking,Restrooms",              rating=4.3, total_bookings=65,  lat=12.9352, lng=77.6245),
    dict(owner_id=owner1.id, name="SmartPark Bandra",            type="parking",    city="Mumbai",    area="Bandra West",     base_price=120,  amenities="CCTV,24/7,Security Guard,EV Charging",                   rating=4.1, total_bookings=520, lat=19.0596, lng=72.8295),
    dict(owner_id=owner1.id, name="SecureSpot Koramangala",      type="parking",    city="Bangalore", area="Koramangala 5th", base_price=80,   amenities="CCTV,Covered,24/7,Security Guard",                       rating=3.9, total_bookings=380, lat=12.9320, lng=77.6280),
    dict(owner_id=owner2.id, name="Champions Cricket Hub",       type="cricket",    city="Chennai",   area="Anna Nagar",      base_price=600,  amenities="Floodlights,Nets,Changing Rooms,Drinking Water",         rating=4.2, total_bookings=95,  lat=13.0850, lng=80.2101),
    dict(owner_id=owner2.id, name="Prestige Banquet Hall",       type="party_hall", city="Mumbai",    area="Andheri West",    base_price=8000, amenities="AC,Stage,Catering,Valet,AV System,Bridal Suite",         rating=4.6, total_bookings=120, lat=19.1209, lng=72.8395),
    dict(owner_id=owner1.id, name="EasyPark Connaught Place",    type="parking",    city="Delhi",     area="Connaught Place",  base_price=100, amenities="Multi-Level,CCTV,EV Charging,Lifts",                    rating=4.0, total_bookings=650, lat=28.6315, lng=77.2167),
    dict(owner_id=owner2.id, name="Premier Cricket Ground Pune", type="cricket",    city="Pune",      area="Baner",           base_price=700,  amenities="Floodlights,Pavilion,Nets,Cafeteria,Scoreboard",         rating=4.4, total_bookings=78,  lat=18.5590, lng=73.7868),
]

created_spaces = []
for s in spaces_data:
    existing = db.query(Space).filter(Space.name == s["name"]).first()
    if not existing:
        space = Space(**s)
        db.add(space)
        db.flush()
        created_spaces.append(space)
        print(f"  ✅ Space: {s['name']} ({s['type']}, {s['city']})")
    else:
        created_spaces.append(existing)
        print(f"  ⏭  Space exists: {s['name']}")

db.commit()

# ── Bookings ──────────────────────────────────────────────────────────────────
user_ids   = [u.id for u in db.query(User).filter(User.role == "user").all()]
slots      = ["morning", "afternoon", "evening", "night"]
statuses   = ["confirmed"] * 9 + ["cancelled"]

booking_count = 0
for i in range(30):
    space  = random.choice(created_spaces)
    user   = random.choice(db.query(User).all())
    days_ago = random.randint(0, 60)
    slot_date = date.today() - timedelta(days=days_ago)
    slot_time = random.choice(slots)
    dur = random.randint(1, 4)
    price = space.base_price * dur * random.uniform(1.0, 2.0)
    status = random.choice(statuses)

    existing = db.query(Booking).filter(
        Booking.space_id == space.id,
        Booking.slot_date == slot_date,
        Booking.slot_time == slot_time,
        Booking.status == "confirmed",
    ).first()
    if not existing:
        b = Booking(
            user_id=user.id, space_id=space.id, slot_date=slot_date,
            slot_time=slot_time, duration_hours=dur,
            price_paid=round(price, 2), status=status,
        )
        db.add(b)
        booking_count += 1

db.commit()
print(f"  ✅ {booking_count} bookings seeded")

# ── Reviews ───────────────────────────────────────────────────────────────────
review_samples = [
    (5, "Absolutely brilliant ground! Floodlights were perfect and the pitch was in great shape."),
    (4, "Really good venue. Parking was a bit tight but overall a great experience."),
    (5, "Best cricket ground in Hyderabad. Will definitely book again!"),
    (3, "Decent place but the changing rooms need some renovation."),
    (4, "Loved the ambience. The hall was beautifully decorated for our function."),
    (5, "Seamless booking experience. The space was exactly as described. Highly recommend!"),
    (2, "Disappointing. The lights went out mid-game and support was slow to respond."),
    (4, "Good parking facility. Very secure and well-maintained. Value for money."),
    (5, "Spectacular venue for our wedding reception. Staff was super helpful!"),
    (3, "Average. Could improve on cleanliness. The pitch surface was uneven in patches."),
]

all_spaces = db.query(Space).all()
all_users  = db.query(User).all()
rev_count  = 0

for rating, comment in review_samples:
    space = random.choice(all_spaces)
    user  = random.choice(all_users)
    exists = db.query(Review).filter(Review.space_id == space.id, Review.user_id == user.id).first()
    if not exists:
        r = Review(
            user_id=user.id, space_id=space.id,
            rating=rating, comment=comment,
            sentiment=get_sentiment(comment),
        )
        db.add(r)
        rev_count += 1

db.commit()
print(f"  ✅ {rev_count} reviews seeded")

# Recalculate space ratings
for space in db.query(Space).all():
    reviews = db.query(Review).filter(Review.space_id == space.id).all()
    if reviews:
        space.rating = round(sum(r.rating for r in reviews) / len(reviews), 2)
db.commit()

print()
print("=" * 50)
print("🎉 Seed complete! Login credentials:")
print("   admin@spacesync.in  / password123  (admin)")
print("   rahul@example.com   / password123  (owner)")
print("   priya@example.com   / password123  (user)")
print("=" * 50)

db.close()
