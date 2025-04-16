// 为没有内置类型声明的模块提供声明

declare module 'react-markdown' {
  import { ReactElement } from 'react';
  
  interface ReactMarkdownProps {
    children: string;
    rehypePlugins?: any[];
    remarkPlugins?: any[];
    components?: Record<string, React.ComponentType<any>>;
    className?: string;
  }
  
  export default function ReactMarkdown(props: ReactMarkdownProps): ReactElement;
}

declare module 'rehype-raw' {
  const rehypeRaw: any;
  export default rehypeRaw;
}

declare module 'remark-gfm' {
  const remarkGfm: any;
  export default remarkGfm;
} 