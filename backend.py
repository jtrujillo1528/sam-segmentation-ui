from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
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
import pymongo
import uvicorn
import bcrypt
from email_validator import validate_email, EmailNotValidError
from pydantic import BaseModel
from typing import List
from bson import ObjectId
import boto3

app = FastAPI()

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

mongo_file = 'C:\\Users\\jtruj\\projects\\mongoSecrets.txt'
s3_file = 'C:\\Users\\jtruj\\projects\\s3Secrets.txt'

fileRead = open(s3_file, 'r')
access = fileRead.read()

s3 = boto3.client(
    's3',
    aws_access_key_id = '443370721298',
    aws_secret_access_key = access)
bucket_name = 'telescope-ui'

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
uploaded_images = {}
labels = []

class UpdateMaskLabel(BaseModel):
    image_id: str
    mask_index: int
    new_label: str

class DeleteMask(BaseModel):
    image_id: str
    mask_index: int

class ProjectCreate(BaseModel):
    name: str
    description: str

class Project(ProjectCreate):
    id: str
    owner: str

def mongoConnect(file):
    f = open(file, 'r')
    cluster = f.read()
    try:
        client = pymongo.MongoClient(cluster)
        return client
    except Exception:
        return JSONResponse({"error": "cannot access database"}, status_code=404)
    
client = mongoConnect(mongo_file)
db = client.telescope

def pullData(field, value, collection):
    try:
        data = collection.find({field: value})
        return data
    except: 
        return JSONResponse({"error": "cannot access database"}, status_code=404)
    
def upload_image_to_s3(file_data, file_name):
    s3.put_object(Bucket=bucket_name, Key=file_name, Body=file_data)
    return f"https://{bucket_name}.s3.amazonaws.com/{file_name}"

def add_image_to_project(project_ID, image_data, image_name):
    try:
        # Upload image to S3
        image_url = upload_image_to_s3(image_data, image_name)
        images = db.images
        # Create project in MongoDB
        img = {
            "project": project_ID,
            "image": image_url,
            "name": image_name
        }
        result = str(addFile(img,images))
        return result
    except: return JSONResponse({"error": "cannot upload image"}, status_code=404)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_user(collection, userName: str):
    try:
        user = collection.find({"userName": userName})
        for item in user:
            salt = item.get('salt')
            password = item.get('password')
        user = {
            'userName': userName,
            'password': password,
        }
        return user
    except: 
        return JSONResponse({"error": "user not found"}, status_code=404)
    
def get_project(collection, projectId: str):
    try:
        objId = ObjectId(projectId)
        proj = collection.find({"_id": objId})
        for item in proj:
            name = item.get('name')
            description = item.get('description')
        project = {
            'name': name,
            'description': description,
        }

        project.update({'id':projectId})
        return project
    except: 
        return JSONResponse({"error": "project not found"}, status_code=404)
    
def addFile(info, collection):
    try: 
        file = collection.insert_one(info)
        return file.inserted_id
    except: 
        return JSONResponse({"error": "unable to access database"}, status_code=404)


def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        users = db.users
        user = get_user(users, username) 
        if user is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    # Here you would typically fetch the user from the database
    # and return a user object
    return {"username": username}

def validate_email_address(email: str):
    try:
        # Validate and get info
        v = validate_email(email)
        # Replace with normalized form
        email = v["email"]
        return email
    except EmailNotValidError as e:
        # Email is not valid, exception message is human-readable
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/token")
async def login(username: str = Form(...), password: str = Form(...)):
    users = db.users
    user = get_user(users, username) 
    convertedPassword = bytes(password, 'utf-8')
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not bcrypt.checkpw(convertedPassword,user['password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/new_user")
async def add_new_user(username: str = Form(...), password: str = Form(...), email: str = Form(...)):
    try:
        # Validate email
        validated_email = validate_email_address(email)
        users = db.users
        # Check if username already exists
        existing_user = users.find_one({"userName": username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Check if email already exists
        existing_email = users.find_one({"email": validated_email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already in use")
        
        password_bytes  = bytes(password,'utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password_bytes, salt)
        user_file = {
            'userName': username,
            'password': hashed_password,
            'email': validated_email
        }
        addFile(user_file, users)
        access_token = create_access_token(data={"sub": username})
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="An error occurred during registration")

@app.get("/protected-route")
async def protected_route(current_user: dict = Depends(get_current_user)):
    return {"message": "This is a protected route", "user": current_user}

@app.post("/projects", response_model=Project)
async def create_project(project: ProjectCreate, current_user: dict = Depends(get_current_user)):
    projects = db.projects
    new_project = {
        "name": project.name,
        "description": project.description,
        "owner": current_user["username"]
    }
    project_id = str(addFile(new_project,projects))
    new_project.update({'id':project_id})
    return new_project

@app.get("/projects", response_model=List[Project])
async def get_projects(current_user: dict = Depends(get_current_user)):
    projects = db.projects
    try:
        querry_response = pullData("owner",current_user["username"],projects)
        projects = []
        for project in querry_response:
            temp = {
                "id": str(project['_id']),
                "name": project['name'],
                "description": project['description'],
                "owner": project['owner']
            }
            projects.append(temp)
        return projects
    except : return JSONResponse({"error": "unable to access projects"}, status_code=404)

from fastapi import Body, HTTPException
from bson.errors import InvalidId

@app.post("/delete_project")
async def delete_project(project_id: str = Body(...)):
    try:
        projects = db.projects
        object_id = ObjectId(project_id)
        print(object_id)
        result = projects.delete_one({"_id": object_id})
        if result.deleted_count == 1:
            return {"message": "Project deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail=f"Project with id {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to delete project: {str(e)}")
    
@app.get("/project/{project_id}")
async def find_project(project_id):
    try:
        projects = db.projects
        result = get_project(projects,project_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to find project: {str(e)}")

@app.post("/upload-image/")
async def upload_image(file: UploadFile = File(...), fileName: str = Form(...), project_id: str = Form(...)):
    project_obj_id = ObjectId(project_id)
    
    # Save project with image reference to MongoDB
    image_id = add_image_to_project(project_obj_id, file, fileName)
    
    return image_id

@app.post("/update_mask")
async def update_mask(
    image_id: str = Form(...),
    mask_index: int = Form(...),
    points: str = Form(...),
    pointLabels: str = Form(...),
    mask: str = Form(...),
    color: str = Form(...),
    label: str = Form(...)
):
    if image_id not in saved_masks or mask_index >= len(saved_masks[image_id]):
        return JSONResponse({"error": "Mask not found"}, status_code=404)
    
    try:
        points_list = json.loads(points)
        labels_list = json.loads(pointLabels)
        
        saved_masks[image_id][mask_index] = {
            "label": label,
            "color": color,
            "points": points_list,
            "pointLabels": labels_list,
            "mask": mask
        }
        
        return {"message": "Mask updated successfully"}
    
    except json.JSONDecodeError as e:
        return JSONResponse(content={"error": f"JSON decode error: {str(e)}"}, status_code=400)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/update_mask_label")
async def update_mask_label(data: UpdateMaskLabel):
    if data.image_id in saved_masks and 0 <= data.mask_index < len(saved_masks[data.image_id]):
        saved_masks[data.image_id][data.mask_index]['label'] = data.new_label
        return {"message": "Mask label updated successfully"}
    else:
        return JSONResponse({"error": "Mask not found"}, status_code=404)

@app.post("/delete_mask")
async def delete_mask(data: DeleteMask):
    if data.image_id in saved_masks and 0 <= data.mask_index < len(saved_masks[data.image_id]):
        del saved_masks[data.image_id][data.mask_index]
        return {"message": "Mask deleted successfully"}
    else:
        return JSONResponse({"error": "Mask not found"}, status_code=404)

@app.post("/save_labels")
async def save_labels(labels_list: List[str]):
    global labels
    labels = labels_list
    return {"message": "Labels saved successfully"}

@app.get("/get_labels")
async def get_labels():
    return {"labels": labels}

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

    saved_masks[image_id] = []
    
    return {"message": "Image uploaded", "image_id": image_id}


@app.get("/get_images")
async def get_images():
    images = [
        {
            "id": image_id,
            "width": data["width"],
            "height": data["height"],
            "masks": saved_masks.get(image_id, [])
        }
        for image_id, data in uploaded_images.items()
    ]
    return {"images": images, "labels": labels}

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
async def get_mask_data(mask_index: int = Form(...), image_id: str = Form(...)):
    if str(image_id) in saved_masks and mask_index < len(saved_masks[image_id]):
        mask_data = saved_masks[image_id][mask_index]
        
        # Decode base64 mask
        mask_bytes = base64.b64decode(mask_data['mask'])
        mask_np = np.frombuffer(mask_bytes, np.uint8)
        mask_array = cv2.imdecode(mask_np, cv2.IMREAD_GRAYSCALE)

        # Detect edges
        edges = cv2.Canny(mask_array, 100, 200)
        
        # Create a colored edge image
        colored_edges = np.zeros((edges.shape[0], edges.shape[1], 4), dtype=np.uint8)
        colored_edges[edges != 0] = [255, 255, 255, 255]  # Red color for edges
        
        # Encode the colored edges as base64
        _, buffer = cv2.imencode('.png', colored_edges)
        edges_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return JSONResponse({
            "edges": edges_base64
        })
    else:
        return JSONResponse({"error": "Mask not found"}, status_code=404)


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
    mask: str = Form(...)
):
    try:
        points_list = json.loads(points)
        labels_list = json.loads(pointLabels)
        
        saved_masks[image_id].append({
            "label": label,
            "color": color,
            "points": points_list,
            "pointLabels": labels_list,
            "mask": mask
        })
        
        return {"message": "Mask saved successfully", "mask_index": len(saved_masks[image_id]) - 1}
    
    except json.JSONDecodeError as e:
        return JSONResponse(content={"error": f"JSON decode error: {str(e)}"}, status_code=400)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/get_masks/{image_id}")
async def get_masks(image_id: str):
    return saved_masks.get(image_id, [])

@app.delete("/delete_image/{image_id}")
async def delete_image(image_id: str):
    if image_id in uploaded_images:
        del uploaded_images[image_id]
        if image_id in saved_masks:
            del saved_masks[image_id]
        return {"message": "Image deleted successfully"}
    else:
        return JSONResponse({"error": "Image not found"}, status_code=404)

if __name__ == "__main__":
    print('running...')
    uvicorn.run(app, host="localhost", port=8000)