'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Minus, Tag, Upload, Save, Eye, EyeOff, ChevronLeft, ChevronRight, Edit, X, Brush, Trash2, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Slider } from "./ui/slider";
import { debounce } from 'lodash';
import api from './api';
import { useRouter } from 'next/navigation';


//to do list
//add paint brush feature
//yolov8 mask format output
//add un-do feature for mask editing
//fix scrolling and panning on canvas
//integrate mongoDB database
//allow for user log-in and project definition

const SAMSegmentationUI = () => {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [projectID, setProjectID] = useState('');
  const [labels, setLabels] = useState([]);
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [segmentMode, setSegmentMode] = useState(null);
  const [points, setPoints] = useState([]);
  const [currentMask, setCurrentMask] = useState(null);
  const [maskColor, setMaskColor] = useState('#00FF00');
  const [maskOpacity, setMaskOpacity] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllSegments, setShowAllSegments] = useState(true);
  const [currentLabel, setCurrentLabel] = useState('');
  const [isEditingMask, setIsEditingMask] = useState(false);
  const [selectedMaskIndex, setSelectedMaskIndex] = useState(null);
  const [newLabelInput, setNewLabelInput] = useState('');
  const [editingPoints, setEditingPoints] = useState([]);
  const [selectedMaskEdges, setSelectedMaskEdges] = useState(null);
  const [currentFullSizeImage, setCurrentFullSizeImage] = useState(null);
  const [isInitialized, setInitialized] = useState(false)
  const [selectedMaskLabel, setSelectedMaskLabel] = useState(null);
  const [maskPointsHistory, setMaskPointsHistory] = useState({});
  const [isLabelSelected, setIsLabelSelected] = useState(false);
  const [isPaintBrushActive, setIsPaintBrushActive] = useState(false);
  const [paintBrushSize, setPaintBrushSize] = useState(10);
  const [paintBrushMode, setPaintBrushMode] = useState('add');
  const [paintMask, setPaintMask] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const canvasRef = useRef(null);
  const paintCanvasRef = useRef(null);
  const fileInputRef = useRef(null);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = isPanning ? 'grabbing' : 'default';
    }
  }, [isPanning]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const paintCanvas = paintCanvasRef.current;
    if (canvas && paintCanvas) {
      paintCanvas.width = canvas.width;
      paintCanvas.height = canvas.height;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const preventDefault = (e) => e.preventDefault();
      canvas.addEventListener('wheel', preventDefault, { passive: false });
      return () => canvas.removeEventListener('wheel', preventDefault);
    }
  }, []);

  useEffect(() => {
    const updateCanvas = async () => {
      await drawCanvas();
    };
    updateCanvas();
  }, [currentImageIndex, points, zoom, pan, maskColor, maskOpacity, showAllSegments]);

  useEffect(() => {
    fetchImages();
  }, []);

  useEffect(() => {
    if (images.length > 0 && currentImageIndex >= 0 && currentImageIndex < images.length) {
      fetchFullSizeImage(images[currentImageIndex].id);
    } else if (images.length === 0) {
      setCurrentFullSizeImage(null);
    }
  }, [currentImageIndex, images]);

  useEffect(() => {
    if (selectedMaskLabel) {
      setNewLabelInput(selectedMaskLabel);
      setIsLabelSelected(true);
    } else {
      setNewLabelInput('');
      setIsLabelSelected(false);
    }
  }, [selectedMaskLabel]);

  useEffect(() => {
    if (currentLabel) {
      setNewLabelInput(currentLabel);
      setIsLabelSelected(true);
    }
  }, [currentLabel]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    router.push('/login');
  };

  const saveLabelsToBackend = async (labelsList) => {
    try {
      const response = await fetch('http://localhost:8000/save_labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(labelsList),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log('Labels saved successfully');
    } catch (error) {
      console.error('Error saving labels:', error);
    }
  };

  const fetchImages = async () => {
    try {
      const response = await fetch('http://localhost:8000/get_images');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setImages(data.images);
      setLabels(data.labels); // Set the labels from the backend
      if (data.images.length > 0) {
        setCurrentImageIndex(0);
        setCurrentFullSizeImage(null);
        fetchFullSizeImage(data.images[0].id);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
    }
  };

  const fetchFullSizeImage = async (imageId) => {
    try {
      const response = await fetch(`http://localhost:8000/get_image/${imageId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setCurrentFullSizeImage(data.image);
    } catch (error) {
      console.error("Error fetching full-size image:", error);
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    for (const file of imageFiles) {
      const formData = new FormData();
      formData.append('file', file);
  
      try {
        const response = await fetch('http://localhost:8000/upload_image', {
          method: 'POST',
          body: formData,
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const result = await response.json();
        console.log(`Image uploaded successfully. ID: ${result.image_id}`);
      } catch (error) {
        console.error("Error uploading image:", error);
      }
    }
  
    // After uploading all images, fetch the updated image list
    await fetchImages();
  };

  const deleteImage = async (imageId) => {
    try {
      const response = await fetch(`http://localhost:8000/delete_image/${imageId}`, {
        method: 'DELETE',
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      // Remove the image from the local state
      setImages(prevImages => {
        const newImages = prevImages.filter(img => img.id !== imageId);
        
        // Update currentImageIndex if necessary
        if (newImages.length === 0) {
          setCurrentImageIndex(-1);
        } else if (currentImageIndex >= newImages.length) {
          setCurrentImageIndex(newImages.length - 1);
        }
        
        return newImages;
      });
  
      // Clear current full-size image and reset other states
      setCurrentFullSizeImage(null);
      setPoints([]);
      setCurrentMask(null);
      setSelectedMaskIndex(null);
      setSelectedMaskLabel(null);
      setNewLabelInput('');
      setSelectedMaskEdges(null);
  
      // If there are remaining images, fetch the new current image
      if (images.length > 1) {
        const newIndex = currentImageIndex >= images.length - 1 ? currentImageIndex - 1 : currentImageIndex;
        await fetchFullSizeImage(images[newIndex].id);
      }
  
      console.log('Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };


  const toggleSegmentsVisibility = () => {
    setShowAllSegments(prevState => !prevState);
  };

  const fitImageToCanvas = (image, canvas) => {
    const canvasRatio = canvas.width / canvas.height;
    const imageRatio = image.width / image.height;
  
    let width, height, offsetX, offsetY;
  
    if (canvasRatio > imageRatio) {
      height = canvas.height;
      width = image.width * (height / image.height);
      offsetY = 0;
      offsetX = (canvas.width - width) / 2;
    } else {
      width = canvas.width;
      height = image.height * (width / image.width);
      offsetX = 0;
      offsetY = (canvas.height - height) / 2;
    }
  
    return { width, height, offsetX, offsetY };
  };
 
  const drawMask = useCallback((ctx, maskBase64, color, offsetX, offsetY, width, height, zoom, pan, isSelected) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        // Use the current maskColor if color is not provided
        const currentColor = color || maskColor;
        const r = parseInt(currentColor.slice(1, 3), 16);
        const g = parseInt(currentColor.slice(3, 5), 16);
        const b = parseInt(currentColor.slice(5, 7), 16);

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i];
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = alpha;
        }

        tempCtx.putImageData(imageData, 0, 0);

        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);
        ctx.globalAlpha = maskOpacity;
        ctx.drawImage(tempCanvas, offsetX, offsetY, width, height);

        ctx.globalAlpha = 1.0;
        ctx.restore();

        resolve();
      };
      img.src = `data:image/png;base64,${maskBase64}`;
    });
  }, [maskOpacity, maskColor]);
  
  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFullSizeImage) return;
  
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    const img = new Image();
    img.src = `data:image/png;base64,${currentFullSizeImage}`;
    
    await new Promise((resolve) => {
      img.onload = async () => {
        const { width, height, offsetX, offsetY } = fitImageToCanvas(img, canvas);
  
        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);
        ctx.drawImage(img, offsetX, offsetY, width, height);
        ctx.restore();
  
        const maskDrawingPromises = [];
  
        if (showAllSegments && images[currentImageIndex] && images[currentImageIndex].masks) {
          images[currentImageIndex].masks.forEach((maskData, index) => {
            // Skip drawing the mask if it's currently being edited
            if (isEditingMask && index === selectedMaskIndex) {
              return;
            }
            const isSelected = index === selectedMaskIndex && !isEditingMask;
            maskDrawingPromises.push(drawMask(ctx, maskData.mask, maskData.color, offsetX, offsetY, width, height, zoom, pan, isSelected));
          });
        }
        // Draw the current mask being edited or created
        if (currentMask && (isSegmenting || isEditingMask)) {
          maskDrawingPromises.push(drawMask(ctx, currentMask, maskColor, offsetX, offsetY, width, height, zoom, pan, true));
        }
        await Promise.all(maskDrawingPromises);
  
        // Draw points
        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);
  
        const pointRadius = 5 / zoom;
        const pointsToDraw = isEditingMask ? editingPoints : points;
        pointsToDraw.forEach((point) => {
          const canvasX = offsetX + point.normalizedX * width;
          const canvasY = offsetY + point.normalizedY * height;
  
          ctx.beginPath();
          ctx.arc(canvasX, canvasY, pointRadius, 0, 2 * Math.PI);
          ctx.fillStyle = point.type === 1 ? 'blue' : 'red';
          ctx.fill();
        });
  
        ctx.restore();
  
        // Draw selected mask edges
        if (selectedMaskEdges && !isEditingMask) {
          const edgesImg = new Image();
          edgesImg.onload = () => {
            ctx.save();
            ctx.translate(pan.x, pan.y);
            ctx.scale(zoom, zoom);
            ctx.drawImage(edgesImg, offsetX, offsetY, width, height);
            ctx.restore();
          };
          edgesImg.src = `data:image/png;base64,${selectedMaskEdges}`;
        }
        if (isPaintBrushActive && paintMask) {
          const paintCanvas = paintCanvasRef.current;
          if (paintCanvas) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.drawImage(paintCanvas, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          }
        }
        resolve();
      };
    });
  }, [currentFullSizeImage, zoom, pan, showAllSegments, currentMask, maskColor, maskOpacity, points, editingPoints, selectedMaskIndex, selectedMaskEdges, isEditingMask, images, currentImageIndex, isPaintBrushActive, paintMask]);


  const debouncedDrawCanvas = useCallback(
    debounce(() => drawCanvas(), 60),  // 60 fps
    [drawCanvas]
  );

  useEffect(() => {
    debouncedDrawCanvas();
  }, [currentImageIndex, images, points, zoom, pan, maskColor, maskOpacity, showAllSegments, debouncedDrawCanvas]);

  const fetchMaskData = async (maskIndex) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('mask_index', maskIndex);
    formData.append('image_id', images[currentImageIndex].id);

    try {
      const response = await fetch('http://localhost:8000/get_mask_data', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSelectedMaskEdges(data.edges);
    } catch (error) {
      console.error('Error fetching mask data:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const isPointInMask = async (x, y, image) => {
    if (image && image.masks && image.masks.length > 0) {
      setIsLoading(true);
      const formData = new FormData();
  
      formData.append('masks', JSON.stringify(image.masks.map(mask => mask.mask)));
      formData.append('point', JSON.stringify([x, y]));
      formData.append('dims', JSON.stringify([image.width, image.height]));
  
      try {
        const response = await fetch('http://localhost:8000/get_point', {
          method: 'POST',
          body: formData,
          mode: 'cors',
          credentials: 'include',
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const selection = await response.json();
        setIsLoading(false);
        if (selection !== null) {
          return {
            index: selection,
            label: image.masks[selection].label
          };
        }
      } catch (error) {
        console.error('Error checking point in mask:', error);
        setIsLoading(false);
      }
    }
    return null;
  };

  const handleCanvasClick = async (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
  
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
  
    const img = new Image();
    img.src = `data:image/png;base64,${currentFullSizeImage}`;
  
    await new Promise((resolve) => {
      img.onload = async () => {
        const { width, height, offsetX, offsetY } = fitImageToCanvas(img, canvas);
  
        const adjustedX = (clickX - pan.x) / zoom;
        const adjustedY = (clickY - pan.y) / zoom;
  
        const normalizedX = (adjustedX - offsetX) / width;
        const normalizedY = (adjustedY - offsetY) / height;
      
        if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
          if (isSegmenting || isEditingMask) {
            const newPoint = { 
              normalizedX: normalizedX,
              normalizedY: normalizedY,
              type: segmentMode === 'add' ? 1 : 0
            };
            if (isEditingMask) {
              const updatedPoints = [...editingPoints, newPoint];
              setEditingPoints(updatedPoints);
              generateMask(updatedPoints, true);
            } else {
              const updatedPoints = [...points, newPoint];
              setPoints(updatedPoints);
              generateMask(updatedPoints);
            }
          } else {
            // Check if a mask was clicked (existing logic)
            const clickedMask = await isPointInMask(normalizedX, normalizedY, images[currentImageIndex]);
            
            if (clickedMask !== null) {
              setSelectedMaskEdges(null);
              setSelectedMaskIndex(clickedMask.index);
              setSelectedMaskLabel(clickedMask.label);
              setNewLabelInput(clickedMask.label);
              await fetchMaskData(clickedMask.index);
            } else {
              setSelectedMaskIndex(null);
              setSelectedMaskLabel(null);
              setNewLabelInput('');
              setSelectedMaskEdges(null);
            }
          }
        }  
      }   
      resolve();
    });
  };
    
  

  const startEditingMask = () => {
    if (selectedMaskIndex !== null) {
      const selectedMask = images[currentImageIndex].masks[selectedMaskIndex];
      const maskId = `${images[currentImageIndex].id}-${selectedMaskIndex}`;
      let originalPoints;
      
      if (maskPointsHistory[maskId]) {
        originalPoints = maskPointsHistory[maskId];
      } else {
        // Convert points from backend format to frontend format
        originalPoints = selectedMask.points.map((point, index) => ({
          normalizedX: point[0] / images[currentImageIndex].width,
          normalizedY: point[1] / images[currentImageIndex].height,
          type: selectedMask.pointLabels[index]
        }));
      }
      
      setIsEditingMask(true);
      setEditingPoints(originalPoints);
      setCurrentMask(selectedMask.mask);
      setCurrentLabel(selectedMask.label);
      setNewLabelInput(selectedMask.label);
      setMaskColor(selectedMask.color);
      setSegmentMode('add');
      setSelectedMaskEdges(null);
      
      // Generate the mask with the original points
      generateMask(originalPoints, true);
    }
  };
  
  const generateMask = async (currentPoints, isEditing = false) => {
    if (currentFullSizeImage && currentPoints.length > 0) {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('points', JSON.stringify(currentPoints.map(p => [
        Math.round(p.normalizedX * images[currentImageIndex].width),
        Math.round(p.normalizedY * images[currentImageIndex].height)
      ])));
      formData.append('labels', JSON.stringify(currentPoints.map(p => p.type)));
  
      try {
        const response = await fetch('http://localhost:8000/predict', {
          method: 'POST',
          body: formData,
          mode: 'cors',
          credentials: 'include',
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        setCurrentMask(data);
  
        if (isEditing) {
          setEditingPoints(currentPoints);
        } else {
          setPoints(currentPoints);
        }
  
        // Force a redraw of the canvas
        drawCanvas();
      } catch (error) {
        console.error('Error generating mask:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      setPaintBrushSize(prevSize => Math.max(1, Math.min(100, prevSize + delta)));
    } else {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
  
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, zoom * zoomFactor));
  
    const zoomPoint = {
      x: (mouseX - pan.x) / zoom,
      y: (mouseY - pan.y) / zoom,
    };
  
    const newPan = {
      x: mouseX - zoomPoint.x * newZoom,
      y: mouseY - zoomPoint.y * newZoom,
    };
  
    requestAnimationFrame(() => {
      setZoom(newZoom);
      setPan(newPan);
    });
  }
  }, [zoom, pan]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel);
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const initializePaintCanvas = () => {
    const canvas = canvasRef.current;
    const paintCanvas = paintCanvasRef.current;
    if (canvas && paintCanvas) {
      paintCanvas.width = canvas.width;
      paintCanvas.height = canvas.height;
      const ctx = paintCanvas.getContext('2d');
      ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    }
  };

  const handleCanvasMouseDown = (e) => {
    if (e.button === 0 && isPaintBrushActive && (isSegmenting || isEditingMask)) {
      setIsPainting(true);
      const { x, y } = getCanvasCoordinates(e);
      paint(x, y);
    } else if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (isPainting && isPaintBrushActive && (isSegmenting || isEditingMask)) {
      const { x, y } = getCanvasCoordinates(e);
      paint(x, y);
    } else if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      requestAnimationFrame(() => {
        setPan(prevPan => ({
          x: prevPan.x + deltaX,
          y: prevPan.y + deltaY
        }));
        setLastPanPoint({ x: e.clientX, y: e.clientY });
      });
    }
  };

  const handleCanvasMouseUp = (e) => {
    if (e.button === 0) {
      setIsPainting(false);
    } else if (e.button === 1) {
      setIsPanning(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const preventDefault = (e) => e.preventDefault();
      canvas.addEventListener('wheel', preventDefault, { passive: false });
      return () => canvas.removeEventListener('wheel', preventDefault);
    }
  }, []);

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  const paint = (x, y) => {
    const paintCanvas = paintCanvasRef.current;
    if (paintCanvas) {
      const ctx = paintCanvas.getContext('2d');
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      ctx.beginPath();
      ctx.arc(x, y, paintBrushSize / (2 * zoom), 0, 2 * Math.PI);
      ctx.fillStyle = paintBrushMode === 'add' ? 'white' : 'black';
      ctx.fill();
      ctx.restore();
      updatePaintMask();
    }
  };

  const updatePaintMask = () => {
    const paintCanvas = paintCanvasRef.current;
    if (paintCanvas) {
      const ctx = paintCanvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, paintCanvas.width, paintCanvas.height);
      const mask = new Uint8Array(imageData.data.length / 4);
      for (let i = 0; i < imageData.data.length; i += 4) {
        mask[i / 4] = imageData.data[i] > 0 ? 1 : 0;
      }
      setPaintMask(mask);
    }
  };


  const applyPaintMask = () => {
    if (paintMask && (isSegmenting || isEditingMask)) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
  
      for (let i = 0; i < paintMask.length; i++) {
        const pixelIndex = i * 4;
        if (paintBrushMode === 'add') {
          data[pixelIndex] |= paintMask[i];
          data[pixelIndex + 1] |= paintMask[i];
          data[pixelIndex + 2] |= paintMask[i];
        } else {
          data[pixelIndex] &= (1 - paintMask[i]);
          data[pixelIndex + 1] &= (1 - paintMask[i]);
          data[pixelIndex + 2] &= (1 - paintMask[i]);
        }
      }
  
      ctx.putImageData(imageData, 0, 0);
      setCurrentMask(data);
      initializePaintCanvas();
      setPaintMask(null);
      drawCanvas();
    }
  };

  const togglePaintBrush = () => {
    if (isSegmenting || isEditingMask) {
      setIsPaintBrushActive(!isPaintBrushActive);
      if (!isPaintBrushActive) {
        initializePaintCanvas();
      }
    }
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleNewLabel = async () => {
    if (newLabelInput && newLabelInput.trim() !== '') {
      if (selectedMaskIndex !== null) {
        // Update the label of the selected mask
        try {
          const response = await fetch('http://localhost:8000/update_mask_label', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image_id: images[currentImageIndex].id,
              mask_index: selectedMaskIndex,
              new_label: newLabelInput,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          setImages(prevImages => {
            const newImages = [...prevImages];
            newImages[currentImageIndex].masks[selectedMaskIndex].label = newLabelInput;
            return newImages;
          });
          setSelectedMaskLabel(newLabelInput);
        } catch (error) {
          console.error('Error updating mask label:', error);
        }
      } else if (!labels.includes(newLabelInput)) {
        // Add a new label
        const updatedLabels = [...labels, newLabelInput];
        setLabels(updatedLabels);
        setCurrentLabel(newLabelInput);
        saveLabelsToBackend(updatedLabels);
      }
      setNewLabelInput('');
      setIsLabelSelected(false);
    }
  };

  const handleNewSegment = () => {
    const newColor = generateRandomColor();
    setIsSegmenting(true);
    setSegmentMode('add');
    setPoints([]);
    setCurrentMask(null);
    setMaskColor(newColor); // Set the new random color
    if (images[currentImageIndex] && !isInitialized) {
      initializeSAM(images[currentImageIndex]);
      setInitialized(true);
    }
  };

  const generateRandomColor = () => {
    return "#" + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  };

  const handleRandomColor = () => {
    const newColor = generateRandomColor();
    setMaskColor(newColor);
    if (isSegmenting || isEditingMask) {
      // If currently segmenting or editing, update the current mask color
      // You might need to regenerate the mask with the new color here
      // For example: generateMask(points, isEditingMask, newColor);
    }
  };

  const initializeSAM = async (image) => {
    if (!image || !image.id) {
      console.error('Invalid image object or missing image ID');
      return;
    }
  
    const formData = new FormData();
    formData.append('image_id', image.id);
  
    try {
      const response = await fetch('http://localhost:8000/initialize_sam', {
        method: 'POST',
        body: formData,
        mode: 'cors',
        credentials: 'include',
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      console.log("SAM initialized for image:", data.message);
    } catch (error) {
      console.error('Error initializing SAM:', error);
    }
  };

//sort this out
const handleUpdateLabel = () => {
  if (newLabelInput && newLabelInput.trim() !== '') {
    setImages(prevImages => {
      const newImages = [...prevImages];
      newImages[currentImageIndex].masks[selectedMaskIndex].label = newLabelInput;
      return newImages;
    });
    setCurrentLabel(newLabelInput);
    setNewLabelInput('');
    
    // Update the label in the backend
    updateLabelInBackend(images[currentImageIndex].id, selectedMaskIndex, newLabelInput);
  }
};

// You'll need to implement this function to update the label in your backend
const updateLabelInBackend = async (imageId, maskIndex, newLabel) => {
  try {
    const response = await fetch('http://localhost:8000/update_mask_label', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_id: imageId,
        mask_index: maskIndex,
        new_label: newLabel,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Mask label updated successfully');
  } catch (error) {
    console.error('Error updating mask label:', error);
  }
};

const handleSaveSegment = async () => {
  if (currentLabel && points.length > 0 && currentMask) {
    const formData = new FormData();
    formData.append('image_id', images[currentImageIndex].id);
    formData.append('label', currentLabel);
    formData.append('color', maskColor);
    formData.append('points', JSON.stringify(points.map(p => [
      Math.round(p.normalizedX * images[currentImageIndex].width),
      Math.round(p.normalizedY * images[currentImageIndex].height)
    ])));
    formData.append('pointLabels', JSON.stringify(points.map(p => p.type)));
    formData.append('mask', currentMask);

    try {
      const response = await fetch('http://localhost:8000/save_mask', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const result = await response.json();
      const newMaskIndex = result.mask_index;

      setImages(prevImages => {
        const newImages = [...prevImages];
        const newMask = {
          label: currentLabel,
          color: maskColor,
          points: points,
          pointLabels: points.map(p => p.type),
          mask: currentMask
        };
        if (!newImages[currentImageIndex].masks) {
          newImages[currentImageIndex].masks = [];
        }
        const maskExists = newImages[currentImageIndex].masks.some(
          existingMask => 
            existingMask.label === newMask.label &&
            existingMask.color === newMask.color &&
            existingMask.mask === newMask.mask
        );
        if (!maskExists) {
          newImages[currentImageIndex].masks.push(newMask);
        }
        return newImages;
      });

      // Save the original points to the history
      const maskId = `${images[currentImageIndex].id}-${newMaskIndex}`;
      setMaskPointsHistory(prev => ({
        ...prev,
        [maskId]: points
      }));

      setIsSegmenting(false);
      setSegmentMode(null);
      setPoints([]);
      setCurrentMask(null);

    } catch (error) {
      console.error("Error saving mask:", error);
    }
  }
};

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
      setPoints([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCurrentMask(null);
      setInitialized(false);
      setSelectedMaskEdges(null);
    }
  };

  const handleNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      setPoints([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCurrentMask(null);
      setInitialized(false);
      setSelectedMaskEdges(null);
    }
  };


  const updateSelectedMask = () => {
    setImages(prevImages => {
      const newImages = [...prevImages];
      const newMasks = [...newImages[currentImageIndex].masks];
      newMasks[selectedMaskIndex] = {
        ...newMasks[selectedMaskIndex],
        points: editingPoints,
        mask: currentMask,
        color: maskColor,
        label: labels.indexOf(currentLabel)
      };
      newImages[currentImageIndex] = {
        ...newImages[currentImageIndex],
        masks: newMasks
      };
      return newImages;
    });
  };

  const deleteMask = async () => {
    if (selectedMaskIndex !== null) {
      try {
        const response = await fetch('http://localhost:8000/delete_mask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_id: images[currentImageIndex].id,
            mask_index: selectedMaskIndex,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        setImages(prevImages => {
          const newImages = [...prevImages];
          newImages[currentImageIndex].masks = newImages[currentImageIndex].masks.filter((_, index) => index !== selectedMaskIndex);
          return newImages;
        });
        setSelectedMaskIndex(null);
        setSelectedMaskLabel(null);
        setNewLabelInput('');
        setSelectedMaskEdges(null);
      } catch (error) {
        console.error('Error deleting mask:', error);
      }
    }
  };



  const saveMaskEdits = async () => {
    if (selectedMaskIndex !== null) {
      try {
        const formData = new FormData();
        formData.append('image_id', images[currentImageIndex].id);
        formData.append('mask_index', selectedMaskIndex);
        formData.append('points', JSON.stringify(editingPoints.map(p => [
          Math.round(p.normalizedX * images[currentImageIndex].width),
          Math.round(p.normalizedY * images[currentImageIndex].height)
        ])));
        formData.append('pointLabels', JSON.stringify(editingPoints.map(p => p.type)));
        formData.append('mask', currentMask);
        formData.append('color', maskColor);
        formData.append('label', currentLabel);
  
        const response = await fetch('http://localhost:8000/update_mask', {
          method: 'POST',
          body: formData,
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        // Update the local state
        setImages(prevImages => {
          const newImages = [...prevImages];
          newImages[currentImageIndex].masks[selectedMaskIndex] = {
            ...newImages[currentImageIndex].masks[selectedMaskIndex],
            points: editingPoints,
            mask: currentMask,
            color: maskColor,
            label: currentLabel
          };
          return newImages;
        });
  
        // Update the mask points history
        const maskId = `${images[currentImageIndex].id}-${selectedMaskIndex}`;
        setMaskPointsHistory(prev => ({
          ...prev,
          [maskId]: editingPoints
        }));
  
        setIsEditingMask(false);
        setEditingPoints([]);
        setCurrentMask(null);
        setSelectedMaskIndex(null);
      } catch (error) {
        console.error('Error saving mask edits:', error);
      }
    }
  };
  
  const cancelMaskEdits = () => {
    setIsEditingMask(false);
    setEditingPoints([]);
    setCurrentMask(null);
    setSelectedMaskIndex(null)
  };

  const cancelMaskGeneration = () => {
    setIsSegmenting(false);
    setSegmentMode(null);
    setPoints([]);
    setCurrentMask(null);
  };
  
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-64 h-full bg-gray-800 shadow-lg p-4 flex flex-col space-y-4 overflow-y-auto">
        <Select 
          value={currentLabel}
          onValueChange={(value) => {
            setCurrentLabel(value);
            setNewLabelInput(value);
            setIsLabelSelected(true);
          }}
          disabled={labels.length === 0}
        >
          <SelectTrigger className="w-full bg-gray-700 text-white border-blue-500">
            <SelectValue placeholder="Labels" />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 text-white z-50 max-h-60 overflow-auto">
            {labels.map((label, index) => (
              <SelectItem 
                key={index} 
                value={label}
                className="text-white hover:bg-gray-600"
              >
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
          
        <Input
          value={newLabelInput}
          onChange={(e) => {
            setNewLabelInput(e.target.value);
            setIsLabelSelected(false);
          }}
          placeholder={
            isEditingMask
              ? "Update mask label"
              : "Enter new label"
          }
          className="bg-gray-700 text-white border-blue-500"
        />
  
        {isEditingMask && (
          <Button 
            onClick={handleUpdateLabel} 
            disabled={!newLabelInput.trim()} 
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Edit className="mr-2 h-4 w-4" /> Update Label
          </Button>
        )}
  
        {!isEditingMask && (
          <Button 
            onClick={handleNewLabel} 
            disabled={!newLabelInput.trim()} 
            className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Label
          </Button>
        )}
  
        {!isSegmenting && !isEditingMask && (
          <Button onClick={handleNewSegment} disabled={!currentLabel} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
            <Plus className="mr-2 h-4 w-4" /> New Segment
          </Button>
        )}
  
        {!isSegmenting && !isEditingMask && selectedMaskIndex !== null && (
          <>
            <Button onClick={startEditingMask} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Edit className="mr-2 h-4 w-4" /> Edit Selected Mask
            </Button>
            <Button onClick={deleteMask} className="bg-red-600 hover:bg-red-700 text-white">
              <X className="mr-2 h-4 w-4" /> Delete Selected Mask
            </Button>
          </>
        )}
  
        {(isSegmenting || isEditingMask) && (
          <>
            <Button 
              onClick={() => setSegmentMode('add')} 
              className={`bg-gray-700 hover:bg-gray-600 text-white border ${segmentMode === 'add' ? 'border-green-500' : 'border-blue-500'}`}
            >
              Add Regions
            </Button>
  
            <Button 
              onClick={() => setSegmentMode('remove')} 
              className={`bg-gray-700 hover:bg-gray-600 text-white border ${segmentMode === 'remove' ? 'border-red-500' : 'border-blue-500'}`}
            >
              Remove Regions
            </Button>
  
            <Button 
              onClick={isEditingMask ? saveMaskEdits : handleSaveSegment} 
              disabled={(isEditingMask ? editingPoints : points).length === 0} 
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Save className="mr-2 h-4 w-4" /> Save {isEditingMask ? 'Edits' : 'Segment'}
            </Button>
  
            <Button 
              onClick={isEditingMask ? cancelMaskEdits : cancelMaskGeneration} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <X className="mr-2 h-4 w-4" /> Cancel {isEditingMask ? 'Edits' : 'Segment'}
            </Button>
          </>
        )}
  
        <Button onClick={() => fileInputRef.current.click()} disabled={isSegmenting || isEditingMask} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
          <Upload className="mr-2 h-4 w-4" /> Load Images
        </Button>
  
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          multiple
          className="hidden"
        />
  
        <Button onClick={toggleSegmentsVisibility} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
          {showAllSegments ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
          {showAllSegments ? 'Hide Segments' : 'Show Segments'}
        </Button>
  
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={maskColor}
            onChange={(e) => setMaskColor(e.target.value)}
            className="w-8 h-8 bg-gray-700 border border-blue-500"
          />
          <Button onClick={handleRandomColor} className="text-xs bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
            Random Color
          </Button>
        </div>

        <Button onClick={() => fileInputRef.current.click()} disabled={isSegmenting || isEditingMask} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
    <Upload className="mr-2 h-4 w-4" /> Load Images
  </Button>

  <input
    type="file"
    ref={fileInputRef}
    onChange={handleFileChange}
    accept="image/*"
    multiple
    className="hidden"
  />

  {images.length > 0 && (
    <Button 
      onClick={() => deleteImage(images[currentImageIndex].id)} 
      disabled={isSegmenting || isEditingMask}
      className="bg-red-600 hover:bg-red-700 text-white"
    >
      <Trash2 className="mr-2 h-4 w-4" /> Delete Image
    </Button>
  )}
  
        <div className="flex flex-col space-y-2">
          <span className="text-sm">Mask Opacity:</span>
          <Slider
            value={[maskOpacity]}
            onValueChange={([value]) => setMaskOpacity(value)}
            min={0}
            max={1}
            step={0.01}
            className="w-full"
          />
        {(isSegmenting || isEditingMask) && (
          <>
            <Button 
              onClick={togglePaintBrush} 
              className={`bg-gray-700 hover:bg-gray-600 text-white border ${isPaintBrushActive ? 'border-green-500' : 'border-blue-500'}`}
            >
              <Brush className="mr-2 h-4 w-4" /> {isPaintBrushActive ? 'Disable' : 'Enable'} Paint Brush
            </Button>

            {isPaintBrushActive && (
              <>
                <Select value={paintBrushMode} onValueChange={setPaintBrushMode}>
                  <SelectTrigger className="w-full bg-gray-700 text-white border-blue-500">
                    <SelectValue placeholder="Paint Brush Mode" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white">
                    <SelectItem value="add">Add Regions</SelectItem>
                    <SelectItem value="remove">Remove Regions</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex flex-col space-y-2">
                  <span className="text-sm">Brush Size: {paintBrushSize}</span>
                  <Slider
                    value={[paintBrushSize]}
                    onValueChange={([value]) => setPaintBrushSize(value)}
                    min={1}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <Button onClick={applyPaintMask} disabled={!paintMask} className="bg-green-600 hover:bg-green-700 text-white">
                  Apply Paint Mask
                </Button>
              </>
            )}
          </>
        )}
        </div>
        <div className="flex-grow"></div>

        {/* Logout button */}
        <Button 
          onClick={handleLogout} 
          className="bg-red-600 hover:bg-red-700 text-white w-full mt-auto"
        >
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>

  
        {isLoading && <span className="text-white">Generating mask...</span>}
      </div>
  
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-900 relative">
  {/* Navigation Controls */}
  <div className="flex justify-between items-center p-4">
    <Button onClick={handlePrevImage} disabled={currentImageIndex === 0 || isSegmenting || isEditingMask} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
      <ChevronLeft className="mr-2 h-4 w-4" /> Previous Image
    </Button>
    <span className="text-lg font-semibold text-white">
      Image {currentImageIndex + 1} of {images.length}
    </span>
    <Button onClick={handleNextImage} disabled={currentImageIndex === images.length - 1 || isSegmenting || isEditingMask} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
      Next Image <ChevronRight className="ml-2 h-4 w-4" />
    </Button>
  </div>

  
       {/* Canvas */}
       <div className="flex-1 flex items-center justify-center p-4 relative">
          <canvas
            ref={canvasRef}
            width={1000}
            height={800}
            onClick={handleCanvasClick}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleMouseLeave}
            className="border border-gray-600 bg-black max-w-full max-h-full"
          />
          <canvas
            ref={paintCanvasRef}
            width={1000}
            height={800}
            className="absolute top-0 left-0 pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
};

export default SAMSegmentationUI;