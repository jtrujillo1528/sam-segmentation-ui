import React, { useState } from 'react';
import { Button } from './button';
import { Trash2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog';
import AddDataModal from './addDataModal';

export const DatasetItem = ({ dataset, bucketId, onDelete, onAddData }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showAddDataModal, setShowAddDataModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = () => {
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await onDelete(dataset.id);
        } catch (error) {
            console.error('Error deleting dataset:', error);
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const handleAddData = () => {
        setShowAddDataModal(true);
    };

    return (
        <>
            <div 
                className="flex items-center justify-between p-2 hover:bg-gray-700 rounded relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="flex-grow">
                    <p className="font-medium">{dataset.name}</p>
                    <p className="text-sm text-gray-400">Type: {dataset.type}</p>
                    <p className="text-sm text-gray-400">Files: {dataset.fileCount}</p>
                </div>
                {isHovered && (
                    <div className="flex items-center space-x-2 absolute right-2 top-1/2 transform -translate-y-1/2">
                        <Button
                            onClick={handleAddData}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3 rounded text-sm"
                        >
                            Add Data
                        </Button>
                        <div className="w-8 h-8 flex items-center justify-center">
                            <Trash2
                                onClick={handleDelete}
                                className="h-4 w-4 text-red-500 cursor-pointer hover:text-red-700 transition-colors"
                            />
                        </div>
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
                        <Button onClick={() => setShowDeleteDialog(false)} variant="outline" disabled={isDeleting}>Cancel</Button>
                        <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700" disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
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