import React, { useState } from 'react';
import { Button } from './button';
import { Trash2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog';
import AddDataModal from './addDataModal';

export const DatasetItem = ({ dataset, bucketId, onDelete, onAddData }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showAddDataModal, setShowAddDataModal] = useState(false);

    const handleDelete = () => {
        setShowDeleteDialog(true);
    };

    const confirmDelete = () => {
        onDelete(dataset.id);
        setShowDeleteDialog(false);
    };

    const handleAddData = () => {
        setShowAddDataModal(true);
    };

    return (
        <>
            <div 
                className="flex items-center justify-between p-2 hover:bg-gray-700 rounded"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div>
                    <p className="font-medium">{dataset.name}</p>
                    <p className="text-sm text-gray-400">Type: {dataset.type}</p>
                    <p className="text-sm text-gray-400">Files: {dataset.fileCount}</p>
                </div>
                {isHovered && (
                    <div className="flex space-x-2">
                        <Button
                            onClick={handleAddData}
                            className="p-2 bg-green-600 hover:bg-green-700"
                        >
                            <Plus size={16} />
                        </Button>
                        <Button
                            onClick={handleDelete}
                            className="p-2 bg-red-600 hover:bg-red-700"
                        >
                            <Trash2 size={16} />
                        </Button>
                    </div>
                )}
            </div>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="bg-gray-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the dataset "{dataset.name}"? 
                            This will permanently delete all associated files. 
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setShowDeleteDialog(false)} variant="outline">Cancel</Button>
                        <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AddDataModal 
                isOpen={showAddDataModal}
                onClose={() => setShowAddDataModal(false)}
                datasetId={dataset.id}
                datasetType={dataset.type}
                bucketId={bucketId}
                onDataAdded={onAddData}
            />
        </>
    );
};