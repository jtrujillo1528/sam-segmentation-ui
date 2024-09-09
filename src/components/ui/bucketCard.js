import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog';

const BucketCard = ({ bucket, onDelete }) => {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const handleDelete = () => {
        setShowDeleteDialog(true);
    };

    const confirmDelete = () => {
        onDelete(bucket._id);
        setShowDeleteDialog(false);
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
                    <Button
                        onClick={handleDelete}
                        className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700"
                    >
                        <Trash2 size={16} />
                    </Button>
                )}
                <CardHeader>
                    <CardTitle>{bucket.name}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2">Datasets</h3>
                        <div className="h-40 overflow-y-auto">
                            {bucket.datasets.length > 0 ? (
                                bucket.datasets.map((dataset) => (
                                    <div key={dataset.id} className="mb-2">
                                        <p className="font-medium">{dataset.name}</p>
                                        <p className="text-sm text-gray-400">Type: {dataset.type}</p>
                                    </div>
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
                        <Button onClick={() => setShowDeleteDialog(false)} variant="outline">Cancel</Button>
                        <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default BucketCard;