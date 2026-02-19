import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOutboundTemplateVariablesCatalog,
  renderOutboundMessage,
  resolveOutboundLocale,
} from './outbound-renderer.js';

test('resolveOutboundLocale prefers override, then policy, then workspace, then en', () => {
  const workspace = {
    defaultOutboundLocale: 'ko',
    supportedOutboundLocales: ['en', 'ko'],
  };
  const policy = {
    localeDefault: 'ja',
    supportedLocales: ['en', 'ja'],
    mode: 'template' as const,
    style: 'short' as const,
  };

  assert.equal(resolveOutboundLocale(workspace, policy), 'ja');
  assert.equal(resolveOutboundLocale(workspace, policy, 'ko'), 'ko');
  assert.equal(resolveOutboundLocale(workspace, { localeDefault: 'fr' }, undefined), 'ko');
  assert.equal(resolveOutboundLocale({}, {}, undefined), 'en');
});

test('renderOutboundMessage falls back to english template when locale template is missing', () => {
  const rendered = renderOutboundMessage({
    integrationType: 'slack',
    actionKey: 'outbound.render.preview',
    params: {},
    locale: 'zh',
    style: 'short',
    mode: 'template',
  });
  assert.equal(rendered, 'Outbound preview generated.');
});

test('renderOutboundMessage prefers template override over default template', () => {
  const renderedKo = renderOutboundMessage({
    integrationType: 'slack',
    actionKey: 'raw.search',
    params: { q: 'memory', count: 2 },
    locale: 'ko',
    style: 'short',
    mode: 'template',
    templateOverrides: {
      'raw.search': {
        en: 'Override "{{ q }}" ({{ count }})',
        ko: '오버라이드 "{{ q }}" ({{ count }})',
      },
    },
  });
  assert.equal(renderedKo, '오버라이드 "memory" (2)');

  const renderedEs = renderOutboundMessage({
    integrationType: 'slack',
    actionKey: 'raw.search',
    params: { q: 'memory', count: 2 },
    locale: 'es',
    style: 'short',
    mode: 'template',
    templateOverrides: {
      'raw.search': {
        en: 'Override "{{ q }}" ({{ count }})',
      },
    },
  });
  assert.equal(renderedEs, 'Override "memory" (2)');
});

test('renderOutboundMessage keeps legacy {var} placeholders working', () => {
  const rendered = renderOutboundMessage({
    integrationType: 'slack',
    actionKey: 'raw.search',
    params: { q: 'legacy', count: 9 },
    locale: 'en',
    style: 'short',
    mode: 'template',
    templateOverrides: {
      'raw.search': {
        en: 'Legacy "{q}" ({count})',
      },
    },
  });
  assert.equal(rendered, 'Legacy "legacy" (9)');
});

test('buildOutboundTemplateVariablesCatalog returns liquid engine and action variables', () => {
  const catalog = buildOutboundTemplateVariablesCatalog({
    integrationType: 'slack',
    templateOverrides: {
      'raw.search': {
        en: 'Search "{{ q }}" count={{ count }} branch={{ branch }}',
      },
    },
  });
  assert.equal(catalog.engine, 'liquid');
  assert.equal(catalog.integration_type, 'slack');
  const rawSearch = catalog.action_variables.find((item) => item.action_key === 'raw.search');
  assert.ok(rawSearch);
  assert.ok(rawSearch?.variables.some((item) => item.name === 'q'));
  assert.ok(rawSearch?.variables.some((item) => item.name === 'count'));
  assert.ok(rawSearch?.variables.some((item) => item.name === 'branch'));
});
