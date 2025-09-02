# PlanktoScan - Advanced Plankton Detection & Classification System

## Description

PlanktoScan is a comprehensive web application (FastAPI backend + modern responsive frontend) that enables researchers, marine biologists, and expert taxonomists to upload plankton images, perform automated classification using state-of-the-art deep learning models, and receive detailed multi–model analysis results. It now includes:

- Firebase Authentication (Email/Password, Guest access)
- Role-based access (Expert, Basic, Guest) with protected expert feedback workflow
- Secure expert validation & correction of model predictions
- GPS tagging & sampling metadata capture
- Prediction history & expert audit trail
- Secure environment-based Firebase configuration delivery

## Features

### 🖼️ **Image Processing**
*   **Multiple Upload Methods:** Upload images via file browser, drag-and-drop, or real-time camera capture
*   **Image Preview:** Live preview with responsive sizing and hover effects
*   **Format Support:** PNG, JPG, JPEG (max 10MB)
*   **Validation:** Client-side file type and size validation

### 🧠 **Machine Learning Models**
* **Multiple CNN / Transformer Backbones:** EfficientNetV2B0 (default), ResNet50, ResNet101, MobileNet (V1/V2/V3), ConvNeXt Tiny / Small, DenseNet121, InceptionV3, Vision Transformer (ViT), BigTransfer (BiT)
* **Top-3 Confidence Output:** Ranked species probability distribution
* **Smart Model Caching:** Lazy load + in‑process cache to reduce cold start latency
* **Pluggable Architecture:** Drop new `.keras` model files into `model/classification/` and they become selectable
* **Performance Tracking:** Inference time + probability stats stored with each result

### 🌍 **GPS & Location Features**
* Automatic device GPS acquisition
* Reverse geocoding (fallback strategies supported client-side)
* Manual override for research station / cruise metadata
* Accuracy indicator (meters) + timestamp association

### 🗄️ **Data & Persistence**
* Firestore (via Firebase Admin SDK) for users, roles, audit feedback
* Local filesystem storage for uploaded & generated images (`static/uploads/`)
* Automatic structured file naming: `{date}_{location}_{primary-prediction}_{uuid}.ext`
* Metadata persisted: model used, 3-class probabilities, processing time, user role, geo context
* History page with filterable past predictions & expert validation status

### 🧪 **Expert Validation & Feedback**
* Dedicated Expert Feedback page (`/feedback/{result_id}`) gated by role
* Mark prediction as Correct / Incorrect + supply corrected taxon
* Structured commentary (morphology notes, reasoning, improvement hints)
* Edit cycle with audit trace (original vs updated)
* Character counter & validation (min length, max 2000)
* Visual summary card of original model output

### 🔐 **Authentication & Roles**
* Firebase Email/Password + Google OAuth (client-side SDK)
* Guest one-click exploratory access (no persistence)
* Role assignment: Expert (BRIN verified), Basic, Guest
* Secure ID token verification server-side (Firebase Admin)
* Session middleware (FastAPI) binds verified identity

### 📊 **(Optional) Monitoring Concepts**
* Model selection frequency (placeholder – extendable)
* Average inference latency metrics ready to expose

### 📱 **User Interface**
* Fully responsive (Bootstrap + custom utility classes)
* Modular pages: Login, Register, Index (Upload), Result, Expert Feedback, History
* Dynamic Firebase config loader
* Loading & skeleton states for auth-dependent components
* SweetAlert based UX: success/error modals, guided warnings
* Progressive reveal: Registration form unlocked after role selection

## Tech Stack

*   **Backend:** Python, FastAPI
*   **Machine Learning:** TensorFlow, Keras (tf_keras), OpenCV
*   **Frontend:** HTML, CSS, JavaScript (Bootstrap, jQuery, SweetAlert, modular JS)
*   **Auth:** Firebase JS SDK (config fetched via secure `/api/firebase-config`)
*   **Identity / Data:** Firebase Admin SDK (server side), Firestore
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
├── static/
│   ├── assets/             # Logos, backgrounds, icons
│   ├── css/                # Modular styles (variables, components, features)
│   ├── js/                 # Modular JS (auth, upload, prediction, feedback, utils)
│   ├── lib/                # Vendor libs (Bootstrap, FontAwesome, SweetAlert, Firebase SDK)
│   └── uploads/            # Runtime image storage (input & generated)
├── templates/
│   ├── index.html          # Main upload & model selection
│   ├── result.html         # Prediction result view
│   ├── login.html          # Firebase auth login
│   ├── register.html       # Role-based registration (Expert/Basic/Guest)
│   ├── expert_feedback.html# Expert validation & commentary
│   └── history.html        # Past predictions & feedback status
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
*   **`templates/`**: Jinja2 pages (upload workflow, auth, expert panel, history, results).
*   **`static/js/`**: Split by concern (`prediction.js`, `register.js`, `feedback.js`, `firebase-config.js`, `utils.js`).
*   **`static/css/`**: Layered design tokens & feature-specific styles.
*   **`static/uploads/`**: Ephemeral storage for input/output imagery.
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

### 5. Environment Variables (.env)

Create a `.env` file (already referenced by `main.py` via `load_dotenv()`):

```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...
FIREBASE_CREDENTIALS_PATH=firebase-service-account.json
MIDDLEWARE_KEY=change_me_session_secret
ADMIN_EMAIL=admin@example.org
ADMIN_PASSWORD=strong_password
```

Ensure the Firebase service account JSON file path matches `FIREBASE_CREDENTIALS_PATH`.

### 6. Obtain Machine Learning Models

This application requires pre-trained machine learning models for plankton segmentation and classification.

*   **Model Directory:** The application expects the models to be located in the `model/` directory, structured as follows:
    *   `model/segmentation/`: For segmentation models (e.g., `deeplab_segmentation_plankton`, `segnet_segmentation_plankton`, `unet_segmentation_plankton`).
    *   `model/classification/`: For classification models (e.g., `EfficientNetV2B0500DataReplicated.keras`, `ResNet50500DataReplicated.keras`, `vit_model_plankton`, etc.).
    *   `model/labels.json`: A JSON file mapping class indices to class names.

*   **Acquisition:**
    *   You will need to download or ensure you have these model files.
    *   **Important:** The specific models and `labels.json` are not included in this repository due to their size. You must obtain them separately and place them into the correct locations within the `model/` directory as specified in `utils.py`.
    *   The `utils.py` file contains references to specific model filenames (e.g., `deeplab_segmentation_plankton`, `EfficientNetV2B0500DataReplicated.keras`). Ensure your model files match these names or update the paths in `utils.py`.

## Running the Application (Development)

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

## Usage Workflow

Once the application is running, you can use it as follows:

1.  **Open the Dashboard:**
    *   Navigate to [http://127.0.0.1:8000](http://127.0.0.1:8000) in your web browser.
    *   You will see the main dashboard (`index.html`).

2.  **Upload an Image:**
    *   Click on the "Choose File" or similar button to select an image of plankton from your local system.
    *   Supported image formats typically include JPEG, PNG, etc.
    *   Once an image is selected, it will be uploaded to the server.

3.  **Select Models (Optional Override):** Choose segmentation & classification backbones (defaults auto-selected).

4.  **Submit for Prediction:**
    *   Click the "Predict" or "Submit" button.
    *   The application will:
        *   Perform segmentation on the uploaded image using the selected segmentation model to find the Region of Interest (ROI).
        *   Extract the ROI.
        *   Perform classification on the ROI using the selected classification model.

5.  **View Results & (If Expert) Validate:**
    *   You will be redirected to the results page (`result.html`).
    *   This page will display:
        *   The original image with the detected plankton highlighted (e.g., with a bounding box and overlaid segmentation mask).
        *   The top 3 predicted plankton classes along with their confidence probabilities.
        *   Other relevant information or messages from the prediction process.

6.  **History & Feedback:** Navigate to History to review prior predictions and expert validation statuses.

7.  **Return / New Prediction:** Start another upload.
    *   There should be an option or link (e.g., "Home" or "New Prediction") to return to the dashboard to upload a new image and clear previous uploads. The `/home` endpoint handles clearing of uploaded files (except for certain default/template images used by the result page like `original_image.jpg`, `predicted_mask.jpg`, `output_image.jpg`).

## Core API Endpoints (Selected)

The application exposes the following main API endpoints (defined in `routers/api.py`):

*   **`GET /`**: Serves the main dashboard page (`index.html`) with a welcome message.
*   **`GET /login`**: Login page (Firebase auth integration)
*   **`GET /register`**: Role-based registration UI
*   **`POST /auth/firebase`**: Exchange Firebase ID token for server session
*   **`POST /auth/expert/register`**: Elevated registration path (expert validation)
*   **`POST /login/guest`**: Guest session (ephemeral)
*   **`POST /logout`**: Invalidate session
*   **`GET /api/firebase-config`**: Returns public Firebase config (frontend initialization)
*   **`POST /auth/verify-token`**: Token integrity check
*   **`GET /history`**: Prediction history page
*   **`POST /upload`**:
    *   Accepts an image file upload.
    *   Saves the image to `static/uploads/`.
    *   Returns the path to the saved image.
*   **`POST /predict`**:
    *   Accepts `img_path` (path to the uploaded image), `model_option` (classification model), and `segmentation_model`.
    *   Performs ROI segmentation and plankton classification.
    *   Caches the result and returns a `result_id`.
*   **`GET /result/{result_id}`**: Render result + probabilities + (if expert) feedback status
*   **`GET /feedback/{result_id}`**: Expert feedback form (role required)
*   **`POST /feedback/{result_id}`**: Submit / update expert validation
*   **`GET /segmentation-models`**: JSON list of available segmentation models

> Full interactive schema: visit `/docs` while the server is running.

## Security Notes

| Aspect | Implementation |
|--------|----------------|
| Auth | Firebase client SDK + server verification via Admin SDK |
| Sessions | Signed cookie (FastAPI SessionMiddleware) |
| Roles | Stored & enforced server-side (Expert vs Basic vs Guest) |
| Config Exposure | Only non-secret Firebase fields exposed via `/api/firebase-config` |
| Service Account | Loaded from path in `.env` (never shipped to client) |
| Input Validation | Client + server checks (size, type, required fields) |

## Extending

1. Add new model: place file in `model/classification/`, update label mapping if needed.
2. Add segmentation variant: drop into `model/segmentation/` and expose name in selection logic.
3. Add new feedback fields: extend `expert_feedback.html` + server schema.
4. Expose metrics: create new endpoint querying stored metadata.

## Roadmap (Suggested)

- Export annotated datasets (expert corrections) for retraining
- Add JWT alternative auth path
- Implement pagination & filtering on history
- Introduce dockerized deployment & CI pipeline
- Add unit tests for utils & API contracts

## License

Educational / research use. Add a LICENSE file for production distribution.

## Acknowledgements

Models & taxonomy inspired by plankton imaging research community & BRIN expertise.

---
Feel free to open issues / suggestions to improve PlanktoScan.

For more details on request/response formats, refer to the FastAPI documentation automatically generated at `/docs` (e.g., [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)) when the application is running.
