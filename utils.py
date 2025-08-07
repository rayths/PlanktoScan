import json
import os
import logging
import cv2
import uuid
import numpy as np
import tensorflow as tf
import tf_keras
from datetime import datetime
import time
import threading
import psutil
import gc
from typing import Dict, Any, Optional, Tuple

# Default preprocessing imports
from tf_keras.applications.imagenet_utils import preprocess_input

# Model-specific preprocessing imports
from tf_keras.applications.efficientnet import preprocess_input as preprocess_input_efficientnet
from tf_keras.applications.efficientnet_v2 import preprocess_input as preprocess_input_efficientnetv2
from tf_keras.applications.mobilenet import preprocess_input as preprocess_input_mobilenet
from tf_keras.applications.mobilenet_v2 import preprocess_input as preprocess_input_mobilenetv2
from tf_keras.applications.mobilenet_v3 import preprocess_input as preprocess_input_mobilenetv3
from tf_keras.applications.resnet import preprocess_input as preprocess_input_resnet
from tf_keras.applications.resnet_v2 import preprocess_input as preprocess_input_resnetv2
from tf_keras.applications.convnext import preprocess_input as preprocess_input_convnext
from tf_keras.applications.inception_v3 import preprocess_input as preprocess_input_inceptionv3
from tf_keras.applications.densenet import preprocess_input as preprocess_input_densenet

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# GLOBAL CONSTANTS AND CACHE MANAGEMENT
# ============================================================================

# Global caches for better performance
MODEL_CACHE = {}
LABELS_CACHE = None
CACHE_LOCK = threading.RLock()
MAX_CACHE_SIZE = 3  # Maximum number of models to keep in memory
MEMORY_THRESHOLD = 0.85  # 85% memory usage threshold

class ModelCacheManager:
    """Enhanced model cache manager with memory monitoring"""
    def __init__(self, max_size=3, memory_threshold=0.85):
        self.max_size = max_size
        self.memory_threshold = memory_threshold
        self.access_times = {}
        self.load_times = {}
        self.memory_usage = {}
    
    def get_memory_usage(self):
        """Get current memory usage percentage"""
        return psutil.virtual_memory().percent / 100.0
    
    def estimate_model_memory(self, model):
        """Estimate model memory usage in MB"""
        try:
            if hasattr(model, 'count_params'):
                # Keras model
                params = model.count_params()
                # Rough estimate: 4 bytes per parameter (float32) + overhead
                return (params * 4) / (1024 * 1024)  # MB
            else:
                # SavedModel - rough estimate
                return 100  # Default 100MB for SavedModel
        except:
            return 50  # Default fallback
    
    def should_evict_cache(self):
        """Check if cache should be evicted based on memory usage"""
        memory_usage = self.get_memory_usage()
        cache_size = len(MODEL_CACHE)
        
        return (memory_usage > self.memory_threshold or 
                cache_size >= self.max_size)
    
    def evict_least_recently_used(self):
        """Evict least recently used model from cache"""
        if not MODEL_CACHE:
            return
        
        # Find least recently used model
        lru_model_path = min(self.access_times.keys(), 
                           key=lambda k: self.access_times[k])
        
        logger.info(f"Evicting LRU model from cache: {lru_model_path}")
        
        # Remove from cache
        if lru_model_path in MODEL_CACHE:
            del MODEL_CACHE[lru_model_path]
        
        # Cleanup metadata
        if lru_model_path in self.access_times:
            del self.access_times[lru_model_path]
        if lru_model_path in self.load_times:
            del self.load_times[lru_model_path]
        if lru_model_path in self.memory_usage:
            del self.memory_usage[lru_model_path]
        
        # Force garbage collection
        gc.collect()
        
        logger.info(f"Model evicted. Cache size now: {len(MODEL_CACHE)}")
    
    def add_to_cache(self, model_path: str, model):
        """Add model to cache with memory management"""
        with CACHE_LOCK:
            current_time = time.time()
            
            # Check if we need to evict
            while self.should_evict_cache() and len(MODEL_CACHE) > 0:
                self.evict_least_recently_used()
            
            # Add to cache
            MODEL_CACHE[model_path] = model
            self.access_times[model_path] = current_time
            self.load_times[model_path] = current_time
            self.memory_usage[model_path] = self.estimate_model_memory(model)
            
            logger.info(f"Model added to cache: {model_path}")
            logger.info(f"Estimated memory usage: {self.memory_usage[model_path]:.1f}MB")
            logger.info(f"Current cache size: {len(MODEL_CACHE)}")
    
    def get_from_cache(self, model_path: str):
        """Get model from cache and update access time"""
        with CACHE_LOCK:
            if model_path in MODEL_CACHE:
                self.access_times[model_path] = time.time()
                logger.info(f"Model retrieved from cache: {model_path}")
                return MODEL_CACHE[model_path]
            return None
    
    def get_cache_stats(self):
        """Get detailed cache statistics"""
        memory_usage = self.get_memory_usage()
        total_model_memory = sum(self.memory_usage.values())
        
        return {
            "cached_models": len(MODEL_CACHE),
            "max_cache_size": self.max_size,
            "system_memory_usage": f"{memory_usage:.1%}",
            "estimated_model_memory_mb": f"{total_model_memory:.1f}",
            "memory_threshold": f"{self.memory_threshold:.1%}",
            "models": [
                {
                    "path": path,
                    "memory_mb": f"{self.memory_usage.get(path, 0):.1f}",
                    "last_accessed": time.ctime(self.access_times.get(path, 0)),
                    "load_time": time.ctime(self.load_times.get(path, 0))
                }
                for path in MODEL_CACHE.keys()
            ]
        }
    
# Global cache manager instance
cache_manager = ModelCacheManager(max_size=MAX_CACHE_SIZE, memory_threshold=MEMORY_THRESHOLD)

# ============================================================================
# MODEL CONFIGURATION
# ============================================================================

# Default preprocessing function (was missing)
def preprocess_input_default(x):
    """Default preprocessing function for unknown models"""
    return preprocess_input(x)

# Model preprocessing function mapping
PREPROCESSING_FUNCTIONS = {
    'EfficientNetV2B0': preprocess_input_efficientnetv2,
    'EfficientNetV1': preprocess_input_efficientnet,
    'MobileNetV2': preprocess_input_mobilenetv2,
    'MobileNetV3Small': preprocess_input_mobilenetv3,
    'MobileNetV3Large': preprocess_input_mobilenetv3,
    'MobileNet': preprocess_input_mobilenet,
    'ResNet50V2': preprocess_input_resnetv2,
    'ResNet101V2': preprocess_input_resnetv2,
    'ResNet50': preprocess_input_resnet,
    'ResNet101': preprocess_input_resnet,
    'ConvNeXtTiny': preprocess_input_convnext,
    'ConvNeXtSmall': preprocess_input_convnext,
    'InceptionV3': preprocess_input_inceptionv3,
    'DenseNet121': preprocess_input_densenet,
}

def get_model_mapping():
    """Get consistent model mapping used across the application"""
    return {
        # Transformer-based models
        "vit": ('model/classification/vit_model_plankton', "vit"),
        "bit": ('model/classification/bit_model_plankton', "bit"),
        "swin": ('model/classification/swin_model_plankton', "swin"),
        
        # CNN-based models
        "conv": ('model/classification/conv_model_plankton', "conv"),
        "regnet": ('model/classification/regnet_model_plankton', "regnet"),
        
        # Modern architectures (.keras files)
        "convnext_small": ('model/classification/ConvNeXtSmall500DataReplicated.keras', "ConvNeXtSmall"),
        "convnext_tiny": ('model/classification/ConvNeXtTiny500DataReplicated.keras', "ConvNeXtTiny"),
        "densenet121": ('model/classification/DenseNet121500DataReplicated.keras', "DenseNet121"),
        "efficientnetv2b0": ('model/classification/EfficientNetV2B0500DataReplicated.keras', "EfficientNetV2B0"),
        "inceptionv3": ('model/classification/InceptionV3500DataReplicated.keras', "InceptionV3"),
        
        # Mobile-optimized models
        "mobilenet": ('model/classification/MobileNet500DataReplicated.keras', "MobileNet"),
        "mobilenetv2": ('model/classification/MobileNetV2500DataReplicated.keras', "MobileNetV2"),
        "mobilenetv3_large": ('model/classification/MobileNetV3Large500DataReplicated.keras', "MobileNetV3Large"),
        "mobilenetv3_small": ('model/classification/MobileNetV3Small500DataReplicated.keras', "MobileNetV3Small"),
        
        # ResNet family
        "resnet50": ('model/classification/ResNet50500DataReplicated.keras', "ResNet50"),
        "resnet101": ('model/classification/ResNet101500DataReplicated.keras', "ResNet101"),
        "resnet50v2": ('model/classification/ResNet50V2500DataReplicated.keras', "ResNet50V2"),
        "resnet101v2": ('model/classification/ResNet101V2500DataReplicated.keras', "ResNet101V2"),
    }

def get_input_size(model_name):
    """Get input size for a given model based on its architecture"""
    model_name_lower = model_name.lower()
    
    # InceptionV3 requires 299x299
    if model_name_lower == "inceptionv3":
        return 299
    # All other models use 224x224
    else:
        return 224

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

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
    
def generate_uuid_28():
    """Generate UUID with 28 characters"""
    # Generate UUID and remove hyphens
    full_uuid = str(uuid.uuid4()).replace('-', '')
    # Take the first 28 characters (from 32 characters)
    return full_uuid[:28]

# ============================================================================
# CACHE MANAGEMENT PUBLIC API
# ============================================================================

def clear_model_cache():
    """Clear all models from cache"""
    global MODEL_CACHE
    with CACHE_LOCK:
        MODEL_CACHE.clear()
        cache_manager.access_times.clear()
        cache_manager.load_times.clear()
        cache_manager.memory_usage.clear()
        gc.collect()
        logger.info("Model cache cleared completely")

def get_cache_info():
    """Get information about cached models"""
    return cache_manager.get_cache_stats()
    
# ============================================================================
# INTERNAL HELPER FUNCTIONS
# ============================================================================

def _validate_image_path(img_path):
    """Validate that image path exists and is accessible"""
    try:
        if not img_path:
            raise ValueError("Image path is empty")
        
        if img_path.startswith('data:'):
            raise ValueError("Data URL detected - file not uploaded to server")
        
        if not os.path.exists(img_path):
            raise FileNotFoundError(f"Image file not found: {img_path}")
        
        if not os.path.isfile(img_path):
            raise ValueError(f"Path is not a file: {img_path}")
        
        # Check if file is readable
        with open(img_path, 'rb') as f:
            f.read(1)  # Try to read first byte
        
        return True
        
    except Exception as e:
        logger.error(f"Image path validation failed: {str(e)}")
        raise e

def _load_model_safe(model_path: str, force_reload: bool = False):
    """Load model with enhanced caching and error handling"""
    
    # Check cache first (unless force reload)
    if not force_reload:
        cached_model = cache_manager.get_from_cache(model_path)
        if cached_model is not None:
            return cached_model
    
    logger.info(f"Loading model from disk: {model_path}")
    
    # Validate model path
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
    
    start_time = time.time()
    model = None
    
    try:
        # Try loading as Keras model first
        logger.info(f"Attempting to load as Keras model: {model_path}")
        model = tf.keras.models.load_model(model_path)
        load_method = "Keras"
        
    except Exception as e1:
        logger.warning(f"Keras loading failed: {str(e1)}")
        
        try:
            # Try loading with compile=False
            logger.info(f"Attempting to load with compile=False: {model_path}")
            model = tf.keras.models.load_model(model_path, compile=False)
            load_method = "Keras (compile=False)"
            
        except Exception as e2:
            logger.warning(f"Keras compile=False failed: {str(e2)}")
            
            try:
                # Try loading as SavedModel
                logger.info(f"Attempting to load as SavedModel: {model_path}")
                model = tf.saved_model.load(model_path)
                load_method = "SavedModel"
                
            except Exception as e3:
                logger.error(f"All loading methods failed for {model_path}")
                logger.error(f"Keras error: {str(e1)}")
                logger.error(f"Keras compile=False error: {str(e2)}")
                logger.error(f"SavedModel error: {str(e3)}")
                raise e3
    
    load_time = time.time() - start_time
    
    if model is not None:
        # Add to cache using cache manager
        cache_manager.add_to_cache(model_path, model)
        
        logger.info(f"Model loaded successfully using {load_method}")
        logger.info(f"Load time: {load_time:.2f} seconds")
        
        return model
    else:
        raise RuntimeError(f"Failed to load model: {model_path}")
             
def _validate_model_functionality(model, model_path: str):
    """Validate that loaded model can perform predictions"""
    try:
        # Get input shape for the model
        model_name = os.path.basename(model_path)
        input_size = get_input_size(model_name)
        
        # Create dummy input
        dummy_input = np.random.random((1, input_size, input_size, 3)).astype(np.float32)
        
        # Test prediction
        if hasattr(model, 'predict'):
            # Keras model
            _ = model.predict(dummy_input, verbose=0)
        elif hasattr(model, 'signatures'):
            # SavedModel
            signature_key = list(model.signatures.keys())[0]
            signature = model.signatures[signature_key]
            _ = signature(tf.constant(dummy_input))
        else:
            logger.warning(f"Unknown model type for validation: {type(model)}")
            return True  # Skip validation
        
        logger.info(f"Model functionality validated: {model_path}")
        return True
        
    except Exception as e:
        logger.error(f"Model validation failed for {model_path}: {str(e)}")
        return False

def load_model_with_retry(model_path: str, max_retries: int = 3, validate: bool = True):
    """Load model with retry mechanism and validation"""
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Model loading attempt {attempt + 1}/{max_retries}: {model_path}")
            
            # Force reload on retry attempts
            force_reload = attempt > 0
            model = _load_model_safe(model_path, force_reload=force_reload)
            
            # Validate model functionality if requested
            if validate and not _validate_model_functionality(model, model_path):
                raise RuntimeError(f"Model validation failed: {model_path}")
            
            logger.info(f"Model loaded and validated successfully: {model_path}")
            return model
            
        except Exception as e:
            logger.error(f"Attempt {attempt + 1} failed: {str(e)}")
            
            if attempt < max_retries - 1:
                # Clear problematic model from cache before retry
                if model_path in MODEL_CACHE:
                    del MODEL_CACHE[model_path]
                
                wait_time = 2 ** attempt  # Exponential backoff
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                logger.error(f"All {max_retries} attempts failed for {model_path}")
                raise e

def _load_labels():
    """Load labels with caching"""
    global LABELS_CACHE
    if LABELS_CACHE is None:
        with open('model/labels.json', 'r') as label_file:
            LABELS_CACHE = json.load(label_file)
        print("Labels loaded and cached")
    return LABELS_CACHE

def _preprocess_image_optimized(img_path: str, model_name: str):
    """Optimized image preprocessing with caching"""
    
    # Get preprocessing function
    preprocess_func = PREPROCESSING_FUNCTIONS.get(model_name, preprocess_input_default)
    input_size = get_input_size(model_name)
    
    # Load and preprocess image
    image = cv2.imread(img_path)
    if image is None:
        raise ValueError(f"Unable to load image: {img_path}")
    
    # Resize image efficiently
    image = cv2.resize(image, (input_size, input_size), interpolation=cv2.INTER_LANCZOS4)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Convert to array and normalize
    image_array = np.array(image, dtype=np.float32)
    image_array = np.expand_dims(image_array, axis=0)
    
    # Apply model-specific preprocessing
    processed_image = preprocess_func(image_array)
    
    return processed_image

def _run_model_prediction_enhanced(model, processed_img, model_name: str):
    """Enhanced model prediction with better error handling"""
    
    try:
        if hasattr(model, 'predict'):
            # Keras model
            logger.debug(f"Using Keras predict method for {model_name}")
            predictions = model.predict(processed_img, verbose=0)
            
        elif hasattr(model, 'signatures'):
            # SavedModel
            logger.debug(f"Using SavedModel signature for {model_name}")
            
            # Get the serving signature
            serving_default = model.signatures.get('serving_default')
            if serving_default is None:
                # Try to get any available signature
                signature_keys = list(model.signatures.keys())
                if signature_keys:
                    serving_default = model.signatures[signature_keys[0]]
                    logger.info(f"Using signature: {signature_keys[0]}")
                else:
                    raise ValueError("No signatures found in SavedModel")
            
            # Convert to tensor and predict
            input_tensor = tf.constant(processed_img)
            
            # Get input name from signature
            input_names = list(serving_default.structured_input_signature[1].keys())
            input_name = input_names[0] if input_names else 'input_1'
            
            # Run prediction
            prediction_result = serving_default(**{input_name: input_tensor})
            
            # Extract predictions from result
            if isinstance(prediction_result, dict):
                # Get the first output
                output_key = list(prediction_result.keys())[0]
                predictions = prediction_result[output_key].numpy()
            else:
                predictions = prediction_result.numpy()
                
        else:
            raise ValueError(f"Unknown model type: {type(model)}")
        
        # Validate prediction shape
        if predictions.ndim == 2 and predictions.shape[0] == 1:
            return predictions
        elif predictions.ndim == 1:
            return predictions.reshape(1, -1)
        else:
            raise ValueError(f"Unexpected prediction shape: {predictions.shape}")
            
    except Exception as e:
        logger.error(f"Prediction failed for {model_name}: {str(e)}")
        raise e
    
def _process_prediction_results(predictions, model_name: str):
    """Process prediction results into standardized format"""
    
    # Load class names
    class_names = _load_labels()
    
    # Get top 3 predictions
    top_3_indices = np.argsort(predictions[0])[-3:][::-1]
    
    # Extract class names and probabilities
    top_classes = [str(class_names[str(i)]) for i in top_3_indices]
    top_probabilities = [float(predictions[0][i]) for i in top_3_indices]
    
    # Create result object
    result = {
        'predicted_class': top_classes[0],
        'confidence': top_probabilities[0],
        'top_3_predictions': [
            {
                'class': top_classes[i],
                'confidence': top_probabilities[i],
                'percentage': f"{top_probabilities[i]:.2%}"
            }
            for i in range(len(top_classes))
        ],
        'model_used': model_name,
        'total_classes': len(class_names)
    }
    
    # Generate response message
    result['response_message'] = f"Prediction result: {result['predicted_class']} ({result['confidence']:.2%})"
    
    return result

# ============================================================================
# MODEL PRELOADING
# ============================================================================

def preload_models_async():
    """Asynchronous model preloading with priority system"""
    logger.info("Starting asynchronous model preloading...")
    
    model_mapping = get_model_mapping()
    
    # Priority-based model loading
    priority_models = [
        ('efficientnetv2b0', 1),  # Highest priority - default model
        ('mobilenetv3_small', 2), # Medium priority
        ('resnet50', 3)           # Lower priority
    ]
    
    preload_results = {
        'success': [],
        'failed': [],
        'skipped': [],
        'total_time': 0
    }
    
    start_time = time.time()
    
    for model_name, priority in priority_models:
        if model_name not in model_mapping:
            logger.warning(f"Model {model_name} not found in mapping")
            preload_results['skipped'].append(f"{model_name} (not in mapping)")
            continue
        
        model_path, display_name = model_mapping[model_name]
        
        try:
            logger.info(f"Preloading priority {priority}: {display_name}")
            
            # Check if already in cache
            if model_path in MODEL_CACHE:
                logger.info(f"{display_name} already in cache, skipping")
                preload_results['skipped'].append(f"{display_name} (already cached)")
                continue
            
            # Check file existence
            if not os.path.exists(model_path):
                logger.error(f"Model file not found: {model_path}")
                preload_results['failed'].append(f"{display_name} (file not found)")
                continue
            
            # Check memory before loading
            memory_usage = cache_manager.get_memory_usage()
            if memory_usage > 0.8:  # 80% memory threshold for preloading
                logger.warning(f"Memory usage high ({memory_usage:.1%}), skipping {display_name}")
                preload_results['skipped'].append(f"{display_name} (memory threshold)")
                break
            
            # Load model with validation
            model_start = time.time()
            model = load_model_with_retry(model_path, max_retries=2, validate=True)
            model_time = time.time() - model_start
            
            if model is not None:
                preload_results['success'].append({
                    'name': display_name,
                    'path': model_path,
                    'load_time': f"{model_time:.2f}s",
                    'priority': priority
                })
                logger.info(f"{display_name} preloaded successfully in {model_time:.2f}s")
            else:
                preload_results['failed'].append(f"{display_name} (load returned None)")
                
        except Exception as e:
            logger.error(f"Error preloading {display_name}: {str(e)}")
            preload_results['failed'].append(f"{display_name} ({str(e)})")
    
    total_time = time.time() - start_time
    preload_results['total_time'] = f"{total_time:.2f}s"
    
    # Log summary
    success_count = len(preload_results['success'])
    failed_count = len(preload_results['failed'])
    skipped_count = len(preload_results['skipped'])
    
    logger.info(f"Preloading completed in {total_time:.2f}s")
    logger.info(f"Results: {success_count} success, {failed_count} failed, {skipped_count} skipped")
    
    if preload_results['success']:
        logger.info("Successfully preloaded models:")
        for model_info in preload_results['success']:
            logger.info(f"  - {model_info['name']} ({model_info['load_time']})")
    
    if preload_results['failed']:
        logger.warning("Failed to preload models:")
        for failed_model in preload_results['failed']:
            logger.warning(f"  - {failed_model}")
    
    return preload_results

# ============================================================================
# MAIN PREDICTION API
# ============================================================================

def predict_img(model_option: str, img_path: str, use_cache: bool = True):
    """Enhanced prediction function with caching and optimization"""
    prediction_start_time = time.time()
    
    try:
        logger.info(f"Starting enhanced prediction with model: {model_option}")
        logger.info(f"Image path: {img_path}")
        logger.info(f"Use cache: {use_cache}")
        
        # Validate inputs
        _validate_image_path(img_path)
        
        # Load model mapping
        model_mapping = get_model_mapping()
        
        if model_option not in model_mapping:
            available_models = list(model_mapping.keys())
            raise ValueError(f"Model '{model_option}' is not available. Available models are: {available_models}")
        
        model_path, model_name = model_mapping[model_option]
        
        # Enhanced model loading with caching
        model_load_start = time.time()
        
        if use_cache:
            # Try to get from cache first
            model = cache_manager.get_from_cache(model_path)
            if model is None:
                logger.info(f"Model not in cache, loading: {model_path}")
                model = load_model_with_retry(model_path, max_retries=2, validate=False)
            else:
                logger.info(f"Model retrieved from cache: {model_path}")
        else:
            logger.info(f"Cache disabled, loading fresh model: {model_path}")
            model = load_model_with_retry(model_path, max_retries=2, validate=False)
        
        model_load_time = time.time() - model_load_start
        logger.info(f"Model load time: {model_load_time:.3f}s")
        
        if model is None:
            raise RuntimeError(f"Failed to load model: {model_path}")
        
        # Image preprocessing
        preprocess_start = time.time()
        processed_img = _preprocess_image_optimized(img_path, model_name)
        preprocess_time = time.time() - preprocess_start
        logger.info(f"Image preprocessing time: {preprocess_time:.3f}s")
        
        # Model prediction
        prediction_start = time.time()
        predictions = _run_model_prediction_enhanced(model, processed_img, model_name)
        prediction_time = time.time() - prediction_start
        logger.info(f"Model prediction time: {prediction_time:.3f}s")
        
        # Validate predictions
        if predictions is None or len(predictions) == 0:
            raise RuntimeError("Model tidak menghasilkan prediksi yang valid")
        
        # Process results
        result_start = time.time()
        result = _process_prediction_results(predictions, model_name)
        result_time = time.time() - result_start
        logger.info(f"Result processing time: {result_time:.3f}s")
        
        total_time = time.time() - prediction_start_time
        
        # Add timing information to result
        result['performance_metrics'] = {
            'total_time': f"{total_time:.3f}s",
            'model_load_time': f"{model_load_time:.3f}s",
            'preprocessing_time': f"{preprocess_time:.3f}s",
            'prediction_time': f"{prediction_time:.3f}s",
            'result_processing_time': f"{result_time:.3f}s",
            'cache_hit': model_path in MODEL_CACHE
        }
        
        logger.info(f"Prediction completed successfully in {total_time:.3f}s")
        logger.info(f"Result: {result['predicted_class']} ({result['confidence']:.2%})")
        
        return result
        
    except Exception as e:
        total_time = time.time() - prediction_start_time
        logger.error(f"Prediction failed after {total_time:.3f}s: {str(e)}")
        raise e