'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Minus, Tag, Upload, Save, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Slider } from "./ui/slider";
import { debounce } from 'lodash';  // Make sure to install and import lodash



const SAMSegmentationUI = () => {
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

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = isPanning ? 'grabbing' : 'default';
    }
  }, [isPanning]);

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
  }, [currentImageIndex, images, points, zoom, pan, maskColor, maskOpacity, showAllSegments]);



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
 
  const drawMask = (ctx, maskBase64, color, offsetX, offsetY, width, height, zoom, pan) => {
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
  
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
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
  };
  
  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || images.length === 0) return;
  
    const ctx = canvas.getContext('2d');
    
    // Create an off-screen canvas for double buffering
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
  
    const currentImage = images[currentImageIndex];
    if (currentImage) {
      const img = new Image();
      img.src = `data:image/png;base64,${currentImage.image}`;
      
      await new Promise((resolve) => {
        img.onload = async () => {
          const { width, height, offsetX, offsetY } = fitImageToCanvas(img, canvas);
  
          offscreenCtx.save();
          offscreenCtx.translate(pan.x, pan.y);
          offscreenCtx.scale(zoom, zoom);
          offscreenCtx.drawImage(img, offsetX, offsetY, width, height);
          offscreenCtx.restore();
  
          const maskDrawingPromises = [];
  
          if (showAllSegments && currentImage.masks) {
            currentImage.masks.forEach(maskData => {
              maskDrawingPromises.push(drawMask(offscreenCtx, maskData.mask, maskData.color, offsetX, offsetY, width, height, zoom, pan));
            });
          }
  
          if (currentMask) {
            maskDrawingPromises.push(drawMask(offscreenCtx, currentMask, maskColor, offsetX, offsetY, width, height, zoom, pan));
          }
  
          await Promise.all(maskDrawingPromises);
  
          // Draw points
          offscreenCtx.save();
          offscreenCtx.translate(pan.x, pan.y);
          offscreenCtx.scale(zoom, zoom);
  
          const pointRadius = 5 / zoom;
          points.forEach((point) => {
            const canvasX = offsetX + point.normalizedX * width;
            const canvasY = offsetY + point.normalizedY * height;
  
            offscreenCtx.beginPath();
            offscreenCtx.arc(canvasX, canvasY, pointRadius, 0, 2 * Math.PI);
            offscreenCtx.fillStyle = point.type === 1 ? 'blue' : 'red';
            offscreenCtx.fill();
          });
  
          offscreenCtx.restore();
  
          // Copy the off-screen canvas to the main canvas in a single operation
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(offscreenCanvas, 0, 0);
  
          resolve();
        };
      });
    }
  }, [images, currentImageIndex, zoom, pan, showAllSegments, currentMask, maskColor, maskOpacity, points, fitImageToCanvas, drawMask]);

  const debouncedDrawCanvas = useCallback(
    debounce(() => drawCanvas(), 16),  // 60 fps
    [drawCanvas]
  );

  useEffect(() => {
    debouncedDrawCanvas();
  }, [currentImageIndex, images, points, zoom, pan, maskColor, maskOpacity, showAllSegments, debouncedDrawCanvas]);

  const handleCanvasClick = (e) => {
    if (e.button === 0 && images[currentImageIndex] && currentLabel && isSegmenting && segmentMode !== null) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      const { width, height, offsetX, offsetY } = fitImageToCanvas(images[currentImageIndex], canvas);

      const adjustedX = (clickX - pan.x) / zoom;
      const adjustedY = (clickY - pan.y) / zoom;

      const normalizedX = (adjustedX - offsetX) / width;
      const normalizedY = (adjustedY - offsetY) / height;

      if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
        const newPoint = { 
          normalizedX: normalizedX,
          normalizedY: normalizedY,
          type: segmentMode === 'add' ? 1 : 0
        };
        setPoints(prevPoints => [...prevPoints, newPoint]);
        
        generateMask([...points, newPoint]);
      }
    }
  };

  const generateMask = async (currentPoints) => {
    if (images[currentImageIndex] && currentPoints.length > 0) {
      setIsLoading(true);
      const formData = new FormData();
  
      const imageWidth = images[currentImageIndex].width;
      const imageHeight = images[currentImageIndex].height;
  
      // Convert base64 to Blob
      const base64Data = images[currentImageIndex].image;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {type: 'image/png'});
  
      formData.append('file', blob, 'image.png');
      formData.append('points', JSON.stringify(currentPoints.map(p => [
        Math.round(p.normalizedX * imageWidth),
        Math.round(p.normalizedY * imageHeight)
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
        console.log("Received mask data:", data);
        
        setCurrentMask(data.mask);
  
        // Force a redraw of the canvas
        await drawCanvas();
      } catch (error) {
        console.error('Error generating mask:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };
  

  const handleWheel = (e) => {
    //e.preventDefault();
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

    setZoom(newZoom);
    setPan(newPan);

    requestAnimationFrame(() => {
      setZoom(newZoom);
      setPan(newPan);
      debouncedDrawCanvas();
    });
  };

  const handleMouseDown = (e) => {
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      requestAnimationFrame(() => {
        setPan({ x: pan.x + deltaX, y: pan.y + deltaY });
        setLastPanPoint({ x: e.clientX, y: e.clientY });
        debouncedDrawCanvas();
      });
    }
  };

  const handleMouseUp = (e) => {
    if (e.button === 1) {
      setIsPanning(false);
    }
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    Promise.all(imageFiles.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => resolve({
            image: e.target.result.split(',')[1],
            width: img.width,
            height: img.height,
            masks: []
          });
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    })).then(loadedImages => {
      setImages(loadedImages);
      setCurrentImageIndex(0);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setPoints([]);
    }).catch(error => {
      console.error("Error loading images:", error);
    });
  };

  const handleNewLabel = () => {
    if (currentLabel && currentLabel.trim() !== '' && !labels.includes(currentLabel)) {
      setLabels([...labels, currentLabel]);
      setCurrentLabel('');
    }
  };

  const handleNewSegment = () => {
    setIsSegmenting(true);
    setSegmentMode(null);
    setPoints([]);
    setCurrentMask(null);
    if (images[currentImageIndex] && images[currentImageIndex].masks.length === 0) {
      initializeSAM(images[currentImageIndex]);
    }
  };

  const generateRandomColor = () => {
    const randomColor = Math.floor(Math.random()*16777215).toString(16);
    setMaskColor("#" + randomColor);
  };

const initializeSAM = async (image) => {
  const formData = new FormData();
  
  // Convert base64 to Blob
  const base64Data = image.image;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], {type: 'image/png'});

  formData.append('file', blob, 'image.png');
  formData.append('initialize', 'true');

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


  const handleSaveSegment = () => {
    if (currentLabel && points.length > 0 && currentMask) {
      const newMask = {
        mask: currentMask,
        color: maskColor,
        label: labels.indexOf(currentLabel),
        points: points
      };

      setImages(prevImages => {
        const updatedImages = [...prevImages];
        updatedImages[currentImageIndex] = {
          ...updatedImages[currentImageIndex],
          masks: [...updatedImages[currentImageIndex].masks, newMask]
        };
        return updatedImages;
      });

      setIsSegmenting(false);
      setSegmentMode(null);
      setPoints([]);
      setCurrentMask(null);
    }
  };

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
      setPoints([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCurrentMask(null);
    }
  };

  const handleNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      setPoints([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCurrentMask(null);
    }
  };
  
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-64 h-full bg-gray-800 shadow-lg p-4 flex flex-col space-y-4 overflow-y-auto">
        <Input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Enter project name"
          className="bg-gray-700 text-white border-blue-500"
        />

        <Select 
          value={currentLabel} 
          onValueChange={setCurrentLabel}
          disabled={labels.length === 0}
        >
          <SelectTrigger className="w-full bg-gray-700 text-white border-blue-500">
            <SelectValue placeholder="Select a label" />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 text-white">
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
          value={currentLabel}
          onChange={(e) => setCurrentLabel(e.target.value)}
          placeholder="Enter new label"
          className="bg-gray-700 text-white border-blue-500"
        />

        <Button onClick={handleNewLabel} disabled={!currentLabel.trim()} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
          <Plus className="mr-2 h-4 w-4" /> Add Label
        </Button>

        <Button onClick={handleNewSegment} disabled={!currentLabel || isSegmenting} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
          <Plus className="mr-2 h-4 w-4" /> New Segment
        </Button>

        <Button onClick={() => setSegmentMode('add')} disabled={!isSegmenting} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
          Add Regions
        </Button>

        <Button onClick={() => setSegmentMode('remove')} disabled={!isSegmenting} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
          Remove Regions
        </Button>

        <Button onClick={handleSaveSegment} disabled={!isSegmenting || points.length === 0} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
          <Save className="mr-2 h-4 w-4" /> Save Segment
        </Button>

        <Button onClick={() => fileInputRef.current.click()} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
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
          <Button onClick={generateRandomColor} className="text-xs bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
            Random Color
          </Button>
        </div>

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
        </div>

        {isLoading && <span className="text-white">Generating mask...</span>}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {/* Navigation Controls */}
        <div className="flex justify-between items-center p-4">
          <Button onClick={handlePrevImage} disabled={currentImageIndex === 0} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous Image
          </Button>
          <span className="text-lg font-semibold text-white">
            Image {currentImageIndex + 1} of {images.length}
          </span>
          <Button onClick={handleNextImage} disabled={currentImageIndex === images.length - 1} className="bg-gray-700 hover:bg-gray-600 text-white border border-blue-500">
            Next Image <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            className="border border-gray-600 bg-black max-w-full max-h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default SAMSegmentationUI;