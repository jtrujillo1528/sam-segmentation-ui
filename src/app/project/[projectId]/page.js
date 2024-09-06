import ProjectPageClient from './ProjectPageClient';

const ProjectPage = ({ params }) => {
    return <ProjectPageClient projectId={params.projectId} />;
};

export default ProjectPage;