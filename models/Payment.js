const paymentSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true }, // Add this line
  email: { type: String, required: true },
  phone: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  address: { type: String, required: true },
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;
