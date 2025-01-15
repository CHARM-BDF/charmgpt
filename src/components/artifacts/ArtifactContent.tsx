import React from 'react';
import { Artifact } from '../../types/artifacts';

export const ArtifactContent: React.FC<{
  artifact: Artifact;
}> = ({ artifact }) => {
  const renderContent = () => {
    switch (artifact.type) {
      case 'code':
        return (
          <pre className="bg-gray-50 p-4 rounded-lg">
            <code>{artifact.content}</code>
          </pre>
        );
      case 'image/svg+xml':
        return <div dangerouslySetInnerHTML={{ __html: artifact.content }} />;
      case 'application/vnd.ant.mermaid':
        return <div className="mermaid">{artifact.content}</div>;
      default:
        return <div className="prose">{artifact.content}</div>;
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-lg font-medium">{artifact.title}</h3>
        <p className="text-sm text-gray-500">Type: {artifact.type}</p>
      </div>
      {renderContent()}
    </div>
  );
};
