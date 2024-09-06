"use client"

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from './api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useRouter } from 'next/navigation';

const ProjectPage = () => {
    const router = useRouter();
    const [project, setProject] = useState(null);
    const [images, setImages] = useState([]);


    useEffect(() => {
        console.log('Router object:', router);
        console.log('Router query:', router.query);
        console.log('Router asPath:', router.asPath);
        console.log('Router pathname:', router.pathname);

        if (!router.isReady) return;

        const fetchProjectData = async () => {
            setIsLoading(true);
            let projectId = router.query.projectId;

            // If projectId is not in query, try to extract it from the path
            if (!projectId && router.asPath) {
                const pathParts = router.asPath.split('/');
                projectId = pathParts[pathParts.length - 1];
            }

            console.log('Extracted projectId:', projectId);

            if (!projectId) {
                console.error('Project ID is undefined');
                setIsLoading(false);
                return;
            }

            try {
                const [projectResponse, imagesResponse] = await Promise.all([
                    api.get(`/projects/${projectId}`),
                    api.get(`/projects/${projectId}/images`)
                ]);

                setProject(projectResponse.data);
                setImages(imagesResponse.data);
            } catch (error) {
                console.error('Error fetching project data:', error);
                // Handle error (e.g., show error message to user)
            } finally {
                setIsLoading(false);
            }
        };

        fetchProjectData();
    }, [router.isReady, router.query, router.asPath]);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    const formData = new FormData();
    formData.append('image', file);

    try {
      await api.post(`/project/${projectId}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchProjectImages();
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  const handleGenerateYOLOv8Masks = async () => {
    try {
      await api.post(`/project/${projectId}/generate-yolov8-masks`);
      alert('YOLOv8 masks generated successfully!');
    } catch (error) {
      console.error('Error generating YOLOv8 masks:', error);
      alert('Error generating YOLOv8 masks. Please try again.');
    }
  };



  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">{project.name}</h1>
      <p className="mb-4">{project.description}</p>

      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Upload Images</h2>
        <input type="file" onChange={handleImageUpload} accept="image/*" className="mb-4" />
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Project Images</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="bg-gray-800">
              <CardHeader>
                <CardTitle>{image.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <img src={image.url} alt={image.name} className="w-full h-48 object-cover" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex space-x-4">
        <Link to={`/segmentation/${projectId}`}>
          <Button className="bg-blue-600 hover:bg-blue-700">
            Go to Segmentation UI
          </Button>
        </Link>
        <Button onClick={handleGenerateYOLOv8Masks} className="bg-green-600 hover:bg-green-700">
          Generate YOLOv8 Masks
        </Button>
      </div>
    </div>
  );
};

export default ProjectPage;