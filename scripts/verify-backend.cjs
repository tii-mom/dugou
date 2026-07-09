/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const d1Dir = path.join(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

let sqliteFiles = [];
if (fs.existsSync(d1Dir)) {
  sqliteFiles = fs.readdirSync(d1Dir)
    .filter(file => file.endsWith('.sqlite') && file !== 'metadata.sqlite')
    .map(file => path.join(d1Dir, file));
}

function runSqlOnDbs(sql) {
  sqliteFiles.forEach(dbPath => {
    try {
      execSync(`sqlite3 "${dbPath}" "${sql.replace(/"/g, '\\"')}"`);
    } catch (err) {
      console.error(`Failed to execute SQL on db ${dbPath}:`, err.message);
    }
  });
}

if (sqliteFiles.length === 0) {
  console.log("⚠️ No SQLite databases found at .wrangler folder. If you are running in CI or a fresh environment, make sure to start the wrangler server first to initialize the state files.");
} else {
  // Prepare SQL testing states with correct columns
  const initDataSql = `
DELETE FROM sessions WHERE id = 'test-session-uuid';
DELETE FROM users WHERE id = 'test-user-uuid';
DELETE FROM loss_claims WHERE id LIKE 'test-claim-%';
DELETE FROM diao_sale_intents;
DELETE FROM diao_claims;
DELETE FROM mock_chain_txs;
DELETE FROM diao_purchases;
DELETE FROM social_task_submissions;

INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('diao_current_round', '0', datetime('now'));

INSERT INTO users (id, telegram_id, telegram_username, telegram_first_name, telegram_last_name, created_at, updated_at)
VALUES ('test-user-uuid', '123456789', 'test_auth_user', 'Test', 'User', datetime('now'), datetime('now'));

INSERT INTO sessions (id, user_id, expires_at, created_at)
VALUES ('test-session-uuid', 'test-user-uuid', '2099-01-01T00:00:00.000Z', datetime('now'));

-- 1. Valid Claim (not expired, not submitted)
INSERT INTO loss_claims (id, user_id, r2_object_key, status, expires_at, file_size, file_mime, created_at, updated_at, source)
VALUES ('test-claim-valid', 'test-user-uuid', 'test-key-valid', 'not_submitted', datetime('now', '+1 hour'), 1000, 'image/jpeg', datetime('now'), datetime('now'), 'api');

-- 2. Expired Claim
INSERT INTO loss_claims (id, user_id, r2_object_key, status, expires_at, file_size, file_mime, created_at, updated_at, source)
VALUES ('test-claim-expired', 'test-user-uuid', 'test-key-expired', 'not_submitted', datetime('now', '-1 hour'), 1000, 'image/jpeg', datetime('now'), datetime('now'), 'api');

-- 3. Already Submitted Claim
INSERT INTO loss_claims (id, user_id, r2_object_key, status, expires_at, file_size, file_mime, created_at, updated_at, source)
VALUES ('test-claim-submitted', 'test-user-uuid', 'test-key-submitted', 'submitted', datetime('now', '+1 hour'), 1000, 'image/jpeg', datetime('now'), datetime('now'), 'api');

-- 4. Other User Claim
INSERT INTO loss_claims (id, user_id, r2_object_key, status, expires_at, file_size, file_mime, created_at, updated_at, source)
VALUES ('test-claim-other-user', 'some-other-uuid', 'test-key-other-user', 'not_submitted', datetime('now', '+1 hour'), 1000, 'image/jpeg', datetime('now'), datetime('now'), 'api');
`;

  // Seed data
  sqliteFiles.forEach(dbPath => {
    console.log(`Seeding test data to: ${dbPath}`);
    try {
      // Apply social tasks migration to test db if table doesn't exist
      const migrationSql = fs.readFileSync(path.join(process.cwd(), 'migrations/0005_social_tasks.sql'), 'utf8');
      const tempMigrationPath = path.join(process.cwd(), '.wrangler/temp_migration.sql');
      fs.writeFileSync(tempMigrationPath, migrationSql, 'utf8');
      execSync(`sqlite3 "${dbPath}" < "${tempMigrationPath}"`);

      const seedSqlPath = path.join(process.cwd(), '.wrangler/seed.sql');
      fs.writeFileSync(seedSqlPath, initDataSql, 'utf8');
      execSync(`sqlite3 "${dbPath}" < "${seedSqlPath}"`);
    } catch (err) {
      console.error(`Failed to seed db ${dbPath}:`, err.message);
    }
  });
}

const baseUrl = 'http://127.0.0.1:3001';
const cookieHeader = 'session_id=test-session-uuid';
const envText = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const adminReviewToken = (envText.match(/^ADMIN_REVIEW_TOKEN=(.*)$/m)?.[1] || '').trim();

async function runTests() {
  console.log("\n=== Starting Integration Tests ===\n");

  let hasFailed = false;

  // Helper assertion
  function assert(testName, condition, details) {
    if (condition) {
      console.log(`✅ ${testName} - PASS`);
    } else {
      console.error(`❌ ${testName} - FAIL`);
      if (details) console.error(`   Details: ${details}`);
      hasFailed = true;
    }
  }

  function getActiveDbPath(id, table = 'diao_sale_intents') {
    for (const dbPath of sqliteFiles) {
      try {
        const count = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM ${table} WHERE id = '${id}'"`).toString().trim();
        if (Number(count) > 0) {
          return dbPath;
        }
      } catch {}
    }
    return sqliteFiles[0];
  }

  // 1. GET /api/price/diao
  try {
    const res = await fetch(`${baseUrl}/api/price/diao`);
    const json = await res.json();
    assert(
      "Test 1: GET /api/price/diao compatibility route",
      res.status === 200 && json.priceUsd === 0.042 && !JSON.stringify(json).includes("$G"),
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 1: GET /api/price/diao", false, err.message);
  }

  // 2. POST /api/token-sale/intent (Unauthorized)
  try {
    const res = await fetch(`${baseUrl}/api/token-sale/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: '0x123', packages: 2 })
    });
    assert(
      "Test 2: POST /api/token-sale/intent (Unauthorized -> 401)",
      res.status === 401,
      `Status: ${res.status}`
    );
  } catch (err) {
    assert("Test 2: POST /api/token-sale/intent (Unauthorized)", false, err.message);
  }

  // 3. POST /api/token-sale/intent (Valid 5 packages)
  try {
    const res = await fetch(`${baseUrl}/api/token-sale/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({ walletAddress: '0x1234567890abcdef1234567890abcdef12345678', packages: 5 })
    });
    const json = await res.json();
    assert(
      "Test 3: POST /api/token-sale/intent (Valid 5 packages intent creation)",
      res.status === 200
        && json.intent
        && json.intent.status === 'pending_wallet_signature'
        && json.intent.source === 'api'
        && json.intent.totalTon === 290
        && json.intent.contractGasBufferTon === 0.1
        && json.intent.contractRequiredTon === 290.1
        && json.intent.immediateDIAO === 1000000
        && json.intent.lockedDIAO === 15000000
        && json.intent.perRoundDIAO === 1000000,
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 3: POST /api/token-sale/intent (Valid 5 packages)", false, err.message);
  }

  // 4. POST /api/token-sale/intent (Cumulative cap test)
  try {
    const res = await fetch(`${baseUrl}/api/token-sale/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({ walletAddress: '0x1234567890abcdef1234567890abcdef12345678', packages: 6 })
    });
    const json = await res.json();
    assert(
      "Test 4: POST /api/token-sale/intent (Cumulative package cap > 10 blocks -> 400)",
      res.status === 400 && json.error && (json.error.includes("上限") || json.error.includes("额度")),
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 4: POST /api/token-sale/intent (Cumulative cap test)", false, err.message);
  }

  // 5. POST /api/loss-proofs/upload (Valid claim upload)
  try {
    const res = await fetch(`${baseUrl}/api/loss-proofs/upload?key=test-key-valid`, {
      method: 'PUT',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'image/jpeg'
      },
      body: Buffer.alloc(100)
    });
    const json = await res.json();
    assert(
      "Test 5: POST /api/loss-proofs/upload (Valid JPEG upload -> 200)",
      res.status === 200 && json.ok === true,
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 5: POST /api/loss-proofs/upload (Valid claim upload)", false, err.message);
  }

  // 6. POST /api/loss-proofs/upload (Expired claim)
  try {
    const res = await fetch(`${baseUrl}/api/loss-proofs/upload?key=test-key-expired`, {
      method: 'PUT',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'image/jpeg'
      },
      body: Buffer.alloc(100)
    });
    const json = await res.json();
    assert(
      "Test 6: POST /api/loss-proofs/upload (Expired upload URL -> 410)",
      res.status === 410 && json.error && json.error.includes("expired"),
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 6: POST /api/loss-proofs/upload (Expired claim)", false, err.message);
  }

  // 7. POST /api/loss-proofs/upload (Already submitted -> block PUT)
  try {
    const res = await fetch(`${baseUrl}/api/loss-proofs/upload?key=test-key-submitted`, {
      method: 'PUT',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'image/jpeg'
      },
      body: Buffer.alloc(100)
    });
    const json = await res.json();
    assert(
      "Test 7: POST /api/loss-proofs/upload (Already submitted overrides prevention -> 400)",
      res.status === 400 && json.error && json.error.includes("submitted"),
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 7: POST /api/loss-proofs/upload (Already submitted)", false, err.message);
  }

  // 8. POST /api/loss-proofs/upload (Other user's claim)
  try {
    const res = await fetch(`${baseUrl}/api/loss-proofs/upload?key=test-key-other-user`, {
      method: 'PUT',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'image/jpeg'
      },
      body: Buffer.alloc(100)
    });
    const json = await res.json();
    assert(
      "Test 8: POST /api/loss-proofs/upload (Ownership boundary checks -> 403)",
      res.status === 403 && json.error && json.error.includes("denied"),
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 8: POST /api/loss-proofs/upload (Other user's claim)", false, err.message);
  }

  // 9. POST /api/loss-proofs/upload (Mime-type mismatch)
  try {
    const res = await fetch(`${baseUrl}/api/loss-proofs/upload?key=test-key-valid`, {
      method: 'PUT',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'image/png'
      },
      body: Buffer.alloc(100)
    });
    const json = await res.json();
    assert(
      "Test 9: POST /api/loss-proofs/upload (MIME type mismatch -> 400)",
      res.status === 400 && json.error && json.error.includes("MIME"),
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 9: POST /api/loss-proofs/upload (Mime-type mismatch)", false, err.message);
  }

  // 10. POST /api/loss-proofs/upload (Size exceed)
  try {
    const res = await fetch(`${baseUrl}/api/loss-proofs/upload?key=test-key-valid`, {
      method: 'PUT',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'image/jpeg'
      },
      body: Buffer.alloc(1001)
    });
    const json = await res.json();
    assert(
      "Test 10: POST /api/loss-proofs/upload (Content-Length exceeds allocation -> 413)",
      res.status === 413 && json.error && json.error.includes("exceeds"),
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 10: POST /api/loss-proofs/upload (Size exceed)", false, err.message);
  }

  // === NEW CHAIN CONFIRMATION & MOCK INDEXER INTEGRATION TESTS ===

  let activeIntentId = '';
  let activeQueryId = '';
  const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';

  // Test 11: Create Purchase Intent
  try {
    const res = await fetch(`${baseUrl}/api/token-sale/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ walletAddress, packages: 2 })
    });
    const json = await res.json();
    assert(
      "Test 11: POST /api/token-sale/intent (Valid creation)",
      res.status === 200 && json.intent && json.intent.intentId && json.intent.queryId,
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
    if (json.intent) {
      activeIntentId = json.intent.intentId;
      activeQueryId = json.intent.queryId;
    }
  } catch (err) {
    assert("Test 11: POST /api/token-sale/intent", false, err.message);
  }

  // Test 12: Confirm without transaction (should keep pending)
  try {
    const res = await fetch(`${baseUrl}/api/purchases/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ intentId: activeIntentId })
    });
    const json = await res.json();
    assert(
      "Test 12: POST /api/purchases/confirm (Confirm without transaction -> pending)",
      res.status === 200 && json.status === 'pending_chain_confirmation',
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 12: POST /api/purchases/confirm (Pending check)", false, err.message);
  }

  // Test 13: Confirm with random intent (should fail 404)
  try {
    const res = await fetch(`${baseUrl}/api/purchases/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ intentId: 'random-intent-uuid' })
    });
    assert(
      "Test 13: POST /api/purchases/confirm (Non-existent intent -> 404)",
      res.status === 404,
      `Status: ${res.status}`
    );
  } catch (err) {
    assert("Test 13: POST /api/purchases/confirm (404 check)", false, err.message);
  }

  // Test 14: On-chain validations rejection (wrong sender, wrong receiver, wrong opcode, insufficient amount, wrong packages, failed VM)
  const validationCases = [
    {
      name: "Wrong receiver",
      sql: `INSERT INTO mock_chain_txs (hash, sender, receiver, amount_nano, opcode, query_id, package_count, success, lt) VALUES ('tx-wrong-rec', '${walletAddress}', 'wrong-receiver', '116000000000', 0x42555950, '${activeQueryId}', 2, 1, '10001');`
    },
    {
      name: "Wrong opcode",
      sql: `INSERT INTO mock_chain_txs (hash, sender, receiver, amount_nano, opcode, query_id, package_count, success, lt) VALUES ('tx-wrong-op', '${walletAddress}', 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot', '116000000000', 0x11112222, '${activeQueryId}', 2, 1, '10002');`
    },
    {
      name: "Insufficient amount",
      sql: `INSERT INTO mock_chain_txs (hash, sender, receiver, amount_nano, opcode, query_id, package_count, success, lt) VALUES ('tx-low-amt', '${walletAddress}', 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot', '50000000000', 0x42555950, '${activeQueryId}', 2, 1, '10003');`
    },
    {
      name: "Package count mismatch",
      sql: `INSERT INTO mock_chain_txs (hash, sender, receiver, amount_nano, opcode, query_id, package_count, success, lt) VALUES ('tx-wrong-pkg', '${walletAddress}', 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot', '116000000000', 0x42555950, '${activeQueryId}', 1, 1, '10004');`
    },
    {
      name: "Sender mismatch",
      sql: `INSERT INTO mock_chain_txs (hash, sender, receiver, amount_nano, opcode, query_id, package_count, success, lt) VALUES ('tx-wrong-snd', 'different-wallet', 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot', '116000000000', 0x42555950, '${activeQueryId}', 2, 1, '10005');`
    },
    {
      name: "Failed VM execution",
      sql: `INSERT INTO mock_chain_txs (hash, sender, receiver, amount_nano, opcode, query_id, package_count, success, lt) VALUES ('tx-failed-vm', '${walletAddress}', 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot', '116000000000', 0x42555950, '${activeQueryId}', 2, 0, '10006');`
    }
  ];

  for (const tc of validationCases) {
    try {
      runSqlOnDbs("DELETE FROM mock_chain_txs;");
      runSqlOnDbs(tc.sql);
      const res = await fetch(`${baseUrl}/api/purchases/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
        body: JSON.stringify({ intentId: activeIntentId })
      });
      const json = await res.json();
      assert(
        `Test 14: Validation bypass prevention (${tc.name} -> pending)`,
        res.status === 200 && json.status === 'pending_chain_confirmation',
        `Status: ${res.status}, Body: ${JSON.stringify(json)}`
      );
    } catch (err) {
      assert(`Test 14: Validation check ${tc.name}`, false, err.message);
    }
  }

  // Test 15: Valid transaction confirmation
  try {
    runSqlOnDbs("DELETE FROM mock_chain_txs;");
    runSqlOnDbs(`INSERT INTO mock_chain_txs (hash, sender, receiver, amount_nano, opcode, query_id, package_count, success, lt) VALUES ('valid-hash', '${walletAddress}', 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot', '116000000000', 0x42555950, '${activeQueryId}', 2, 1, '20001');`);

    const res = await fetch(`${baseUrl}/api/purchases/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ intentId: activeIntentId })
    });
    const json = await res.json();
    assert(
      "Test 15: Valid purchase on-chain confirm (pending -> confirmed)",
      res.status === 200 && json.status === 'confirmed' && json.purchase && json.purchase.paid_ton === 116,
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 15: Valid transaction confirmation", false, err.message);
  }

  // Test 16: Duplicate transaction hash reuse prevention
  try {
    // 1. Create a new purchase intent
    const intentRes = await fetch(`${baseUrl}/api/token-sale/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ walletAddress, packages: 1 })
    });
    const intentJson = await intentRes.json();
    const newIntentId = intentJson.intent.intentId;
    const newQueryId = intentJson.intent.queryId;

    // 2. Insert mock transaction matching the queryId, but using the ALREADY USED hash 'valid-hash'
    runSqlOnDbs("DELETE FROM mock_chain_txs;");
    runSqlOnDbs(`INSERT INTO mock_chain_txs (hash, sender, receiver, amount_nano, opcode, query_id, package_count, success, lt) VALUES ('valid-hash', '${walletAddress}', 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot', '58000000000', 0x42555950, '${newQueryId}', 1, 1, '20002');`);

    const res = await fetch(`${baseUrl}/api/purchases/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ intentId: newIntentId })
    });
    assert(
      "Test 16: Duplicate hash usage prevention (409 Conflict)",
      res.status === 409,
      `Status: ${res.status}`
    );
  } catch (err) {
    assert("Test 16: Duplicate transaction hash reuse", false, err.message);
  }

  // Test 17: Claim Intent restrictions & creation
  let claimIntentId = '';
  let claimQueryId = '';
  try {
    // Try creating claim intent when round is 0 (claimed 0, unlocked 0 -> no claimable rounds)
    const resFail = await fetch(`${baseUrl}/api/claims/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ walletAddress })
    });
    const failJson = await resFail.json();
    assert(
      "Test 17a: POST /api/claims/intent (Unreleased rounds -> 400 rejection)",
      resFail.status === 400 && failJson.error && failJson.error.includes("无可领取"),
      `Status: ${resFail.status}, Body: ${JSON.stringify(failJson)}`
    );

    // Simulate current unlocked round is 1
    runSqlOnDbs("INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('diao_current_round', '1', datetime('now'));");

    // Try again
    const resOk = await fetch(`${baseUrl}/api/claims/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ walletAddress })
    });
    const okJson = await resOk.json();
    assert(
      "Test 17b: POST /api/claims/intent (Rounds unlocked -> 200 creation)",
      resOk.status === 200 && okJson.claim && okJson.claim.claimId && okJson.claim.queryId,
      `Status: ${resOk.status}, Body: ${JSON.stringify(okJson)}`
    );
    if (okJson.claim) {
      claimIntentId = okJson.claim.claimId;
      claimQueryId = okJson.claim.queryId;
    }
  } catch (err) {
    assert("Test 17: Claim Intent restrictions", false, err.message);
  }

  // Test 18: Claim Confirmation
  try {
    // 1. Confirm before chain transaction is mined (pending)
    const resPending = await fetch(`${baseUrl}/api/claims/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ claimId: claimIntentId })
    });
    const pendingJson = await resPending.json();
    assert(
      "Test 18a: POST /api/claims/confirm (No transaction -> pending)",
      resPending.status === 200 && pendingJson.status === 'pending_chain_confirmation',
      `Status: ${resPending.status}, Body: ${JSON.stringify(pendingJson)}`
    );

    // 2. Insert mock claim transaction
    runSqlOnDbs("DELETE FROM mock_chain_txs;");
    runSqlOnDbs(`INSERT INTO mock_chain_txs (hash, sender, receiver, amount_nano, opcode, query_id, success, lt) VALUES ('claim-tx-hash', '${walletAddress}', 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot', '100000000', 0x434c6275, '${claimQueryId}', 1, '30001');`);

    // 3. Confirm again (should confirmed & sync highestClaimedRound to 1)
    const resConfirmed = await fetch(`${baseUrl}/api/claims/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ claimId: claimIntentId })
    });
    const confirmedJson = await resConfirmed.json();
    assert(
      "Test 18b: POST /api/claims/confirm (Valid transaction -> confirmed)",
      resConfirmed.status === 200 && confirmedJson.status === 'confirmed',
      `Status: ${resConfirmed.status}, Body: ${JSON.stringify(confirmedJson)}`
    );

    // 4. Verify highestClaimedRound has synced locally
    const purchasesRes = await fetch(`${baseUrl}/api/purchases/status`, {
      headers: { 'Cookie': cookieHeader }
    });
    const purchasesJson = await purchasesRes.json();
    const hasSynced = purchasesJson.purchases && purchasesJson.purchases.every(p => p.highestClaimedRound === 1);
    assert(
      "Test 18c: Verify purchase ledger synced highestClaimedRound = 1",
      hasSynced === true,
      `Purchases: ${JSON.stringify(purchasesJson)}`
    );
  } catch (err) {
    assert("Test 18: Claim Confirmation Flow", false, err.message);
  }

  // Test 19: Battlefield Data Source flags
  try {
    const res = await fetch(`${baseUrl}/api/battlefield/data`, {
      headers: { 'Cookie': cookieHeader }
    });
    const json = await res.json();
    assert(
      "Test 19: GET /api/battlefield/data (Returns chain sources)",
      res.status === 200 && json.diaoBalanceSource === 'chain' && json.vestingSource === 'chain',
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 19: Battlefield Data Source flags", false, err.message);
  }

  // === PROBLEM 1 & 2 BOUNDARY STATE MACHINE & EXPIRY TESTS ===

  // Test 20: Purchase broadcast state machine transitions
  try {
    // Clean intents first
    runSqlOnDbs("DELETE FROM diao_sale_intents;");

    // 1. Create initial intent
    const resIntent = await fetch(`${baseUrl}/api/token-sale/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ walletAddress, packages: 2 })
    });
    const intentJson = await resIntent.json();
    const intentId = intentJson.intent.intentId;

    // 2. pending_wallet_signature -> pending_chain_confirmation (Success 200)
    const resB1 = await fetch(`${baseUrl}/api/purchases/broadcasted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ intentId, tx_boc: 'boc-content-1' })
    });
    const b1Json = await resB1.json();
    assert(
      "Test 20a: Purchase broadcast transition (pending_wallet_signature -> pending_chain_confirmation)",
      resB1.status === 200 && b1Json.status === 'pending_chain_confirmation',
      `Status: ${resB1.status}, Body: ${JSON.stringify(b1Json)}`
    );

    // 3. pending_chain_confirmation -> pending_chain_confirmation (Idempotent Success 200)
    const resB2 = await fetch(`${baseUrl}/api/purchases/broadcasted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ intentId, tx_boc: 'boc-content-2' })
    });
    const b2Json = await resB2.json();
    assert(
      "Test 20b: Purchase broadcast transition idempotent retry",
      resB2.status === 200 && b2Json.status === 'pending_chain_confirmation',
      `Status: ${resB2.status}, Body: ${JSON.stringify(b2Json)}`
    );

    // 4. Test final states (confirmed, failed, expired) return 409 Conflict
    const finalStates = ['confirmed', 'failed', 'expired'];
    for (const state of finalStates) {
      runSqlOnDbs(`UPDATE diao_sale_intents SET status = '${state}' WHERE id = '${intentId}';`);
      const resFinal = await fetch(`${baseUrl}/api/purchases/broadcasted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
        body: JSON.stringify({ intentId, tx_boc: 'boc-content-retry' })
      });
      const finalJson = await resFinal.json();
      assert(
        `Test 20c: Purchase broadcast transition from final state (${state} -> 409 Conflict)`,
        resFinal.status === 409 && finalJson.error === 'Invalid state transition.' && finalJson.status === state,
        `Status: ${resFinal.status}, Body: ${JSON.stringify(finalJson)}`
      );

      // Verify that status remained unchanged
      const activeDb = getActiveDbPath(intentId);
      const currentStatus = execSync(`sqlite3 "${activeDb}" "SELECT status FROM diao_sale_intents WHERE id = '${intentId}'"`).toString().trim();
      assert(
        `Test 20d: Status for purchase remains '${state}' in db`,
        currentStatus === state,
        `Expected: ${state}, Got: ${currentStatus}`
      );
    }
  } catch (err) {
    assert("Test 20: Purchase broadcast state machine transitions", false, err.message);
  }

  // Test 21: Claim broadcast state machine transitions
  try {
    // Clean claims first
    runSqlOnDbs("DELETE FROM diao_claims;");

    // 1. Create initial claim intent (requires round 1 to be unlocked and a confirmed purchase)
    runSqlOnDbs(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('diao_current_round', '1', datetime('now'));`);
    runSqlOnDbs("DELETE FROM diao_purchases;");
    runSqlOnDbs(`INSERT INTO diao_purchases (id, user_id, wallet_address, tx_hash, package_count, paid_ton, immediate_diao, locked_diao, total_diao, highest_claimed_round, status, created_at, updated_at) VALUES ('purchase-claim-prep', 'test-user-uuid', '${walletAddress}', 'dummy-tx', 2, 116.0, 400000, 6000000, 6400000, 0, 'confirmed', datetime('now'), datetime('now'));`);

    const resClaim = await fetch(`${baseUrl}/api/claims/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ walletAddress })
    });
    const claimJson = await resClaim.json();
    const claimId = claimJson.claim.claimId;

    // 2. pending_wallet_signature -> pending_chain_confirmation (Success 200)
    const resC1 = await fetch(`${baseUrl}/api/claims/broadcasted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ claimId, tx_boc: 'claim-boc-content-1' })
    });
    const c1Json = await resC1.json();
    assert(
      "Test 21a: Claim broadcast transition (pending_wallet_signature -> pending_chain_confirmation)",
      resC1.status === 200 && c1Json.status === 'pending_chain_confirmation',
      `Status: ${resC1.status}, Body: ${JSON.stringify(c1Json)}`
    );

    // 3. Test final states (confirmed, failed, expired) return 409 Conflict
    const claimFinalStates = ['confirmed', 'failed', 'expired'];
    for (const state of claimFinalStates) {
      runSqlOnDbs(`UPDATE diao_claims SET status = '${state}' WHERE id = '${claimId}';`);
      const resFinal = await fetch(`${baseUrl}/api/claims/broadcasted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
        body: JSON.stringify({ claimId, tx_boc: 'claim-boc-retry' })
      });
      const finalJson = await resFinal.json();
      assert(
        `Test 21b: Claim broadcast transition from final state (${state} -> 409 Conflict)`,
        resFinal.status === 409 && finalJson.error === 'Invalid state transition.' && finalJson.status === state,
        `Status: ${resFinal.status}, Body: ${JSON.stringify(finalJson)}`
      );

      // Verify that status remained unchanged
      const activeDb = getActiveDbPath(claimId, 'diao_claims');
      const currentStatus = execSync(`sqlite3 "${activeDb}" "SELECT status FROM diao_claims WHERE id = '${claimId}'"`).toString().trim();
      assert(
        `Test 21c: Status for claim remains '${state}' in db`,
        currentStatus === state,
        `Expected: ${state}, Got: ${currentStatus}`
      );
    }
  } catch (err) {
    assert("Test 21: Claim broadcast state machine transitions", false, err.message);
  }

  // Test 22: Expired purchase intents quota release
  try {
    runSqlOnDbs("DELETE FROM diao_sale_intents;");

    // 1. Insert an expired pending_wallet_signature intent with packages = 10
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago expired
    runSqlOnDbs(`
      INSERT INTO diao_sale_intents (id, user_id, wallet_address, packages, total_ton, immediate_diao, locked_diao, per_round_diao, status, created_at, updated_at, query_id, expected_amount_nano, expires_at)
      VALUES ('expired-intent-uuid', 'test-user-uuid', '${walletAddress}', 10, 580.0, 1000000, 15000000, 1000000, 'pending_wallet_signature', '${pastDate}', '${pastDate}', '88887777', '580000000000', '${pastDate}');
    `);

    // 2. Request a new purchase intent of packages = 1 (should succeed since packages = 10 expired intent is resolved to expired first)
    const resNew = await fetch(`${baseUrl}/api/token-sale/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ walletAddress, packages: 1 })
    });
    const newJson = await resNew.json();
    assert(
      "Test 22a: Create new intent succeeds after expired intent releases quota",
      resNew.status === 200 && newJson.intent && newJson.intent.status === 'pending_wallet_signature',
      `Status: ${resNew.status}, Body: ${JSON.stringify(newJson)}`
    );

    // 3. Verify old intent is marked as expired
    const activeDb = getActiveDbPath(newJson.intent.intentId);
    const oldStatus = execSync(`sqlite3 "${activeDb}" "SELECT status FROM diao_sale_intents WHERE id = 'expired-intent-uuid'"`).toString().trim();
    assert(
      "Test 22b: Stale intent status is updated to 'expired'",
      oldStatus === 'expired',
      `Expected 'expired', got '${oldStatus}'`
    );
  } catch (err) {
    assert("Test 22: Expired purchase intents quota release", false, err.message);
  }

  // Agnes AI Integration & Social Tasks Tests
  console.log("\n=== Starting Agnes AI & Social Tasks Tests ===\n");

  // Test 23: Agnes key not configured -> loss submit returns pending_review
  try {
    const res = await fetch(`${baseUrl}/api/loss-proofs/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({
        objectKey: 'test-key-valid',
        originalFileName: 'test.png'
      })
    });
    const json = await res.json();
    assert(
      "Test 23: Agnes key not configured -> loss submit returns pending_review",
      res.status === 200 && json.lossClaim && json.lossClaim.status === 'pending_review',
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
  } catch (err) {
    assert("Test 23: Loss submit Agnes fallback", false, err.message);
  }

  // Test 24: Social task submit - Unauthorized (401)
  try {
    const res = await fetch(`${baseUrl}/api/social-tasks/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'x',
        taskType: 'share_diao',
        url: 'https://x.com/user/status/123'
      })
    });
    assert(
      "Test 24: Social task submit - Unauthorized (401)",
      res.status === 401,
      `Expected 401, got ${res.status}`
    );
  } catch (err) {
    assert("Test 24: Social task unauthorized", false, err.message);
  }

  // Test 25: Social task submit - Non-HTTPS URL (400)
  try {
    const res = await fetch(`${baseUrl}/api/social-tasks/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({
        platform: 'x',
        taskType: 'share_diao',
        url: 'http://x.com/user/status/123'
      })
    });
    assert(
      "Test 25: Social task submit - Non-HTTPS URL (400)",
      res.status === 400,
      `Expected 400, got ${res.status}`
    );
  } catch (err) {
    assert("Test 25: Social task HTTPS validation", false, err.message);
  }

  // Test 26: Social task submit - Non-whitelist platform (400)
  try {
    const res = await fetch(`${baseUrl}/api/social-tasks/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({
        platform: 'facebook',
        taskType: 'share_diao',
        url: 'https://facebook.com/user/status/123'
      })
    });
    assert(
      "Test 26: Social task submit - Non-whitelist platform (400)",
      res.status === 400,
      `Expected 400, got ${res.status}`
    );
  } catch (err) {
    assert("Test 26: Social task platform validation", false, err.message);
  }

  // Test 27: Social task submit - SSRF / Non-whitelisted domain (e.g. x.com.evil.com)
  try {
    const res = await fetch(`${baseUrl}/api/social-tasks/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({
        platform: 'x',
        taskType: 'share_diao',
        url: 'https://x.com.evil.com/user/status/123'
      })
    });
    assert(
      "Test 27: Social task submit - SSRF / Hostname validation check",
      res.status === 400,
      `Expected 400, got ${res.status}`
    );
  } catch (err) {
    assert("Test 27: Social task SSRF validation", false, err.message);
  }

  // Test 28: Social task submit - Duplicate url submission (409)
  try {
    const res1 = await fetch(`${baseUrl}/api/social-tasks/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({
        platform: 'x',
        taskType: 'share_diao',
        url: 'https://x.com/diao_official/status/999'
      })
    });
    const res2 = await fetch(`${baseUrl}/api/social-tasks/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({
        platform: 'x',
        taskType: 'share_diao',
        url: 'https://x.com/diao_official/status/999'
      })
    });
    assert(
      "Test 28: Social task submit - Duplicate url submission (409)",
      res1.status === 200 && res2.status === 409,
      `First status: ${res1.status}, Second status: ${res2.status}`
    );
  } catch (err) {
    assert("Test 28: Social task duplicate verification", false, err.message);
  }

  // Test 29: Admin social task review - Unauthorized (401)
  try {
    const res = await fetch(`${baseUrl}/api/admin/social-tasks?status=pending_review`);
    assert(
      "Test 29: Admin social task review - Unauthorized (401)",
      res.status === 401,
      `Expected 401, got ${res.status}`
    );
  } catch (err) {
    assert("Test 29: Admin social task review unauthorized", false, err.message);
  }

  // Test 30: Admin social task review - List pending (200)
  let latestTaskSubmissionId = '';
  try {
    const res = await fetch(`${baseUrl}/api/admin/social-tasks?status=pending_review`, {
      headers: { 'Authorization': `Bearer ${adminReviewToken}` }
    });
    const json = await res.json();
    assert(
      "Test 30: Admin social task review - List pending (200)",
      res.status === 200 && Array.isArray(json.submissions),
      `Status: ${res.status}, Body: ${JSON.stringify(json)}`
    );
    if (json.submissions && json.submissions.length > 0) {
      latestTaskSubmissionId = json.submissions[0].id;
    }
  } catch (err) {
    assert("Test 30: Admin social task list", false, err.message);
  }

  // Test 31: Admin social task review - PATCH non-existent (404)
  try {
    const res = await fetch(`${baseUrl}/api/admin/social-tasks`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminReviewToken}`
      },
      body: JSON.stringify({
        id: 'non-existent-submission',
        status: 'verified',
        reason: 'Approved.'
      })
    });
    assert(
      "Test 31: Admin social task review - PATCH non-existent (404)",
      res.status === 404,
      `Expected 404, got ${res.status}`
    );
  } catch (err) {
    assert("Test 31: Admin social task PATCH 404", false, err.message);
  }

  // Test 32: Admin social task review - PATCH verified success (200)
  try {
    if (latestTaskSubmissionId) {
      const res = await fetch(`${baseUrl}/api/admin/social-tasks`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminReviewToken}`
        },
        body: JSON.stringify({
          id: latestTaskSubmissionId,
          status: 'verified',
          reason: 'Approved by automated tests.'
        })
      });
      const json = await res.json();
      assert(
        "Test 32: Admin social task review - PATCH verified success (200)",
        res.status === 200 && json.submission && json.submission.status === 'verified',
        `Status: ${res.status}, Body: ${JSON.stringify(json)}`
      );
    } else {
      console.log("⚠️ Skipped Test 32: No social task submission found to verify.");
    }
  } catch (err) {
    assert("Test 32: Admin social task PATCH success", false, err.message);
  }

  console.log("\n=== Integration Tests Completed ===");
  if (hasFailed) {
    console.error("❌ Some integration tests failed.");
    process.exit(1);
  } else {
    console.log("✅ All integration tests passed successfully!");
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
