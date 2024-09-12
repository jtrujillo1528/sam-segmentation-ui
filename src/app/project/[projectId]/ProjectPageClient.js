"use client"

import React, { useState, useEffect } from 'react';
import api from '../../../components/api';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { useRouter } from 'next/navigation';
import BucketCard from '../../../components/ui/bucketCard';

//to do
//Create component for outputs to be displayed within bucket card
//Add create output functionalities
//Add create output functionality which will create formatted data from edited dataset
//How to link segmentation UI to uploaded image data
//How to handle model training on the UI
//Create navigation bar to allow users to navigate between pages
//Fix log in dialog so that users can see what part of login is wrong
//add forgotten password functionality

const ProjectPageClient = ({ projectId }) => {
    const router = useRouter();
    const [project, setProject] = useState(null);
    const [buckets, setBuckets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isNewBucketModalOpen, setIsNewBucketModalOpen] = useState(false);
    const [newBucketName, setNewBucketName] = useState('');
    const [selectedDatasets, setSelectedDatasets] = useState([]);

    const fetchBuckets = async () => {
      try {
          const bucketsResponse = await api.get(`/project/${projectId}/buckets`);
          setBuckets(bucketsResponse.data);
      } catch (error) {
          console.error('Error fetching buckets:', error);
      }
    };

    useEffect(() => {
        const fetchProjectData = async () => {
            setIsLoading(true);
            
            if (!projectId) {
                console.error('Project ID is undefined');
                setIsLoading(false);
                return;
            }

            try {
                const [projectResponse, bucketsResponse] = await Promise.all([
                    api.get(`/project/${projectId}`),
                    api.get(`/project/${projectId}/buckets`)
                ]);

                setProject(projectResponse.data);
                setBuckets(bucketsResponse.data);
            } catch (error) {
                console.error('Error fetching project data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProjectData();
    }, [projectId]);

    const handleCreateBucket = async (e) => {
      e.preventDefault();
      try {
          const formData = new FormData();
          formData.append('name', newBucketName);
  
          await api.post(`/project/${projectId}/new-bucket`, formData, {
              headers: {
                  'Content-Type': 'multipart/form-data',
              },
          });
          
          await fetchBuckets();
          setIsNewBucketModalOpen(false);
          setNewBucketName('');
      } catch (error) {
          console.error('Error creating bucket:', error);
          if (error.response && error.response.status === 401) {
              router.push('/login');
          }
      }
  };

  const handleDeleteBucket = async (bucketId) => {
    try {
        await api.delete(`/project/${projectId}/bucket/${bucketId}`);
        await fetchBuckets();
    } catch (error) {
        console.error('Error deleting bucket:', error);
    }
};

const handleDeleteDataset = async (bucketId, datasetId) => {
    try {
        await api.delete(`/project/${projectId}/bucket/${bucketId}/dataset/${datasetId}`);
        await fetchBuckets();
    } catch (error) {
        console.error('Error deleting dataset:', error);
    }
};

const refreshBuckets = async () => {
  try {
      const bucketsResponse = await api.get(`/project/${projectId}/buckets`);
      setBuckets(bucketsResponse.data);
  } catch (error) {
      console.error('Error refreshing buckets:', error);
  }
};

const handleAddDataset = async (bucketId, newDataset) => {
  try {
      // Update the local state with the new dataset
      setBuckets(prevBuckets => prevBuckets.map(bucket => {
          if (bucket._id === bucketId) {
              return {
                  ...bucket,
                  datasets: [...bucket.datasets, newDataset]
              };
          }
          return bucket;
      }));

      await fetchBuckets();
  } catch (error) {
      console.error('Error updating buckets after adding dataset:', error);
  }
};

const handleDatasetSelect = (dataset) => {
  setSelectedDatasets(prevSelected => {
      const isAlreadySelected = prevSelected.some(d => d.id === dataset.id);
      if (isAlreadySelected) {
          return prevSelected.filter(d => d.id !== dataset.id);
      } else {
          return [...prevSelected, dataset];
      }
  });
};

const handleProcessData = async () => {
    if (selectedDatasets.length > 0 && selectedDatasets.every(d => d.fileCount > 0)) {
      const datasetIds = selectedDatasets.map(d => d.id);
      try {
        const response = await api.post('/segmentation/initialize', { dataset_ids: datasetIds });
        if (response.data.output_id) {
          router.push(`/segmentation/${response.data.output_id}`);
        }
      } catch (error) {
        console.error('Error initializing data prep:', error);
        if (error.response) {
          console.error('Error response:', error.response.data);
        }
        if (error.response && error.response.status === 401) {
          router.push('/login');
        }
      }
    }
  };


    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-4">Project: {project?.name}</h1>
      <p className="mb-6">Description: {project?.description}</p>

      <div className="flex items-center mb-8 space-x-4">
          <Button onClick={() => setIsNewBucketModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              Create New Bucket
          </Button>
          <Button 
              onClick={handleProcessData} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={selectedDatasets.length === 0 || selectedDatasets.some(d => d.fileCount === 0)}
          >
              Process Data ({selectedDatasets.length})
          </Button>
      </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {buckets.map((bucket) => (
                    <BucketCard 
                    key={bucket._id} 
                    bucket={bucket} 
                    onDelete={handleDeleteBucket}
                    onDeleteDataset={handleDeleteDataset}
                    onAddDataset={handleAddDataset}
                    onSelectDataset={handleDatasetSelect}
                    selectedDatasets={selectedDatasets}
                    refreshBuckets={refreshBuckets}
                />
              ))}
          </div>

            <Dialog open={isNewBucketModalOpen} onOpenChange={setIsNewBucketModalOpen}>
                <DialogContent className="bg-gray-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Create New Bucket</DialogTitle>
                        <DialogDescription>
                          Enter a name for your new bucket. Buckets help you organize your datasets and outputs.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateBucket}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="name" className="text-right">Name</label>
                                <Input
                                    id="name"
                                    value={newBucketName}
                                    onChange={(e) => setNewBucketName(e.target.value)}
                                    className="col-span-3 bg-gray-700 text-white border-blue-500"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Create Bucket</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProjectPageClient;