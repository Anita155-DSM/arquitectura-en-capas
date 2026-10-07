// CAPA DE DATOS: el repository es el unico que lee y escribe en la base.
// No decide nada: solo guarda y busca lo que le pide la capa de negocio.
// Implementa el contrato IBibliotecaRepository y devuelve objetos simples,
// asi ningun detalle de Sequelize sale de esta capa.
import { Model } from "sequelize";
import { Libro, Socio, Prestamo } from "./database";
import {
    IBibliotecaRepository, LibroDatos, SocioDatos, PrestamoDatos, PrestamoConDetalle, NuevoPrestamo,
} from "./biblioteca.repository.interface";

// convierte un objeto de Sequelize en un objeto simple
function plano<T>(registro: Model): T {
    return registro.get({ plain: true }) as T;
}

export class BibliotecaRepository implements IBibliotecaRepository {

    async listarLibros() {
        const libros = await Libro.findAll({ order: [["titulo", "ASC"]] });
        return libros.map((l) => plano<LibroDatos>(l));
    }

    async listarSocios() {
        const socios = await Socio.findAll({ order: [["nombre", "ASC"]] });
        return socios.map((s) => plano<SocioDatos>(s));
    }

    async buscarLibro(id: number) {
        const libro = await Libro.findByPk(id);
        return libro ? plano<LibroDatos>(libro) : null;
    }

    async buscarSocio(id: number) {
        const socio = await Socio.findByPk(id);
        return socio ? plano<SocioDatos>(socio) : null;
    }

    async buscarPrestamo(id: number) {
        const prestamo = await Prestamo.findByPk(id);
        return prestamo ? plano<PrestamoDatos>(prestamo) : null;
    }

    // prestamos sin devolver, con el libro y el socio incluidos
    async prestamosActivos() {
        const prestamos = await Prestamo.findAll({
            where: { fechaDevolucion: null },
            include: [{ model: Libro, as: "libro" }, { model: Socio, as: "socio" }],
            order: [["fechaVencimiento", "ASC"]],
        });
        return prestamos.map((p) => plano<PrestamoConDetalle>(p));
    }

    async prestamosActivosDelSocio(socioId: number) {
        const prestamos = await Prestamo.findAll({ where: { socioId, fechaDevolucion: null } });
        return prestamos.map((p) => plano<PrestamoDatos>(p));
    }

    async contarPrestadosDelLibro(libroId: number) {
        return Prestamo.count({ where: { libroId, fechaDevolucion: null } });
    }

    async crearPrestamo(datos: NuevoPrestamo) {
        const prestamo = await Prestamo.create({ ...datos, fechaDevolucion: null, multa: 0 });
        return plano<PrestamoDatos>(prestamo);
    }

    async registrarDevolucion(prestamo: PrestamoDatos, fecha: string, multa: number) {
        await Prestamo.update({ fechaDevolucion: fecha, multa }, { where: { id: prestamo.id } });
        return { ...prestamo, fechaDevolucion: fecha, multa };
    }

    // datos de ejemplo: solo se cargan si la base esta vacia (lo usa server.ts, no el service)
    async cargarDatosIniciales(libros: Omit<LibroDatos, "id">[],
                               socios: Omit<SocioDatos, "id">[],
                               prestamos: NuevoPrestamo[]) {
        if ((await Libro.count()) > 0) return;
        await Libro.bulkCreate(libros);
        await Socio.bulkCreate(socios);
        await Prestamo.bulkCreate(prestamos.map((p) => ({ ...p, fechaDevolucion: null, multa: 0 })));
    }
}
