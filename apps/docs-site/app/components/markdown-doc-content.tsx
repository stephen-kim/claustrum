import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { MarkdownMermaid } from './markdown-mermaid';

type Props = {
  body: string;
};

type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
};

type MdNodeWithChildren = MdNode & { children: MdNode[] };

const ADMONITION_KIND_SET = new Set(['info', 'note', 'tip', 'important', 'warning', 'caution', 'danger']);

function normalizeAdmonitionKind(raw: string): string {
  const normalized = raw.toLowerCase();
  if (normalized === 'warn') {
    return 'warning';
  }
  if (normalized === 'error') {
    return 'danger';
  }
  return ADMONITION_KIND_SET.has(normalized) ? normalized : 'info';
}

function isParagraph(node: MdNode | undefined): node is MdNodeWithChildren {
  return Boolean(node && node.type === 'paragraph' && Array.isArray(node.children));
}

function applyAdmonitionMetadata(blockquoteNode: MdNode): void {
  if (!Array.isArray(blockquoteNode.children) || blockquoteNode.children.length === 0) {
    return;
  }

  const firstChild = blockquoteNode.children[0];
  if (!isParagraph(firstChild) || firstChild.children.length === 0) {
    return;
  }

  const firstText = firstChild.children[0];
  if (!firstText || firstText.type !== 'text' || typeof firstText.value !== 'string') {
    return;
  }

  const markerMatch = firstText.value.match(/^\s*\[!([A-Za-z]+)\]\s*/);
  if (!markerMatch) {
    return;
  }

  const kind = normalizeAdmonitionKind(markerMatch[1] || 'info');
  const stripped = firstText.value.replace(markerMatch[0], '');

  if (stripped.length > 0) {
    firstText.value = stripped;
  } else {
    firstChild.children.shift();
    if (firstChild.children.length === 0) {
      blockquoteNode.children.shift();
    }
  }

  blockquoteNode.data = {
    ...blockquoteNode.data,
    hName: 'aside',
    hProperties: {
      ...(blockquoteNode.data?.hProperties || {}),
      className: ['admonition', `admonition-${kind}`],
      'data-admonition': kind,
    },
  };
}

function visitNode(node: MdNode): void {
  if (node.type === 'blockquote') {
    applyAdmonitionMetadata(node);
  }

  if (!Array.isArray(node.children)) {
    return;
  }
  for (const child of node.children) {
    visitNode(child);
  }
}

function remarkAdmonitionBlocks() {
  return (tree: MdNode) => {
    visitNode(tree);
  };
}

const components: Components = {
  code({ className, children, ...props }) {
    const languageMatch = /language-([\w-]+)/.exec(className || '');
    const language = languageMatch?.[1]?.toLowerCase();

    if (language === 'mermaid') {
      const chart = String(children ?? '').replace(/\n$/, '');
      return <MarkdownMermaid chart={chart} />;
    }

    return (
      <code
        className={className}
        {...props}
      >
        {children}
      </code>
    );
  },
};

export function MarkdownDocContent({ body }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkAdmonitionBlocks]}
      rehypePlugins={[rehypeHighlight]}
      components={components}
    >
      {body}
    </ReactMarkdown>
  );
}
