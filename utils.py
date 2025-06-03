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

def clean_text(text):
    text = text.replace("*", "")
    text = text.replace("#", "")
    text = text.replace("```", "")
    text = text.replace("_", "")
    text = text.rstrip()
    text = " ".join(text.split())
    return text

def qwen2_72b(message):
    client = Client("Qwen/Qwen2-72B-Instruct")
    result = client.predict(
        query=message,
        history=[],
        system=f"Buatlah dalam 1 paragraf. Jelaskan mengenai jenis fitoplankton {message}",
        api_name="/model_chat"
    )
    return result[1][0][1]

def qwen25_72b(message):
    client = Client("Qwen/Qwen2.5-72B-Instruct")
    result = client.predict(
        query=message,
        history=[],
        system=f"Buatlah dalam 1 paragraf. Jelaskan mengenai jenis fitoplankton {message}",
        api_name="/model_chat"
    )
    return result[1][0][1]

def load_image_for_prediction(path, IMAGE_SIZE=(192, 288)):
    image = load_img(path)
    image = img_to_array(image)
    image = tfi.resize(image, IMAGE_SIZE)
    image = tf.cast(image, tf.float32)
    image = image / 255.0
    return image

def predict_mask(model, image_path, IMAGE_SIZE=(192, 288)):
    image = load_image_for_prediction(image_path, IMAGE_SIZE=IMAGE_SIZE)
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

def implement_roi_image(img_path):
    input_image(img_path, tfk.models.load_model('model/segmentation/deeplab_segmentation_plankton'))
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

def img_array(img_array):
    img_array = np.expand_dims(img_array, axis=0)
    img_array = preprocess_input(img_array, mode='tf', data_format=None)
    return img_array

def predict_img(model_option, llm_option, img_path):
    if model_option == "vit":
        model = tfk.models.load_model('model/classification/vit_model_plankton')
    elif model_option == "bit":
        model = tfk.models.load_model('model/classification/bit_model_plankton')
    elif model_option == "conv":
        model = tfk.models.load_model('model/classification/conv_model_plankton')
    elif model_option == "regnet":
        model = tfk.models.load_model('model/classification/regnet_model_plankton')
    elif model_option == "swin":
        model = tfk.models.load_model('model/classification/swin_model_plankton')
    else:
        model = "Pilih model yang sesuai."

    with open('model/labels.json', 'r') as label_file:
        class_names = json.load(label_file)
        
    predictions = model.predict(img_array(img_path))
    
    actual_class = [class_names[str(i)] for i in np.argsort(predictions[0])[-3:][::-1]]
    probability_class = np.sort(predictions[0])[-3:][::-1].tolist()
    
    if llm_option == "qwen2":
        response = clean_text(qwen2_72b(actual_class[0]))
    elif llm_option == "qwen25":
        response = clean_text(qwen25_72b(actual_class[0]))
    else:
        response = "Pilih model LLM yang sesuai."
    
    return actual_class, probability_class, response