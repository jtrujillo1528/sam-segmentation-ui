from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict
import json
import numpy as np
import cv2
from segment_anything import sam_model_registry, SamPredictor
import base64
import torch
import os
from uuid import uuid4
import base64
import numpy as np
from PIL import Image
import io

app = FastAPI()

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Replace with your React app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# SAM initialization remains the same
MODEL_TYPE = 'vit_h'
CHECKPOINT_PATH = "C:\\Users\\jtruj\\SAM\\sam_vit_h_4b8939.pth"
sam = sam_model_registry[MODEL_TYPE](checkpoint=CHECKPOINT_PATH)
DEVICE = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
sam.to(device=DEVICE)
predictor = SamPredictor(sam)

saved_masks = {}
initialized_images = {}
uploaded_images = {}

@app.post("/upload_image")
async def upload_image(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Generate a unique ID for this image
    image_id = str(uuid4())
    
    # Store the image
    uploaded_images[image_id] = {
        "image": img,
        "filename": file.filename,
        "width": img.shape[1],
        "height": img.shape[0],
    }
    
    return {"message": "Image uploaded", "image_id": image_id}


@app.get("/get_images")
async def get_images():
    images = [
        {
            "id": image_id,
            "width" : data["width"],
            "height": data["height"]
        }
        for image_id, data in uploaded_images.items()
    ]
    return {"images": images}

@app.get("/get_image/{image_id}")
async def get_image(image_id: str):
    if image_id in uploaded_images:
        img = uploaded_images[image_id]["image"]
        _, buffer = cv2.imencode('.png', img)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return {"image": img_base64}
    else:
        return JSONResponse({"error": "Image not found"}, status_code=404)


@app.post("/initialize_sam")
async def initialize_sam(image_id: str = Form(...)):
    if image_id not in uploaded_images:
        return JSONResponse({"error": "Image not found"}, status_code=404)
    
    img = uploaded_images[image_id]["image"]
    
    # Initialize SAM for this image
    predictor.set_image(img)

    return {"message": "SAM initialized for image", "image_id": image_id}

@app.post("/predict")
async def predict(points: str = Form(...), labels: str = Form(...)):
    global currentMask
    
    points_list = json.loads(points)
    labels_list = json.loads(labels)
    
    input_points = np.array(points_list)
    input_labels = np.array(labels_list)
    
    masks, _, _ = predictor.predict(
        point_coords=input_points,
        point_labels=input_labels,
        multimask_output=False
    )
    
    # Convert mask to single-channel 8-bit format
    mask = (masks[0] * 255).astype(np.uint8)
    
    # Encode mask as base64
    _, buffer = cv2.imencode('.png', mask)
    mask_base64 = base64.b64encode(buffer).decode('utf-8')
    currentMask = mask_base64

    return mask_base64


@app.post("/get_point")
async def get_point(masks: str = Form(...), point: str = Form(...), dims: str = Form(...)):
    masks = json.loads(masks)
    point = json.loads(point)
    dims = json.loads(dims)

    x_coord = int(point[0] * dims[0])
    y_coord = int(point[1] * dims[1])

    for i, mask_base64 in enumerate(masks):
        # Decode base64 string to bytes
        mask_bytes = base64.b64decode(mask_base64)
        
        # Create a PIL Image from bytes
        mask_image = Image.open(io.BytesIO(mask_bytes))
        
        # Convert PIL Image to numpy array
        mask_array = np.array(mask_image)
        
        # Check if the point is inside the mask
        if mask_array[y_coord, x_coord] > 0:
            return i

    return None


@app.post("/get_mask_data")
async def get_mask_data(mask_index: int = Form(...), image_index: int = Form(...)):
    if str(image_index) in saved_masks and mask_index < len(saved_masks[str(image_index)]):
        mask_data = saved_masks[str(image_index)][mask_index]
        
        # Decode base64 mask
        mask_bytes = base64.b64decode(mask_data['mask'])
        mask_np = np.frombuffer(mask_bytes, np.uint8)
        mask_array = cv2.imdecode(mask_np, cv2.IMREAD_GRAYSCALE)

        # Detect edges
        edges = cv2.Canny(mask_array, 100, 200)
        
        # Encode edges as base64
        _, buffer = cv2.imencode('.png', edges)
        edges_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return JSONResponse({
            "mask": mask_data['mask'],
            "edges": edges_base64,
            "color": mask_data['color'],
            "label": mask_data['label']
        })
    else:
        return JSONResponse({"error": "Mask not found"}, status_code=404)



# convert_to_yolo function remains the same

def convert_to_yolo(mask, image_shape):
    # Implement conversion from mask to YOLOv8 format
    # This is a placeholder function - you'll need to implement the actual conversion
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    yolo_annotations = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        center_x = (x + w/2) / image_shape[1]
        center_y = (y + h/2) / image_shape[0]
        width = w / image_shape[1]
        height = h / image_shape[0]
        yolo_annotations.append(f"0 {center_x} {center_y} {width} {height}")
    
    return yolo_annotations

class MaskData(BaseModel):
    label: str
    points: List[Dict[str, float]]
    pointLabels: List[int]
    mask: str
    imageIndex: int

@app.post("/save_mask")
async def save_mask(
    image_id: str = Form(...), 
    label: str = Form(...), 
    color: str = Form(...),
    points: str = Form(...), 
    pointLabels: str = Form(...),
    mask: str = Form(...)  # Add this parameter
):
    try:
        points_list = json.loads(points)
        labels_list = json.loads(pointLabels)

        if image_id not in saved_masks:
            saved_masks[image_id] = []
        
        saved_masks[image_id].append({
            "label": label,
            "color": color,
            "points": points_list,
            "pointLabels": labels_list,
            "mask": mask  # Use the mask passed in the request
        })
        
        return {"message": "Mask saved successfully"}
    
    except json.JSONDecodeError as e:
        return JSONResponse(content={"error": f"JSON decode error: {str(e)}"}, status_code=400)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/get_masks/{image_id}")
async def get_masks(image_id: str):
    return saved_masks.get(image_id, [])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)