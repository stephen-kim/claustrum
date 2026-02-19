# Autenticación y roles

Claustrum identifica al usuario con API key y luego aplica control de acceso por roles de workspace y proyecto.

## Modelo de roles

### Roles de workspace

- `owner`
- `admin`
- `member`

### Roles de proyecto

- `owner`
- `maintainer`
- `writer`
- `reader`

Nota:

- `owner/admin` de workspace puede hacer override de permisos de proyecto dentro del mismo workspace para recuperación operativa.

## Matriz rápida de permisos

| Acción | Rol mínimo |
| --- | --- |
| Ver miembros del workspace | workspace `member` |
| Gestionar miembros del workspace | workspace `admin` |
| Crear / listar proyectos | workspace `member` |
| Ver miembros del proyecto | project `reader` |
| Gestionar miembros del proyecto | project `maintainer` |
| Crear memoria | project `writer` |
| Leer memorias | project `reader` |
| Confirmar/rechazar decision | project `maintainer` |
| Raw search / raw view | `raw_access_min_role` (default: `writer`) |

## Política de acceso raw

- El rol mínimo para `/v1/raw/search` y `/v1/raw/messages/:id` se define con `workspace_settings.raw_access_min_role`.
- Valor por defecto: `writer`.
- Todo acceso raw se audita (`raw.search`, `raw.view`).

## Auditoría

Siempre se registran en `audit_logs` acciones críticas como:

- `memory.create`
- `memory.update`
- `memory.delete`
- `decision.confirm`
- `decision.reject`
- gestión de miembros y API keys

Última actualización: 2026-02-19
