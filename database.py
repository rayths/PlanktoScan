import os
import logging
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to import database-specific libraries
try:
    import psycopg2
    POSTGRESQL_AVAILABLE = True
except ImportError:
    POSTGRESQL_AVAILABLE = False
    logger.warning("PostgreSQL support not available. Install psycopg2-binary for PostgreSQL support.")

try:
    import pymysql
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False
    logger.warning("MySQL support not available. Install PyMySQL for MySQL support.")

# Define the base class for SQLAlchemy models
Base = declarative_base()

# PlanktonUpload model for storing plankton image uploads and classification results
class PlanktonUpload(Base):
    __tablename__ = "plankton_uploads"
    
    # Unique identifier for each upload
    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True, index=True)
    file_path = Column(String(500), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow, index=True)
    location = Column(String(100), nullable=True, index=True)
    
    # Classification Results
    model_used = Column(String(100), nullable=False, index=True)
    top_class = Column(String(100), nullable=False, index=True)
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
    
# User model for authentication and feedback
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    user_type = Column(String(50), nullable=False)  # 'brin_internal' or 'external'
    organization = Column(String(255), nullable=True)  # BRIN unit or external organization
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

# Feedback model for user feedback on classification results
class Feedback(Base):
    __tablename__ = "feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, nullable=False)  # Reference to PlanktonUpload.id
    user_id = Column(Integer, nullable=False)  # Reference to User.id
    status = Column(String(20), nullable=False)  # 'sesuai' or 'belum_sesuai'
    message = Column(Text, nullable=False)
    rating = Column(Integer, nullable=True)  # 1-5 rating
    is_anonymous = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Database configuration with support for multiple database types
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./planktoscan.db")

def get_database_config():
    """Get database configuration based on DATABASE_URL"""
    db_url = DATABASE_URL.lower()
    
    if "postgresql" in db_url or "postgres" in db_url:
        if not POSTGRESQL_AVAILABLE:
            raise ImportError("PostgreSQL driver not available. Install: pip install psycopg2-binary")
        return "postgresql"
    elif "mysql" in db_url:
        if not MYSQL_AVAILABLE:
            raise ImportError("MySQL driver not available. Install: pip install PyMySQL")
        return "mysql"
    else:
        return "sqlite"

def create_database_engine():
    """Create database engine based on database type"""
    db_type = get_database_config()
    
    logger.info(f"Initializing {db_type.upper()} database...")
    
    if db_type == "sqlite":
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False},
            echo=os.getenv("SQL_DEBUG", "false").lower() == "true",
            pool_pre_ping=True
        )
    elif db_type == "postgresql":
        engine = create_engine(
            DATABASE_URL,
            echo=os.getenv("SQL_DEBUG", "false").lower() == "true",
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=3600
        )
    elif db_type == "mysql":
        # Ensure PyMySQL is used as MySQL driver
        if "mysql+pymysql" not in DATABASE_URL:
            mysql_url = DATABASE_URL.replace("mysql://", "mysql+pymysql://")
        else:
            mysql_url = DATABASE_URL
            
        engine = create_engine(
            mysql_url,
            echo=os.getenv("SQL_DEBUG", "false").lower() == "true",
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=3600
        )
    else:
        raise ValueError(f"Unsupported database type: {db_type}")
    
    return engine

# Initialize database engine and session
try:
    engine = create_database_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    logger.info(f"Database tables created successfully! Using: {get_database_config().upper()}")
    
except Exception as e:
    logger.error(f"Database connection error: {e}")
    logger.error("Check your DATABASE_URL configuration")
    logger.error("Make sure the database server is running and accessible")
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
        
        # Hide sensitive information in URL
        safe_url = DATABASE_URL
        if '@' in DATABASE_URL:
            parts = DATABASE_URL.split('@')
            if len(parts) > 1:
                # Hide password in URL for security
                user_part = parts[0].split('://')
                if len(user_part) > 1:
                    protocol = user_part[0]
                    user_info = user_part[1].split(':')[0] if ':' in user_part[1] else user_part[1]
                    safe_url = f"{protocol}://{user_info}:***@{parts[1]}"
        
        return {
            "database_url": safe_url,
            "database_type": get_database_config(),
            "engine": str(engine.url).replace(str(engine.url).split('@')[1] if '@' in str(engine.url) else '', '***') if '@' in str(engine.url) else str(engine.url),
            "tables": tables,
            "total_tables": len(tables),
            "status": "connected"
        }
    except Exception as e:
        return {
            "database_url": "hidden_for_security",
            "database_type": "unknown",
            "error": str(e),
            "status": "error"
        }