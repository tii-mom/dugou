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
const TEAM_TOTAL = 1_500_000_000n * DIAO;
const MANUAL_PRICE_COOLDOWN = 24 * 3600;

function txExitCode(tx: Transaction): number | undefined {
    const description = tx.description;
    if (description.type !== 'generic') {
        return undefined;
    }
    const compute = description.computePhase;
    if (compute.type === 'vm') {
        return compute.exitCode;
    }
    return undefined;
}

function hasBouncedMessage(transactions: Transaction[]): boolean {
    return transactions.some((tx) => {
        const info = tx.inMessage?.info;
        return info?.type === 'internal' && info.bounced;
    });
}

function hasFailedTransaction(transactions: Transaction[]): boolean {
    return transactions.some((tx) => {
        const description = tx.description;
        if (description.type !== 'generic') {
            return false;
        }
        const compute = description.computePhase;
        if (compute.type === 'vm' && compute.exitCode !== 0 && compute.exitCode !== 1) {
            return true;
        }
        return description.aborted;
    });
}

describe('DIAO TON async bounce / transfer failure coverage', () => {
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
                    funded: false,
                    emergencyRescued: 0n,
                },
                vestingCode
            )
        );
        await vesting.sendDeploy(deployer.getSender(), toNano('0.05'));

        await minter.sendInitMint(deployer.getSender(), {
            initialCirculationAddress: addrConfig.initialCirculationWallet,
            vestingControllerAddress: vesting.address,
            initialCirculationTonAmount: toNano('0.1'),
            vestingControllerTonAmount: toNano('0.1'),
            value: toNano('0.3'),
        });
    });

    async function unlockTo(round: number, target = vesting) {
        for (let r = 1; r <= round; r++) {
            const before = await target.getVestingData();
            if (before.currentUnlockedRound >= r) {
                continue;
            }
            const now = blockchain.now!;
            await target.sendSubmitPrice(priceAdminSender, {
                price: 10_000_000n * (1n << BigInt(r)),
                targetRound: r,
                value: toNano('0.05'),
            });
            blockchain.now = now + MANUAL_PRICE_COOLDOWN;
            await target.sendExecuteUnlock(buyer.getSender(), { value: toNano('0.05') });
        }
    }

    async function getJettonBalance(owner: Address, jettonMinter = minter): Promise<bigint> {
        const walletAddress = await jettonMinter.getWalletAddress(owner);
        const wallet = blockchain.openContract(DIAOJettonWallet.createFromAddress(walletAddress));
        try {
            return (await wallet.getWalletData()).jettonBalance;
        } catch {
            return 0n;
        }
    }

    async function deployFundedControllerWithInvalidWalletCode() {
        const broken = blockchain.openContract(
            DIAOVestingController.createFromConfig(
                {
                    adminAddress: addrConfig.adminWallet,
                    priceSourceAddress: addrConfig.priceAdminWallet,
                    treasuryAddress: addrConfig.treasuryWallet,
                    officialReserveAddress: addrConfig.officialReserveWallet,
                    teamAddress: addrConfig.teamWallet,
                    emergencyRescueAddress: addrConfig.emergencyRescueWallet,
                    jettonMinterAddress: minter.address,
                    jettonWalletCode: minterCode,
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
        await broken.sendDeploy(deployer.getSender(), toNano('0.05'));
        return broken;
    }

    it('covers BuyPackage immediate transfer failure with pending buyer DIAO', async () => {
        const broken = await deployFundedControllerWithInvalidWalletCode();
        const result = await broken.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.1'),
        });

        expect(result.transactions).toHaveTransaction({ from: buyer.address, to: broken.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);

        expect((await broken.getUserPackages(buyer.address)).packageCount).toBe(1);
        expect((await broken.getVestingData()).totalPackagesSold).toBe(1);
        expect(await getJettonBalance(buyer.address)).toBe(0n);
        expect(await broken.getPendingBuyerDiao(buyer.address)).toBe(PACKAGE_IMMEDIATE);
    });

    it('covers ClaimBuyer transfer failure with pending buyer DIAO', async () => {
        const broken = await deployFundedControllerWithInvalidWalletCode();
        await broken.sendBuyPackage(buyer.getSender(), { packageCount: 1, value: toNano('58.1') });
        await unlockTo(1, broken);

        const beforeBalance = await getJettonBalance(buyer.address);
        const result = await broken.sendClaimBuyer(buyer.getSender(), { value: toNano('0.2') });

        expect(result.transactions).toHaveTransaction({ from: buyer.address, to: broken.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);
        expect((await broken.getUserPackages(buyer.address)).highestClaimedRound).toBe(1);
        expect(await getJettonBalance(buyer.address)).toBe(beforeBalance);
        expect(await broken.getPendingBuyerDiao(buyer.address)).toBe(PACKAGE_IMMEDIATE + BUYER_RELEASE_PER_ROUND);

        const retry = await broken.sendClaimBuyer(buyer.getSender(), { value: toNano('0.2') });
        expect(retry.transactions).toHaveTransaction({ success: false, exitCode: 117 });
    });

    it('covers ClaimReserve transfer failure with pending reserve DIAO', async () => {
        const broken = await deployFundedControllerWithInvalidWalletCode();
        await broken.sendBuyPackage(buyer.getSender(), { packageCount: 1, value: toNano('58.1') });
        await broken.sendAdminControl(adminSender, { action: 7, value: toNano('0.05') });
        await unlockTo(1, broken);

        const beforeBalance = await getJettonBalance(addrConfig.officialReserveWallet);
        const result = await broken.sendClaimReserve(reserveSender, { value: toNano('0.2') });
        const expectedClaim = (BUYER_AND_RESERVE_POOL - PACKAGE_TOTAL) / 15n;

        expect(result.transactions).toHaveTransaction({ from: addrConfig.officialReserveWallet, to: broken.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);
        expect((await broken.getVestingData()).reserveAlreadyClaimed).toBe(expectedClaim);
        expect(await getJettonBalance(addrConfig.officialReserveWallet)).toBe(beforeBalance);
        expect(await broken.getPendingReserveDiao()).toBe(expectedClaim);
    });

    it('covers ClaimTeam transfer failure with pending team DIAO', async () => {
        const broken = await deployFundedControllerWithInvalidWalletCode();
        await unlockTo(16, broken);

        const beforeBalance = await getJettonBalance(addrConfig.teamWallet);
        const result = await broken.sendClaimTeam(teamSender, { value: toNano('0.2') });

        expect(result.transactions).toHaveTransaction({ from: addrConfig.teamWallet, to: broken.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);
        expect((await broken.getVestingData()).teamClaimedRound).toBe(16);
        expect(await getJettonBalance(addrConfig.teamWallet)).toBe(beforeBalance);
        expect(await broken.getPendingTeamDiao()).toBe(ROUND_ALLOCATION);

        const retry = await broken.sendClaimTeam(teamSender, { value: toNano('0.2') });
        expect(retry.transactions).toHaveTransaction({ success: false, exitCode: 117 });
    });

    it('covers EmergencyRescueDiao transfer failure with pending rescue DIAO', async () => {
        const broken = await deployFundedControllerWithInvalidWalletCode();
        await broken.sendAdminControl(adminSender, { action: 3, value: toNano('0.05') });

        const rescueAmount = 1n * DIAO;
        const beforeBalance = await getJettonBalance(addrConfig.emergencyRescueWallet);
        const result = await broken.sendEmergencyRescueDiao(adminSender, {
            recipient: addrConfig.emergencyRescueWallet,
            amount: rescueAmount,
            value: toNano('0.2'),
        });

        expect(result.transactions).toHaveTransaction({ from: addrConfig.adminWallet, to: broken.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);
        expect((await broken.getVestingData()).emergencyRescued).toBe(rescueAmount);
        expect(await getJettonBalance(addrConfig.emergencyRescueWallet)).toBe(beforeBalance);
        expect(await broken.getPendingRescueDiao(addrConfig.emergencyRescueWallet)).toBe(rescueAmount);
    });

    it('keeps InitMint partial failure documented as out of scope for this VestingController fix', async () => {
        const partialDeployer = await blockchain.treasury('partial-deployer');
        const partialMinter = blockchain.openContract(
            DIAOJettonMinter.createFromConfig(
                {
                    totalSupply: 0n,
                    adminAddress: partialDeployer.address,
                    content: beginCell().storeUint(2, 8).endCell(),
                    jettonWalletCode: walletCode,
                    mintable: true,
                },
                minterCode
            )
        );
        await partialMinter.sendDeploy(partialDeployer.getSender(), toNano('0.05'));

        const partialVesting = blockchain.openContract(
            DIAOVestingController.createFromConfig(
                {
                    adminAddress: addrConfig.adminWallet,
                    priceSourceAddress: addrConfig.priceAdminWallet,
                    treasuryAddress: addrConfig.treasuryWallet,
                    officialReserveAddress: addrConfig.officialReserveWallet,
                    teamAddress: addrConfig.teamWallet,
                    emergencyRescueAddress: addrConfig.emergencyRescueWallet,
                    jettonMinterAddress: partialMinter.address,
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
                    funded: false,
                    emergencyRescued: 0n,
                },
                vestingCode
            )
        );
        await partialVesting.sendDeploy(deployer.getSender(), toNano('0.05'));

        const result = await partialMinter.sendInitMint(partialDeployer.getSender(), {
            initialCirculationAddress: addrConfig.initialCirculationWallet,
            vestingControllerAddress: partialVesting.address,
            initialCirculationTonAmount: toNano('0.1'),
            vestingControllerTonAmount: 1n,
            value: toNano('0.2'),
        });

        expect(result.transactions).toHaveTransaction({ from: partialDeployer.address, to: partialMinter.address, success: true });
        expect(hasFailedTransaction(result.transactions) || hasBouncedMessage(result.transactions)).toBe(true);
        expect((await partialMinter.getJettonData()).totalSupply).toBe(10_000_000_000n * DIAO);
        expect((await partialMinter.getJettonData()).mintable).toBe(false);
        expect(await getJettonBalance(addrConfig.initialCirculationWallet, partialMinter)).toBe(1_000_000_000n * DIAO);
        expect((await partialVesting.getVestingData()).funded).toBe(false);

        const retry = await partialMinter.sendInitMint(partialDeployer.getSender(), {
            initialCirculationAddress: addrConfig.initialCirculationWallet,
            vestingControllerAddress: partialVesting.address,
            initialCirculationTonAmount: toNano('0.1'),
            vestingControllerTonAmount: toNano('0.1'),
            value: toNano('0.3'),
        });
        expect(retry.transactions).toHaveTransaction({ from: partialDeployer.address, to: partialMinter.address, success: false, exitCode: 76 });
    });
});
