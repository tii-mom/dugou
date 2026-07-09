import 'dotenv/config';
import { Address, beginCell, internal, OpenedContract, SendMode, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOJettonWallet } from '../wrappers/DIAOJettonWallet';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';

const endpoint = process.env.TONCENTER_ENDPOINT ?? 'https://testnet.toncenter.com/api/v2/jsonRPC';
const apiKey = process.env.TONCENTER_API_KEY;
const minterAddress = process.env.DIAO_TESTNET_MINTER;
const vestingAddress = process.env.DIAO_TESTNET_VESTING;
const expectedWalletAddress = process.env.DIAO_TESTNET_WALLET;
const mnemonic = process.env.MNEMONIC ?? process.env.WALLET_MNEMONIC;

const command = process.argv[2] ?? 'status';
const packageCount = Number(process.argv[3] ?? '1');

if (!minterAddress || !vestingAddress || !expectedWalletAddress || !mnemonic) {
    throw new Error('Missing DIAO_TESTNET_MINTER, DIAO_TESTNET_VESTING, DIAO_TESTNET_WALLET, or MNEMONIC in .env');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
            console.warn(`${label}: Toncenter rate limit, retrying...`);
        }
    }

    throw new Error(`${label}: retry loop exhausted`);
}

async function waitForSeqno(wallet: OpenedContract<WalletContractV4>, previousSeqno: number) {
    for (let i = 0; i < 30; i += 1) {
        await sleep(2_000);
        const currentSeqno = await withRetry('get wallet seqno', () => wallet.getSeqno());
        if (currentSeqno > previousSeqno) {
            return currentSeqno;
        }
    }

    throw new Error('Timed out waiting for wallet seqno change');
}

function formatDiao(amount: bigint) {
    const whole = amount / 1_000_000_000n;
    const fractional = amount % 1_000_000_000n;
    if (fractional === 0n) {
        return whole.toString();
    }
    return `${whole}.${fractional.toString().padStart(9, '0').replace(/0+$/, '')}`;
}

function targetPriceForRound(round: number) {
    if (!Number.isInteger(round) || round < 1 || round > 18) {
        throw new Error('Round must be an integer from 1 to 18');
    }

    return 10_000_000n * (1n << BigInt(round));
}

function parseDiaoAmount(input: string) {
    if (!/^\d+(\.\d{1,9})?$/.test(input)) {
        throw new Error('DIAO amount must be a positive decimal with up to 9 decimals');
    }

    const [whole, fractional = ''] = input.split('.');
    return BigInt(whole) * 1_000_000_000n + BigInt(fractional.padEnd(9, '0'));
}

async function readState(
    client: TonClient,
    walletOwner: Address,
    minter: OpenedContract<DIAOJettonMinter>,
    vesting: OpenedContract<DIAOVestingController>,
) {
    const vestingData = await withRetry('get vesting data', () => vesting.getVestingData());
    await sleep(1_200);
    const userPackages = await withRetry('get user packages', () => vesting.getUserPackages(walletOwner));
    await sleep(1_200);
    const userJettonWalletAddress = await withRetry('get user jetton wallet address', () => minter.getWalletAddress(walletOwner));
    const userJettonWallet = client.open(DIAOJettonWallet.createFromAddress(userJettonWalletAddress));
    await sleep(1_200);
    const userJettonData = await withRetry('get user jetton wallet data', () => userJettonWallet.getWalletData());
    await sleep(1_200);
    const vestingJettonWalletAddress = await withRetry('get vesting jetton wallet address', () =>
        minter.getWalletAddress(Address.parse(vestingAddress!)),
    );
    const vestingJettonWallet = client.open(DIAOJettonWallet.createFromAddress(vestingJettonWalletAddress));
    await sleep(1_200);
    const vestingJettonData = await withRetry('get vesting jetton wallet data', () => vestingJettonWallet.getWalletData());

    return {
        vestingData,
        userPackages,
        userJettonWalletAddress,
        userDiaoBalance: userJettonData.jettonBalance,
        vestingJettonWalletAddress,
        vestingDiaoBalance: vestingJettonData.jettonBalance,
    };
}

async function printState(state: Awaited<ReturnType<typeof readState>>) {
    console.log('Vesting status');
    console.log('  saleActive:', state.vestingData.saleActive);
    console.log('  saleFinalized:', state.vestingData.saleFinalized);
    console.log('  paused:', state.vestingData.paused);
    console.log('  funded:', state.vestingData.funded);
    console.log('  totalPackagesSold:', state.vestingData.totalPackagesSold);
    console.log('  currentUnlockedRound:', state.vestingData.currentUnlockedRound);
    console.log('  pendingRound:', state.vestingData.pendingRound);
    console.log('  emergencyRescueAddress:', state.vestingData.emergencyRescueAddress.toString());
    console.log('  emergencyRescued:', formatDiao(state.vestingData.emergencyRescued));
    console.log('User status');
    console.log('  packageCount:', state.userPackages.packageCount);
    console.log('  highestClaimedRound:', state.userPackages.highestClaimedRound);
    console.log('  userJettonWallet:', state.userJettonWalletAddress.toString());
    console.log('  userDIAO:', formatDiao(state.userDiaoBalance));
    console.log('Vesting wallet');
    console.log('  vestingJettonWallet:', state.vestingJettonWalletAddress.toString());
    console.log('  vestingDIAO:', formatDiao(state.vestingDiaoBalance));
}

async function sendMessageAndWait(
    label: string,
    openedWallet: OpenedContract<WalletContractV4>,
    secretKey: Buffer,
    message: ReturnType<typeof internal>,
) {
    const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
    await withRetry(label, () => openedWallet.sendTransfer({
        seqno,
        secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        messages: [message],
    }));
    const nextSeqno = await waitForSeqno(openedWallet, seqno);
    console.log('Wallet seqno changed:', seqno, '->', nextSeqno);
}

async function main() {
    const keyPair = await mnemonicToPrivateKey(mnemonic!.trim().split(/\s+/));
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const parsedExpectedWallet = Address.parse(expectedWalletAddress!);

    if (!wallet.address.equals(parsedExpectedWallet)) {
        throw new Error(`Mnemonic wallet ${wallet.address.toString()} does not match DIAO_TESTNET_WALLET ${parsedExpectedWallet.toString()}`);
    }

    const client = new TonClient({ endpoint, apiKey });
    const openedWallet = client.open(wallet);
    const sender = openedWallet.sender(keyPair.secretKey);
    const minter = client.open(DIAOJettonMinter.createFromAddress(Address.parse(minterAddress!)));
    const vesting = client.open(DIAOVestingController.createFromAddress(Address.parse(vestingAddress!)));

    console.log('DIAO testnet interaction');
    console.log('Command:', command);
    console.log('Wallet:', wallet.address.toString());
    console.log('Minter:', Address.parse(minterAddress!).toString());
    console.log('Vesting:', Address.parse(vestingAddress!).toString());

    if (command === 'status') {
        await printState(await readState(client, wallet.address, minter, vesting));
        return;
    }

    if (command === 'buy') {
        if (!Number.isInteger(packageCount) || packageCount < 1 || packageCount > 10) {
            throw new Error('Package count must be an integer from 1 to 10');
        }

        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before buy');
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        const value = toNano(58 * packageCount) + toNano('0.25');

        console.log(`Sending buyPackage(${packageCount}) with ${value.toString()} nanotons...`);
        await withRetry('send buy package transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value,
                    body: beginCell()
                        .storeUint(0x42555950, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .storeUint(packageCount, 8)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(12_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After buy');
        await printState(after);

        console.log('DIAO delta:', formatDiao(after.userDiaoBalance - before.userDiaoBalance));
        console.log('Package delta:', after.userPackages.packageCount - before.userPackages.packageCount);
        return;
    }

    if (command === 'submit-price') {
        const round = Number(process.argv[3] ?? '1');
        const price = process.argv[4] ? BigInt(process.argv[4]) : targetPriceForRound(round);
        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before submit-price');
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        const value = toNano('0.08');

        console.log(`Submitting price for round ${round}: ${price.toString()}`);
        await withRetry('send submit price transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value,
                    body: beginCell()
                        .storeUint(0x53554250, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .storeUint(price, 64)
                        .storeUint(round, 8)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After submit-price');
        await printState(after);
        return;
    }

    if (command === 'execute-unlock') {
        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before execute-unlock');
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        console.log('Executing pending unlock...');
        await withRetry('send execute unlock transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.08'),
                    body: beginCell()
                        .storeUint(0x4558554e, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After execute-unlock');
        await printState(after);
        return;
    }

    if (command === 'claim-buyer') {
        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before claim-buyer');
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        console.log('Claiming buyer unlocked DIAO...');
        await withRetry('send claim buyer transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.2'),
                    body: beginCell()
                        .storeUint(0x434c6275, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After claim-buyer');
        await printState(after);
        console.log('DIAO delta:', formatDiao(after.userDiaoBalance - before.userDiaoBalance));
        return;
    }

    if (command === 'claim-reserve' || command === 'claim-team') {
        const isReserve = command === 'claim-reserve';
        const before = await readState(client, wallet.address, minter, vesting);
        console.log(`Before ${command}`);
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        console.log(`Sending ${command}...`);
        await withRetry(`send ${command} transfer`, () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.25'),
                    body: beginCell()
                        .storeUint(isReserve ? 0x434c7265 : 0x434c746d, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log(`After ${command}`);
        await printState(after);
        console.log('DIAO delta:', formatDiao(after.userDiaoBalance - before.userDiaoBalance));
        return;
    }

    if (command === 'admin') {
        const action = Number(process.argv[3]);
        if (!Number.isInteger(action) || action < 1 || action > 7) {
            throw new Error('Admin action must be an integer from 1 to 7');
        }

        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before admin action');
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        console.log(`Sending admin action ${action}...`);
        await withRetry('send admin transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.08'),
                    body: beginCell()
                        .storeUint(0x41444d43, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .storeUint(action, 8)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After admin action');
        await printState(after);
        return;
    }

    if (command === 'withdraw-ton') {
        const amount = toNano(process.argv[3] ?? '1');
        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        console.log(`Withdrawing ${amount.toString()} nanotons to treasury...`);
        await withRetry('send withdraw transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.08'),
                    body: beginCell()
                        .storeUint(0x5744544f, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .storeCoins(amount)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);
        return;
    }

    if (command === 'rescue-diao') {
        const amount = parseDiaoAmount(process.argv[3] ?? '1');
        const recipient = wallet.address;
        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before rescue-diao');
        await printState(before);

        if (!before.vestingData.paused) {
            throw new Error('Vesting must be paused before rescue-diao. Run: npm run interact:testnet -- admin 3');
        }
        if (!before.vestingData.emergencyRescueAddress.equals(recipient)) {
            throw new Error(`Testnet rescue recipient mismatch. Expected ${before.vestingData.emergencyRescueAddress.toString()}, got ${recipient.toString()}`);
        }

        await sendMessageAndWait(
            'send emergency rescue transfer',
            openedWallet,
            keyPair.secretKey,
            internal({
                to: Address.parse(vestingAddress!),
                value: toNano('0.25'),
                body: beginCell()
                    .storeUint(0x45525351, 32)
                    .storeUint(BigInt(Date.now()), 64)
                    .storeAddress(recipient)
                    .storeCoins(amount)
                    .endCell(),
            }),
        );

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After rescue-diao');
        await printState(after);
        console.log('DIAO delta:', formatDiao(after.userDiaoBalance - before.userDiaoBalance));
        return;
    }

    if (command === 'unlock-to') {
        const targetRound = Number(process.argv[3]);
        if (!Number.isInteger(targetRound) || targetRound < 1 || targetRound > 18) {
            throw new Error('Target round must be an integer from 1 to 18');
        }

        let state = await readState(client, wallet.address, minter, vesting);
        await printState(state);

        while (state.vestingData.currentUnlockedRound < targetRound) {
            const nextRound = state.vestingData.currentUnlockedRound + 1;
            if (state.vestingData.pendingRound === 0) {
                const price = targetPriceForRound(nextRound);
                console.log(`Submitting round ${nextRound} price ${price.toString()}...`);
                await sendMessageAndWait(
                    'send submit price transfer',
                    openedWallet,
                    keyPair.secretKey,
                    internal({
                        to: Address.parse(vestingAddress!),
                        value: toNano('0.08'),
                        body: beginCell()
                            .storeUint(0x53554250, 32)
                            .storeUint(BigInt(Date.now()), 64)
                            .storeUint(price, 64)
                            .storeUint(nextRound, 8)
                            .endCell(),
                    }),
                );
            } else if (state.vestingData.pendingRound !== nextRound) {
                throw new Error(`Unexpected pending round ${state.vestingData.pendingRound}; expected ${nextRound}`);
            } else {
                console.log(`Round ${nextRound} already pending; executing it next.`);
            }

            console.log('Waiting 18s for testnet cooldown...');
            await sleep(18_000);

            console.log(`Executing round ${nextRound} unlock...`);
            await sendMessageAndWait(
                'send execute unlock transfer',
                openedWallet,
                keyPair.secretKey,
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.08'),
                    body: beginCell()
                        .storeUint(0x4558554e, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .endCell(),
                }),
            );

            await sleep(8_000);
            state = await readState(client, wallet.address, minter, vesting);
            console.log(`After round ${nextRound}`);
            await printState(state);
        }

        return;
    }

    throw new Error(
        `Unknown command: ${command}. Use "status", "buy [1-10]", "submit-price [round] [price]", "execute-unlock", "claim-buyer", "claim-reserve", "claim-team", "admin [1-7]", "withdraw-ton [amount]", "rescue-diao [amount]", or "unlock-to [round]".`,
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
