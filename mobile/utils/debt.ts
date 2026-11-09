import { Balance } from "../types";

export type DebtEdge = {
  fromUser: Balance;
  toUser: Balance;
  amount: number;
  currency: string;
};

// Greedy debt simplification algorithm
export function simplifyDebts(
  balances: Balance[],
  currentUserId: string | undefined, // Allow undefined regarding "You" node construction but strictly logic works on user_ids
  defaultCurrency: string,
  currentParticipantId?: string
): DebtEdge[] {
  const byCurrency = new Map<string, Balance[]>();
  // Create a copy to allow mutation during the greedy pairing process
  const balancesCopy = balances.map(b => ({ ...b, amount: b.amount }));
  
  const addBalance = (b: Balance) => {
    const list = byCurrency.get(b.currency) || [];
    list.push(b);
    byCurrency.set(b.currency, list);
  };
  balancesCopy.forEach(addBalance);

  const edges: DebtEdge[] = [];

  byCurrency.forEach((currencyBalances, currency) => {
    const sumOthers = currencyBalances.reduce((sum, b) => sum + b.amount, 0);

    const allBalances = [...currencyBalances];
    if (currentUserId && Math.abs(sumOthers) > 0.01) {
       // Check if the current user is already in the list
       const userInList = allBalances.some(b => b.user_id === currentUserId);
       
       if (!userInList) {
          // Only add "You" if the sum is not zero and user is missing
          const myBalanceAmount = -sumOthers;
          if (Math.abs(myBalanceAmount) > 0.01) {
               allBalances.push({
                   user_id: currentUserId,
                   participant_id: currentParticipantId,
                   amount: myBalanceAmount,
                   currency: currency,
                   full_name: "You",
               } as Balance);
          }
       }
    }

    const debtors = allBalances
      .filter((b) => b.amount < -0.01)
      .sort((a, b) => a.amount - b.amount);
    const creditors = allBalances
      .filter((b) => b.amount > 0.01)
      .sort((a, b) => b.amount - a.amount);

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(Math.abs(debtor.amount), creditor.amount);

      edges.push({
        fromUser: debtor,
        toUser: creditor,
        amount: amount,
        currency: currency,
      });

      debtor.amount += amount;
      creditor.amount -= amount;

      if (Math.abs(debtor.amount) < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }
  });

  return edges;
}
