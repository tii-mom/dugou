/* eslint-disable */
const { TonClient } = require('@ton/ton');
const { Address, beginCell } = require('@ton/core');

async function runSmokeTest() {
  const chainIndexerMode = process.env.CHAIN_INDEXER_MODE || 'mock';

  if (chainIndexerMode === 'mock') {
    console.error("❌ ERROR: CHAIN_INDEXER_MODE is set to 'mock'. Real-chain smoke test refused.");
    process.exit(1);
  }

  const vestingAddressStr = process.env.DIAO_VESTING_ADDRESS || '';
  const minterAddressStr = process.env.DIAO_JETTON_MINTER_ADDRESS || '';
  const apiBaseUrl = process.env.TON_API_BASE_URL || 'https://toncenter.com/api/v2/jsonRPC';
  const apiKey = process.env.TON_API_KEY || '';

  if (!vestingAddressStr) {
    console.error("❌ ERROR: Missing required env variable DIAO_VESTING_ADDRESS.");
    process.exit(1);
  }
  if (!minterAddressStr) {
    console.error("❌ ERROR: Missing required env variable DIAO_JETTON_MINTER_ADDRESS.");
    process.exit(1);
  }

  // Address parsing validation
  let vestingAddress;
  let minterAddress;
  try {
    vestingAddress = Address.parse(vestingAddressStr);
    console.log(`✅ Vesting address parsed: ${vestingAddress.toString()}`);
  } catch (err) {
    console.error(`❌ ERROR: Failed to parse DIAO_VESTING_ADDRESS "${vestingAddressStr}": ${err.message}`);
    process.exit(1);
  }

  try {
    minterAddress = Address.parse(minterAddressStr);
    console.log(`✅ Minter address parsed: ${minterAddress.toString()}`);
  } catch (err) {
    console.error(`❌ ERROR: Failed to parse DIAO_JETTON_MINTER_ADDRESS "${minterAddressStr}": ${err.message}`);
    process.exit(1);
  }

  // Initialize TON client
  console.log(`Connecting to TON RPC endpoint: ${apiBaseUrl} (API Key: ${apiKey ? '***PRESENT***' : 'NONE'})`);
  const client = new TonClient({
    endpoint: apiBaseUrl,
    apiKey: apiKey || undefined,
  });

  // Check Vesting contract get_vesting_data
  try {
    console.log("Reading vesting data from contract...");
    const result = await client.runMethod(vestingAddress, 'get_vesting_data');
    console.log(`✅ Vesting contract data read successfully. Stack items: ${result.stack.remaining}`);
  } catch (err) {
    console.error(`❌ ERROR: Failed to read vesting data: ${err.message}`);
    process.exit(1);
  }

  // Check test wallet packages if provided
  const testWalletStr = process.env.REAL_CHAIN_TEST_WALLET || '';
  if (testWalletStr) {
    try {
      const testWallet = Address.parse(testWalletStr);
      console.log(`Checking user packages for test wallet: ${testWallet.toString()}`);
      
      const argCell = beginCell().storeAddress(testWallet).endCell();
      const result = await client.runMethod(vestingAddress, 'get_user_packages', [
        { type: 'slice', cell: argCell }
      ]);
      console.log(`✅ User packages read successfully. Stack items: ${result.stack.remaining}`);
    } catch (err) {
      console.error(`❌ ERROR: Failed to query user packages for test wallet "${testWalletStr}": ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log("ℹ️ Info: No REAL_CHAIN_TEST_WALLET provided, skipping user packages query.");
  }

  console.log("\n✅ Real chain read-only smoke test completed successfully!");
  process.exit(0);
}

runSmokeTest().catch(err => {
  console.error("Unexpected execution failure:", err);
  process.exit(1);
});
