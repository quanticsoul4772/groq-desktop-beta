import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeKatex from 'rehype-katex';
import "katex/dist/katex.min.css";

const newLineRegex = /\n/;
const newLineAtTheEndRegex = /\n$/;
const codeLanguageRegex = /language-(\w+)/;
const imageFileExtensionsRegex = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i;
const components={
          // Custom renderer for code blocks to add syntax highlighting
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark} // Apply the chosen theme
                language={match[1]}
                PreTag="div"
                className="rounded-lg"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          h1: ({ node: _, children, ...props }) => (
            <h1 className="text-3xl font-bold mb-4 mt-6" {...props}>
              {children}
            </h1>
          ),
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          h2: ({ node: _, children, ...props }) => (
            <h2 className="text-2xl font-semibold mb-3 mt-5" {...props}>
              {children}
            </h2>
          ),
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          h3: ({ node: _, children, ...props }) => (
            <h3 className="text-xl font-medium mb-3 mt-4" {...props}>
              {children}
            </h3>
          ),
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          h4: ({ node: _, children, ...props }) => (
            <h4 className="text-lg font-medium mb-2 mt-3" {...props}>
              {children}
            </h4>
          ),
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          h5: ({ node: _, children, ...props }) => (
            <h5 className="text-base font-medium mb-2 mt-3" {...props}>
              {children}
            </h5>
          ),
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          h6: ({ node: _, children, ...props }) => (
            <h6 className="text-sm font-medium mb-1 mt-2" {...props}>
              {children}
            </h6>
          ),
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          tr: ({ node: _, ...props }) => <tr className="border-b" {...props} />,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          td: ({ node: _, children, ...props }) => {
            return (
              <td
                className="border-r border-gray-200 p-2 font-semibold first:border-l text-left"
                {...props}
              >
                {children}
              </td>
            );
          },
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          th: ({ node: _, children, ...props }) => {
            return (
              <th
                className="border-r border-gray-200 p-2 font-semibold first:border-l border-t text-left"
                {...props}
              >
                {children}
              </th>
            );
          },
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          table: ({ node: _, ...props }) => (
            <table className="table-auto w-full mb-4" {...props} />
          ),
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          thead: ({ node: _, ...props }) => (
            <thead className="bg-gray-100 dark:bg-shallow text-left" {...props} />
          ),
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          tbody: ({ node: _, ...props }) => <tbody {...props} />,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          ol: ({ node: _, children, ...props }) => {
            return (
              <ol
                className="ml-5 mb-4 list-decimal"
                {...props}
              >
                {children}
              </ol>
            );
          },
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          ul: ({ node: _, children, ...props }) => {
            return (
              <ul
                className="ml-5 mb-4"
                {...props}
              >
                {children}
              </ul>
            );
          },
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          li: ({ node: _, ...props }) => <li className="ml-5" {...props} />,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          p({ children, ...props }) {
            return (
              <p className="text-left mb-4" {...props}>
                {children}
              </p>
            );
          },
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          img({ src, alt, ...props }) {
            // biome-ignore lint/a11y/useAltText: <explanation>
            return <img src={src} alt={alt} {...props} />;
          },
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          a({ href, children, ...props }) {
            // Check if the href is an image link
            const isImageLink = href && imageFileExtensionsRegex.test(href);
            if (isImageLink) {
              return (
                <div>
                  <a href={href} {...props} target={"_blank"} rel="noreferrer">
                    {children}
                  </a>
                  <div className="mt-2">
                    <img
                      src={href}
                      alt={`Image at ${href}`}
                      className="max-w-full h-auto"
                    />
                  </div>
                </div>
              );
            }
            // Default link rendering for non-image links
            return (
              <a
                href={href}
                {...props}
                target={"_blank"}
                rel="noreferrer"
                className="text-primaryaccent hover:text-[#0AAFC8]"
              >
                {children}
              </a>
            );
          },
        }
function MarkdownRenderer({ content }) {
  content=content.replace(/\\\[/g, "$$$$\n")
    .replace(/\\\]/g, "\n$$$$")
    .replace(/\\\(/g, "$$")
    .replace(/\\\)/g, "$$")
    .replace(/```latex([\s\S]*?)```/g, "$$$$$1$$$$");
  return (
    <div className="markdown-content">
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm, remarkMath]} // Enable GitHub Flavored Markdown
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer; 