// DIAO Token and Vesting Constants

// Token Decimals
const DIAO_DECIMALS = 9;

// Supply buckets (in base units / nanoDIAO)
const TOTAL_SUPPLY = 10000000000000000000;       // 10,000,000,000 DIAO
const INITIAL_UNLOCK = 1000000000000000000;      // 1,000,000,000 DIAO
const LOCKED_SUPPLY = 9000000000000000000;       // 9,000,000,000 DIAO
const ROUND_ALLOCATION = 500000000000000000;     // 500,000,000 DIAO
const BUYER_AND_RESERVE_POOL = 7500000000000000000; // 7,500,000,000 DIAO (rounds 1-15)
const TEAM_TOTAL = 1500000000000000000;             // 1,500,000,000 DIAO (rounds 16-18)

// Package configuration
const PACKAGE_PRICE_TON = 58000000000;           // 58 TON (in nanoTON)
const PACKAGE_IMMEDIATE = 200000000000000;       // 200,000 DIAO
const PACKAGE_LOCKED = 3000000000000000;         // 3,000,000 DIAO
const PACKAGE_TOTAL = 3200000000000000;          // 3,200,000 DIAO
const MAX_PACKAGES_TOTAL = 2000;
const MAX_PACKAGES_PER_WALLET = 10;

// Rounds and Claims
const BUYER_RELEASE_PER_ROUND = 200000000000000; // 200,000 DIAO
const MAX_BUYER_ROUNDS = 15;
const TOTAL_ROUNDS = 18;

// Time constraints
const MANUAL_PRICE_COOLDOWN = 86400;             // 24 hours in seconds
const MANUAL_PRICE_VALIDITY = 172800;            // 48 hours in seconds
const MIN_CONTROLLER_TON_RESERVE = 50000000;     // 0.05 TON reserve after withdrawals

// Price Math
const PRICE_SCALE = 1000000000000;               // 10^12
const INITIAL_PRICE_SCALED = 10000000;           // 0.00001 * 10^12
