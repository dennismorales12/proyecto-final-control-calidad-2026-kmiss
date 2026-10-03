# Colección de API de KMISS

La colección contiene 29 aserciones distribuidas en siete solicitudes. El flujo encadenado obtiene un producto disponible, crea un pedido público, autentica a un administrador, consulta el pedido creado y lo cancela para liberar la reserva.

Variables requeridas:

- `baseUrl`: URL del ambiente de QA sin barra final.
- `adminEmail`: correo del administrador de demostración.
- `adminPassword`: contraseña del administrador de demostración.

Ejecución local:

```text
npx newman run postman/KMISS.postman_collection.json -e postman/KMISS.postman_environment.json
```

No se deben versionar contraseñas ni tokens. En CI, los tres valores se inyectan mediante secretos del repositorio.
