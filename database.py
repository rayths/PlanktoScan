import os
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from firebase_admin import credentials, firestore, initialize_app, auth
from google.cloud.firestore_v1.base_query import FieldFilter
import firebase_admin
from enum import Enum

from utils import convert_numpy_types, generate_uuid_28

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Firebase configuration
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
    
# Initialize Firebase Admin SDK
def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        if not firebase_admin._apps:
            # Get credentials path from environment  
            cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json")
            
            if not os.path.exists(cred_path):
                raise FileNotFoundError(f"Firebase credentials file not found: {cred_path}")
                
            # Initialize with service account
            cred = credentials.Certificate(cred_path)
            initialize_app(cred, {
                'projectId': FIREBASE_PROJECT_ID,
            })
            logger.info("Firebase Admin SDK initialized successfully")
        else:
            logger.info("Firebase Admin SDK already initialized")
        
        return firestore.client()
    except Exception as e:
        logger.error(f"Firebase initialization failed: {e}")
        raise e

# Initialize Firestore client
db = initialize_firebase()

# Enums for user roles
class UserRole(Enum):
    """User roles"""
    GUEST = "Guest"
    BASIC = "Basic"
    EXPERT = "Expert"
    ADMIN = "Admin"

    @classmethod
    def from_string(cls, role_str: str) -> 'UserRole':
        """Convert string to UserRole enum"""
        role_map = {
            "Guest": cls.GUEST,
            "Basic": cls.BASIC,
            "Expert": cls.EXPERT,
            "Admin": cls.ADMIN
        }
        return role_map.get(role_str, cls.GUEST)

# Data models
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
                role=UserRole.from_string(data.get("role", "Guest")),
                created_at=data.get("createdAt"),
                last_login_at=data.get("lastLoginAt"),
                is_email_verified=data.get("isEmailVerified", False),
                organization=data.get("organization")
            )
        except Exception as e:
            logger.error(f"Error creating AppUser from dict: {e}")
            return None

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
    location: Optional[str] = None
    second_class: Optional[str] = None
    second_confidence: Optional[float] = None
    third_class: Optional[str] = None
    third_confidence: Optional[float] = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

        # Convert numpy types to Python native types
        self.confidence = convert_numpy_types(self.confidence)
        if self.second_confidence is not None:
            self.second_confidence = convert_numpy_types(self.second_confidence)
        if self.third_confidence is not None:
            self.third_confidence = convert_numpy_types(self.third_confidence)

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
            "location": self.location,
            "secondClass": self.second_class,
            "secondConfidence": convert_numpy_types(self.second_confidence) if self.second_confidence is not None else None,
            "thirdClass": self.third_class,
            "thirdConfidence": convert_numpy_types(self.third_confidence) if self.third_confidence is not None else None,
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
                location=data.get("location"),
                second_class=data.get("secondClass"),
                second_confidence=float(data.get("secondConfidence")) if data.get("secondConfidence") is not None else None,
                third_class=data.get("thirdClass"),
                third_confidence=float(data.get("thirdConfidence")) if data.get("thirdConfidence") is not None else None,
            )
        except Exception as e:
            logger.error(f"Error creating ClassificationEntry from dict: {e}")
            return None

# Database operations
class FirestoreDB:
    """Firestore database operations"""
    def __init__(self):
        """Initialize Firestore client"""
        try:
            # Initialize Firebase using the dedicated function
            self.db = initialize_firebase()
            
            # Collections
            self.users_collection = self.db.collection('users')
            self.classifications_collection = self.db.collection('classifications')
            
            logger.info("Firestore database connection established")
            
        except Exception as e:
            logger.error(f"Failed to initialize Firestore: {str(e)}")
            raise

    def verify_firebase_token(self, id_token: str) -> Optional[Dict[str, Any]]:
        """Verify Firebase ID token and return user claims"""
        try:
            # Decode dan verify token menggunakan Firebase Admin
            decoded_token = auth.verify_id_token(id_token)
            
            # Get user info from Firebase Auth to get latest profile data
            firebase_user = auth.get_user(decoded_token['uid'])
            
            user_info = {
                'uid': decoded_token['uid'],
                'email': decoded_token.get('email'),
                'email_verified': decoded_token.get('email_verified', False),
                'name': decoded_token.get('name') or firebase_user.display_name,
                'display_name': firebase_user.display_name,
                'picture': decoded_token.get('picture') or firebase_user.photo_url,
                'provider': decoded_token.get('firebase', {}).get('sign_in_provider')
            }
            
            logger.info(f"Firebase token verified for user: {user_info['uid']}")
            logger.info(f"Display name from token: {decoded_token.get('name')}")
            logger.info(f"Display name from user record: {firebase_user.display_name}")
            return user_info
            
        except auth.InvalidIdTokenError:
            logger.error("Invalid Firebase ID token")
            return None
        except auth.ExpiredIdTokenError:
            logger.error("Expired Firebase ID token")
            return None
        except Exception as e:
            logger.error(f"Error verifying Firebase token: {str(e)}")
            return None
    
    def authenticate_with_firebase(self, id_token: str) -> Optional['AppUser']:
        """Authenticate user using Firebase ID token"""
        try:
            logger.info("Starting Firebase authentication...")
            firebase_user_info = self.verify_firebase_token(id_token)
            
            if not firebase_user_info:
                logger.error("Firebase token verification failed")
                return None
            
            logger.info(f"Token verified successfully for UID: {firebase_user_info['uid']}")
            user = self._get_or_create_user_from_firebase(firebase_user_info)
            
            if user:
                logger.info(f"Firebase authentication successful for user: {firebase_user_info.get('uid')}")
            else:
                logger.error(f"Failed to get or create user for UID: {firebase_user_info['uid']}")
            
            return user
            
        except Exception as e:
            logger.error(f"Firebase authentication error: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return None
        
    def _get_or_create_user_from_firebase(self, firebase_user_info: Dict[str, Any]) -> Optional['AppUser']:
        """Get existing user or create new user from Firebase auth info
        Note: user.uid stores the Firebase UID directly"""
        try:
            firebase_uid = firebase_user_info['uid']
            email = firebase_user_info['email']
            
            logger.info(f"Looking for existing user with UID: {firebase_uid}")
            
            # Try to find user by Firebase UID (stored in uid field)
            user = self.get_user_by_uid(firebase_uid)
            
            if not user and email:
                logger.info(f"User not found by UID, searching by email: {email}")
                # Try to find by email (for existing users)
                user = self._get_user_by_email(email)
                
                if user:
                    logger.info(f"Found existing user by email, updating Firebase UID")
                    # Update existing user with Firebase UID
                    user_ref = self.users_collection.document(user.uid)
                    user_ref.update({
                        'lastLoginAt': datetime.utcnow()
                    })
                    # Note: UID already contains Firebase UID, no need to update
            
            if not user:
                logger.info(f"Creating new user for Firebase UID: {firebase_uid}")
                # Create new user from Firebase auth
                user = self._create_user_from_firebase(firebase_user_info)
            else:
                logger.info(f"Updating last login for existing user: {user.uid}")
                # Update last login
                self._update_user_last_login(user.uid)
            
            return user
            
        except Exception as e:
            logger.error(f"Error getting/creating user from Firebase: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return None
    
    def _create_user_from_firebase(self, firebase_user_info: Dict[str, Any]) -> Optional['AppUser']:
        """Create new user from Firebase authentication info
        Note: user.uid will store the Firebase UID directly"""
        try:
            firebase_uid = firebase_user_info['uid']
            email = firebase_user_info['email']
            
            # Get display name from Firebase token data
            # Firebase token can have 'name' field containing display name
            display_name = (firebase_user_info.get('name') or 
                          firebase_user_info.get('display_name') or 
                          (email.split('@')[0] if email else 'Unknown'))
            
            logger.info(f"Creating user - UID: {firebase_uid}, email: {email}, display_name: {display_name}")
            logger.info(f"Firebase user info keys: {list(firebase_user_info.keys())}")
            
            # Default role is Basic
            role = UserRole.BASIC
            organization = 'External User'
            
            # Check if email is BRIN staff
            if email and email.endswith('@brin.go.id'):
                role = UserRole.EXPERT
                organization = 'BRIN (Badan Riset dan Inovasi Nasional)'
                logger.info(f"User has BRIN email, setting Expert role")
            
            # Create AppUser object - uid akan menjadi Firebase UID
            user = AppUser(
                uid=firebase_uid,
                email=email,
                display_name=display_name,
                role=role,
                organization=organization,
                created_at=datetime.utcnow(),
                last_login_at=datetime.utcnow()
            )
            
            logger.info(f"Saving user to Firestore...")
            # Save to Firestore
            saved_user = self.save_user(user)
            logger.info(f"Created new user from Firebase: {firebase_uid}")
            
            return saved_user
            
        except Exception as e:
            logger.error(f"Error creating user from Firebase: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return None
    
    # User Management Methods
    def get_user_by_uid(self, uid: str) -> Optional['AppUser']:
        """Get user by UID """
        try:
            doc = self.users_collection.document(uid).get()
            if doc.exists:
                return AppUser.from_dict(doc.to_dict())
            return None
        except Exception as e:
            logger.error(f"Error getting user {uid}: {e}")
            return None
        
    def _get_user_by_email(self, email: str) -> Optional['AppUser']:
        """Get user by email address"""
        try:
            users_query = self.users_collection.where('email', '==', email).limit(1)
            docs = users_query.stream()
            
            for doc in docs:
                user_data = doc.to_dict()
                user_data['uid'] = doc.id
                return AppUser.from_dict(user_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by email: {str(e)}")
            return None

    def _update_user_last_login(self, user_uid: str):
        """Update user's last login timestamp"""
        try:
            user_ref = self.users_collection.document(user_uid)
            user_ref.update({
                'lastLoginAt': datetime.utcnow()
            })
            logger.info(f"Updated last login for user: {user_uid}")
            
        except Exception as e:
            logger.error(f"Error updating last login: {str(e)}")

    def save_user(self, user: AppUser) -> AppUser:
        """Save or update user"""
        try:
            doc_ref = self.users_collection.document(user.uid)
            doc_ref.set(user.to_dict(), merge=True)
            logger.info(f"User saved: {user.uid}")
            return user
        except Exception as e:
            logger.error(f"Error saving user: {e}")
            raise e
        
    # Classification Management Methods
    def save_classification_to_database(self, entry: ClassificationEntry) -> str:
        """Save classification result to database"""
        try:
            doc_ref = self.classifications_collection.document(entry.id)
            doc_ref.set(entry.to_dict())
            
            logger.info(f"Classification saved to database: {entry.id} for user: {entry.user_id}")
            return entry.id
        except Exception as e:
            logger.error(f"Failed to save classification to database: {e}")
            raise e

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

    def update_classification_in_database(self, entry: ClassificationEntry, updated_by: str) -> bool:
        """Update classification result in database (for expert feedback)"""
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

    # Data Retrieval Methods for Admin/History
    def get_all_classifications_from_database(self, user_role: UserRole = None) -> List[Dict[str, Any]]:
        """Get all classification logs from database (only for admin)"""
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
        """Get classification logs by user ID"""
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

    # Admin Export Methods
    def export_all_classifications_to_csv(self, user_role: UserRole = None) -> str:
        """Export all classification data to CSV format (for admin)"""
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

    def get_classification_stats(self) -> Dict[str, Any]:
        """Get classification statistics"""
        try:
            # Get recent classifications for stats
            docs = self.classifications_collection\
                      .order_by("createdAt", direction=firestore.Query.DESCENDING)\
                      .limit(1000)\
                      .stream()
            
            classifications = [ClassificationEntry.from_dict(doc.to_dict(), doc.id) 
                             for doc in docs 
                             if ClassificationEntry.from_dict(doc.to_dict(), doc.id)]
            
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

# Helper functions for creating users
def create_guest_user(uid: str = None, email: str = None) -> AppUser:
    """Create a guest user"""
    return AppUser(
        uid=uid or f"guest_{int(datetime.utcnow().timestamp())}",
        email=email or f"guest_{uid}@temp.local",
        display_name="Guest User",
        role=UserRole.GUEST,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow(),
        is_email_verified=False
    )

def create_basic_user(uid: str, email: str, display_name: str = None, password_hash: str = None, organization: str = None) -> AppUser:
    """Create a basic user (for compatibility)"""
    return AppUser(
        uid=uid,
        email=email,
        display_name=display_name or email.split('@')[0],
        role=UserRole.BASIC,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow(),
        is_email_verified=True,
        organization=organization
    )

def create_expert_user(uid: str, email: str, display_name: str = None, password_hash: str = None) -> AppUser:
    """Create an expert user (for compatibility)"""
    return AppUser(
        uid=uid,
        email=email,
        display_name=display_name or email.split('@')[0],
        role=UserRole.EXPERT,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow(),
        is_email_verified=True
    )

def create_admin_user(uid: str, email: str, display_name: str = None) -> AppUser:
    """Create an admin user (for compatibility)"""
    return AppUser(
        uid=uid,
        email=email,
        display_name=display_name or "Administrator",
        role=UserRole.ADMIN,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow(),
        is_email_verified=True
    )

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
    """Initialize Firestore (connection test)"""
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
    
class SecurityError(Exception):
    """Custom exception for security-related errors"""
    pass