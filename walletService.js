const User = require("./models/User");
const Transaction = require("./models/Transaction");

const WELCOME_BONUS = 50;

async function getOrCreateUser(telegramUser) {
  let user = await User.findOne({ telegramId: telegramUser.id });

  if (!user) {
    user = await User.create({
      telegramId: telegramUser.id,
      firstName: telegramUser.first_name || "Player",
      username: telegramUser.username || "",
      walletBalance: WELCOME_BONUS
    });

    await Transaction.create({
      telegramId: telegramUser.id,
      type: "DEPOSIT",
      amount: WELCOME_BONUS,
      status: "COMPLETED",
      description: "🎉 Welcome Bonus Credit (50 Birr)"
    });
  }

  return user;
}

async function processDeposit(telegramId, amount, txnId) {
  const existingTxn = await Transaction.findOne({ telebirrTxnId: txnId });
  if (existingTxn) throw new Error("This Telebirr receipt has already been used.");

  await Transaction.create({
    telegramId,
    type: "DEPOSIT",
    amount,
    status: "COMPLETED",
    telebirrTxnId: txnId,
    description: `Telebirr Deposit (Txn: ${txnId})`
  });

  const updatedUser = await User.findOneAndUpdate(
    { telegramId },
    { $inc: { walletBalance: amount } },
    { new: true, upsert: true }
  );

  return { newBalance: updatedUser.walletBalance };
}

async function requestWithdrawal(telegramId, amount, phone) {
  const updatedUser = await User.findOneAndUpdate(
    { telegramId, walletBalance: { $gte: amount } },
    { $inc: { walletBalance: -amount } },
    { new: true }
  );

  if (!updatedUser) throw new Error("Insufficient wallet balance.");

  const txn = await Transaction.create({
    telegramId,
    type: "WITHDRAWAL",
    amount,
    status: "PENDING",
    telebirrPhone: phone,
    description: `Pending Telebirr cashout to ${phone}`
  });

  return { newBalance: updatedUser.walletBalance, requestId: txn._id };
}

async function deductBalance(telegramId, amount) {
  const user = await User.findOneAndUpdate(
    { telegramId, walletBalance: { $gte: amount } },
    { $inc: { walletBalance: -amount } },
    { new: true }
  );
  if (!user) throw new Error("Insufficient balance.");
  return user.walletBalance;
}

async function addBalance(telegramId, amount) {
  const user = await User.findOneAndUpdate(
    { telegramId },
    { $inc: { walletBalance: amount } },
    { new: true }
  );

  await Transaction.create({
    telegramId,
    type: "GAME_WIN",
    amount,
    status: "COMPLETED",
    description: "🏆 Bingo Round Winnings"
  });

  return user ? user.walletBalance : 0;
}

async function getTransactionHistory(telegramId, limit = 15) {
  return await Transaction.find({ telegramId }).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = {
  getOrCreateUser,
  processDeposit,
  requestWithdrawal,
  deductBalance,
  addBalance,
  getTransactionHistory
};
