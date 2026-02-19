# Autorización con GitHub

En Claustrum, GitHub es la autoridad principal para permisos a nivel de proyecto.

## Resumen

- Cada workspace conecta su instalación de GitHub App.
- Se sincroniza el inventario de repositorios en ese workspace.
- Los roles de proyecto se derivan de permisos reales de GitHub.

## Regla repo -> proyecto

- Clave por defecto: `github:owner/repo`
- Modo shared: un proyecto por repo
- Modo split: puede crear subproyectos (`repo#subpath`) según política

## Cálculo de permisos

```text
final_perm = max(direct_collaborator_perm, team_derived_perm)
```

Orden de prioridad:

```text
admin > maintain > write > triage > read
```

## Team mapping

Se combinan estas relaciones:

- repo -> teams
- team -> members
- member -> Claustrum user link

Después se aplica el mapping `github permission -> Claustrum role`.

## Recálculo parcial por webhook

- `installation_repositories`: solo repos cambiados
- `team` / `membership`: solo repos impactados
- `repository` rename: refresh de metadata
- `team_add` / `team_remove`: invalidación de caché + recálculo

## Caché utilizada

- `github_repo_teams_cache`
- `github_team_members_cache`
- `github_permission_cache`

Reglas:

- TTL en lecturas normales
- invalidación por alcance del evento
- el recálculo sobreescribe la caché de permisos

## Modo de sincronización

| Modo | Comportamiento |
| --- | --- |
| `add_only` | Agrega/eleva roles, no remueve acceso previo |
| `add_and_remove` | Ajusta roles al estado actual de GitHub (con protecciones) |

## Checklist operativo

1. instalación conectada
2. repo sync y links correctos
3. user link existente
4. permission preview correcto
5. webhook + auditoría sin errores
