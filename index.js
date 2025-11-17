import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import express from "express";
import multer from "multer";
import { Command } from "commander";
import fs from "fs/promises";

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

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory Service API",
      version: "1.0.0"
    },
    servers: [{ url: `http://${host}:${port}` }]
  },
  apis: ["./index.js"]
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const inventory = [];
let nextId = 1;

const upload = multer({
  storage: multer.diskStorage({
    destination: cache,
    filename: (_, file, cb) => cb(null, Date.now() + "_" + file.originalname)
  })
});

const getItem = id => inventory.find(x => x.id === Number(id));
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
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Bad request
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
  res.status(201).json({ message: "Created", item });
});
/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all inventory items
 *     responses:
 *       200:
 *         description: OK
 */

app.get("/inventory", (_, res) => {
  res.json(
    inventory.map(i => ({
      ...i,
      photo_url: i.photo ? `http://${host}:${port}/images/${i.photo}` : null
    }))
  );
});
/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get specific item by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not Found
 */

app.get("/inventory/:id", (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  res.json({
    ...item,
    photo_url: item.photo ? `http://${host}:${port}/images/${item.photo}` : null
  });
});
/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Get item photo by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: JPEG image
 *       404:
 *         description: Photo not found
 */

app.get("/inventory/:id/photo", (req, res) => {
  const item = getItem(req.params.id);
  if (!item?.photo) return res.status(404).json({ error: "Photo not found" });

  res.setHeader("Content-Type", "image/jpeg");
  res.sendFile(item.photo, { root: cache });
});
/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Update item name or description
 *     consumes:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Updated
 *       404:
 *         description: Not Found
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
 *     summary: Update item photo
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *       - in: formData
 *         name: photo
 *         type: file
 *         required: true
 *     responses:
 *       200:
 *         description: Photo updated
 *       404:
 *         description: Not Found
 */

app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  if (!req.file) return res.status(400).json({ error: "Photo is required" });

  item.photo = req.file.filename;
  res.json(item);
});
/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Delete an inventory item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Not Found
 */

app.delete("/inventory/:id", (req, res) => {
  const index = inventory.findIndex(x => x.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Item not found" });

  inventory.splice(index, 1);
  res.json({ message: "Deleted" });
});

app.get("/RegisterForm.html", (_, res) =>
  res.sendFile("RegisterForm.html", { root: process.cwd() })
);

app.get("/SearchForm.html", (_, res) =>
  res.sendFile("SearchForm.html", { root: process.cwd() })
);
/**
 * @swagger
 * /search:
 *   post:
 *     summary: Search item using ID (HTML form)
 *     consumes:
 *       - application/x-www-form-urlencoded
 *     parameters:
 *       - in: formData
 *         name: id
 *         type: integer
 *         required: true
 *       - in: formData
 *         name: has_photo
 *         type: boolean
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not Found
 */

app.post("/search", (req, res) => {
  const item = getItem(req.body.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  if (req.body.has_photo)
    item.photo_url = item.photo
      ? `http://${host}:${port}/images/${item.photo}`
      : null;

  res.json(item);
});

app.use((_, res) => res.status(405).send("Method Not Allowed"));

app.listen(port, host, () => {
  console.log(`🚀 http://${host}:${port}`);
});
