// Original trader economy for the web colony prototype.
export const TRADE_PRICES = Object.freeze({ food: 1, meals: 3, wood: 2, stone: 2, medicine: 8, meat: 2, berries: 2, wooden_club: 12, stone_armor: 25, fiber_cloak: 15 });
const TRADER_STOCK = Object.freeze({ food: 20, meals: 8, wood: 15, stone: 12, medicine: 3, meat: 8, berries: 10, wooden_club: 2, stone_armor: 1, fiber_cloak: 1 });
export function updateTrader(world) {
  if (world.minute !== 480) return world.trader || null;
  if (world.day % 3 === 0) {
    world.trader = { day: world.day, silver: 100, stock: { ...TRADER_STOCK } };
    world.messages.unshift("Bir tüccar koloniye geldi.");
  } else if (world.trader && world.trader.day < world.day) {
    world.trader = null;
    world.messages.unshift("Tüccar koloni bölgesinden ayrıldı.");
  }
  return world.trader || null;
}
export function tradeWithTrader(world, action, item, amount = 5) {
  const trader = world.trader;
  if (!trader || trader.day !== world.day) return { ok: false, error: "Şu anda tüccar yok." };
  if (!Object.hasOwn(TRADE_PRICES, item)) return { ok: false, error: "Bu eşya ticarete açık değil." };
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) return { ok: false, error: "Miktar 1–100 arasında tam sayı olmalı." };
  const price = TRADE_PRICES[item] * amount;
  world.stock.silver ??= 0;
  if (action === "buy") {
    if ((trader.stock[item] || 0) < amount) return { ok: false, error: "Tüccarda yeterli stok yok." };
    if (world.stock.silver < price) return { ok: false, error: "Yeterli gümüş yok." };
    trader.stock[item] -= amount; trader.silver += price; world.stock.silver -= price; world.stock[item] = (world.stock[item] || 0) + amount;
  } else if (action === "sell") {
    const payout = Math.max(1, Math.floor(price * 0.6));
    if ((world.stock[item] || 0) < amount) return { ok: false, error: "Kolonide satılacak kadar eşya yok." };
    if (trader.silver < payout) return { ok: false, error: "Tüccarın yeterli gümüşü yok." };
    world.stock[item] -= amount; trader.stock[item] = (trader.stock[item] || 0) + amount; world.stock.silver += payout; trader.silver -= payout;
    return { ok: true, action, item, amount, silver: payout };
  } else return { ok: false, error: "Geçersiz ticaret işlemi." };
  return { ok: true, action, item, amount, silver: price };
}
