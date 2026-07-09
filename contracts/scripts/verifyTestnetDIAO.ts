import 'dotenv/config';
import { Address } from '@ton/core';
import { TonClient } from '@ton/ton';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOJettonWallet } from '../wrappers/DIAOJettonWallet';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';

const endpoint = process.env.TONCENTER_ENDPOINT ?? 'https://testnet.toncenter.com/api/v2/jsonRPC';
const apiKey = process.env.TONCENTER_API_KEY;
const minterAddress = process.env.DIAO_TESTNET_MINTER;
const vestingAddress = process.env.DIAO_TESTNET_VESTING;
const testnetWallet = process.env.DIAO_TESTNET_WALLET;

if (!minterAddress || !vestingAddress || !testnetWallet) {
    throw new Error('Missing DIAO_TESTNET_MINTER, DIAO_TESTNET_VESTING, or DIAO_TESTNET_WALLET in .env');
}

const resolvedMinterAddress = minterAddress;
const resolvedVestingAddress = vestingAddress;
const resolvedTestnetWallet = testnetWallet;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimitError(error: unknown) {
    const candidate = error as { response?: { status?: number; data?: unknown }; status?: number };
    return candidate.response?.status === 429 || candidate.status === 429;
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
            console.warn(`${label}: Toncenter rate limit, retrying...`);
        }
    }

    throw new Error(`${label}: retry loop exhausted`);
}

async function main() {
    const client = new TonClient({ endpoint, apiKey });
    const minter = client.open(DIAOJettonMinter.createFromAddress(Address.parse(resolvedMinterAddress)));
    const vesting = client.open(DIAOVestingController.createFromAddress(Address.parse(resolvedVestingAddress)));
    const walletOwner = Address.parse(resolvedTestnetWallet);

    const jettonData = await withRetry('get_jetton_data', () => minter.getJettonData());
    await sleep(1_200);
    const vestingData = await withRetry('get_vesting_data', () => vesting.getVestingData());
    await sleep(1_200);

    const circulationWalletAddress = await withRetry('get circulation wallet address', () => minter.getWalletAddress(walletOwner));
    await sleep(1_200);
    const vestingWalletAddress = await withRetry('get vesting wallet address', () =>
        minter.getWalletAddress(Address.parse(resolvedVestingAddress)),
    );

    const circulationWallet = client.open(DIAOJettonWallet.createFromAddress(circulationWalletAddress));
    const vestingWallet = client.open(DIAOJettonWallet.createFromAddress(vestingWalletAddress));

    await sleep(1_200);
    const circulationWalletData = await withRetry('get circulation wallet data', () => circulationWallet.getWalletData());
    await sleep(1_200);
    const vestingWalletData = await withRetry('get vesting wallet data', () => vestingWallet.getWalletData());

    console.log('DIAO testnet verification');
    console.log('Minter:', Address.parse(resolvedMinterAddress).toString());
    console.log('Vesting:', Address.parse(resolvedVestingAddress).toString());
    console.log('Test wallet:', walletOwner.toString());
    console.log('Total supply:', jettonData.totalSupply.toString());
    console.log('Mintable:', jettonData.mintable);
    console.log('Vesting funded:', vestingData.funded);
    console.log('Sale active:', vestingData.saleActive);
    console.log('Current unlocked round:', vestingData.currentUnlockedRound);
    console.log('Emergency rescue address:', vestingData.emergencyRescueAddress.toString());
    console.log('Circulation jetton wallet:', circulationWalletAddress.toString());
    console.log('Circulation wallet DIAO:', circulationWalletData.jettonBalance.toString());
    console.log('Vesting jetton wallet:', vestingWalletAddress.toString());
    console.log('Vesting wallet DIAO:', vestingWalletData.jettonBalance.toString());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
