import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, Sender, beginCell, toNano, Transaction } from '@ton/core';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOJettonWallet } from '../wrappers/DIAOJettonWallet';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';
import { config as addrConfig } from '../wrappers/config';

const DIAO = 1_000_000_000n;
const PACKAGE_TOTAL = 3_200_000n * DIAO;
const PACKAGE_IMMEDIATE = 200_000n * DIAO;
const BUYER_RELEASE_PER_ROUND = 200_000n * DIAO;
const BUYER_AND_RESERVE_POOL = 7_500_000_000n * DIAO;
const ROUND_ALLOCATION = 500_000_000n * DIAO;
const MANUAL_PRICE_COOLDOWN = 24 * 3600;

function hasBouncedMessage(transactions: Transaction[]): boolean {
    return transactions.some((tx) => tx.inMessage?.info.type === 'internal' && tx.inMessage.info.bounced);
}

function hasFailedTransaction(transactions: Transaction[]): boolean {
    return transactions.some((tx) => {
        if (tx.description.type !== 'generic') {
            return false;
        }
        const compute = tx.description.computePhase;
        return tx.description.aborted || (compute.type === 'vm' && compute.exitCode !== 0 && compute.exitCode !== 1);
    });
}

describe('DIAO Vesting async-safe transfer retry', () => {
    let minterCode: Cell;
    let walletCode: Cell;
    let vestingCode: Cell;

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let buyer: SandboxContract<TreasuryContract>;
    let minter: SandboxContract<DIAOJettonMinter>;
    let vesting: SandboxContract<DIAOVestingController>;
    let adminSender: Sender;
    let priceAdminSender: Sender;
    let reserveSender: Sender;
    let teamSender: Sender;

    beforeAll(async () => {
        minterCode = await compile('DIAOJettonMinter');
        walletCode = await compile('DIAOJettonWallet');
        vestingCode = await compile('DIAOVestingController');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1_000_000;
        deployer = await blockchain.treasury('deployer');
        buyer = await blockchain.treasury('buyer');
        adminSender = blockchain.sender(addrConfig.adminWallet);
        priceAdminSender = blockchain.sender(addrConfig.priceAdminWallet);
        reserveSender = blockchain.sender(addrConfig.officialReserveWallet);
        teamSender = blockchain.sender(addrConfig.teamWallet);

        await deployer.send({ to: addrConfig.adminWallet, value: toNano('1000') });
        await deployer.send({ to: addrConfig.priceAdminWallet, value: toNano('1000') });
        await deployer.send({ to: addrConfig.officialReserveWallet, value: toNano('1000') });
        await deployer.send({ to: addrConfig.teamWallet, value: toNano('1000') });

        minter = blockchain.openContract(
            DIAOJettonMinter.createFromConfig(
                {
                    totalSupply: 0n,
                    adminAddress: deployer.address,
                    content: beginCell().storeUint(1, 8).endCell(),
                    jettonWalletCode: walletCode,
                    mintable: true,
                },
                minterCode
            )
        );
        await minter.sendDeploy(deployer.getSender(), toNano('0.05'));

        vesting = blockchain.openContract(
            DIAOVestingController.createFromConfig(
                {
                    adminAddress: addrConfig.adminWallet,
                    priceSourceAddress: addrConfig.priceAdminWallet,
                    treasuryAddress: addrConfig.treasuryWallet,
                    officialReserveAddress: addrConfig.officialReserveWallet,
                    teamAddress: addrConfig.teamWallet,
                    emergencyRescueAddress: addrConfig.emergencyRescueWallet,
                    jettonMinterAddress: minter.address,
                    jettonWalletCode: walletCode,
                    saleActive: true,
                    saleFinalized: false,
                    paused: false,
                    totalPackagesSold: 0,
                    currentUnlockedRound: 0,
                    pendingRound: 0,
                    pendingSubmittedAt: 0,
                    reserveAlreadyClaimed: 0n,
                    teamClaimedRound: 15,
                    funded: true,
                    emergencyRescued: 0n,
                },
                vestingCode
            )
        );
        await vesting.sendDeploy(deployer.getSender(), toNano('0.05'));
    });

    async function fundVestingWallet() {
        await minter.sendInitMint(deployer.getSender(), {
            initialCirculationAddress: addrConfig.initialCirculationWallet,
            vestingControllerAddress: vesting.address,
            initialCirculationTonAmount: toNano('0.1'),
            vestingControllerTonAmount: toNano('0.1'),
            value: toNano('0.3'),
        });
    }

    async function unlockTo(round: number) {
        for (let r = 1; r <= round; r++) {
            const before = await vesting.getVestingData();
            if (before.currentUnlockedRound >= r) {
                continue;
            }
            const now = blockchain.now!;
            await vesting.sendSubmitPrice(priceAdminSender, {
                price: 10_000_000n * (1n << BigInt(r)),
                targetRound: r,
                value: toNano('0.05'),
            });
            blockchain.now = now + MANUAL_PRICE_COOLDOWN;
            await vesting.sendExecuteUnlock(buyer.getSender(), { value: toNano('0.05') });
        }
    }

    async function getJettonBalance(owner: Address): Promise<bigint> {
        const walletAddress = await minter.getWalletAddress(owner);
        const wallet = blockchain.openContract(DIAOJettonWallet.createFromAddress(walletAddress));
        try {
            return (await wallet.getWalletData()).jettonBalance;
        } catch {
            return 0n;
        }
    }

    it('keeps BuyPackage immediate DIAO retryable after transfer failure', async () => {
        const result = await vesting.sendBuyPackage(buyer.getSender(), { packageCount: 1, value: toNano('58.2') });

        expect(result.transactions).toHaveTransaction({ from: buyer.address, to: vesting.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);
        expect((await vesting.getUserPackages(buyer.address)).packageCount).toBe(1);
        expect((await vesting.getVestingData()).totalPackagesSold).toBe(1);
        expect(await getJettonBalance(buyer.address)).toBe(0n);
        expect(await vesting.getPendingBuyerDiao(buyer.address)).toBe(PACKAGE_IMMEDIATE);

        await fundVestingWallet();
        const retry = await vesting.sendRetryBuyerTransfer(buyer.getSender(), { value: toNano('0.2') });
        expect(retry.transactions).toHaveTransaction({ from: buyer.address, to: vesting.address, success: true });
        expect(await getJettonBalance(buyer.address)).toBe(PACKAGE_IMMEDIATE);
        expect(await vesting.getPendingBuyerDiao(buyer.address)).toBe(0n);

        const duplicate = await vesting.sendRetryBuyerTransfer(buyer.getSender(), { value: toNano('0.2') });
        expect(duplicate.transactions).toHaveTransaction({ from: buyer.address, to: vesting.address, success: false, exitCode: 117 });
        expect(await getJettonBalance(buyer.address)).toBe(PACKAGE_IMMEDIATE);
    });

    it('keeps ClaimBuyer DIAO retryable after transfer failure', async () => {
        await vesting.sendBuyPackage(buyer.getSender(), { packageCount: 1, value: toNano('58.2') });
        await unlockTo(1);

        const result = await vesting.sendClaimBuyer(buyer.getSender(), { value: toNano('0.2') });
        expect(result.transactions).toHaveTransaction({ from: buyer.address, to: vesting.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);
        expect((await vesting.getUserPackages(buyer.address)).highestClaimedRound).toBe(1);
        expect(await getJettonBalance(buyer.address)).toBe(0n);
        expect(await vesting.getPendingBuyerDiao(buyer.address)).toBe(PACKAGE_IMMEDIATE + BUYER_RELEASE_PER_ROUND);

        await fundVestingWallet();
        const retry = await vesting.sendRetryBuyerTransfer(buyer.getSender(), { value: toNano('0.2') });
        expect(retry.transactions).toHaveTransaction({ from: buyer.address, to: vesting.address, success: true });
        expect(await getJettonBalance(buyer.address)).toBe(PACKAGE_IMMEDIATE + BUYER_RELEASE_PER_ROUND);
        expect(await vesting.getPendingBuyerDiao(buyer.address)).toBe(0n);

        const duplicateClaim = await vesting.sendClaimBuyer(buyer.getSender(), { value: toNano('0.2') });
        expect(duplicateClaim.transactions).toHaveTransaction({ from: buyer.address, to: vesting.address, success: false, exitCode: 117 });
    });

    it('keeps ClaimReserve DIAO retryable after transfer failure', async () => {
        await vesting.sendBuyPackage(buyer.getSender(), { packageCount: 1, value: toNano('58.2') });
        await vesting.sendAdminControl(adminSender, { action: 7, value: toNano('0.05') });
        await unlockTo(1);

        const claimAmount = (BUYER_AND_RESERVE_POOL - PACKAGE_TOTAL) / 15n;
        const result = await vesting.sendClaimReserve(reserveSender, { value: toNano('0.2') });
        expect(result.transactions).toHaveTransaction({ from: addrConfig.officialReserveWallet, to: vesting.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);
        expect((await vesting.getVestingData()).reserveAlreadyClaimed).toBe(claimAmount);
        expect(await getJettonBalance(addrConfig.officialReserveWallet)).toBe(0n);
        expect(await vesting.getPendingReserveDiao()).toBe(claimAmount);

        await fundVestingWallet();
        const retry = await vesting.sendRetryReserveTransfer(reserveSender, { value: toNano('0.2') });
        expect(retry.transactions).toHaveTransaction({ from: addrConfig.officialReserveWallet, to: vesting.address, success: true });
        expect(await getJettonBalance(addrConfig.officialReserveWallet)).toBe(claimAmount);
        expect(await vesting.getPendingReserveDiao()).toBe(0n);

        const duplicate = await vesting.sendRetryReserveTransfer(reserveSender, { value: toNano('0.2') });
        expect(duplicate.transactions).toHaveTransaction({ from: addrConfig.officialReserveWallet, to: vesting.address, success: false, exitCode: 117 });
    });

    it('keeps ClaimTeam DIAO retryable after transfer failure', async () => {
        await unlockTo(16);

        const result = await vesting.sendClaimTeam(teamSender, { value: toNano('0.2') });
        expect(result.transactions).toHaveTransaction({ from: addrConfig.teamWallet, to: vesting.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);
        expect((await vesting.getVestingData()).teamClaimedRound).toBe(16);
        expect(await getJettonBalance(addrConfig.teamWallet)).toBe(0n);
        expect(await vesting.getPendingTeamDiao()).toBe(ROUND_ALLOCATION);

        await fundVestingWallet();
        const retry = await vesting.sendRetryTeamTransfer(teamSender, { value: toNano('0.2') });
        expect(retry.transactions).toHaveTransaction({ from: addrConfig.teamWallet, to: vesting.address, success: true });
        expect(await getJettonBalance(addrConfig.teamWallet)).toBe(ROUND_ALLOCATION);
        expect(await vesting.getPendingTeamDiao()).toBe(0n);

        const duplicate = await vesting.sendRetryTeamTransfer(teamSender, { value: toNano('0.2') });
        expect(duplicate.transactions).toHaveTransaction({ from: addrConfig.teamWallet, to: vesting.address, success: false, exitCode: 117 });
    });

    it('keeps EmergencyRescueDiao retryable after transfer failure', async () => {
        await vesting.sendAdminControl(adminSender, { action: 3, value: toNano('0.05') });

        const rescueAmount = 1n * DIAO;
        const result = await vesting.sendEmergencyRescueDiao(adminSender, {
            recipient: addrConfig.emergencyRescueWallet,
            amount: rescueAmount,
            value: toNano('0.2'),
        });

        expect(result.transactions).toHaveTransaction({ from: addrConfig.adminWallet, to: vesting.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);
        expect((await vesting.getVestingData()).emergencyRescued).toBe(rescueAmount);
        expect(await getJettonBalance(addrConfig.emergencyRescueWallet)).toBe(0n);
        expect(await vesting.getPendingRescueDiao(addrConfig.emergencyRescueWallet)).toBe(rescueAmount);

        await fundVestingWallet();
        const retry = await vesting.sendRetryRescueTransfer(adminSender, {
            recipient: addrConfig.emergencyRescueWallet,
            value: toNano('0.2'),
        });
        expect(retry.transactions).toHaveTransaction({ from: addrConfig.adminWallet, to: vesting.address, success: true });
        expect(await getJettonBalance(addrConfig.emergencyRescueWallet)).toBe(rescueAmount);
        expect(await vesting.getPendingRescueDiao(addrConfig.emergencyRescueWallet)).toBe(0n);

        const duplicate = await vesting.sendRetryRescueTransfer(adminSender, {
            recipient: addrConfig.emergencyRescueWallet,
            value: toNano('0.2'),
        });
        expect(duplicate.transactions).toHaveTransaction({ from: addrConfig.adminWallet, to: vesting.address, success: false, exitCode: 117 });
    });
});
