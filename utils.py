import json
import os
import logging
import cv2
import numpy as np
import tensorflow as tf
import tf_keras
import string
import secrets
from datetime import datetime
from PIL import Image
import os

from tensorflow import image as tfi
from tf_keras.preprocessing.image import load_img, img_to_array
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

# ============================================================================
# GLOBAL CONFIGURATION
# ============================================================================

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global caches for better performance
MODEL_CACHE = {}
LABELS_CACHE = None

# Model preprocessing function mapping
PREPROCESS_FUNCTIONS = {
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

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def clean_text(text):
    """Clean and normalize text by removing special characters"""
    text = text.replace("*", "")
    text = text.replace("#", "")
    text = text.replace("```", "")
    text = text.replace("_", "")
    text = text.rstrip()
    text = " ".join(text.split())
    return text

# ============================================================================
# MODEL CONFIGURATION
# ============================================================================

def load_and_preprocess_image(img_input, target_size=(224, 224), preprocessing_fn=None):
    """Load and preprocess image for model prediction"""
    try:
        if isinstance(img_input, np.ndarray):
            # If input is already an array, just resize
            img = cv2.resize(img_input, target_size)
            img_array = np.expand_dims(img, axis=0)
        else:
            # If input is a file path
            if not os.path.exists(img_input):
                raise FileNotFoundError(f"Image file not found: {img_input}")
            
            img = load_img(img_input, target_size=target_size)
            img_array = img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
        
        if preprocessing_fn:
            img_array = preprocessing_fn(img_array)
        
        return img_array
    except Exception as e:
        logger.error(f"Error in load_and_preprocess_image: {str(e)}")
        raise e

# ============================================================================
# CACHE MANAGEMENT
# ============================================================================

def clear_model_cache():
    """Clear model cache to free memory"""
    global MODEL_CACHE
    MODEL_CACHE.clear()
    logger.info("Model cache cleared")

def get_cache_info():
    """Get information about cached models"""
    return {
        "cached_models": list(MODEL_CACHE.keys()),
        "cache_size": len(MODEL_CACHE),
        "labels_cached": LABELS_CACHE is not None
    }

# ============================================================================
# MODEL LOADING AND MANAGEMENT
# ============================================================================

def get_input_size(model_name):
    """Mengembalikan ukuran input yang sesuai untuk setiap model"""
    if "efficientnet" in model_name.lower():
        return (224, 224)  # EfficientNetV2B0
    elif "inception" in model_name.lower():
        return (299, 299)  # InceptionV3
    elif "mobilenet" in model_name.lower():
        return (224, 224)  # MobileNet series
    elif "resnet" in model_name.lower():
        return (224, 224)  # ResNet series
    elif "densenet" in model_name.lower():
        return (224, 224)  # DenseNet
    elif "convnext" in model_name.lower():
        return (224, 224)  # ConvNeXt
    else:
        return (224, 224)  # Default size

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

# ============================================================================
# IMAGE PROCESSING FUNCTIONS
# ============================================================================

def load_model_safe(model_path):
    """Load model dengan caching"""
    # Check cache first
    if model_path in MODEL_CACHE:
        logger.info(f"Loading model from cache: {model_path}")
        return MODEL_CACHE[model_path]
    
    try:
        logger.info(f"Loading model from disk: {model_path}")
        model = tf.keras.models.load_model(model_path)
        
        # Cache the model
        MODEL_CACHE[model_path] = model
        logger.info(f"Model cached successfully: {model_path}")
        return model
    except Exception as e:
        logger.error(f"Error loading model {model_path}: {str(e)}")
        try:
            # Coba load dengan compile=False sebagai fallback
            model = tf.keras.models.load_model(model_path, compile=False)
            MODEL_CACHE[model_path] = model
            logger.info(f"Model loaded with compile=False and cached: {model_path}")
            return model
        except Exception as e2:
            logger.error(f"Second attempt failed: {str(e2)}")
            # Jika model adalah SavedModel format, gunakan tf.saved_model.load
            if "File format not supported" in str(e2):
                logger.info(f"Trying to load as SavedModel: {model_path}")
                try:
                    model = tf.saved_model.load(model_path)
                    MODEL_CACHE[model_path] = model
                    logger.info(f"SavedModel loaded and cached: {model_path}")
                    return model
                except Exception as e3:
                    logger.error(f"SavedModel loading failed: {str(e3)}")
                    raise e3
            raise e2

def load_labels():
    """Load labels dengan caching"""
    global LABELS_CACHE
    if LABELS_CACHE is None:
        with open('model/labels.json', 'r') as label_file:
            LABELS_CACHE = json.load(label_file)
        print("Labels loaded and cached")
    return LABELS_CACHE

def preload_models():
    """Preload commonly used models for better performance"""
    logger.info("Starting model preloading...")
    
    # Load model berdasarkan pilihan dengan mapping yang benar
    model_mapping = get_model_mapping()

    # List of models to preload
    models_to_preload = [
        'efficientnetv2b0',  # Default model
        'mobilenetv3_small', # MobileNetV3 Small
        'resnet50'           # ResNet50
    ]

    preloaded_count = 0
    failed_models = []

    for model_name in models_to_preload:
        if model_name in model_mapping:
            try:
                model_path, display_name = model_mapping[model_name]
                logger.info(f"Preloading {display_name} ({model_name})...")
                
                # Cek apakah file model ada
                if not os.path.exists(model_path):
                    logger.error(f"Model file not found: {model_path}")
                    failed_models.append(f"{model_name} (file not found)")
                    continue

                # Gunakan path yang benar
                model = load_model_safe(model_path)
                if model is not None:
                    preloaded_count += 1
                    logger.info(f"{display_name} preloaded successfully")

                    # Verify model is in cache
                    if model_path in MODEL_CACHE:
                        logger.info(f"{display_name} confirmed in cache")
                    else:
                        logger.warning(f"{display_name} not found in cache after loading")
                else:
                    failed_models.append(model_name)
                    logger.warning(f"Failed to preload {model_name}")
            except Exception as e:
                failed_models.append(model_name)
                logger.error(f"Error preloading {model_name}: {str(e)}")
        else:
            failed_models.append(model_name)
            logger.warning(f"Model {model_name} not found in mapping")
    
    logger.info(f"Preloading completed: {preloaded_count}/{len(models_to_preload)} models loaded")
    if failed_models:
        logger.warning(f"Failed models: {failed_models}")
    
    return preloaded_count

def get_model_file_size(model_name):
    """Get model file size for monitoring"""
    try:
        # Get the correct model path from mapping
        model_mapping = get_model_mapping()
        
        # Find the model in mapping
        for key, (model_path, display_name) in model_mapping.items():
            if display_name.lower() == model_name.lower() or key == model_name:
                if os.path.exists(model_path):
                    size_bytes = os.path.getsize(model_path)
                    size_mb = size_bytes / (1024 * 1024)
                    return f"{size_mb:.1f} MB"
                else:
                    return "File not found"
        
        return "Model not in mapping"
    except Exception as e:
        return f"Error: {str(e)}"

def get_detailed_cache_info():
    """Get detailed information about cached models"""
    cache_info = get_cache_info()
    
    detailed_info = {
        "cache_size": cache_info["cache_size"],
        "cached_models": [],
        "total_memory_estimated": "N/A"
    }
    
    for model_name in cache_info["cached_models"]:
        model_info = {
            "name": model_name,
            "file_size": get_model_file_size(model_name),
            "status": "Loaded in memory"
        }
        detailed_info["cached_models"].append(model_info)
    
    return detailed_info

def predict_img(model_option, img_path):
    """
    Prediksi gambar menggunakan model yang dipilih dengan sistem caching
    
    Args:
        model_option (str): Nama model yang dipilih
        img_path (str): Path ke file gambar
        
    Returns:
        tuple: (actual_class, probability_class, response)
    """
    try:
        logger.info(f"Starting prediction with model: {model_option}")

        # Load model berdasarkan pilihan dengan mapping yang benar
        model_mapping = get_model_mapping()
        
        if model_option not in model_mapping:
            available_models = list(model_mapping.keys())
            raise ValueError(f"Model '{model_option}' tidak tersedia. Model yang tersedia: {available_models}")
        
        model_path, model_name = model_mapping[model_option]
        
        # Check if model is already in cache
        if model_path in MODEL_CACHE:
            logger.info(f"Model FOUND in cache: {model_path}")
        else:
            logger.info(f"Model NOT in cache, will load from disk: {model_path}")

        # Load model dengan caching untuk performa lebih baik
        logger.info(f"Loading model: {model_option} -> {model_path}")
        model = load_model_safe(model_path)
        if model is None:
            raise RuntimeError(f"Gagal memuat model: {model_path}")
                
        # Load labels dengan caching
        class_names = load_labels()
        if not class_names:
            raise RuntimeError("Gagal memuat labels untuk klasifikasi")
                
        # Tentukan ukuran input dan preprocessing function
        input_size = get_input_size(model_name)
        preprocessing_fn = PREPROCESS_FUNCTIONS.get(model_name, None)
        
        logger.info(f"Processing image: {img_path} with input size: {input_size}")
        logger.info(f"Using preprocessing function: {preprocessing_fn.__name__ if preprocessing_fn else 'None'}")
        
        # Preprocessing menggunakan fungsi dari notebook
        processed_img = load_and_preprocess_image(img_path, target_size=input_size, preprocessing_fn=preprocessing_fn)

        logger.info(f"Running prediction with model: {model_name}")
        
        # Handle prediksi untuk berbagai format model
        predictions = _run_model_prediction(model, processed_img)
        
        if predictions is None or len(predictions) == 0:
            raise RuntimeError("Model tidak menghasilkan prediksi yang valid")
        
        # Ambil top 3 prediksi
        top_3_indices = np.argsort(predictions[0])[-3:][::-1]
        actual_class = [class_names[str(i)] for i in top_3_indices]
        probability_class = [predictions[0][i] for i in top_3_indices]
        
        # Generate response message untuk UI
        response = f"Hasil prediksi: {actual_class[0]} ({probability_class[0]:.2%})"
        
        logger.info(f"Prediction completed successfully: {actual_class[0]} ({probability_class[0]:.2%})")
        
        return actual_class, probability_class, response

    except FileNotFoundError as e:
        error_msg = f"File gambar tidak ditemukan: {str(e)}"
        logger.error(error_msg)
        raise FileNotFoundError(error_msg)
    
    except ValueError as e:
        error_msg = f"Parameter tidak valid: {str(e)}"
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    except RuntimeError as e:
        error_msg = f"Error runtime: {str(e)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)
    
    except Exception as e:
        error_msg = f"Error tidak terduga dalam predict_img: {str(e)}"
        logger.error(error_msg)
        raise Exception(error_msg)

# ============================================================================
# HELPER FUNCTIONS FOR PREDICTION
# ============================================================================

def _run_model_prediction(model, processed_img):
    """
    Helper function untuk menjalankan prediksi dengan berbagai format model
    """
    try:
        # Cek apakah ini SavedModel atau Keras model
        if hasattr(model, 'signatures'):
            logger.info("Detected SavedModel format, using signature-based prediction")
            return _predict_with_savedmodel(model, processed_img)
        else:
            logger.info("Detected Keras model format, using standard prediction")
            return _predict_with_keras_model(model, processed_img)
            
    except Exception as e:
        logger.error(f"Error during model prediction: {str(e)}")
        raise e


def _predict_with_savedmodel(model, processed_img):
    """
    Prediksi menggunakan SavedModel format
    """
    serving_default = model.signatures['serving_default']
    input_tensor = tf.convert_to_tensor(processed_img, dtype=tf.float32)
    
    # Coba berbagai nama input yang umum
    input_names_to_try = ['input_1', 'inputs', 'x']
    
    for input_name in input_names_to_try:
        try:
            logger.debug(f"Trying input name: {input_name}")
            predictions = serving_default(**{input_name: input_tensor})
            
            # Ambil output pertama jika ada beberapa output
            if isinstance(predictions, dict):
                predictions = list(predictions.values())[0]
            
            # Konversi ke numpy array
            return predictions.numpy()
            
        except Exception as e:
            logger.debug(f"Failed with input name {input_name}: {str(e)}")
            continue
    
    # Jika semua nama input standar gagal, gunakan signature
    try:
        logger.debug("Trying with signature inspection")
        input_signature = serving_default.structured_input_signature[1]
        input_key = list(input_signature.keys())[0]
        logger.debug(f"Using detected input key: {input_key}")
        
        predictions = serving_default(**{input_key: input_tensor})
        if isinstance(predictions, dict):
            predictions = list(predictions.values())[0]
        
        return predictions.numpy()
        
    except Exception as e:
        logger.error(f"All SavedModel prediction attempts failed: {str(e)}")
        raise RuntimeError(f"Gagal menjalankan prediksi dengan SavedModel: {str(e)}")


def _predict_with_keras_model(model, processed_img):
    """
    Prediksi menggunakan Keras model standar
    """
    try:
        # verbose=0 untuk mengurangi output console
        predictions = model.predict(processed_img, verbose=0)
        return predictions
        
    except Exception as e:
        logger.error(f"Keras model prediction failed: {str(e)}")
        raise RuntimeError(f"Gagal menjalankan prediksi dengan Keras model: {str(e)}")
    
# ============================================================================
# DATABASE UTILITY FUNCTIONS
# ============================================================================

def generate_stored_filename(location=None, classification_result=None, original_extension=".jpg"):
    """
    Generate filename dengan format: {tanggal}_{lokasi}_{hasil_klasifikasi}_{random}.{ext}
    
    Args:
        location (str): Lokasi sampling (default: "unknown")
        classification_result (str): Hasil klasifikasi top 1
        original_extension (str): Ekstensi file asli
    
    Returns:
        str: Generated filename
    """
    # Format tanggal: YYYYMMDD_HHMMSS
    date_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Clean location (hapus karakter yang tidak valid untuk filename)
    if not location:
        location = "unknown"
    clean_location = "".join(c for c in location if c.isalnum() or c in ('-', '_')).rstrip()
    clean_location = clean_location[:20]  # Batasi panjang
    
    # Clean classification result
    if not classification_result:
        classification_result = "unclassified"
    clean_classification = "".join(c for c in classification_result if c.isalnum() or c in ('-', '_')).rstrip()
    clean_classification = clean_classification[:30]  # Batasi panjang
    
    # Generate random string untuk uniqueness
    random_suffix = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(6))
    
    # Combine all parts
    filename = f"{date_str}_{clean_location}_{clean_classification}_{random_suffix}{original_extension}"
    
    return filename

def get_image_metadata(file_path):
    """Get image metadata (dimensions, size)"""
    try:
        # File size
        file_size = os.path.getsize(file_path)
        
        # Image dimensions
        with Image.open(file_path) as img:
            width, height = img.size
        
        return {
            "file_size": file_size,
            "width": width,
            "height": height
        }
    except Exception as e:
        logger.error(f"Error getting image metadata: {str(e)}")
        return {
            "file_size": 0,
            "width": 0,
            "height": 0
        }

def save_upload_to_database(
    db_session,
    original_filename,
    stored_filename,
    file_path,
    location,
    model_used,
    classification_results,
    user_ip=None,
    processing_time=None
):
    """
    Save upload data to database
    
    Args:
        db_session: Database session
        original_filename (str): Original filename from user
        stored_filename (str): Generated filename for storage
        file_path (str): Full path to stored file
        location (str): Location/sampling site
        model_used (str): Model used for classification
        classification_results (tuple): (actual_class, probability_class, response)
        user_ip (str): User IP address
        processing_time (float): Processing time in seconds
    
    Returns:
        PlanktonUpload: Saved record
    """
    try:
        from database import PlanktonUpload
        
        actual_class, probability_class, response = classification_results
        
        # Get image metadata
        metadata = get_image_metadata(file_path)
        
        # Create database record
        upload_record = PlanktonUpload(
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_path=file_path,
            location=location,
            model_used=model_used,
            
            # Top 3 classification results
            top_class=actual_class[0] if len(actual_class) > 0 else "Unknown",
            top_probability=probability_class[0] if len(probability_class) > 0 else 0.0,
            second_class=actual_class[1] if len(actual_class) > 1 else None,
            second_probability=probability_class[1] if len(probability_class) > 1 else None,
            third_class=actual_class[2] if len(actual_class) > 2 else None,
            third_probability=probability_class[2] if len(probability_class) > 2 else None,
            
            # Metadata
            file_size=metadata["file_size"],
            image_width=metadata["width"],
            image_height=metadata["height"],
            user_ip=user_ip,
            processing_time=processing_time
        )
        
        # Save to database
        db_session.add(upload_record)
        db_session.commit()
        db_session.refresh(upload_record)
        
        logger.info(f"Upload saved to database: ID={upload_record.id}, filename={stored_filename}")
        return upload_record
        
    except Exception as e:
        db_session.rollback()
        logger.error(f"Error saving to database: {str(e)}")
        raise e
