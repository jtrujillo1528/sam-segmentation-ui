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
from botocore.exceptions import NoCredentialsError

app = FastAPI()

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

mongo_file = 'C:\\Users\\jtruj\\projects\\mongoSecrets.txt'
s3_file = 'C:\\Users\\jtruj\\projects\\s3Secrets.txt'
images_path = 'C:\\static\\images'

# Read the access point alias from the file
with open(s3_file, 'r') as fileRead:
    access_point_alias = fileRead.read().strip()

s3 = boto3.client('s3')

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
    
async def upload_data_to_s3(file, file_name, file_type):
    try:
        file_id = str(uuid4())
        file_key = 'data/' + file_id
        if file_type == 'image': 
            contents = await file.read()
            image = Image.open(io.BytesIO(contents))
            image_bytes = io.BytesIO()
            image.save(image_bytes, format='JPEG')  
            image_bytes.seek(0)  
            body = image_bytes
        else:
            body = await file.read()
        s3.put_object(Bucket=access_point_alias, Key=file_key, Body=body)
        return {'file name': file_name, 'id': file_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to upload data to S3: {str(e)}")
    
def update_filecount(dataset_id):
    try:
        rawData = db.rawData
        datasets = db.datasets

        current_dataset = datasets.find_one({'_id': ObjectId(dataset_id)})

        querryResult = rawData.find({'dataset': ObjectId(dataset_id)})
        if querryResult is not None:
            docs = list(querryResult)
            filter = {'_id': ObjectId(dataset_id)}
            update = {'$set':{'fileCount' : len(docs)}}
            datasets.update_one(filter,update)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to update filecount: {str(e)}")

async def download_data_from_s3(fileName):
    s3_image_key = 'data/' + fileName
    try:
        # Download the image from S3
        local_file_name = os.path.join(images_path,fileName)
        s3.download_file(access_point_alias, s3_image_key, local_file_name)
        return local_file_name
    except:
        return JSONResponse({"error": "cannot dowload data"}, status_code=404)
    
async def delete_object_from_s3(object_name):
    try:
        object_key = 'data/' + str(object_name)
        # Delete the object
        response = s3.delete_object(Bucket=access_point_alias, Key=object_key)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to delete data from S3: {str(e)}")

def createOutput(bucketID, name, format):
    try:
        outputs = db.outputs
        buckets = db.buckets
        newDataset = {
            'name' : name,
            'format' : format,
            'bucket' : ObjectId(bucketID)
        }
        outputID = addFile(newDataset,outputs)

        filter = {'_id': ObjectId(bucketID)}

        update = {'$push': {'outputs' : outputID}}

        buckets.update_one(filter, update)
        return str(outputID)
    except Exception as e:
        print(f"Error adding dataset to db: {e}")
        return None

def add_data_to_project(project_ID, image_data, image_name):
    try:
        # Upload image to S3
        upload_data_to_s3(image_data, image_name)
        images = db.images
        # Create project in MongoDB
        img = {
            "project": project_ID,
            "name": image_name
        }
        result = str(addFile(img,images))
        return result
    except: return JSONResponse({"error": "cannot upload data"}, status_code=404)

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
    
def find_project(collection, projectId: str):
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
    
def find_data(datasetID: str):
    try:
        objId = ObjectId(datasetID)
        data = db.rawData
        files = data.find({"dataset": objId})
        file_names = []
        for file in files:
            file_names.append(file)
        return file_names
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
    

def get_output_info(output_id: str):
    try:
        obj_id = ObjectId(output_id)
        outputs = db.outputs
        output = outputs.find_one({"_id": obj_id})
        
        if output:
            return {
                "id": str(output["_id"]),
                "name": output.get("name"),
                "format": output.get("format")
            }
        else:
            raise HTTPException(status_code=404, detail="Output not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving output: {str(e)}")
    
def get_dataset_info(dataset_id: str):
    try:
        # Convert the string ID to ObjectId
        obj_id = ObjectId(dataset_id)
        
        # Query the datasets collection
        datasets = db.datasets
        dataset = datasets.find_one({"_id": obj_id})
        
        if dataset:
            return {
                "id": str(dataset["_id"]),
                "name": dataset.get("name"),
                "type": dataset.get("type"),
                "fileCount": dataset.get("fileCount")
            }
        else:
            raise HTTPException(status_code=404, detail="Dataset not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving dataset: {str(e)}")

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

@app.post("/delete_project")
async def delete_project(project_id: str = Body(...), current_user: dict = Depends(get_current_user)):
    try:
        projects = db.projects
        object_id = ObjectId(project_id)
        result = projects.delete_one({"_id": object_id})
        if result.deleted_count == 1:
            return {"message": "Project deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail=f"Project with id {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to delete project: {str(e)}")
    
@app.get("/project/{project_id}")
async def get_project(project_id):
    try:
        projects = db.projects
        result = find_project(projects,project_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to find project: {str(e)}")
    
@app.get("/project/{project_id}/buckets")
async def get_buckets(project_id: str, current_user: dict = Depends(get_current_user)) :
    try:
        buckets = db.buckets
        project_buckets = buckets.find({"project": ObjectId(project_id)})
        
        display_buckets = []
        for bucket in project_buckets:
            display_bucket = {
                "_id": str(bucket["_id"]),
                "name": bucket["name"],
                "datasets": [],
                "outputs": []
            }
            
            # Populate datasets with name and type
            for dataset_id in bucket.get("datasets", []):
                try:
                    update_filecount(dataset_id)
                    dataset_info = get_dataset_info(str(dataset_id))
                    display_bucket["datasets"].append({
                        "id": dataset_info["id"],
                        "name": dataset_info["name"],
                        "type": dataset_info["type"],
                        "fileCount": dataset_info["fileCount"]
                    })
                except HTTPException:
                    # If a dataset is not found, we'll skip it instead of failing the whole request
                    print(f"Dataset {dataset_id} not found")

            # Populate outputs with name and format
            for output_id in bucket.get("outputs", []):
                try:
                    output_info = get_output_info(str(output_id))
                    display_bucket["outputs"].append({
                        "id": output_info["id"],
                        "name": output_info["name"],
                        "format": output_info["format"]
                    })
                except HTTPException:
                    # If an output is not found, we'll skip it instead of failing the whole request
                    print(f"Output {output_id} not found")
            
            display_buckets.append(display_bucket)
        return display_buckets
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to find buckets: {str(e)}")
    
@app.post("/project/{project_id}/new-bucket")
async def createBucket(
    project_id: str, 
    name: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        buckets = db.buckets
        newBucket = {
            'name': name,
            'datasets': [],
            'outputs': [],
            'project': ObjectId(project_id),
            'user': current_user["username"]  # Use the username from the token
        }
        bucketID = addFile(newBucket, buckets)
        return str(bucketID)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to create new bucket: {str(e)}")
    
@app.delete("/project/{project_id}/bucket/{bucket_id}")
async def delete_bucket(project_id: str, bucket_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # MongoDB collections
        buckets = db.buckets
        datasets = db.datasets
        outputs = db.outputs
        rawData = db.rawData

        # Retrieve the bucket
        bucket = buckets.find_one({"_id": ObjectId(bucket_id), "project": ObjectId(project_id)})
        if not bucket:
            raise HTTPException(status_code=404, detail="Bucket not found")

        # Delete associated datasets and their raw data
        for dataset_id in bucket.get('datasets', []):
            # Find rawData objects associated with this dataset
            raw_data_entries = rawData.find({"dataset": dataset_id})

            # Delete associated raw data objects from S3 and MongoDB
            for raw_data in raw_data_entries:
                # Extract the UUID from the rawData object
                uuid_value = raw_data.get('value')
                if uuid_value:
                    # Delete the file from S3
                    await delete_object_from_s3(uuid_value)
                # Delete the rawData document from MongoDB
                rawData.delete_one({"_id": raw_data["_id"]})

            # Delete the dataset
            datasets.delete_one({"_id": dataset_id})

        # Delete associated outputs
        for output_id in bucket.get('outputs', []):
            outputs.delete_one({"_id": output_id})

        # Finally, delete the bucket itself
        result = buckets.delete_one({"_id": ObjectId(bucket_id)})

        if result.deleted_count == 1:
            return {"message": "Bucket and associated data deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete bucket")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to delete bucket: {str(e)}")
    
@app.delete("/project/{project_id}/bucket/{bucket_id}/dataset/{dataset_id}")
async def delete_dataset(dataset_id: str, bucket_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # MongoDB collections
        buckets = db.buckets
        datasets = db.datasets
        rawData = db.rawData

        result = buckets.update_one(
            {"_id": ObjectId(bucket_id)},
            {"$pull": {"datasets": ObjectId(dataset_id)}})
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Bucket not found or dataset not in bucket")

    # Delete associated datasets and their raw data
        raw_data_entries = rawData.find({"dataset": ObjectId(dataset_id)})

        # Delete associated raw data objects from S3 and MongoDB
        for raw_data in raw_data_entries:
            # Extract the UUID from the rawData object
            uuid_value = raw_data.get('value')
            if uuid_value:
                # Delete the file from S3
                await delete_object_from_s3(uuid_value)
            # Delete the rawData document from MongoDB
            rawData.delete_one({"_id": raw_data["_id"]})

        # Delete the dataset
        datasets.delete_one({"_id": ObjectId(dataset_id)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to delete dataset: {str(e)}")
    
@app.post("/bucket/{bucket_id}/new-dataset")
async def createDataset(bucket_id, name: str = Form(...), type: str = Form(...),current_user: dict = Depends(get_current_user)):
    try:
        datasets = db.datasets
        buckets = db.buckets
        newDataset = {
            'name' : name,
            'type' : type,
            'fileCount': 0,
            'bucket' : ObjectId(bucket_id)
        }
        datasetID = addFile(newDataset,datasets)

        filter = {'_id': ObjectId(bucket_id)}

        update = {'$push': {'datasets' : datasetID}}

        buckets.update_one(filter, update)
        return str(datasetID)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to create new dataset: {str(e)}")
    
@app.post("/dataset/{dataset_id}/add-data")
async def addData(dataset_id, type: str = Form(...), file: UploadFile = File(...), fileName: str = Form(...), current_user: dict = Depends(get_current_user)):
    try:
        rawData = db.rawData
        response = await upload_data_to_s3(file, fileName, type)

        if not isinstance(response, dict) or 'id' not in response:
            raise ValueError("Unexpected response from upload_data_to_s3")
        
        raw_data_entry = {
            'dataset': ObjectId(dataset_id),
            'type': type,
            'value': response['id'],
            'user': current_user["username"],
            'name': fileName
        }

        dataID = addFile(raw_data_entry, rawData)
        return str(dataID)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to upload data: {str(e)}")


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
    uvicorn.run(app, host="localhost", port=8000)