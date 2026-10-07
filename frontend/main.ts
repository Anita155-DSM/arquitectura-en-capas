// capa de presentacion (navegador): solo muestra datos y llama a la API.
// no calcula disponibilidad, vencimientos ni multas: eso lo decide el back-end.

interface Libro { id: number; titulo: string; autor: string; ejemplares: number; disponibles: number; }
interface Socio { id: number; nombre: string; }
interface Prestamo {
    id: number;
    fechaPrestamo: string;
    fechaVencimiento: string;
    multa: number;
    diasAtraso: number;
    multaEstimada: number;
    libro: Libro;
    socio: Socio;
}

let libros: Libro[] = [];

function el<T extends HTMLElement>(id: string): T {
    const elemento = document.getElementById(id);
    if (!elemento) throw new Error(`Falta el elemento #${id}`);
    return elemento as T;
}

const catalogo = el<HTMLDivElement>("catalogo");
const tablaPrestamos = el<HTMLTableSectionElement>("prestamos");
const form = el<HTMLFormElement>("form-prestamo");
const selectSocio = el<HTMLSelectElement>("socio");
const selectLibro = el<HTMLSelectElement>("libro");
const mensaje = el<HTMLParagraphElement>("mensaje");

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

async function api<T>(url: string, opciones: RequestInit = {}): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opciones });
    const cuerpo = await res.json();
    if (!res.ok) throw new Error(cuerpo.message ?? "Error inesperado");
    return cuerpo as T;
}

function mostrarMensaje(texto: string, esError = false) {
    mensaje.textContent = texto;
    mensaje.classList.toggle("error", esError);
    mensaje.hidden = false;
}

// AAAA-MM-DD -> DD/MM/AAAA (solo formato de pantalla)
function formatoFecha(fecha: string): string {
    const [anio, mes, dia] = fecha.split("-");
    return `${dia}/${mes}/${anio}`;
}

function crearCelda(texto: string, clase?: string): HTMLTableCellElement {
    const td = document.createElement("td");
    td.textContent = texto;
    if (clase) td.className = clase;
    return td;
}

function marcarFichaElegida() {
    for (const ficha of catalogo.querySelectorAll<HTMLButtonElement>(".ficha")) {
        ficha.setAttribute("aria-pressed", String(ficha.dataset.id === selectLibro.value));
    }
}

function dibujarCatalogo() {
    catalogo.replaceChildren();
    for (const libro of libros) {
        const ficha = document.createElement("button");
        ficha.type = "button";
        ficha.className = "ficha";
        ficha.dataset.id = String(libro.id);

        const titulo = document.createElement("span");
        titulo.className = "titulo";
        titulo.textContent = libro.titulo;

        const autor = document.createElement("span");
        autor.className = "autor";
        autor.textContent = libro.autor;

        const ejemplares = document.createElement("span");
        ejemplares.className = "ejemplares";
        ejemplares.setAttribute("aria-hidden", "true");
        for (let i = 0; i < libro.ejemplares; i++) {
            const copia = document.createElement("span");
            copia.className = i < libro.disponibles ? "ejemplar disponible" : "ejemplar";
            ejemplares.append(copia);
        }

        const estado = document.createElement("span");
        estado.className = libro.disponibles > 0 ? "estado-stock" : "estado-stock agotado";
        estado.textContent = libro.disponibles > 0
            ? `Disponibles: ${libro.disponibles} de ${libro.ejemplares}`
            : "Sin ejemplares disponibles";

        ficha.append(titulo, autor, ejemplares, estado);
        ficha.addEventListener("click", () => {
            selectLibro.value = String(libro.id);
            marcarFichaElegida();
        });
        catalogo.append(ficha);
    }
    marcarFichaElegida();
}

function dibujarPrestamos(prestamos: Prestamo[]) {
    tablaPrestamos.replaceChildren();
    if (prestamos.length === 0) {
        const fila = document.createElement("tr");
        const celda = crearCelda("No hay préstamos pendientes de devolución.", "vacio");
        celda.colSpan = 6;
        fila.append(celda);
        tablaPrestamos.append(fila);
        return;
    }
    for (const p of prestamos) {
        const fila = document.createElement("tr");
        const estado = p.diasAtraso > 0
            ? crearCelda(`Vencido hace ${p.diasAtraso} día${p.diasAtraso === 1 ? "" : "s"} (multa ${pesos.format(p.multaEstimada)})`, "vencido")
            : crearCelda("Al día", "al-dia");

        const accion = document.createElement("td");
        const boton = document.createElement("button");
        boton.className = "devolver";
        boton.textContent = "Registrar devolución";
        boton.addEventListener("click", () => devolver(p));
        accion.append(boton);

        fila.append(
            crearCelda(p.socio.nombre),
            crearCelda(p.libro.titulo, "libro"),
            crearCelda(formatoFecha(p.fechaPrestamo)),
            crearCelda(formatoFecha(p.fechaVencimiento)),
            estado,
            accion
        );
        tablaPrestamos.append(fila);
    }
}

async function recargar() {
    const [listaLibros, prestamos] = await Promise.all([
        api<Libro[]>("/api/libros"),
        api<Prestamo[]>("/api/prestamos"),
    ]);
    libros = listaLibros;
    dibujarCatalogo();
    dibujarPrestamos(prestamos);
}

async function devolver(p: Prestamo) {
    try {
        const devuelto = await api<Prestamo>(`/api/prestamos/${p.id}/devolucion`, { method: "PATCH" });
        mostrarMensaje(
            devuelto.multa > 0
                ? `Devolución registrada: "${p.libro.titulo}". ${p.socio.nombre} debe pagar una multa de ${pesos.format(devuelto.multa)}.`
                : `Devolución registrada: "${p.libro.titulo}", sin multa.`
        );
        await recargar();
    } catch (error) {
        mostrarMensaje((error as Error).message, true);
    }
}

form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    try {
        const prestamo = await api<Prestamo>("/api/prestamos", {
            method: "POST",
            body: JSON.stringify({ socioId: Number(selectSocio.value), libroId: Number(selectLibro.value) }),
        });
        const socio = selectSocio.selectedOptions[0]?.text ?? "";
        const libro = selectLibro.selectedOptions[0]?.text ?? "";
        mostrarMensaje(`Préstamo registrado: "${libro}" para ${socio}. Vence el ${formatoFecha(prestamo.fechaVencimiento)}.`);
        await recargar();
    } catch (error) {
        mostrarMensaje((error as Error).message, true);
    }
});

selectLibro.addEventListener("change", marcarFichaElegida);

async function iniciar() {
    try {
        const socios = await api<Socio[]>("/api/socios");
        for (const socio of socios) selectSocio.add(new Option(socio.nombre, String(socio.id)));
        await recargar();
        for (const libro of libros) selectLibro.add(new Option(libro.titulo, String(libro.id)));
        marcarFichaElegida();
    } catch (error) {
        mostrarMensaje((error as Error).message, true);
    }
}

iniciar();
