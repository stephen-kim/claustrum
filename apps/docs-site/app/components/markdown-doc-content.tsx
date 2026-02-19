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

function isShellLanguage(language?: string): boolean {
  return ['shell', 'bash', 'sh', 'zsh', 'powershell', 'pwsh'].includes((language || '').toLowerCase());
}

function normalizeCodeText(children: React.ReactNode): string | null {
  if (typeof children === 'string') {
    return children;
  }
  if (Array.isArray(children)) {
    if (children.every((item) => typeof item === 'string')) {
      return children.join('');
    }
  }
  return null;
}

function renderCliHighlighted(text: string): React.ReactNode {
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  return lines.map((line, lineIndex) => {
    const tokenRegex = /https?:\/\/\S+|&&|\|\||[|;]|--?[A-Za-z0-9._:/\\-]+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\s+|[^\s]+/g;
    const tokens = line.match(tokenRegex) || [];
    let commandMarked = false;

    return (
      <span key={`line-${lineIndex}`}>
        {tokens.map((token, tokenIndex) => {
          let className = '';

          if (/^\s+$/.test(token)) {
            className = '';
          } else if (/^https?:\/\/\S+$/i.test(token)) {
            className = 'token-shell-url';
          } else if (/^(?:&&|\|\||[|;])$/.test(token)) {
            className = 'token-shell-op';
            commandMarked = false;
          } else if (/^--?[A-Za-z0-9._:/\\-]+$/.test(token)) {
            if (!commandMarked && !token.startsWith('-')) {
              className = 'token-shell-command';
              commandMarked = true;
            } else if (token.startsWith('-')) {
              className = 'token-shell-flag';
            } else {
              className = 'token-shell-arg';
            }
          } else if (/^(?:".*"|'.*')$/.test(token)) {
            className = 'token-shell-string';
          } else {
            if (!commandMarked) {
              className = 'token-shell-command';
              commandMarked = true;
            } else {
              className = 'token-shell-arg';
            }
          }

          return (
            <span key={`tok-${lineIndex}-${tokenIndex}`} className={className}>
              {token}
            </span>
          );
        })}
        {lineIndex < lines.length - 1 ? '\n' : null}
      </span>
    );
  });
}

const components: Components = {
  code({ className, children, ...props }) {
    const languageMatch = /language-([\w-]+)/.exec(className || '');
    const language = languageMatch?.[1]?.toLowerCase();

    if (language === 'mermaid') {
      const chart = String(children ?? '').replace(/\n$/, '');
      return <MarkdownMermaid chart={chart} />;
    }

    if (isShellLanguage(language)) {
      const rawText = normalizeCodeText(children);
      if (rawText !== null) {
        return (
          <code className={`${className || ''} cli-highlight`} {...props}>
            {renderCliHighlighted(rawText)}
          </code>
        );
      }
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

const rehypeHighlightOptions = {
  ignoreMissing: true,
  aliases: {
    bash: ['shell', 'sh', 'zsh'],
    powershell: ['pwsh'],
  },
};

export function MarkdownDocContent({ body }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkAdmonitionBlocks]}
      rehypePlugins={[[rehypeHighlight, rehypeHighlightOptions]]}
      components={components}
    >
      {body}
    </ReactMarkdown>
  );
}
