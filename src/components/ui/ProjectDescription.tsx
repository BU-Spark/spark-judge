import "./project-description.css";

export function ProjectDescription({
  description,
  projectName,
}: {
  description?: string;
  projectName: string;
}) {
  if (!description?.trim()) return null;
  return (
    <details className="project-description">
      <summary aria-label={`Description for ${projectName}`}>
        <span className="project-description-show">Show description</span>
        <span className="project-description-hide">Hide description</span>
      </summary>
      <p>{description}</p>
    </details>
  );
}
