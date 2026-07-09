import 'dotenv/config';
import { Address, toNano } from '@ton/core';
import { TonClient } from '@ton/ton';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOJettonWallet } from '../wrappers/DIAOJettonWallet';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';

const endpoint = process.env.TONCENTER_MAINNET_ENDPOINT ?? 'https://toncenter.com/api/v2/jsonRPC';
const apiKey = process.env.TONCENTER_API_KEY;
const minterAddress = process.env.DIAO_MAINNET_MINTER ?? 'EQDO5Wl-jFR2A9UrgZZKqQbV_2Ab56HZqMbVbj3G2noXJq3Y';
const vestingAddress = process.env.DIAO_MAINNET_VESTING ?? 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatUnits(amount: bigint) {
    const whole = amount / 1_000_000_000n;
    const fractional = amount % 1_000_000_000n;
    if (fractional === 0n) {
        return whole.toString();
    }
    return `${whole}.${fractional.toString().padStart(9, '0').replace(/0+$/, '')}`;
}

function isRateLimitError(error: unknown) {
    const candidate = error as { code?: string; response?: { status?: number }; status?: number };
    return candidate.response?.status === 429 || candidate.status === 429 || candidate.code === 'ECONNABORTED';
}

async function withRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
    const delays = [0, 3_000, 8_000, 15_000, 30_000];
    for (let attempt = 0; attempt < delays.length; attempt += 1) {
        if (delays[attempt] > 0) {
            console.log(`${label}: waiting ${delays[attempt] / 1000}s before retry ${attempt}`);
            await sleep(delays[attempt]);
        }
        try {
            return await action();
        } catch (error) {
            if (!isRateLimitError(error) || attempt === delays.length - 1) {
                throw error;
            }
            console.warn(`${label}: RPC rate limit, retrying...`);
        }
    }
    throw new Error(`${label}: retry loop exhausted`);
}

async function main() {
    const client = new TonClient({ endpoint, apiKey });
    const minterAddressParsed = Address.parse(minterAddress);
    const vestingAddressParsed = Address.parse(vestingAddress);
    const minter = client.open(DIAOJettonMinter.createFromAddress(minterAddressParsed));
    const vesting = client.open(DIAOVestingController.createFromAddress(vestingAddressParsed));

    const minterData = await withRetry('get jetton data', () => minter.getJettonData());
    await sleep(1_500);
    const vestingData = await withRetry('get vesting data', () => vesting.getVestingData());
    await sleep(1_500);
    const vestingAccount = await withRetry('get vesting account', () => client.getContractState(vestingAddressParsed));
    await sleep(1_500);
    const vestingJettonWalletAddress = await withRetry('get vesting jetton wallet address', () =>
        minter.getWalletAddress(vestingAddressParsed),
    );
    await sleep(1_500);
    const vestingJettonWallet = client.open(DIAOJettonWallet.createFromAddress(vestingJettonWalletAddress));
    const vestingJettonData = await withRetry('get vesting jetton wallet data', () => vestingJettonWallet.getWalletData());

    const maxWithdrawable = vestingAccount.balance > toNano('0.05')
        ? vestingAccount.balance - toNano('0.05')
        : 0n;

    console.log('DIAO mainnet status');
    console.log('  minter:', minterAddressParsed.toString());
    console.log('  vesting:', vestingAddressParsed.toString());
    console.log('  totalSupply:', formatUnits(minterData.totalSupply));
    console.log('  mintable:', minterData.mintable);
    console.log('  saleActive:', vestingData.saleActive);
    console.log('  saleFinalized:', vestingData.saleFinalized);
    console.log('  paused:', vestingData.paused);
    console.log('  funded:', vestingData.funded);
    console.log('  totalPackagesSold:', vestingData.totalPackagesSold);
    console.log('  currentUnlockedRound:', vestingData.currentUnlockedRound);
    console.log('  pendingRound:', vestingData.pendingRound);
    console.log('  admin:', vestingData.adminAddress.toString());
    console.log('  priceAdmin:', vestingData.priceSourceAddress.toString());
    console.log('  treasury:', vestingData.treasuryAddress.toString());
    console.log('  emergencyRescueAddress:', vestingData.emergencyRescueAddress.toString());
    console.log('  emergencyRescued:', formatUnits(vestingData.emergencyRescued));
    console.log('  vestingNativeBalance:', formatUnits(vestingAccount.balance));
    console.log('  maxWithdrawableKeeping0.05:', formatUnits(maxWithdrawable));
    console.log('  vestingJettonWallet:', vestingJettonWalletAddress.toString());
    console.log('  vestingDIAO:', formatUnits(vestingJettonData.jettonBalance));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
