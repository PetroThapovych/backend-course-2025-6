import express from "express";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { Command } from "commander";
import fs from "fs/promises";

// CLI arguments
const program = new Command();
program
  .requiredOption("-c, --cache <path>")
  .requiredOption("-h, --host <host>")
  .requiredOption("-p, --port <port>");
program.parse(process.argv);
const { cache, host, port } = program.opts();

await fs.mkdir(cache, { recursive: true });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/images", express.static(cache));

// Swagger setup
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Inventory API", version: "1.0.0" },
    servers: [{ url: `http://${host}:${port}` }]
  },
  apis: ["./index.js"]
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Storage & helpers
const inventory = [];
let nextId = 1;
const url = file => `http://${host}:${port}/images/${file}`;
const getItem = id => inventory.find(x => x.id === Number(id));

// Multer setup
const upload = multer({
  storage: multer.diskStorage({
    destination: cache,
    filename: (_, f, cb) => cb(null, Date.now() + "_" + f.originalname)
  })
});

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register new inventory item
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: inventory_name
 *         type: string
 *         required: true
 *       - in: formData
 *         name: description
 *         type: string
 *       - in: formData
 *         name: photo
 *         type: file
 */
 
app.post("/register", upload.single("photo"), (req, res) => {
  if (!req.body.inventory_name)
    return res.status(400).json({ error: "inventory_name is required" });

  const item = {
    id: nextId++,
    inventory_name: req.body.inventory_name,
    description: req.body.description || "",
    photo: req.file?.filename || null
  };

  inventory.push(item);
  res.status(201).json(item);
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all items
 */
app.get("/inventory", (_, res) => {
  res.json(
    inventory.map(i => ({ ...i, photo_url: i.photo ? url(i.photo) : null }))
  );
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get item by ID
 */
app.get("/inventory/:id", (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  res.json({ ...item, photo_url: item.photo ? url(item.photo) : null });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Get item photo
 */
app.get("/inventory/:id/photo", (req, res) => {
  const item = getItem(req.params.id);
  if (!item?.photo) return res.status(404).json({ error: "Photo not found" });

  res.type("jpeg").sendFile(item.photo, { root: cache });
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Update item info
 */
app.put("/inventory/:id", (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  Object.assign(item, req.body);
  res.json(item);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Update photo
 */
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  if (!req.file) return res.status(400).json({ error: "Photo required" });

  item.photo = req.file.filename;
  res.json(item);
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Delete item
 */
app.delete("/inventory/:id", (req, res) => {
  const index = inventory.findIndex(x => x.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Item not found" });

  inventory.splice(index, 1);
  res.json({ message: "Deleted" });
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Search item by ID
 */
app.post("/search", (req, res) => {
  const item = getItem(req.body.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  res.json({
    ...item,
    photo_url: req.body.has_photo && item.photo ? url(item.photo) : null
  });
});

app.use((_, res) => res.status(405).send("Method Not Allowed"));

app.listen(port, host, () => console.log(`🚀 http://${host}:${port}`));
