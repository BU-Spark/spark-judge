import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./project-markdown.css";

/** Recover known Devpost labels only when an export flattened the whole field.
 * Normal Markdown, multiline prose, and code pass through unchanged. */
function prepareDescription(description: string) {
  const text = description.trim();
  if (/\r|\n|`/.test(text) || !/^## Inspiration\s/.test(text)) return text;
  return text
    .replace(
      /(?:^|\s)## (Inspiration|What it does|How we built it|Challenges we ran into|Accomplishments that we['’]re proud of|What we learned)(?=\s|$)\s*/g,
      "\n\n## $1\n\n",
    )
    .trim();
}

export function ProjectMarkdown({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={`project-markdown ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={["img", "input"]}
        components={{
          // Keep description headings below the containing project heading.
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h3>{children}</h3>,
          h3: ({ children }) => <h4>{children}</h4>,
          h4: ({ children }) => <h5>{children}</h5>,
          h5: ({ children }) => <h6>{children}</h6>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div
              className="project-markdown-table"
              tabIndex={0}
              role="region"
              aria-label="Project description table"
            >
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {prepareDescription(children)}
      </Markdown>
    </div>
  );
}
