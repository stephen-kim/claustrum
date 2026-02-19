# Gestión de dependencias (estándar pnpm)

## Política

Claustrum usa **pnpm** como gestor de paquetes oficial.
En este repositorio, toda operación de dependencias debe hacerse con pnpm.

- Usar `pnpm` para instalar, ejecutar y actualizar
- Confirmar `pnpm-lock.yaml`
- No confirmar `package-lock.json` ni `yarn.lock`
- En CI usar `pnpm install --frozen-lockfile`
- No ejecutar `npm install` en este repositorio

## Por qué pnpm

- Instalaciones reproducibles con un único lockfile
- Mejor rendimiento y uso de disco
- Flujo monorepo más cómodo con `pnpm -r`

## Política de lockfiles

Obligatorio:
- `pnpm-lock.yaml`

Prohibido:
- `package-lock.json`
- `yarn.lock`

Si aparece un lockfile de npm o yarn por error, elimínalo y vuelve a instalar con pnpm.

## Estructura del workspace

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## Comandos de raíz

- `pnpm dev` → `pnpm -r dev`
- `pnpm build` → `pnpm -r build`
- `pnpm lint` → `pnpm -r lint`
- `pnpm test` → `pnpm -r test`

## Reglas de CI

CI debe ejecutar:

1. Setup de Node + pnpm
2. `pnpm install --frozen-lockfile`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm test`

## Desarrollo local

```bash
pnpm install
pnpm dev
```

Puedes usar filtros por paquete cuando haga falta:

```bash
pnpm --filter @claustrum/memory-core dev
pnpm --filter @claustrum/admin-ui build
```

## Protecciones

`.npmrc` aplica:

```ini
engine-strict=true
auto-install-peers=true
```
