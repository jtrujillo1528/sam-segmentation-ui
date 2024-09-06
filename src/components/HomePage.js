'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Trash2 } from 'lucide-react';

const HomePage = () => {
  const [projects, setProjects] = useState([]);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleProjectClick = (projectId) => {
    console.log('Navigating to project:', projectId);
    router.push(`/project/${projectId}`);
  };

  const handleNewProject = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/projects', { name: newProjectName, description: newProjectDescription });
      setProjects([...projects, response.data]);
      setIsNewProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
    } catch (error) {
      console.error('Error creating new project:', error);
    }
  };

  const handleDeleteClick = (e, project) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setIsDeleteConfirmModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.post('/delete_project', projectToDelete.id);
      setProjects(projects.filter(p => p.id !== projectToDelete.id));
      setIsDeleteConfirmModalOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Welcome to Your Dashboard</h1>
      
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Your Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card 
              key={project.id} 
              className="bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer group relative" 
              onClick={() => handleProjectClick(project.id)}
            >
              <CardHeader>
                <CardTitle>
                  <a href={`/project/${project.id}`} onClick={(e) => e.stopPropagation()} className="text-blue-400 hover:underline">
                    {project.name}
                  </a>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300">{project.description}</p>
              </CardContent>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDeleteClick(e, project)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
        <Button 
          onClick={() => setIsNewProjectModalOpen(true)}
          className="mt-6 bg-blue-600 hover:bg-blue-700"
        >
          Add New Project
        </Button>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Your Devices</h2>
        <p className="text-gray-300">Device management coming soon...</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Your ML Models</h2>
        <p className="text-gray-300">ML model management coming soon...</p>
      </section>

      <Dialog open={isNewProjectModalOpen} onOpenChange={setIsNewProjectModalOpen}>
        <DialogContent className="bg-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleNewProject}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right">Name</label>
                <Input
                  id="name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="col-span-3 bg-gray-700 text-white border-blue-500"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="description" className="text-right">Description</label>
                <Textarea
                  id="description"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="col-span-3 bg-gray-700 text-white border-blue-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Create Project</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmModalOpen} onOpenChange={setIsDeleteConfirmModalOpen}>
        <DialogContent className="bg-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Are you sure you want to delete the project "{projectToDelete?.name}"? This action cannot be undone.
          </DialogDescription>
          <DialogFooter>
            <Button onClick={() => setIsDeleteConfirmModalOpen(false)} variant="outline">Cancel</Button>
            <Button onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomePage;