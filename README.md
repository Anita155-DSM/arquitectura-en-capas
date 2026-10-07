# Biblioteca: demo de arquitectura por capas

Trabajo de investigación de Taller de Lenguajes de Programación IV (Instituto Politécnico Formosa).
Gestión de préstamos de libros a socios, organizada en **capas**.

Stack: Node.js, Express, TypeScript (modo estricto), Sequelize, PostgreSQL y Docker.

## Cómo ejecutar

Requisito: tener **Docker Desktop** abierto.

```
docker compose up --build
```

Abrir **http://localhost:3000**. Para apagar: `Ctrl + C` y `docker compose down`.
Para volver a los datos de ejemplo del principio: `docker compose down -v`.

## Estructura y capas

```
frontend/                                   → CAPA DE PRESENTACIÓN (pantalla)
├── index.html
├── styles.css
└── main.ts                                 → se compila a frontend/js/main.js
src/
├── controllers/biblioteca.controller.ts    → CAPA DE PRESENTACIÓN (API: recibe HTTP y responde)
├── services/biblioteca.service.ts          → CAPA DE NEGOCIO (las 6 reglas)
├── database/biblioteca.repository.interface.ts → CAPA DE DATOS (contrato que conoce el service)
├── database/biblioteca.repository.ts       → CAPA DE DATOS (lee y escribe en la base)
├── database/database.ts                    → CAPA DE DATOS (conexión y tablas)
└── server.ts                               → arma las capas y arranca
```

Flujo de una petición: **pantalla → controller → service → repository → base de datos**, y la respuesta vuelve por el mismo camino.
Cada capa solo conoce a la de abajo. En `server.ts` se arman de abajo hacia arriba:

```ts
const repository = new BibliotecaRepository();
const service = new BibliotecaService(repository);
const controller = new BibliotecaController(service);
```

## Patrones, SOLID y POO aplicados

- **Repository**, **Service Layer** e **inyección de dependencias** por constructor (en `server.ts`).
- **Inversión de dependencias (la D de SOLID):** el service depende de la interfaz `IBibliotecaRepository`, no de la clase concreta.
- **Abstracción y encapsulamiento:** el repository devuelve objetos simples; el service no sabe que existen Sequelize ni la base de datos.
- **Polimorfismo:** cualquier clase que implemente `IBibliotecaRepository` (por ejemplo, una que guarde en memoria para tests) puede reemplazar al repository sin tocar el service.
- **Herencia:** `ErrorNegocio extends Error`; los modelos heredan de `Model` de Sequelize.

## Orden recomendado para estudiar el código

1. `src/server.ts`: cómo se arman las capas.
2. `src/services/biblioteca.service.ts`: las reglas (lo más importante para explicar).
3. `src/controllers/biblioteca.controller.ts`: cómo un error de negocio se convierte en código HTTP.
4. `src/database/biblioteca.repository.interface.ts`: el contrato entre negocio y datos.
5. El resto de `src/database/`: cómo se guardan los datos.

## Reglas de negocio

1. Un socio con un préstamo vencido no puede pedir otro libro.
2. Máximo 3 libros prestados por socio.
3. Un socio no puede tener dos veces el mismo libro.
4. Solo se presta si queda algún ejemplar disponible.
5. Plazo de devolución: 7 días.
6. Multa de $ 500 por cada día de atraso.

Datos de ejemplo: **Kiara** ya tiene 3 libros (y el único ejemplar de *El túnel*);
**Stella** tiene *Ficciones* vencido hace 3 días.

## Prueba de desacoplamiento: cambiar PostgreSQL por MySQL

```
docker compose down
docker compose -f docker-compose.yml -f docker-compose.mysql.yml up --build
```

La app funciona igual. Solo cambiaron variables de entorno, ninguna línea de `services/`, `controllers/` ni `frontend/`.
La consola muestra `Base de datos conectada (mysql)`.

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/libros` | Catálogo con ejemplares disponibles |
| GET | `/api/socios` | Socios |
| GET | `/api/prestamos` | Préstamos sin devolver, con atraso y multa estimada |
| POST | `/api/prestamos` | Prestar. Body: `{ "socioId": 3, "libroId": 2 }` |
| PATCH | `/api/prestamos/:id/devolucion` | Registrar devolución |
