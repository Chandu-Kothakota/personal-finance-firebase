import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { Debt } from "../types";

const MINOR_UNITS_PER_MAJOR_UNIT = 100;

function paymentAmountToMinorUnits(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const scaledAmount = amount * MINOR_UNITS_PER_MAJOR_UNIT;
  const minorUnits = Math.round(scaledAmount);
  if (Math.abs(scaledAmount - minorUnits) > 1e-7) {
    throw new Error("Payment amount cannot have more than two decimal places.");
  }

  return minorUnits;
}

function balanceToMinorUnits(balance: number): number {
  if (!Number.isFinite(balance)) {
    throw new Error("The debt has an invalid balance.");
  }

  return Math.max(0, Math.round(balance * MINOR_UNITS_PER_MAJOR_UNIT));
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export async function makeDebtPayment(
  uid: string,
  debtId: string,
  payment: { amount: number; date: string },
): Promise<void> {
  const paymentMinorUnits = paymentAmountToMinorUnits(payment.amount);
  if (!isValidDate(payment.date)) {
    throw new Error("Payment date is invalid.");
  }

  const debtRef = doc(db, "users", uid, "debts", debtId);
  const entryRef = doc(collection(db, "users", uid, "entries"));

  await runTransaction(db, async (transaction) => {
    const debtSnapshot = await transaction.get(debtRef);
    if (!debtSnapshot.exists()) {
      throw new Error("This debt no longer exists.");
    }

    const debt = debtSnapshot.data() as Omit<Debt, "id">;
    const balanceMinorUnits = balanceToMinorUnits(debt.balance);

    if (balanceMinorUnits === 0) {
      throw new Error("A payment cannot be made against a zero-balance debt.");
    }
    if (paymentMinorUnits > balanceMinorUnits) {
      throw new Error("Payment amount cannot exceed the current debt balance.");
    }

    const newBalance =
      (balanceMinorUnits - paymentMinorUnits) / MINOR_UNITS_PER_MAJOR_UNIT;

    transaction.update(debtRef, {
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });
    transaction.set(entryRef, {
      type: "debit",
      category: "Debt Payment",
      description: `Payment to ${debt.name}`,
      amount: paymentMinorUnits / MINOR_UNITS_PER_MAJOR_UNIT,
      currency: debt.currency,
      group: debt.group,
      date: payment.date,
      source: "debt_payment",
      debtId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}
