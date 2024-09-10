"use client"

import React, { useState, useEffect } from 'react';
import api from '../../../components/api';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { useRouter } from 'next/navigation';
import BucketCard from '../../../components/ui/bucketCard';

//to do
//Create components for datasets and outputs to be displayed within bucket card
//Add create dataset and create output functionalities
//Add upload data functionality which creates rawData objects associated with with a dataset and s3 objects associated with each dataset
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
  
          const response = await api.post(`/project/${projectId}/new-bucket`, formData, {
              headers: {
                  'Content-Type': 'multipart/form-data',
              },
          });
          
          // Refresh buckets after creating a new one
          const bucketsResponse = await api.get(`/project/${projectId}/buckets`);
          setBuckets(bucketsResponse.data);
          setIsNewBucketModalOpen(false);
          setNewBucketName('');
      } catch (error) {
          console.error('Error creating bucket:', error);
          if (error.response) {
              console.error('Error response:', error.response.data);
          }
          // Handle unauthorized errors here, e.g., redirect to login page
          if (error.response && error.response.status === 401) {
              router.push('/login');
          }
      }
    };

    const handleDeleteBucket = async (bucketId) => {
      try {
          await api.delete(`/project/${projectId}/bucket/${bucketId}`);
          // Refresh buckets after deleting
          const bucketsResponse = await api.get(`/project/${projectId}/buckets`);
          setBuckets(bucketsResponse.data);
      } catch (error) {
          console.error('Error deleting bucket:', error);
      }
  };

  const handleDeleteDataset = async (bucketId, datasetId) => {
    try {
        await api.delete(`/project/${projectId}/bucket/${bucketId}/dataset/${datasetId}`);
        // Refresh buckets after deleting dataset
        const bucketsResponse = await api.get(`/project/${projectId}/buckets`);
        setBuckets(bucketsResponse.data);
    } catch (error) {
        console.error('Error deleting dataset:', error);
    }
};

const handleAddDataToDataset = async (bucketId, datasetId) => {
    // Implement logic to add data to dataset
    // This could open a modal for file upload or navigate to a new page
    console.log(`Add data to dataset ${datasetId} in bucket ${bucketId}`);
};

const handleAddDataset = async (bucketId, newDataset) => {
  console.log('handleAddDataset called in ProjectPageClient', { bucketId, newDataset }); // Debug log
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

      // Optionally, you can refetch the buckets to ensure sync with the server
      const bucketsResponse = await api.get(`/project/${projectId}/buckets`);
      setBuckets(bucketsResponse.data);
  } catch (error) {
      console.error('Error updating buckets after adding dataset:', error);
  }
};

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!project) {
        return <div>Project not found</div>;
    }

    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
          <h1 className="text-3xl font-bold mb-8">{project?.name}</h1>
          <p className="mb-4">{project?.description}</p>

          <Button onClick={() => setIsNewBucketModalOpen(true)} className="mb-8 bg-blue-600 hover:bg-blue-700">
              Create New Bucket
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {buckets.map((bucket) => (
                  <BucketCard 
                      key={bucket._id} 
                      bucket={bucket} 
                      onDelete={handleDeleteBucket}
                      onDeleteDataset={handleDeleteDataset}
                      onAddDataToDataset={handleAddDataToDataset}
                      onAddDataset={handleAddDataset}
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