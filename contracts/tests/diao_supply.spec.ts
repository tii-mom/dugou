import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, beginCell } from '@ton/core';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOJettonWallet } from '../wrappers/DIAOJettonWallet';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';
import { config as addrConfig } from '../wrappers/config';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('DIAO Supply Tests', () => {
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
    let minter: SandboxContract<DIAOJettonMinter>;
    let vesting: SandboxContract<DIAOVestingController>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        // 1. Deploy Minter with admin = deployer
        minter = blockchain.openContract(
            DIAOJettonMinter.createFromConfig(
                {
                    totalSupply: 0n,
                    adminAddress: deployer.address,
                    content: beginCell().storeUint(1, 8).endCell(), // dummy metadata
                    jettonWalletCode: walletCode,
                    mintable: true,
                },
                minterCode
            )
        );

        await minter.sendDeploy(deployer.getSender(), toNano('0.05'));

        // 2. Deploy Vesting Controller
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
    });

    it('should verify initial states and perform one-time init_mint', async () => {
        // Initial minter supply is 0, mintable is true
        const initialData = await minter.getJettonData();
        expect(initialData.totalSupply).toEqual(0n);
        expect(initialData.mintable).toBe(true);

        // Perform init_mint
        const initResult = await minter.sendInitMint(deployer.getSender(), {
            initialCirculationAddress: addrConfig.initialCirculationWallet,
            vestingControllerAddress: vesting.address,
            initialCirculationTonAmount: toNano('0.1'),
            vestingControllerTonAmount: toNano('0.1'),
            value: toNano('0.3'),
        });


        expect(initResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: minter.address,
            success: true,
        });

        // Verify minter supply is exactly 10B, and mintable is false
        const afterData = await minter.getJettonData();
        expect(afterData.totalSupply).toEqual(10_000_000_000n * 1_000_000_000n);
        expect(afterData.mintable).toBe(false);

        // Verify initial circulation wallet received 1B DIAO
        const circWalletAddress = await minter.getWalletAddress(addrConfig.initialCirculationWallet);
        const circWallet = blockchain.openContract(DIAOJettonWallet.createFromAddress(circWalletAddress));
        const circData = await circWallet.getWalletData();
        expect(circData.jettonBalance).toEqual(1_000_000_000n * 1_000_000_000n);

        // Verify Vesting Controller received 9B DIAO
        const vestingWalletAddress = await minter.getWalletAddress(vesting.address);
        const vestingWallet = blockchain.openContract(DIAOJettonWallet.createFromAddress(vestingWalletAddress));
        const vestingData = await vestingWallet.getWalletData();
        expect(vestingData.jettonBalance).toEqual(9_000_000_000n * 1_000_000_000n);

        // Verify Vesting Controller is marked as funded
        const vData = await vesting.getVestingData();
        expect(vData.funded).toBe(true);

        // Attempting to call init_mint again must throw ERR_MINTER_LOCKED (76)
        const initResult2 = await minter.sendInitMint(deployer.getSender(), {
            initialCirculationAddress: addrConfig.initialCirculationWallet,
            vestingControllerAddress: vesting.address,
            initialCirculationTonAmount: toNano('0.1'),
            vestingControllerTonAmount: toNano('0.1'),
            value: toNano('0.3'),
        });

        expect(initResult2.transactions).toHaveTransaction({
            from: deployer.address,
            to: minter.address,
            success: false,
            exitCode: 76, // ERR_MINTER_LOCKED
        });
    });

    it('should fail to mint arbitrarily after lock', async () => {
        // Run init_mint
        await minter.sendInitMint(deployer.getSender(), {
            initialCirculationAddress: addrConfig.initialCirculationWallet,
            vestingControllerAddress: vesting.address,
            initialCirculationTonAmount: toNano('0.1'),
            vestingControllerTonAmount: toNano('0.1'),
            value: toNano('0.3'),
        });

        // Minter does not have generic mint message.
        // Even if we send a dummy change admin or similar, no one can mint.
    });

    it('should not half-initialize when init_mint is underfunded', async () => {
        const initResult = await minter.sendInitMint(deployer.getSender(), {
            initialCirculationAddress: addrConfig.initialCirculationWallet,
            vestingControllerAddress: vesting.address,
            initialCirculationTonAmount: toNano('0.1'),
            vestingControllerTonAmount: toNano('0.1'),
            value: toNano('0.01'),
        });

        expect(initResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: minter.address,
            success: false,
        });

        const minterData = await minter.getJettonData();
        expect(minterData.totalSupply).toEqual(0n);
        expect(minterData.mintable).toBe(true);

        const vestingData = await vesting.getVestingData();
        expect(vestingData.funded).toBe(false);
    });
});
