import os
import json
import io
import base64
import numpy as np
from PIL import Image
import onnxruntime as ort

_session = None
_class_labels = {}
_input_name = None

def load_class_labels():
    global _class_labels
    labels_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "class_labels.json")
    if os.path.exists(labels_path):
        with open(labels_path, "r", encoding="utf-8") as f:
            _class_labels = json.load(f)
    else:
        _class_labels = {
            "0": "metal",
            "1": "organic",
            "2": "paper",
            "3": "plastic_high",
            "4": "plastic_low",
            "5": "plastic_mid",
            "6": "wood"
        }

def get_onnx_session():
    """
    Loads the full 154-layer ONNX model using onnxruntime.
    """
    global _session, _input_name
    if _session is not None:
        return _session

    onnx_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "waste_model.onnx")
    if os.path.exists(onnx_path):
        print(f"[ML Service] Loading ONNX model from {onnx_path}...")
        _session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
        _input_name = _session.get_inputs()[0].name
        print(f"[ML Service] ONNX model loaded successfully! Input layer: '{_input_name}'")
        return _session
    else:
        print(f"[ML Service] Note: waste_model.onnx not yet found at {onnx_path}.")
        return None

def create_thumbnail_base64(pil_image: Image.Image, max_dim: int = 120) -> str:
    thumb = pil_image.copy()
    thumb.thumbnail((max_dim, max_dim))
    buffered = io.BytesIO()
    thumb.save(buffered, format="JPEG", quality=75)
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{img_str}"

def preprocess_image(pil_image: Image.Image, target_size: int = 224) -> np.ndarray:
    """
    Preprocess image for Keras MobileNetV2:
    - Resize to 224x224 RGB
    - Convert to float32
    - If your Keras model had a Rescaling(1./127.5, offset=-1) layer inside,
      input is [0, 255] or [0, 1]. MobileNetV2 accepts [0, 255] float32 array.
    """
    img = pil_image.convert("RGB").resize((target_size, target_size))
    img_array = np.array(img, dtype=np.float32)
    # Shape: (1, 224, 224, 3)
    img_batch = np.expand_dims(img_array, axis=0)
    return img_batch

def classify_waste_image(image_bytes: bytes, filename: str = "") -> tuple[str, float, str]:
    if not _class_labels:
        load_class_labels()

    pil_image = Image.open(io.BytesIO(image_bytes))
    thumbnail = create_thumbnail_base64(pil_image)

    session = get_onnx_session()
    if session is not None:
        processed_input = preprocess_image(pil_image, target_size=224)
        outputs = session.run(None, {_input_name: processed_input})
        logits = outputs[0][0]

        # Apply softmax to obtain clean probabilities
        exp_logits = np.exp(logits - np.max(logits))
        probs = exp_logits / np.sum(exp_logits)

        pred_idx = int(np.argmax(probs))
        confidence = float(probs[pred_idx])
        class_id = _class_labels.get(str(pred_idx), "metal")
        return class_id, round(confidence, 4), thumbnail
    else:
        # Graceful demo fallback while waiting for waste_model.onnx
        lower_name = filename.lower()
        matched = "metal"
        for idx, name in _class_labels.items():
            if name.split("_")[0] in lower_name:
                matched = name
                break
        return matched, 0.85, thumbnail
