"""
Database seeder script.
Run with: python -m backend.seed_db
"""
import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from app import models, database

# Add the parent directory to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def seed_employees(db: Session):
    """Add test employees to the database."""
    test_employees = [
        {"name": "John Doe"},
        {"name": "Jane Smith"},
        {"name": "Alex Johnson"},
        {"name": "Maria Garcia"},
        {"name": "Wei Zhang"},
    ]
    
    for emp_data in test_employees:
        # Check if employee already exists
        exists = db.query(models.Employee).filter(
            models.Employee.name == emp_data["name"]
        ).first()
        
        if not exists:
            employee = models.Employee(**emp_data)
            db.add(employee)
            print(f"Added employee: {emp_data['name']}")
    
    db.commit()
    print("\nDatabase seeded successfully!")

if __name__ == "__main__":
    # Create all tables if they don't exist
    models.Base.metadata.create_all(bind=database.engine)
    
    # Seed the database
    db = database.SessionLocal()
    try:
        seed_employees(db)
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()
