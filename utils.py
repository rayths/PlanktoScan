import json
import tf_keras as tfk
import numpy as np
import tensorflow as tf
import cv2

from tensorflow import image as tfi
from tensorflow import data as tfd
from gradio_client import Client
from tf_keras.preprocessing.image import load_img, img_to_array
from tf_keras.applications.imagenet_utils import preprocess_input

# Import preprocess_input dengan alias spesifik seperti di notebook
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

# Mapping nama model ke fungsi preprocess_input seperti di notebook
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

def clean_text(text):
    text = text.replace("*", "")
    text = text.replace("#", "")
    text = text.replace("```", "")
    text = text.replace("_", "")
    text = text.rstrip()
    text = " ".join(text.split())
    return text

def load_image_for_prediction(path, IMAGE_SIZE=(192, 288)):
    image = load_img(path)
    image = img_to_array(image)
    image = tfi.resize(image, IMAGE_SIZE)
    image = tf.cast(image, tf.float32)
    image = image / 255.0
    return image

def load_segmentation_model_safe(model_path):
    """Load model segmentasi dengan handling khusus untuk SavedModel format"""
    try:
        # Coba load dengan tf.saved_model.load untuk SavedModel
        print(f"Loading segmentation model with tf.saved_model.load: {model_path}")
        model = tf.saved_model.load(model_path)
        return model
    except Exception as e:
        print(f"tf.saved_model.load failed: {str(e)}")
        try:
            # Fallback ke load_model biasa
            return tf.keras.models.load_model(model_path)
        except Exception as e2:
            print(f"Regular model loading failed: {str(e2)}")
            raise e2

def predict_mask(model, image_path, IMAGE_SIZE=(192, 288)):
    image = load_image_for_prediction(image_path, IMAGE_SIZE=IMAGE_SIZE)
    
    # Handle tf.saved_model differently
    if hasattr(model, 'signatures'):
        # Ini adalah SavedModel yang dimuat dengan tf.saved_model.load
        # Gunakan signature default
        serving_default = model.signatures['serving_default']
        # Konversi input ke tensor
        input_tensor = tf.convert_to_tensor(image[np.newaxis, ...], dtype=tf.float32)
        # Pastikan nama input sesuai dengan model
        # Biasanya nama input adalah input_1 atau inputs, coba keduanya
        try:
            predicted_mask = serving_default(input_1=input_tensor)
            # Ambil output pertama jika ada beberapa output
            if isinstance(predicted_mask, dict):
                predicted_mask = list(predicted_mask.values())[0]
        except:
            try:
                predicted_mask = serving_default(inputs=input_tensor)
                if isinstance(predicted_mask, dict):
                    predicted_mask = list(predicted_mask.values())[0]
            except:
                # Jika nama input tidak diketahui, gunakan key pertama dari signature
                input_key = list(serving_default.structured_input_signature[1].keys())[0]
                predicted_mask = serving_default(**{input_key: input_tensor})
                if isinstance(predicted_mask, dict):
                    predicted_mask = list(predicted_mask.values())[0]
        
        predicted_mask = predicted_mask.numpy()[0]
    else:
        # Ini adalah model biasa
        predicted_mask = model.predict(image[np.newaxis, ...])[0]
    
    return predicted_mask

def input_image(img_path, l_model):
    actual_image = np.asarray(load_img(img_path))
    predicted_mask = predict_mask(l_model, img_path)
    cv2.imwrite('static/uploads/original_image.jpg', cv2.cvtColor(actual_image, cv2.COLOR_RGB2BGR))
    cv2.imwrite('static/uploads/predicted_mask.jpg', predicted_mask * 255)
    
def display_roi_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    contours, _ = cv2.findContours(gray, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    largest_contour = None
    largest_area = 0
    
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area > largest_area:
            largest_area = area
            largest_contour = contour
    
    if largest_contour is not None:
        x, y, w, h = cv2.boundingRect(largest_contour)
        return (x, y, w, h)
    else:
        print("Tidak ada kontur yang ditemukan.")
        return None

def return_roi_image():
    img_image = cv2.imread('static/uploads/original_image.jpg')
    mask_image = cv2.imread('static/uploads/predicted_mask.jpg')
    
    img = cv2.resize(img_image, (1728, 1152))
    mask = cv2.resize(mask_image, (1728, 1152))

    x, y, w, h = display_roi_image(mask)

    roi = img[y:y+h, x:x+w]
    roi = cv2.resize(roi, (224, 224))
    return roi, (x, y, w, h)

def implement_roi_image(img_path, segmentation_model='deeplab'):
    """
    Melakukan segmentasi dengan model yang dipilih
    Args:
        img_path: path ke gambar input
        segmentation_model: pilihan model ('deeplab', 'segnet', 'unet')
    """
    # Mapping model segmentasi
    segmentation_mapping = {
        'deeplab': 'model/segmentation/deeplab_segmentation_plankton',
        'segnet': 'model/segmentation/segnet_segmentation_plankton', 
        'unet': 'model/segmentation/unet_segmentation_plankton'
    }
    
    if segmentation_model not in segmentation_mapping:
        raise ValueError(f"Model segmentasi '{segmentation_model}' tidak tersedia. Pilihan: {list(segmentation_mapping.keys())}")
    
    model_path = segmentation_mapping[segmentation_model]
    input_image(img_path, load_segmentation_model_safe(model_path))
    roi, (x, y, w, h) = return_roi_image()
    return roi, (x, y, w, h)

def detect_and_save_contours(img_path: str, mask_path: str, output_path: str):
    img = cv2.imread(img_path)
    mask = cv2.imread(mask_path, 0)
    
    img = cv2.resize(img, (1728, 1152))
    mask = cv2.resize(mask, (1728, 1152))
    
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    largest_contour = None
    largest_area = 0
    
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area > largest_area:
            largest_area = area
            largest_contour = contour
    
    if largest_contour is not None:
        x, y, w, h = cv2.boundingRect(largest_contour)
        cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 255), 7)
    
    mask_colored = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
    
    alpha = 0.5
    combined_img = cv2.addWeighted(img, 1 - alpha, mask_colored, alpha, 0)
    
    cv2.imwrite(output_path, combined_img)

def img_array(img_input):
    img_array = np.expand_dims(img_input, axis=0)
    img_array = preprocess_input(img_array, mode='tf', data_format=None)
    return img_array

def preprocess_for_model(img_input, model_name):
    """Preprocessing sesuai dengan model yang digunakan"""
    img_array = np.expand_dims(img_input, axis=0)
    
    # Gunakan mapping dari PREPROCESS_FUNCTIONS
    if model_name in PREPROCESS_FUNCTIONS:
        return PREPROCESS_FUNCTIONS[model_name](img_array)
    else:
        # Default preprocessing untuk model lain (VIT, BiT, etc.)
        return preprocess_input(img_array, mode='tf')

def load_and_preprocess_image(img_input, target_size=(224, 224), preprocessing_fn=None):
    """Fungsi untuk load + preprocessing image sesuai model tertentu seperti di notebook"""
    if isinstance(img_input, np.ndarray):
        # Jika input sudah berupa array, resize saja
        img = cv2.resize(img_input, target_size)
        img_array = np.expand_dims(img, axis=0)
    else:
        # Jika input adalah path file
        from tf_keras.preprocessing import image
        img = image.load_img(img_input, target_size=target_size)
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
    
    if preprocessing_fn:
        img_array = preprocessing_fn(img_array)
    return img_array

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

def load_model_safe(model_path):
    """Load model dengan metode yang sama seperti di notebook"""
    try:
        # Load model seperti di notebook - tanpa parameter tambahan
        model = tf.keras.models.load_model(model_path)
        return model
    except Exception as e:
        print(f"Error loading model {model_path}: {str(e)}")
        try:
            # Coba load dengan compile=False sebagai fallback
            return tf.keras.models.load_model(model_path, compile=False)
        except Exception as e2:
            print(f"Second attempt failed: {str(e2)}")
            # Jika model adalah SavedModel format, gunakan tf.saved_model.load
            if "File format not supported" in str(e2):
                print(f"Trying to load as SavedModel: {model_path}")
                try:
                    return tf.saved_model.load(model_path)
                except Exception as e3:
                    print(f"SavedModel loading failed: {str(e3)}")
                    raise e3
            raise e2

def predict_img(model_option, img_path, segmentation_model='deeplab'):
    try:
        # Load model berdasarkan pilihan dengan mapping yang benar
        model_mapping = {
            "vit": ('model/classification/vit_model_plankton', "vit"),
            "bit": ('model/classification/bit_model_plankton', "bit"),
            "conv": ('model/classification/conv_model_plankton', "conv"),
            "regnet": ('model/classification/regnet_model_plankton', "regnet"),
            "swin": ('model/classification/swin_model_plankton', "swin"),
            # Model .keras files dengan nama yang sesuai dengan PREPROCESS_FUNCTIONS - Menggunakan model replicated
            "convnext_small": ('model/classification/ConvNeXtSmall500DataReplicated.keras', "ConvNeXtSmall"),
            "convnext_tiny": ('model/classification/ConvNeXtTiny500DataReplicated.keras', "ConvNeXtTiny"),
            "densenet121": ('model/classification/DenseNet121500DataReplicated.keras', "DenseNet121"),
            "efficientnetv2b0": ('model/classification/EfficientNetV2B0500DataReplicated.keras', "EfficientNetV2B0"),
            "inceptionv3": ('model/classification/InceptionV3500DataReplicated.keras', "InceptionV3"),
            "mobilenet": ('model/classification/MobileNet500DataReplicated.keras', "MobileNet"),
            "mobilenetv2": ('model/classification/MobileNetV2500DataReplicated.keras', "MobileNetV2"),
            "mobilenetv3_large": ('model/classification/MobileNetV3Large500DataReplicated.keras', "MobileNetV3Large"),
            "mobilenetv3_small": ('model/classification/MobileNetV3Small500DataReplicated.keras', "MobileNetV3Small"),
            "resnet50": ('model/classification/ResNet50500DataReplicated.keras', "ResNet50"),
            "resnet101": ('model/classification/ResNet101500DataReplicated.keras', "ResNet101"),
            "resnet50v2": ('model/classification/ResNet50V2500DataReplicated.keras', "ResNet50V2"),
            "resnet101v2": ('model/classification/ResNet101V2500DataReplicated.keras', "ResNet101V2"),
        }
        
        if model_option not in model_mapping:
            raise ValueError("Pilih model yang sesuai.")
        
        model_path, model_name = model_mapping[model_option]
        model = load_model_safe(model_path)

        with open('model/labels.json', 'r') as label_file:
            class_names = json.load(label_file)
        
        # Tentukan ukuran input dan preprocessing function
        input_size = get_input_size(model_name)
        preprocessing_fn = PREPROCESS_FUNCTIONS.get(model_name, None)
        
        # Preprocessing menggunakan fungsi dari notebook
        processed_img = load_and_preprocess_image(img_path, target_size=input_size, preprocessing_fn=preprocessing_fn)
        
        # Handle prediksi berbeda untuk SavedModel vs Keras model
        if hasattr(model, 'signatures'):
            # Ini adalah SavedModel yang dimuat dengan tf.saved_model.load
            serving_default = model.signatures['serving_default']
            # Konversi input ke tensor
            input_tensor = tf.convert_to_tensor(processed_img, dtype=tf.float32)
            
            # Coba berbagai nama input yang umum
            try:
                predictions = serving_default(input_1=input_tensor)
                # Ambil output pertama jika ada beberapa output
                if isinstance(predictions, dict):
                    predictions = list(predictions.values())[0]
            except:
                try:
                    predictions = serving_default(inputs=input_tensor)
                    if isinstance(predictions, dict):
                        predictions = list(predictions.values())[0]
                except:
                    # Jika nama input tidak diketahui, gunakan key pertama dari signature
                    input_key = list(serving_default.structured_input_signature[1].keys())[0]
                    predictions = serving_default(**{input_key: input_tensor})
                    if isinstance(predictions, dict):
                        predictions = list(predictions.values())[0]
            
            # Konversi ke numpy array
            predictions = predictions.numpy()
        else:
            # Ini adalah model Keras biasa
            predictions = model.predict(processed_img)
        
        actual_class = [class_names[str(i)] for i in np.argsort(predictions[0])[-3:][::-1]]
        probability_class = np.sort(predictions[0])[-3:][::-1].tolist()

    except Exception as e:
        print(f"Error in predict_img: {str(e)}")
        raise e

def get_available_segmentation_models():
    """Mengembalikan daftar model segmentasi yang tersedia"""
    return {
        'deeplab': 'DeepLab V3+ (Recommended)',
        'segnet': 'SegNet',
        'unet': 'U-Net'
    }

def get_segmentation_model_info():
    """Mengembalikan informasi detail tentang setiap model segmentasi"""
    return {
        'deeplab': {
            'name': 'DeepLab V3+',
            'description': 'State-of-the-art semantic segmentation dengan atrous convolution',
            'accuracy': 'Tinggi',
            'speed': 'Sedang'
        },
        'segnet': {
            'name': 'SegNet', 
            'description': 'Encoder-decoder architecture untuk segmentasi efisien',
            'accuracy': 'Sedang',
            'speed': 'Cepat'
        },
        'unet': {
            'name': 'U-Net',
            'description': 'Arsitektur U-shaped untuk segmentasi biomedical images',
            'accuracy': 'Tinggi',
            'speed': 'Sedang'
        }
    }