// import React from 'react';
// import ReactMarkdown from 'react-markdown';
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { dark } from 'react-syntax-highlighter/dist/esm/styles/prism';
// import remarkGfm from 'remark-gfm';

// interface MarkdownRendererProps {
//   content: string;
// }

// const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
//   return (
//     <ReactMarkdown
//       remarkPlugins={[remarkGfm]}
//       components={{
//         h1: ({node, ...props}) => <h1 className="text-4xl font-bold mb-6 mt-8" {...props} />,
//         h2: ({node, ...props}) => <h2 className="text-3xl font-semibold mb-4 mt-6" {...props} />,
//         h3: ({node, ...props}) => <h3 className="text-2xl font-medium mb-3 mt-5" {...props} />,
//         p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
//         ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4" {...props} />,
//         ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4" {...props} />,
//         li: ({node, ...props}) => <li className="mb-2" {...props} />,
//         blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4" {...props} />,
//         code({node, inline, className, children, ...props}) {
//           const match = /language-(\w+)/.exec(className || '');
//           return !inline && match ? (
//             <div className="mb-4 overflow-hidden rounded-md border border-gray-200">
//               <div className="bg-gray-100 px-4 py-2 text-sm font-mono text-gray-800">
//                 {match[1]}
//               </div>
//               <SyntaxHighlighter
//                 style={dark}
//                 language={match[1]}
//                 PreTag="div"
//                 customStyle={{
//                   margin: 0,
//                   borderRadius: 0,
//                 }}
//                 {...props}
//               >
//                 {String(children).replace(/\n$/, '')}
//               </SyntaxHighlighter>
//             </div>
//           ) : (
//             <code className="bg-gray-100 rounded px-1 py-0.5" {...props}>
//               {children}
//             </code>
//           );
//         },
//         img: ({node, ...props}) => <img className="max-w-full h-auto rounded-lg shadow-md my-4" {...props} />,
//         hr: ({node, ...props}) => <hr className="my-8 border-t border-gray-300" {...props} />,
//       }}
//     >
//       {content}
//     </ReactMarkdown>
//   );
// };

// export default MarkdownRenderer;

