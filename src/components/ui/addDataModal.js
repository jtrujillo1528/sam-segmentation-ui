import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { Input } from './input';
import api from '../api';

const AddDataModal = ({ isOpen, onClose, datasetId, datasetType, onDataAdded }) => {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        setFiles(Array.from(e.target.files));
        setError(null); // Clear any previous errors when new files are selected
    };

    const handleUpload = async () => {
        setUploading(true);
        setError(null);
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('fileName', file.name);
                formData.append('type', datasetType);

                const response = await api.post(`/dataset/${datasetId}/add-data`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
            }
            onDataAdded();
            onClose();
        } catch (err) {
            console.error('Error uploading files:', err);
            setError(err.response?.data?.detail || 'An error occurred while uploading files');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-gray-800 text-white">
                <DialogHeader>
                    <DialogTitle>Add Data to Dataset</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Input
                        type="file"
                        onChange={handleFileChange}
                        multiple
                        accept={datasetType === 'image' ? 'image/*' : undefined}
                        className="bg-gray-700 text-white border-gray-600"
                    />
                    <p className="mt-2 text-sm text-gray-400">
                        Selected files: {files.length}
                    </p>
                    {error && (
                        <p className="mt-2 text-sm text-red-500">
                            Error: {error}
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={onClose} variant="outline" className="bg-gray-700 text-white hover:bg-gray-600">
                        Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={files.length === 0 || uploading} className="bg-green-600 hover:bg-green-700">
                        {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddDataModal;