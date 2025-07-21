# PlanktoScan - Advanced Plankton Detection & Classification System

## Description

PlanktoScan is a comprehensive web application built with FastAPI that enables researchers and marine biologists to upload plankton images, perform automated classification using state-of-the-art machine learning models, and receive detailed analysis results. The application features GPS location tracking, database storage, user feedback system, and supports both file uploads and real-time camera capture for plankton analysis.

## Features

### 🖼️ **Image Processing**
*   **Multiple Upload Methods:** Upload images via file browser, drag-and-drop, or real-time camera capture
*   **Image Preview:** Live preview with responsive sizing and hover effects
*   **Format Support:** PNG, JPG, JPEG (max 10MB)
*   **Validation:** Client-side file type and size validation

### 🧠 **Machine Learning Models**
*   **Classification Models:** Choose from various pre-trained models:
    *   EfficientNetV2B0 (default)
    *   ResNet50, MobileNet, MobileNetV2, MobileNetV3
    *   ConvNeXt Tiny, DenseNet121, InceptionV3
    *   BigTransfer (BiT), Vision Transformer (ViT)
*   **Model Caching:** Intelligent model preloading for faster predictions
*   **Top-3 Predictions:** Get the 3 most probable species with confidence scores
*   **Performance Monitoring:** Track processing time and accuracy metrics

### 🌍 **GPS & Location Features**
*   **GPS Integration:** Automatic location detection using device GPS
*   **Reverse Geocoding:** Convert GPS coordinates to human-readable addresses
*   **Manual Location Input:** Option to manually enter sampling location
*   **Location Accuracy Display:** Show GPS accuracy in meters
*   **Multiple Geocoding Services:** Fallback services for better coverage

### 🗄️ **Database & Storage**
*   **Multi-Database Support:** SQLite (development), PostgreSQL, MySQL
*   **Automatic File Naming:** `{date}_{location}_{classification}_{random}.ext`
*   **Metadata Storage:** File info, processing time, accuracy, user data
*   **Upload History:** Complete record of all classifications
*   **Performance Analytics:** Track model usage and success rates

### 📊 **Admin & Monitoring**
*   **Admin Dashboard:** `/admin` - Database monitoring and statistics
*   **Real-time Statistics:** Upload counts, model performance, location data
*   **Database Testing:** Connection testing and health checks
*   **Export Features:** JSON export of classification data
*   **Performance Metrics:** Processing time, accuracy tracking

### 📱 **User Interface**
*   **Responsive Design:** Works seamlessly on desktop, tablet, and mobile
*   **Dark/Light Theme:** Modern UI with smooth animations
*   **Real-time Feedback:** Loading states, progress indicators, error handling
*   **Welcome Tour:** First-time user guidance
*   **Accessibility:** Screen reader support and keyboard navigation

## Tech Stack

*   **Backend:** Python, FastAPI
*   **Machine Learning:** TensorFlow, Keras (tf_keras), OpenCV
*   **Frontend:** HTML, CSS, JavaScript (with jQuery and SweetAlert)
*   **Web Server (development):** Uvicorn
*   **Dependencies:** See `requirements.txt` for a full list.

## Project Structure

Here's an overview of the key directories and files in this project:

```
.
├── model/                  # Directory to store machine learning models
│   └── classification/     # Classification models (e.g., EfficientNetV2B0, ResNet50, etc.)
├── routers/                # Contains API route definitions
│   └── api.py              # Defines all API endpoints for the application
├── static/                 # Static assets (CSS, JavaScript, images)
│   ├── assets/             # General image assets for UI
│   ├── lib/                # Third-party frontend libraries (fontawesome,Bootstrap, jQuery, SweetAlert)
│   ├── uploads/            # Default directory for user-uploaded images and generated results
│   ├── script.js           # Custom JavaScript for the frontend
│   └── style.css           # Custom CSS styles for the frontend
├── templates/              # HTML templates for the web interface
│   ├── dashboard.html      # Main page for image upload and model selection
│   └── result.html         # Page to display prediction results
├── .gitignore              # Specifies intentionally untracked files that Git should ignore
├── database.py
├── main.py                 # Main FastAPI application setup and entry point
├── requirements.txt        # Lists Python dependencies for the project
├── utils.py                # Core utility functions for image processing, model loading, and prediction logic
└── README.md               # This file!
```

*   **`main.py`**: The entry point of the FastAPI application. It initializes the app, middleware, static file serving, and includes the API router.
*   **`utils.py`**: Contains all the core logic for image preprocessing, loading machine learning models (both segmentation and classification), performing predictions, and handling region of interest (ROI) extraction.
*   **`routers/api.py`**: Defines all the API endpoints used by the application, such as image upload, prediction, and serving HTML pages.
*   **`requirements.txt`**: Lists all Python packages required to run the project.
*   **`templates/`**: Holds the Jinja2 HTML templates used to render the web pages (e.g., `dashboard.html`, `result.html`).
*   **`static/`**: Stores static files like CSS stylesheets (`style.css`), client-side JavaScript (`script.js`), images, and third-party libraries. User uploads and generated output images are also stored here temporarily (`static/uploads/`).
*   **`model/`**: This directory is intended to store the machine learning models. You will need to place the downloaded/trained models for plankton classification and segmentation in the respective subdirectories (`model/classification/` and `model/segmentation/`). The `utils.py` file references specific model paths within this structure.

## Setup and Installation

Follow these steps to set up and run the Plankton Detection App locally:

### 1. Prerequisites

*   **Python:** Version 3.9 or higher is recommended. You can download it from [python.org](https://www.python.org/).
*   **pip:** Python package installer, usually comes with Python.
*   **Git:** For cloning the repository.

### 2. Clone the Repository

```bash
git clone https://github.com/rayths/PlanktoScan.git
cd PlanktoScan # Or your repository's directory name
```

### 3. Create and Activate a Virtual Environment (Recommended)

Using a virtual environment helps manage project dependencies without affecting your global Python installation.

*   **Create a virtual environment:**
    ```bash
    python -m venv venv
    ```

*   **Activate the virtual environment:**
    *   On Windows:
        ```bash
        .\venv\Scripts\activate
        ```
    *   On macOS and Linux:
        ```bash
        source venv/bin/activate
        ```

### 4. Install Dependencies

Install the required Python packages using `requirements.txt`:

```bash
pip install -r requirements.txt
```

### 5. Obtain Machine Learning Models

This application requires pre-trained machine learning models for plankton segmentation and classification.

*   **Model Directory:** The application expects the models to be located in the `model/` directory, structured as follows:
    *   `model/segmentation/`: For segmentation models (e.g., `deeplab_segmentation_plankton`, `segnet_segmentation_plankton`, `unet_segmentation_plankton`).
    *   `model/classification/`: For classification models (e.g., `EfficientNetV2B0500DataReplicated.keras`, `ResNet50500DataReplicated.keras`, `vit_model_plankton`, etc.).
    *   `model/labels.json`: A JSON file mapping class indices to class names.

*   **Acquisition:**
    *   You will need to download or ensure you have these model files.
    *   **Important:** The specific models and `labels.json` are not included in this repository due to their size. You must obtain them separately and place them into the correct locations within the `model/` directory as specified in `utils.py`.
    *   The `utils.py` file contains references to specific model filenames (e.g., `deeplab_segmentation_plankton`, `EfficientNetV2B0500DataReplicated.keras`). Ensure your model files match these names or update the paths in `utils.py`.

## Running the Application

Once you have completed the setup and installation steps:

1.  **Ensure your virtual environment is activated.** (See step 3 in Setup and Installation).
2.  **Navigate to the root directory** of the project (where `main.py` is located).
3.  **Start the FastAPI application using Uvicorn:**

    ```bash
    uvicorn main:app --reload
    ```

    *   `main:app` tells Uvicorn to look for an object named `app` in a file named `main.py`.
    *   `--reload` enables auto-reloading, so the server will restart automatically when you make changes to the code. This is useful for development.

4.  **Access the application:** Open your web browser and go to [http://127.0.0.1:8000](http://127.0.0.1:8000). You should see the application's dashboard.

## Usage

Once the application is running, you can use it as follows:

1.  **Open the Dashboard:**
    *   Navigate to [http://127.0.0.1:8000](http://127.0.0.1:8000) in your web browser.
    *   You will see the main dashboard (`dashboard.html`).

2.  **Upload an Image:**
    *   Click on the "Choose File" or similar button to select an image of plankton from your local system.
    *   Supported image formats typically include JPEG, PNG, etc.
    *   Once an image is selected, it will be uploaded to the server.

3.  **Select Models:**
    *   **Segmentation Model:** Choose a segmentation model from the dropdown list (e.g., DeepLab, U-Net, SegNet). This model will be used to identify the primary plankton object in the image.
    *   **Classification Model:** Choose a classification model from the dropdown list (e.g., EfficientNetV2B0, ResNet50, ViT). This model will be used to predict the species of the identified plankton.

4.  **Submit for Prediction:**
    *   Click the "Predict" or "Submit" button.
    *   The application will:
        *   Perform segmentation on the uploaded image using the selected segmentation model to find the Region of Interest (ROI).
        *   Extract the ROI.
        *   Perform classification on the ROI using the selected classification model.

5.  **View Results:**
    *   You will be redirected to the results page (`result.html`).
    *   This page will display:
        *   The original image with the detected plankton highlighted (e.g., with a bounding box and overlaid segmentation mask).
        *   The top 3 predicted plankton classes along with their confidence probabilities.
        *   Other relevant information or messages from the prediction process.

6.  **Return Home/New Prediction:**
    *   There should be an option or link (e.g., "Home" or "New Prediction") to return to the dashboard to upload a new image and clear previous uploads. The `/home` endpoint handles clearing of uploaded files (except for certain default/template images used by the result page like `original_image.jpg`, `predicted_mask.jpg`, `output_image.jpg`).

## API Endpoints

The application exposes the following main API endpoints (defined in `routers/api.py`):

*   **`GET /`**: Serves the main dashboard page (`dashboard.html`) with a welcome message.
*   **`GET /dashboard`**: Serves the main dashboard page (`dashboard.html`).
*   **`GET /home`**: Clears previously uploaded files (except for specific result images) and serves the dashboard page.
*   **`POST /upload`**:
    *   Accepts an image file upload.
    *   Saves the image to `static/uploads/`.
    *   Returns the path to the saved image.
*   **`POST /predict`**:
    *   Accepts `img_path` (path to the uploaded image), `model_option` (classification model), and `segmentation_model`.
    *   Performs ROI segmentation and plankton classification.
    *   Caches the result and returns a `result_id`.
*   **`GET /result/{result_id}`**:
    *   Accepts a `result_id`.
    *   Retrieves the cached prediction data.
    *   Generates an output image with contours.
    *   Serves the `result.html` page, displaying the image and prediction details.
*   **`GET /segmentation-models`**:
    *   Returns a JSON list of available segmentation models and their display names.

For more details on request/response formats, refer to the FastAPI documentation automatically generated at `/docs` (e.g., [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)) when the application is running.
