# Inicio

Claustrum es una capa de memoria compartida para equipos que trabajan con IA.  
Te ayuda a mantener el contexto entre repositorios, herramientas y personas sin perder continuidad.

## Qué puedes hacer

- Guardar y recuperar memoria estructurada (`decision`, `constraint`, `active_work`, `activity`)
- Ejecutar MCP de forma segura (`stdout` solo para JSON-RPC)
- Integrar permisos de GitHub y control de acceso con OIDC
- Operar con trazabilidad (auditoría, timeline y retención)
- Mejorar la calidad del contexto con Context Bundle, Global Rules, Persona y Debug

## Empieza por aquí

- [Instalación](installation)
- [Variables de entorno](environment-variables)
- [Estrategia de autenticación](authentication-strategy)
- [Guía de operaciónes](operations)
- [Referencia de API](api-reference)

## Asistente MCP en una línea

macOS / Linux:

```shell
curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js
```

Windows PowerShell:

```powershell
iwr https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -OutFile .\claustrum-mcp-config-helper.js; node .\claustrum-mcp-config-helper.js
```

## Componentes

- `memory-core`: API REST + Postgres + motor de políticas
- `mcp-adapter`: puente MCP stdio que llama a memory-core
- `admin-ui`: consola para workspace, permisos, integraciónes y auditoría
