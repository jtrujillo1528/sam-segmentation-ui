// components/ProjectCard.js
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const ProjectCard = ({ project, onClick }) => {
  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <CardHeader>
        <CardTitle>{project.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{project.description}</p>
      </CardContent>
    </Card>
  );
};

export default ProjectCard;