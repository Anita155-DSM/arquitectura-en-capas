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

// error de la API que guarda el codigo HTTP (lo usa el panel de flujo)
class ErrorApi extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

async function api<T>(url: string, opciones: RequestInit = {}): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opciones });
    const cuerpo = await res.json();
    if (!res.ok) throw new ErrorApi(res.status, cuerpo.message ?? "Error inesperado");
    return cuerpo as T;
}

function codigoDe(error: unknown): number {
    return error instanceof ErrorApi ? error.status : 0; // 0 = no hubo respuesta del servidor
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
    const url = `/api/prestamos/${p.id}/devolucion`;
    try {
        const devuelto = await api<Prestamo>(url, { method: "PATCH" });
        registrarFlujo(flujoDevolucion(url, 200, "", devuelto.multa));
        mostrarMensaje(
            devuelto.multa > 0
                ? `Devolución registrada: "${p.libro.titulo}". ${p.socio.nombre} debe pagar una multa de ${pesos.format(devuelto.multa)}.`
                : `Devolución registrada: "${p.libro.titulo}", sin multa.`
        );
        await recargar();
    } catch (error) {
        mostrarMensaje((error as Error).message, true);
        registrarFlujo(flujoDevolucion(url, codigoDe(error), (error as Error).message, 0));
    }
}

form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const cuerpo = JSON.stringify({ socioId: Number(selectSocio.value), libroId: Number(selectLibro.value) });
    try {
        const prestamo = await api<Prestamo>("/api/prestamos", { method: "POST", body: cuerpo });
        registrarFlujo(flujoPrestamo(cuerpo, 201, ""));
        const socio = selectSocio.selectedOptions[0]?.text ?? "";
        const libro = selectLibro.selectedOptions[0]?.text ?? "";
        mostrarMensaje(`Préstamo registrado: "${libro}" para ${socio}. Vence el ${formatoFecha(prestamo.fechaVencimiento)}.`);
        await recargar();
    } catch (error) {
        mostrarMensaje((error as Error).message, true);
        registrarFlujo(flujoPrestamo(cuerpo, codigoDe(error), (error as Error).message));
    }
});

selectLibro.addEventListener("change", marcarFichaElegida);

// ===================== PANEL "VER FLUJO" =====================
// Arma el recorrido del ultimo pedido por las capas. Los pasos siguen el camino
// que hace nuestro codigo; el metodo, la URL, el codigo y el mensaje son los reales.

type Capa = "pres" | "neg" | "datos" | "db";
interface Paso { capa: Capa; flecha: "↓" | "↑" | "•"; texto: string; detalle?: string; error?: boolean; }
interface Flujo { pedido: string; codigo: number; pasos: Paso[]; }

const NOMBRE_CAPA: Record<Capa, string> = { pres: "Presentación", neg: "Negocio", datos: "Datos", db: "Base de datos" };

const btnFlujo = el<HTMLButtonElement>("btn-flujo");
const panelFlujo = el<HTMLElement>("panel-flujo");
const flujoPedido = el<HTMLParagraphElement>("flujo-pedido");
const listaPasos = el<HTMLOListElement>("flujo-pasos");
const btnRepetir = el<HTMLButtonElement>("repetir-flujo");

let ultimoFlujo: Flujo | null = null;
let temporizadores: number[] = [];

// pasos de vuelta hacia la pantalla (iguales para todos los casos)
function respuesta(codigo: number): Paso[] {
    const ok = codigo >= 200 && codigo < 300;
    return [
        {
            capa: "pres", flecha: "↑",
            texto: ok ? `El controller responde ${codigo}.` : `controller.responderError() traduce el error a HTTP ${codigo}.`,
        },
        { capa: "pres", flecha: "↑", texto: "main.ts muestra el resultado y actualiza la pantalla." },
    ];
}

function errorDelServidor(pedido: string, inicio: Paso[], codigo: number, mensaje: string): Flujo {
    return {
        pedido, codigo,
        pasos: [...inicio, {
            capa: "pres", flecha: "•", error: true,
            texto: codigo === 0 ? "No hubo respuesta del servidor." : `Error interno (${codigo}): ${mensaje}`,
        }],
    };
}

function flujoPrestamo(cuerpo: string, codigo: number, mensaje: string): Flujo {
    const pedido = "POST /api/prestamos";
    const inicio: Paso[] = [
        { capa: "pres", flecha: "↓", texto: "main.ts envía el pedido.", detalle: `${pedido} ${cuerpo}` },
        { capa: "pres", flecha: "↓", texto: "controller.prestar() recibe el pedido y llama al service." },
    ];
    if (codigo === 0 || codigo >= 500) return errorDelServidor(pedido, inicio, codigo, mensaje);

    // 400: el service rechaza los datos antes de consultar la base
    if (codigo === 400) {
        return { pedido, codigo, pasos: [...inicio,
            { capa: "neg", flecha: "•", error: true, texto: `service.prestar() rechaza los datos sin consultar la base: ${mensaje}` },
            ...respuesta(codigo)] };
    }

    const consulta: Paso[] = [
        { capa: "neg", flecha: "↓", texto: "service.prestar() necesita datos y se los pide al repository." },
        { capa: "datos", flecha: "↓", texto: "El repository busca el socio, el libro y sus préstamos activos." },
        { capa: "db", flecha: "↓", texto: "SELECT en socios, libros y prestamos." },
        { capa: "datos", flecha: "↑", texto: "El repository devuelve objetos simples (sin Sequelize)." },
    ];

    // 404 / 409: una regla de negocio rechaza el pedido
    if (codigo !== 201) {
        return { pedido, codigo, pasos: [...inicio, ...consulta,
            { capa: "neg", flecha: "•", error: true, texto: `El service rechaza (ErrorNegocio ${codigo}): ${mensaje}` },
            { capa: "db", flecha: "•", texto: "No se guardó nada en la base." },
            ...respuesta(codigo)] };
    }

    return { pedido, codigo, pasos: [...inicio, ...consulta,
        { capa: "neg", flecha: "•", texto: "El service revisa las 4 reglas: se cumplen todas." },
        { capa: "datos", flecha: "↓", texto: "repository.crearPrestamo() con vencimiento en 7 días." },
        { capa: "db", flecha: "↓", texto: "INSERT en prestamos." },
        { capa: "datos", flecha: "↑", texto: "El repository devuelve el préstamo creado." },
        ...respuesta(codigo)] };
}

function flujoDevolucion(url: string, codigo: number, mensaje: string, multa: number): Flujo {
    const pedido = `PATCH ${url}`;
    const inicio: Paso[] = [
        { capa: "pres", flecha: "↓", texto: "main.ts envía el pedido.", detalle: pedido },
        { capa: "pres", flecha: "↓", texto: "controller.devolver() recibe el pedido y llama al service." },
    ];
    if (codigo === 0 || codigo >= 500) return errorDelServidor(pedido, inicio, codigo, mensaje);

    const consulta: Paso[] = [
        { capa: "neg", flecha: "↓", texto: "service.devolver() le pide el préstamo al repository." },
        { capa: "datos", flecha: "↓", texto: "repository.buscarPrestamo()" },
        { capa: "db", flecha: "↓", texto: "SELECT en prestamos." },
        { capa: "datos", flecha: "↑", texto: "El repository devuelve un objeto simple." },
    ];

    if (codigo !== 200) {
        return { pedido, codigo, pasos: [...inicio, ...consulta,
            { capa: "neg", flecha: "•", error: true, texto: `El service rechaza (ErrorNegocio ${codigo}): ${mensaje}` },
            ...respuesta(codigo)] };
    }

    return { pedido, codigo, pasos: [...inicio, ...consulta,
        { capa: "neg", flecha: "•", texto: `El service calcula los días de atraso y la multa: ${pesos.format(multa)}.` },
        { capa: "datos", flecha: "↓", texto: "repository.registrarDevolucion()" },
        { capa: "db", flecha: "↓", texto: "UPDATE en prestamos." },
        ...respuesta(codigo)] };
}

function marcarCapa(capa: Capa | null, error = false) {
    for (const li of panelFlujo.querySelectorAll<HTMLLIElement>(".capa")) {
        const esEsta = li.dataset.capa === capa;
        li.classList.toggle("activa", esEsta && !error);
        li.classList.toggle("error", esEsta && error);
    }
}

function mostrarPaso(paso: Paso, esUltimo: boolean) {
    const li = document.createElement("li");
    li.className = "paso" + (paso.error ? " error" : "") + (esUltimo ? " fin" : "");

    const flecha = document.createElement("span");
    flecha.className = "flecha";
    flecha.textContent = paso.flecha;

    const cuerpo = document.createElement("span");
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = NOMBRE_CAPA[paso.capa];
    const texto = document.createElement("span");
    texto.className = "texto";
    texto.textContent = " " + paso.texto;
    cuerpo.append(chip, texto);
    if (paso.detalle) {
        const detalle = document.createElement("span");
        detalle.className = "detalle";
        detalle.textContent = paso.detalle;
        cuerpo.append(detalle);
    }

    li.append(flecha, cuerpo);
    listaPasos.append(li);
    marcarCapa(paso.capa, paso.error === true);
}

// muestra los pasos de a uno, iluminando la capa por la que pasa el pedido
function animarFlujo() {
    temporizadores.forEach((t) => clearTimeout(t));
    temporizadores = [];
    listaPasos.replaceChildren();
    marcarCapa(null);
    if (!ultimoFlujo) return;

    const flujo = ultimoFlujo;
    const ok = flujo.codigo >= 200 && flujo.codigo < 300;
    flujoPedido.replaceChildren();
    const codigo = document.createElement("code");
    codigo.textContent = flujo.pedido;
    const estado = document.createElement("span");
    estado.className = "estado " + (ok ? "ok" : "error");
    estado.textContent = flujo.codigo === 0 ? "sin respuesta" : String(flujo.codigo);
    flujoPedido.append("Último pedido: ", codigo, estado);
    btnRepetir.hidden = false;

    const sinAnimacion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    flujo.pasos.forEach((paso, i) => {
        const esUltimo = i === flujo.pasos.length - 1;
        temporizadores.push(window.setTimeout(() => {
            mostrarPaso(paso, esUltimo);
            // al terminar, queda marcada en rojo la capa que rechazo el pedido (si hubo rechazo)
            const rechazo = flujo.pasos.find((p) => p.error);
            if (esUltimo && rechazo) marcarCapa(rechazo.capa, true);
        }, sinAnimacion ? 0 : i * 650));
    });
}

function registrarFlujo(flujo: Flujo) {
    ultimoFlujo = flujo;
    if (!panelFlujo.hidden) animarFlujo();
}

function abrirFlujo(abrir: boolean) {
    panelFlujo.hidden = !abrir;
    btnFlujo.setAttribute("aria-expanded", String(abrir));
    btnFlujo.textContent = abrir ? "Ocultar flujo" : "Ver flujo";
    document.body.classList.toggle("flujo-abierto", abrir);
    if (abrir) animarFlujo();
}

btnFlujo.addEventListener("click", () => abrirFlujo(panelFlujo.hidden));
el<HTMLButtonElement>("cerrar-flujo").addEventListener("click", () => abrirFlujo(false));
btnRepetir.addEventListener("click", animarFlujo);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panelFlujo.hidden) abrirFlujo(false);
});

// ===================== ARRANQUE =====================

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
