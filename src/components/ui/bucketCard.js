import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Trash2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './dialog';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { DatasetItem } from './datasetItem';
import api from '../api';


export const BucketCard = ({ bucket, onDelete, onDeleteDataset, onAddDataset, refreshBuckets}) => {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showAddDatasetDialog, setShowAddDatasetDialog] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [newDatasetName, setNewDatasetName] = useState('');
    const [newDatasetType, setNewDatasetType] = useState('Select dataset type');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = () => {
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await onDelete(bucket._id);
        } catch (error) {
            console.error('Error deleting bucket:', error);
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const handleDatasetTypeChange = (value) => {
        setNewDatasetType(value);
    };

    const handleAddDataset = async () => {
        try {
            const formData = new FormData();
            formData.append('name', newDatasetName);
            formData.append('type', newDatasetType);

            const response = await api.post(`/bucket/${bucket._id}/new-dataset`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            console.log('API response:', response.data); // Debug log

            onAddDataset(bucket._id, response.data);
            setShowAddDatasetDialog(false);
            setNewDatasetName('');
            setNewDatasetType("Select dataset type");
        } catch (error) {
            console.error('Error adding dataset:', error);
            if (error.response) {
                console.error('Error response:', error.response.data);
            }
        }
    };

    const handleAddData = async () => {
        await refreshBuckets();
    };
    
    return (
        <>
            <Card 
                key={bucket._id} 
                className="bg-gray-800 relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {isHovered && (
              <div className="absolute top-2 right-2 opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
              >
                <Trash2 className= "h-4 w-4 text-red-500 cursor-pointer hover:text-red-700 transition-colors" />
              </Button>
            </div>
                )}
                <CardHeader>
                    <CardTitle>{bucket.name}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold">Datasets</h3>
                            <Button
                                onClick={() => setShowAddDatasetDialog(true)}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                New Dataset
                            </Button>
                        </div>
                        <div className="h-40 overflow-y-auto">
                            {bucket.datasets.length > 0 ? (
                                bucket.datasets.map((dataset) => (
                                    <DatasetItem 
                                        key={dataset.id}
                                        dataset={dataset}
                                        bucketId={bucket._id}
                                        onDelete={(datasetId) => onDeleteDataset(bucket._id, datasetId)}
                                        onAddData={() => handleAddData}
                                        refreshBuckets={refreshBuckets}
                                    />
                                ))
                            ) : (
                                <p>No datasets available</p>
                            )}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Outputs</h3>
                        <div className="h-40 overflow-y-auto">
                            {bucket.outputs.length > 0 ? (
                                bucket.outputs.map((output) => (
                                    <div key={output.id} className="mb-2">
                                        <p className="font-medium">{output.name}</p>
                                        <p className="text-sm text-gray-400">Format: {output.format}</p>
                                    </div>
                                ))
                            ) : (
                                <p>No outputs available</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="bg-gray-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the bucket "{bucket.name}"? 
                            This will permanently delete all associated datasets and outputs. 
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setShowDeleteDialog(false)} variant="outline" disabled={isDeleting}>Cancel</Button>
                        <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700" disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showAddDatasetDialog} onOpenChange={setShowAddDatasetDialog}>
                <DialogContent className="bg-gray-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Add New Dataset</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="name" className="text-right">Name</label>
                            <Input
                                id="name"
                                value={newDatasetName}
                                onChange={(e) => setNewDatasetName(e.target.value)}
                                className="col-span-3 bg-gray-700 text-white border-gray-600"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="type" className="text-right">Type</label>
                            <div className="col-span-3">
                                <Select onValueChange={handleDatasetTypeChange} value={newDatasetType}>
                                    <SelectTrigger className="w-full bg-gray-700 text-white border-gray-600">
                                        <SelectValue placeholder= {newDatasetType} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-700 text-white">
                                        <SelectItem value="image">Image</SelectItem>
                                        <SelectItem value="text">Text</SelectItem>
                                        <SelectItem value="audio">Audio</SelectItem>
                                        <SelectItem value="video">Video</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowAddDatasetDialog(false)} variant="outline" className="bg-gray-700 text-white hover:bg-gray-600">Cancel</Button>
                        <Button onClick={handleAddDataset} className="bg-green-600 hover:bg-green-700">Add Dataset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default BucketCard;