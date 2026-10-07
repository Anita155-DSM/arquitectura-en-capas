// PUNTO DE ARRANQUE: arma las capas, conecta la base y levanta el servidor.
import path from "node:path";
import express from "express";
import { sequelize } from "./database/database";
import { BibliotecaRepository } from "./database/biblioteca.repository";
import { BibliotecaService, hoy, sumarDias } from "./services/biblioteca.service";
import { BibliotecaController } from "./controllers/biblioteca.controller";

// se arman las capas de abajo hacia arriba: datos -> negocio -> presentacion
const repository = new BibliotecaRepository();
const service = new BibliotecaService(repository);
const controller = new BibliotecaController(service);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend"))); // front-end
app.use(controller.rutas());                                    // API

async function iniciar() {
    // la base puede tardar unos segundos en levantar dentro de Docker: reintentamos
    for (let intento = 1; ; intento++) {
        try {
            await sequelize.authenticate();
            break;
        } catch {
            if (intento === 20) throw new Error("No se pudo conectar a la base de datos");
            console.log(`Esperando a la base de datos (${intento}/20)...`);
            await new Promise((r) => setTimeout(r, 3000));
        }
    }
    await sequelize.sync(); // crea las tablas si no existen
    await cargarEjemplos();
    console.log(`Base de datos conectada (${sequelize.getDialect()})`);
    app.listen(3000, () => console.log("Servidor escuchando en http://localhost:3000"));
}

// datos de ejemplo para mostrar las reglas en la exposicion
async function cargarEjemplos() {
    // prestamo hecho hace N dias (vence 7 dias despues de prestado)
    const prestamo = (socioId: number, libroId: number, haceDias: number) => ({
        socioId, libroId,
        fechaPrestamo: sumarDias(hoy(), -haceDias),
        fechaVencimiento: sumarDias(hoy(), 7 - haceDias),
    });

    await repository.cargarDatosIniciales(
        [
            { titulo: "Rayuela", autor: "Julio Cortázar", ejemplares: 2 },                      // id 1
            { titulo: "Ficciones", autor: "Jorge Luis Borges", ejemplares: 3 },                // id 2
            { titulo: "Cien años de soledad", autor: "Gabriel García Márquez", ejemplares: 2 }, // id 3
            { titulo: "El túnel", autor: "Ernesto Sabato", ejemplares: 1 },                    // id 4
            { titulo: "Clean Code", autor: "Robert C. Martin", ejemplares: 2 },                // id 5
            { titulo: "Patterns of Enterprise Application Architecture", autor: "Martin Fowler", ejemplares: 1 }, // id 6
        ],
        [
            { nombre: "Kiara Jarzinski" },  // id 1
            { nombre: "Stella Bernard" },   // id 2
            { nombre: "Viviana Gonzalez" }, // id 3
            { nombre: "Anahí Pérez" },      // id 4
            { nombre: "Luana Ramirez" },    // id 5
        ],
        [
            prestamo(1, 1, 2), prestamo(1, 5, 1), prestamo(1, 4, 3), // Kiara: 3 libros (el maximo) y el unico "El tunel"
            prestamo(2, 2, 10),                                      // Stella: "Ficciones" vencido hace 3 dias
        ]
    );
}

iniciar().catch((error) => {
    console.error(error);
    process.exit(1);
});
