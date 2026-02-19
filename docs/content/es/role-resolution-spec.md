# Especificación de resolución de roles

## Fórmula base

```python
effective_role = max(
    manual_override,
    github_role,
    oidc_role
)

access_allowed = (
    oidc_gate_passed
    AND effective_role != none
)
```

## Entradas

- `manual_override`: excepción explícita de admin
- `github_role`: resultado de sync de permisos GitHub
- `oidc_role`: rol derivado de mapeo OIDC
- `oidc_gate_passed`: gate de acceso OIDC superado

## Jerarquía

### Workspace

| Rank | Role |
| --- | --- |
| 3 | owner |
| 2 | admin |
| 1 | member |
| 0 | none |

### Project

| Rank | Role |
| --- | --- |
| 4 | owner |
| 3 | maintainer |
| 2 | writer |
| 1 | reader |
| 0 | none |

## Modos de sincronización

### `add_only`

- agrega faltantes
- eleva rol cuando corresponde
- no elimina ni degrada

### `add_and_remove`

- agrega/actualiza/elimina
- respeta protección de owner
