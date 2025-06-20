// Core types and interfaces for KasPunk platform
export interface KasPunk {
  token_id: number;
  image_url: string;
  is_listed: boolean;
  price?: number;
  rarity_rank: number;
  mint_implied_value: number;
  trait_count?: number;
  rarest_rarity?: number;
  traits?: Array<{
    trait_name: string;
    trait_value: string;
    rarity: number;
  }>;
  sales_history: Array<{
    sale_price: number;
    sale_date: string;
  }>;
}

export interface TraitData {
  trait_name: string;
  trait_value: string;
  rarity: number;
}

export interface SalesData {
  sale_price: number;
  sale_date: string;
}

export interface PriceEstimate {
  estimated_price: number;
  confidence_score: number;
  calculation_method: string;
  market_factors: Record<string, any>;
  traits_considered: Record<string, any>;
}

export interface MarketMetrics {
  total_volume: number;
  avg_price: number;
  floor_price: number;
  total_sales: number;
  active_listings: number;
}

// Core utility functions
export const formatPrice = (priceValue: number): string => {
  if (priceValue >= 1000000) {
    // 1M+ → "1.2M" format
    return `${(priceValue / 1000000).toFixed(1)}M`;
  } else if (priceValue >= 100000) {
    // 100K+ → "125K" format (no decimal for cleaner look)
    return `${Math.round(priceValue / 1000)}K`;
  } else if (priceValue >= 10000) {
    // 10K-99K → "15.5K" format
    return `${(priceValue / 1000).toFixed(1)}K`;
  } else if (priceValue >= 1000) {
    // 1K-9.9K → "1.5K" format
    return `${(priceValue / 1000).toFixed(1)}K`;
  } else {
    // Under 1K → show full number
    return priceValue.toFixed(0);
  }
};

export const calculateRarityScore = (traits: TraitData[]): number => {
  if (!traits || traits.length === 0) return 0;
  
  const validTraits = traits.filter(trait => 
    trait.trait_value && 
    trait.trait_value !== '-' && 
    trait.trait_value.trim() !== '' &&
    trait.trait_value.toLowerCase() !== 'none'
  );
  
  if (validTraits.length === 0) return 0;
  
  // Calculate combined rarity score
  const raritySum = validTraits.reduce((sum, trait) => sum + (100 - trait.rarity), 0);
  return raritySum / validTraits.length;
};

export const isValidTrait = (trait: TraitData): boolean => {
  return trait.trait_value && 
         trait.trait_value !== '-' && 
         trait.trait_value.trim() !== '' &&
         trait.trait_value.toLowerCase() !== 'none';
};

export const getTraitMultiplier = (traits: TraitData[]): number => {
  if (!traits) return 1;
  
  const validTraits = traits.filter(isValidTrait);
  const traitCount = validTraits.length;
  
  // Base multiplier from trait count
  let multiplier = 1 + (Math.log(traitCount + 1) * 0.15);
  
  // Rarity bonus for ultra-rare traits
  const ultraRareTraits = validTraits.filter(t => t.rarity < 1).length;
  const rareTraits = validTraits.filter(t => t.rarity >= 1 && t.rarity < 5).length;
  const uncommonTraits = validTraits.filter(t => t.rarity >= 5 && t.rarity < 15).length;
  
  // Apply rarity bonuses
  multiplier *= (1 + (ultraRareTraits * 0.25));
  multiplier *= (1 + (rareTraits * 0.10));
  multiplier *= (1 + (uncommonTraits * 0.05));
  
  return Math.min(multiplier, 2.5);
};

export const calculateEstimatedValue = (token: KasPunk, similarTokens: KasPunk[] = []): number => {
  try {
    const mintValue = token.mint_implied_value || 0;
    if (mintValue <= 0) return 5000;

    const baseValue = Math.max(mintValue * 1000, 1000);
    const traitMultiplier = getTraitMultiplier(token.traits);
    let estimatedValue = baseValue * traitMultiplier;

    // Use sales history if available
    if (token.sales_history && token.sales_history.length > 0) {
      const recentSales = token.sales_history
        .filter(sale => {
          const daysSinceSale = (Date.now() - new Date(sale.sale_date).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceSale <= 60;
        })
        .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());

      if (recentSales.length > 0) {
        const avgRecentPrice = recentSales.reduce((sum, sale) => sum + sale.sale_price, 0) / recentSales.length;
        estimatedValue = (estimatedValue * 0.3) + (avgRecentPrice * 0.7);
      }
    }

    return Math.max(Math.round(estimatedValue), 1000);
  } catch (error) {
    console.error('Error calculating estimated value:', error);
    return Math.max((token.mint_implied_value || 1) * 1000, 1000);
  }
};

export const formatTraitName = (traitName: string): string => {
  switch (traitName.toLowerCase()) {
    case 'acc1': return 'Accessory 1';
    case 'acc2': return 'Accessory 2';
    case 'type': return 'Type';
    case 'head': return 'Head';
    case 'eyes': return 'Eyes';
    case 'mouth': return 'Mouth';
    default: return traitName.charAt(0).toUpperCase() + traitName.slice(1);
  }
};

// Constants
export const TRAIT_ORDER = ['type', 'head', 'eyes', 'mouth', 'acc1', 'acc2'];

export const RARITY_TIERS = {
  LEGENDARY: { min: 1, max: 100, label: 'Legendary', color: '#F59E0B' },
  EPIC: { min: 101, max: 500, label: 'Epic', color: '#8B5CF6' },
  RARE: { min: 501, max: 1500, label: 'Rare', color: '#06B6D4' },
  UNCOMMON: { min: 1501, max: 5000, label: 'Uncommon', color: '#10B981' },
  COMMON: { min: 5001, max: 10000, label: 'Common', color: '#6B7280' }
};

export const getRarityTier = (rarityRank: number) => {
  for (const [key, tier] of Object.entries(RARITY_TIERS)) {
    if (rarityRank >= tier.min && rarityRank <= tier.max) {
      return { ...tier, key };
    }
  }
  return RARITY_TIERS.COMMON;
};