import os
import logging
from sqlalchemy import Column, Integer, String, DateTime, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define the base class for SQLAlchemy models
Base = declarative_base()

class PlanktonUpload(Base):
    __tablename__ = "plankton_uploads"
    
    # Unique identifier for each upload
    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    file_path = Column(String(500), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    location = Column(String(100), nullable=True)
    
    # Classification Results
    model_used = Column(String(100), nullable=False)
    top_class = Column(String(100), nullable=False)
    top_probability = Column(Float, nullable=False)
    second_class = Column(String(100), nullable=True)
    second_probability = Column(Float, nullable=True)
    third_class = Column(String(100), nullable=True)
    third_probability = Column(Float, nullable=True)
    
    # Additional metadata
    file_size = Column(Integer, nullable=True)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    user_ip = Column(String(45), nullable=True)
    processing_time = Column(Float, nullable=True) # In seconds
    
    def __repr__(self):
        return f"<PlanktonUpload(id={self.id}, filename='{self.stored_filename}', class='{self.top_class}')>"

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./planktoscan.db")

# Handle SQLite connection
try:
    if "sqlite" in DATABASE_URL:
        engine = create_engine(
            DATABASE_URL, 
            connect_args={"check_same_thread": False},
            echo=os.getenv("SQL_DEBUG", "false").lower() == "true"
        )
    else:
        engine = create_engine(DATABASE_URL)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully!")   
except Exception as e:
    logger.error(f"Database connection error: {e}")
    logger.error("Check your DATABASE_URL configuration")
    raise e

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_database():
    """Initialize database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully!")
        return True
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        return False

def get_database_info():
    """Get database information"""
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        return {
            "database_url": DATABASE_URL,
            "engine": str(engine.url),
            "tables": tables,
            "status": "connected"
        }
    except Exception as e:
        return {
            "database_url": DATABASE_URL,
            "error": str(e),
            "status": "error"
        }