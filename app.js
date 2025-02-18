require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

// Middleware
app.use(
  cors({
    origin:'https://mahndi.vercel.app',
  
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  })
);
app.use(bodyParser.json());

// MongoDB connection strings from .env
const mongoURI = process.env.MONGO_URI; // For authentication database
const paymentDBURI = process.env.PAYMENT_DB_URI; // For payment database

// Connect to MongoDB for authentication
mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ MongoDB connected to AuthDB"))
  .catch((err) => console.error("❌ MongoDB connection error (AuthDB):", err));

// Create a new connection for PaymentDB
const paymentDBConnection = mongoose.createConnection(paymentDBURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User schema (for authentication)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

// Payment schema for storing payment form data
const paymentSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  address: { type: String, required: true },
  status: { type: String, default: "pending" }, // Default status is pending
  createdAt: { type: Date, default: Date.now },
});

// Model for PaymentInfo collection in PaymentDB
const Payment = paymentDBConnection.model(
  "PaymentInfo",
  paymentSchema,
  "paymentInfo"
);


// Register endpoint
app.post("/register", async (req, res) => {
  const { email, phone, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, phone, password: hashedPassword });
    await newUser.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully!",
      user: { email, phone },
    });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect password" });
    }

    res.status(200).json({
      success: true,
      message: "Login successful!",
      user: {
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Endpoint to handle payment info submission
app.post("/submit-payment", async (req, res) => {
  console.log("Received Payment Data:", req.body); // ✅ Check if productName exists

  const { productId, productName, email, phone, quantity, price, address } =
    req.body;

  if (
    !productId ||
    !productName ||
    !email ||
    !phone ||
    !quantity ||
    !price ||
    !address
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  try {
    const newPayment = new Payment({
      productId,
      productName, // ✅ Ensure it's included
      email,
      phone,
      quantity,
      price,
      address,
    });

    await newPayment.save();
    res.status(201).json({
      success: true,
      message: "Payment information saved successfully!",
    });
  } catch (err) {
    console.error("❌ Payment submission error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Endpoint to get orders for logged-in user
app.get("/orders", async (req, res) => {
  const { email } = req.query; // Get email from query parameters

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }

  try {
    const orders = await Payment.find({ email }).sort({ createdAt: -1 }); // Sort by latest first
    res.status(200).json({
      success: true,
      orders,
    });
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//Admin seeing and deletes registered users
// Endpoint to fetch all registered users
app.get("/admin/registered-users", async (req, res) => {
  try {
    const users = await User.find({}, "email phone"); // Fetch only email & phone
    res.status(200).json({ success: true, users });
  } catch (err) {
    console.error("❌ Error fetching registered users:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Endpoint to delete a user by ID
app.delete("/admin/delete-user/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully!" });
  } catch (err) {
    console.error("❌ Error deleting user:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//Requests for admin
// Fetch pending requests (status = "pending")
app.get("/admin/pending-requests", async (req, res) => {
  try {
    const pendingRequests = await Payment.find({ status: "pending" });
    res.status(200).json({ success: true, requests: pendingRequests });
  } catch (err) {
    console.error("❌ Error fetching pending requests:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Accept request (update status to "accepted")
app.put("/admin/accept-request/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updatedRequest = await Payment.findByIdAndUpdate(
      id,
      { status: "accepted" },
      { new: true }
    );
    if (!updatedRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Request accepted successfully!" });
  } catch (err) {
    console.error("❌ Error accepting request:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Fetch accepted requests (status = "accepted")
app.get("/admin/accepted-requests", async (req, res) => {
  try {
    const acceptedRequests = await Payment.find({ status: "accepted" });
    res.status(200).json({ success: true, requests: acceptedRequests });
  } catch (err) {
    console.error("❌ Error fetching accepted requests:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Mark request as delivered
app.put("/admin/deliver-request/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updatedRequest = await Payment.findByIdAndUpdate(
      id,
      { status: "delivered" },
      { new: true }
    );
    if (!updatedRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Request marked as delivered!" });
  } catch (err) {
    console.error("❌ Error marking request as delivered:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Fetch finished (delivered) requests
app.get("/admin/finished-requests", async (req, res) => {
  try {
    const finishedRequests = await Payment.find({ status: "delivered" });
    res.status(200).json({ success: true, requests: finishedRequests });
  } catch (err) {
    console.error("❌ Error fetching finished requests:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
 app.get("/api", (req, res) => {
  res.send("Welcome to the Payment API");});
app.get('/*', (req, res) => {
  res.status(404).send("404, Page Not Found");
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
