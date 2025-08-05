import os
import json
import logging
import numpy as np
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass, asdict
from firebase_admin import credentials, firestore, initialize_app
import firebase_admin
from enum import Enum

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Firebase configuration
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")

# Convert numpy types to Python native types
def convert_numpy_types(obj):
    """Convert numpy types to Python native types for Firestore compatibility"""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_numpy_types(item) for item in obj)
    else:
        return obj
    
# Initialize Firebase Admin SDK
def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        if not firebase_admin._apps:
            if os.path.exists(FIREBASE_CREDENTIALS_PATH):
                cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
                initialize_app(cred, {
                    'projectId': FIREBASE_PROJECT_ID,
                })
                logger.info("Firebase initialized with service account file")
            else:
                # For production deployment
                initialize_app()
                logger.info("Firebase initialized with default credentials")
        
        return firestore.client()
    except Exception as e:
        logger.error(f"Firebase initialization failed: {e}")
        raise e

# Initialize Firestore client
db = initialize_firebase()

# Enums for user roles
class UserRole(Enum):
    """User roles"""
    GUEST = "guest"
    BASIC = "basic"
    EXPERT = "expert"
    ADMIN = "admin"
    
    @classmethod
    def from_string(cls, role_str: str) -> 'UserRole':
        """Convert string to UserRole enum"""
        role_map = {
            "guest": cls.GUEST,
            "basic": cls.BASIC,
            "expert": cls.EXPERT,
            "admin": cls.ADMIN
        }
        return role_map.get(role_str.lower(), cls.GUEST)
    
# Data models
@dataclass
@dataclass
class AppUser:
    """Model for application users"""
    uid: str
    email: Optional[str]
    display_name: Optional[str] 
    role: UserRole = UserRole.GUEST
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    is_email_verified: bool = False
    password_hash: Optional[str] = None
    organization: Optional[str] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.last_login_at is None:
            self.last_login_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Firestore"""
        return {
            "uid": self.uid,
            "email": self.email,
            "displayName": self.display_name,
            "role": self.role.value,
            "createdAt": self.created_at,
            "lastLoginAt": self.last_login_at,
            "isEmailVerified": self.is_email_verified,
            "passwordHash": self.password_hash,
            "organization": self.organization
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Optional['AppUser']:
        """Create instance from Firestore document"""
        try:
            return cls(
                uid=data.get("uid"),
                email=data.get("email"),
                display_name=data.get("displayName"),
                role=UserRole.from_string(data.get("role", "guest")),
                created_at=data.get("createdAt"),
                last_login_at=data.get("lastLoginAt"),
                is_email_verified=data.get("isEmailVerified", False),
                password_hash=data.get("passwordHash"),
                organization=data.get("organization")
            )
        except Exception as e:
            logger.error(f"Error creating AppUser from dict: {e}")
            return None
    
    def get_user_role(self) -> UserRole:
        """Get the user's role"""
        return self.role

@dataclass
class ClassificationEntry:
    """Model for classification results"""
    id: str
    user_id: str
    user_role: str
    image_path: str
    classification_result: str
    confidence: float
    model_used: str
    timestamp: datetime
    user_feedback: Optional[str] = None
    is_correct: Optional[bool] = None
    correct_class: Optional[str] = None
    is_updated: bool = False
    updated_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Additional fields for web app compatibility
    location: Optional[str] = None
    second_class: Optional[str] = None
    second_probability: Optional[float] = None
    third_class: Optional[str] = None
    third_probability: Optional[float] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

        # Convert numpy types to Python native types
        self.confidence = convert_numpy_types(self.confidence)
        self.second_probability = convert_numpy_types(self.second_probability) if self.second_probability is not None else None
        self.third_probability = convert_numpy_types(self.third_probability) if self.third_probability is not None else None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Firestore"""
        data = {
            "id": self.id,
            "userId": self.user_id,
            "userRole": self.user_role,
            "imagePath": self.image_path,
            "classificationResult": self.classification_result,
            "confidence": convert_numpy_types(self.confidence),
            "modelUsed": self.model_used,
            "timestamp": self.timestamp,
            "userFeedback": self.user_feedback,
            "isCorrect": self.is_correct,
            "correctClass": self.correct_class,
            "isUpdated": self.is_updated,
            "updatedBy": self.updated_by,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            
            # Web app specific fields
            "location": self.location,
            "secondClass": self.second_class,
            "secondProbability": convert_numpy_types(self.second_probability) if self.second_probability is not None else None,
            "thirdClass": self.third_class,
            "thirdProbability": convert_numpy_types(self.third_probability) if self.third_probability is not None else None,
        }
            
        # Convert entire dict to ensure no numpy types remain
        return convert_numpy_types(data)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any], doc_id: str = None) -> Optional['ClassificationEntry']:
        """Create instance from Firestore document"""
        try:
            return cls(
                id=data.get("id", doc_id),
                user_id=data.get("userId"),
                user_role=data.get("userRole"),
                image_path=data.get("imagePath"),
                classification_result=data.get("classificationResult"),
                confidence=float(data.get("confidence", 0.0)),
                model_used=data.get("modelUsed"),
                timestamp=data.get("timestamp"),
                user_feedback=data.get("userFeedback"),
                is_correct=data.get("isCorrect"),
                correct_class=data.get("correctClass"),
                is_updated=data.get("isUpdated", False),
                updated_by=data.get("updatedBy"),
                created_at=data.get("createdAt"),
                updated_at=data.get("updatedAt"),
                
                # Web app specific fields
                location=data.get("location"),
                second_class=data.get("secondClass"),
                second_probability=float(data.get("secondProbability")),
                third_class=data.get("thirdClass"),
                third_probability=float(data.get("thirdProbability")),
            )
        except Exception as e:
            logger.error(f"Error creating ClassificationEntry from dict: {e}")
            return None

# Database operations
class FirestoreDB:
    """Firestore database operations"""

    def __init__(self):
        self.db = db
        self.classifications_collection = self.db.collection("classifications")
        self.users_collection = self.db.collection("users")
    
    # User operations
    def save_user(self, user: AppUser) -> AppUser:
        """Save or update user"""
        try:
            # Use UID as document ID to match Android app
            doc_ref = self.users_collection.document(user.uid)
            doc_ref.set(user.to_dict(), merge=True)
            logger.info(f"User saved: {user.uid}")
            return user
        except Exception as e:
            logger.error(f"Error saving user: {e}")
            raise e
    
    def get_user_by_uid(self, uid: str) -> Optional[AppUser]:
        """Get user by UID"""
        try:
            doc = self.users_collection.document(uid).get()
            if doc.exists:
                return AppUser.from_dict(doc.to_dict())
            return None
        except Exception as e:
            logger.error(f"Error getting user {uid}: {e}")
            return None
    
    def get_user_by_email(self, email: str) -> Optional[AppUser]:
        """Get user by email"""
        try:
            docs = self.users_collection.where('email', '==', email).limit(1).stream()
            for doc in docs:
                return AppUser.from_dict(doc.to_dict())
            return None
        except Exception as e:
            logger.error(f"Error getting user by email: {e}")
            return None
    
    def update_user_last_login(self, uid: str) -> bool:
        """Update user's last login timestamp"""
        try:
            doc_ref = self.users_collection.document(uid)
            doc_ref.update({"lastLoginAt": datetime.utcnow()})
            return True
        except Exception as e:
            logger.error(f"Error updating last login for {uid}: {e}")
            return False
    
    # Classification operations matching Android DatabaseService
    def save_classification_to_database(self, entry: ClassificationEntry) -> str:
        """ Save classification result to database """
        try:
            # Use entry ID as document ID to match Android app
            doc_ref = self.classifications_collection.document(entry.id)
            doc_ref.set(entry.to_dict())
            
            logger.info(f"Classification saved to database: {entry.id} for user: {entry.user_id}")
            return entry.id
        except Exception as e:
            logger.error(f"Failed to save classification to database: {e}")
            raise e
    
    def update_classification_in_database(self, entry: ClassificationEntry, updated_by: str) -> bool:
        """ Update classification result in database (for expert feedback) """
        try:
            update_data = {
                "userFeedback": entry.user_feedback,
                "isCorrect": entry.is_correct,
                "correctClass": entry.correct_class,
                "isUpdated": True,
                "updatedBy": updated_by,
                "updatedAt": datetime.utcnow()
            }
            
            doc_ref = self.classifications_collection.document(entry.id)
            doc_ref.update(update_data)
            
            logger.info(f"Classification updated in database: {entry.id}")
            return True
        except Exception as e:
            logger.error(f"Failed to update classification in database: {e}")
            return False
    
    def get_all_classifications_from_database(self, user_role: UserRole = None) -> List[Dict[str, Any]]:
        """ Get all classification logs from database (only for admin) """
        try:
            # Security check - only admin can access all classifications
            if user_role and user_role != UserRole.ADMIN:
                raise SecurityError("Only admin can access all classifications")
            
            docs = self.classifications_collection.order_by("createdAt", direction=firestore.Query.DESCENDING).stream()
            
            classifications = []
            for doc in docs:
                data = doc.to_dict()
                data["documentId"] = doc.id
                classifications.append(data)
            
            logger.info(f"Retrieved {len(classifications)} classifications from database")
            return classifications
        except Exception as e:
            logger.error(f"Failed to get all classifications from database: {e}")
            return []
    
    def get_classifications_by_user_id(self, user_id: str) -> List[Dict[str, Any]]:
        """ Get classification logs by user ID """
        try:
            docs = self.classifications_collection\
                      .where("userId", "==", user_id)\
                      .order_by("createdAt", direction=firestore.Query.DESCENDING)\
                      .stream()
            
            classifications = []
            for doc in docs:
                data = doc.to_dict()
                data["documentId"] = doc.id
                classifications.append(data)
            
            logger.info(f"Retrieved {len(classifications)} classifications for user: {user_id}")
            return classifications
        except Exception as e:
            logger.error(f"Failed to get classifications for user: {user_id}: {e}")
            return []
    
    def get_classification_by_id(self, classification_id: str) -> Optional[ClassificationEntry]:
        """Get single classification by ID"""
        try:
            doc = self.classifications_collection.document(classification_id).get()
            if doc.exists:
                return ClassificationEntry.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            logger.error(f"Error getting classification {classification_id}: {e}")
            return None
    
    def export_all_classifications_to_csv(self, user_role: UserRole = None) -> str:
        """ Export all classification data to CSV format (for admin) """
        try:
            classifications = self.get_all_classifications_from_database(user_role)
            
            csv_lines = [
                "ID,User ID,User Role,Image Path,Classification Result,Confidence,Model Used,Timestamp,User Feedback,Is Correct,Correct Class,Is Updated,Updated By,Created At,Updated At"
            ]
            
            for classification in classifications:
                line = f"\"{classification.get('id', '')}\",\"{classification.get('userId', '')}\",\"{classification.get('userRole', '')}\",\"{classification.get('imagePath', '')}\",\"{classification.get('classificationResult', '')}\",\"{classification.get('confidence', '')}\",\"{classification.get('modelUsed', '')}\",\"{classification.get('timestamp', '')}\",\"{classification.get('userFeedback', '')}\",\"{classification.get('isCorrect', '')}\",\"{classification.get('correctClass', '')}\",\"{classification.get('isUpdated', False)}\",\"{classification.get('updatedBy', '')}\",\"{classification.get('createdAt', '')}\",\"{classification.get('updatedAt', '')}\""
                csv_lines.append(line)
            
            csv_content = "\n".join(csv_lines)
            logger.info(f"Generated CSV export with {len(classifications)} records")
            return csv_content
        except Exception as e:
            logger.error(f"Failed to export classifications to CSV: {e}")
            raise e
    
    # Additional methods for web app compatibility
    def get_recent_classifications(self, limit: int = 10) -> List[ClassificationEntry]:
        """Get recent classifications"""
        try:
            docs = self.classifications_collection\
                      .order_by("createdAt", direction=firestore.Query.DESCENDING)\
                      .limit(limit)\
                      .stream()
            
            return [ClassificationEntry.from_dict(doc.to_dict(), doc.id) for doc in docs if ClassificationEntry.from_dict(doc.to_dict(), doc.id)]
        except Exception as e:
            logger.error(f"Error getting recent classifications: {e}")
            return []
    
    def get_classifications_by_ip(self, user_ip: str, limit: int = 50) -> List[ClassificationEntry]:
        """Get classifications by user IP (for web app)"""
        try:
            docs = self.classifications_collection\
                      .where("userIp", "==", user_ip)\
                      .order_by("createdAt", direction=firestore.Query.DESCENDING)\
                      .limit(limit)\
                      .stream()
            
            return [ClassificationEntry.from_dict(doc.to_dict(), doc.id) for doc in docs if ClassificationEntry.from_dict(doc.to_dict(), doc.id)]
        except Exception as e:
            logger.error(f"Error getting classifications by IP: {e}")
            return []
    
    def count_classifications(self) -> int:
        """Count total classifications"""
        try:
            docs = list(self.classifications_collection.stream())
            return len(docs)
        except Exception as e:
            logger.error(f"Error counting classifications: {e}")
            return 0
    
    def get_classification_stats(self) -> Dict[str, Any]:
        """Get classification statistics"""
        try:
            classifications = self.get_recent_classifications(1000)  # Get last 1000 for stats
            
            class_counts = {}
            user_role_counts = {}
            model_counts = {}
            
            for classification in classifications:
                # Count classifications
                class_name = classification.classification_result
                class_counts[class_name] = class_counts.get(class_name, 0) + 1
                
                # Count by user role
                user_role = classification.user_role
                user_role_counts[user_role] = user_role_counts.get(user_role, 0) + 1
                
                # Count by model used
                model = classification.model_used
                model_counts[model] = model_counts.get(model, 0) + 1
            
            return {
                "total_classifications": len(classifications),
                "class_distribution": dict(sorted(class_counts.items(), key=lambda x: x[1], reverse=True)),
                "user_role_distribution": user_role_counts,
                "model_usage": model_counts
            }
        except Exception as e:
            logger.error(f"Error getting classification stats: {e}")
            return {}

# Initialize database instance
firestore_db = FirestoreDB()

# Dependency function for FastAPI
def get_db():
    """Get Firestore database instance"""
    return firestore_db

def get_database_info():
    """Get database information"""
    try:
        project_id = db._client.project
        return {
            "database_type": "Firestore",
            "project_id": project_id,
            "collections": ["classifications", "users"],
            "status": "connected"
        }
    except Exception as e:
        return {
            "database_type": "Firestore",
            "error": str(e),
            "status": "error"
        }

def init_database():
    """Initialize Firestore (no setup needed)"""
    try:
        # Test connection
        test_ref = db.collection('test').document('connection_test')
        test_ref.set({'timestamp': datetime.utcnow()})
        test_ref.delete()
        logger.info("Firestore connection test successful!")
        return True
    except Exception as e:
        logger.error(f"Firestore connection test failed: {e}")
        return False

# Helper functions for creating users
def create_guest_user(uid: str = None, email: str = None) -> AppUser:
    """Create a guest user"""
    return AppUser(
        uid=uid,
        email=email or f"guest_{uid}@temp.local",
        display_name="Guest User",
        role=UserRole.GUEST,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow(),
        is_email_verified=False
    )

def create_basic_user(uid: str, email: str, display_name: str = None, password_hash: str = None, organization: str = None) -> AppUser:
    """Create a basic user"""
    return AppUser(
        uid=uid,
        email=email,
        display_name=display_name or email.split('@')[0],
        role=UserRole.BASIC,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow(),
        is_email_verified=True,
        password_hash=password_hash,
        organization=organization
    )

def create_expert_user(uid: str, email: str, display_name: str = None, password_hash: str = None) -> AppUser:
    """Create an expert user"""
    return AppUser(
        uid=uid,
        email=email,
        display_name=display_name or email.split('@')[0],
        role=UserRole.EXPERT,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow(),
        is_email_verified=True,
        password_hash=password_hash
    )

def create_admin_user(uid: str, email: str) -> AppUser:
    """Create an admin user"""
    return AppUser(
        uid=uid,
        email=email,
        display_name="Administrator",
        role=UserRole.ADMIN,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow(),
        is_email_verified=True
    )

# Security exception class
class SecurityError(Exception):
    """Custom exception for security-related errors"""
    pass