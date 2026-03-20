const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mysql = require('mysql2/promise');
const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: 'localhost', user: 'root', password: '', database: 'almacen'
});

// POST: Crear órdenes (RELACIONES INTEGRADAS)
app.post('/ordenes', async (req, res) => {
    // id_usuario será "isa" o "humberto", id_producto será un número (1, 2...)
    const { id_usuario, id_producto, cantidad } = req.body;

    try {
        // 1. RELACIÓN USUARIOS: Consultar por el nombre de usuario (isa/humberto)
        const resUser = await axios.get(`http://localhost:3001/usuarios/${id_usuario}`);
        const usuarioData = resUser.data;

        // 2. RELACIÓN PRODUCTOS: Consultar la info del producto por ID numérico
        const resProd = await axios.get(`http://localhost:3002/productos/${id_producto}`);
        const productoData = resProd.data;

        // Validaciones según los datos que recibimos de los otros micros
        if (!usuarioData.usuario) return res.status(404).send("Usuario no encontrado en el sistema");
        if (!productoData.id) return res.status(404).send("Producto no encontrado");
        
        if (productoData.inventario < cantidad) {
            return res.status(400).send("No hay suficiente stock disponible");
        }

        const precio_total = productoData.precio * cantidad;

        // 3. RELACIÓN PRODUCTOS: Actualizar cantidad (PUT) - Restamos el stock
        await axios.put(`http://localhost:3002/productos/${id_producto}`, {
            nombre: productoData.nombre,
            precio: productoData.precio,
            inventario: productoData.inventario - cantidad
        });

        // 4. GUARDAR ORDEN: Con los campos exactos del taller
        await db.query(
            'INSERT INTO ordenes (nombre_cliente, email_cliente, precio_total, fecha_creacion) VALUES (?, ?, ?, NOW())',
            [usuarioData.nombre, usuarioData.email, precio_total]
        );

        res.json({ mensaje: "Orden creada exitosamente" });

    } catch (error) {
        console.error(error);
        res.status(500).send("Error de conexión entre microservicios");
    }
});

// GET: Consultar órdenes
app.get('/ordenes', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM ordenes');
    res.json(rows);
});

app.listen(3003, () => console.log("Microservicio Órdenes corriendo en puerto 3003"));