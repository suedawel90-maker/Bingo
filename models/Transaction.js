const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, index: true },
    type: {
      type: String,
      enum: ["DEPOSIT", "WITHDRAWAL", "GAME_ENTRY", "GAME_WIN"],
      required: true
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "REJECTED"],
      default: "PENDING",
      index: true
    },
    telebirrTxnId: { type: String, uppercase: true, sparse: true, unique: true },
    telebirrPhone: { type: String, default: null },
    description: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
