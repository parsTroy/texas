import { Card } from '../types/poker';

// Hand rankings from highest to lowest
export enum HandRank {
  ROYAL_FLUSH = 10,
  STRAIGHT_FLUSH = 9,
  FOUR_OF_A_KIND = 8,
  FULL_HOUSE = 7,
  FLUSH = 6,
  STRAIGHT = 5,
  THREE_OF_A_KIND = 4,
  TWO_PAIR = 3,
  ONE_PAIR = 2,
  HIGH_CARD = 1
}

export interface HandResult {
  rank: HandRank;
  name: string;
  cards: Card[];  // The 5 cards that make up the hand
  description: string;  // Detailed description of the hand
}

// Helper function to count occurrences of each rank
function getRankCounts(cards: Card[]): Map<string, number> {
  const counts = new Map<string, number>();
  cards.forEach(card => {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  });
  return counts;
}

// Helper function to check for flush
function checkFlush(cards: Card[]): Card[] | null {
  const suitCounts = new Map<string, Card[]>();
  cards.forEach(card => {
    if (!suitCounts.has(card.suit)) {
      suitCounts.set(card.suit, []);
    }
    suitCounts.get(card.suit)!.push(card);
  });

  for (const [_, suitCards] of suitCounts) {
    if (suitCards.length >= 5) {
      return suitCards.sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank)).slice(0, 5);
    }
  }
  return null;
}

// Helper function to check for straight
function checkStraight(cards: Card[]): Card[] | null {
  // Convert ranks to values and sort
  const values = Array.from(new Set(cards.map(card => getRankValue(card.rank)))).sort((a, b) => b - a);
  
  // Special case for Ace-low straight (A,2,3,4,5)
  if (values.includes(14)) { // Ace
    values.push(1);
  }

  // Check for 5 consecutive values
  for (let i = 0; i < values.length - 4; i++) {
    if (values[i] - values[i + 4] === 4) {
      // Find the actual cards that make up this straight
      const straightCards: Card[] = [];
      const targetValues = Array.from({length: 5}, (_, j) => values[i] - j);
      targetValues.forEach(value => {
        const card = cards.find(c => getRankValue(c.rank) === value);
        if (card) straightCards.push(card);
      });
      return straightCards;
    }
  }
  return null;
}

// Helper function to get numeric value of a rank
function getRankValue(rank: string): number {
  const values: { [key: string]: number } = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  return values[rank];
}

export function evaluateHand(cards: Card[]): HandResult {
  // Sort cards by rank value in descending order
  const sortedCards = [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
  
  // Check for flush
  const flush = checkFlush(sortedCards);
  
  // Check for straight
  const straight = checkStraight(sortedCards);
  
  // If we have both a flush and a straight, check for straight flush
  if (flush && straight) {
    const straightFlush = checkStraight(flush);
    if (straightFlush) {
      // Check if it's a royal flush
      if (getRankValue(straightFlush[0].rank) === 14) {
        return {
          rank: HandRank.ROYAL_FLUSH,
          name: 'Royal Flush',
          cards: straightFlush,
          description: `Royal Flush in ${straightFlush[0].suit}s`
        };
      }
      return {
        rank: HandRank.STRAIGHT_FLUSH,
        name: 'Straight Flush',
        cards: straightFlush,
        description: `${straightFlush[0].rank}-high Straight Flush in ${straightFlush[0].suit}s`
      };
    }
  }

  // Get rank counts for pairs, trips, etc.
  const rankCounts = getRankCounts(sortedCards);
  const countsByFreq = new Map<number, string[]>();
  rankCounts.forEach((count, rank) => {
    if (!countsByFreq.has(count)) {
      countsByFreq.set(count, []);
    }
    countsByFreq.get(count)!.push(rank);
  });

  // Check for four of a kind
  if (countsByFreq.has(4)) {
    const quadsRank = countsByFreq.get(4)![0];
    const kicker = sortedCards.find(card => card.rank !== quadsRank);
    const cards = [
      ...sortedCards.filter(card => card.rank === quadsRank),
      kicker!
    ];
    return {
      rank: HandRank.FOUR_OF_A_KIND,
      name: 'Four of a Kind',
      cards,
      description: `Four ${quadsRank}s with ${kicker!.rank} kicker`
    };
  }

  // Check for full house
  if (countsByFreq.has(3) && countsByFreq.has(2)) {
    const tripsRank = countsByFreq.get(3)![0];
    const pairRank = countsByFreq.get(2)![0];
    const cards = [
      ...sortedCards.filter(card => card.rank === tripsRank),
      ...sortedCards.filter(card => card.rank === pairRank).slice(0, 2)
    ];
    return {
      rank: HandRank.FULL_HOUSE,
      name: 'Full House',
      cards,
      description: `${tripsRank}s full of ${pairRank}s`
    };
  }

  // Return flush if we have one
  if (flush) {
    return {
      rank: HandRank.FLUSH,
      name: 'Flush',
      cards: flush,
      description: `${flush[0].rank}-high ${flush[0].suit} Flush`
    };
  }

  // Return straight if we have one
  if (straight) {
    return {
      rank: HandRank.STRAIGHT,
      name: 'Straight',
      cards: straight,
      description: `${straight[0].rank}-high Straight`
    };
  }

  // Check for three of a kind
  if (countsByFreq.has(3)) {
    const tripsRank = countsByFreq.get(3)![0];
    const kickers = sortedCards
      .filter(card => card.rank !== tripsRank)
      .slice(0, 2);
    const cards = [
      ...sortedCards.filter(card => card.rank === tripsRank),
      ...kickers
    ];
    return {
      rank: HandRank.THREE_OF_A_KIND,
      name: 'Three of a Kind',
      cards,
      description: `Three ${tripsRank}s with ${kickers.map(k => k.rank).join(', ')} kickers`
    };
  }

  // Check for two pair
  if (countsByFreq.has(2) && countsByFreq.get(2)!.length >= 2) {
    const pairRanks = countsByFreq.get(2)!.slice(0, 2);
    const kicker = sortedCards.find(card => !pairRanks.includes(card.rank));
    const cards = [
      ...sortedCards.filter(card => card.rank === pairRanks[0]),
      ...sortedCards.filter(card => card.rank === pairRanks[1]),
      kicker!
    ];
    return {
      rank: HandRank.TWO_PAIR,
      name: 'Two Pair',
      cards,
      description: `${pairRanks[0]}s and ${pairRanks[1]}s with ${kicker!.rank} kicker`
    };
  }

  // Check for one pair
  if (countsByFreq.has(2)) {
    const pairRank = countsByFreq.get(2)![0];
    const kickers = sortedCards
      .filter(card => card.rank !== pairRank)
      .slice(0, 3);
    const cards = [
      ...sortedCards.filter(card => card.rank === pairRank),
      ...kickers
    ];
    return {
      rank: HandRank.ONE_PAIR,
      name: 'One Pair',
      cards,
      description: `Pair of ${pairRank}s with ${kickers.map(k => k.rank).join(', ')} kickers`
    };
  }

  // High card
  return {
    rank: HandRank.HIGH_CARD,
    name: 'High Card',
    cards: sortedCards.slice(0, 5),
    description: `${sortedCards[0].rank}-high with ${sortedCards.slice(1, 5).map(c => c.rank).join(', ')}`
  };
}

export function findBestHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  return evaluateHand(allCards);
} 