// CAPA DE DATOS, conexion a la base y modelos (las tablas).
// Es el unico lugar donde se decide que motor se usa (postgres o mysql).
import {
    Sequelize, Dialect, DataTypes, Model, InferAttributes,
    InferCreationAttributes, CreationOptional, NonAttribute,
} from "sequelize";

export const sequelize = new Sequelize(
    process.env.DB_NAME ?? "biblioteca_db",
    process.env.DB_USER ?? "biblioteca",
    process.env.DB_PASSWORD ?? "biblioteca",
    {
        host: process.env.DB_HOST ?? "localhost",
        port: Number(process.env.DB_PORT ?? 5432),
        dialect: (process.env.DB_DIALECT ?? "postgres") as Dialect,
        logging: false,
    }
);

// modelos, solo describen las tablas, no tienen reglas de negocio ----

export class Libro extends Model<InferAttributes<Libro>, InferCreationAttributes<Libro>> {
    declare id: CreationOptional<number>;
    declare titulo: string;
    declare autor: string;
    declare ejemplares: number; // copias que tiene la biblioteca
}
Libro.init(
    {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        titulo: { type: DataTypes.STRING(120), allowNull: false },
        autor: { type: DataTypes.STRING(80), allowNull: false },
        ejemplares: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, tableName: "libros", timestamps: false }
);

export class Socio extends Model<InferAttributes<Socio>, InferCreationAttributes<Socio>> {
    declare id: CreationOptional<number>;
    declare nombre: string;
}
Socio.init(
    {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        nombre: { type: DataTypes.STRING(80), allowNull: false },
    },
    { sequelize, tableName: "socios", timestamps: false }
);

export class Prestamo extends Model<InferAttributes<Prestamo>, InferCreationAttributes<Prestamo>> {
    declare id: CreationOptional<number>;
    declare libroId: number;
    declare socioId: number;
    declare fechaPrestamo: string;          // AAAA-MM-DD
    declare fechaVencimiento: string;       // AAAA-MM-DD
    declare fechaDevolucion: string | null; // null = todavia no se devolvio
    declare multa: number;
    declare libro?: NonAttribute<Libro>;
    declare socio?: NonAttribute<Socio>;
}
Prestamo.init(
    {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        libroId: { type: DataTypes.INTEGER, allowNull: false },
        socioId: { type: DataTypes.INTEGER, allowNull: false },
        fechaPrestamo: { type: DataTypes.DATEONLY, allowNull: false },
        fechaVencimiento: { type: DataTypes.DATEONLY, allowNull: false },
        fechaDevolucion: { type: DataTypes.DATEONLY, allowNull: true },
        multa: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, tableName: "prestamos", timestamps: false }
);

// relaciones: cada prestamo es de un libro y de un socio
Prestamo.belongsTo(Libro, { foreignKey: "libroId", as: "libro" });
Prestamo.belongsTo(Socio, { foreignKey: "socioId", as: "socio" });
