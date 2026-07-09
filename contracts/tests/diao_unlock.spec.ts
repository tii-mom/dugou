import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano, beginCell, Sender } from '@ton/core';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOJettonWallet } from '../wrappers/DIAOJettonWallet';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';
import { config as addrConfig } from '../wrappers/config';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

const DIAO = 1_000_000_000n;
const PACKAGE_TOTAL = 3_200_000n * DIAO;
const BUYER_AND_RESERVE_POOL = 7_500_000_000n * DIAO;
const TEAM_TOTAL = 1_500_000_000n * DIAO;
const ROUND_ALLOCATION = 500_000_000n * DIAO;
const MANUAL_PRICE_COOLDOWN = 24 * 3600;


describe('DIAO Unlock and Claim Tests', () => {
    let minterCode: Cell;
    let walletCode: Cell;
    let vestingCode: Cell;

    beforeAll(async () => {
        minterCode = await compile('DIAOJettonMinter');
        walletCode = await compile('DIAOJettonWallet');
        vestingCode = await compile('DIAOVestingController');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let buyer: SandboxContract<TreasuryContract>;
    
    let adminSender: Sender;
    let priceAdminSender: Sender;
    let reserveSender: Sender;
    let teamSender: Sender;

    let minter: SandboxContract<DIAOJettonMinter>;
    let vesting: SandboxContract<DIAOVestingController>;

    async function unlockNextRound(round: number) {
        const now = blockchain.now!;
        const targetPrice = 10_000_000n * (1n << BigInt(round));
        await vesting.sendSubmitPrice(priceAdminSender, {
            price: targetPrice,
            targetRound: round,
            value: toNano('0.05'),
        });
        blockchain.now = now + MANUAL_PRICE_COOLDOWN;
        await vesting.sendExecuteUnlock(buyer.getSender(), { value: toNano('0.05') });
    }

    async function getJettonBalance(owner: Address): Promise<bigint> {
        const walletAddress = await minter.getWalletAddress(owner);
        const wallet = blockchain.openContract(DIAOJettonWallet.createFromAddress(walletAddress));
        const data = await wallet.getWalletData();
        return data.jettonBalance;
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000000; // set initial time

        deployer = await blockchain.treasury('deployer');
        buyer = await blockchain.treasury('buyer');
        
        // Setup senders
        adminSender = blockchain.sender(addrConfig.adminWallet);
        priceAdminSender = blockchain.sender(addrConfig.priceAdminWallet);
        reserveSender = blockchain.sender(addrConfig.officialReserveWallet);
        teamSender = blockchain.sender(addrConfig.teamWallet);

        // Fill wallets with TON
        await deployer.send({ to: addrConfig.adminWallet, value: toNano('1000') });
        await deployer.send({ to: addrConfig.priceAdminWallet, value: toNano('1000') });
        await deployer.send({ to: addrConfig.officialReserveWallet, value: toNano('1000') });
        await deployer.send({ to: addrConfig.teamWallet, value: toNano('1000') });

        // Deploy Minter with admin = deployer
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

        // Deploy Vesting Controller
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

        // Fund Vesting Controller
        await minter.sendInitMint(deployer.getSender(), {
            initialCirculationAddress: addrConfig.initialCirculationWallet,
            vestingControllerAddress: vesting.address,
            initialCirculationTonAmount: toNano('0.1'),
            vestingControllerTonAmount: toNano('0.1'),
            value: toNano('0.3'),
        });
    });

    it('should submit price and unlock round sequentially with cooldown and validity constraints', async () => {
        const round1Target = 20_000_000n;

        // Try submitting price below target (must fail)
        const submitBelowResult = await vesting.sendSubmitPrice(priceAdminSender, {
            price: 19_999_999n,
            targetRound: 1,
            value: toNano('0.05'),
        });
        expect(submitBelowResult.transactions).toHaveTransaction({
            from: addrConfig.priceAdminWallet,
            to: vesting.address,
            success: false,
            exitCode: 114, // ERR_PRICE_TOO_LOW
        });

        // Submit correct price for round 1
        const submitResult = await vesting.sendSubmitPrice(priceAdminSender, {
            price: round1Target,
            targetRound: 1,
            value: toNano('0.05'),
        });
        expect(submitResult.transactions).toHaveTransaction({
            from: addrConfig.priceAdminWallet,
            to: vesting.address,
            success: true,
        });

        const duplicatePending = await vesting.sendSubmitPrice(priceAdminSender, {
            price: round1Target,
            targetRound: 1,
            value: toNano('0.05'),
        });
        expect(duplicatePending.transactions).toHaveTransaction({
            from: addrConfig.priceAdminWallet,
            to: vesting.address,
            success: false,
            exitCode: 121, // ERR_PENDING_ROUND_EXISTS
        });

        // Attempt to execute unlock immediately (must fail due to cooldown)
        const executeUnlockFail = await vesting.sendExecuteUnlock(buyer.getSender(), {
            value: toNano('0.05'),
        });
        expect(executeUnlockFail.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: false,
            exitCode: 110, // ERR_COOLDOWN_NOT_MET
        });

        // Fast forward to just before cooldown (must still fail)
        blockchain.now = 1000000 + MANUAL_PRICE_COOLDOWN - 1;
        const executeUnlockFail2 = await vesting.sendExecuteUnlock(buyer.getSender(), {
            value: toNano('0.05'),
        });
        expect(executeUnlockFail2.transactions).toHaveTransaction({
            exitCode: 110, // ERR_COOLDOWN_NOT_MET
        });

        // Fast forward to exactly the configured cooldown
        blockchain.now = 1000000 + MANUAL_PRICE_COOLDOWN;
        const executeUnlockSuccess = await vesting.sendExecuteUnlock(buyer.getSender(), {
            value: toNano('0.05'),
        });
        expect(executeUnlockSuccess.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: true,
        });

        const vData = await vesting.getVestingData();
        expect(vData.currentUnlockedRound).toEqual(1);

        // Try submitting price for round 3 (skipping round 2, must fail)
        const submitResultSkip = await vesting.sendSubmitPrice(priceAdminSender, {
            price: 80_000_000n,
            targetRound: 3,
            value: toNano('0.05'),
        });
        expect(submitResultSkip.transactions).toHaveTransaction({
            exitCode: 113, // ERR_INVALID_ROUND
        });

        // Submit round 2 price target = 40_000_000
        const submissionTime2 = blockchain.now!;
        await vesting.sendSubmitPrice(priceAdminSender, {
            price: 40_000_000n,
            targetRound: 2,
            value: toNano('0.05'),
        });

        // Fast forward to 48h 1s (expired validity)
        blockchain.now = submissionTime2 + 48 * 3600 + 1;
        const executeUnlockExpired = await vesting.sendExecuteUnlock(buyer.getSender(), {
            value: toNano('0.05'),
        });
        expect(executeUnlockExpired.transactions).toHaveTransaction({
            exitCode: 111, // ERR_PRICE_EXPIRED
        });
    });

    it('should claim buyer, reserve, and team tokens correctly', async () => {
        // 1. Buyer purchases 2 packages
        await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 2,
            value: toNano('116.2'),
        });

        // 2. Finalize the sale so official reserve can claim
        await vesting.sendAdminControl(adminSender, {
            action: 7, // finalize sale
            value: toNano('0.05'),
        });

        // Verify reserve claim is initially blocked because round 0 is unlocked (0 claimable)
        const reserveClaimFail0 = await vesting.sendClaimReserve(reserveSender, {
            value: toNano('0.15'),
        });
        expect(reserveClaimFail0.transactions).toHaveTransaction({
            exitCode: 117, // ERR_NOTHING_TO_CLAIM
        });

        // 3. Unlock Rounds 1 & 2
        // Round 1
        let now = blockchain.now!;
        await vesting.sendSubmitPrice(priceAdminSender, { price: 20_000_000n, targetRound: 1, value: toNano('0.05') });
        blockchain.now = now + MANUAL_PRICE_COOLDOWN;
        await vesting.sendExecuteUnlock(buyer.getSender(), { value: toNano('0.05') });

        // Round 2
        now = blockchain.now!;
        await vesting.sendSubmitPrice(priceAdminSender, { price: 40_000_000n, targetRound: 2, value: toNano('0.05') });
        blockchain.now = now + MANUAL_PRICE_COOLDOWN;
        await vesting.sendExecuteUnlock(buyer.getSender(), { value: toNano('0.05') });

        // 4. Buyer Claims
        const claimResult = await vesting.sendClaimBuyer(buyer.getSender(), {
            value: toNano('0.15'),
        });
        expect(claimResult.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: true,
        });

        const buyerWalletAddress = await minter.getWalletAddress(buyer.address);
        const buyerWallet = blockchain.openContract(DIAOJettonWallet.createFromAddress(buyerWalletAddress));
        let buyerData = await buyerWallet.getWalletData();
        expect(buyerData.jettonBalance).toEqual(1_200_000n * 1_000_000_000n);

        // Try to claim again (must fail with nothing to claim)
        const claimResult2 = await vesting.sendClaimBuyer(buyer.getSender(), {
            value: toNano('0.15'),
        });
        expect(claimResult2.transactions).toHaveTransaction({
            exitCode: 117, // ERR_NOTHING_TO_CLAIM
        });

        // 5. Official Reserve Claims
        const reserveClaimResult = await vesting.sendClaimReserve(reserveSender, {
            value: toNano('0.15'),
        });
        expect(reserveClaimResult.transactions).toHaveTransaction({
            from: addrConfig.officialReserveWallet,
            to: vesting.address,
            success: true,
        });

        const reserveWalletAddress = await minter.getWalletAddress(addrConfig.officialReserveWallet);
        const reserveWalletContract = blockchain.openContract(DIAOJettonWallet.createFromAddress(reserveWalletAddress));
        const reserveData = await reserveWalletContract.getWalletData();
        // totalReservePool = 7.5B - 2*3.2M = 7,493,600,000 DIAO (corrected: uses BUYER_AND_RESERVE_POOL)
        // claimable = floor(7493600000 * 10^9 * 2 / 15) = 999146666666666666n
        expect(reserveData.jettonBalance).toEqual(999146666666666666n);

        // 6. Fast forward to Round 16 (Team unlock starts)
        for (let r = 3; r <= 16; r++) {
            now = blockchain.now!;
            const targetPrice = 10_000_000n * (1n << BigInt(r));
            await vesting.sendSubmitPrice(priceAdminSender, { price: targetPrice, targetRound: r, value: toNano('0.05') });
            blockchain.now = now + MANUAL_PRICE_COOLDOWN;
            await vesting.sendExecuteUnlock(buyer.getSender(), { value: toNano('0.05') });
        }

        // Team claims round 16
        const teamClaimResult = await vesting.sendClaimTeam(teamSender, {
            value: toNano('0.15'),
        });
        expect(teamClaimResult.transactions).toHaveTransaction({
            from: addrConfig.teamWallet,
            to: vesting.address,
            success: true,
        });

        const teamWalletAddress = await minter.getWalletAddress(addrConfig.teamWallet);
        const teamWalletContract = blockchain.openContract(DIAOJettonWallet.createFromAddress(teamWalletAddress));
        const teamData = await teamWalletContract.getWalletData();
        expect(teamData.jettonBalance).toEqual(500_000_000n * 1_000_000_000n);
    });

    it('should enforce pause constraints correctly', async () => {
        // Buy 1 package
        await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });

        // Admin pauses
        await vesting.sendAdminControl(adminSender, {
            action: 3, // pause
            value: toNano('0.05'),
        });

        let vData = await vesting.getVestingData();
        expect(vData.paused).toBe(true);

        // Operations must fail when paused
        const buyResult = await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });
        expect(buyResult.transactions).toHaveTransaction({
            exitCode: 109, // ERR_PAUSED
        });

        const submitResult = await vesting.sendSubmitPrice(priceAdminSender, {
            price: 20_000_000n,
            targetRound: 1,
            value: toNano('0.05'),
        });
        expect(submitResult.transactions).toHaveTransaction({
            exitCode: 109, // ERR_PAUSED
        });

        const claimResult = await vesting.sendClaimBuyer(buyer.getSender(), {
            value: toNano('0.15'),
        });
        expect(claimResult.transactions).toHaveTransaction({
            exitCode: 109, // ERR_PAUSED
        });

        // Admin unpauses
        await vesting.sendAdminControl(adminSender, {
            action: 4, // unpause
            value: toNano('0.05'),
        });

        vData = await vesting.getVestingData();
        expect(vData.paused).toBe(false);

        // Operations succeed now
        const submitResultSuccess = await vesting.sendSubmitPrice(priceAdminSender, {
            price: 20_000_000n,
            targetRound: 1,
            value: toNano('0.05'),
        });
        expect(submitResultSuccess.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('should update price admin correctly', async () => {
        const newPriceAdmin = await blockchain.treasury('newPriceAdmin');
        const newPriceAdminSender = blockchain.sender(newPriceAdmin.address);
        await deployer.send({ to: newPriceAdmin.address, value: toNano('100') });

        // Admin updates price admin address
        const updateResult = await vesting.sendAdminControl(adminSender, {
            action: 5, // update price admin
            payload: beginCell().storeAddress(newPriceAdmin.address).endCell(),
            value: toNano('0.05'),
        });
        expect(updateResult.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: true,
        });

        const malformedUpdate = await vesting.sendAdminControl(adminSender, {
            action: 5,
            value: toNano('0.05'),
        });
        expect(malformedUpdate.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: false,
            exitCode: 77, // ERR_INVALID_PAYLOAD
        });

        const unknownAction = await vesting.sendAdminControl(adminSender, {
            action: 6,
            value: toNano('0.05'),
        });
        expect(unknownAction.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: false,
            exitCode: 120, // ERR_INVALID_ADMIN_ACTION
        });

        // Old price admin tries to submit price (must fail)
        const submitOldFail = await vesting.sendSubmitPrice(priceAdminSender, {
            price: 20_000_000n,
            targetRound: 1,
            value: toNano('0.05'),
        });
        expect(submitOldFail.transactions).toHaveTransaction({
            exitCode: 102, // ERR_NOT_FROM_PRICE_ADMIN
        });

        // New price admin submits price successfully
        const submitNewSuccess = await vesting.sendSubmitPrice(newPriceAdminSender, {
            price: 20_000_000n,
            targetRound: 1,
            value: toNano('0.05'),
        });
        expect(submitNewSuccess.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('should conserve the full 9B vesting allocation across buyer, reserve, and team claims', async () => {
        await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 2,
            value: toNano('116.2'),
        });

        await vesting.sendAdminControl(adminSender, {
            action: 7,
            value: toNano('0.05'),
        });

        for (let round = 1; round <= 15; round++) {
            await unlockNextRound(round);
        }

        await vesting.sendClaimBuyer(buyer.getSender(), { value: toNano('0.2') });
        await vesting.sendClaimReserve(reserveSender, { value: toNano('0.2') });

        for (let round = 16; round <= 18; round++) {
            await unlockNextRound(round);
        }

        await vesting.sendClaimTeam(teamSender, { value: toNano('0.2') });

        const buyerTotal = 2n * PACKAGE_TOTAL;
        const reserveTotal = BUYER_AND_RESERVE_POOL - buyerTotal;

        expect(await getJettonBalance(buyer.address)).toEqual(buyerTotal);
        expect(await getJettonBalance(addrConfig.officialReserveWallet)).toEqual(reserveTotal);
        expect(await getJettonBalance(addrConfig.teamWallet)).toEqual(TEAM_TOTAL);

        const vestingWalletAddress = await minter.getWalletAddress(vesting.address);
        const vestingWallet = blockchain.openContract(DIAOJettonWallet.createFromAddress(vestingWalletAddress));
        const vestingWalletData = await vestingWallet.getWalletData();

        expect(buyerTotal + reserveTotal + TEAM_TOTAL).toEqual(9_000_000_000n * DIAO);
        expect(vestingWalletData.jettonBalance).toEqual(0n);
    });

    it('should enforce reserve, team, and buyer claim boundaries', async () => {
        await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });

        await unlockNextRound(1);

        const reserveBeforeFinalize = await vesting.sendClaimReserve(reserveSender, { value: toNano('0.2') });
        expect(reserveBeforeFinalize.transactions).toHaveTransaction({
            from: addrConfig.officialReserveWallet,
            to: vesting.address,
            success: false,
            exitCode: 118,
        });

        await vesting.sendAdminControl(adminSender, {
            action: 7,
            value: toNano('0.05'),
        });

        const nonReserveClaim = await vesting.sendClaimReserve(buyer.getSender(), { value: toNano('0.2') });
        expect(nonReserveClaim.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: false,
            exitCode: 115,
        });

        const nonTeamClaim = await vesting.sendClaimTeam(buyer.getSender(), { value: toNano('0.2') });
        expect(nonTeamClaim.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: false,
            exitCode: 116,
        });

        const teamBeforeRound16 = await vesting.sendClaimTeam(teamSender, { value: toNano('0.2') });
        expect(teamBeforeRound16.transactions).toHaveTransaction({
            from: addrConfig.teamWallet,
            to: vesting.address,
            success: false,
            exitCode: 117,
        });

        await vesting.sendClaimBuyer(buyer.getSender(), { value: toNano('0.2') });
        expect(await getJettonBalance(buyer.address)).toEqual(400_000n * DIAO);

        await vesting.sendClaimReserve(reserveSender, { value: toNano('0.2') });
        const reserveAfterRound1 = (BUYER_AND_RESERVE_POOL - PACKAGE_TOTAL) / 15n;
        expect(await getJettonBalance(addrConfig.officialReserveWallet)).toEqual(reserveAfterRound1);

        for (let round = 2; round <= 18; round++) {
            await unlockNextRound(round);
        }

        const buyerClaimAfterTeamRounds = await vesting.sendClaimBuyer(buyer.getSender(), { value: toNano('0.2') });
        expect(buyerClaimAfterTeamRounds.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: true,
        });

        expect(await getJettonBalance(buyer.address)).toEqual(3_200_000n * DIAO);

        const buyerNoExtraRound16To18 = await vesting.sendClaimBuyer(buyer.getSender(), { value: toNano('0.2') });
        expect(buyerNoExtraRound16To18.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: false,
            exitCode: 117,
        });
    });

    it('should keep close_sale reversible but finalize_sale irreversible and reserve-gated', async () => {
        await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });
        await unlockNextRound(1);

        await vesting.sendAdminControl(adminSender, {
            action: 1,
            value: toNano('0.05'),
        });

        const closedData = await vesting.getVestingData();
        expect(closedData.saleActive).toBe(false);
        expect(closedData.saleFinalized).toBe(false);

        const buyClosed = await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });
        expect(buyClosed.transactions).toHaveTransaction({
            success: false,
            exitCode: 103,
        });

        const buyerClaimWhileClosed = await vesting.sendClaimBuyer(buyer.getSender(), { value: toNano('0.2') });
        expect(buyerClaimWhileClosed.transactions).toHaveTransaction({
            success: true,
        });

        const reserveClaimWhileClosed = await vesting.sendClaimReserve(reserveSender, { value: toNano('0.2') });
        expect(reserveClaimWhileClosed.transactions).toHaveTransaction({
            success: false,
            exitCode: 118,
        });

        await vesting.sendAdminControl(adminSender, {
            action: 2,
            value: toNano('0.05'),
        });
        expect((await vesting.getVestingData()).saleActive).toBe(true);

        await vesting.sendAdminControl(adminSender, {
            action: 7,
            value: toNano('0.05'),
        });

        const finalizedData = await vesting.getVestingData();
        expect(finalizedData.saleActive).toBe(false);
        expect(finalizedData.saleFinalized).toBe(true);

        const reopenFinalized = await vesting.sendAdminControl(adminSender, {
            action: 2,
            value: toNano('0.05'),
        });
        expect(reopenFinalized.transactions).toHaveTransaction({
            success: false,
            exitCode: 104,
        });

        const buyFinalized = await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });
        expect(buyFinalized.transactions).toHaveTransaction({
            success: false,
            exitCode: 103,
        });

        const reserveClaimAfterFinalize = await vesting.sendClaimReserve(reserveSender, { value: toNano('0.2') });
        expect(reserveClaimAfterFinalize.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('should enforce pause restrictions while still allowing admin recovery operations', async () => {
        await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });
        await unlockNextRound(1);
        await vesting.sendAdminControl(adminSender, {
            action: 7,
            value: toNano('0.05'),
        });

        await vesting.sendAdminControl(adminSender, {
            action: 3,
            value: toNano('0.05'),
        });

        const unlockWhilePaused = await vesting.sendExecuteUnlock(buyer.getSender(), { value: toNano('0.05') });
        expect(unlockWhilePaused.transactions).toHaveTransaction({
            success: false,
            exitCode: 109,
        });

        const reserveClaimWhilePaused = await vesting.sendClaimReserve(reserveSender, { value: toNano('0.2') });
        expect(reserveClaimWhilePaused.transactions).toHaveTransaction({
            success: false,
            exitCode: 109,
        });

        const teamClaimWhilePaused = await vesting.sendClaimTeam(teamSender, { value: toNano('0.2') });
        expect(teamClaimWhilePaused.transactions).toHaveTransaction({
            success: false,
            exitCode: 109,
        });

        const newPriceAdmin = await blockchain.treasury('pausedNewPriceAdmin');
        const updatePriceAdminWhilePaused = await vesting.sendAdminControl(adminSender, {
            action: 5,
            payload: beginCell().storeAddress(newPriceAdmin.address).endCell(),
            value: toNano('0.05'),
        });
        expect(updatePriceAdminWhilePaused.transactions).toHaveTransaction({
            success: true,
        });

        const withdrawWhilePaused = await vesting.sendWithdrawTon(adminSender, {
            amount: toNano('10'),
            value: toNano('0.05'),
        });
        expect(withdrawWhilePaused.transactions).toHaveTransaction({
            success: true,
        });

        const unpause = await vesting.sendAdminControl(adminSender, {
            action: 4,
            value: toNano('0.05'),
        });
        expect(unpause.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('should allow paused emergency DIAO rescue without touching sold buyer entitlement', async () => {
        await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });

        const rescueWhileUnpaused = await vesting.sendEmergencyRescueDiao(adminSender, {
            recipient: addrConfig.emergencyRescueWallet,
            amount: 1n * DIAO,
            value: toNano('0.2'),
        });
        expect(rescueWhileUnpaused.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: false,
            exitCode: 109, // ERR_PAUSED
        });

        await vesting.sendAdminControl(adminSender, {
            action: 3,
            value: toNano('0.05'),
        });

        const rescueToBuyer = await vesting.sendEmergencyRescueDiao(adminSender, {
            recipient: buyer.address,
            amount: 1n * DIAO,
            value: toNano('0.2'),
        });
        expect(rescueToBuyer.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: false,
            exitCode: 122, // ERR_INVALID_RESCUE_RECIPIENT
        });

        const buyerLockedEntitlement = 3_000_000n * DIAO;
        const rescueable = 9_000_000_000n * DIAO - PACKAGE_TOTAL;
        const tooMuch = await vesting.sendEmergencyRescueDiao(adminSender, {
            recipient: addrConfig.emergencyRescueWallet,
            amount: rescueable + 1n,
            value: toNano('0.2'),
        });
        expect(tooMuch.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: false,
            exitCode: 123, // ERR_RESCUE_AMOUNT_EXCEEDED
        });

        const rescueAmount = rescueable;
        const rescue = await vesting.sendEmergencyRescueDiao(adminSender, {
            recipient: addrConfig.emergencyRescueWallet,
            amount: rescueAmount,
            value: toNano('0.2'),
        });
        expect(rescue.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: true,
        });

        expect(await getJettonBalance(addrConfig.emergencyRescueWallet)).toEqual(rescueAmount);

        const vestingWalletAddress = await minter.getWalletAddress(vesting.address);
        const vestingWallet = blockchain.openContract(DIAOJettonWallet.createFromAddress(vestingWalletAddress));
        const vestingWalletData = await vestingWallet.getWalletData();
        expect(vestingWalletData.jettonBalance).toEqual(buyerLockedEntitlement);

        const data = await vesting.getVestingData();
        expect(data.emergencyRescued).toEqual(rescueAmount);
    });
});
