import express from "express";
import Product from "../models/Product.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

const allowedUpdates = ["name", "category", "quantity", "unit", "expiryDate", "estimatedValue"];

router.get("/", async (req, res) => {
  try {
    const products = await Product.find({ addedBy: req.user.id }).sort({ expiryDate: 1 });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch products." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, category, quantity, unit, expiryDate, estimatedValue } = req.body;

    if (!name || !expiryDate) {
      return res.status(400).json({ message: "Name and expiry date are required." });
    }

    const product = await Product.create({
      name,
      category,
      quantity,
      unit,
      expiryDate,
      estimatedValue,
      addedBy: req.user.id,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create product." });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const products = await Product.find({ addedBy: req.user.id });
    const stats = {
      total: products.length,
      safe: 0,
      warning: 0,
      critical: 0,
      expired: 0,
    };

    products.forEach((product) => {
      const status = product.status.toLowerCase();
      stats[status] += 1;
    });

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch product stats." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updates = allowedUpdates.reduce((nextUpdates, field) => {
      if (req.body[field] !== undefined) {
        nextUpdates[field] = req.body[field];
      }
      return nextUpdates;
    }, {});

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, addedBy: req.user.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update product." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, addedBy: req.user.id });

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json({ message: "Product deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete product." });
  }
});

export default router;
