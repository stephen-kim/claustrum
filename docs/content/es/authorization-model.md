# Resumen del modelo de autorización

## Principios

Claustrum aplica estas reglas base:

- aislamiento estricto por workspace
- GitHub como autoridad principal para permisos de proyecto
- OIDC como puerta de autenticacion/acceso
- override manual solo como excepcion auditada

## Flujo

```text
User
  ↓
OIDC Login (Gate)
  ↓
Workspace Membership Check
  ↓
GitHub Permission Sync
  ↓
Manual Override
  ↓
Effective Role
  ↓
Project Access
```text

## Prioridad de resolucion

1. `manual_override`
2. `github_derived_role`
3. `oidc_boost_role`
4. `default_none`

## Escenarios tipicos

- GitHub `write` + sin grupo OIDC -> `writer`
- GitHub `read` + boost OIDC -> se usa el mayor rol
- override manual activo -> manda el override
- falla OIDC gate -> acceso denegado

## Reglas operativas

- proteger owner para evitar borrados accidentales
- usar excepciones manuales con vigencia limitada
- toda transicion sensible debe quedar en auditoría
