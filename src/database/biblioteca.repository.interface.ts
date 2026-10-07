// CAPA DE DATOS: contrato que la capa de datos ofrece a la capa de negocio.
// El service solo conoce esta interfaz: no sabe que existen Sequelize ni la base de datos.

// objetos simples (sin metodos de Sequelize) que viajan entre capas
export interface LibroDatos { id: number; titulo: string; autor: string; ejemplares: number; }
export interface SocioDatos { id: number; nombre: string; }
export interface PrestamoDatos {
    id: number;
    libroId: number;
    socioId: number;
    fechaPrestamo: string;          // AAAA-MM-DD
    fechaVencimiento: string;       // AAAA-MM-DD
    fechaDevolucion: string | null; // null = todavia no se devolvio
    multa: number;
}
export interface PrestamoConDetalle extends PrestamoDatos { libro: LibroDatos; socio: SocioDatos; }
export interface NuevoPrestamo { libroId: number; socioId: number; fechaPrestamo: string; fechaVencimiento: string; }

export interface IBibliotecaRepository {
    listarLibros(): Promise<LibroDatos[]>;
    listarSocios(): Promise<SocioDatos[]>;
    buscarLibro(id: number): Promise<LibroDatos | null>;
    buscarSocio(id: number): Promise<SocioDatos | null>;
    buscarPrestamo(id: number): Promise<PrestamoDatos | null>;
    prestamosActivos(): Promise<PrestamoConDetalle[]>;
    prestamosActivosDelSocio(socioId: number): Promise<PrestamoDatos[]>;
    contarPrestadosDelLibro(libroId: number): Promise<number>;
    crearPrestamo(datos: NuevoPrestamo): Promise<PrestamoDatos>;
    registrarDevolucion(prestamo: PrestamoDatos, fecha: string, multa: number): Promise<PrestamoDatos>;
}
