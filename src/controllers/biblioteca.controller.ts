//presentación
// CAPA DE PRESENTACION (API), recibe la peticion HTTP, llama al service y responde.
// No valida reglas ni toca la base de datos.
import { Router, Request, Response } from "express";
import { BibliotecaService, ErrorNegocio } from "../services/biblioteca.service";

export class BibliotecaController {
    constructor(private readonly service: BibliotecaService) {} // inyeccion de dependencias

    // define las URLs de la API y que metodo atiende cada una
    rutas(): Router {
        const router = Router();
        router.get("/api/libros", this.listarLibros);
        router.get("/api/socios", this.listarSocios);
        router.get("/api/prestamos", this.listarPrestamos);
        router.post("/api/prestamos", this.prestar);
        router.patch("/api/prestamos/:id/devolucion", this.devolver);
        return router;
    }

    listarLibros = async (_req: Request, res: Response) => {
        try { res.json(await this.service.listarLibros()); }
        catch (error) { this.responderError(error, res); }
    };

    listarSocios = async (_req: Request, res: Response) => {
        try { res.json(await this.service.listarSocios()); }
        catch (error) { this.responderError(error, res); }
    };

    listarPrestamos = async (_req: Request, res: Response) => {
        try { res.json(await this.service.listarPrestamosActivos()); }
        catch (error) { this.responderError(error, res); }
    };

    prestar = async (req: Request, res: Response) => {
        try { res.status(201).json(await this.service.prestar(req.body?.socioId, req.body?.libroId)); }
        catch (error) { this.responderError(error, res); }
    };

    devolver = async (req: Request<{ id: string }>, res: Response) => {
        try { res.json(await this.service.devolver(Number(req.params.id))); }
        catch (error) { this.responderError(error, res); }
    };

    // traduce los errores del negocio a codigos HTTP (400, 404, 409...)
    private responderError(error: unknown, res: Response) {
        if (error instanceof ErrorNegocio) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }
        console.error(error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
}
