const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    firstName: { type: String, required: true },
    username: { type: String, default: "" },
    walletBalance: {
      type: Number,
      default: 50, // 50 Birr Welcome Bonus
      min: [0, "Wallet balance cannot be negative"]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
