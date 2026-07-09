import { toNano, beginCell, Address } from '@ton/core';
import 'dotenv/config';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';
import { config as addrConfig } from '../wrappers/config';
import { compile, NetworkProvider } from '@ton/blueprint';
import { appendFileSync } from 'fs';

const metadataUrl = process.env.DIAO_METADATA_URL
    ?? 'https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafkreigsnrrxhqvxhst2xay7pythep5auoprv3ekuzruyp77jwtqjgp4im';

/**
 * DIAO Full Deployment Script
 *
 * Deployment order:
 * 1. Deploy Jetton Minter
 * 2. Deploy Vesting Controller (needs minter address)
 * 3. Call init_mint on Minter (sends 1B DIAO to circulation wallet + 9B DIAO to vesting)
 *
 * After init_mint:
 * - Minter is locked (no more minting)
 * - Vesting Controller is funded (funded = true)
 * - Sale is open by default; admin can close it if needed
 */
export async function run(provider: NetworkProvider) {
    const isTestnet = provider.network() === 'testnet';
    const testnetWallet = isTestnet && process.env.DIAO_TESTNET_WALLET
        ? Address.parse(process.env.DIAO_TESTNET_WALLET)
        : null;
    const deployConfig = testnetWallet
        ? {
            initialCirculationWallet: testnetWallet,
            officialReserveWallet: testnetWallet,
            teamWallet: testnetWallet,
            emergencyRescueWallet: testnetWallet,
            adminWallet: testnetWallet,
            priceAdminWallet: testnetWallet,
            treasuryWallet: testnetWallet,
        }
        : addrConfig;
    const metadataSalt = isTestnet ? process.env.DIAO_TESTNET_DEPLOY_SALT : undefined;
    const deploymentMetadataUrl = metadataSalt ? `${metadataUrl}?deploy=${encodeURIComponent(metadataSalt)}` : metadataUrl;

    const sender = provider.sender();
    const senderAddress = sender.address;
    if (!senderAddress) {
        throw new Error('Sender address is not available. Make sure you are connected with a wallet.');
    }

    // ── Step 0: Compile contracts ──────────────────────────────────────
    console.log('⏳ Compiling contracts...');
    const minterCode = await compile('DIAOJettonMinter');
    const walletCode = await compile('DIAOJettonWallet');
    const vestingCode = await compile('DIAOVestingController');
    console.log('✅ Compilation complete.');

    // ── Step 1: Deploy Jetton Minter ───────────────────────────────────
    console.log('\n📦 Step 1: Deploying Jetton Minter...');

    // Jetton metadata (0x01 prefix = off-chain content URI)
    const contentCell = beginCell()
        .storeUint(0x01, 8) // off-chain metadata marker
        .storeStringTail(deploymentMetadataUrl)
        .endCell();

    const minter = provider.open(
        DIAOJettonMinter.createFromConfig(
            {
                totalSupply: 0n,
                adminAddress: senderAddress, // deployer is initial admin for init_mint
                content: contentCell,
                jettonWalletCode: walletCode,
                mintable: true,
            },
            minterCode
        )
    );

    await minter.sendDeploy(sender, toNano('0.05'));
    await provider.waitForDeploy(minter.address);
    console.log(`✅ Jetton Minter deployed at: ${minter.address}`);

    // ── Step 2: Deploy Vesting Controller ──────────────────────────────
    console.log('\n📦 Step 2: Deploying Vesting Controller...');

    const vesting = provider.open(
        DIAOVestingController.createFromConfig(
            {
                adminAddress: deployConfig.adminWallet,
                priceSourceAddress: deployConfig.priceAdminWallet,
                treasuryAddress: deployConfig.treasuryWallet,
                officialReserveAddress: deployConfig.officialReserveWallet,
                teamAddress: deployConfig.teamWallet,
                emergencyRescueAddress: deployConfig.emergencyRescueWallet,
                jettonMinterAddress: minter.address,
                jettonWalletCode: walletCode,
                saleActive: true,        // sale starts open per frozen requirement
                saleFinalized: false,
                paused: false,
                totalPackagesSold: 0,
                currentUnlockedRound: 0,
                pendingRound: 0,
                pendingSubmittedAt: 0,
                reserveAlreadyClaimed: 0n,
                teamClaimedRound: 15,    // team can claim starting round 16
                funded: false,           // will be set to true after init_mint
                emergencyRescued: 0n,
            },
            vestingCode
        )
    );

    await vesting.sendDeploy(sender, toNano('0.05'));
    await provider.waitForDeploy(vesting.address);
    console.log(`✅ Vesting Controller deployed at: ${vesting.address}`);

    // ── Step 3: Call init_mint ─────────────────────────────────────────
    console.log('\n🔒 Step 3: Calling init_mint (1B → circulation, 9B → vesting)...');
    console.log(`   Circulation wallet: ${deployConfig.initialCirculationWallet}`);
    console.log(`   Vesting controller: ${vesting.address}`);

    await minter.sendInitMint(sender, {
        initialCirculationAddress: deployConfig.initialCirculationWallet,
        vestingControllerAddress: vesting.address,
        initialCirculationTonAmount: toNano('0.15'),
        vestingControllerTonAmount: toNano('0.35'),
        value: toNano('0.8'),
    });

    console.log('✅ init_mint sent. Minter is now locked.');

    // ── Step 4: Transfer minter admin to multisig / DAO ───────────────
    console.log('\n🔑 Step 4: Transferring Minter admin to operational admin...');
    await minter.sendChangeAdmin(sender, {
        newAdminAddress: deployConfig.adminWallet,
        value: toNano('0.05'),
    });
    console.log(`✅ Minter admin transferred to: ${deployConfig.adminWallet}`);

    // ── Summary ───────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 DIAO DEPLOYMENT COMPLETE');
    console.log('═'.repeat(60));
    console.log(`  Jetton Minter:       ${minter.address}`);
    console.log(`  Vesting Controller:  ${vesting.address}`);
    console.log(`  Admin Wallet:        ${deployConfig.adminWallet}`);
    console.log(`  Treasury Wallet:     ${deployConfig.treasuryWallet}`);
    console.log(`  Price Admin:         ${deployConfig.priceAdminWallet}`);
    if (isTestnet) {
        appendFileSync(
            '.env',
            `\nDIAO_TESTNET_MINTER=${minter.address.toString()}\nDIAO_TESTNET_VESTING=${vesting.address.toString()}\n`,
        );
        console.log('  Saved testnet addresses to .env');
    }
    console.log('');
    console.log('Next steps:');
    console.log('  1. Verify init_mint completed (check vesting funded=true)');
    console.log('  2. Sale is open by default; admin can close if needed');
    console.log('  3. Price admin begins submitting prices for unlocks');
    console.log('═'.repeat(60));
}
