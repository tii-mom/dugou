import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, beginCell, Sender } from '@ton/core';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOJettonWallet } from '../wrappers/DIAOJettonWallet';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';
import { config as addrConfig } from '../wrappers/config';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';


describe('DIAO Purchase Tests', () => {
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
    let minter: SandboxContract<DIAOJettonMinter>;
    let vesting: SandboxContract<DIAOVestingController>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        buyer = await blockchain.treasury('buyer');
        
        // Setup admin sender
        adminSender = blockchain.sender(addrConfig.adminWallet);

        // Fill admin wallet with TON in Sandbox
        await deployer.send({
            to: addrConfig.adminWallet,
            value: toNano('1000'),
        });
        await deployer.send({
            to: addrConfig.officialReserveWallet,
            value: toNano('1000'),
        });
        await deployer.send({
            to: addrConfig.teamWallet,
            value: toNano('1000'),
        });

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

    it('should fail purchase if vesting controller is not funded', async () => {
        // Deploy another unfunded vesting controller
        const unfundedVesting = blockchain.openContract(
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
                    teamClaimedRound: 14,
                    funded: false,
                    emergencyRescued: 0n,
                },
                vestingCode
            )
        );
        await unfundedVesting.sendDeploy(deployer.getSender(), toNano('0.05'));

        // Attempting to buy 1 package (58 TON + 0.1 TON gas)
        const buyResult = await unfundedVesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.1'),
        });

        expect(buyResult.transactions).toHaveTransaction({
            from: buyer.address,
            to: unfundedVesting.address,
            success: false,
            exitCode: 108, // ERR_NOT_FUNDED
        });

        const buyerClaimResult = await unfundedVesting.sendClaimBuyer(buyer.getSender(), {
            value: toNano('0.2'),
        });
        expect(buyerClaimResult.transactions).toHaveTransaction({
            from: buyer.address,
            to: unfundedVesting.address,
            success: false,
            exitCode: 108, // ERR_NOT_FUNDED
        });

        const reserveClaimResult = await unfundedVesting.sendClaimReserve(blockchain.sender(addrConfig.officialReserveWallet), {
            value: toNano('0.2'),
        });
        expect(reserveClaimResult.transactions).toHaveTransaction({
            from: addrConfig.officialReserveWallet,
            to: unfundedVesting.address,
            success: false,
            exitCode: 108, // ERR_NOT_FUNDED
        });

        const teamClaimResult = await unfundedVesting.sendClaimTeam(blockchain.sender(addrConfig.teamWallet), {
            value: toNano('0.2'),
        });
        expect(teamClaimResult.transactions).toHaveTransaction({
            from: addrConfig.teamWallet,
            to: unfundedVesting.address,
            success: false,
            exitCode: 108, // ERR_NOT_FUNDED
        });
    });

    it('should buy 1 package successfully and receive immediate 200K DIAO', async () => {
        // Buy 1 package (58 TON + 0.1 TON gas)
        const buyResult = await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });

        expect(buyResult.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: true,
        });

        // Verify total packages sold
        const vData = await vesting.getVestingData();
        expect(vData.totalPackagesSold).toEqual(1);

        // Verify buyer package count is 1
        const uInfo = await vesting.getUserPackages(buyer.address);
        expect(uInfo.packageCount).toEqual(1);
        expect(uInfo.highestClaimedRound).toEqual(0);

        // Verify buyer received immediate 200,000 DIAO
        const buyerWalletAddress = await minter.getWalletAddress(buyer.address);
        const buyerWallet = blockchain.openContract(DIAOJettonWallet.createFromAddress(buyerWalletAddress));
        const buyerData = await buyerWallet.getWalletData();
        expect(buyerData.jettonBalance).toEqual(200_000n * 1_000_000_000n);
    });

    it('should reject purchase with insufficient payment', async () => {
        // Buy 1 package but send only 50 TON
        const buyResult = await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('50'),
        });

        expect(buyResult.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: false,
            exitCode: 107, // ERR_INSUFFICIENT_PAYMENT
        });
    });

    it('should enforce limits: 10 packages per wallet, 2000 total', async () => {
        // Buy 11 packages in a single transaction (must fail)
        const buyResult = await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 11,
            value: toNano('639'),
        });

        expect(buyResult.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: false,
            exitCode: 77, // ERR_INVALID_PAYLOAD
        });

        // Buy 10 packages successfully
        const buyResult2 = await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 10,
            value: toNano('581'),
        });

        expect(buyResult2.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: true,
        });

        // Try to buy 1 more package (must fail due to wallet limit)
        const buyResult3 = await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('59'),
        });

        expect(buyResult3.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: false,
            exitCode: 105, // ERR_USER_LIMIT_EXCEEDED
        });
    });

    it('should auto-finalize when 2000 packages are sold', async () => {
        // Deploy a contract with 1999 packages already sold
        const almostSoldVesting = blockchain.openContract(
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
                    totalPackagesSold: 1999,
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
        await almostSoldVesting.sendDeploy(deployer.getSender(), toNano('0.05'));

        // Buy 1 package to hit 2000
        const buyResult = await almostSoldVesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });

        expect(buyResult.transactions).toHaveTransaction({
            from: buyer.address,
            to: almostSoldVesting.address,
            success: true,
        });

        // Check if finalized
        const vData = await almostSoldVesting.getVestingData();
        expect(vData.saleFinalized).toBe(true);
        expect(vData.saleActive).toBe(false);
    });

    it('should close, open, and finalize sale correctly by admin', async () => {
        // Non-admin tries to close sale (must fail)
        const closeResultFail = await vesting.sendAdminControl(buyer.getSender(), {
            action: 1, // close
            value: toNano('0.05'),
        });
        expect(closeResultFail.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: false,
            exitCode: 101, // ERR_NOT_FROM_ADMIN
        });

        // Admin closes sale
        const closeResult = await vesting.sendAdminControl(adminSender, {
            action: 1, // close
            value: toNano('0.05'),
        });
        expect(closeResult.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: true,
        });

        let vData = await vesting.getVestingData();
        expect(vData.saleActive).toBe(false);
        expect(vData.saleFinalized).toBe(false);

        // Purchases must fail when sale is closed
        const buyResultFail = await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 1,
            value: toNano('58.2'),
        });
        expect(buyResultFail.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: false,
            exitCode: 103, // ERR_SALE_NOT_ACTIVE
        });

        // Admin opens sale again
        const openResult = await vesting.sendAdminControl(adminSender, {
            action: 2, // open
            value: toNano('0.05'),
        });
        expect(openResult.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: true,
        });

        vData = await vesting.getVestingData();
        expect(vData.saleActive).toBe(true);

        // Admin finalizes sale
        const finalizeResult = await vesting.sendAdminControl(adminSender, {
            action: 7, // finalize
            value: toNano('0.05'),
        });
        expect(finalizeResult.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: true,
        });

        vData = await vesting.getVestingData();
        expect(vData.saleFinalized).toBe(true);
        expect(vData.saleActive).toBe(false);

        // Cannot reopen after finalized
        const reopenResult = await vesting.sendAdminControl(adminSender, {
            action: 2, // open
            value: toNano('0.05'),
        });
        expect(reopenResult.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: false,
            exitCode: 104, // ERR_SALE_FINALIZED
        });
    });

    it('should withdraw TON to treasury only', async () => {
        // Buy some packages to fill contract with TON
        await vesting.sendBuyPackage(buyer.getSender(), {
            packageCount: 2,
            value: toNano('116.2'),
        });

        // Non-admin tries to withdraw TON (must fail)
        const withdrawFail = await vesting.sendWithdrawTon(buyer.getSender(), {
            amount: toNano('100'),
            value: toNano('0.05'),
        });
        expect(withdrawFail.transactions).toHaveTransaction({
            from: buyer.address,
            to: vesting.address,
            success: false,
            exitCode: 101, // ERR_NOT_FROM_ADMIN
        });

        const reserveTooLow = await vesting.sendWithdrawTon(adminSender, {
            amount: toNano('116.16'),
            value: toNano('0.05'),
        });
        expect(reserveTooLow.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: false,
            exitCode: 119, // ERR_NOT_ENOUGH_TON
        });

        // Admin withdraws TON
        const initialBalance = await blockchain.getContract(addrConfig.treasuryWallet).then(c => c.balance);
        const withdrawResult = await vesting.sendWithdrawTon(adminSender, {
            amount: toNano('100'),
            value: toNano('0.05'),
        });

        expect(withdrawResult.transactions).toHaveTransaction({
            from: addrConfig.adminWallet,
            to: vesting.address,
            success: true,
        });

        // Verify treasury wallet received the funds
        const finalBalance = await blockchain.getContract(addrConfig.treasuryWallet).then(c => c.balance);
        expect(finalBalance - initialBalance).toEqual(toNano('100'));
    });
});
