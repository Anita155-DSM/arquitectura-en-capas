// CAPA DE NEGOCIO: todas las reglas de la biblioteca estan aca.
// No conoce HTTP (req/res) ni Sequelize: solo reglas y calculos.
// Si cambia una regla, se cambia SOLO este archivo.
import { IBibliotecaRepository } from "../database/biblioteca.repository.interface";

const MAX_PRESTAMOS = 3;
const DIAS_DE_PRESTAMO = 7;
const MULTA_POR_DIA = 500;

// error de negocio: lleva el codigo HTTP que la capa de presentacion debe devolver
export class ErrorNegocio extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
    }
}

export class BibliotecaService {
    // depende del CONTRATO del repository (interfaz), no de una clase concreta:
    // cualquier clase que cumpla IBibliotecaRepository sirve (polimorfismo)
    constructor(private readonly repository: IBibliotecaRepository) {}

    listarSocios() {
        return this.repository.listarSocios();
    }

    // disponibles = ejemplares - prestados sin devolver
    async listarLibros() {
        const libros = await this.repository.listarLibros();
        return Promise.all(libros.map(async (libro) => ({
            ...libro,
            disponibles: libro.ejemplares - (await this.repository.contarPrestadosDelLibro(libro.id)),
        })));
    }

    // prestamos sin devolver, con dias de atraso y la multa que corresponderia hoy
    async listarPrestamosActivos() {
        const prestamos = await this.repository.prestamosActivos();
        return prestamos.map((p) => {
            const diasAtraso = Math.max(0, diasEntre(p.fechaVencimiento, hoy()));
            return { ...p, diasAtraso, multaEstimada: diasAtraso * MULTA_POR_DIA };
        });
    }

    async prestar(socioId: number, libroId: number) {
        if (!Number.isInteger(socioId) || !Number.isInteger(libroId)) {
            throw new ErrorNegocio(400, "Elegí un socio y un libro");
        }
        const socio = await this.repository.buscarSocio(socioId);
        if (!socio) throw new ErrorNegocio(404, "El socio no existe");
        const libro = await this.repository.buscarLibro(libroId);
        if (!libro) throw new ErrorNegocio(404, "El libro no existe");

        const activos = await this.repository.prestamosActivosDelSocio(socio.id);

        // regla 1: con un prestamo vencido no puede pedir otro
        if (activos.some((p) => p.fechaVencimiento < hoy())) {
            throw new ErrorNegocio(409, `${socio.nombre} tiene un préstamo vencido: debe devolverlo antes de pedir otro`);
        }
        // regla 2: maximo 3 libros por socio
        if (activos.length >= MAX_PRESTAMOS) {
            throw new ErrorNegocio(409, `${socio.nombre} ya tiene ${MAX_PRESTAMOS} libros prestados, el máximo permitido`);
        }
        // regla 3: no puede tener dos veces el mismo libro
        if (activos.some((p) => p.libroId === libro.id)) {
            throw new ErrorNegocio(409, `${socio.nombre} ya tiene prestado "${libro.titulo}"`);
        }
        // regla 4: tiene que quedar algun ejemplar
        if ((await this.repository.contarPrestadosDelLibro(libro.id)) >= libro.ejemplares) {
            throw new ErrorNegocio(409, `No quedan ejemplares disponibles de "${libro.titulo}"`);
        }
        // regla 5: plazo de devolucion de 7 dias
        return this.repository.crearPrestamo({
            socioId: socio.id,
            libroId: libro.id,
            fechaPrestamo: hoy(),
            fechaVencimiento: sumarDias(hoy(), DIAS_DE_PRESTAMO),
        });
    }

    async devolver(prestamoId: number) {
        const prestamo = await this.repository.buscarPrestamo(prestamoId);
        if (!prestamo) throw new ErrorNegocio(404, "El préstamo no existe");
        if (prestamo.fechaDevolucion !== null) throw new ErrorNegocio(400, "Ese préstamo ya fue devuelto");

        // regla 6: multa de $500 por cada dia de atraso
        const diasAtraso = Math.max(0, diasEntre(prestamo.fechaVencimiento, hoy()));
        return this.repository.registrarDevolucion(prestamo, hoy(), diasAtraso * MULTA_POR_DIA);
    }
}

// ---- fechas AAAA-MM-DD en hora argentina (da igual la zona del servidor) ----

export function hoy(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function sumarDias(fecha: string, dias: number): string {
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
    return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}
