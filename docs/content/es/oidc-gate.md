# Puerta OIDC

En Claustrum, OIDC se usa para autenticación y acceso inicial al workspace.  
La autorización principal a nivel de proyecto sigue siendo GitHub.

## Qué hace OIDC

- verifica identidad del usuario
- habilita la sesión a nivel workspace
- aplica el gate de acceso antes de evaluar roles de proyecto

OIDC es clave, pero no reemplaza a GitHub como autoridad de permisos de código.

## Clave de identidad

La identidad OIDC se fija con:

```text
(issuer, subject)
```

- el email puede cambiar, por eso no se usa como clave principal

## Group mapping

- prioriza `group_id` estable
- `group_display_name` es solo para UI
- el mapping de grupos puede ampliar acceso, pero GitHub sigue mandando en permisos de proyecto

## Modos de sincronización

| Modo | Significado |
| --- | --- |
| `add_only` | agrega grants nuevos y conserva grants existentes no relacionados |
| `add_and_remove` | reconcilia con el estado actual del mapping (con reglas de protección) |

## Por qué este diseño

- OIDC: SSO + ciclo de vida de identidad
- GitHub: ownership real de repos y permisos de código
- Manual override: excepción auditada

## Protecciones

- si falla OIDC gate, se bloquea acceso antes del cálculo de rol de proyecto
- identity links aislados por workspace
- mismatch en formato de group claim se trata como riesgo de configuración
